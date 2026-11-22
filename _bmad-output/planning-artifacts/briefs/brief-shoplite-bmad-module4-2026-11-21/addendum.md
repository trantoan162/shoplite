---
title: "Addendum: Vận hành đơn hàng ShopLite"
created: 2026-11-21
updated: 2026-11-21
---

# Addendum: chi tiết cho PRD và Architecture

## Hiện trạng code đã kiểm chứng (2026-11-21)

- `src/features/orders/types.ts` khai báo `ORDER_STATUSES = pending, confirmed, shipping, delivered, cancelled` kèm nhãn tiếng Việt. `Order` có `createdAt` và `updatedAt`, nhưng chưa có mốc giờ từng bước, chưa có người thao tác, chưa có cờ phụ.
- `src/features/orders/order-service.ts`:
  - Khi tạo đơn, service kiểm tra `quantity > product.stock` nhưng không trừ kho.
  - Hàm hủy chỉ cho phép khi `status === "pending"`.
- `src/data/products.ts` chứa tồn kho dạng hằng số, được chú thích là "read-only". Muốn trừ kho thì phải tách phần tồn kho ra một nơi lưu được (ví dụ `storage/inventory.json`). Thông tin catalog còn lại có thể giữ tĩnh.
- `src/features/orders/order-repository.ts`:
  - Đã có interface `OrderRepository` cho phép thay lớp lưu trữ, và có repository in-memory cho test.
  - Bản JSON ghi file tạm rồi `rename`, nên một lần ghi đơn lẻ là an toàn. Tuy nhiên `save()` làm read-modify-write không khóa, nên khi có hai request đồng thời thì request ghi sau sẽ đè mất thay đổi của request ghi trước.

## Hướng kỹ thuật đã nghe được (để Architect quyết định)

- **Nguyên tử đơn + kho khi không có database.** Có hai phương án:
  - (1) Gộp đơn và kho vào cùng một file, mỗi thao tác ghi lại cả file.
  - (2) Hai file riêng, cộng một mutex trong tiến trình bao quanh toàn bộ thao tác "đọc → kiểm tra → ghi".

  Cả hai chỉ đúng khi app chạy một tiến trình. Kiểm tra "chuyển từ đúng trạng thái liền trước" (compare-and-set theo `status`) là cơ chế chống bấm hai lần.
- **Sổ kho (ledger):** chỉ ghi thêm, mỗi dòng gồm `{productId, delta, orderId, reason, actor, at}`. Từ sổ này có thể dựng lại số tồn để đối soát chỉ tiêu SC-2.
- **Hiển thị tồn kho có tính đơn đang chờ** (gợi ý từ brainstorm): ví dụ "Còn 3, 2 đang trong đơn chờ xác nhận". Lý do: kho chỉ trừ lúc xác nhận nên con số trên web có thể "lạc quan", hiển thị kiểu này giúp giảm việc khách đặt trùng.
- **Danh tính nhân viên:** danh sách tên kèm PIN đặt trong biến môi trường hoặc file cấu hình, giữ phiên bằng cookie. Đã được user chốt (2026-11-21).

## Câu hỏi mở chuyển sang PRD

- Giao từng phần: phí ship tính thế nào? Một đơn mang hai trạng thái hay tách thành hai đơn? (Ngoài phạm vi lần này, nhưng mô hình dữ liệu không nên chặn đường làm sau.)
- Khách truy cập trang theo dõi bằng gì: mã đơn kèm số điện thoại, hay đường link có token?
- Hiển thị thế nào cho các đơn cũ không có mốc giờ từng bước?
- Quy tắc "hàng đã đóng gói": trạng thái `confirmed` đã được tính là đã đóng gói chưa, hay cần thêm một cờ phụ?
