# Đối chiếu: brief.md + addendum.md (brief) → prd.md + addendum.md (PRD)

| Mục trong brief | Ở PRD | Kết quả |
|---|---|---|
| Vấn đề: đơn kẹt, oversell, khách mù thông tin | §1 Vision, §2.1 JTBD | Đủ |
| Nguyên tắc nguyên tử đơn + kho | §1, FR-9, FR-11, FR-12 | Đủ |
| Chỉ chuyển từ trạng thái liền trước, báo "Đã xác nhận bởi An" | FR-8, FR-10 | Đủ |
| Kho chỉ đổi khi hàng thật đổi (đóng gói, giao thất bại) | FR-11 (Notes + OQ-3), FR-12 | Đủ; "đã đóng gói" chuyển thành OQ-3 |
| Một nguồn sự thật | §4.5 Description | Đủ |
| Chỉ hiện nút hợp lệ, 1 chạm, hạn chế gõ tay | FR-15 | Đủ |
| MUST: tồn kho lưu được, bảo vệ màn hình NV | FR-5, FR-6, FR-7 | Đủ |
| Trang khách: 3 thông tin + tiến trình mốc giờ | FR-16, FR-17 | Đủ |
| Dải cảnh báo khi khách cần hành động | Out of Scope §4.5 → đi cùng FR-22 (SHOULD) | Hạ mức, có ghi rõ |
| Khách biết "vì sao bị trễ" | FR-23 Notes | **Gap nhỏ** → đã ghi chú, chưa có FR riêng cho khách |
| SHOULD (lịch sử, sổ kho, khoảng ngày, cảnh báo, yêu cầu hủy, lý do hủy, đếm) | FR-19..23; khoảng ngày và lý do hủy nâng lên MUST (FR-16, FR-11) | Đủ |
| COULD | §6.2 | Đủ, gồm cả gợi ý "Còn 3, 2 đang chờ" |
| WON'T + ràng buộc không DB/dịch vụ ngoài | §5 | Đủ |
| SC-1..SC-6 | SM-1..SM-6 | Đủ (1:1) |
| Rủi ro: ghi JSON không khóa, đơn cũ, truy cập khách, quy mô | addendum PRD, FR-18, OQ-1 (đã chốt), §5 không scale ngang | Đủ |
| Addendum brief: ledger fields, PIN + cookie, phương án nguyên tử | addendum PRD | Đủ |
| Giọng/cảm xúc: "không bao giờ phải gọi xin lỗi khách", "không phải nhắn hỏi shop" | §2.1 JTBD cảm xúc | Đủ |

**Gap:** 1 (lý do trễ cho khách: đã ghi chú, để ở mức SHOULD).
