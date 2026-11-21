// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "@/data/products";
import { releaseStoreLocks } from "./process-lock";
import type { Order } from "./types";

// Kiểm tra wiring production thật của server.ts (STORE_FILE, nhập ORDERS_FILE, catalog thật).
const legacyOrder: Order = {
  id: "SL-20261101-LEGACY",
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
};

describe("server.ts — orderService production", () => {
  let dir: string;
  let storeFile: string;
  let ordersFile: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-server-"));
    storeFile = path.join(dir, "shop-store.json");
    ordersFile = path.join(dir, "orders.json");
    vi.stubEnv("STORE_FILE", storeFile);
    vi.stubEnv("ORDERS_FILE", ordersFile);
    vi.resetModules();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    releaseStoreLocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("nhập đơn cũ từ ORDERS_FILE, tồn kho = stock của catalog thật, đơn mới vào STORE_FILE", async () => {
    await writeFile(ordersFile, JSON.stringify([legacyOrder], null, 2), "utf8");
    const before = await readFile(ordersFile);
    const { orderService } = await import("./server");

    expect((await orderService.listOrders()).map((order) => order.id)).toEqual([legacyOrder.id]);

    const placed = await orderService.placeOrder({
      customer: { fullName: "Khách mới", phone: "0987654321", address: "45 Lê Lợi, Đà Nẵng" },
      shippingMethod: "standard",
      paymentMethod: "cod",
      items: [{ productId: "p010", quantity: 1 }],
    });

    const store = JSON.parse(await readFile(storeFile, "utf8"));
    expect(store.orders.map((order: Order) => order.id)).toEqual([legacyOrder.id, placed.id]);
    expect(store.inventory).toEqual(
      Object.fromEntries(products.map((product) => [product.id, product.stock])),
    );
    expect(await readFile(ordersFile)).toEqual(before);
  });
});
