// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createJsonFileShopRepository } from "./order-repository";
import { acquireStoreLock, lockFileFor, releaseStoreLocks, StoreLockedError } from "./process-lock";

let dir: string;
let storeFile: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "shoplite-lock-"));
  storeFile = path.join(dir, "shop-store.json");
});

afterEach(async () => {
  releaseStoreLocks();
  await rm(dir, { recursive: true, force: true });
});

describe("acquireStoreLock (AD-5)", () => {
  it("tạo <store>.lock chứa PID của tiến trình này", async () => {
    const lockFile = await acquireStoreLock(storeFile);
    expect(lockFile).toBe(lockFileFor(storeFile));
    expect((await readFile(lockFile, "utf8")).trim()).toBe(String(process.pid));
  });

  it("lock của PID khác còn sống → StoreLockedError có tên file và PID", async () => {
    await writeFile(lockFileFor(storeFile), "4242", "utf8");

    const error = await acquireStoreLock(storeFile, { isAlive: () => true }).catch((e) => e);

    expect(error).toBeInstanceOf(StoreLockedError);
    expect(error).toMatchObject({ ownerPid: 4242, lockFile: lockFileFor(storeFile) });
    expect((error as Error).message).toContain("4242");
    // Lock của tiến trình kia không bị đụng tới.
    expect(await readFile(lockFileFor(storeFile), "utf8")).toBe("4242");
  });

  it("PID thật của tiến trình cha (còn sống) cũng bị từ chối với isAlive mặc định", async () => {
    await writeFile(lockFileFor(storeFile), String(process.ppid), "utf8");
    await expect(acquireStoreLock(storeFile)).rejects.toBeInstanceOf(StoreLockedError);
  });

  it("lấy lỗi thì lần sau thử lại được (tiến trình kia đã dừng)", async () => {
    await writeFile(lockFileFor(storeFile), "4242", "utf8");
    await expect(acquireStoreLock(storeFile, { isAlive: () => true })).rejects.toThrow();

    await acquireStoreLock(storeFile, { isAlive: () => false });
    expect((await readFile(lockFileFor(storeFile), "utf8")).trim()).toBe(String(process.pid));
  });

  it("lock của PID đã chết → ghi đè, chạy bình thường", async () => {
    await writeFile(lockFileFor(storeFile), "4242", "utf8");
    await acquireStoreLock(storeFile, { isAlive: () => false });
    expect((await readFile(lockFileFor(storeFile), "utf8")).trim()).toBe(String(process.pid));
  });

  it.each(["rác", "4242abc", "12.5", ""])(
    "lock hỏng (%j) → coi như lock chết, ghi đè",
    async (content) => {
      await writeFile(lockFileFor(storeFile), content, "utf8");
      await acquireStoreLock(storeFile, { isAlive: () => true });
      expect((await readFile(lockFileFor(storeFile), "utf8")).trim()).toBe(String(process.pid));
    },
  );

  it("releaseStoreLocks xóa lock của mình, không xóa lock đã đổi chủ", async () => {
    const lockFile = await acquireStoreLock(storeFile);
    releaseStoreLocks();
    expect(existsSync(lockFile)).toBe(false);

    await acquireStoreLock(storeFile);
    await writeFile(lockFile, "4242", "utf8"); // tiến trình khác đã chiếm lại
    releaseStoreLocks();
    expect(await readFile(lockFile, "utf8")).toBe("4242");
  });
});

describe("PID lock trong repository", () => {
  it("readState mặc định (không initialize) → tạo lock, không tạo store", async () => {
    const repository = createJsonFileShopRepository(storeFile);
    await repository.readState();
    expect(existsSync(lockFileFor(storeFile))).toBe(true);
    expect(existsSync(storeFile)).toBe(false);
  });

  it("thông điệp StoreLockedError hướng dẫn xóa lock khi PID bị cấp lại", async () => {
    await writeFile(lockFileFor(storeFile), "4242", "utf8");
    const error = await acquireStoreLock(storeFile, { isAlive: () => true }).catch((e) => e);
    expect((error as Error).message).toContain("xóa file lock");
  });

  it("chỉ tạo repository → không có lock, không có store", () => {
    createJsonFileShopRepository(storeFile);
    expect(existsSync(lockFileFor(storeFile))).toBe(false);
    expect(existsSync(storeFile)).toBe(false);
  });

  it("thao tác đầu tiên lấy lock; hai repository cùng PID trên một file đều chạy", async () => {
    const first = createJsonFileShopRepository(storeFile);
    const second = createJsonFileShopRepository(storeFile);

    await first.readState();
    await second.readState();

    expect((await readFile(lockFileFor(storeFile), "utf8")).trim()).toBe(String(process.pid));
  });

  it("store bị tiến trình khác giữ → mọi thao tác ném StoreLockedError", async () => {
    await writeFile(lockFileFor(storeFile), "4242", "utf8");
    const repository = createJsonFileShopRepository(storeFile, { lock: { isAlive: () => true } });

    await expect(repository.readState()).rejects.toBeInstanceOf(StoreLockedError);
    expect(existsSync(storeFile)).toBe(false);
  });
});
