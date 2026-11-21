// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrderError } from "./order-errors";
import { createJsonFileShopRepository, type OrderRepository } from "./order-repository";
import { createOrderService, type OrderService } from "./order-service";

const validInput = () => ({
  customer: {
    fullName: "Trần Thị B",
    phone: "0987654321",
    address: "45 Lê Lợi, Đà Nẵng",
  },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [{ productId: "p010", quantity: 1 }],
});

describe("orderService trên file trạng thái — tương tranh", () => {
  let dir: string;
  let file: string;
  let repository: OrderRepository;
  let service: OrderService;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-concurrency-"));
    file = path.join(dir, "shop-store.json");
    repository = createJsonFileShopRepository(file);
    let counter = 0;
    service = createOrderService({
      repository,
      generateId: () => `SL-C-${++counter}`,
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("20 placeOrder đồng thời: file có đủ 20 đơn, id khác nhau", async () => {
    const orders = await Promise.all(
      Array.from({ length: 20 }, () => service.placeOrder(validInput())),
    );

    const stored = JSON.parse(await readFile(file, "utf8"));
    expect(stored.orders).toHaveLength(20);
    expect(new Set(stored.orders.map((order: { id: string }) => order.id)).size).toBe(20);
    expect(new Set(orders.map((order) => order.id)).size).toBe(20);
  });

  it("hủy đơn A chạy cùng lúc đặt đơn B: cả hai thay đổi đều còn", async () => {
    const a = await service.placeOrder(validInput());

    const [cancelled, b] = await Promise.all([
      service.cancelOrder(a.id),
      service.placeOrder(validInput()),
    ]);

    const stored = await repository.readState();
    expect(cancelled.status).toBe("cancelled");
    expect(stored.orders.find((order) => order.id === a.id)?.status).toBe("cancelled");
    expect(stored.orders.find((order) => order.id === b.id)?.status).toBe("pending");
  });

  it("hai lần hủy cùng một đơn đồng thời: đúng một lần thành công", async () => {
    const a = await service.placeOrder(validInput());

    const results = await Promise.allSettled([
      service.cancelOrder(a.id),
      service.cancelOrder(a.id),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(OrderError);
    expect((rejected.reason as OrderError).code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("hủy đơn không tồn tại: ORDER_NOT_FOUND, file không đổi", async () => {
    await service.placeOrder(validInput());
    const before = await readFile(file, "utf8");

    const error = await service.cancelOrder("SL-KHONG-CO").catch((e: unknown) => e);

    expect((error as OrderError).code).toBe("ORDER_NOT_FOUND");
    expect(await readFile(file, "utf8")).toBe(before);
  });
});
