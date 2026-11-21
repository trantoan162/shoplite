import { products } from "@/data/products";
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
export const orderService = createOrderService({
  repository: createJsonFileShopRepository(process.env.STORE_FILE || DEFAULT_STORE_FILE, {
    initialize: async () =>
      buildInitialShopState(
        await importLegacyOrders(process.env.ORDERS_FILE || DEFAULT_ORDERS_FILE),
        products,
      ),
  }),
});
