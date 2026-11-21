import { z } from "zod";
import { PAYMENT_METHODS } from "@/features/checkout/checkout-schema";
import { SHIPPING_METHODS } from "@/features/checkout/pricing";
import { ORDER_STATUSES, type Order } from "./types";

/**
 * Schema của file trạng thái (đơn hàng + tồn kho trong một file).
 * Mọi cấp dùng `z.looseObject` để trường chưa khai báo (do story khác thêm vào)
 * được giữ nguyên qua vòng đọc → ghi.
 */
const productImageSchema = z.looseObject({
  emoji: z.string(),
  from: z.string(),
  to: z.string(),
});

const orderItemSchema = z.looseObject({
  productId: z.string(),
  slug: z.string(),
  name: z.string(),
  image: productImageSchema,
  unitPrice: z.number(),
  quantity: z.number(),
  lineTotal: z.number(),
});

const orderCustomerSchema = z.looseObject({
  fullName: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  address: z.string(),
  note: z.string().optional(),
});

export const orderSchema = z.looseObject({
  id: z.string(),
  status: z.enum(ORDER_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  customer: orderCustomerSchema,
  shippingMethod: z.enum(SHIPPING_METHODS),
  paymentMethod: z.enum(PAYMENT_METHODS),
  items: z.array(orderItemSchema),
  subtotal: z.number(),
  shippingFee: z.number(),
  total: z.number(),
});

const stockLedgerEntrySchema = z.looseObject({});

export const shopStateSchema = z.looseObject({
  schemaVersion: z.literal(1),
  orders: z.array(orderSchema),
  inventory: z.record(z.string(), z.number()),
  inventoryBaseline: z.record(z.string(), z.number()),
  stockLedger: z.array(stockLedgerEntrySchema).optional(),
});

/** Toàn bộ trạng thái lưu bền của cửa hàng. Khóa tồn kho là `Product.id`. */
export interface ShopState {
  schemaVersion: 1;
  orders: Order[];
  inventory: Record<string, number>;
  inventoryBaseline: Record<string, number>;
  /** Sổ kho (FR-20) — chi tiết dòng do story Sổ kho định nghĩa. */
  stockLedger?: Record<string, unknown>[];
}

/** Lỗi khi file trạng thái hỏng hoặc trạng thái vi phạm bất biến. */
export class ShopStateError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ShopStateError";
  }
}

/** Kiểm tra và trả về `ShopState`; ném `ShopStateError` nếu sai schema. */
export function parseShopState(raw: unknown, source = "trạng thái"): ShopState {
  const result = shopStateSchema.safeParse(raw);
  if (!result.success) {
    throw new ShopStateError(`${source} không hợp lệ:\n${z.prettifyError(result.error)}`, {
      cause: result.error,
    });
  }
  // Không ép kiểu: output của schema phải gán được vào ShopState/Order,
  // nên schema thiếu hoặc sai một trường bắt buộc của Order sẽ lỗi lúc typecheck.
  return result.data;
}

/** Bất biến phải đúng trước mỗi lần ghi: tồn kho là số nguyên ≥ 0, mã đơn không trùng. */
export function assertShopStateInvariants(state: ShopState): void {
  for (const [field, levels] of [
    ["inventory", state.inventory],
    ["inventoryBaseline", state.inventoryBaseline],
  ] as const) {
    for (const [productId, value] of Object.entries(levels)) {
      if (!Number.isInteger(value) || value < 0) {
        throw new ShopStateError(
          `${field}.${productId} phải là số nguyên không âm (đang là ${value})`,
        );
      }
    }
  }

  const seen = new Set<string>();
  for (const order of state.orders) {
    if (seen.has(order.id)) {
      throw new ShopStateError(`Mã đơn bị trùng: ${order.id}`);
    }
    seen.add(order.id);
  }
}
