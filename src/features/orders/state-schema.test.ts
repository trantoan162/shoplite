import { describe, expect, it } from "vitest";
import {
  assertShopStateInvariants,
  parseShopState,
  ShopStateError,
  type ShopState,
} from "./state-schema";
import type { Order } from "./types";

const sampleOrder = (id: string): Order => ({
  id,
  status: "pending",
  createdAt: "2026-11-20T14:40:00.000Z",
  updatedAt: "2026-11-20T14:40:00.000Z",
  customer: {
    fullName: "Lê Văn Minh",
    phone: "0901234567",
    address: "1 Trần Phú, Hà Nội",
  },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [
    {
      productId: "p004",
      slug: "ban-phim",
      name: "Bàn phím",
      image: { emoji: "⌨️", from: "#fff", to: "#000" },
      unitPrice: 1_220_000,
      quantity: 1,
      lineTotal: 1_220_000,
    },
  ],
  subtotal: 1_220_000,
  shippingFee: 30_000,
  total: 1_250_000,
});

const sampleState = (): ShopState => ({
  schemaVersion: 1,
  // Order (interface ở types.ts) gán thẳng vào ShopState, không cần ép kiểu.
  orders: [sampleOrder("SL-1")],
  inventory: { p004: 3 },
  inventoryBaseline: { p004: 5 },
});

describe("parseShopState", () => {
  it("chấp nhận trạng thái hợp lệ", () => {
    expect(parseShopState(sampleState())).toEqual(sampleState());
  });

  it("giữ nguyên trường lạ ở mọi cấp", () => {
    const raw = {
      ...sampleState(),
      extra: { note: "root" },
      orders: [
        {
          ...sampleOrder("SL-1"),
          foo: 1,
          futureField: [{ to: "pending" }],
          customer: { ...sampleOrder("SL-1").customer, zalo: "abc" },
          items: [
            {
              ...sampleOrder("SL-1").items[0],
              sku: "K-1",
              image: { emoji: "⌨️", from: "#fff", to: "#000", alt: "x" },
            },
          ],
        },
      ],
      stockLedger: [{ productId: "p004", delta: -2, custom: true }],
    };

    const roundTrip = JSON.parse(JSON.stringify(parseShopState(raw)));
    expect(roundTrip).toEqual(raw);
  });

  it.each([
    ["sai schemaVersion", { ...sampleState(), schemaVersion: 2 }],
    ["thiếu orders", { schemaVersion: 1, inventory: {}, inventoryBaseline: {} }],
    [
      "trạng thái đơn lạ",
      {
        ...sampleState(),
        orders: [{ ...sampleOrder("SL-1"), status: "lost" }],
      },
    ],
    ["tồn kho không phải số", { ...sampleState(), inventory: { p004: "3" } }],
    ["không phải object", []],
    [
      "đơn thiếu total",
      {
        ...sampleState(),
        orders: [{ ...sampleOrder("SL-1"), total: undefined }],
      },
    ],
    [
      "shippingMethod lạ",
      {
        ...sampleState(),
        orders: [{ ...sampleOrder("SL-1"), shippingMethod: "drone" }],
      },
    ],
    [
      "paymentMethod lạ",
      {
        ...sampleState(),
        orders: [{ ...sampleOrder("SL-1"), paymentMethod: "crypto" }],
      },
    ],
    [
      "dòng hàng thiếu productId",
      {
        ...sampleState(),
        orders: [
          {
            ...sampleOrder("SL-1"),
            items: [{ ...sampleOrder("SL-1").items[0], productId: undefined }],
          },
        ],
      },
    ],
    [
      "image.emoji sai kiểu",
      {
        ...sampleState(),
        orders: [
          {
            ...sampleOrder("SL-1"),
            items: [
              {
                ...sampleOrder("SL-1").items[0],
                image: { emoji: 1, from: "#fff", to: "#000" },
              },
            ],
          },
        ],
      },
    ],
    [
      "customer thiếu phone",
      {
        ...sampleState(),
        orders: [{ ...sampleOrder("SL-1"), customer: { fullName: "A", address: "B" } }],
      },
    ],
    ["inventoryBaseline không phải số", { ...sampleState(), inventoryBaseline: { p004: null } }],
  ])("ném ShopStateError khi %s", (_label, raw) => {
    expect(() => parseShopState(raw)).toThrow(ShopStateError);
  });
});

describe("assertShopStateInvariants", () => {
  it("cho qua trạng thái hợp lệ, kể cả tồn kho bằng 0", () => {
    expect(() =>
      assertShopStateInvariants({ ...sampleState(), inventory: { p004: 0 } }),
    ).not.toThrow();
  });

  it.each([
    ["inventory âm", { inventory: { p004: -1 } }],
    ["inventory số lẻ", { inventory: { p004: 1.5 } }],
    ["inventory NaN", { inventory: { p004: Number.NaN } }],
    ["inventoryBaseline âm", { inventoryBaseline: { p004: -3 } }],
    ["trùng mã đơn", { orders: [sampleOrder("SL-1"), sampleOrder("SL-1")] }],
  ])("ném lỗi khi %s", (_label, patch) => {
    expect(() => assertShopStateInvariants({ ...sampleState(), ...patch })).toThrow(ShopStateError);
  });
});
