import path from "node:path";

/**
 * Dữ liệu và cấu hình dùng chung giữa `playwright.config.ts` và các spec E2E (AD-19).
 * Không phải spec (tên file không khớp `*.spec.ts`), nên Playwright không chạy nó như test.
 *
 * Playwright nạp file TS dạng CommonJS nên `__dirname` dùng được: đường dẫn luôn tính
 * theo vị trí repo, không theo thư mục đang đứng khi gọi lệnh.
 */
export const REPO_ROOT = path.resolve(__dirname, "..");
export const E2E_DIR = path.join(REPO_ROOT, ".e2e");
export const E2E_STORE_FILE = path.join(E2E_DIR, "shop-store.json");
/** File đơn cũ chỉ để nhập lần đầu (AD-15); E2E không tạo nó nên store luôn bắt đầu trống. */
export const E2E_ORDERS_FILE = path.join(E2E_DIR, "legacy-orders.json");
export const REAL_STORAGE_DIR = path.join(REPO_ROOT, "storage");

/** Nhân viên dùng cho E2E — giá trị test, không phải bí mật thật. */
export const E2E_STAFF = [
  { name: "An", pin: "111111" },
  { name: "Hoa", pin: "222222" },
] as const;
export const E2E_STAFF_PINS = E2E_STAFF.map(({ name, pin }) => `${name}:${pin}`).join(",");
export const E2E_SESSION_SECRET = "e2e-only-session-secret-0123456789abcdef";
