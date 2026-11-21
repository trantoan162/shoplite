// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order, OrderStatus } from "@/features/orders/types";
import { PATCH } from "./route";

const { repository } = vi.hoisted(() => ({
  repository: {
    current: null as null | import("@/features/orders/order-repository").OrderRepository,
  },
}));

// Thay orderService (ghi file) bằng bản dùng repository trong bộ nhớ.
vi.mock("@/features/orders/server", async () => {
  const { createOrderService } = await import("@/features/orders/order-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  repository.current = createInMemoryOrderRepository();
  return {
    orderService: createOrderService({
      repository: repository.current,
      now: () => new Date("2026-11-21T02:00:00.000Z"),
    }),
  };
});

const order = (id: string, status: OrderStatus): Order => ({
  id,
  status,
  createdAt: "2026-11-21T01:00:00.000Z",
  updatedAt: "2026-11-21T01:00:00.000Z",
  customer: {
    fullName: "Lê Văn Minh",
    phone: "0901234567",
    address: "1 Trần Phú, Hà Nội",
  },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
});

const patch = (id: string, body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

describe("PATCH /api/orders/:id (khách tự hủy)", () => {
  beforeEach(async () => {
    const { emptyShopState } = await import("@/features/orders/order-repository");
    await repository.current!.update(() => ({ state: emptyShopState(), result: undefined }));
  });

  it("200 - hủy đơn đang chờ xác nhận, cập nhật updatedAt", async () => {
    await repository.current!.save(order("SL-1", "pending"));

    const response = await patch("SL-1", { status: "cancelled" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: "SL-1",
      status: "cancelled",
      updatedAt: "2026-11-21T02:00:00.000Z",
    });
    expect((await repository.current!.findById("SL-1"))?.status).toBe("cancelled");
  });

  it.each(["confirmed", "shipping", "delivered", "cancelled"] as const)(
    "409 - đơn %s không hủy được, giữ nguyên thông điệp và đơn",
    async (status) => {
      await repository.current!.save(order("SL-1", status));

      const response = await patch("SL-1", { status: "cancelled" });

      expect(response.status).toBe(409);
      expect((await response.json()).error).toEqual({
        code: "INVALID_STATUS_TRANSITION",
        message: "Chỉ có thể hủy đơn hàng đang ở trạng thái Chờ xác nhận",
      });
      expect((await repository.current!.findById("SL-1"))?.status).toBe(status);
    },
  );

  it("404 - đơn không tồn tại", async () => {
    const response = await patch("SL-KHONG-CO", { status: "cancelled" });

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("ORDER_NOT_FOUND");
  });

  it('400 - body khác { status: "cancelled" }', async () => {
    await repository.current!.save(order("SL-1", "pending"));

    const response = await patch("SL-1", { status: "confirmed" });

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect((await repository.current!.findById("SL-1"))?.status).toBe("pending");
  });
});
