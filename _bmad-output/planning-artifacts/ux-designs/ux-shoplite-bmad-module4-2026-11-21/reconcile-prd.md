# Đối chiếu: PRD (prd.md + addendum.md) → DESIGN.md + EXPERIENCE.md

| PRD | Bề mặt / mục UX | Kết quả |
|---|---|---|
| FR-1, FR-3, FR-4 (giữ nguyên) | Foundation: các trang cửa hàng giữ nguyên; `/orders` không đổi | Đủ |
| FR-2 khách hủy khi pending | State Patterns "Đơn pending" giữ nút hiện có | Đủ |
| FR-5 tồn kho bền | Không có UI (v1 không có màn nhập hàng) | Đúng phạm vi |
| FR-6 PIN | IA Đăng nhập, PIN form, State hết phiên 401, A11y role=alert | Đủ (chỉ có spine, không mockup) |
| FR-7 Người thao tác | Conflict notice; Progress stepper ở trang nhân viên | **Gap** → đã bổ sung "· bởi An" vào Progress stepper |
| FR-8 bảng chuyển | Component "chỉ hiện hành động hợp lệ"; State delivered/cancelled không có nút | Đủ |
| FR-9 xác nhận + trừ kho | Queue card 1 chạm, không optimistic | Đủ |
| FR-10 từ chối lặp | Conflict notice (sky) | Đủ, có mockup |
| FR-11 hủy + lý do | Cancel sheet inline, 4 lý do, "Khác" cần ghi chú | Đủ, có mockup |
| FR-12 giao thất bại | Cancel sheet cho shipping + checkbox "Hàng đã về shop" | Đủ, có mockup |
| FR-13 Hàng đợi sắp theo thời gian chờ | Queue group header, "Chờ 11 giờ" | Đủ |
| FR-14 Đèn tồn kho | Stock light icon + chữ + dòng thiếu | Đủ |
| FR-15 nút hợp lệ, 1 chạm, hủy cần xác nhận | Interaction Primitives | Đủ |
| FR-16 Ba thông tin chính | Key info card, 360/390px màn hình đầu | Đủ |
| FR-17 tiến trình Mốc giờ | Progress stepper | Đủ |
| FR-18 đơn cũ | State "—" | Đủ, có mockup |
| FR-19..23 (SHOULD) | Alert strip, chip đếm nhóm; lịch sử / sổ kho chưa có màn | Ghi nhận ở mức SHOULD; màn lịch sử và sổ kho cần UX bổ sung khi làm |
| UJ-1..3 | Key Flows 1..3, cùng nhân vật | Đủ |
| SM-5 (360px) | Responsive < 640px | Đủ (thiết kế 390px, có kiểm tra ở 360px) |
| SM-C2 (hủy nhầm) | Hủy hai bước | Đủ |
| OQ-5 làm mới hàng đợi | Nút làm mới thủ công | Đủ, theo hướng PRD |
