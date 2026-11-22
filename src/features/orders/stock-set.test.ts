// @vitest-environment node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { products } from "@/data/products";
import { applyStockSet, parseStockSetArgs } from "@/features/inventory/stock";
import { acquireStoreLock, lockFileFor, releaseStoreLocks } from "./process-lock";
import { formatStockChange, runStockSet } from "./stock-set";

const run = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("parseStockSetArgs", () => {
  it("đọc nhiều tham số hợp lệ", () => {
    expect(parseStockSetArgs(["p001=1", "p002=20"], products)).toEqual({
      requests: [
        { productId: "p001", quantity: 1 },
        { productId: "p002", quantity: 20 },
      ],
      errors: [],
    });
  });

  it("báo mọi lỗi cùng lúc và không trả request nào", () => {
    const { requests, errors } = parseStockSetArgs(
      ["p999=1", "p001=-1", "p002=1.5", "p003", "p005=abc", "p006=1", "p006=2"],
      products,
    );
    expect(requests).toEqual([]);
    expect(errors).toHaveLength(6);
    expect(errors.join("\n")).not.toContain("p001=-1 trùng");
    expect(errors.join("\n")).toMatch(/p999.*không có sản phẩm/);
    expect(errors.join("\n")).toMatch(/p006=2.*trùng/);
  });

  it("trùng id được báo kể cả khi lần đầu sai giá trị hoặc id không có", () => {
    const { errors } = parseStockSetArgs(["p001=-1", "p001=2", "p999=1", "p999=2"], products);
    expect(errors.filter((e) => e.includes("trùng"))).toHaveLength(2);
  });

  it("không có tham số → lỗi kèm hướng dẫn cú pháp", () => {
    expect(parseStockSetArgs([], products).errors[0]).toContain("p004=10");
  });
});

describe("applyStockSet", () => {
  it("đặt tồn kho mới, cộng chênh lệch vào baseline, không sửa đầu vào", () => {
    const levels = { inventory: { p004: 2, p010: 200 }, inventoryBaseline: { p004: 5, p010: 200 } };

    const { levels: next, changes } = applyStockSet(levels, [
      { productId: "p004", quantity: 10 },
      { productId: "p010", quantity: 150 },
    ]);

    expect(next.inventory).toEqual({ p004: 10, p010: 150 });
    expect(next.inventoryBaseline).toEqual({ p004: 13, p010: 150 });
    expect(changes.map(formatStockChange)).toEqual(["p004: 2 → 10 (+8)", "p010: 200 → 150 (-50)"]);
    expect(levels.inventory).toEqual({ p004: 2, p010: 200 });
  });
});

describe("runStockSet (AD-16)", () => {
  let dir: string;
  let storeFile: string;
  let ordersFile: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-stockset-"));
    storeFile = path.join(dir, "shop-store.json");
    ordersFile = path.join(dir, "orders.json");
  });

  afterEach(async () => {
    releaseStoreLocks();
    await rm(dir, { recursive: true, force: true });
  });

  const seed = (inventory: Record<string, number>, baseline: Record<string, number>) =>
    writeFile(
      storeFile,
      JSON.stringify({
        schemaVersion: 1,
        orders: [],
        inventory: { ...Object.fromEntries(products.map((p) => [p.id, p.stock])), ...inventory },
        inventoryBaseline: {
          ...Object.fromEntries(products.map((p) => [p.id, p.stock])),
          ...baseline,
        },
      }),
      "utf8",
    );

  it("đặt lại p004: tồn 2 → 10, baseline 5 → 13; thả lock khi xong", async () => {
    await seed({ p004: 2 }, { p004: 5 });

    const result = await runStockSet({ args: ["p004=10"], storeFile, ordersFile });

    expect(result).toEqual({
      ok: true,
      changes: [{ productId: "p004", from: 2, to: 10, delta: 8 }],
    });
    const store = JSON.parse(await readFile(storeFile, "utf8"));
    expect(store.inventory.p004).toBe(10);
    expect(store.inventoryBaseline.p004).toBe(13);
    expect(existsSync(lockFileFor(storeFile))).toBe(false);
  });

  it("tham số sai → ok false, file không đổi", async () => {
    await seed({}, {});
    const before = await readFile(storeFile, "utf8");

    const result = await runStockSet({ args: ["p001=-1"], storeFile, ordersFile });

    expect(result.ok).toBe(false);
    expect(await readFile(storeFile, "utf8")).toBe(before);
  });

  it("server đang giữ lock → 'dừng server trước', file không đổi", async () => {
    await seed({}, {});
    const before = await readFile(storeFile, "utf8");
    await writeFile(lockFileFor(storeFile), "4242", "utf8");

    const result = await runStockSet({
      args: ["p001=1"],
      storeFile,
      ordersFile,
      lock: { isAlive: () => true },
    });

    expect(result).toEqual({ ok: false, errors: [expect.stringContaining("dừng server trước")] });
    expect(await readFile(storeFile, "utf8")).toBe(before);
    expect(await readFile(lockFileFor(storeFile), "utf8")).toBe("4242");
  });

  it("nhiều id được đặt trong một lần commit", async () => {
    await seed({}, {});
    const result = await runStockSet({ args: ["p001=1", "p002=2"], storeFile, ordersFile });
    expect(result.ok).toBe(true);
    const store = JSON.parse(await readFile(storeFile, "utf8"));
    expect([store.inventory.p001, store.inventory.p002]).toEqual([1, 2]);
  });

  it("store hỏng → ok false với một dòng lỗi, file không đổi, lock được thả", async () => {
    await writeFile(storeFile, "{ hỏng", "utf8");

    const result = await runStockSet({ args: ["p001=1"], storeFile, ordersFile });

    expect(result).toEqual({
      ok: false,
      errors: [expect.stringContaining("Không đặt được tồn kho")],
    });
    expect(await readFile(storeFile, "utf8")).toBe("{ hỏng");
    expect(existsSync(lockFileFor(storeFile))).toBe(false);
  });

  it("chỉ thả lock của store mình, không đụng lock khác của tiến trình", async () => {
    await seed({}, {});
    const other = path.join(dir, "other-store.json");
    const otherLock = await acquireStoreLock(other);

    await runStockSet({ args: ["p001=1"], storeFile, ordersFile });

    expect(existsSync(otherLock)).toBe(true);
    expect(existsSync(lockFileFor(storeFile))).toBe(false);
  });

  it("chưa có store → khởi tạo như server (tồn kho = stock khai báo) rồi áp lệnh", async () => {
    const result = await runStockSet({ args: ["p010=5"], storeFile, ordersFile });

    expect(result.ok).toBe(true);
    const store = JSON.parse(await readFile(storeFile, "utf8"));
    expect(store.inventory.p010).toBe(5);
    expect(store.inventory.p001).toBe(products.find((p) => p.id === "p001")!.stock);
  });

  it(
    "chạy script thật bằng Node (không dependency mới): exit 0 khi đúng, exit 1 khi sai",
    { timeout: 120_000 },
    async () => {
      await seed({}, {});
      const env = { ...process.env, STORE_FILE: storeFile, ORDERS_FILE: ordersFile };
      const options = { env, cwd: REPO_ROOT, timeout: 50_000 };
      const args = [
        "--experimental-strip-types",
        "--no-warnings=ExperimentalWarning",
        "--import",
        "./scripts/ts-resolve.mjs",
        "scripts/stock-set.mts",
      ];

      const ok = await run(process.execPath, [...args, "p010=5"], options);
      expect(ok.stdout).toContain("p010: 200 → 5 (-195)");
      expect(JSON.parse(await readFile(storeFile, "utf8")).inventory.p010).toBe(5);

      const failed = await run(process.execPath, [...args, "p999=1"], options).catch(
        (error: { code: number; stderr: string }) => error,
      );
      expect(failed).toMatchObject({ code: 1 });
      expect((failed as { stderr: string }).stderr).toContain("p999");
    },
  );
});
