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

export interface StockSetRequest {
  productId: string;
  quantity: number;
}

export interface StockChange {
  productId: string;
  from: number;
  to: number;
  delta: number;
}

/**
 * Đọc tham số `npm run stock:set -- p004=10 …` (AD-16). Báo **mọi** lỗi cùng lúc; có lỗi thì
 * `requests` rỗng để caller không ghi gì.
 */
export function parseStockSetArgs(
  args: string[],
  products: Pick<Product, "id">[],
): { requests: StockSetRequest[]; errors: string[] } {
  const known = new Set(products.map((product) => product.id));
  const seen = new Set<string>();
  const requests: StockSetRequest[] = [];
  const errors: string[] = [];

  if (args.length === 0) {
    errors.push("Cần ít nhất một tham số dạng <mã sản phẩm>=<số lượng>, ví dụ: p004=10");
  }
  for (const arg of args) {
    const match = /^([^=\s]+)=(.*)$/.exec(arg);
    if (!match) {
      errors.push(`"${arg}": sai cú pháp, cần dạng <mã sản phẩm>=<số lượng>`);
      continue;
    }
    const [, productId, value] = match;
    if (seen.has(productId)) {
      errors.push(`"${arg}": sản phẩm "${productId}" bị nhập trùng`);
      continue;
    }
    seen.add(productId);
    if (!known.has(productId)) {
      errors.push(`"${arg}": không có sản phẩm "${productId}" trong catalog`);
      continue;
    }
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
      errors.push(`"${arg}": số lượng phải là số nguyên không âm`);
      continue;
    }
    requests.push({ productId, quantity: Number(value) });
  }
  return errors.length > 0 ? { requests: [], errors } : { requests, errors };
}

/**
 * Đặt tồn kho về số mới và cộng phần chênh lệch vào `inventoryBaseline` (AD-16), để đẳng thức
 * "tồn kho = baseline − đã xuất" vẫn đúng. Trả object mới cùng danh sách thay đổi.
 */
export function applyStockSet<T extends InventoryLevels>(
  levels: T,
  requests: StockSetRequest[],
): { levels: T; changes: StockChange[] } {
  const inventory = { ...levels.inventory };
  const inventoryBaseline = { ...levels.inventoryBaseline };
  const changes: StockChange[] = [];
  for (const { productId, quantity } of requests) {
    const from = availableStock(inventory, productId);
    const delta = quantity - from;
    inventory[productId] = quantity;
    inventoryBaseline[productId] = availableStock(inventoryBaseline, productId, from) + delta;
    changes.push({ productId, from, to: quantity, delta });
  }
  return { levels: { ...levels, inventory, inventoryBaseline }, changes };
}

/**
 * Bản sao catalog mang tồn kho thật (AD-9): mỗi sản phẩm là object mới với `stock` lấy từ
 * `inventory`, thiếu key thì dùng `stock` khai báo. Không sửa `products`.
 */
export function withLiveStock<P extends Pick<Product, "id" | "stock">>(
  products: readonly P[],
  inventory: InventoryMap,
): P[] {
  return products.map((product) => ({
    ...product,
    stock: availableStock(inventory, product.id, declaredStock(product)),
  }));
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
