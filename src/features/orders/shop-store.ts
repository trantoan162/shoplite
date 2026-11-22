import { products } from "@/data/products";
import { reconcileInventoryKeys } from "@/features/inventory/stock";
import {
  createJsonFileShopRepository,
  DEFAULT_ORDERS_FILE,
  DEFAULT_STORE_FILE,
  type OrderRepository,
} from "./order-repository";
import type { ProcessLockDeps } from "./process-lock";
import { buildInitialShopState, importLegacyOrders } from "./store-init";

export interface ShopStoreOptions {
  /** Mặc định `STORE_FILE` hoặc storage/shop-store.json. */
  storeFile?: string;
  /** Mặc định `ORDERS_FILE` hoặc storage/orders.json — chỉ đọc khi khởi tạo store. */
  ordersFile?: string;
  lock?: boolean | ProcessLockDeps;
}

/**
 * Repository của store thật, dùng chung giữa server và script vận hành (`stock:set`), để cả hai
 * khởi tạo (AD-15), reconcile (AD-9) và khóa (AD-5) giống hệt nhau.
 */
export function createShopStore({
  storeFile = process.env.STORE_FILE || DEFAULT_STORE_FILE,
  ordersFile = process.env.ORDERS_FILE || DEFAULT_ORDERS_FILE,
  lock = true,
}: ShopStoreOptions = {}): OrderRepository {
  return createJsonFileShopRepository(storeFile, {
    initialize: async () => buildInitialShopState(await importLegacyOrders(ordersFile), products),
    reconcile: (state) => reconcileInventoryKeys(state, products),
    lock,
  });
}
