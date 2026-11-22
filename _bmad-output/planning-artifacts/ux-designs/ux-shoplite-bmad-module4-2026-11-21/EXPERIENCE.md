---
name: ShopLite: Vận hành đơn hàng
status: final
created: 2026-11-21
updated: 2026-11-21
sources:
  - _bmad-output/planning-artifacts/prds/prd-shoplite-bmad-module4-2026-11-21/prd.md
  - _bmad-output/planning-artifacts/prds/prd-shoplite-bmad-module4-2026-11-21/addendum.md
---

# ShopLite: Experience Spine (Vận hành đơn hàng)

## Foundation

- **Dạng sản phẩm:** web responsive (Next.js 16 App Router). Thiết kế cho **390px trước**, desktop dùng cùng bố cục một cột.
- **UI system:** design system ngầm định trong code (Tailwind v4 + `src/components/ui/*`), không có thư viện ngoài. Giao diện xem `DESIGN.md`. File này chỉ mô tả hành vi.
- **Brownfield:** các trang cửa hàng (`/`, `/products`, `/cart`, `/checkout`, `/orders`) giữ nguyên. Chỉ `/orders/[id]` được nâng cấp thành **Trang theo dõi**.
- **Hai vai trò:** **Nhân viên**, đăng nhập bằng PIN, dùng Khu nhân viên có khung riêng; **khách**, không đăng nhập, dùng Trang theo dõi. Thuật ngữ theo Glossary của PRD §3.
- **Một nguồn sự thật:** Hàng đợi và Trang theo dõi đọc cùng một bản ghi Đơn hàng. Không có màn hình nào giữ bản sao dữ liệu riêng.

## Information Architecture

| Bề mặt | Đường dẫn | Tới từ | Mục đích | FR |
|---|---|---|---|---|
| Đăng nhập nhân viên | `/staff/login` | Gõ URL hoặc bookmark; bị chuyển về đây khi chưa đăng nhập | Nhập PIN | FR-6 |
| Hàng đợi | `/staff` | Sau khi đăng nhập; logo ở Staff header | Các nhóm Chờ xác nhận → Đã xác nhận → Đang giao, xếp dọc trên một trang | FR-13, FR-14, FR-15 |
| Chi tiết đơn (nhân viên) | `/staff/orders/[id]` | Chạm vào thân thẻ đơn trong Hàng đợi | Toàn bộ dòng hàng, khách, địa chỉ, Mốc giờ, các hành động hợp lệ, hủy kèm lý do | FR-8 → FR-12, FR-15 |
| Trang theo dõi (khách) | `/orders/[id]` (hiện có, nâng cấp) | `/orders`, chuyển tới sau khi đặt (`?placed=1`), link đã lưu | Ba thông tin chính, thanh tiến trình, chi tiết gập lại | FR-2, FR-16 → FR-18 |
| Danh sách đơn (khách) | `/orders` (hiện có, **giữ nguyên**) | Header cửa hàng | Không đổi (PRD OQ-1 đã chốt) | FR-4 |

- Khu nhân viên **không** có link từ cửa hàng, và cửa hàng không hiện link sang Khu nhân viên.
- Khu nhân viên có khung riêng: Staff header thay cho Header và Footer của cửa hàng.
- Không có modal chồng modal. Hủy đơn dùng hộp xác nhận inline (mẫu của `CancelOrderButton`), không dùng dialog.

→ Mockup tham chiếu (390px, mỗi file có 2 trạng thái):
- [`mockups/key-staff-queue.html`](mockups/key-staff-queue.html): Hàng đợi (đủ hàng / thiếu hàng / nhóm rỗng) và xung đột + đang gửi. Minh họa Flow 1.
- [`mockups/key-staff-order-detail.html`](mockups/key-staff-order-detail.html): Chi tiết đơn nhân viên với hộp hủy (`confirmed`) và giao thất bại (`shipping`). Minh họa Flow 3.
- [`mockups/key-customer-tracking.html`](mockups/key-customer-tracking.html): Trang theo dõi `shipping` và `cancelled` có đơn cũ thiếu Mốc giờ. Minh họa Flow 2.
- **Chỉ có spine, không có mockup:** Đăng nhập nhân viên (PIN form). Bố cục đơn giản, build theo `DESIGN.md.Components` → PIN form.

Nếu mockup và spine mâu thuẫn, spine thắng.

## Voice and Tone

Tiếng Việt, ngắn, động từ trước. Nhân viên đang đứng ở kho, cần đọc lướt.

| Nên | Không nên |
|---|---|
| "Xác nhận" · "Bắt đầu giao" · "Đã giao" | "Chuyển sang trạng thái Đã xác nhận" |
| "Chờ 11 giờ" | "Đơn này đã được tạo cách đây 11 giờ 3 phút" |
| "Micro thu âm: cần 2, còn 1, thiếu 1" | "Không đủ tồn kho cho đơn hàng" |
| "Đã xác nhận bởi An lúc 08:05" | "Lỗi 409: INVALID_STATUS_TRANSITION" |
| "Không còn đơn cần xử lý" | "Danh sách trống!" |
| Khách: "Dự kiến giao: 25–27/11" | "ETA: 3–5 business days" |
| Khách: "Thanh toán khi nhận: 1.250.000 ₫" | "COD – chưa thanh toán" |

- Mã lỗi kỹ thuật không bao giờ hiện cho người dùng. Hiện `error.message` của API, vốn đã viết bằng tiếng Việt.
- Nhãn trạng thái luôn lấy từ `ORDER_STATUS_LABELS`, không tự đặt nhãn khác.

## Component Patterns

Chỉ mô tả hành vi. Giao diện xem `DESIGN.md.Components`.

| Component | Dùng ở | Quy tắc hành vi |
|---|---|---|
| Queue order card | Hàng đợi | Chạm vào thân thẻ mở Chi tiết đơn. Nút hành động chính ở cuối thẻ thực hiện Chuyển trạng thái trong một chạm, không hỏi lại (FR-15). Sau khi thành công, thẻ chuyển sang nhóm kế tiếp. Nút chỉ hiện hành động hợp lệ với Trạng thái đơn hiện tại. |
| Stock light | Thẻ và chi tiết của đơn `pending` | Tính theo Tồn kho lúc tải trang. Khi đèn đỏ, nút Xác nhận bị disabled và từng dòng thiếu được liệt kê. Đèn chỉ là gợi ý; server mới là nơi quyết định (FR-9), nên đèn cũ vẫn an toàn. |
| Queue group header | Hàng đợi | Ba nhóm cố định theo thứ tự Chờ xác nhận → Đã xác nhận → Đang giao. Trong mỗi nhóm, đơn chờ lâu nhất lên đầu (FR-13). Nhóm rỗng vẫn hiện tiêu đề kèm số "0" và một dòng "Không có đơn". Tiêu đề nhóm dính trên cùng khi cuộn. |
| Nút làm mới | Staff header | Icon `RefreshCw`, tải lại Hàng đợi để thấy thay đổi do Nhân viên khác làm. Không tự làm mới (PRD OQ-5 đã chốt, spine AD-18). |
| Cancel sheet (inline) | Chi tiết đơn (nhân viên) | Nút secondary "Hủy đơn" mở hộp `bg-rose-50` ngay tại chỗ. Bắt buộc chọn một trong 4 lý do; chọn "Khác" thì hiện ô ghi chú bắt buộc. Với đơn `shipping`, chỉ có lý do "Giao thất bại" và một checkbox bắt buộc "Hàng đã về shop" (FR-12). Nút "Xác nhận hủy" disabled cho tới khi nhập đủ. |
| Conflict notice | Thẻ hoặc chi tiết vừa bị từ chối | Hiện ngay trên thẻ, kèm thông điệp từ server ("Đã xác nhận bởi An lúc 08:05"). Thẻ được cập nhật sang trạng thái mới, notice tự ẩn sau khi cuộn hoặc làm mới. |
| PIN form | Đăng nhập | Bàn phím số trên mobile. Enter để gửi. PIN sai thì ô nhập được xóa, focus quay lại ô, hiện "PIN không đúng". Thông báo không cho biết PIN đó có thuộc ai hay không. |
| Key info card | Trang theo dõi | Ba dòng cố định theo thứ tự: Trạng thái, Dự kiến giao, Thanh toán. Không có hành động trong card. |
| Progress stepper | Trang theo dõi, Chi tiết đơn (nhân viên) | Chỉ để đọc. Bước thiếu Mốc giờ (đơn cũ) hiện "—" (FR-18). Ở Chi tiết đơn (nhân viên), mỗi bước ghi thêm Người thao tác ("21/11 08:05 · bởi An", FR-7). Trang theo dõi của khách **không** hiện tên Nhân viên. |
| Phần gập "Chi tiết đơn hàng" | Trang theo dõi | Dùng `<details>`, đóng mặc định. Bên trong là các mục hiện có: Sản phẩm, Giao tới, Thanh toán và vận chuyển. |
| Alert strip | Trang theo dõi (SHOULD, FR-22), Hàng đợi (SHOULD, FR-23) | Chỉ hiện khi khách hoặc Nhân viên cần hành động. Tối đa một dải mỗi bề mặt. |

## State Patterns

| Trạng thái | Bề mặt | Cách xử lý |
|---|---|---|
| Đang tải | Hàng đợi, Chi tiết | Skeleton hiện có (`animate-pulse rounded-2xl bg-slate-200/60`), 3 thẻ. |
| Hàng đợi rỗng toàn bộ | Hàng đợi | `EmptyState` emoji "✅", "Không còn đơn cần xử lý", mô tả "Đơn mới sẽ hiện ở đây.", không có nút. |
| Nhóm rỗng | Hàng đợi | Tiêu đề nhóm + "0" + dòng `text-sm` slate-500 "Không có đơn". |
| Đèn đỏ | Thẻ và chi tiết đơn `pending` | Nút Xác nhận disabled, kèm dòng giải thích bên dưới "Không đủ hàng để xác nhận". Nút Hủy vẫn dùng được. |
| Đang gửi | Mọi nút chuyển trạng thái | Nút disabled, nhãn đổi thành "Đang xác nhận…" (theo mẫu "Đang hủy…" hiện có). Các nút khác trên thẻ cũng disabled. |
| Xung đột (409 `INVALID_STATUS_TRANSITION`) | Thẻ, Chi tiết | Conflict notice với thông điệp server, rồi thẻ cập nhật theo trạng thái mới. |
| Thiếu hàng lúc xác nhận (409 `INSUFFICIENT_STOCK`) | Thẻ, Chi tiết | Đèn chuyển đỏ kèm số thiếu lấy từ `details`, nút bị khóa. |
| Lỗi mạng hoặc 500 | Mọi bề mặt | Dòng `text-rose-700` dưới nút: "Không thực hiện được, vui lòng thử lại". Dữ liệu không đổi, nút bật lại. |
| Hết phiên (401) | Khu nhân viên | Chuyển về `/staff/login`, hiện "Phiên đã hết hạn, vui lòng nhập lại PIN". Đăng nhập xong quay lại trang trước đó. |
| Đơn `delivered` hoặc `cancelled` | Chi tiết (nhân viên) | Không có nút chuyển trạng thái nào. Thanh tiến trình là trạng thái cuối. |
| Đơn `pending` | Trang theo dõi | Dự kiến giao: "Sẽ có sau khi shop xác nhận". Nút "Hủy đơn hàng" hiện có giữ nguyên (FR-2). |
| Đơn `cancelled` | Trang theo dõi | Dòng Dự kiến giao bị ẩn. Thanh tiến trình kết thúc ở bước "Đã hủy" kèm lý do. |
| Đơn cũ thiếu Mốc giờ | Trang theo dõi, Chi tiết | Hiện "—" ở bước thiếu giờ, không bịa thời gian (FR-18). |
| Không tìm thấy đơn | Trang theo dõi, Chi tiết | `notFound()` hiện có. |
| Vừa đặt xong (`?placed=1`) | Trang theo dõi | Banner emerald "Đặt hàng thành công!" hiện có giữ nguyên, nằm trên Key info card. |

## Interaction Primitives

- **Chạm là chính.** Mọi vùng chạm cao ít nhất 44px. Nút hành động chính trên thẻ là `lg` (48px) rộng hết thẻ, nằm trong vùng ngón cái chạm tới (cuối thẻ).
- **Một chạm cho hành động đi tiếp** (Xác nhận, Bắt đầu giao, Đã giao). **Hai bước cho hành động không hoàn tác được** (Hủy đơn): mở hộp, chọn lý do, rồi xác nhận. Đây là cách giữ chỉ số SM-C2.
- **Cập nhật sau khi server trả về**, không cập nhật trước (không optimistic). Thao tác có tác động lên Tồn kho nên giao diện chỉ đổi khi server đã xác nhận.
- **Bàn phím (desktop):** Tab theo thứ tự đọc, Enter kích hoạt nút đang focus. Không có phím tắt riêng ở v1.
- **Cấm:** vuốt để xác nhận hoặc hủy, kéo thả, thao tác chỉ có khi hover, cuộn vô hạn.

## Accessibility Floor

Mục này về hành vi. Độ tương phản màu xem `DESIGN.md`; mọi cặp màu đều lấy từ cặp nền/chữ Tailwind đang dùng trong code.

- WCAG 2.2 AA.
- **Không phân biệt chỉ bằng màu:** Đèn tồn kho luôn có icon và chữ ("Đủ hàng" / "Thiếu hàng"); badge trạng thái luôn có nhãn chữ; bước trên thanh tiến trình có chữ và giờ.
- **Form có label:** ô PIN có `<label>` "Mã PIN"; radio lý do hủy là `<fieldset>` + `<legend>` "Lý do hủy"; checkbox "Hàng đã về shop" có label bấm được.
- **Focus nhìn thấy được:** dùng `focus-visible:outline-2 outline-offset-2` hiện có. Header tối dùng outline trắng.
- Nút disabled vì đèn đỏ có `aria-describedby` trỏ tới dòng giải thích thiếu hàng.
- Conflict notice và thông báo lỗi dùng `role="status"` (lịch sự). Lỗi PIN dùng `role="alert"`.
- Thanh tiến trình là `<ol>`; bước hiện tại có `aria-current="step"`.
- Sau khi thẻ chuyển nhóm, focus chuyển sang thẻ kế tiếp trong nhóm cũ, nếu nhóm cũ không còn thẻ thì sang tiêu đề nhóm.

## Responsive & Platform

| Breakpoint | Hành vi |
|---|---|
| < 640px (thiết kế cho 390px) | Một cột, `px-4`. Staff header 3.5rem. Ba thông tin chính và thanh tiến trình nằm trong màn hình đầu. |
| ≥ 640px | Vẫn một cột, `max-w-2xl` căn giữa (Khu nhân viên) hoặc `max-w-4xl` (Trang theo dõi, như hiện tại). Không đổi sang bảng. |

## Key Flows

Nhân vật và tình tiết lấy theo đúng UJ trong PRD §2.3.

### Flow 1: Chị Hoa xử lý hàng đợi buổi sáng (UJ-1)

1. 8h sáng chị Hoa mở bookmark `/staff` trên điện thoại. Chưa có phiên nên bị chuyển tới `/staff/login`.
2. Chị nhập PIN và chạm "Vào Hàng đợi". Màn hình hiện Hàng đợi, nhóm **Chờ xác nhận (12)** ở trên cùng, đơn "Chờ 11 giờ" đứng đầu.
3. Thẻ đầu có Đèn tồn kho **Đủ hàng**. Chị chạm "Xác nhận"; nút chuyển thành "Đang xác nhận…", rồi thẻ chuyển xuống nhóm Đã xác nhận, số đếm thành (11).
4. Tới một thẻ có đèn **Thiếu hàng**: "Micro thu âm: cần 2, còn 1, thiếu 1", nút Xác nhận bị khóa. Chị chạm vào thẻ để mở chi tiết, gọi cho khách, rồi chạm "Hủy đơn", chọn "Hết hàng" và "Xác nhận hủy".
5. **Cao trào:** chưa đầy 10 phút sau, nhóm Chờ xác nhận hiện **(0) Không có đơn**. Chị biết không còn ai phải chờ.

**Trường hợp lỗi:** anh An cũng vừa xác nhận cùng một đơn. Thẻ của chị Hoa hiện Conflict notice "Đã xác nhận bởi An lúc 08:05" rồi tự chuyển sang nhóm Đã xác nhận. Tồn kho chỉ bị trừ một lần.

### Flow 2: Anh Minh theo dõi đơn bàn phím (UJ-2)

1. Anh Minh mở `/orders/[id]` từ lịch sử trình duyệt.
2. Màn hình đầu ở 390px: Key info card ghi **Đang giao**, **Dự kiến giao: 25–27/11**, **Thanh toán khi nhận: 1.250.000 ₫**.
3. Ngay bên dưới là thanh tiến trình: Chờ xác nhận 20/11 21:40 → Đã xác nhận 21/11 08:05 → Đang giao 21/11 15:30 → Đã giao (trống).
4. **Cao trào:** không cần cuộn, anh biết hôm nay hàng chưa tới và cần chuẩn bị 1.250.000 ₫ tiền mặt.

**Trường hợp lỗi:** anh muốn hủy, nhưng đơn đã qua Chờ xác nhận nên không có nút hủy. Ở v1 anh không có hành động nào trên trang. Yêu cầu hủy là FR-22 (SHOULD), khi làm sẽ dùng Alert strip.

### Flow 3: Chủ shop hủy đơn đã xác nhận (UJ-3)

1. Chủ shop mở một thẻ trong nhóm Đã xác nhận, vào Chi tiết đơn.
2. Chạm "Hủy đơn". Hộp hủy inline mở ra, chọn "Khách đổi ý", nút "Xác nhận hủy" bật lên.
3. Chạm "Xác nhận hủy" → "Đang hủy…" → thanh tiến trình kết thúc ở bước **Đã hủy** kèm Mốc giờ và lý do. Các nút chuyển trạng thái biến mất.
4. **Cao trào:** quay lại Hàng đợi, đơn đã không còn trong danh sách. Trang theo dõi của khách cũng hiện "Đã hủy · Khách đổi ý".

**Trường hợp lỗi:** đơn đang `shipping` nhưng giao thất bại. Hộp hủy chỉ có lý do "Giao thất bại" và checkbox bắt buộc "Hàng đã về shop". Chưa tick thì nút "Xác nhận hủy" không bật.

## Quyết định đã xác nhận (2026-11-21)

- Đường dẫn `/staff/login`, `/staff`, `/staff/orders/[id]` (IA).
- Staff header nền `slate-900` để tách Khu nhân viên khỏi cửa hàng (`DESIGN.md`). Đây là delta duy nhất về màu nền.
- Thẻ đơn chuyển nhóm ngay trên trang sau khi server trả về, không tải lại toàn trang.
- Không có phím tắt bàn phím ở v1.
