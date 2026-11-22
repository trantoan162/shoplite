# Tiêu chí chấp nhận theo Capability

Tiêu chí kiểm thử được của từng `CAP-N` (= PRD `FR-N`). Cách hiện thực: xem `ARCHITECTURE-SPINE.md` (mã AD trong ngoặc).

## Bảng chuyển hợp lệ (CAP-8, AD-7)

| Từ | Sang | Ai | Tác động Tồn kho |
|---|---|---|---|
| `pending` | `confirmed` | Nhân viên | Trừ đúng số lượng từng dòng (CAP-9) |
| `pending` | `cancelled` | Nhân viên hoặc khách (CAP-2) | Không đổi |
| `confirmed` | `shipping` | Nhân viên | Không đổi |
| `confirmed` | `cancelled` | Nhân viên | Hoàn đúng số đã trừ (CAP-11) |
| `shipping` | `delivered` | Nhân viên | Không đổi |
| `shipping` | `cancelled` | Nhân viên, khi giao thất bại | Hoàn **chỉ khi** xác nhận hàng đã về shop (CAP-12) |

Mọi chuyển khác bị từ chối: 409 `INVALID_STATUS_TRANSITION`, đơn và kho không đổi.

**Lý do hủy cố định (CAP-11, CAP-12):** Hết hàng, Khách đổi ý, Không liên lạc được khách, Khác (bắt buộc ghi chú) cho đơn `pending`/`confirmed`. Riêng hủy `shipping` dùng lý do "Giao thất bại" và bắt buộc chọn "Hàng đã về shop". Hủy đơn `pending` hay `confirmed` mà không có lý do thì trả 400 `VALIDATION_ERROR`.

## MUST: giữ nguyên

- **CAP-1** (Conventions/Giá)
  - `POST /api/orders` kèm trường giá trong `items` vẫn tạo đơn bằng `unitPrice` của catalog. `subtotal`, `shippingFee` và `total` tính bằng `calculateOrderTotals`.
  - Phí giao tiêu chuẩn 30.000 ₫, bằng 0 khi `subtotal ≥ 500.000 ₫`. Giao nhanh 60.000 ₫.
- **CAP-2** (AD-8, AD-11)
  - Đơn `confirmed`, `shipping`, `delivered` hoặc `cancelled` trả 409 `INVALID_STATUS_TRANSITION`.
  - Body khác `{ "status": "cancelled" }` trả 400 `VALIDATION_ERROR`.
  - `CancelOrderButton` chỉ hiện khi đơn `pending`. Hủy đơn `pending` không đổi Tồn kho.
- **CAP-3** (AD-9)
  - Lúc đặt, dòng có `quantity` > Tồn kho trả 409 `INSUFFICIENT_STOCK`, thông điệp giữ nguyên. Đặt hàng không trừ kho.
  - Giỏ hàng giới hạn 10 sản phẩm mỗi loại và không vượt Tồn kho (`getMaxQuantity`).
  - `StockBadge` ("Còn hàng / Chỉ còn N sản phẩm / Hết hàng", `LOW_STOCK_THRESHOLD = 5`) và bộ lọc `inStock` giữ cách hiển thị, nhưng đọc Tồn kho lưu bền.
  - Xác nhận làm X về 0 thì `/products/[slug]` của X hiện "Hết hàng", `GET /api/products?inStock=true` không trả X, `POST /api/orders` cho X trả 409.
  - `e2e/shopping-flow.spec.ts` vẫn qua.
- **CAP-4** (AD-10, AD-11, AD-17)
  - `GET/POST /api/orders`, `GET /api/orders/:id` và `GET /api/products*` giữ nguyên request và response.
  - Mọi lỗi đi qua `handleRouteError`/`jsonError`.
  - Không đổi tên hay xóa trường cũ.

## MUST: mới

- **CAP-5** (AD-3, AD-9, AD-15, AD-16)
  - Khởi động khi chưa có dữ liệu thì Tồn kho từng sản phẩm = `stock` trong `products.ts`.
  - Tồn kho còn nguyên sau restart. Tồn kho không bao giờ âm.
- **CAP-6** (AD-13, AD-14)
  - PIN sai không vào được và không lộ PIN có thuộc ai. Mọi API staff khi chưa đăng nhập trả 401 `UNAUTHORIZED` theo định dạng lỗi chuẩn.
  - Không cấu hình Nhân viên thì từ chối mọi truy cập. PIN không có trong response, log hay file.
  - Phiên hết hạn sau 12 giờ.
- **CAP-7** (AD-10, AD-13)
  - An xác nhận thì đơn có Mốc giờ `confirmed`, Người thao tác "An". Khách tự hủy thì Người thao tác là "khách".
  - Actor lấy từ phiên, không lấy từ body.
- **CAP-8** (AD-7)
  - `delivered → pending`, `pending → shipping`, `cancelled → *`, `delivered → *` trả 409 và không đổi gì.
  - Chuyển chỉ thành công khi trạng thái hiện tại = `from` của yêu cầu.
- **CAP-9** (AD-3..AD-7)
  - Đơn X×2, Y×1 với kho X=5, Y=3: sau xác nhận X=3, Y=2, đơn `confirmed`.
  - Đơn X×2 với kho X=1: 409 `INSUFFICIENT_STOCK`, `details` nêu số thiếu từng dòng; đơn vẫn `pending`, kho không đổi.
  - Lỗi ghi giữa chừng: sau restart không có đơn `confirmed` mà kho chưa trừ, hay ngược lại. Kiểm bằng điểm chèn lỗi AD-6.
  - Hai đơn `pending` tranh món cuối, xác nhận đồng thời: đúng một đơn thành công, đơn kia 409 `INSUFFICIENT_STOCK`; kho = 0.
- **CAP-10** (AD-7, AD-12)
  - An và Hoa cùng xác nhận: một yêu cầu thành công, yêu cầu kia 409 `INVALID_STATUS_TRANSITION` với "Đã xác nhận bởi An lúc 08:05"; kho trừ một lần.
  - Bấm hai lần cũng xử lý như vậy.
- **CAP-11** (AD-7, AD-17)
  - Hủy đơn `confirmed` X×2: X tăng đúng 2, trong cùng thao tác nguyên tử.
  - Thiếu lý do trả 400 `VALIDATION_ERROR`. Lý do hiện trên Trang theo dõi.
- **CAP-12** (AD-7, AD-17)
  - Hủy `shipping` không chọn "Hàng đã về shop" trả 400 `VALIDATION_ERROR`, kho không đổi. Có lựa chọn này thì hoàn đúng số đã trừ.
  - Hàng chưa về thì đơn ở lại `shipping`; không có trạng thái trung gian.
- **CAP-13** (AD-18)
  - Hàng đợi nhóm theo trạng thái; trong nhóm, đơn chờ lâu nhất ở trạng thái hiện tại lên đầu. Đơn `pending` 20:00 nằm trên đơn `pending` 21:00.
  - Mỗi thẻ hiện mã đơn, tên khách, số dòng hàng, tổng tiền, thời gian chờ ("chờ 11 giờ").
  - Đơn vừa xác nhận chuyển sang nhóm `confirmed` mà không cần tải lại thủ công. Thay đổi của Nhân viên khác thấy khi tải lại hoặc bấm làm mới (OQ-5 chốt: không polling).
  - Ở 360px không cuộn ngang.
- **CAP-14** (AD-9)
  - X×2, kho 2: đèn xanh, nút bật. X×2, kho 1: đèn đỏ, "cần 2, còn 1, thiếu 1", nút khóa.
  - Đèn cũ không gây oversell, vì CAP-9 quyết định.
- **CAP-15** (AD-7, AD-18)
  - Đơn `delivered`/`cancelled` không có nút chuyển trạng thái.
  - Hành động chính một chạm: `pending` "Xác nhận", `confirmed` "Bắt đầu giao", `shipping` "Đã giao".
  - Hủy cần bước xác nhận và chọn lý do.
- **CAP-16** (AD-11, AD-12)
  - Ba thông tin chính hiện không cần cuộn ở 360px. Danh sách sản phẩm, địa chỉ và chi tiết khác gập bên dưới.
  - **Ngày dự kiến giao** là một khoảng tính từ Mốc giờ `confirmed` cộng số ngày làm việc: tiêu chuẩn 3–5, nhanh 1–2 (`minDays`/`maxDays` trong `SHIPPING_OPTIONS`).
    - `pending`: "Sẽ có sau khi shop xác nhận".
    - `delivered`: ngày giao thực tế.
    - `cancelled`: ẩn.
    - Thiếu mốc `confirmed` (đơn cũ): "—".
    - Ví dụ: confirmed T7 21/11/2026 → tiêu chuẩn 25–27/11, nhanh 23–24/11.
  - **Trạng thái thanh toán:**
    - `cod` chưa giao: "Thanh toán khi nhận: ‹tổng›"; `cod` đã giao: "Đã thanh toán".
    - `bank_transfer`: "Chuyển khoản: ‹tổng›", không bao giờ ghi "Đã thanh toán".
    - Đơn hủy (AD-12): `cod` → "Đơn đã hủy, không cần thanh toán"; `bank_transfer` → "Chuyển khoản: ‹tổng› · liên hệ shop nếu đã chuyển".
  - Tiền định dạng bằng `formatCurrency`.
- **CAP-17** (AD-10, AD-12)
  - Đơn `shipping` hiện 3 mốc (đặt, xác nhận, bắt đầu giao); "Đã giao" trống.
  - Đơn `cancelled` hiện bước hủy kèm mốc và lý do, thay cho các bước còn lại.
  - Mốc định dạng bằng `formatDateTime`. Trang khách không hiện tên Nhân viên (AD-11).
- **CAP-18** (AD-10, AD-15)
  - `orders.json` chỉ có trường hiện tại vẫn đọc được, không 500, cả trên Trang theo dõi lẫn Hàng đợi.
  - Mốc đặt = `createdAt`; mốc thiếu hiện "—".

## SHOULD

- **CAP-19** (AD-10)
  - Lịch sử ghi từ, sang, Người thao tác, Mốc giờ, lý do.
  - Đi đủ 4 bước thì có 4 dòng theo thứ tự: tạo đơn ("khách") + 3 lần chuyển.
- **CAP-20** (AD-3, AD-9, AD-16)
  - Mỗi dòng sổ ghi: sản phẩm, số lượng thay đổi (±), mã đơn, lý do, Người thao tác, thời điểm.
  - Tồn kho = khởi tạo + tổng thay đổi trong sổ. Đây là cơ sở đo SM-2.
- **CAP-21** (AD-9)
  - 3 đơn `pending` + 1 đơn `shipping` → bộ đếm 3 và 1.
  - Kho 5 nằm trong danh sách sắp hết; kho 6 thì không.
- **CAP-22** (AD-4, AD-8, AD-10)
  - Đặt cờ `cancelRequested`; trạng thái và kho không đổi. Nhân viên thấy cờ trong Hàng đợi, rồi duyệt qua CAP-11 hoặc từ chối.
  - Trang theo dõi hiện dải cảnh báo đang chờ. `PATCH {status:"cancelled"}` cho đơn `confirmed` vẫn 409.
  - Dải cảnh báo là chỗ đặt lý do trễ khi làm CAP-23.
- **CAP-23** (AD-12)
  - Đơn `pending` tạo 08:00 hôm qua bị đánh dấu lúc 08:01 hôm nay; đơn 09:00 hôm qua thì chưa.
  - Đơn `shipping` sau 23:59 ngày cuối của khoảng dự kiến giao thì bị đánh dấu.
