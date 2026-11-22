import type { ProductImage } from "@/features/catalog/types";
import type { PaymentMethod } from "@/features/checkout/checkout-schema";
import type { ShippingMethod } from "@/features/checkout/pricing";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

export interface OrderCustomer {
  fullName: string;
  phone: string;
  email?: string;
  address: string;
  note?: string;
}

export interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  image: ProductImage;
  /** Giá tại thời điểm đặt hàng (lấy từ catalog phía server). */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** Người thao tác một lần chuyển trạng thái (AD-10). */
export type Actor = { kind: "staff"; name: string } | { kind: "customer" };

/** Một dòng lịch sử: đơn đi vào trạng thái `to` lúc `at` (ISO UTC). Dòng đầu có `from: null`. */
export interface StatusChange {
  from: OrderStatus | null;
  to: OrderStatus;
  at: string;
  actor: Actor;
}

export const CANCEL_REASONS = [
  "out_of_stock",
  "customer_changed_mind",
  "unreachable",
  "other",
  "delivery_failed",
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  out_of_stock: "Hết hàng",
  customer_changed_mind: "Khách đổi ý",
  unreachable: "Không liên lạc được khách",
  other: "Khác",
  delivery_failed: "Giao thất bại",
};

export interface OrderCancellation {
  reason?: CancelReason;
  note?: string;
  returnedToShop?: boolean;
}

/** Cờ phụ — không phải Trạng thái đơn (FR-22). */
export interface OrderFlags {
  cancelRequestedAt?: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  customer: OrderCustomer;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  // Các trường dưới đây chỉ được thêm (AD-10); đơn tạo trước tính năng này không có.
  /** Nguồn Mốc giờ duy nhất; dòng đầu là lúc tạo đơn. */
  statusHistory?: StatusChange[];
  cancellation?: OrderCancellation;
  /** `true` khi tồn kho của đơn đang bị trừ (sau xác nhận, trước khi hoàn). */
  stockApplied?: boolean;
  flags?: OrderFlags;
}
