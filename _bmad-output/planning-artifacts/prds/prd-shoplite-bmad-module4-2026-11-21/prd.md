---
title: "PRD: Vận hành đơn hàng ShopLite"
status: final
created: 2026-11-21
updated: 2026-11-21
inputs:
  - _bmad-output/planning-artifacts/briefs/brief-shoplite-bmad-module4-2026-11-21/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-shoplite-bmad-module4-2026-11-21/addendum.md
---

# PRD: Vận hành đơn hàng ShopLite
*Tên làm việc, cần xác nhận.*

## 0. Document Purpose

PRD này dành cho người làm UX (`bmad-ux`), Architect (`bmad-architecture`), người tách epic/story và QA. Nó mô tả chính xác hệ thống phải làm được gì để chủ shop và nhân viên xử lý đơn từ "Chờ xác nhận" tới "Đã giao" mà không bán quá tồn kho, và để khách biết đơn của mình đang ở đâu. PRD được xây trên product brief cùng ngày (xem `inputs`) và không lặp lại phần lập luận của brief.

ShopLite là sản phẩm **đang chạy** (brownfield). Vì vậy mọi yêu cầu được tách thành hai loại: **hành vi MỚI** (§4.1–§4.7) và **hành vi HIỆN CÓ phải giữ nguyên** (§4.0). Tham chiếu code đã được kiểm chứng trên commit `805f721`. Thuật ngữ dùng đúng như §3. Các giả định của bản nháp đã được user xác nhận, xem §9. Lựa chọn kỹ thuật nằm trong `addendum.md`.

## 1. Vision

Hôm nay ShopLite nhận được đơn nhưng không xử lý được đơn. Mọi đơn đứng mãi ở *Chờ xác nhận*. Tồn kho là hằng số trong code nên không bao giờ giảm. Khách thì không biết đơn mình đang ở bước nào.

Sau tính năng này, chủ shop mở điện thoại là thấy ngay **Hàng đợi** các đơn cần xử lý, đơn chờ lâu nhất nằm trên cùng. Mỗi đơn có **Đèn tồn kho**. Đèn xanh thì một chạm là xác nhận, và **Tồn kho** bị trừ ngay trong cùng thao tác. Đèn đỏ thì nút bị khóa và màn hình nói rõ thiếu bao nhiêu. Khách mở trang đơn hàng thấy ba thông tin chính và thanh tiến trình có mốc giờ thật.

Nguyên tắc chi phối toàn bộ PRD: **chuyển trạng thái đơn và thay đổi tồn kho là một thao tác nguyên tử.** Cả hai cùng thành công, hoặc không có gì thay đổi. Mọi thứ ở các bản sau (dashboard, cảnh báo trễ, giao từng phần) đều xây trên nền này.

## 2. Target User

### 2.1 Jobs To Be Done

- **Chủ shop và nhân viên (người dùng chính, 1–3 người, cùng một cửa hàng, dùng điện thoại):**
  - *Chức năng:* "Khi bắt đầu ca, tôi muốn biết ngay đơn nào cần xử lý trước, để không ai phải chờ quá lâu."
  - *Chức năng:* "Khi xác nhận đơn, tôi muốn chắc chắn trong kho có đủ hàng, để không phải gọi xin lỗi khách vì hết hàng."
  - *Cảm xúc:* "Tôi không muốn lo rằng đồng nghiệp đã xác nhận cùng đơn đó, hay kho đã bị trừ hai lần."
- **Khách hàng (người dùng phụ):**
  - *Chức năng:* "Sau khi đặt, tôi muốn biết đơn đang ở đâu, bao giờ tới và tôi phải trả bao nhiêu."
  - *Cảm xúc:* "Tôi không muốn phải nhắn tin hỏi shop mà vẫn yên tâm."

### 2.2 Non-Users (v1)

- Shipper hay đơn vị vận chuyển. Họ không có màn hình riêng; nhân viên shop cập nhật thay họ.
- Nhiều cửa hàng hoặc nhiều kho. Hệ thống chỉ có một kho duy nhất.
- Quản trị catalog (sửa giá, thêm sản phẩm). Không thuộc phạm vi PRD này.

### 2.3 Key User Journeys

> Các hành trình dưới đây do agent dựng từ brief theo Fast path; user đã xác nhận giữ nguyên (2026-11-21).

- **UJ-1. Chị Hoa xử lý hàng đợi buổi sáng mà không lo bán quá tồn kho.**
  Chị Hoa là nhân viên kho của ShopLite. 8h sáng chị mở **Khu nhân viên** trên điện thoại và nhập PIN. **Hàng đợi** hiện 12 đơn *Chờ xác nhận*, đơn đặt từ tối qua nằm trên cùng. Mười một đơn có **Đèn tồn kho** xanh; chị chạm "Xác nhận" từng đơn, đơn rời Hàng đợi và tồn kho trên web giảm ngay. Một đơn có đèn đỏ ghi "Micro thu âm: cần 2, còn 1, thiếu 1"; nút Xác nhận bị khóa. Chị gọi khách, khách đồng ý hủy, chị hủy đơn kèm lý do "Hết hàng". **Cao trào:** sau chưa đầy 10 phút Hàng đợi trống. **Trường hợp biên:** anh An cũng vừa chạm Xác nhận cùng một đơn. Chị Hoa nhận thông báo "Đã xác nhận bởi An lúc 08:05" và tồn kho chỉ bị trừ một lần.

- **UJ-2. Anh Minh biết đơn bàn phím đang ở đâu mà không cần nhắn shop.**
  Anh Minh đặt một bàn phím, thanh toán khi nhận hàng. Hôm sau anh mở lại trang đơn hàng qua đường link trong lịch sử trình duyệt. Màn hình đầu chỉ có ba dòng: "Đang giao", "Dự kiến giao: 25–27/11", "Thanh toán khi nhận: 1.250.000 ₫". Thanh tiến trình hiện Chờ xác nhận 20/11 21:40 → Đã xác nhận 21/11 08:05 → Đang giao 21/11 15:30. **Cao trào:** anh biết chắc hôm nay chưa tới, và chuẩn bị đủ tiền mặt. **Trường hợp biên:** anh muốn hủy nhưng đơn đã *Đã xác nhận* nên không còn nút hủy. Ở v1 anh phải liên hệ shop; tính năng gửi yêu cầu hủy thuộc mức SHOULD (FR-22).

- **UJ-3. Chủ shop hủy một đơn đã xác nhận và tồn kho được hoàn đúng.**
  Chủ shop nhận cuộc gọi: khách đổi ý về một đơn *Đã xác nhận*, hàng chưa đóng gói. Chị mở đơn, chạm "Hủy đơn" và chọn lý do "Khách đổi ý". Đơn chuyển *Đã hủy*, tồn kho các mặt hàng được hoàn lại đúng số đã trừ, và mốc giờ hủy hiện trên trang của khách.

## 3. Glossary

- **Đơn hàng (Order)**: bản ghi đơn trong `storage/orders.json` (kiểu `Order` ở `src/features/orders/types.ts`). Mỗi Đơn hàng có đúng một **Trạng thái đơn**.
- **Trạng thái đơn**: một trong 5 giá trị `pending` (Chờ xác nhận), `confirmed` (Đã xác nhận), `shipping` (Đang giao), `delivered` (Đã giao), `cancelled` (Đã hủy), lấy theo `ORDER_STATUSES` và `ORDER_STATUS_LABELS`. Không thêm trạng thái mới.
- **Chuyển trạng thái**: một lần đổi Trạng thái đơn theo **Bảng chuyển hợp lệ** (FR-8). Mỗi lần chuyển ghi lại **Mốc giờ** và **Người thao tác**.
- **Mốc giờ**: thời điểm Đơn hàng đi vào một Trạng thái đơn.
- **Người thao tác**: nhân viên thực hiện Chuyển trạng thái, hoặc "khách" khi khách tự hủy.
- **Nhân viên**: chủ shop hoặc nhân viên có tên và PIN trong cấu hình. Nhân viên đăng nhập vào **Khu nhân viên**.
- **Khu nhân viên**: các màn hình và API chỉ Nhân viên đã đăng nhập mới dùng được.
- **Tồn kho**: số lượng hiện có của một sản phẩm, được lưu bền (không còn là hằng số `stock` trong `src/data/products.ts`). Tồn kho bị trừ khi xác nhận và được hoàn khi hủy hoặc khi hàng về shop.
- **Đèn tồn kho**: chỉ báo trên một Đơn hàng *Chờ xác nhận*. **Xanh** khi Tồn kho đủ cho mọi dòng hàng; **đỏ** khi có ít nhất một dòng thiếu, kèm số lượng thiếu của từng dòng.
- **Hàng đợi**: danh sách Đơn hàng cần Nhân viên hành động (`pending`, `confirmed`, `shipping`), sắp theo thời gian chờ ở trạng thái hiện tại, lâu nhất lên đầu.
- **Trang theo dõi**: trang chi tiết đơn của khách tại `/orders/[id]`.
- **Ba thông tin chính**: Trạng thái đơn hiện tại, **Ngày dự kiến giao**, tổng tiền kèm **Trạng thái thanh toán**.
- **Ngày dự kiến giao**: một khoảng ngày suy ra từ phương thức giao hàng (`SHIPPING_OPTIONS` trong `src/features/checkout/pricing.ts`: tiêu chuẩn 3–5 ngày làm việc, nhanh 1–2 ngày làm việc).
- **Trạng thái thanh toán**: chuỗi hiển thị suy ra từ `paymentMethod` (`cod`, `bank_transfer`) và Trạng thái đơn.
- **Cờ phụ**: thuộc tính phụ trên Đơn hàng (ví dụ `cancelRequested`), không phải Trạng thái đơn. Thuộc mức SHOULD.
- **Sổ kho**: nhật ký chỉ ghi thêm, mỗi dòng là một lần Tồn kho thay đổi và gắn với mã Đơn hàng. Thuộc mức SHOULD.

## 4. Features

Mức ưu tiên ghi ở tiêu đề mỗi tính năng: **MUST** thuộc MVP, **SHOULD** làm nếu kịp (§6).

### 4.0 Hành vi hiện có phải giữ nguyên (MUST)

**Description:** Các quy tắc dưới đây đang chạy và đã có test (`order-service.test.ts`, `route.test.ts`, `e2e/shopping-flow.spec.ts`). Tính năng mới không được làm thay đổi chúng. Chỗ nào nguồn dữ liệu đổi (Tồn kho) thì hành vi quan sát được vẫn phải như cũ.

#### FR-1: Server luôn tự tính lại giá

Khi tạo Đơn hàng, hệ thống lấy `unitPrice` từ catalog và tính `subtotal`, `shippingFee`, `total` bằng `calculateOrderTotals`. Mọi giá do client gửi lên đều bị bỏ qua (`placeOrder` trong `src/features/orders/order-service.ts`).

**Consequences (testable):**
- `POST /api/orders` có kèm trường giá trong `items` thì đơn tạo ra vẫn dùng giá catalog.
- Phí giao hàng: tiêu chuẩn 30.000 ₫, bằng 0 khi `subtotal ≥ 500.000 ₫`; giao nhanh 60.000 ₫.

#### FR-2: Khách chỉ tự hủy được khi đơn đang *Chờ xác nhận*

Khách hủy đơn qua `PATCH /api/orders/:id` với body `{ "status": "cancelled" }`, chỉ khi đơn đang `pending`. Endpoint này vẫn **không cần** đăng nhập.

**Consequences (testable):**
- Đơn `confirmed`, `shipping`, `delivered` hoặc `cancelled` thì trả 409 `INVALID_STATUS_TRANSITION`.
- Body khác `{ "status": "cancelled" }` thì trả 400 `VALIDATION_ERROR`. Khách không dùng endpoint này để chuyển sang trạng thái khác.
- Nút "Hủy đơn" trên Trang theo dõi chỉ hiện khi đơn `pending` (`CancelOrderButton`).
- Hủy đơn `pending` **không** đổi Tồn kho, vì Tồn kho chưa bị trừ (FR-9).

#### FR-3: Kiểm tra tồn kho lúc đặt và giới hạn giỏ hàng giữ nguyên, nhưng đọc Tồn kho mới

Khi đặt, hệ thống vẫn từ chối dòng hàng có `quantity` lớn hơn Tồn kho (409 `INSUFFICIENT_STOCK`, giữ nguyên thông điệp). Lúc đặt **không** trừ Tồn kho. Giỏ hàng vẫn giới hạn 10 sản phẩm mỗi loại và không vượt Tồn kho (`getMaxQuantity`). Nhãn "Còn hàng / Chỉ còn N sản phẩm / Hết hàng" (`StockBadge`, ngưỡng `LOW_STOCK_THRESHOLD = 5`) và bộ lọc `inStock` giữ nguyên cách hiển thị, nhưng phải đọc từ Tồn kho đã lưu.

**Consequences (testable):**
- Sau khi xác nhận một đơn làm Tồn kho của sản phẩm X về 0, trang `/products/[slug]` của X hiện "Hết hàng". `GET /api/products?inStock=true` không còn trả X. `POST /api/orders` cho X trả 409 `INSUFFICIENT_STOCK`.
- Kịch bản `e2e/shopping-flow.spec.ts` vẫn chạy qua.

#### FR-4: Hợp đồng API và định dạng lỗi giữ nguyên

`GET/POST /api/orders`, `GET /api/orders/:id` và `GET /api/products*` giữ nguyên request và response. Lỗi luôn có dạng `{ "error": { "code", "message", "details?" } }` và đi qua `handleRouteError` / `jsonError` (`src/lib/http.ts`). Trường mới trên Đơn hàng chỉ được **thêm vào**, không đổi tên hay xóa trường cũ.

**Consequences (testable):**
- Mọi test hiện có trong `npm run check` vẫn xanh mà không phải sửa assertion về trường cũ.

### 4.1 Tồn kho lưu bền (MUST)

**Description:** Tồn kho chuyển từ hằng số trong code sang dữ liệu được lưu và cập nhật được, cùng cơ chế lưu file với Đơn hàng (không thêm database). Phần catalog còn lại (tên, giá, mô tả) vẫn tĩnh trong `src/data/products.ts`. Tính năng này là điều kiện tiên quyết của §4.3.

#### FR-5: Hệ thống lưu và đọc Tồn kho bền vững

Hệ thống giữ Tồn kho cho mọi sản phẩm. Lần chạy đầu, khi chưa có dữ liệu Tồn kho, giá trị khởi tạo lấy từ `stock` trong `src/data/products.ts`. Mọi nơi đọc tồn kho (FR-3, Đèn tồn kho) đều đọc cùng một nguồn này.

**Consequences (testable):**
- Khởi động với kho dữ liệu trống thì Tồn kho của từng sản phẩm bằng `stock` khai báo trong `products.ts`.
- Tồn kho sau khi xác nhận hoặc hủy vẫn còn nguyên sau khi khởi động lại server.
- Tồn kho không bao giờ âm.

**Out of Scope:**
- Giao diện nhập hàng hay sửa Tồn kho bằng tay: v1 chưa có; muốn đổi Tồn kho thì chạy `npm run stock:set` (architecture spine AD-16), để Sổ kho và giá trị khởi tạo luôn khớp.

### 4.2 Truy cập của nhân viên (MUST)

**Description:** Khu nhân viên được bảo vệ ở mức tối thiểu, không có hệ thống tài khoản. Danh sách Nhân viên (tên + PIN) nằm trong cấu hình phía server. Mục đích kép: chặn người lạ, và biết **ai** đã thực hiện mỗi Chuyển trạng thái. Realizes UJ-1.

#### FR-6: Nhân viên đăng nhập bằng PIN

Nhân viên có thể nhập PIN để vào Khu nhân viên. Phiên đăng nhập giữ trên thiết bị đó cho tới khi đăng xuất hoặc hết hạn. Phiên hết hạn sau 12 giờ.

**Consequences (testable):**
- PIN sai thì không vào được và không lộ việc PIN đó có thuộc ai hay không.
- Mọi API của Khu nhân viên gọi khi chưa đăng nhập đều trả 401 theo định dạng lỗi chuẩn với mã lỗi mới `UNAUTHORIZED`.
- Không cấu hình Nhân viên nào thì Khu nhân viên từ chối mọi truy cập, không mở tự do.
- PIN không bao giờ xuất hiện trong response, log hay file Đơn hàng.

#### FR-7: Hệ thống ghi Người thao tác cho mọi Chuyển trạng thái

Mỗi Chuyển trạng thái do Nhân viên thực hiện đều lưu tên Nhân viên và Mốc giờ trên Đơn hàng. Khách tự hủy (FR-2) thì Người thao tác ghi là "khách".

**Consequences (testable):**
- Sau khi An xác nhận, Đơn hàng có thông tin Mốc giờ `confirmed` và Người thao tác "An".

### 4.3 Chuyển trạng thái nguyên tử kèm tồn kho (MUST)

**Description:** Trái tim của PRD. Nhân viên đưa Đơn hàng đi theo đúng thứ tự trạng thái. Chuyển trạng thái nào làm đổi hàng thật thì đổi Tồn kho trong **cùng một thao tác nguyên tử**. Realizes UJ-1, UJ-3.

#### FR-8: Bảng chuyển hợp lệ

Nhân viên chỉ có thể thực hiện các Chuyển trạng thái sau. Mọi chuyển khác bị từ chối.

| Từ | Sang | Ai | Tác động Tồn kho |
|---|---|---|---|
| `pending` | `confirmed` | Nhân viên | Trừ đúng số lượng từng dòng (FR-9) |
| `pending` | `cancelled` | Nhân viên hoặc khách (FR-2) | Không đổi |
| `confirmed` | `shipping` | Nhân viên | Không đổi |
| `confirmed` | `cancelled` | Nhân viên | Hoàn đúng số đã trừ (FR-11) |
| `shipping` | `delivered` | Nhân viên | Không đổi |
| `shipping` | `cancelled` | Nhân viên, khi giao thất bại | Hoàn **chỉ khi** Nhân viên xác nhận hàng đã về shop (FR-12) |

**Consequences (testable):**
- `delivered → pending`, `pending → shipping`, `cancelled → *` và `delivered → *` bị từ chối với 409 `INVALID_STATUS_TRANSITION`. Đơn hàng và Tồn kho không đổi.
- Chuyển trạng thái chỉ thành công khi Trạng thái đơn hiện tại đúng bằng trạng thái "Từ" mà yêu cầu nêu ra.

#### FR-9: Xác nhận đơn và trừ Tồn kho trong một thao tác nguyên tử

Nhân viên có thể xác nhận một Đơn hàng `pending` có Đèn tồn kho xanh bằng một chạm. Hệ thống đồng thời chuyển đơn sang `confirmed` và trừ Tồn kho mọi dòng hàng. Hoặc tất cả cùng xảy ra, hoặc không gì xảy ra.

**Consequences (testable):**
- Đơn có 2 dòng (X×2, Y×1), Tồn kho X=5, Y=3. Sau khi xác nhận: X=3, Y=2, đơn `confirmed`.
- Đơn có X×2 nhưng Tồn kho X=1: bị từ chối với 409 `INSUFFICIENT_STOCK`, `details` nêu số lượng thiếu từng dòng. Đơn vẫn `pending`, Tồn kho không đổi.
- Nếu ghi lỗi giữa chừng (ví dụ lỗi đĩa), sau khi khởi động lại không có trạng thái nửa vời (đơn `confirmed` mà kho chưa trừ, hoặc ngược lại).
- Hai đơn `pending` cùng cần món cuối cùng, được xác nhận đồng thời: đúng một đơn thành công, đơn còn lại bị từ chối với `INSUFFICIENT_STOCK`. Tồn kho về 0, không âm.

#### FR-10: Từ chối thao tác lặp và báo ai đã làm

Khi Nhân viên thực hiện một Chuyển trạng thái mà Đơn hàng đã qua bước đó (do người khác hoặc do bấm hai lần), hệ thống từ chối và báo ai đã làm, lúc nào.

**Consequences (testable):**
- An và Hoa cùng gửi xác nhận cho một đơn: một yêu cầu thành công, yêu cầu kia nhận 409 `INVALID_STATUS_TRANSITION` với thông điệp dạng "Đã xác nhận bởi An lúc 08:05". Tồn kho chỉ bị trừ một lần.

#### FR-11: Nhân viên hủy đơn đã xác nhận, kèm lý do, và hoàn Tồn kho

Nhân viên có thể hủy Đơn hàng `pending` hoặc `confirmed`, bắt buộc chọn lý do từ danh sách cố định: Hết hàng, Khách đổi ý, Không liên lạc được khách, Khác (kèm ghi chú). Hủy đơn `confirmed` thì hoàn Tồn kho đúng số đã trừ, trong cùng thao tác nguyên tử. Realizes UJ-3.

**Consequences (testable):**
- Hủy đơn `confirmed` có X×2: Tồn kho X tăng đúng 2.
- Hủy mà không có lý do thì bị từ chối với 400 `VALIDATION_ERROR`.
- Lý do hủy hiển thị trên Trang theo dõi.

**Notes:** Brief nguyên tắc 3 nói "hàng đã đóng gói thì giữ hàng, liên hệ khách rồi mới hoàn kho". Ở v1, `confirmed` được coi là **chưa đóng gói**, nên Nhân viên chỉ hủy sau khi đã xử lý xong ngoài hệ thống. `[NOTE FOR PM]` Xem Open Question 3.

#### FR-12: Giao thất bại chỉ hoàn kho khi hàng đã về shop

Nhân viên có thể hủy Đơn hàng `shipping` với lý do "Giao thất bại", kèm lựa chọn "Hàng đã về shop". Chỉ khi có lựa chọn này Tồn kho mới được hoàn. Nếu hàng chưa về, Nhân viên để đơn ở `shipping` cho tới khi hàng về rồi mới hủy; v1 không có trạng thái trung gian.

**Consequences (testable):**
- Hủy đơn `shipping` khi không chọn "Hàng đã về shop" thì bị từ chối với 400 `VALIDATION_ERROR`. Tồn kho không đổi.
- Chọn "Hàng đã về shop" thì Tồn kho được hoàn đúng số đã trừ.

### 4.4 Hàng đợi nhân viên mobile-first (MUST)

**Description:** Màn hình đầu tiên của Khu nhân viên. Thiết kế cho điện thoại cầm một tay: hành động chính một chạm, hạn chế gõ phím. Realizes UJ-1.

#### FR-13: Nhân viên xem Hàng đợi sắp theo thời gian chờ

Nhân viên có thể xem Hàng đợi gồm các Đơn hàng `pending`, `confirmed`, `shipping`, nhóm theo Trạng thái đơn. Trong mỗi nhóm, đơn chờ lâu nhất ở trạng thái hiện tại nằm trên cùng. Mỗi đơn hiện mã đơn, tên khách, số dòng hàng, tổng tiền và thời gian đã chờ (ví dụ "chờ 11 giờ").

**Consequences (testable):**
- Đơn `pending` lúc 20:00 nằm trên đơn `pending` lúc 21:00.
- Đơn vừa xác nhận rời nhóm `pending` và sang nhóm `confirmed` mà không cần tải lại thủ công. Thay đổi do Nhân viên khác làm thì thấy khi tải lại hoặc làm mới.
- Màn hình dùng được ở chiều rộng 360px, không cuộn ngang.

#### FR-14: Đèn tồn kho trên mỗi đơn *Chờ xác nhận*

Mỗi Đơn hàng `pending` trong Hàng đợi hiện Đèn tồn kho tính theo Tồn kho hiện tại. Đèn đỏ thì nút Xác nhận bị khóa, và từng dòng thiếu ghi "cần N, còn M, thiếu K".

**Consequences (testable):**
- Đơn X×2 với Tồn kho X=2: đèn xanh, nút Xác nhận bật.
- Đơn X×2 với Tồn kho X=1: đèn đỏ, hiện "thiếu 1", nút Xác nhận bị khóa.
- Đèn chỉ là gợi ý hiển thị. Kiểm tra quyết định nằm ở FR-9, nên kể cả khi đèn đã cũ, xác nhận vẫn không thể làm oversell.

#### FR-15: Chỉ hiện hành động hợp lệ

Trên Hàng đợi và trên chi tiết đơn, Nhân viên chỉ thấy các hành động hợp lệ với Trạng thái đơn hiện tại theo FR-8. Hành động chính của mỗi trạng thái cần một chạm: `pending` → "Xác nhận", `confirmed` → "Bắt đầu giao", `shipping` → "Đã giao".

**Consequences (testable):**
- Đơn `delivered` hoặc `cancelled` không có nút chuyển trạng thái nào.
- Hủy đơn (FR-11, FR-12) cần một bước xác nhận và chọn lý do. Hành động không thể hoàn tác thì không được là một chạm.

### 4.5 Trang theo dõi cho khách (MUST)

**Description:** Nâng cấp trang `/orders/[id]` hiện có (`src/app/orders/[id]/page.tsx`). Trang khách và Khu nhân viên đọc **cùng một** bản ghi Đơn hàng. Realizes UJ-2.

#### FR-16: Ba thông tin chính ở màn hình đầu

Khách có thể thấy Ba thông tin chính ngay khi mở Trang theo dõi, không cần cuộn trên màn hình 360px. Danh sách sản phẩm, địa chỉ và chi tiết khác gập lại bên dưới.

**Consequences (testable):**
- **Ngày dự kiến giao** là một khoảng tính từ Mốc giờ `confirmed` cộng số ngày làm việc của phương thức giao (tiêu chuẩn 3–5, nhanh 1–2). Khi đơn còn `pending` thì hiện "Sẽ có sau khi shop xác nhận". Khi `delivered` thì hiện ngày giao thực tế. Khi `cancelled` thì không hiện ngày.
- **Trạng thái thanh toán:** `cod` chưa giao hiện "Thanh toán khi nhận: {tổng}", `cod` đã giao hiện "Đã thanh toán". `bank_transfer` hiện "Chuyển khoản: {tổng}" Hệ thống chưa đối soát chuyển khoản nên không khẳng định "Đã thanh toán" cho `bank_transfer`.
- Tiền định dạng bằng `formatCurrency` hiện có.

#### FR-17: Thanh tiến trình có Mốc giờ thật

Khách có thể thấy thanh tiến trình Chờ xác nhận → Đã xác nhận → Đang giao → Đã giao. Bước đã qua có Mốc giờ thật, bước chưa tới để trống. Đơn `cancelled` hiện bước hủy kèm Mốc giờ và lý do (nếu có), thay cho các bước còn lại.

**Consequences (testable):**
- Đơn `shipping` hiện ba Mốc giờ (đặt, xác nhận, bắt đầu giao), bước "Đã giao" trống.
- Mốc giờ hiển thị bằng `formatDateTime` hiện có.

#### FR-18: Đơn hàng cũ hiển thị an toàn

Đơn hàng tạo trước tính năng này (không có Mốc giờ từng bước, không có Người thao tác) vẫn mở được trên Trang theo dõi và trong Hàng đợi. Mốc giờ đặt lấy từ `createdAt`. Mốc giờ thiếu thì hiện "—", không bịa ra.

**Consequences (testable):**
- Một `orders.json` chỉ có các trường hiện tại vẫn đọc được, không lỗi 500.

**Out of Scope (§4.5):** dải cảnh báo kèm nút khi khách cần hành động. Nó phụ thuộc vào Cờ phụ, nên đi cùng FR-22 (SHOULD).

### 4.6 Lịch sử và Sổ kho (SHOULD)

#### FR-19: Lịch sử trạng thái

Nhân viên có thể xem toàn bộ các lần Chuyển trạng thái của một Đơn hàng: từ, sang, Người thao tác, Mốc giờ, lý do.

**Consequences (testable):** sau khi đi đủ `pending → confirmed → shipping → delivered`, lịch sử có 4 dòng theo đúng thứ tự: dòng tạo đơn (Người thao tác "khách") và 3 lần Chuyển trạng thái.

#### FR-20: Sổ kho

Mỗi lần Tồn kho thay đổi thì ghi một dòng vào Sổ kho: sản phẩm, số lượng thay đổi (âm hoặc dương), mã Đơn hàng, lý do, Người thao tác, thời điểm.

**Consequences (testable):** với mọi sản phẩm, Tồn kho hiện tại = giá trị khởi tạo + tổng thay đổi trong Sổ kho (cơ sở đo SM-2).

### 4.7 Hỗ trợ vận hành (SHOULD)

#### FR-21: Đếm đơn theo trạng thái và danh sách hàng sắp hết

Nhân viên có thể thấy số Đơn hàng theo từng Trạng thái đơn và danh sách sản phẩm có Tồn kho ≤ `LOW_STOCK_THRESHOLD` (5).

**Consequences (testable):**
- Có 3 đơn `pending` và 1 đơn `shipping` thì bộ đếm hiện đúng 3 và 1.
- Sản phẩm có Tồn kho 5 nằm trong danh sách sắp hết; Tồn kho 6 thì không.

#### FR-22: Khách gửi yêu cầu hủy cho đơn đã xác nhận

Khách có thể gửi "yêu cầu hủy" cho Đơn hàng `confirmed`. Hệ thống đặt Cờ phụ `cancelRequested`, Trạng thái đơn giữ nguyên. Nhân viên thấy cờ này trong Hàng đợi và duyệt bằng FR-11 hoặc từ chối. Trang theo dõi hiện dải cảnh báo cho khách biết yêu cầu đang chờ.

**Consequences (testable):** gửi yêu cầu hủy không đổi Trạng thái đơn và không đổi Tồn kho. `PATCH { "status": "cancelled" }` cho đơn `confirmed` vẫn bị từ chối như FR-2.

#### FR-23: Cảnh báo đơn đứng yên

Hàng đợi đánh dấu Đơn hàng ở cùng một trạng thái quá ngưỡng: `pending` quá 24 giờ, `confirmed` quá 24 giờ, `shipping` quá hạn trên của Ngày dự kiến giao.

**Consequences (testable):**
- Đơn `pending` tạo lúc 08:00 hôm qua được đánh dấu lúc 08:01 hôm nay; đơn tạo lúc 09:00 hôm qua thì chưa.
- Đơn `shipping` quá hạn trên của Ngày dự kiến giao được đánh dấu.

**Notes:** Brief muốn khách biết "vì sao bị trễ". v1 chưa hiện lý do trễ cho khách; khi làm FR-23, dải cảnh báo của FR-22 là chỗ đặt thông tin này.

## 5. Non-Goals (Explicit)

- **Không** thông báo chủ động (email, SMS, push, Zalo): không có ngân sách dịch vụ ngoài.
- **Không** thêm database hay dịch vụ lưu trữ ngoài. Đơn hàng và Tồn kho dùng file như hiện tại.
- **Không** thêm Trạng thái đơn mới. Tình huống phụ dùng Cờ phụ.
- **Không** giữ hàng lúc khách đặt. Tồn kho chỉ trừ khi Nhân viên xác nhận.
- **Không** tài khoản hay đăng nhập cho khách. Hệ quả chấp nhận được: `/orders` và `/orders/[id]` vẫn công khai như hiện tại (OQ-1).
- **Không** hàng thay thế, giao từng phần, mã giảm giá bù trễ, app cho shipper, kệ tạm giữ tự hủy.
- **Không** quản trị catalog (giá, sản phẩm) và **không** nhập hàng hay sửa Tồn kho qua giao diện.
- **Không** hỗ trợ chạy nhiều tiến trình server hay scale ngang.

## 6. MVP Scope

### 6.1 In Scope

- §4.0 Hành vi hiện có giữ nguyên (FR-1 đến FR-4).
- §4.1 Tồn kho lưu bền (FR-5).
- §4.2 Đăng nhập PIN và ghi Người thao tác (FR-6, FR-7).
- §4.3 Bảng chuyển hợp lệ, xác nhận kèm trừ kho nguyên tử, từ chối lặp, hủy kèm lý do và hoàn kho, giao thất bại (FR-8 đến FR-12).
- §4.4 Hàng đợi, Đèn tồn kho, chỉ hiện hành động hợp lệ (FR-13 đến FR-15).
- §4.5 Ba thông tin chính, thanh tiến trình, đơn cũ (FR-16 đến FR-18).

### 6.2 Out of Scope for MVP

- **SHOULD, làm nếu kịp:** FR-19 Lịch sử, FR-20 Sổ kho, FR-21 Đếm đơn và hàng sắp hết, FR-22 Yêu cầu hủy (kèm dải cảnh báo), FR-23 Cảnh báo đứng yên. `[NOTE FOR PM]` FR-20 Sổ kho là cách đo SM-2 rẻ nhất. Nếu không làm, SM-2 phải đo bằng cách đối chiếu thủ công.
- **COULD (v2):** xác nhận hàng loạt, hoàn tác trong 10 giây, in phiếu giao, thống kê lý do hủy, doanh thu tách phần đã thu và phần đang treo, hiển thị "Còn 3, 2 đang trong đơn chờ xác nhận".
- **WON'T:** xem §5.

## 7. Success Metrics

**Primary**
- **SM-1: Oversell bằng 0.** Số Đơn hàng được xác nhận khi Tồn kho không đủ. Mục tiêu **0**, kể cả khi xác nhận đồng thời. Đo bằng test tương tranh tự động cho FR-9 và FR-10, cộng kiểm tra "Tồn kho không âm" trên dữ liệu thật. Validates FR-5, FR-9, FR-10.
- **SM-2: Tồn kho khớp.** Với mọi sản phẩm, Tồn kho = khởi tạo − đã xác nhận + đã hoàn. Mục tiêu **luôn khớp**. Đo bằng Sổ kho (FR-20) nếu có, nếu không thì bằng script đối chiếu từ `orders.json`. Validates FR-9, FR-11, FR-12.

**Secondary**
- **SM-3: Xác nhận nhanh.** Một đơn đèn xanh từ lúc mở Hàng đợi tới lúc xác nhận: **1 chạm, dưới 10 giây**. Đo bằng kịch bản E2E và quan sát thủ công trên điện thoại. Validates FR-13, FR-14, FR-15.
- **SM-4: Không đơn bị bỏ quên.** Số Đơn hàng ở `pending` quá 24 giờ. Mục tiêu **0**. Đo bằng Mốc giờ trong `orders.json`. Validates FR-13, FR-23.
- **SM-5: Khách hiểu ngay.** Ba thông tin chính nằm trong màn hình đầu ở 360px với mọi Trạng thái đơn. Mục tiêu **100% trạng thái**. Đo bằng E2E ở viewport 360px. Validates FR-16, FR-17.
- **SM-6: Không phá hành vi cũ.** `npm run check` và `npm run test:e2e` xanh. Validates FR-1 đến FR-4.

**Counter-metrics (do not optimize)**
- **SM-C1: Tỉ lệ đơn bị hủy vì hết hàng.** Không được kéo SM-1 về 0 bằng cách khóa bán quá tay (ví dụ ẩn sản phẩm còn ít hàng, hay hạ Tồn kho khởi tạo). Tỉ lệ này cần được theo dõi; nếu tăng thì là dấu hiệu nên làm hiển thị "đang trong đơn chờ" (COULD). Counterbalances SM-1.
- **SM-C2: Số lần hủy nhầm.** Không được tối ưu SM-3 (một chạm) bằng cách bỏ bước xác nhận của các hành động không hoàn tác được như hủy đơn. Counterbalances SM-3.

## 8. Open Questions

1. ~~**Truy cập Trang theo dõi và quyền riêng tư**~~ **Đã chốt (2026-11-21):** giữ nguyên `/orders` và `/orders/[id]` công khai như hiện tại. Rủi ro được chấp nhận ở v1: ai biết mã đơn hoặc mở `/orders` đều thấy tên, số điện thoại, địa chỉ khách. Xem lại khi có tài khoản khách.
2. ~~**Thanh toán chuyển khoản**~~ **Đã chốt (2026-11-21):** v1 không có hành động "Đã nhận tiền"; `bank_transfer` luôn hiện "Chuyển khoản: {tổng}", không khẳng định đã thanh toán. Xem lại khi có đối soát chuyển khoản. (FR-16.)
3. ~~**"Đã đóng gói"**~~ **Đã chốt (2026-11-21):** v1 không thêm Cờ phụ `packed`; `confirmed` được coi là chưa đóng gói, Nhân viên liên hệ khách ngoài hệ thống rồi mới hủy. (FR-11.)
4. ~~**Ngày làm việc**~~ **Đã chốt (2026-11-21):** ngày làm việc là T2–T6, không tính thứ Bảy, Chủ nhật và chưa tính ngày lễ ở v1; đếm từ ngày làm việc kế tiếp sau Mốc `confirmed` (spine AD-12). (FR-16.)
6. ~~**Chống dò PIN**~~ **Đã chốt bởi Architect (spine AD-14):** PIN 6–8 số, kiểm tuần tự với trễ lũy tiến tối đa 30 giây, hàng chờ tối đa 5, không khóa cứng. (FR-6.)
5. ~~**Hai tab, một nhân viên**~~ **Đã chốt bởi Architect (spine AD-18):** không tự làm mới định kỳ; làm mới sau mỗi phản hồi và bằng nút làm mới. (FR-13.)

## 9. Assumptions Index

Mọi `[ASSUMPTION]` của bản nháp đã được user xác nhận ngày 2026-11-21 và chuyển thành nội dung chính thức. Không còn giả định mở. Danh sách đã xác nhận:

- §2.3: UJ-1, UJ-2, UJ-3 do agent dựng từ brief; cần user kể lại hoặc xác nhận.
- §4.1 FR-5: v1 chưa có giao diện nhập hàng hay sửa Tồn kho.
- §4.2 FR-6: phiên đăng nhập hết hạn sau 12 giờ; mã lỗi mới `UNAUTHORIZED` (401).
- §4.3 FR-11: danh sách lý do hủy cố định gồm 4 mục.
- §4.3 FR-12: hàng chưa về thì đơn ở `shipping`; hủy `shipping` bắt buộc chọn "Hàng đã về shop".
- §4.4 FR-13: Hàng đợi tự cập nhật sau thao tác của chính mình; thay đổi của người khác thấy khi làm mới.
- §4.5 FR-16: đơn `pending` hiện "Sẽ có sau khi shop xác nhận"; `bank_transfer` không hiện "Đã thanh toán".
- §4.7 FR-23: ngưỡng đứng yên 24 giờ cho `pending` và `confirmed`.
- §8 OQ-1: (đã chốt) giữ nguyên cách `/orders` và `/orders/[id]` công khai như hiện tại.
