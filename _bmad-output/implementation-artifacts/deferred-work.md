# Deferred work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-khoa-chung-doc-ghi.md`
  summary: `placeOrder` nên chèn kiểu insert-only (ném lỗi khi id đã tồn tại) thay vì upsert qua `save`.
  evidence: `save` là upsert từ trước; nếu `generateOrderId` sinh trùng (6 ký tự hex mỗi ngày) thì đơn mới đè đơn cũ mà không báo lỗi. Xác suất thấp nhưng hậu quả là mất đơn.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-khoa-chung-doc-ghi.md`
  summary: Thêm `.prettierrc` với `printWidth: 100` và format lại 4 file của Story 1.1 (đang ở độ rộng 80).
  evidence: Repo không có file cấu hình Prettier, trong khi code gốc khớp `--print-width 100`; chạy `prettier --write` mặc định sẽ format lại code cũ không liên quan.
