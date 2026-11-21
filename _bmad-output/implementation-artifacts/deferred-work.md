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
  summary: Chiếm lock đã chết cho nguyên tử (hai tiến trình khởi động cùng lúc trên một lock chết có thể cùng tưởng mình giữ store); cân nhắc ghi thêm nonce/start-time vào lock để xử lý PID bị cấp lại.
  evidence: `takeLock` xóa lock chết rồi tạo lại bằng `link`; giữa lúc đọc chủ lock và lúc xóa vẫn còn khe hở. Chỉ xảy ra khi hai tiến trình khởi động đồng thời, mà AD-5 vốn đã chặn trường hợp này trong vận hành bình thường.
