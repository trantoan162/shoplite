import { describe, expect, it } from "vitest";
import { createInMemoryOrderRepository, emptyShopState } from "./order-repository";
import { createOrderService } from "./order-service";
import { parseShopState, ShopStateError } from "./state-schema";
import { CANCEL_REASON_LABELS, CANCEL_REASONS, type Order } from "./types";

const CREATED = new Date("2026-11-22T01:00:00.000Z");
const CANCELLED = new Date("2026-11-22T02:30:00.000Z");

const input = () => ({
  customer: { fullName: "Lê Văn Minh", phone: "0901234567", address: "1 Trần Phú, Hà Nội" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [{ productId: "p010", quantity: 1 }],
});

function serviceAt(times: Date[], seed: Order[] = []) {
  const repository = createInMemoryOrderRepository(seed);
  let tick = 0;
  const service = createOrderService({
    repository,
    now: () => times[Math.min(tick++, times.length - 1)],
    generateId: () => "SL-H-1",
  });
  return { repository, service };
}

const legacyOrder = (): Order => ({
  id: "SL-OLD",
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

describe("Order — lịch sử trạng thái (AD-10)", () => {
  it("placeOrder ghi dòng tạo đơn: null → pending, at = createdAt, actor khách", async () => {
    const { service, repository } = serviceAt([CREATED]);
    const order = await service.placeOrder(input());

    expect(order.statusHistory).toEqual([
      { from: null, to: "pending", at: CREATED.toISOString(), actor: { kind: "customer" } },
    ]);
    expect((await repository.findById(order.id))?.statusHistory).toEqual(order.statusHistory);
  });

  it("khách hủy: thêm dòng pending → cancelled, at = updatedAt mới; tồn kho không đổi", async () => {
    const { service, repository } = serviceAt([CREATED, CANCELLED]);
    const order = await service.placeOrder(input());
    const inventoryBefore = (await repository.readState()).inventory;

    const cancelled = await service.cancelOrder(order.id);

    expect(cancelled.updatedAt).toBe(CANCELLED.toISOString());
    expect(cancelled.statusHistory).toEqual([
      { from: null, to: "pending", at: CREATED.toISOString(), actor: { kind: "customer" } },
      {
        from: "pending",
        to: "cancelled",
        at: CANCELLED.toISOString(),
        actor: { kind: "customer" },
      },
    ]);
    expect((await repository.readState()).inventory).toEqual(inventoryBefore);
  });

  it("hủy đơn cũ không có lịch sử: chỉ có dòng hủy, không bịa dòng tạo đơn", async () => {
    const { service, repository } = serviceAt([CANCELLED], [legacyOrder()]);

    const cancelled = await service.cancelOrder("SL-OLD");
    const stored = await repository.findById("SL-OLD");
    expect(stored).toEqual(cancelled);
    expect(stored).toMatchObject({
      createdAt: legacyOrder().createdAt,
      total: legacyOrder().total,
    });

    expect(cancelled.statusHistory).toEqual([
      {
        from: "pending",
        to: "cancelled",
        at: CANCELLED.toISOString(),
        actor: { kind: "customer" },
      },
    ]);
  });
});

describe("state-schema — trường mới của Order", () => {
  const stateWith = (order: unknown) => ({ ...emptyShopState(), orders: [order] });

  it("đơn cũ chỉ có trường cũ parse được nguyên trạng, không ghi bù trường mới", () => {
    const parsed = parseShopState(stateWith(legacyOrder())).orders[0];
    expect(parsed).toEqual(legacyOrder());
    expect(parsed.statusHistory).toBeUndefined();
    expect(parsed.cancellation).toBeUndefined();
  });

  it("khóa lạ bên trong dòng lịch sử và actor được giữ nguyên", () => {
    const order = {
      ...legacyOrder(),
      statusHistory: [
        {
          from: null,
          to: "pending",
          at: "2026-11-01T01:00:00.000Z",
          actor: { kind: "customer", device: "mobile" },
          source: "web",
        },
      ],
    };
    expect(parseShopState(stateWith(order)).orders[0]).toEqual(order);
  });

  it("đơn đầy đủ trường mới (actor staff, cancellation, flags) parse được và giữ nguyên", () => {
    const order = {
      ...legacyOrder(),
      status: "cancelled",
      statusHistory: [
        { from: null, to: "pending", at: "2026-11-01T01:00:00.000Z", actor: { kind: "customer" } },
        {
          from: "pending",
          to: "cancelled",
          at: "2026-11-01T02:00:00.000Z",
          actor: { kind: "staff", name: "An" },
        },
      ],
      cancellation: { reason: "out_of_stock", note: "hết mẫu", returnedToShop: false },
      stockApplied: false,
      flags: { cancelRequestedAt: "2026-11-01T01:30:00.000Z" },
    };
    expect(parseShopState(stateWith(order)).orders[0]).toEqual(order);
  });

  it.each([
    [
      "statusHistory.to lạ",
      {
        statusHistory: [
          { from: null, to: "lost", at: "2026-11-01T01:00:00.000Z", actor: { kind: "customer" } },
        ],
      },
    ],
    [
      "actor staff thiếu name",
      {
        statusHistory: [
          { from: null, to: "pending", at: "2026-11-01T01:00:00.000Z", actor: { kind: "staff" } },
        ],
      },
    ],
    [
      "actor kind lạ",
      {
        statusHistory: [
          { from: null, to: "pending", at: "2026-11-01T01:00:00.000Z", actor: { kind: "robot" } },
        ],
      },
    ],
    ["cancellation.reason lạ", { cancellation: { reason: "x" } }],
    ["stockApplied không phải boolean", { stockApplied: "yes" }],
    [
      "statusHistory.at không phải ISO",
      {
        statusHistory: [{ from: null, to: "pending", at: "hôm qua", actor: { kind: "customer" } }],
      },
    ],
    [
      "statusHistory.from lạ",
      {
        statusHistory: [
          {
            from: "lost",
            to: "pending",
            at: "2026-11-01T01:00:00.000Z",
            actor: { kind: "customer" },
          },
        ],
      },
    ],
    [
      "statusHistory thiếu from",
      {
        statusHistory: [
          { to: "pending", at: "2026-11-01T01:00:00.000Z", actor: { kind: "customer" } },
        ],
      },
    ],
    [
      "actor staff tên rỗng",
      {
        statusHistory: [
          {
            from: null,
            to: "pending",
            at: "2026-11-01T01:00:00.000Z",
            actor: { kind: "staff", name: "" },
          },
        ],
      },
    ],
    ["statusHistory không phải mảng", { statusHistory: {} }],
    ["cancellation.note sai kiểu", { cancellation: { note: 1 } }],
    ["cancellation.returnedToShop sai kiểu", { cancellation: { returnedToShop: "có" } }],
    ["flags.cancelRequestedAt sai kiểu", { flags: { cancelRequestedAt: 1 } }],
    ["flags.cancelRequestedAt không phải ISO", { flags: { cancelRequestedAt: "sớm" } }],
  ])("trường mới sai (%s) → ShopStateError", (_label, patch) => {
    expect(() => parseShopState(stateWith({ ...legacyOrder(), ...patch }))).toThrow(ShopStateError);
  });
});

describe("CANCEL_REASON_LABELS", () => {
  it("có nhãn tiếng Việt cho mọi lý do", () => {
    expect(CANCEL_REASONS.map((reason) => CANCEL_REASON_LABELS[reason])).toEqual([
      "Hết hàng",
      "Khách đổi ý",
      "Không liên lạc được khách",
      "Khác",
      "Giao thất bại",
    ]);
  });
});
