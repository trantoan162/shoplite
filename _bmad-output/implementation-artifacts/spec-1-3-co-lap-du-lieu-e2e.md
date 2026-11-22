---
title: 'Story 1.3: Cô lập dữ liệu khi chạy E2E'
type: 'chore'
created: '2026-11-21'
status: 'done'
baseline_commit: 'ac7eb557a3d92f7f82a5076031a6f2c191814941'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `playwright.config.ts` không đặt `ORDERS_FILE`, lại bật `reuseExistingServer` khi chạy local. Vì vậy E2E ghi thẳng vào `storage/orders.json` thật. Thêm nữa, `storage/` chưa nằm trong `.gitignore`, và chưa có project nào chạy ở viewport 360px cho các spec mobile sắp tới.

**Approach:** Theo AD-19, Playwright tự dựng server riêng trỏ vào thư mục `.e2e/`. Thư mục này được dọn sạch đúng một lần, ở tiến trình chính, trước khi `webServer` khởi động. Thêm một project 360×800, chỉ chạy các test có tag `@mobile`.

## Boundaries & Constraints

**Always:**
- `webServer.env` phải đặt đủ 4 biến:
  - `STORE_FILE=.e2e/shop-store.json`
  - `ORDERS_FILE=.e2e/legacy-orders.json`
  - `STAFF_PINS` và `STAFF_SESSION_SECRET`, lấy giá trị test (không phải bí mật thật; secret dài ≥ 32 ký tự).
- `reuseExistingServer: false` trong mọi môi trường.
- Chỉ xóa `.e2e/` một lần cho mỗi lần chạy `playwright test`. Worker và loader process nạp lại config nhưng không được xóa lại.
- Có comment trong config ghi rõ: phải tắt `npm run dev` trước khi chạy E2E, vì Next 16 giữ `.next/dev/lock` và port 3000.

**Never:**
- Không sửa `e2e/shopping-flow.spec.ts` hay code app.
- Không thêm dependency, không dùng `globalSetup`. `webServer` khởi động trước `globalSetup`, nên dọn trong `globalSetup` là quá muộn.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chạy E2E | `npx playwright test` | `shopping-flow.spec.ts` xanh; đơn mới nằm trong `.e2e/`; `storage/` không bị tạo hay sửa | N/A |
| Còn dữ liệu cũ | `.e2e/` còn file từ lần chạy trước | bị xóa trước khi server khởi động | N/A |
| Nhiều worker | `--workers=2` | `.e2e/` không bị xóa giữa chừng khi worker hoặc loader nạp config | N/A |
| Project 360 | các test hiện có | project `mobile-360` không chạy test nào không có tag `@mobile`; project `chromium` giữ như cũ | N/A |
| Dev server đang chạy | port 3000 đang bận | Playwright báo lỗi port đã bị dùng, không lặng lẽ dùng lại server đó | lỗi do Playwright báo |
| Git | sau story | `git status` không hiện `.e2e/` hay `storage/` | N/A |

</frozen-after-approval>

## Code Map

- `playwright.config.ts` -- config hiện tại: project `chromium` (Desktop Chrome), `webServer` chạy `npm run dev` với `reuseExistingServer: !CI` và chưa có `env`.
- `.gitignore` -- đã có `test-results/` và `playwright-report/`; chưa có `storage/`, `.e2e/`.
- `src/features/orders/server.ts` -- đọc `ORDERS_FILE`. Từ Story 1.4 sẽ đọc thêm `STORE_FILE`. Story này chỉ đặt biến, không sửa server.
- `node_modules/playwright/lib/worker/workerProcessEntry.js:1375,1480` -- worker đặt `TEST_WORKER_INDEX` rồi mới `loadConfig`, tức là nạp lại file config. `loader/loaderProcessEntry.js:16` cũng nạp config nhưng không đặt `TEST_WORKER_INDEX`.

## Tasks & Acceptance

**Execution:**
- [x] `playwright.config.ts`:
  - Ở top-level, xóa `.e2e/` bằng `rmSync(..., { recursive: true, force: true })`, có điều kiện bảo vệ là biến env `SHOPLITE_E2E_DATA_READY` cộng `TEST_WORKER_INDEX`; sau khi dọn thì đặt biến `SHOPLITE_E2E_DATA_READY`.
  - Thêm `webServer.env` và đổi `reuseExistingServer: false`.
  - Thêm project `mobile-360`: viewport 360×800, `grep: /@mobile/`.
  - Thêm comment về việc phải tắt dev server.
- [x] `.gitignore` -- thêm `storage/` và `.e2e/`.

**Acceptance Criteria:**
- Given `storage/` đã có sẵn, when chạy `npx playwright test`, then nội dung và mtime của `storage/` không đổi, và `.e2e/legacy-orders.json` chứa đơn vừa đặt.
- Given story hoàn tất, when chạy `npm run check`, then exit 0.

## Implementation Notes

- `import.meta.dirname` không dùng được, vì Playwright nạp config dạng CommonJS. Thay bằng `path.resolve(".e2e")` (chạy từ gốc repo).
- Lần chạy E2E đầu đỏ (`ERR_CONNECTION_REFUSED`): `next dev` in ra thông báo khuyến nghị nâng cấp bảo mật Next 16.4.2 rồi tự dừng. Chạy lại thì xanh. Không chạy `next upgrade`; việc nâng cấp do người dùng quyết.
- Kết quả kiểm chứng:
  - `npx playwright test --workers=2`: 2 passed. `stale.txt` bị dọn, `.e2e/legacy-orders.json` có 1 đơn, `storage/` không được tạo.
  - Điều kiện bảo vệ (giả lập): có `SHOPLITE_E2E_DATA_READY` thì giữ; có `TEST_WORKER_INDEX` thì giữ; tiến trình chính thì xóa.
  - Port 3000 bận: Playwright báo "is already used".
  - Sau review: 8 patch. E2E chạy 3/3 xanh. Thêm `e2e/e2e-env.ts`, `e2e/data-isolation.spec.ts`, mục README. `next dev` lại dừng một lần vì thông báo bảo mật; chạy lại thì xanh.
  - `git status` không hiện `storage/`. `npm run check`: exit 0, 170 test.

## Spec Change Log

## Review Triage Log

| # | Nguồn | Phát hiện | Verdict | Bằng chứng / xử lý |
|---|---|---|---|---|
| 1 | VG, Blind | Không có kiểm tra tự động nào cho lời hứa "đơn E2E nằm trong `.e2e/`, không vào `storage/`" | medium | Chỉ kiểm thủ công một lần. **patch**: thêm `e2e/data-isolation.spec.ts`. Đã thử bỏ `ORDERS_FILE`: test đỏ và đơn rò sang `storage/orders.json`. Khôi phục lại thì xanh |
| 2 | Edge, Blind, VG | `path.resolve(".e2e")` phụ thuộc thư mục đang đứng, nên `rmSync` đệ quy có thể xóa nhầm ngoài repo | medium | Gọi `-c` từ thư mục khác sẽ xóa `.e2e` ở đó. **patch**: dùng `e2e/e2e-env.ts` với `__dirname` (config nạp dạng CommonJS) |
| 3 | Blind, Edge, VG | Comment của `ORDERS_FILE` ghi "không tồn tại", trong khi server vẫn ghi vào file đó | low | `server.ts` đọc `ORDERS_FILE`. **patch**: sửa comment theo hành vi hiện tại và sau Story 1.4 |
| 4 | Blind | `mobile-360` không giả lập điện thoại (`isMobile` và `hasTouch` đều false) | medium | Khi `isMobile: false`, Chromium bỏ qua thẻ meta viewport, nên kiểm SM-5 sẽ yếu đi. **patch**: thêm `isMobile: true`, `hasTouch: true` |
| 5 | Edge, Blind | `rmSync` trên Windows có thể ném `EBUSY`/`EPERM` khi file còn bị giữ | low | **patch**: thêm `maxRetries: 5, retryDelay: 200` |
| 6 | Edge, Blind, VG | `--ui`/`--watch` chỉ dọn ở lần chạy đầu; một tiến trình riêng (`--list`, extension VS Code) có thể dọn `.e2e/` giữa lúc đang chạy | low | Có thật. Sửa triệt để thì phức tạp. **patch**: ghi rõ giới hạn trong comment |
| 7 | Blind | Bộ PIN test chỉ nằm cứng trong config | low | Các spec Epic 2 sẽ phải chép lại. **patch**: đưa vào `E2E_STAFF` trong `e2e-env.ts` |
| 8 | Blind | README chưa nói về `.e2e/` và việc phải tắt dev server | low | **patch**: thêm mục "Dữ liệu khi chạy E2E" |
| 9 | Edge, Blind | Project `chromium` không có `grepInvert`, nên test `@mobile` sẽ chạy cả ở desktop | maybe-false | Hiện chưa có spec `@mobile`. Có thành vấn đề hay không tùy cách viết spec 360 ở Story 2.5. **defer** |
| 10 | Edge | Hai project chạy song song trên một store dùng chung | low | AD-19 đã quy định mỗi spec dùng sản phẩm riêng; `fullyParallel: false`. **reject** |
| 11 | Blind | Biến `SHOPLITE_E2E_DATA_READY` sót lại trong shell sẽ lặng lẽ bỏ qua bước dọn | low | Hầu như không xảy ra; thêm log thì tăng nhiễu. **reject** |
| 12 | Blind | `reuseExistingServer: false` không có cách tắt | false | AD-19 quy định cứng giá trị này; comment đã ghi là chủ ý |
| 13 | VG | `mobile-360` chưa có test nào | false | Đúng như spec: project dành cho Story 2.5 và 4.3/4.4 |

## Design Notes

Dùng biến env do chính config đặt chứ không chỉ dựa vào `TEST_WORKER_INDEX`. Tiến trình con kế thừa `process.env` lúc được fork, nên mọi worker và loader đều thấy biến đã đặt và bỏ qua bước xóa:

```ts
if (!process.env.SHOPLITE_E2E_DATA_READY && !process.env.TEST_WORKER_INDEX) {
  rmSync(E2E_DIR, { recursive: true, force: true });
  process.env.SHOPLITE_E2E_DATA_READY = "1";
}
```

## Verification

**Commands:**
- `npx playwright test --workers=2` -- expected: mọi test pass; `storage/` không đổi; trong `.e2e/` có file đơn hàng.
- `git status --short` -- expected: không có `.e2e/` hay `storage/`.
- `npm run check` -- expected: exit 0.
