import type { Product } from "@/features/catalog/types";
import type { InventoryLevels, InventoryMap, Shortfall } from "./types";

/**
 * Hàm thuần về tồn kho (AD-9). Không I/O, không import `orders` — trạng thái do mutator của
 * `orders` truyền vào và nhận lại.
 */

/** `stock` khai báo hợp lệ (số nguyên ≥ 0); giá trị hỏng coi là 0, không bao giờ NaN hay âm. */
export function declaredStock(product: Pick<Product, "stock">): number {
  return Number.isInteger(product.stock) && product.stock >= 0 ? product.stock : 0;
}

/**
 * Tồn kho khả dụng của một sản phẩm. Thiếu key thì dùng `fallback` (thường là `stock` khai báo —
 * đúng giá trị `reconcileInventoryKeys` sẽ thêm), mặc định 0.
 */
export function availableStock(inventory: InventoryMap, productId: string, fallback = 0): number {
  return Object.hasOwn(inventory, productId) ? inventory[productId] : fallback;
}

/**
 * Các dòng thiếu hàng so với tồn kho hiện tại. Sản phẩm không có key dùng `fallback(productId)`,
 * mặc định 0 — đúng cho lúc xác nhận đơn (Story 3.1), khi store đã được reconcile đủ key.
 */
export function checkShortfall(
  lines: { productId: string; quantity: number }[],
  inventory: InventoryMap,
  fallback: (productId: string) => number = () => 0,
): Shortfall[] {
  const needed = new Map<string, number>();
  for (const line of lines) {
    needed.set(line.productId, (needed.get(line.productId) ?? 0) + line.quantity);
  }
  const shortfalls: Shortfall[] = [];
  for (const [productId, quantity] of needed) {
    const available = availableStock(inventory, productId, fallback(productId));
    if (quantity > available) {
      shortfalls.push({ productId, needed: quantity, available, missing: quantity - available });
    }
  }
  return shortfalls;
}

/**
 * Thêm key cho sản phẩm mới của catalog vào cả `inventory` và `inventoryBaseline` với `stock`
 * khai báo; giữ nguyên key đã có (kể cả id không còn trong catalog). Trả object mới.
 */
export function reconcileInventoryKeys<T extends InventoryLevels>(
  levels: T,
  products: Pick<Product, "id" | "stock">[],
): T {
  const inventory = { ...levels.inventory };
  const inventoryBaseline = { ...levels.inventoryBaseline };
  for (const product of products) {
    if (!Object.hasOwn(inventory, product.id)) {
      inventory[product.id] = declaredStock(product);
    }
    if (!Object.hasOwn(inventoryBaseline, product.id)) {
      inventoryBaseline[product.id] = declaredStock(product);
    }
  }
  return { ...levels, inventory, inventoryBaseline };
}
