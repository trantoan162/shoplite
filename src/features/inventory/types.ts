/** Số lượng tồn theo `Product.id`. */
export type InventoryMap = Record<string, number>;

/** Phần tồn kho của trạng thái cửa hàng mà module inventory được phép đọc/đổi. */
export interface InventoryLevels {
  inventory: InventoryMap;
  inventoryBaseline: InventoryMap;
}

/** Một dòng hàng thiếu: cần `needed`, còn `available`, thiếu `missing`. */
export interface Shortfall {
  productId: string;
  needed: number;
  available: number;
  missing: number;
}
