# Thuật ngữ

Dùng đúng các từ dưới đây trong story, code comment và UI copy.

- **Đơn hàng (Order):** bản ghi đơn, kiểu `Order` ở `src/features/orders/types.ts`. Mỗi đơn có đúng một Trạng thái đơn.
- **Trạng thái đơn:** một trong 5 giá trị `ORDER_STATUSES`, nhãn lấy từ `ORDER_STATUS_LABELS`:
  - `pending`: Chờ xác nhận;
  - `confirmed`: Đã xác nhận;
  - `shipping`: Đang giao;
  - `delivered`: Đã giao;
  - `cancelled`: Đã hủy.
- **Chuyển trạng thái:** một lần đổi Trạng thái đơn theo Bảng chuyển hợp lệ. Mỗi lần chuyển ghi Mốc giờ và Người thao tác.
- **Mốc giờ:** thời điểm đơn đi vào một Trạng thái đơn.
- **Người thao tác:** Nhân viên thực hiện chuyển, hoặc "khách" khi khách tự hủy.
- **Nhân viên:** chủ shop hoặc nhân viên có tên và PIN trong cấu hình server.
- **Khu nhân viên:** các màn hình `/staff/*` và API `/api/staff/*`, chỉ Nhân viên đã đăng nhập mới dùng được.
- **Tồn kho:** số lượng hiện có của một sản phẩm, được lưu bền. Bị trừ khi xác nhận; được hoàn khi hủy đơn đã trừ hoặc khi hàng về shop.
- **Đèn tồn kho:** chỉ báo trên đơn `pending`. Xanh khi đủ hàng cho mọi dòng; đỏ khi có dòng thiếu, kèm "cần N, còn M, thiếu K".
- **Hàng đợi:** các đơn `pending`, `confirmed`, `shipping`, sắp theo thời gian chờ ở trạng thái hiện tại, lâu nhất lên đầu.
- **Trang theo dõi:** trang chi tiết đơn của khách, `/orders/[id]`.
- **Ba thông tin chính:** Trạng thái đơn hiện tại, Ngày dự kiến giao, tổng tiền kèm Trạng thái thanh toán.
- **Ngày dự kiến giao:** khoảng ngày suy ra từ phương thức giao. Tiêu chuẩn 3–5 ngày làm việc, nhanh 1–2 ngày làm việc.
- **Trạng thái thanh toán:** chuỗi hiển thị suy ra từ `paymentMethod` (`cod`, `bank_transfer`) và Trạng thái đơn.
- **Cờ phụ:** thuộc tính phụ trên đơn, ví dụ `cancelRequested`. Không phải Trạng thái đơn.
- **Sổ kho:** nhật ký chỉ ghi thêm; mỗi dòng là một lần Tồn kho thay đổi.
