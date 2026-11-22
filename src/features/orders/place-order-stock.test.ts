// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reconcileInventoryKeys } from "@/features/inventory/stock";
import { OrderError } from "./order-errors";
import { createInMemoryOrderRepository, createJsonFileShopRepository } from "./order-repository";
import { createOrderService } from "./order-service";
import { releaseStoreLocks } from "./process-lock";

// p010 là Cáp USB-C bện dù 2m, catalog khai báo stock 200.
const order = (quantity: number) => ({
  customer: { fullName: "Trần Thị B", phone: "0987654321", address: "45 Lê Lợi, Đà Nẵng" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [{ productId: "p010", quantity }],
});

async function errorOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(OrderError);
  return error as OrderError;
}

function serviceWith(inventory?: Record<string, number>) {
  const repository = createInMemoryOrderRepository([], inventory ? { inventory } : {});
  let counter = 0;
  const service = createOrderService({ repository, generateId: () => `SL-S-${++counter}` });
  return { repository, service };
}

describe("placeOrder đọc Tồn kho lưu bền (FR-3, FR-5)", () => {
  it("thiếu hàng: 409 'chỉ còn 1 sản phẩm', không tạo đơn, tồn kho không đổi", async () => {
    const { service, repository } = serviceWith({ p010: 1 });

    const error = await errorOf(service.placeOrder(order(2)));

    expect(error.code).toBe("INSUFFICIENT_STOCK");
    expect(error.message).toBe('Sản phẩm "Cáp USB-C bện dù 2m" chỉ còn 1 sản phẩm');
    const state = await repository.readState();
    expect(state.orders).toEqual([]);
    expect(state.inventory).toEqual({ p010: 1 });
  });

  it("hết hàng: 409 'đã hết hàng'", async () => {
    const { service } = serviceWith({ p010: 0 });
    const error = await errorOf(service.placeOrder(order(1)));
    expect(error.message).toBe('Sản phẩm "Cáp USB-C bện dù 2m" đã hết hàng');
  });

  it("đủ hàng: tạo đơn và không trừ kho", async () => {
    const { service, repository } = serviceWith({ p010: 2 });
    const placed = await service.placeOrder(order(2));

    const state = await repository.readState();
    expect(state.orders.map((o) => o.id)).toEqual([placed.id]);
    expect(state.inventory.p010).toBe(2);
  });

  it("không có key trong inventory: dùng stock khai báo của catalog", async () => {
    const { service } = serviceWith();
    // p010 khai báo 200 → đặt 10 (tối đa mỗi dòng) được.
    await expect(service.placeOrder(order(10))).resolves.toBeDefined();
    // p004 (Micro thu âm) khai báo 0 → hết hàng dù inventory không có key.
    const error = await errorOf(
      service.placeOrder({ ...order(1), items: [{ productId: "p004", quantity: 1 }] }),
    );
    expect(error.message).toBe('Sản phẩm "Micro thu âm PodCast USB" đã hết hàng');
  });

  it("key trong inventory thắng stock khai báo: p004 khai báo 0 nhưng inventory = 3 thì đặt được", async () => {
    const { service } = serviceWith({ p004: 3 });
    await expect(
      service.placeOrder({ ...order(1), items: [{ productId: "p004", quantity: 3 }] }),
    ).resolves.toBeDefined();
  });

  it("hai đơn đồng thời cùng cần món cuối: cả hai được tạo (đặt hàng không giữ hàng)", async () => {
    const { service, repository } = serviceWith({ p010: 1 });

    await Promise.all([service.placeOrder(order(1)), service.placeOrder(order(1))]);

    const state = await repository.readState();
    expect(state.orders).toHaveLength(2);
    expect(state.inventory.p010).toBe(1);
  });

  it("mã đơn sinh trùng: thử lại mã khác, đơn cũ không bị ghi đè", async () => {
    const repository = createInMemoryOrderRepository([], { inventory: { p010: 5 } });
    const ids = ["SL-TRUNG", "SL-TRUNG", "SL-KHAC"];
    const service = createOrderService({ repository, generateId: () => ids.shift() ?? "SL-HET" });
    const first = await service.placeOrder(order(1));

    const second = await service.placeOrder(order(2));

    expect(second.id).toBe("SL-KHAC");
    expect((await repository.findAll()).map((o) => o.id)).toEqual(["SL-TRUNG", "SL-KHAC"]);
    expect((await repository.findById("SL-TRUNG"))?.items[0].quantity).toBe(
      first.items[0].quantity,
    );
  });

  it("mã đơn luôn trùng sau 5 lần: ném lỗi, không ghi gì", async () => {
    const repository = createInMemoryOrderRepository([], { inventory: { p010: 5 } });
    const service = createOrderService({ repository, generateId: () => "SL-TRUNG" });
    await service.placeOrder(order(1));

    await expect(service.placeOrder(order(2))).rejects.toThrow("Không sinh được mã đơn");
    expect(await repository.findAll()).toHaveLength(1);
  });

  it("thứ tự kiểm tra theo dòng: dòng thiếu hàng đứng trước dòng không có sản phẩm → INSUFFICIENT_STOCK", async () => {
    const { service } = serviceWith({ p010: 0 });
    const error = await errorOf(
      service.placeOrder({
        ...order(1),
        items: [
          { productId: "p010", quantity: 1 },
          { productId: "p-khong-co", quantity: 1 },
        ],
      }),
    );
    expect(error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("đơn bị từ chối không tiêu mã đơn", async () => {
    let calls = 0;
    const repository = createInMemoryOrderRepository([], { inventory: { p010: 0 } });
    const service = createOrderService({ repository, generateId: () => `SL-${++calls}` });
    await expect(service.placeOrder(order(1))).rejects.toThrow();
    expect(calls).toBe(0);
  });
});

describe("file trạng thái: reconcile và restart", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-stock-"));
    file = path.join(dir, "shop-store.json");
  });

  afterEach(async () => {
    releaseStoreLocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("sản phẩm mới của catalog được thêm key khi nạp store; id thừa được giữ", async () => {
    const seed = createJsonFileShopRepository(file);
    await seed.update((state) => ({
      state: { ...state, inventory: { gone: 3 }, inventoryBaseline: { gone: 3 } },
      result: undefined,
    }));

    const products = [{ id: "pNew", stock: 9 }];
    const repository = createJsonFileShopRepository(file, {
      reconcile: (state) => reconcileInventoryKeys(state, products),
    });

    expect(await repository.readState()).toMatchObject({
      inventory: { gone: 3, pNew: 9 },
      inventoryBaseline: { gone: 3, pNew: 9 },
    });
  });

  it("restart: repository mới đọc đúng tồn kho đã commit", async () => {
    const first = createJsonFileShopRepository(file);
    await first.update((state) => ({
      state: { ...state, inventory: { p010: 7 }, inventoryBaseline: { p010: 40 } },
      result: undefined,
    }));

    releaseStoreLocks();
    const second = createJsonFileShopRepository(file);
    expect((await second.readState()).inventory).toEqual({ p010: 7 });
  });
});
