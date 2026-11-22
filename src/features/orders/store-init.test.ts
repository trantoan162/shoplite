// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJsonFileShopRepository } from "./order-repository";
import { releaseStoreLocks } from "./process-lock";
import { defaultShopStateFs } from "./shop-state-file";
import { createOrderService } from "./order-service";
import { ShopStateError } from "./state-schema";
import { buildInitialShopState, importLegacyOrders } from "./store-init";
import type { Order } from "./types";

const PRODUCTS = [
  { id: "p001", stock: 25 },
  { id: "p010", stock: 40 },
];

const legacyOrder = (id: string): Order => ({
  id,
  status: "pending",
  createdAt: "2026-11-01T01:00:00.000Z",
  updatedAt: "2026-11-01T01:00:00.000Z",
  customer: { fullName: "Khách cũ", phone: "0901234567", address: "1 Trần Phú, Hà Nội" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
});

let dir: string;
let storeFile: string;
let ordersFile: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "shoplite-init-"));
  storeFile = path.join(dir, "shop-store.json");
  ordersFile = path.join(dir, "orders.json");
});

afterEach(async () => {
  releaseStoreLocks();
  await rm(dir, { recursive: true, force: true });
});

const repositoryWithInit = (
  initialize = vi.fn(async () =>
    buildInitialShopState(await importLegacyOrders(ordersFile), PRODUCTS),
  ),
) => ({ initialize, repository: createJsonFileShopRepository(storeFile, { initialize }) });

describe("importLegacyOrders", () => {
  it("không có file → []", async () => {
    expect(await importLegacyOrders(ordersFile)).toEqual([]);
  });

  it.each([
    ["không phải mảng", "{}"],
    ["JSON sai", "{ not json"],
    ["đơn sai schema", JSON.stringify([{ ...legacyOrder("SL-1"), status: "lost" }])],
  ])("file %s → ShopStateError", async (_label, content) => {
    await writeFile(ordersFile, content, "utf8");
    await expect(importLegacyOrders(ordersFile)).rejects.toThrow(ShopStateError);
  });
});

describe("importLegacyOrders — BOM", () => {
  it("file có BOM UTF-8 (sửa trên Windows) vẫn nhập được", async () => {
    await writeFile(ordersFile, "\uFEFF" + JSON.stringify([legacyOrder("SL-1")]), "utf8");
    expect((await importLegacyOrders(ordersFile)).map((order) => order.id)).toEqual(["SL-1"]);
  });
});

describe("buildInitialShopState", () => {
  it("tồn kho và baseline = stock, là hai object độc lập", () => {
    const state = buildInitialShopState([], PRODUCTS);
    expect(state.inventory).toEqual({ p001: 25, p010: 40 });
    expect(state.inventoryBaseline).toEqual({ p001: 25, p010: 40 });
    expect(state.inventory).not.toBe(state.inventoryBaseline);
  });
});

describe("khởi tạo store qua repository (AD-15)", () => {
  it("nhập 3 đơn cũ nguyên trạng; orders.json không đổi từng byte", async () => {
    const orders = [
      legacyOrder("SL-1"),
      { ...legacyOrder("SL-2"), legacyField: "giữ nguyên" },
      legacyOrder("SL-3"),
    ];
    await writeFile(ordersFile, JSON.stringify(orders, null, 2), "utf8");
    const before = await readFile(ordersFile);
    const { repository } = repositoryWithInit();

    const state = await repository.readState();

    expect(state.orders).toEqual(orders);
    expect(state.inventory).toEqual({ p001: 25, p010: 40 });
    expect(state.inventoryBaseline).toEqual({ p001: 25, p010: 40 });
    expect(JSON.parse(await readFile(storeFile, "utf8")).orders).toHaveLength(3);
    expect(await readFile(ordersFile)).toEqual(before);
  });

  it("không có file nào → store orders: [], tồn kho = stock", async () => {
    const { repository } = repositoryWithInit();
    expect(await repository.readState()).toEqual({
      schemaVersion: 1,
      orders: [],
      inventory: { p001: 25, p010: 40 },
      inventoryBaseline: { p001: 25, p010: 40 },
    });
    expect(existsSync(storeFile)).toBe(true);
  });

  it("orders.json hỏng → ShopStateError, không tạo store", async () => {
    await writeFile(ordersFile, "{}", "utf8");
    const { repository } = repositoryWithInit();

    await expect(repository.readState()).rejects.toThrow(ShopStateError);
    expect(existsSync(storeFile)).toBe(false);
  });

  it("hai thao tác đầu đồng thời → khởi tạo đúng một lần", async () => {
    await writeFile(ordersFile, JSON.stringify([legacyOrder("SL-1")]), "utf8");
    const { initialize, repository } = repositoryWithInit();

    await Promise.all([repository.readState(), repository.findAll(), repository.readState()]);

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it("sau khởi tạo, đơn mới vào store; orders.json không đổi", async () => {
    await writeFile(ordersFile, JSON.stringify([legacyOrder("SL-1")]), "utf8");
    const before = await readFile(ordersFile);
    const { repository } = repositoryWithInit();
    const service = createOrderService({ repository, generateId: () => "SL-MOI" });

    await service.placeOrder({
      customer: { fullName: "Khách mới", phone: "0987654321", address: "45 Lê Lợi, Đà Nẵng" },
      shippingMethod: "standard",
      paymentMethod: "cod",
      items: [{ productId: "p010", quantity: 1 }],
    });

    const stored = JSON.parse(await readFile(storeFile, "utf8"));
    expect(stored.orders.map((order: Order) => order.id)).toEqual(["SL-1", "SL-MOI"]);
    expect(await readFile(ordersFile)).toEqual(before);
  });

  it("initialize xong nhưng commit đầu lỗi → không để lại store; lần sau khởi tạo lại", async () => {
    await writeFile(ordersFile, JSON.stringify([legacyOrder("SL-1")]), "utf8");
    const before = await readFile(ordersFile);
    let failOnce = true;
    const initialize = vi.fn(async () =>
      buildInitialShopState(await importLegacyOrders(ordersFile), PRODUCTS),
    );
    const repository = createJsonFileShopRepository(storeFile, {
      initialize,
      fs: {
        ...defaultShopStateFs,
        rename: (from, to) => {
          if (failOnce) {
            failOnce = false;
            return Promise.reject(Object.assign(new Error("EIO"), { code: "EIO" }));
          }
          return defaultShopStateFs.rename(from, to);
        },
      },
    });

    await expect(repository.readState()).rejects.toThrow("EIO");
    expect(existsSync(storeFile)).toBe(false);

    expect((await repository.readState()).orders.map((order) => order.id)).toEqual(["SL-1"]);
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(await readFile(ordersFile)).toEqual(before);
  });

  it("store hỏng → ShopStateError, không ghi đè, không khởi tạo lại", async () => {
    await writeFile(storeFile, "{ hỏng", "utf8");
    const { initialize, repository } = repositoryWithInit();

    await expect(repository.readState()).rejects.toThrow(ShopStateError);
    expect(await readFile(storeFile, "utf8")).toBe("{ hỏng");
    expect(initialize).not.toHaveBeenCalled();
  });
});
