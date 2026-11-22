import { promises as fs } from "node:fs";
import { z } from "zod";
import type { Product } from "@/features/catalog/types";
import { orderSchema, ShopStateError, type ShopState } from "./state-schema";
import type { Order } from "./types";

const legacyOrdersSchema = z.array(orderSchema);

/**
 * Đọc đơn từ file `orders.json` cũ để nhập vào store (AD-15).
 * Không có file → `[]`. Có file nhưng không phải mảng `Order` hợp lệ → ném, để không tạo store
 * với 0 đơn từ một file hỏng. Đơn được giữ nguyên trạng, kể cả trường lạ.
 */
export async function importLegacyOrders(file: string): Promise<Order[]> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new ShopStateError(`File đơn cũ ${file} không phải JSON hợp lệ`, { cause: error });
  }

  const result = legacyOrdersSchema.safeParse(data);
  if (!result.success) {
    throw new ShopStateError(
      `File đơn cũ ${file} không phải danh sách đơn hợp lệ:\n${z.prettifyError(result.error)}`,
      { cause: result.error },
    );
  }
  return result.data;
}

/** Trạng thái đầu tiên của store: đơn cũ + tồn kho = `stock` khai báo của mọi sản phẩm. */
export function buildInitialShopState(
  legacyOrders: Order[],
  products: Pick<Product, "id" | "stock">[],
): ShopState {
  const levels = Object.fromEntries(products.map((product) => [product.id, product.stock]));
  return {
    schemaVersion: 1,
    orders: structuredClone(legacyOrders),
    inventory: { ...levels },
    inventoryBaseline: { ...levels },
  };
}
