# PRD Quality Review: Vận hành đơn hàng ShopLite

## Overall verdict
PRD có một luận điểm rõ ràng: trạng thái đơn và tồn kho phải đổi nguyên tử. Các FR đi theo luận điểm này. Phần lớn FR có hệ quả kiểm thử được, và hành vi hiện có được tách riêng ở §4.0 với tham chiếu code chính xác. Rủi ro lớn nhất không nằm ở tài liệu mà ở hai quyết định được chấp nhận có ý thức. Thứ nhất, dữ liệu khách công khai (OQ-1). Thứ hai, các UJ do agent dựng chứ không phải người dùng kể. Ngoài ra còn vài câu hỏi mở không chặn thiết kế.
**Xếp loại: Good.**

## Decision-readiness: strong
Các quyết định được viết thành quyết định: trừ kho lúc xác nhận, giữ 5 trạng thái, bảng 6 cặp chuyển trạng thái ở FR-8, `shipping → cancelled` chỉ hoàn kho khi "Hàng đã về shop". Đánh đổi được nêu rõ, ví dụ đơn đến sau bị đèn đỏ, hay `bank_transfer` không hiện "Đã thanh toán". OQ-1 được chốt và ghi rõ rủi ro chấp nhận.

### Findings
- **medium** Rủi ro dữ liệu khách công khai mới chỉ nằm trong OQ-1 (§8). Mục này đã đóng nên người đọc dễ bỏ qua. *Fix:* nhắc thêm ở §5, mục "Không tài khoản khách".

## Substance over theater: strong
Không có persona thừa: 3 UJ, mỗi UJ dẫn tới FR cụ thể. Không có NFR sáo rỗng; các ngưỡng đều cụ thể (360px, 10 giây, 24 giờ, `LOW_STOCK_THRESHOLD = 5`).

## Strategic coherence: strong
MVP thuộc kiểu "giải bài toán": phần nền (FR-5 đến FR-12) đi trước giao diện (FR-13 đến FR-18). SM-1 và SM-2 đo đúng luận điểm. SM-C1 và SM-C2 chặn hai cách "ăn gian" hợp lý nhất.

## Done-ness clarity: adequate
FR-1 đến FR-18 đều có hệ quả kiểm thử được, kể cả kịch bản tương tranh ở FR-9 và FR-10. FR-21 và FR-23 ban đầu thiếu hệ quả; đã sửa tự động.

### Findings
- **medium** FR-9: "lỗi ghi giữa chừng... không có trạng thái nửa vời" khó kiểm thử nếu không mô phỏng được lỗi (§4.3). *Fix:* để Architect chỉ định điểm chèn lỗi trong repository (repo in-memory có thể ném lỗi). Chuyển sang addendum.
- **low** FR-19: "4 dòng (gồm dòng tạo đơn)", cần nói rõ dòng tạo đơn có Người thao tác là "khách". *Fix:* làm rõ khi viết story.

## Scope honesty: strong
§5 có 8 mục không làm. §6.2 tách SHOULD, COULD, WON'T. `[NOTE FOR PM]` đặt đúng chỗ có giằng co (FR-11 và SM-2). Mọi `[ASSUMPTION]` đã được user xác nhận.

## Downstream usability: adequate
Glossary đầy đủ. ID liền mạch: FR-1 đến FR-23, UJ-1 đến UJ-3, SM-1 đến SM-6, SM-C1 và SM-C2. Tham chiếu chéo trỏ đúng.

### Findings
- **medium** UJ do agent dựng (§2.3). Người làm UX có thể thiếu chi tiết thực tế như bối cảnh cầm máy hay ánh sáng ở kho. *Fix:* ở `bmad-ux`, cho user kể bổ sung một phiên thật.
- **low** Thuật ngữ "Khu nhân viên" và "Hàng đợi" chưa gắn đường dẫn route, và cũng không nên gắn: đó là quyết định của UX/Architect.

## Shape fit: strong
PRD brownfield: tách rõ hành vi hiện có ở §4.0, tham chiếu `order-service.ts`, `order-errors.ts`, `lib/http.ts`, `pricing.ts`, `catalog-service.ts`, tất cả đều có thật. Mật độ UJ hợp lý cho sản phẩm có 2 vai trò.

## Mechanical notes
- ID liền mạch, không trùng. UJ-2 dẫn tới FR-22, đúng.
- §9 đã chuyển thành danh sách giả định đã xác nhận.
- Mọi file code được nhắc tới đều tồn tại (kiểm chứng trên `805f721`).
