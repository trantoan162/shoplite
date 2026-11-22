---
title: "Product Brief: Vận hành đơn hàng ShopLite"
status: draft
created: 2026-11-21
updated: 2026-11-21
inputs:
  - _bmad-output/brainstorming/brainstorm-cong-cu-van-hanh-don-hang-2026-11-21/brainstorm-intent.md
  - README.md
---

# Product Brief: Vận hành đơn hàng ShopLite

## Tóm tắt

ShopLite đang nhận được đơn nhưng chưa xử lý được đơn. Khách đặt hàng xong thì đơn nằm mãi ở "Chờ xác nhận", vì shop không có màn hình nào để xác nhận, chuyển giao hay đánh dấu đã giao. Tồn kho trên web cũng không giảm khi bán, nên món cuối cùng có thể bị bán cho nhiều người. Khách thì không biết đơn của mình đang ở đâu.

Tính năng này cho chủ shop và nhân viên một **hàng đợi đơn trên điện thoại**. Mỗi đơn có một **đèn tồn kho**: đèn xanh thì xác nhận bằng một chạm, và kho bị trừ ngay trong cùng thao tác đó. Đèn đỏ thì nút bị khóa và màn hình hiện rõ đang thiếu bao nhiêu. Khách có **trang theo dõi đơn** gồm ba thông tin chính và thanh tiến trình có mốc giờ thật. Màn hình nhân viên và trang khách cùng đọc một bản ghi đơn.

Nguyên tắc nền: **đổi trạng thái đơn và đổi tồn kho là một việc duy nhất**, hoặc cả hai cùng thành công, hoặc không có gì thay đổi. Mọi tính năng về sau như dashboard, cảnh báo trễ hay ngày giao dự kiến chỉ đáng tin khi lớp nền này đúng. Vì vậy brief này ưu tiên làm nền trước, làm đẹp sau.

## Vấn đề

- **Đơn bị kẹt.** Code đã có 5 trạng thái (`pending → confirmed → shipping → delivered`, cộng `cancelled`) nhưng chưa có cách nào để đi tiếp quá `pending`. Với shop, mọi đơn đều "chưa xử lý". Với khách, mọi đơn đều "chưa ai ngó tới".
- **Nguy cơ bán quá số hàng có (oversell).** Tồn kho hiện là hằng số viết thẳng trong code (`src/data/products.ts`) nên không giảm khi bán. Hai khách có thể cùng mua món cuối, và shop chỉ biết khi ra kệ lấy hàng. Đây là nỗi sợ lớn nhất của chủ shop.
- **Khách không nắm được tình hình.** Khách không biết đơn đã được xác nhận chưa, bao giờ giao, đã thanh toán hay sẽ trả khi nhận. Họ chỉ hủy được đơn lúc còn "Chờ xác nhận". Sau đó thì không có cách nào lên tiếng.
- **Hiện tại xoay xở bằng tay**: nhớ trong đầu, ghi giấy, nhắn tin. Không có dấu vết ai đã làm gì, lúc nào.

## Giải pháp

**Cho shop (ưu tiên mobile):**
- Hàng đợi "đơn cần xử lý", đơn chờ lâu nhất lên đầu.
- Mỗi màn hình chỉ hiện những nút hợp lệ với trạng thái hiện tại. Hành động chính chỉ cần một chạm, hạn chế gõ tay.
- **Xác nhận đơn = trừ kho, trong một thao tác nguyên tử.** Đơn chỉ được đi tiếp từ đúng trạng thái liền trước. Nếu bấm lần thứ hai, hệ thống từ chối và báo rõ: "Đã xác nhận bởi An lúc 9:15". Nhờ vậy kho không bao giờ bị trừ hai lần.
- **Hủy đơn thì hoàn kho.** Kho chỉ thay đổi khi hàng thật thay đổi: hàng đã đóng gói thì giữ lại cho tới khi liên hệ được khách; giao thất bại thì chỉ hoàn kho khi hàng đã về tới shop.

**Cho khách:**
- Màn hình đầu chỉ có ba thông tin: **trạng thái hiện tại**, **ngày dự kiến giao**, **tổng tiền kèm trạng thái thanh toán** (ví dụ "Thanh toán khi nhận: 1.250.000 ₫"). Mọi thứ khác gập lại bên dưới.
- Thanh tiến trình Chờ xác nhận → Đã xác nhận → Đang giao → Đã giao, mỗi bước có mốc giờ thật.
- Chỉ khi khách cần làm gì đó mới hiện thêm một dải cảnh báo kèm nút.

## Vì sao cách làm này khác

Đây là công cụ nội bộ, nên nó không hơn ai nhờ tính năng mà nhờ **tính đúng**:
- **Một nguồn sự thật.** "Đơn nào cần xử lý" bên shop và "ba thông tin" bên khách là cùng một dữ liệu nhìn từ hai phía, nên không bao giờ lệch nhau.
- **Kho bám theo hàng thật**, không bám theo nút bấm.
- **Không phụ thuộc gì bên ngoài**: không database, không dịch vụ email hay thông báo, chạy trọn trong app hiện có. Đổi lại, khách phải tự vào trang để xem, hệ thống không chủ động báo (xem mục "Ngoài phạm vi lần này").

## Người dùng

- **Chính: chủ shop và 1–3 nhân viên** của cùng một cửa hàng. Họ dùng điện thoại khi đứng ở kho hoặc quầy. Với họ, thành công nghĩa là sáng mở máy thấy ngay việc cần làm, xác nhận một đơn trong vài giây và không bao giờ phải gọi xin lỗi khách vì hết hàng.
- **Phụ: khách hàng.** Họ muốn biết đơn đang ở đâu và vì sao bị trễ mà không phải nhắn tin hỏi shop.

## Tiêu chí thành công

| # | Chỉ tiêu | Mục tiêu |
|---|---|---|
| SC-1 | Oversell: số đơn được xác nhận khi kho không đủ hàng | **0**, kể cả khi hai nhân viên bấm cùng lúc |
| SC-2 | Kho lệch: tồn kho hiện tại = tồn ban đầu − hàng của đơn đã xác nhận + hàng hoàn | Luôn khớp, kiểm chứng được bằng sổ kho |
| SC-3 | Thao tác xác nhận một đơn có đèn xanh | 1 chạm, dưới 10 giây từ lúc mở hàng đợi |
| SC-4 | Đơn bị bỏ quên ở "Chờ xác nhận" | Không đơn nào chờ quá 24 giờ mà không ai xử lý |
| SC-5 | Khách hiểu đơn đang ở đâu | Ba thông tin chính nhìn thấy ngay khi mở trang, không cần cuộn, trên màn hình 360px |
| SC-6 | Không làm hỏng tính năng hiện có | `npm run check` và E2E hiện tại vẫn xanh. Khách vẫn tự hủy được đơn lúc còn "Chờ xác nhận". Server vẫn tự tính lại giá |

## Phạm vi

**Trong phạm vi (MUST, phần nền làm trước):**
- Chuyển trạng thái đúng thứ tự, nút hiện theo trạng thái.
- Lưu tồn kho được (không còn là hằng số trong code). Trừ kho nguyên tử khi xác nhận, chặn oversell, đèn tồn kho xanh/đỏ có số lượng thiếu.
- Hoàn kho khi hủy.
- Hàng đợi đơn mobile-first, đơn chờ lâu nhất lên đầu.
- Trang khách: ba thông tin và thanh tiến trình có mốc giờ.
- Màn hình nhân viên có bảo vệ tối thiểu và ghi nhận ai thao tác: danh sách nhân viên kèm PIN cấu hình qua biến môi trường hoặc file, không có hệ thống tài khoản.

**Nên có (SHOULD), nếu kịp:** lịch sử trạng thái (ai đổi, lúc nào); sổ kho dạng ledger, mỗi dòng gắn mã đơn; ngày dự kiến giao dạng khoảng; cảnh báo đơn đứng yên quá lâu; khách gửi "yêu cầu hủy" sau khi đơn đã xác nhận để shop duyệt; shop hủy đơn phải ghi lý do; đếm đơn theo trạng thái và danh sách hàng sắp hết.

**Có thể (COULD):** xác nhận hàng loạt, hoàn tác trong 10 giây, in phiếu giao hàng, thống kê lý do hủy, doanh thu tách phần đã thu và phần đang treo.

**Ngoài phạm vi lần này:** thông báo chủ động (email, SMS, push) vì không có dịch vụ ngoài; hàng thay thế và giao từng phần; mã giảm giá bù trễ; app cho shipper (QR, ảnh); kệ tạm giữ hàng tự hủy sau 24 giờ; database; thêm trạng thái đơn mới; tài khoản khách hàng hay đăng nhập khách.

**Quyết định đã chốt:**
- Trừ kho lúc **shop xác nhận**, không giữ hàng lúc khách đặt. Hệ quả chấp nhận được: hai khách cùng đặt món cuối thì đơn đến sau sẽ hiện đèn đỏ khi xác nhận.
- Giữ nguyên **5 trạng thái**. "Yêu cầu hủy" và "chờ khách quyết định" là **cờ phụ** trên đơn, không phải trạng thái mới.

## Rủi ro và điều chưa biết

- **Nguyên tử khi lưu bằng file JSON.** Cách ghi hiện tại (đọc → sửa → ghi lại cả file, không khóa) sẽ làm mất dữ liệu hoặc trừ kho sai khi có hai thao tác cùng lúc. Kiến trúc phải bảo đảm đơn và kho được ghi như một khối, trong bối cảnh app chạy một tiến trình duy nhất (một server, không scale ngang). Đây là rủi ro kỹ thuật số một và là thứ phải kiểm chứng đầu tiên.
- **Dữ liệu đơn cũ.** Các đơn có sẵn trong `orders.json` chưa có mốc giờ từng bước và chưa có lịch sử. Cần quyết định cách hiển thị chúng.
- **Khách xem đơn của mình thế nào khi không có tài khoản.** Trang `/orders` hiện liệt kê lịch sử đơn mà không có định danh khách. Trang theo dõi cần một cách truy cập không làm lộ đơn của người khác. Câu hỏi này cần chốt ở PRD.
- **Quy mô.** Dự kiến dưới khoảng 100 đơn/ngày. Ở quy mô này lưu file JSON vẫn đủ. Vượt xa mức đó thì phải xem lại ràng buộc "không database".

## Tầm nhìn

Khi trạng thái và kho đã đúng, ShopLite có một nền dữ liệu đáng tin để xây tiếp: dashboard vận hành, cảnh báo trễ, ngày giao dự kiến chính xác hơn, giao từng phần, và khi có ngân sách thì thêm thông báo chủ động cho khách. Mục tiêu dài hạn: chủ shop nhỏ vận hành cả cửa hàng chỉ bằng điện thoại, và khách không bao giờ phải hỏi "đơn của tôi đâu?".
