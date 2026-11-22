import { products } from "@/data/products";
import { applyStockSet, parseStockSetArgs, type StockChange } from "@/features/inventory/stock";
import { DEFAULT_STORE_FILE } from "./order-repository";
import { releaseStoreLock, StoreLockedError, type ProcessLockDeps } from "./process-lock";
import { ShopStateError } from "./state-schema";
import { createShopStore } from "./shop-store";

export type StockSetResult = { ok: true; changes: StockChange[] } | { ok: false; errors: string[] };

export interface StockSetOptions {
  args: string[];
  storeFile?: string;
  ordersFile?: string;
  lock?: boolean | ProcessLockDeps;
}

/**
 * `npm run stock:set` (AD-16): đường duy nhất đổi tồn kho ngoài luồng đơn. Đi qua `update` của
 * store thật nên ghi nguyên tử và tôn trọng PID lock: server đang chạy thì từ chối, không ghi gì.
 */
export async function runStockSet({
  args,
  storeFile,
  ordersFile,
  lock,
}: StockSetOptions): Promise<StockSetResult> {
  const { requests, errors } = parseStockSetArgs(args, products);
  if (errors.length > 0) return { ok: false, errors };

  const target = storeFile ?? (process.env.STORE_FILE || DEFAULT_STORE_FILE);
  const store = createShopStore({ storeFile: target, ordersFile, lock });
  try {
    const changes = await store.update((state) => {
      const applied = applyStockSet(state, requests);
      return { state: applied.levels, result: applied.changes };
    });
    return { ok: true, changes };
  } catch (error) {
    if (error instanceof StoreLockedError) {
      return {
        ok: false,
        errors: [
          (error.ownerPid === null
            ? `Không lấy được lock của store (${error.lockFile}). `
            : `Store đang được tiến trình PID ${error.ownerPid} dùng (${error.lockFile}). `) +
            "Hãy dừng server trước rồi chạy lại.",
        ],
      };
    }
    if (error instanceof ShopStateError) {
      // Store hỏng, file đơn cũ hỏng, hoặc kết quả vi phạm bất biến: báo một dòng, không ghi gì.
      return { ok: false, errors: [`Không đặt được tồn kho: ${error.message}`] };
    }
    throw error;
  } finally {
    // Chỉ thả lock của store này (an toàn nếu được gọi trong tiến trình còn giữ store khác).
    releaseStoreLock(target);
  }
}

/** Một dòng kết quả, ví dụ `p004: 2 → 10 (+8)`. */
export function formatStockChange({ productId, from, to, delta }: StockChange): string {
  return `${productId}: ${from} → ${to} (${delta >= 0 ? "+" : ""}${delta})`;
}
