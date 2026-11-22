# Hành trình người dùng

User đã xác nhận ngày 2026-11-21. Đây là kịch bản cho E2E và demo.

## UJ-1: Hoa xử lý Hàng đợi buổi sáng (CAP-6, CAP-9, CAP-10, CAP-11, CAP-13, CAP-14)

1. 8h sáng, Hoa mở Khu nhân viên trên điện thoại và nhập PIN.
2. Hàng đợi có 12 đơn `pending`, đơn từ tối qua nằm trên cùng.
3. 11 đơn đèn xanh. Mỗi lần Hoa chạm "Xác nhận", đơn rời nhóm và tồn kho trên web giảm ngay.
4. Một đơn đèn đỏ ghi "Micro thu âm: cần 2, còn 1, thiếu 1", nút Xác nhận bị khóa. Hoa gọi khách, khách đồng ý, Hoa hủy với lý do "Hết hàng".
5. Hàng đợi trống sau chưa đầy 10 phút.

**Biên:** An cũng chạm Xác nhận cùng một đơn. Hoa nhận "Đã xác nhận bởi An lúc 08:05", và kho chỉ bị trừ một lần.

## UJ-2: Minh theo dõi đơn bàn phím (CAP-16, CAP-17, CAP-2, CAP-22)

1. Minh đặt bàn phím, chọn thanh toán khi nhận (COD), rồi hôm sau mở lại trang đơn.
2. Màn hình đầu có ba dòng: "Đang giao", "Dự kiến giao: 25–27/11", "Thanh toán khi nhận: 1.250.000 ₫". Ngày tính theo CAP-16: giao tiêu chuẩn, xác nhận T7 21/11.
3. Thanh tiến trình: Chờ xác nhận 20/11 21:40 → Đã xác nhận 21/11 08:05 → Đang giao 21/11 15:30.

**Biên:** Minh muốn hủy, nhưng đơn đã `confirmed` nên không còn nút hủy. Ở v1 Minh phải liên hệ shop; gửi yêu cầu hủy là CAP-22 (SHOULD).

## UJ-3: Chủ shop hủy đơn đã xác nhận (CAP-11, CAP-17)

1. Khách gọi đổi ý về một đơn `confirmed`; hàng chưa đóng gói.
2. Chủ shop chạm "Hủy đơn" và chọn "Khách đổi ý".
3. Đơn chuyển `cancelled`, kho được hoàn đúng số đã trừ, và mốc hủy hiện trên trang của khách.
