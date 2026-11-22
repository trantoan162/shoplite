# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-khoa-chung-doc-ghi.md`
  summary: `placeOrder` nên chèn kiểu insert-only (ném lỗi khi id đã tồn tại) thay vì upsert qua `save`.
  evidence: `save` là upsert từ trước; nếu `generateOrderId` sinh trùng (6 ký tự hex mỗi ngày) thì đơn mới đè đơn cũ mà không báo lỗi. Xác suất thấp nhưng hậu quả là mất đơn.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-khoa-chung-doc-ghi.md`
  summary: Thêm `.prettierrc` với `printWidth: 100` và format lại 4 file của Story 1.1 (đang ở độ rộng 80).
  evidence: Repo không có file cấu hình Prettier, trong khi code gốc khớp `--print-width 100`; chạy `prettier --write` mặc định sẽ format lại code cũ không liên quan.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-co-lap-du-lieu-e2e.md`
  summary: Chốt cách viết test `@mobile`: chỉ chạy ở `mobile-360` (`grepInvert: /@mobile/` cho `chromium`), hay chạy ở cả hai viewport.
  evidence: Hiện chưa có spec `@mobile`. Nếu Story 2.5 viết assertion chỉ đúng ở 360px thì project `chromium` sẽ đỏ. Quyết khi viết spec Hàng đợi.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-co-lap-du-lieu-e2e.md`
  summary: Nâng bản vá bảo mật Next.js 16.4.2. Khi chưa nâng, `next dev` thỉnh thoảng in khuyến nghị rồi tự dừng, làm E2E đỏ ngẫu nhiên.
  evidence: 2/5 lần chạy E2E trong Story 1.3 dừng với "Process from config.webServer was not able to start"; log ghi "Your version of Next.js is affected by a known security vulnerability". Người dùng quyết việc nâng cấp.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-chuyen-store-giu-don-cu.md`
  summary: (Đã xử lý phần race 2026-11-22, theo AI review PR #2: gỡ lock chết qua khóa phụ `<lock>.takeover` và đọc lại chủ lock; test 8 tiến trình × 30 vòng. Còn mở: nonce/start-time cho PID bị cấp lại, và khe hở nhỏ khi tiến trình chết lúc đang giữ khóa phụ) Chiếm lock đã chết cho nguyên tử (hai tiến trình khởi động cùng lúc trên một lock chết có thể cùng tưởng mình giữ store); cân nhắc ghi thêm nonce/start-time vào lock để xử lý PID bị cấp lại.
  evidence: `takeLock` xóa lock chết rồi tạo lại bằng `link`; giữa lúc đọc chủ lock và lúc xóa vẫn còn khe hở. Chỉ xảy ra khi hai tiến trình khởi động đồng thời, mà AD-5 vốn đã chặn trường hợp này trong vận hành bình thường.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-co-lap-du-lieu-e2e.md`
  summary: (Đã xử lý 2026-11-22) Nâng Next.js lên 16.4.6 trên branch `chore/next-16.4.6`; E2E không còn bị dừng.
  evidence: npm audit không còn advisory cho `next`; E2E 3/3 xanh lần đầu, 0 thông báo bảo mật.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-co-lap-du-lieu-e2e.md`
  summary: Còn 7 advisory moderate ở dev dependency (typescript-eslint, minimatch) — `npm audit fix` khi tiện.
  evidence: npm audit sau khi nâng Next: moderate 7, high 0, critical 0; đều là công cụ lint, không chạy lúc runtime.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-dat-hang-kiem-ton-kho.md`
  summary: (Đã xử lý 2026-11-22) `placeOrder` chèn đơn kiểu insert-only và thử lại khi mã đơn trùng.
  evidence: Mục do Story 1.2 hoãn lại; đã xử lý trong mutator của Story 1.6, có test.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-8-stock-set.md`
  summary: Thêm test cho nhánh `StoreLockedError` có `ownerPid: null` của `runStockSet`, và kiểm `npm run stock:set` trên Node 22.12 (mức tối thiểu trong `engines`).
  evidence: Nhánh null chỉ xảy ra khi lock đổi chủ liên tục lúc đang lấy (hiếm). Strip-types trên Node 22.x là tính năng thử nghiệm; hiện mới kiểm trên Node 24.22.
- source_spec: AI review PR #2 (2026-11-22)
  summary: Gỡ khóa phụ `<lock>.takeover` của tiến trình chết vẫn dùng `rm` không có khóa, nên còn một race TOCTOU hẹp. Chỉ xảy ra khi một tiến trình chết đúng lúc đang giữ khóa phụ và có hai tiến trình khác cùng khởi động.
  evidence: `process-lock.ts` `removeStaleLock`. Cách sửa nếu cần: đổi tên guard sang tên duy nhất rồi kiểm nội dung trước khi xóa, hoặc dùng mtime cùng thời hạn.
- source_spec: AI review PR #2 (2026-11-22)
  summary: Dọn code: xóa adapter `createJsonFileOrderRepository` (ghi `orders.json` trực tiếp, không fsync, không còn caller production); `buildInitialShopState` dùng `declaredStock` thay vì `product.stock`; trên hệ file không có hard link, `createLockFile` (`fsp.link`) báo lỗi rõ ràng.
  evidence: `order-repository.ts`, `store-init.ts`, `process-lock.ts`. Cả ba đều mức low theo AI review.
