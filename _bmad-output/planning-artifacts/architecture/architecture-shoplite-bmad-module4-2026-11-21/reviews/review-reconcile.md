---
title: Reconcile review — ARCHITECTURE-SPINE vs PRD / addendum / EXPERIENCE
date: 2026-11-21
reviewed: ../ARCHITECTURE-SPINE.md
inputs: [prd.md, addendum.md, EXPERIENCE.md]
verdict: PASS WITH FIXES (4 High, 7 Medium, 9 Low). Không có lỗ hổng làm hỏng tính nguyên tử; các lỗ chủ yếu nằm ở hợp đồng lỗi/validate, trạng thái UI sau router.refresh, luồng 401, và các hàm suy diễn hiển thị chưa được chốt.
---

# Reconcile review: Architecture Spine ↔ inputs

Phạm vi: tìm yêu cầu / ràng buộc / hệ quả testable trong PRD, addendum, EXPERIENCE mà spine bỏ sót, mâu thuẫn, hoặc để hai implementer làm khác nhau. Bỏ qua thiết kế thuần thị giác. Spine không bị sửa.

Phần đã khớp tốt (không lặp lại bên dưới): một file trạng thái + tmp/fsync/rename + mutex (AD-3/4), CAS trong mutator (AD-6), điểm chèn lỗi và test tương tranh trên file thật (AD-5), tách đường hủy khách/nhân viên (AD-7), overlay tồn kho + force-dynamic (AD-8), Order chỉ thêm trường optional + đơn cũ (AD-9/15), PIN/HMAC/proxy lạc quan + requireStaff (AD-10), chống dò PIN chốt OQ-6 (AD-11), server-first không optimistic chốt OQ-5 (AD-13), cô lập dữ liệu E2E (AD-14).

---

## HIGH

### H1 — Mẫu thông điệp xung đột của AD-6 sinh ra câu sai ("Đã đã xác nhận bởi An")
- **Nguồn:** FR-10 ("Đã xác nhận bởi An lúc 08:05"), EXPERIENCE Voice & Conflict notice, UJ-1.
- **Spine:** AD-6 `message = "Đã ‹nhãn trạng thái hiện tại, viết thường› bởi ‹actor› lúc ‹HH:mm›"`. Nhãn thật trong `ORDER_STATUS_LABELS` là "Đã xác nhận", "Đang giao", "Đã giao", "Đã hủy" → kết quả "Đã đã xác nhận bởi An", "Đã đang giao bởi An". Hai implementer sẽ "sửa" mẫu theo hai cách khác nhau, và test E2E so chuỗi sẽ lệch.
- **Còn bỏ ngỏ:** (a) actor `{kind:"customer"}` hiển thị thế nào ("bởi khách"?) — xảy ra khi khách tự hủy đúng lúc nhân viên xác nhận; (b) đơn cũ không có `statusHistory` (hoặc không có dòng vào trạng thái hiện tại) → không có actor/giờ; (c) `HH:mm` theo múi giờ nào và có thêm ngày khi khác ngày không; (d) thông điệp khi cặp `from→to` không có trong bảng.
- **Fix:** Chốt hàm thuần `describeStatusChange(change)` trong `orders/timeline.ts` với bảng cụm từ tường minh: `confirmed→"Đã xác nhận"`, `shipping→"Đã bắt đầu giao"`, `delivered→"Đã giao"`, `cancelled→"Đã hủy"`; actor customer → "bởi khách"; giờ = `HH:mm` Asia/Ho_Chi_Minh (thêm `dd/MM` nếu khác ngày hôm nay); thiếu history → "Đơn đã ở trạng thái ‹nhãn›". Thông điệp cho cặp không hợp lệ: chốt một chuỗi, ví dụ "Không thể chuyển đơn từ ‹nhãn› sang ‹nhãn›". Viết test cho từng nhánh.

### H2 — Validate body kiểu discriminated có thể biến 409 bắt buộc của FR-8 thành 400
- **Nguồn:** FR-8 testable: `delivered → pending`, `pending → shipping`, `cancelled → *`, `delivered → *` phải là **409 `INVALID_STATUS_TRANSITION`**, đơn và kho không đổi.
- **Spine:** AD-12 body `{ from, to, ... }` "discriminated theo `to`", và quy tắc lý do hủy theo `from ∈ pending|confirmed|shipping`. Nếu schema Zod chỉ liệt kê các `to`/`from` hợp lệ (cách tự nhiên khi viết discriminated union), thì `{from:"delivered", to:"pending"}` hoặc `{from:"cancelled", to:"cancelled", reason:...}` sẽ ra **400 `VALIDATION_ERROR`**, trái FR-8. Thứ tự kiểm tra (shape → cặp trong bảng → CAS → lý do → tồn kho) cũng không được chốt, nên cùng một request có thể ra 400 ở implementer này và 409 ở implementer kia.
- **Fix:** Chốt: (1) Zod chỉ kiểm shape — `from`, `to` ∈ `ORDER_STATUSES`, `reason`/`note`/`returnedToShop` đúng kiểu; (2) cặp không có trong `ORDER_TRANSITIONS` → 409; (3) CAS `order.status !== from` → 409 kèm thông điệp H1; (4) mới tới quy tắc lý do hủy (400) — hoặc đổi 3↔4, nhưng phải ghi rõ; (5) `checkShortfall` → 409 `INSUFFICIENT_STOCK`. Thêm test bảng cho cả 4 ví dụ FR-8.

### H3 — Conflict notice và focus-sau-khi-chuyển-nhóm không sống được qua `router.refresh()`
- **Nguồn:** EXPERIENCE Conflict notice ("hiện ngay trên thẻ ... thẻ được cập nhật sang trạng thái mới, notice tự ẩn sau khi cuộn hoặc làm mới"), State Patterns "Xung đột", Accessibility "Sau khi thẻ chuyển nhóm, focus chuyển sang thẻ kế tiếp trong nhóm cũ, nếu nhóm cũ không còn thẻ thì sang tiêu đề nhóm", Quyết định "thẻ chuyển nhóm ngay trên trang".
- **Spine:** AD-13 bắt buộc `router.refresh()` sau mọi phản hồi, kể cả 409. Khi refresh, thẻ đổi nhóm → React unmount ở nhóm cũ, mount ở nhóm mới → mọi state cục bộ của thẻ (notice, lỗi) mất, và focus rơi về `body`. Đồng thời "notice tự ẩn khi làm mới" mâu thuẫn trực tiếp với refresh tự động ngay sau 409 — implementer A ẩn ngay (người dùng không bao giờ thấy notice), implementer B giữ.
- **Thông tin cần có trước request:** để focus "thẻ kế tiếp trong nhóm cũ", client phải biết thứ tự thẻ **trước** khi refresh (danh sách sau refresh đã không còn thẻ đó ở nhóm cũ); `router.refresh()` không trả promise nên cần `useTransition` để biết lúc nào refresh xong.
- **Fix:** Thêm vào AD-13: (a) state notice/lỗi giữ ở một client provider cấp Hàng đợi, key theo `orderId`, không ở trong thẻ; (b) "làm mới" làm ẩn notice = nút làm mới ở Staff header hoặc cuộn, **không** phải refresh tự động sau 409; (c) trước khi gửi, thẻ tính `nextFocusTarget` (id thẻ kế tiếp trong nhóm cũ, hoặc id tiêu đề nhóm); sau khi `startTransition(() => router.refresh())` hoàn tất, focus phần tử đó; thẻ và tiêu đề nhóm có `id` ổn định (`order-card-${id}`, `queue-group-${status}`), tiêu đề có `tabIndex=-1`; (d) chi tiết đơn: notice nằm ở client component của trang, không remount nên ổn. Lỗi mạng/500 ("dữ liệu không đổi, nút bật lại") — không cần refresh.

### H4 — Luồng 401 "quay lại trang trước" chưa đủ để hai người làm giống nhau
- **Nguồn:** EXPERIENCE State "Hết phiên (401): chuyển về `/staff/login`, hiện 'Phiên đã hết hạn, vui lòng nhập lại PIN'. Đăng nhập xong quay lại trang trước đó." Flow 1 bước 1 (chưa có phiên → login, không phải "hết hạn"). FR-6.
- **Spine thiếu:**
  1. Trang login sau `POST /api/staff/session` 204 làm gì với `next` — chưa chốt "điều hướng tới `next` nếu hợp lệ, mặc định `/staff`".
  2. Kiểm `next` chống open redirect: chỉ nhận đường dẫn tương đối bắt đầu bằng `/staff` (không `//`, không `/staff/login`).
  3. Phân biệt "hết hạn" và "chưa đăng nhập": thông điệp "Phiên đã hết hạn" cần tín hiệu (ví dụ `?reason=expired`, đặt khi cookie có mặt nhưng hết hạn/không hợp lệ, hoặc khi client nhận 401 từ API). Không chốt → một người luôn hiện (sai ở Flow 1), người kia không bao giờ hiện.
  4. `requireStaff()` trong Server Component page không có sẵn pathname để dựng `next` — cần chốt cách lấy (tham số `requireStaff({ next })` từ page, hoặc header do proxy gắn).
  5. Quy tắc "401 trên client → chuyển login" không được áp cho chính form PIN (`POST /api/staff/session` trả 401 khi PIN sai). Nếu viết thành fetch-wrapper chung, PIN sai sẽ bị redirect thay vì "xóa ô, focus lại, 'PIN không đúng'".
  6. Khi thiếu/sai cấu hình `STAFF_PINS`/`STAFF_SESSION_SECRET`, login trả 401 với thông điệp gì (giữ "PIN không đúng" để không lộ cấu hình, hay thông điệp riêng)?
- **Fix:** Thêm mục con vào AD-10/AD-13 chốt 6 điểm trên; E2E: cookie hết hạn trên `/staff/orders/X` → login hiện thông điệp hết hạn → nhập PIN → về `/staff/orders/X`.

---

## MEDIUM

### M1 — API công khai sẽ lộ tên Nhân viên, ghi chú hủy, cờ nội bộ
- **Nguồn:** EXPERIENCE "Trang theo dõi của khách **không** hiện tên Nhân viên"; FR-4 (response chỉ thêm trường); OQ-1 (công khai đã chấp nhận cho dữ liệu khách, không nói gì về dữ liệu nhân viên).
- **Spine:** AD-9 chỉ nói "Trang khách không hiện tên Nhân viên". Nhưng `GET /api/orders` và `GET /api/orders/:id` (không auth) trả `Order` → sẽ chứa `statusHistory[].actor.name`, `cancellation.note`, `stockApplied`, `flags`. Implementer A trả nguyên `Order` (FR-4 cho phép thêm), B lọc.
- **Fix:** Chốt `toPublicOrder(order)` dùng cho API khách và Trang theo dõi: bỏ `actor.name` (giữ `kind`), quyết định có lộ `note` của lý do "Khác", bỏ `stockApplied`. Hoặc ghi rõ chấp nhận lộ kèm lý do.

### M2 — Ngày dự kiến giao: quy tắc đếm chưa chốt và ví dụ của UX/PRD không tái tạo được
- **Nguồn:** FR-16 ("khoảng tính từ Mốc giờ `confirmed` cộng số ngày làm việc"; `delivered` hiện ngày giao thực tế), UJ-2/Flow 2 ("Đã xác nhận 21/11 08:05" → "Dự kiến giao: 23–25/11"), FR-23 (shipping quá hạn trên).
- **Vấn đề:** 21/11/2026 là **thứ Bảy**. Với quy tắc T2–T6 của spine, tiêu chuẩn 3–5 ngày làm việc → 25–27/11 (nếu T2 23/11 là ngày 1); giao nhanh → 23–24/11. Không cách đếm nào ra 23–25/11. Test viết theo ví dụ sẽ đỏ. Spine chưa chốt: ngày xác nhận có tính là ngày 0 không, xác nhận cuối tuần thì bắt đầu đếm từ đâu, "quá hạn trên" (FR-23) là sau 23:59 ngày maxDay giờ VN hay sau `confirmedAt + N ngày`.
- **Đơn cũ:** đơn `confirmed`/`shipping` không có Mốc giờ `confirmed` (AD-9: "—") → dòng Dự kiến giao hiện gì? `delivered` thiếu Mốc giờ giao → "ngày giao thực tế" hiện gì?
- **Fix:** Chốt định nghĩa trong `delivery-estimate.ts` kèm ví dụ input → output; định nghĩa "quá hạn trên" cho FR-23; fallback cho đơn cũ (ẩn dòng hoặc "—"). Báo PM/UX sửa ví dụ 23–25/11 hoặc xác nhận quy tắc.

### M3 — Trạng thái thanh toán cho đơn `cancelled` (và các nhánh khác) không có hàm chốt
- **Nguồn:** FR-16 (`cod` chưa giao → "Thanh toán khi nhận: {tổng}", `cod` đã giao → "Đã thanh toán", `bank_transfer` → "Chuyển khoản: {tổng}"); Key info card luôn có dòng Thanh toán.
- **Vấn đề:** `cod` + `cancelled` theo câu chữ là "chưa giao" → "Thanh toán khi nhận: 1.250.000 ₫" trên đơn đã hủy. Spine không có hàm thuần nào cho chuỗi này (AD-2 chỉ liệt kê transitions/stock/delivery/timeline).
- **Fix:** Thêm `orders/payment-status.ts` (thuần, có test) với bảng đủ 2 phương thức × 5 trạng thái; hỏi PM nhánh `cancelled`.

### M4 — "Muốn đổi Tồn kho thì sửa dữ liệu khởi tạo" mâu thuẫn với seed lazy; Sổ kho thiếu số dư đầu
- **Nguồn:** FR-5 Out of Scope ("muốn đổi Tồn kho thì sửa dữ liệu khởi tạo"); FR-20 + SM-2 (Tồn kho = khởi tạo + tổng thay đổi).
- **Spine:** AD-8 seed lazy theo key thiếu. Khi key đã được ghi vào `shop-store.json`, sửa `stock` trong `products.ts` **không có tác dụng** → quy trình vận hành duy nhất PRD đưa ra bị vô hiệu. Nếu FR-20 (SHOULD) làm sau khi kho đã thay đổi, đẳng thức SM-2 vỡ cho các thay đổi trước đó; "khởi tạo" cũng mơ hồ nếu `products.ts` đổi.
- **Fix:** Chốt quy trình đổi tồn kho v1 (dừng server, sửa `inventory` trong `shop-store.json`; hoặc script `npm run stock:set`), báo PM sửa câu FR-5. Với FR-20: ghi dòng "opening balance" khi seed key, hoặc ghi rõ SM-2 chỉ áp dụng từ lúc bật Sổ kho.

### M5 — Windows: `rename` đè file có thể `EPERM/EBUSY` vì `read()` không khóa; mutex có thể bị "đầu độc"
- **Nguồn:** FR-9 ("ghi lỗi giữa chừng không để trạng thái nửa vời"), SM-1; môi trường dev thực tế là Windows (repo ở `D:/`).
- **Spine:** AD-4 `read()` không khóa, dựa vào rename. Trên Windows, `fs.rename` lên file đang có handle đọc mở có thể ném `EPERM`/`EBUSY` → commit thất bại ngẫu nhiên khi Hàng đợi đang đọc. Mutex "promise chain": nếu mutator/commit ném mà chain không `catch`, các `update` sau bị kẹt hoặc cùng ném.
- **Fix:** Chốt retry rename có giới hạn (vd 5 lần, backoff ngắn) cho `EPERM/EBUSY/EACCES`; mutex giải phóng trong `finally`, lỗi một lượt không lan sang lượt sau — thêm test cho cả hai.

### M6 — 360px: PRD đo ở 360px, spine không nhắc; E2E SM-5 chưa có chỗ
- **Nguồn:** FR-13 ("dùng được ở 360px, không cuộn ngang"), FR-16 + SM-5 ("Ba thông tin chính trong màn hình đầu ở 360px với **mọi** Trạng thái đơn, đo bằng E2E ở viewport 360px"). EXPERIENCE thiết kế cho 390px.
- **Spine:** không nhắc 360px; AD-14 không có project viewport (config hiện chỉ có Desktop Chrome). "Màn hình đầu" cần chiều cao chốt (360×640?), nếu không hai người viết assertion khác nhau. "Mọi trạng thái" cần E2E tạo đơn ở đủ 5 trạng thái.
- **Fix:** Thêm vào AD-14: Playwright project `mobile-360` (360×640), assertion không cuộn ngang (`scrollWidth <= clientWidth`) và key info card nằm trong viewport; helper E2E đăng nhập PIN test và đẩy đơn qua các trạng thái bằng `POST /api/staff/orders/:id/transitions`.

### M7 — E2E dùng chung một file trạng thái suốt run → test tồn kho phá nhau
- **Nguồn:** FR-3 E2E (đẩy X về 0), SM-6 (`shopping-flow.spec.ts` vẫn xanh).
- **Spine:** AD-14 `globalSetup` xóa `.e2e/` **một lần**. Spec FR-3 làm X hết hàng sẽ làm spec mua X fail tùy thứ tự; `workers` không cố định.
- **Fix:** Chốt `workers: 1` và mỗi spec dùng sản phẩm riêng (liệt kê), hoặc một cơ chế reset theo spec.

---

## LOW

- **L1 — Định dạng dòng thiếu hàng có hai nguồn.** FR-14 "cần N, còn M, thiếu K" (đèn tính khi render) và `details[productId]` của 409 (AD-6). Chốt một formatter thuần trong `inventory/stock.ts` cho cả hai; sau 409 spine đã refresh nên ghi rõ UI hiển thị từ đèn mới hay từ `details`.
- **L2 — Đèn của các đơn `pending` tính độc lập hay cộng dồn?** FR-14 "theo Tồn kho hiện tại"; "Còn 3, 2 đang trong đơn chờ" là COULD. Ghi rõ mỗi đơn so độc lập với tồn kho hiện tại (hai đơn tranh món cuối đều xanh; server quyết).
- **L3 — `proxy.ts` cần `STAFF_SESSION_SECRET`/`STAFF_PINS`** nhưng Conventions nói env chỉ đọc trong `features/*/server.ts`, và proxy không import phần có I/O. Chốt module cấu hình thuần (vd `staff/staff-config.ts`) được phép đọc `process.env` và dùng ở proxy.
- **L4 — `read()` không khóa nhưng bootstrap AD-15 "commit trong mutex".** Ghi rõ lần đọc đầu khi `STORE_FILE` chưa có phải đi qua đường có khóa (hai request đầu đồng thời không được import hai lần).
- **L5 — Lỗi mạng/500 có refresh không?** AD-13 nói refresh "kể cả 409"; EXPERIENCE: lỗi mạng → "dữ liệu không đổi, nút bật lại". Ghi rõ không refresh (xem H3).
- **L6 — Skeleton "Đang tải" (3 thẻ)** cần `loading.tsx` cho `/staff` và `/staff/orders/[id]`; Structural Seed chưa có.
- **L7 — Rate-limit:** `x-forwarded-for` do client tự đặt khi chạy `next start` trực tiếp → khóa theo IP bị vượt; ngưỡng toàn cục 30/60 phút cho phép người lạ khóa cả shop 15 phút. Ghi nhận đánh đổi hoặc chỉ tin XFF khi có cấu hình `TRUST_PROXY`.
- **L8 — Lý do "Khác" và khách tự hủy trên Trang theo dõi:** hiện "Đã hủy · Khác" hay `note`? Khách tự hủy (không có reason) hiện gì? Chốt trong timeline/`toPublicOrder` (liên quan M1).
- **L9 — Định dạng "Chờ 11 giờ":** quy tắc đơn vị (phút / giờ / ngày, làm tròn) chưa chốt; đặt trong `timeline.ts` có test, dùng `now` inject (AD-2).

---

## Ghi chú cho PM/UX (không phải lỗi spine)
- Ví dụ "23–25/11" (UJ-2, Flow 2) không khớp quy tắc ngày làm việc khi xác nhận thứ Bảy 21/11/2026 (M2).
- FR-5 Out of Scope "sửa dữ liệu khởi tạo" không còn đúng khi tồn kho đã lưu bền (M4).
- Nhánh thanh toán của đơn `cod` đã hủy (M3).
- State "Đèn đỏ: Nút Hủy vẫn dùng được" ngụ ý thẻ trong Hàng đợi có nút hủy, trong khi Cancel sheet chỉ ở Chi tiết đơn — cần làm rõ.
