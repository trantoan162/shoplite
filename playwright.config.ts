import { rmSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import {
  E2E_DIR,
  E2E_ORDERS_FILE,
  E2E_SESSION_SECRET,
  E2E_STAFF_PINS,
  E2E_STORE_FILE,
} from "./e2e/e2e-env";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Dữ liệu của E2E nằm riêng trong `.e2e/` (AD-19), không bao giờ đụng `storage/` thật.
 *
 * Xóa ở top-level vì `webServer` khởi động trước `globalSetup`. File config này được nạp lại
 * trong mỗi worker và loader process của Playwright; các tiến trình con kế thừa biến môi trường
 * đặt bên dưới nên chỉ tiến trình chính xóa, đúng một lần mỗi lần chạy.
 *
 * Giới hạn đã biết:
 * - `--ui` / `--watch` giữ một tiến trình chính sống lâu nên chỉ dọn ở lần chạy đầu của phiên.
 * - Một tiến trình Playwright riêng (ví dụ `--list`, extension VS Code) nạp config cũng sẽ dọn
 *   `.e2e/` — đừng chạy song song với một lần `playwright test` đang chạy.
 *
 * Phải tắt `npm run dev` trước khi chạy E2E: Next 16 giữ `.next/dev/lock` và port 3000.
 * `reuseExistingServer: false` là chủ ý (AD-19): báo lỗi thay vì dùng lại server đang ghi vào `storage/`.
 */
if (!process.env.SHOPLITE_E2E_DATA_READY && !process.env.TEST_WORKER_INDEX) {
  // Windows có thể còn giữ file vài trăm ms sau khi server cũ thoát.
  rmSync(E2E_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  process.env.SHOPLITE_E2E_DATA_READY = "1";
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Các spec dùng chung một store `.e2e/` và một dev server: chạy tuần tự để tránh chập chờn.
  workers: 1,
  // Dev server compile trang ở lần truy cập đầu; 5s mặc định hay bị vượt khi máy bận.
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      // Màn hình điện thoại hẹp nhất cần hỗ trợ (FR-13, SM-5). Chỉ chạy test gắn tag @mobile.
      name: "mobile-360",
      grep: /@mobile/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      STORE_FILE: E2E_STORE_FILE,
      // Chỉ là nguồn nhập đơn cũ (AD-15) và không tồn tại, nên mỗi lần chạy E2E bắt đầu từ store
      // trống. Server ghi đơn vào STORE_FILE.
      ORDERS_FILE: E2E_ORDERS_FILE,
      STAFF_PINS: E2E_STAFF_PINS,
      STAFF_SESSION_SECRET: E2E_SESSION_SECRET,
    },
  },
});
