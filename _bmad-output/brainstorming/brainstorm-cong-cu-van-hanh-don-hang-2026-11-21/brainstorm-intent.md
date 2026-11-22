---
type: brainstorm-intent
topic: Công cụ vận hành đơn hàng cho nhân viên ShopLite + khách theo dõi trạng thái đơn
date: 2026-11-21
status: user-approved
---

# Brainstorm Intent — Vận hành đơn hàng ShopLite

**Kết luận cốt lõi (user chốt):** Tồn kho đúng là nền tảng, phải làm trước. Chuyển trạng thái đơn và thay đổi tồn kho là MỘT việc nguyên tử. Dashboard, cảnh báo trễ, ngày giao dự kiến đều dựa trên dữ liệu đơn/kho đúng.

## Vấn đề
- Đơn kẹt ở "Chờ xác nhận": không có chỗ để nhân viên xác nhận, chuyển giao hoặc đánh dấu đã giao.
- Code đã có 5 trạng thái: `pending / confirmed / shipping / delivered / cancelled`.
- Khách chỉ hủy được khi đơn còn `pending`.
- Tồn kho trên web không bao giờ giảm khi bán, nên có nguy cơ bán vượt tồn kho (oversell).
- Dự án không có dịch vụ ngoài (email/thông báo); đơn hàng lưu bằng file JSON, không có database (theo README) — cần lưu ý khi làm thao tác "xác nhận + trừ kho" nguyên tử và khi hai nhân viên thao tác đồng thời.

## Người dùng
- **Chính:** chủ shop và nhân viên, dùng điện thoại là chính (mobile-first). Họ cần xác nhận đơn nhanh và sợ oversell.
- **Phụ:** khách hàng. Họ cần biết đơn đang ở đâu và vì sao bị trễ.

## Nguyên tắc cốt lõi
1. **Trừ kho nguyên tử khi xác nhận:** xác nhận và trừ kho cùng thành công, hoặc không có gì thay đổi. Hủy thì hoàn kho.
2. **Chỉ chấp nhận chuyển trạng thái hợp lệ:** chỉ đi tiếp từ đúng trạng thái liền trước (vd `pending→confirmed`). Bấm lần 2 sẽ bị từ chối ("Đã xác nhận bởi An lúc 9:15"), nên không thể trừ kho 2 lần.
3. **Kho chỉ đổi khi hàng thật đổi:** khi có yêu cầu hủy mà hàng đã đóng gói thì giữ hàng, liên hệ khách rồi mới hoàn kho. Giao thất bại thì chỉ hoàn kho khi hàng đã về tới shop.
4. **Một nguồn sự thật:** trang khách và màn hình nhân viên đọc cùng một bản ghi đơn. "Đơn nào cần xử lý" và "3 thông tin cho khách" là cùng một dữ liệu nhìn từ hai phía.
5. **Mỗi màn hình chỉ hiện nút hợp lệ** với trạng thái hiện tại. Hành động chính chỉ cần 1 chạm, hạn chế gõ tay.

## Phạm vi (MoSCoW, user duyệt nguyên văn)
**MUST** (nền tảng, làm trước)
- Chuyển trạng thái đúng thứ tự, nút hiện theo trạng thái.
- Trừ kho nguyên tử khi xác nhận và chặn oversell. Mỗi đơn có đèn tồn kho: xanh thì xác nhận 1 chạm; đỏ thì khóa nút và hiện số lượng thiếu.
- Hoàn kho khi hủy.
- Hàng đợi đơn cần xử lý dạng mobile-first, đơn chờ lâu nhất xếp lên đầu.
- Trang khách: 3 thông tin chính và thanh tiến trình có mốc giờ.

**SHOULD**
- Lịch sử trạng thái (ai đổi, lúc nào) và sổ kho dạng ledger (mỗi dòng gắn mã đơn).
- Ngày dự kiến giao hiển thị dạng khoảng.
- Cảnh báo đơn đứng yên quá lâu hoặc trễ hạn.
- Khách gửi "yêu cầu hủy" khi đơn đã xác nhận, shop duyệt.
- Shop hủy đơn phải ghi lý do.
- Đếm đơn theo trạng thái và danh sách hàng sắp hết.

**COULD**
- Xác nhận hàng loạt.
- Hoàn tác trong 10 giây.
- In phiếu giao hàng.
- Thống kê lý do hủy.
- Doanh thu tách phần đã thu và phần đang treo.

**WON'T (lần này)**
- Hàng thay thế / giao từng phần, mã giảm giá bù trễ, app shipper (QR + ảnh), kệ tạm giữ tự hủy sau 24h, thông báo chủ động.
- *Lý do:* các mục này phụ thuộc vào nền tảng trạng thái và kho phải đúng trước. Riêng thông báo chủ động thì dự án không có dịch vụ ngoài/email.

## Trải nghiệm khách
- Màn hình đầu chỉ có 3 thông tin:
  - **Trạng thái hiện tại**
  - **Ngày dự kiến giao**
  - **Tổng tiền kèm trạng thái thanh toán** ("Thanh toán khi nhận: 1.250.000đ" hoặc "Đã thanh toán")
  - Mọi thứ khác gập lại bên dưới.
- Thanh tiến trình: Chờ xác nhận → Đã xác nhận → Đang giao → Đã giao. Mỗi bước có mốc giờ thật.
- **Ngoại lệ:** chỉ khi khách cần hành động (chọn phương án cho hàng thiếu, đơn trễ) thì hiện thêm 1 dải cảnh báo kèm nút.

## Câu hỏi mở
- Giao từng phần: phí ship tính thế nào? Một đơn mang hai trạng thái hay tách thành hai đơn?
- ~~Trừ kho lúc nào?~~ **Đã chốt (user): trừ kho khi shop xác nhận**, không giữ hàng lúc đặt. Chấp nhận: hai khách cùng đặt món cuối thì đơn sau hiện đèn đỏ lúc xác nhận.
- ~~"Yêu cầu hủy" / "chờ khách quyết định" đặt ở đâu?~~ **Đã chốt (user): giữ nguyên 5 trạng thái**, hai tình huống này là **cờ phụ** trên đơn (vd `cancelRequested`, `awaitingCustomer`), không thêm trạng thái mới.
- Gợi ý cho PRD: hiển thị tồn kho dạng "Còn 3, 2 đang trong đơn chờ xác nhận" để giảm đặt trùng (vì trừ kho lúc xác nhận).
