import { products } from "@/data/products";
import type { Product } from "@/features/catalog/types";
import { reconcileInventoryKeys, withLiveStock } from "@/features/inventory/stock";
import {
  createJsonFileShopRepository,
  DEFAULT_ORDERS_FILE,
  DEFAULT_STORE_FILE,
} from "./order-repository";
import { createOrderService } from "./order-service";
import { buildInitialShopState, importLegacyOrders } from "./store-init";

/**
 * Instance dùng chung của OrderService. Chỉ import file này từ code chạy trên server
 * (Server Component, Route Handler) vì nó đọc/ghi file hệ thống.
 *
 * - `STORE_FILE` (mặc định storage/shop-store.json): đơn hàng + tồn kho, ghi nguyên tử.
 * - `ORDERS_FILE` (mặc định storage/orders.json): chỉ đọc một lần để nhập đơn cũ khi store
 *   chưa tồn tại; sau đó không ghi vào nữa.
 *
 * Tạo instance không đụng đĩa: khởi tạo store và PID lock chạy ở thao tác đầu tiên.
 */
const repository = createJsonFileShopRepository(process.env.STORE_FILE || DEFAULT_STORE_FILE, {
  initialize: async () =>
    buildInitialShopState(
      await importLegacyOrders(process.env.ORDERS_FILE || DEFAULT_ORDERS_FILE),
      products,
    ),
  reconcile: (state) => reconcileInventoryKeys(state, products),
});

export const orderService = createOrderService({ repository });

/**
 * Catalog với tồn kho thật (AD-9), đọc qua cùng repository (cùng mutex, PID lock) với đơn hàng.
 * Store không đọc được thì ném lỗi — không bao giờ quay về `stock` khai báo trong `products.ts`.
 */
export async function getLiveProducts(): Promise<Product[]> {
  return withLiveStock(products, (await repository.readState()).inventory);
}
