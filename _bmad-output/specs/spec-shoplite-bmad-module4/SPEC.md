---
id: SPEC-shoplite-bmad-module4
companions:
  - glossary.md
  - acceptance-criteria.md
  - user-journeys.md
  - ../../planning-artifacts/architecture/architecture-shoplite-bmad-module4-2026-11-21/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/ux-designs/ux-shoplite-bmad-module4-2026-11-21/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-shoplite-bmad-module4-2026-11-21/EXPERIENCE.md
sources:
  - ../../planning-artifacts/prds/prd-shoplite-bmad-module4-2026-11-21/prd.md
  - ../../planning-artifacts/prds/prd-shoplite-bmad-module4-2026-11-21/addendum.md
---

> **Canonical contract.** SPEC này cùng các file trong `companions:` là hợp đồng đầy đủ, đã kiểm tra bảo toàn, cho việc build, test và validate. Tài liệu trong `sources:` chỉ để truy vết; chỉ đọc lại khi cần lập luận dạng văn xuôi mà hợp đồng này cố ý bỏ.

# Vận hành đơn hàng ShopLite

## Why

**Nỗi đau** của sản phẩm đang chạy (brownfield, commit `805f721`): ShopLite nhận được đơn nhưng không xử lý được. Mọi đơn đứng mãi ở *Chờ xác nhận*, tồn kho là hằng số trong code nên không bao giờ giảm, và khách không biết đơn đang ở bước nào. Người chịu ảnh hưởng là chủ shop và 1–3 nhân viên dùng điện thoại: họ cần biết đơn nào xử lý trước, cần chắc kho đủ hàng khi xác nhận, và không muốn lo đồng nghiệp đã xác nhận trùng hay kho bị trừ hai lần. Khách cũng chịu ảnh hưởng: họ muốn biết đơn ở đâu, bao giờ tới, phải trả bao nhiêu, mà không phải nhắn shop. Nguyên tắc neo mọi đánh đổi: **chuyển trạng thái đơn và thay đổi tồn kho là một thao tác nguyên tử.**

## Capabilities

`CAP-N` trùng số với PRD `FR-N`. Tiêu chí kiểm thử đầy đủ của từng CAP nằm trong `acceptance-criteria.md`; nơi hiện thực và quy tắc nằm trong Capability → Architecture Map của spine.

**MUST: giữ nguyên hành vi hiện có**

- **CAP-1**
  - **intent:** Đơn mới luôn dùng giá và phí giao do server tính từ catalog, bỏ qua mọi giá client gửi.
  - **success:** `POST /api/orders` kèm giá giả vẫn tạo đơn theo giá catalog. Phí tiêu chuẩn 30.000 ₫, miễn phí khi `subtotal ≥ 500.000 ₫`; giao nhanh 60.000 ₫.
- **CAP-2**
  - **intent:** Khách tự hủy được đơn *Chờ xác nhận* mà không cần đăng nhập, và chỉ đơn đó.
  - **success:** `PATCH {status:"cancelled"}` thành công khi đơn `pending`, Tồn kho không đổi. Trạng thái khác trả 409 `INVALID_STATUS_TRANSITION`; body khác trả 400 `VALIDATION_ERROR`. Nút "Hủy đơn" chỉ hiện khi đơn `pending`.
- **CAP-3**
  - **intent:** Kiểm tra tồn kho lúc đặt, giới hạn giỏ hàng, nhãn tồn kho và bộ lọc còn hàng vẫn như cũ, nhưng đọc Tồn kho lưu bền.
  - **success:** Sau khi một lần xác nhận đưa X về 0: trang X hiện "Hết hàng", `GET /api/products?inStock=true` không trả X, `POST /api/orders` cho X trả 409 `INSUFFICIENT_STOCK`. `e2e/shopping-flow.spec.ts` vẫn qua.
- **CAP-4**
  - **intent:** Hợp đồng các API hiện có và định dạng lỗi `{error:{code,message,details?}}` giữ nguyên; Đơn hàng chỉ được thêm trường.
  - **success:** Mọi test hiện có trong `npm run check` xanh mà không sửa assertion về trường cũ.

**MUST: hành vi mới**

- **CAP-5**
  - **intent:** Hệ thống giữ Tồn kho bền vững cho mọi sản phẩm, làm nguồn duy nhất cho mọi nơi đọc tồn kho.
  - **success:** Kho trống khi khởi động thì Tồn kho = `stock` trong `products.ts`. Giá trị sau xác nhận hoặc hủy còn nguyên sau restart. Tồn kho không bao giờ âm.
- **CAP-6**
  - **intent:** Nhân viên vào Khu nhân viên bằng PIN, phiên giữ trên thiết bị tối đa 12 giờ.
  - **success:** PIN sai không vào được và không lộ PIN thuộc ai. API staff gọi khi chưa đăng nhập trả 401 `UNAUTHORIZED`. Không cấu hình Nhân viên thì Khu nhân viên đóng. PIN không xuất hiện trong response, log hay file.
- **CAP-7**
  - **intent:** Mọi Chuyển trạng thái lưu Người thao tác và Mốc giờ; khách tự hủy thì ghi "khách".
  - **success:** Sau khi An xác nhận, đơn có Mốc giờ `confirmed` và Người thao tác "An".
- **CAP-8**
  - **intent:** Nhân viên chỉ thực hiện được các chuyển trong Bảng chuyển hợp lệ, và chỉ khi trạng thái hiện tại đúng bằng trạng thái "Từ" mà yêu cầu nêu.
  - **success:** `delivered → pending`, `pending → shipping`, `cancelled → *`, `delivered → *` trả 409 `INVALID_STATUS_TRANSITION`; đơn và kho không đổi.
- **CAP-9**
  - **intent:** Một chạm xác nhận đơn *Chờ xác nhận* đủ hàng, đồng thời trừ Tồn kho mọi dòng, theo kiểu tất cả hoặc không gì cả.
  - **success:** Đơn X×2, Y×1 với kho X=5, Y=3 cho ra X=3, Y=2. Thiếu hàng thì 409 `INSUFFICIENT_STOCK` kèm thiếu từng dòng, không đổi gì. Lỗi ghi giữa chừng không để trạng thái nửa vời sau restart. Hai đơn tranh món cuối: đúng một đơn thành công, kho về 0.
- **CAP-10**
  - **intent:** Thao tác lặp (người khác đã làm, hoặc bấm hai lần) bị từ chối, kèm thông tin ai đã làm và lúc nào.
  - **success:** An và Hoa cùng xác nhận một đơn: một yêu cầu 200, yêu cầu kia 409 `INVALID_STATUS_TRANSITION` với "Đã xác nhận bởi An lúc 08:05"; kho chỉ trừ một lần.
- **CAP-11**
  - **intent:** Nhân viên hủy được đơn `pending` hoặc `confirmed` với lý do bắt buộc từ danh sách cố định; hủy đơn `confirmed` hoàn đúng số đã trừ, trong cùng thao tác nguyên tử.
  - **success:** Hủy đơn `confirmed` X×2 làm X tăng đúng 2. Thiếu lý do trả 400 `VALIDATION_ERROR`. Lý do hiện trên Trang theo dõi.
- **CAP-12**
  - **intent:** Nhân viên hủy được đơn `shipping` khi giao thất bại, và chỉ hoàn kho khi xác nhận hàng đã về shop.
  - **success:** Hủy `shipping` thiếu "Hàng đã về shop" trả 400, kho không đổi. Có lựa chọn này thì kho được hoàn đúng số đã trừ.
- **CAP-13**
  - **intent:** Nhân viên thấy Hàng đợi (`pending`, `confirmed`, `shipping`) nhóm theo trạng thái, đơn chờ lâu nhất ở trạng thái hiện tại nằm trên cùng.
  - **success:** Đơn 20:00 nằm trên đơn 21:00. Đơn vừa xác nhận chuyển sang nhóm `confirmed` mà không cần tải lại thủ công. Dùng được ở 360px, không cuộn ngang.
- **CAP-14**
  - **intent:** Mỗi đơn *Chờ xác nhận* có Đèn tồn kho theo Tồn kho hiện tại; đèn đỏ khóa nút Xác nhận và ghi từng dòng thiếu.
  - **success:** X×2 với kho 2: đèn xanh, nút bật. Kho 1: đèn đỏ, "cần 2, còn 1, thiếu 1", nút khóa. Đèn cũ không làm oversell được, vì CAP-9 mới là kiểm tra quyết định.
- **CAP-15**
  - **intent:** Nhân viên chỉ thấy hành động hợp lệ với trạng thái hiện tại; hành động chính một chạm, hủy đơn cần bước xác nhận.
  - **success:** Đơn `delivered`/`cancelled` không có nút chuyển. Hành động chính: `pending` "Xác nhận", `confirmed` "Bắt đầu giao", `shipping` "Đã giao". Hủy không bao giờ là một chạm.
- **CAP-16**
  - **intent:** Khách thấy Ba thông tin chính (trạng thái, Ngày dự kiến giao, tổng tiền kèm Trạng thái thanh toán) ngay màn hình đầu, không cuộn ở 360px.
  - **success:** Quy tắc ngày giao và chuỗi thanh toán đúng như `acceptance-criteria.md` CAP-16, dùng `formatCurrency`. Danh sách sản phẩm và địa chỉ gập bên dưới.
- **CAP-17**
  - **intent:** Khách thấy thanh tiến trình bốn bước có Mốc giờ thật; đơn hủy hiện bước hủy kèm mốc và lý do.
  - **success:** Đơn `shipping` hiện ba mốc (đặt, xác nhận, bắt đầu giao), bước "Đã giao" trống. Mốc định dạng bằng `formatDateTime`.
- **CAP-18**
  - **intent:** Đơn tạo trước tính năng này vẫn mở được trên Trang theo dõi và trong Hàng đợi.
  - **success:** `orders.json` chỉ có trường cũ vẫn đọc được, không lỗi 500. Mốc đặt lấy từ `createdAt`; mốc thiếu hiện "—", không bịa.

**SHOULD: làm nếu kịp**

- **CAP-19**
  - **intent:** Nhân viên xem được toàn bộ lịch sử chuyển trạng thái của một đơn: từ, sang, Người thao tác, Mốc giờ, lý do.
  - **success:** Đi đủ `pending → confirmed → shipping → delivered` cho ra 4 dòng đúng thứ tự (dòng tạo đơn của "khách" + 3 lần chuyển).
- **CAP-20**
  - **intent:** Mỗi lần Tồn kho thay đổi được ghi một dòng vào Sổ kho chỉ ghi thêm.
  - **success:** Với mọi sản phẩm, Tồn kho hiện tại = giá trị khởi tạo + tổng thay đổi trong Sổ kho.
- **CAP-21**
  - **intent:** Nhân viên thấy số đơn theo từng trạng thái và danh sách sản phẩm có Tồn kho ≤ 5.
  - **success:** 3 đơn `pending` và 1 đơn `shipping` thì bộ đếm hiện 3 và 1. Sản phẩm kho 5 có trong danh sách, kho 6 thì không.
- **CAP-22**
  - **intent:** Khách gửi được "yêu cầu hủy" cho đơn `confirmed` bằng Cờ phụ; Nhân viên duyệt hoặc từ chối, khách thấy dải cảnh báo.
  - **success:** Gửi yêu cầu không đổi trạng thái và kho. `PATCH {status:"cancelled"}` cho đơn `confirmed` vẫn trả 409.
- **CAP-23**
  - **intent:** Hàng đợi đánh dấu đơn đứng yên quá ngưỡng.
  - **success:** Ngưỡng: `pending` hoặc `confirmed` quá 24 giờ, `shipping` quá hạn trên của Ngày dự kiến giao. Đơn `pending` lúc 08:00 hôm qua bị đánh dấu lúc 08:01 hôm nay; đơn 09:00 hôm qua thì chưa.

## Constraints

- **Brownfield:** CAP-1..CAP-4 là hành vi đang chạy. `Order` chỉ được thêm trường; test hiện có xanh mà không sửa assertion.
- **Hạ tầng:** không database, không dịch vụ ngoài, không dependency mới. Dữ liệu là file JSON trong `storage/`, chạy một tiến trình Node, không scale ngang.
- **Nguyên tử:** chuyển trạng thái và thay đổi kho cùng thành công hoặc không đổi gì. Kiểm tra quyết định nằm ở server, trong khóa; Đèn tồn kho chỉ là gợi ý.
- **Trạng thái:** chỉ 5 Trạng thái đơn; tình huống phụ dùng Cờ phụ. Không giữ hàng lúc đặt; kho chỉ bị trừ khi Nhân viên xác nhận.
- **Endpoint khách:** `PATCH /api/orders/:id {status:"cancelled"}` giữ nguyên và không cần đăng nhập. Thao tác của nhân viên đi đường riêng.
- **Khu nhân viên:** đóng khi thiếu cấu hình. PIN không bao giờ vào response, log hay file. Dữ liệu cho khách không lộ tên Nhân viên.
- **Mobile-first:** dùng được ở 360px, không cuộn ngang. Hành động chính một chạm; hành động không hoàn tác được luôn cần bước xác nhận (SM-C2).
- **Server-first:** UI chỉ đổi sau phản hồi server; không optimistic, không polling.
- **Counter-metric SM-C1:** không đạt oversell = 0 bằng cách ẩn sản phẩm ít hàng hay hạ Tồn kho khởi tạo.
- **Thanh toán, đóng gói, ngày giao (đã chốt v1):** không có hành động "Đã nhận tiền", nên `bank_transfer` không bao giờ hiện "Đã thanh toán". Không có cờ `packed`; `confirmed` được coi là chưa đóng gói, nên hủy luôn hoàn kho. Ngày làm việc là T2–T6, không tính ngày lễ. Muốn đổi tồn kho ngoài luồng đơn chỉ có `npm run stock:set` (AD-16).
- **Kiến trúc:** AD-1..AD-20 trong `ARCHITECTURE-SPINE.md` là ràng buộc; downstream trích dẫn đúng mã AD, không đánh số lại. Stack: Next 16.4.2, React 19.3, Zod 4, Node ≥ 22.12.

## Non-goals

- Thông báo chủ động (email, SMS, push, Zalo).
- Database, lưu trữ ngoài, nhiều tiến trình hay scale ngang.
- Trạng thái đơn mới (`cancel_requested`, `awaiting_customer`…).
- Giữ hàng lúc khách đặt.
- Tài khoản khách: `/orders` và `/orders/[id]` vẫn công khai (rủi ro đã chấp nhận ở PRD OQ-1).
- Hàng thay thế, giao từng phần, mã giảm giá bù trễ, app cho shipper, kệ tạm giữ tự hủy.
- Quản trị catalog; nhập hàng hay sửa Tồn kho qua giao diện.
- Nhiều cửa hàng hoặc nhiều kho.
- COULD v2: xác nhận hàng loạt, hoàn tác 10 giây, in phiếu giao, thống kê lý do hủy, doanh thu tách đã thu/đang treo, hiển thị "Còn 3, 2 đang trong đơn chờ xác nhận".

## Success signal

- **SM-1, oversell = 0:** test tương tranh tự động cho CAP-9 và CAP-10 chứng minh không đơn nào được xác nhận khi kho thiếu, kể cả xác nhận đồng thời; Tồn kho không âm trên dữ liệu thật. **SM-2, kho khớp:** với mọi sản phẩm, Tồn kho = khởi tạo − đã xác nhận + đã hoàn, đối chiếu bằng Sổ kho (CAP-20) hoặc script từ dữ liệu đơn.
- **SM-3:** E2E xác nhận một đơn đèn xanh bằng 1 chạm, dưới 10 giây. **SM-4:** không đơn nào ở `pending` quá 24 giờ. **SM-5:** Ba thông tin chính nằm trong màn hình đầu ở viewport 360px với mọi trạng thái. **SM-6:** `npm run check` và `npm run test:e2e` xanh.

## Assumptions

- Đơn cũ ở `confirmed`/`shipping` không có `statusHistory`: dùng `updatedAt` làm mốc vào trạng thái hiện tại, để tính thời gian chờ và đứng yên (CAP-13, CAP-23).

## Open Questions

- **Sao lưu:** lịch sao lưu và thời gian lưu giữ `shop-store.json` do chủ shop quyết.
- **Route FR-22:** `POST /api/orders/:id/cancel-request` và `DELETE /api/staff/orders/:id/cancel-request` mới là đề xuất; Architect duyệt khi bắt đầu CAP-22.
