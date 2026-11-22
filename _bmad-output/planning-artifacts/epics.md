---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/specs/spec-shoplite-bmad-module4/SPEC.md
  - _bmad-output/specs/spec-shoplite-bmad-module4/acceptance-criteria.md
  - _bmad-output/specs/spec-shoplite-bmad-module4/glossary.md
  - _bmad-output/specs/spec-shoplite-bmad-module4/user-journeys.md
  - _bmad-output/planning-artifacts/architecture/architecture-shoplite-bmad-module4-2026-11-21/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-shoplite-bmad-module4-2026-11-21/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-shoplite-bmad-module4-2026-11-21/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-shoplite-bmad-module4-2026-11-21/mockups/key-staff-queue.html
  - _bmad-output/planning-artifacts/ux-designs/ux-shoplite-bmad-module4-2026-11-21/mockups/key-staff-order-detail.html
  - _bmad-output/planning-artifacts/ux-designs/ux-shoplite-bmad-module4-2026-11-21/mockups/key-customer-tracking.html
  - _bmad-output/planning-artifacts/prds/prd-shoplite-bmad-module4-2026-11-21/prd.md
  - _bmad-output/planning-artifacts/prds/prd-shoplite-bmad-module4-2026-11-21/addendum.md
---

# shoplite-bmad-module4 - Epic Breakdown

## Overview

Tài liệu này tách tính năng **Vận hành đơn hàng ShopLite** thành epic và story để Developer agent thực hiện.

- **Nguồn yêu cầu chính:** `SPEC.md` (CAP-1..CAP-23, trùng số với PRD FR-1..FR-23) và `acceptance-criteria.md`.
- **Ràng buộc kỹ thuật:** `ARCHITECTURE-SPINE.md`, mã AD-1..AD-19 giữ nguyên.
- **Hành vi và giao diện:** UX spine (`EXPERIENCE.md` + `DESIGN.md`) và 3 mockup.
- **Brownfield:** commit `805f721`.

## Requirements Inventory

### Functional Requirements

**MUST: giữ nguyên hành vi hiện có**

- **FR-1 (CAP-1):** Server luôn tính lại giá. `unitPrice` lấy từ catalog; `subtotal`, `shippingFee`, `total` tính bằng `calculateOrderTotals`; bỏ qua giá client gửi. Phí ship tiêu chuẩn 30.000 ₫ (0 ₫ khi `subtotal ≥ 500.000 ₫`), giao nhanh 60.000 ₫.
- **FR-2 (CAP-2):** Khách tự hủy qua `PATCH /api/orders/:id {status:"cancelled"}`, không cần đăng nhập, và chỉ khi đơn `pending`.
  - Trạng thái khác: 409 `INVALID_STATUS_TRANSITION`.
  - Body khác: 400 `VALIDATION_ERROR`.
  - Nút hủy chỉ hiện khi `pending`; hủy không đổi Tồn kho.
- **FR-3 (CAP-3):** Các hành vi tồn kho phía khách giữ nguyên, nhưng đọc Tồn kho lưu bền:
  - kiểm tra lúc đặt (409 `INSUFFICIENT_STOCK`, giữ thông điệp; đặt hàng không trừ kho);
  - giới hạn giỏ hàng (10 mỗi loại, không vượt Tồn kho);
  - `StockBadge` với ngưỡng 5;
  - bộ lọc `inStock`.
  - `e2e/shopping-flow.spec.ts` vẫn qua.
- **FR-4 (CAP-4):** Hợp đồng `GET/POST /api/orders`, `GET /api/orders/:id`, `GET /api/products*` giữ nguyên. Lỗi có dạng `{error:{code,message,details?}}` và đi qua `handleRouteError`/`jsonError`. Trường mới chỉ được thêm. `npm run check` xanh mà không sửa assertion cũ.

**MUST: hành vi mới**

- **FR-5 (CAP-5):** Tồn kho lưu bền.
  - Khởi tạo từ `stock` trong `products.ts` khi chưa có dữ liệu.
  - Còn sau restart; không bao giờ âm.
  - Là nguồn duy nhất cho mọi nơi đọc tồn kho.
- **FR-6 (CAP-6):** Nhân viên đăng nhập bằng PIN, phiên 12 giờ.
  - PIN sai không lộ PIN thuộc ai.
  - API staff khi chưa đăng nhập trả 401 `UNAUTHORIZED`.
  - Không cấu hình Nhân viên thì đóng mọi truy cập.
  - PIN không vào response, log hay file.
- **FR-7 (CAP-7):** Mọi Chuyển trạng thái ghi Người thao tác và Mốc giờ; khách tự hủy ghi "khách".
- **FR-8 (CAP-8):** Chỉ các chuyển trong Bảng chuyển hợp lệ được chấp nhận:
  - `pending→confirmed|cancelled`;
  - `confirmed→shipping|cancelled`;
  - `shipping→delivered|cancelled`.
  - Phải có compare-and-set theo `from`. Chuyển khác trả 409 và không đổi gì.
- **FR-9 (CAP-9):** Xác nhận đơn và trừ Tồn kho mọi dòng trong một thao tác nguyên tử.
  - Thiếu hàng: 409 `INSUFFICIENT_STOCK` kèm thiếu từng dòng.
  - Lỗi ghi giữa chừng không để trạng thái nửa vời.
  - Hai đơn tranh món cuối: đúng một đơn thành công.
- **FR-10 (CAP-10):** Thao tác lặp bị từ chối với 409 và thông điệp "Đã xác nhận bởi An lúc 08:05"; kho chỉ trừ một lần.
- **FR-11 (CAP-11):** Nhân viên hủy đơn `pending`/`confirmed` với lý do bắt buộc: Hết hàng, Khách đổi ý, Không liên lạc được khách, Khác (kèm ghi chú).
  - Hủy `confirmed` hoàn đúng số đã trừ, nguyên tử.
  - Thiếu lý do: 400. Lý do hiện cho khách.
- **FR-12 (CAP-12):** Hủy `shipping` với lý do "Giao thất bại" bắt buộc chọn "Hàng đã về shop" (thiếu thì 400); có lựa chọn này thì hoàn kho.
- **FR-13 (CAP-13):** Hàng đợi gồm `pending`/`confirmed`/`shipping`, nhóm theo trạng thái, chờ lâu nhất lên đầu.
  - Thẻ hiện mã đơn, tên khách, số dòng, tổng tiền, thời gian chờ.
  - Đơn vừa xử lý đổi nhóm mà không cần tải lại thủ công.
  - Dùng được ở 360px, không cuộn ngang.
- **FR-14 (CAP-14):** Mỗi đơn `pending` có Đèn tồn kho. Đèn đỏ khóa nút Xác nhận và ghi "cần N, còn M, thiếu K". Đèn chỉ là gợi ý.
- **FR-15 (CAP-15):** Chỉ hiện hành động hợp lệ.
  - Hành động chính một chạm: "Xác nhận", "Bắt đầu giao", "Đã giao".
  - Hủy cần bước xác nhận.
  - Đơn `delivered`/`cancelled` không có nút.
- **FR-16 (CAP-16):** Ba thông tin chính hiện trong màn hình đầu ở 360px, gồm Ngày dự kiến giao theo quy tắc AD-12 và Trạng thái thanh toán theo `paymentMethod` + trạng thái.
- **FR-17 (CAP-17):** Thanh tiến trình 4 bước có Mốc giờ thật; đơn hủy hiện bước hủy kèm mốc và lý do.
- **FR-18 (CAP-18):** Đơn cũ vẫn mở được, không lỗi 500. Mốc đặt lấy từ `createdAt`; mốc thiếu hiện "—".

**SHOULD**

- **FR-19 (CAP-19):** Lịch sử trạng thái gồm từ, sang, Người thao tác, Mốc giờ, lý do.
- **FR-20 (CAP-20):** Sổ kho chỉ ghi thêm; Tồn kho = khởi tạo + tổng thay đổi trong sổ.
- **FR-21 (CAP-21):** Đếm đơn theo trạng thái và danh sách sản phẩm có Tồn kho ≤ 5.
- **FR-22 (CAP-22):** Khách gửi yêu cầu hủy cho đơn `confirmed`.
  - Đặt cờ `cancelRequested`; không đổi trạng thái hay kho.
  - Nhân viên duyệt hoặc từ chối.
  - Trang khách hiện dải cảnh báo.
- **FR-23 (CAP-23):** Cảnh báo đơn đứng yên: `pending`/`confirmed` quá 24 giờ, `shipping` quá hạn trên của Ngày dự kiến giao.

### NonFunctional Requirements

- **NFR-1 (Nguyên tử, SM-1):** Chuyển trạng thái và đổi kho cùng thành công hoặc không đổi gì, kể cả khi lỗi đĩa hay crash. Oversell = 0 kể cả khi thao tác đồng thời, chứng minh bằng test tương tranh tự động.
- **NFR-2 (Toàn vẹn kho, SM-2):** Tồn kho = khởi tạo − đã xác nhận + đã hoàn, luôn khớp; không âm.
- **NFR-3 (Hạ tầng):** Không database, không dịch vụ ngoài, không dependency mới. File JSON trong `storage/`, một tiến trình Node, không scale ngang.
- **NFR-4 (Bảo mật Khu nhân viên):**
  - PIN 6–8 chữ số, so sánh constant-time, chống dò bằng trễ lũy tiến.
  - Cookie httpOnly ký HMAC, `SameSite=Lax`, `Secure` ở production, hết hạn 12 giờ.
  - Đóng khi thiếu cấu hình. Bí mật không log, không commit.
- **NFR-5 (Riêng tư khách):** API và trang công khai không lộ tên Nhân viên hay ghi chú nội bộ. `/orders` công khai là rủi ro đã chấp nhận (OQ-1).
- **NFR-6 (Mobile-first):** Dùng được ở 360px, thiết kế cho 390px, không cuộn ngang; vùng chạm ≥ 44px.
- **NFR-7 (Hiệu suất thao tác, SM-3):** Xác nhận một đơn đèn xanh trong 1 chạm, dưới 10 giây.
- **NFR-8 (Khả dụng thông tin, SM-5):** Ba thông tin chính nằm trong màn hình đầu ở 360px với mọi trạng thái.
- **NFR-9 (Accessibility):** WCAG 2.2 AA.
  - Không phân biệt chỉ bằng màu.
  - Form có label/fieldset; focus nhìn thấy được.
  - `role="status"`/`role="alert"` đúng chỗ; `aria-current="step"`.
- **NFR-10 (Server-first):** UI chỉ đổi sau phản hồi server; không optimistic, không polling.
- **NFR-11 (Không hồi quy, SM-6):** `npm run check` và `npm run test:e2e` xanh sau mỗi story.
- **NFR-12 (Counter-metrics):** Không ẩn sản phẩm ít hàng hay hạ tồn kho khởi tạo (SM-C1). Không biến hành động không hoàn tác thành một chạm (SM-C2).
- **NFR-13 (Vận hành, SM-4):** Không đơn nào đứng ở `pending` quá 24 giờ, đo bằng Mốc giờ.

### Additional Requirements

Từ `ARCHITECTURE-SPINE.md`. Không có starter template (brownfield). Story đầu của E1 làm trên code hiện có.

- **AD-1/AD-2 [ADOPTED]:**
  - Feature-based `src/features/<feature>`; `src/app` chỉ chứa route.
  - `features/*/server.ts` chỉ import phía server.
  - Hàm thuần có test cạnh file. `createOrderService({ repository, … })` giữ nguyên chữ ký.
- **AD-3:** Một file `STORE_FILE` (mặc định `storage/shop-store.json`), shape `{schemaVersion:1, orders, inventory, inventoryBaseline, stockLedger?}`.
  - Ghi theo trình tự `.tmp` → `FileHandle.sync` → `rename` (retry khi `EPERM/EACCES/EBUSY`) → fsync thư mục (trừ win32).
- **AD-4:** `OrderRepository` thêm `readState()` và `update(mutator)`; `save` chỉ cho insert và setup test.
  - Mọi đọc/ghi đi qua mutex `globalThis`, khóa theo `path.resolve` (lowercase trên win32).
  - Có repo in-memory tương đương.
- **AD-5:** PID lock file cưỡng chế một tiến trình.
- **AD-6:** Port fs có điểm chèn lỗi và `failNextCommit` để test tính nguyên tử. Restart được mô phỏng bằng một repository mới trên cùng file.
- **AD-7:**
  - `ORDER_TRANSITIONS` là bảng thuần; mutator thuần, đồng bộ; CAS theo `from` trong mutex.
  - Thứ tự kiểm tra cố định: 400 shape → 404 → 409 cặp không hợp lệ → 409 CAS → 400 lý do → 409 thiếu hàng.
  - Cờ `stockApplied` ghi nhận đơn đã trừ kho.
- **AD-8:** Hai đường hủy tách biệt: `cancelOrder` (khách, không đổi) và `transitionOrder` (nhân viên).
- **AD-9:** Catalog giữ đồng bộ; overlay `withLiveStock` ở ranh giới server.
  - `getProductBySlug`, `getFeaturedProducts`, `getRelatedProducts` nhận thêm tham số `source`.
  - Có `reconcileInventoryKeys` và `getStockLight`.
  - Trang `/`, `/products`, `/products/[slug]` dùng `force-dynamic`; trang chi tiết bỏ `generateStaticParams`.
  - Dòng Sổ kho chỉ được sinh bởi `inventory/stock.ts`.
- **AD-10:** `Order` chỉ thêm trường tùy chọn: `statusHistory`, `Actor`, `StatusChange`, `CancelReason`, `cancellation`, `stockApplied`, `flags.cancelRequestedAt`. Schema đọc file dùng `z.looseObject` để giữ trường lạ. `statusHistory` là nguồn Mốc giờ duy nhất.
- **AD-11:** Mọi response và trang của khách đi qua `toPublicOrder()`:
  - actor chỉ còn `{kind}`;
  - bỏ `cancellation.note` và `stockApplied`.
- **AD-12:** `describeStatusChange`, `estimateDelivery`, `describePayment` là hàm thuần có test.
  - Ngày làm việc T2–T6, đếm từ ngày làm việc kế tiếp, theo giờ VN.
  - `SHIPPING_OPTIONS` thêm `minDays`/`maxDays`.
- **AD-13:** Xác thực Nhân viên.
  - Cấu hình `STAFF_PINS` và `STAFF_SESSION_SECRET` (≥32 ký tự) đọc trong `staff/staff-config.ts`.
  - Cookie `shoplite_staff` ký HMAC.
  - Trang bảo vệ nằm trong route group `(protected)`; `src/proxy.ts` chỉ kiểm tra lạc quan và bỏ qua `/staff/login`.
  - Kiểm tra thật bằng `requireStaff()` ở layout và đầu mọi handler `/api/staff/**`.
  - Tham số `next` được kiểm để tránh open redirect; hết phiên dùng `reason=expired`.
- **AD-14:** Kiểm PIN tuần tự qua mutex, trễ `min(1s·2^(n−1), 30s)`, không khóa cứng, không dựa IP.
- **AD-15:** `ensureInitialized()` trong mutex.
  - `importLegacyOrders` đọc `ORDERS_FILE` cũ; file hỏng thì ném lỗi và không tạo store.
  - Sau khi khởi tạo không ghi `orders.json` nữa.
- **AD-16:** `npm run stock:set -- p004=10 …` (`scripts/stock-set.ts`) là đường duy nhất đổi tồn kho ngoài luồng đơn.
- **AD-17:** API mới:
  - `POST/DELETE /api/staff/session`;
  - `POST /api/staff/orders/:id/transitions {from,to,reason?,note?,returnedToShop?}`.
  - Zod chỉ kiểm shape, không dùng `discriminatedUnion`.
  - Thêm mã lỗi `UNAUTHORIZED` (401) vào `OrderError`.
- **AD-18:** UI server-first.
  - Server Component đọc service; client gọi Route Handler bằng `fetch`, rồi `router.refresh()` trong `startTransition`.
  - Notice provider theo `orderId`, `nextFocusTarget`, 401 thì redirect về login.
- **AD-19:** Cô lập E2E.
  - Thư mục `.e2e/` được xóa ở top-level của `playwright.config.ts`; `webServer.env` đặt `STORE_FILE`, `ORDERS_FILE` và `STAFF_*` test; `reuseExistingServer: false`.
  - Thêm project viewport 360×800.
  - Mỗi spec dùng sản phẩm riêng; `.e2e/` và `storage/` vào `.gitignore`.
- **Vận hành:**
  - Production chạy một `next start`, phục vụ qua HTTPS.
  - `console.error` chỉ trong `handleRouteError` và lỗi khởi động store; không log body của session.
  - Chạy `npm audit` trước khi phát hành.

### UX Design Requirements

- **UX-DR1 Staff header:** cao 3.5rem, nền `slate-900`, chữ trắng.
  - Trái: ô logo indigo + "Khu nhân viên".
  - Phải: tên Nhân viên, nút ghost "Đăng xuất", nút làm mới icon `RefreshCw`.
  - Không có link sang cửa hàng; Khu nhân viên dùng khung riêng thay Header/Footer cửa hàng.
- **UX-DR2 PIN form:** thẻ giữa màn hình, `<label>` "Mã PIN".
  - Ô nhập `inputmode="numeric"`, `text-2xl`, chữ cách rộng; Enter để gửi; nút primary `lg` "Vào Hàng đợi".
  - Sai PIN: xóa ô, focus lại ô, hiện "PIN không đúng" với `role="alert"`.
  - Hết phiên: hiện "Phiên đã hết hạn, vui lòng nhập lại PIN".
  - Thiếu cấu hình: hiện "Khu nhân viên chưa được cấu hình".
- **UX-DR3 Queue group header:** ba nhóm cố định Chờ xác nhận → Đã xác nhận → Đang giao.
  - Nhãn + chip đếm `rounded-full`; sticky dưới header.
  - Nhóm rỗng: "0" + dòng "Không có đơn". Id ổn định `queue-group-‹status›`.
- **UX-DR4 Queue order card:** `card p-4`, id `order-card-‹id›`.
  - Hàng 1: mã đơn + "Chờ N giờ" + badge.
  - Hàng 2: emoji chồng + tên khách + số món + tổng tiền.
  - Hàng 3: Đèn tồn kho (chỉ đơn `pending`).
  - Cuối thẻ: nút primary `lg` rộng hết thẻ.
  - Chạm vào thân thẻ mở chi tiết.
- **UX-DR5 Stock light:** chip `rounded-full text-xs` 600.
  - Đủ hàng: emerald + `CircleCheck` + chữ "Đủ hàng".
  - Thiếu hàng: rose + `TriangleAlert` + chữ "Thiếu hàng", kèm từng dòng `text-sm rose-700` "‹Tên›: cần N, còn M, thiếu K".
  - Nút Xác nhận disabled, có `aria-describedby` trỏ tới dòng "Không đủ hàng để xác nhận".
- **UX-DR6 Trạng thái nút chuyển:**
  - Đang gửi: nhãn "Đang xác nhận…"/"Đang hủy…", mọi nút trên thẻ disabled.
  - Lỗi mạng/500: dòng `text-rose-700` "Không thực hiện được, vui lòng thử lại", nút bật lại.
- **UX-DR7 Conflict notice:** nền sky, icon `Info`, `rounded-xl`, `role="status"`.
  - Hiện trên thẻ hoặc trang chi tiết với thông điệp server, sống qua refresh.
  - Ẩn khi cuộn hoặc bấm làm mới.
- **UX-DR8 Focus sau chuyển nhóm:** focus chuyển sang thẻ kế tiếp trong nhóm cũ, hoặc sang tiêu đề nhóm nếu nhóm cũ hết thẻ.
- **UX-DR9 Cancel sheet inline:** mẫu `bg-rose-50` của `CancelOrderButton`, không dùng dialog.
  - Lý do là radio trong `<fieldset><legend>Lý do hủy</legend>`, vùng chạm ≥44px.
  - "Khác" thì bắt buộc ghi chú.
  - Đơn `shipping`: chỉ lý do "Giao thất bại" + checkbox bắt buộc "Hàng đã về shop".
  - Nút danger "Xác nhận hủy" disabled cho tới khi nhập đủ.
- **UX-DR10 Progress stepper:** dọc 4 bước, dạng `<ol>`, bước hiện tại `aria-current="step"`.
  - Chấm 12px, đường 2px; bước đã qua indigo + giờ, bước chưa tới slate, bước hủy rose "Đã hủy" + giờ + lý do.
  - Mốc thiếu hiện "—".
  - Bản nhân viên ghi thêm "· bởi An"; bản khách không có tên.
- **UX-DR11 Key info card:** ba dòng cố định Trạng thái / Dự kiến giao / Thanh toán.
  - Mỗi dòng: nhãn `text-xs slate-500` + giá trị `text-lg` 700.
  - Không có hành động. `OrderStatusBadge` giữ ở tiêu đề trang.
- **UX-DR12 Trang theo dõi:**
  - Key info card và stepper nằm trong màn hình đầu ở 390px.
  - Phần "Chi tiết đơn hàng" dùng `<details>`, đóng mặc định.
  - Giữ banner `?placed=1` và nút "Hủy đơn hàng" khi đơn `pending`; `notFound()` giữ nguyên.
- **UX-DR13 Trạng thái trang:**
  - Skeleton 3 thẻ `animate-pulse`.
  - Hàng đợi rỗng: `EmptyState` "✅ Không còn đơn cần xử lý" / "Đơn mới sẽ hiện ở đây.".
  - Đơn `delivered`/`cancelled` không có nút.
- **UX-DR14 Chi tiết đơn nhân viên (`/staff/orders/[id]`):** toàn bộ dòng hàng, khách, địa chỉ, stepper kèm actor, hành động hợp lệ, cancel sheet. Xem `mockups/key-staff-order-detail.html`.
- **UX-DR15 Alert strip (SHOULD):** nền amber, icon `TriangleAlert`, một câu + tối đa một nút `sm`, tối đa một dải mỗi bề mặt. Dùng cho FR-22 và FR-23.
- **UX-DR16 Layout:**
  - Khu nhân viên một cột `max-w-2xl px-4`; Trang theo dõi `max-w-4xl`.
  - Không bảng nhiều cột.
  - Cấm: vuốt, kéo thả, hover-only, cuộn vô hạn, phím tắt.
- **UX-DR17 Voice:**
  - Tiếng Việt, ngắn, động từ trước.
  - Không bao giờ hiện mã lỗi; hiện thẳng `error.message`.
  - Nhãn trạng thái chỉ lấy từ `ORDER_STATUS_LABELS`.
  - Không thêm màu hay biến thể nút mới; dùng lại `Button`, `EmptyState`, `OrderStatusBadge`.

### FR Coverage Map

```
FR-1:  Epic 1 - Server tính giá giữ nguyên khi placeOrder chạy trong mutator
FR-2:  Epic 1 - Khách tự hủy pending qua update(), endpoint giữ nguyên
FR-3:  Epic 1 - Kiểm tra lúc đặt / nhãn / lọc đọc Tồn kho lưu bền
FR-4:  Epic 1 - Hợp đồng API giữ nguyên (mọi story phải giữ; E1 sở hữu test hồi quy)
FR-5:  Epic 1 - Tồn kho lưu bền, khởi tạo, stock:set
FR-6:  Epic 2 - Đăng nhập PIN, phiên 12h, 401 UNAUTHORIZED
FR-7:  Epic 1 (actor "khách": tạo đơn, khách hủy) + Epic 3 (actor Nhân viên)
FR-8:  Epic 3 - Bảng chuyển hợp lệ + CAS
FR-9:  Epic 3 - Xác nhận + trừ kho nguyên tử
FR-10: Epic 3 - Từ chối thao tác lặp, báo ai/lúc nào
FR-11: Epic 3 - Hủy kèm lý do, hoàn kho
FR-12: Epic 3 - Giao thất bại, hàng đã về shop
FR-13: Epic 2 (nhóm/sắp/360px) + Epic 3 (đổi nhóm sau thao tác)
FR-14: Epic 2 (hiển thị đèn) + Epic 3 (khóa nút, aria-describedby)
FR-15: Epic 3 - Chỉ hiện hành động hợp lệ, một chạm / hủy hai bước
FR-16: Epic 4 - Ba thông tin chính
FR-17: Epic 4 - Thanh tiến trình
FR-18: Epic 1 (đọc đơn cũ không 500) + Epic 4 (hiển thị "—")
FR-19: Epic 5 - Lịch sử trạng thái
FR-20: Epic 5 - Sổ kho
FR-21: Epic 5 - Đếm đơn, hàng sắp hết
FR-22: Epic 5 - Yêu cầu hủy
FR-23: Epic 5 - Cảnh báo đứng yên
```

## Epic List

### Epic 1: Tồn kho thật, sống qua restart
Tồn kho được lưu bền cùng đơn hàng trong một file ghi nguyên tử, nên vẫn còn sau khi server khởi động lại. Cửa hàng hiện "Còn N / Hết hàng" theo tồn kho thật. Chủ shop đổi tồn kho bằng `npm run stock:set`. Đơn cũ được chuyển sang an toàn. Mô hình `Order` mở rộng ghi lịch sử từ ngày đầu. E2E chạy trên dữ liệu riêng.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-7 (khách), FR-18 (đọc)
**AD:** AD-1..AD-6, AD-9, AD-10, AD-15, AD-16, AD-19

### Epic 2: Khu nhân viên và Hàng đợi
Nhân viên đăng nhập bằng PIN và thấy Hàng đợi: ba nhóm, đơn chờ lâu nhất lên đầu, Đèn tồn kho trên mỗi đơn chờ xác nhận, dùng tốt ở 360px. Có nút làm mới và đăng xuất. Thẻ chưa có nút hành động; nút đến ở Epic 3. Đây là điểm review đã được chấp nhận, không phải lỗi.
**FRs covered:** FR-6, FR-13 (nhóm/sắp/360px), FR-14 (hiển thị)
**AD:** AD-9, AD-13, AD-14, AD-17 (session), AD-18, AD-20

### Epic 3: Xử lý đơn an toàn từ Hàng đợi
Từ Hàng đợi và Chi tiết đơn, nhân viên một chạm Xác nhận / Bắt đầu giao / Đã giao. Kho được trừ hoặc hoàn trong cùng thao tác. Hai người bấm trùng thì nhận "Đã xác nhận bởi An lúc 08:05". Hủy đơn có lý do bắt buộc; giao thất bại chỉ hoàn kho khi hàng đã về shop.
**FRs covered:** FR-7 (Nhân viên), FR-8, FR-9, FR-10, FR-11, FR-12, FR-13 (đổi nhóm), FR-14 (khóa nút), FR-15
**AD:** AD-7, AD-8, AD-12, AD-17, AD-18

### Epic 4: Khách theo dõi đơn không cần nhắn shop
`/orders/[id]` hiện Ba thông tin chính trong màn hình đầu ở 360px. Bên dưới là thanh tiến trình có Mốc giờ thật và lý do hủy. Mốc thiếu của đơn cũ hiện "—". Trang không lộ tên nhân viên.
**FRs covered:** FR-16, FR-17, FR-18 (hiển thị)
**AD:** AD-11, AD-12
**Phụ thuộc:** Story 1.5 và Story 3.1 (riêng Story 4.4 cần thêm Story 3.5 vì dùng lại stepper); làm song song được với phần còn lại của Epic 3.

### Epic 5 (SHOULD): Vận hành sâu hơn
Lịch sử trạng thái, Sổ kho đối soát, bộ đếm và hàng sắp hết, yêu cầu hủy từ khách, cảnh báo đơn đứng yên. Mỗi story độc lập.
**FRs covered:** FR-19, FR-20, FR-21, FR-22, FR-23
**AD:** AD-3, AD-9, AD-10, AD-12, AD-16

**Thứ tự:** E1 → (E2 song song) → 3.1 → phần còn lại của E3 ∥ E4 → E5.

**Quy ước cho mọi story:** sau khi xong, `npm run check` xanh mà không sửa assertion cũ (FR-4, SM-6); story đụng E2E thì `npm run test:e2e` cũng phải xanh. Dòng "Là…/Tôi muốn…/Để…" tương ứng As a/I want/So that của template.

## Epic 1: Tồn kho thật, sống qua restart

Đơn hàng và Tồn kho cùng nằm trong một file trạng thái, ghi nguyên tử và đi qua một khóa chung. Tồn kho còn nguyên sau restart. Cửa hàng đọc tồn kho thật. Đơn cũ không mất. Hành vi hiện có (FR-1..FR-4) giữ nguyên.

### Story 1.1: Kho trạng thái một file, ghi nguyên tử

Là chủ shop,
Tôi muốn mỗi lần lưu dữ liệu đều trọn vẹn hoặc không xảy ra,
Để máy tắt đột ngột hay lỗi đĩa không để lại file hỏng hoặc dữ liệu nửa vời.

**Truy vết:** FR-5, FR-9 (nền), NFR-1 · AD-3, AD-6, AD-10 (`looseObject`)
**File dự kiến:** `src/features/orders/state-schema.ts` (mới); `src/features/orders/order-repository.ts` (thêm `createJsonFileShopRepository` và port fs); `src/features/orders/order-repository.test.ts`
**Test bắt buộc:** unit/integration trong thư mục `mkdtemp`; không dùng đường dẫn mặc định.
**Phụ thuộc:** không có.

**Acceptance Criteria:**

**Given** một `ShopState` `{schemaVersion:1, orders, inventory, inventoryBaseline}`
**When** adapter commit trạng thái
**Then** dữ liệu được ghi ra `‹file›.tmp`, gọi `FileHandle.sync`, rồi `rename` sang `STORE_FILE`
**And** trên Linux/macOS thư mục được fsync; trên win32 bỏ bước fsync thư mục.

**Given** port fs được cấu hình `failNextCommit` (ném lỗi trước `rename`)
**When** commit bị lỗi giữa chừng
**Then** `STORE_FILE` cũ còn nguyên từng byte
**And** một repository mới mở trên cùng file (mô phỏng restart) đọc ra đúng trạng thái trước lần commit hỏng.

**Given** `rename` ném `EPERM`, `EACCES` hoặc `EBUSY` vài lần rồi mới thành công (giả lập Windows có reader đang mở file)
**When** commit
**Then** adapter thử lại `rename` và commit thành công
**And** khi hết số lần thử thì ném lỗi, file cũ còn nguyên.

**Given** một file `‹file›.tmp` sót lại từ lần tiến trình chết trước đó
**When** đọc store rồi commit lần kế tiếp
**Then** lần đọc bỏ qua file tạm; lần commit ghi đè nó; dữ liệu cũ trong file tạm không lọt vào store.

**Given** điểm chèn lỗi (`failNextCommit`, port fs giả)
**When** tạo repository
**Then** chỉ đưa vào được qua tham số deps của factory, không qua biến môi trường; `server.ts` không bao giờ truyền nó.

**Given** file trạng thái có trường lạ trên đơn (ví dụ `foo: 1`) hoặc ở gốc
**When** đọc rồi ghi lại
**Then** trường lạ vẫn còn (schema dùng `z.looseObject`).

**Given** file trạng thái là JSON hỏng hoặc sai schema
**When** đọc
**Then** ném lỗi và không ghi đè file.

### Story 1.2: Khóa chung cho đọc/ghi, đặt và hủy đơn không đè nhau

Là chủ shop,
Tôi muốn hai đơn đặt cùng lúc, hay một lần khách hủy trùng với một lần ghi khác, không làm mất thay đổi của nhau,
Để không đơn nào biến mất khi cửa hàng đông khách.

**Truy vết:** FR-1, FR-2, FR-4, NFR-1 · AD-2, AD-4, AD-8
**File dự kiến:** `src/features/orders/mutex.ts` (mới); `order-repository.ts` (`readState` và `update(mutator)` cho cả adapter file lẫn in-memory); `order-service.ts` (`placeOrder`, `cancelOrder` đi qua `update`); `order-service.test.ts`; `src/app/api/orders/route.test.ts` (không sửa assertion)
**Test bắt buộc:** unit cho mutex; integration tương tranh trên repo file.
**Phụ thuộc:** Story 1.1.

**Acceptance Criteria:**

**Given** mutex là singleton trên `globalThis`, khóa theo `path.resolve(file)` (lowercase trên win32)
**When** hai lần `update` trên cùng file chạy đồng thời
**Then** chúng chạy tuần tự, và mutator thứ hai thấy kết quả của mutator thứ nhất
**And** mutator ném lỗi thì không commit gì và không làm kẹt khóa cho lần sau.

**Given** một mutator sửa trực tiếp object `state` rồi ném lỗi
**When** `update` chạy trên adapter in-memory và adapter file
**Then** mutator nhận bản sao (`structuredClone`) nên cả hai adapter giữ nguyên state cũ; cùng một test chạy trên cả hai adapter.

**Given** 20 lệnh `placeOrder` gửi đồng thời trên repo file
**When** tất cả hoàn tất
**Then** file trạng thái có đủ 20 đơn, không mất đơn nào.

**Given** `createOrderService({ repository, … })`
**When** story hoàn tất
**Then** chữ ký giữ nguyên; `save` chỉ còn dùng cho insert và setup test
**And** repo in-memory có `readState`/`update` tương đương, để test chạy không cần file.

**Given** `POST /api/orders` có kèm trường giá trong `items`
**When** tạo đơn
**Then** giá vẫn lấy từ catalog; phí giao 30.000 ₫, 0 ₫ khi `subtotal ≥ 500.000 ₫`, giao nhanh 60.000 ₫ (FR-1).

**Given** một đơn `pending`
**When** khách gửi `PATCH /api/orders/:id {status:"cancelled"}`
**Then** đơn chuyển `cancelled` qua `update`
**And** đơn `confirmed|shipping|delivered|cancelled` trả 409 `INVALID_STATUS_TRANSITION`, body khác trả 400 `VALIDATION_ERROR`; route và hành vi không đổi (FR-2, AD-8).

### Story 1.3: Cô lập dữ liệu khi chạy E2E

Là người phát triển,
Tôi muốn E2E chạy trên một thư mục dữ liệu riêng, được dọn sạch mỗi lần chạy,
Để test không ghi vào `storage/` thật và không làm hỏng lẫn nhau.

**Truy vết:** SM-5, SM-6, FR-3 (E2E) · AD-19
**File dự kiến:** `playwright.config.ts`, `.gitignore`
**Test bắt buộc:** `npm run test:e2e` xanh (`shopping-flow.spec.ts`).
**Phụ thuộc:** không có.
**Ghi chú:** đặt story này trước lần chuyển sang file trạng thái, để lần chuyển đó không bao giờ đụng vào `storage/` thật.

**Acceptance Criteria:**

**Given** `playwright.config.ts`
**When** config được nạp
**Then** thư mục `.e2e/` bị xóa ở top-level **chỉ trong tiến trình chính** (có điều kiện bảo vệ, ví dụ `if (!process.env.TEST_WORKER_INDEX)`), trước khi `webServer` khởi động
**And** `webServer.env` đặt `STORE_FILE=.e2e/shop-store.json`, `ORDERS_FILE=.e2e/legacy-orders.json` (file không tồn tại), cùng `STAFF_PINS` và `STAFF_SESSION_SECRET` có giá trị test
**And** `reuseExistingServer: false`.

**Given** chạy `npx playwright test --workers=2`
**When** các worker nạp lại config
**Then** store của server không bị xóa giữa chừng; `shopping-flow.spec.ts` xanh.
**And** dev kiểm chứng việc worker nạp lại `playwright.config.ts` trên Playwright 1.64.

**Given** config có thêm một project viewport 360×800
**When** chạy `npm run test:e2e`
**Then** project này được dành cho các spec Hàng đợi và Trang theo dõi về sau, và không làm hỏng `shopping-flow.spec.ts`.

**Given** dev server đang chạy (Next 16 giữ `.next/dev/lock`)
**When** người phát triển muốn chạy E2E
**Then** comment trong config ghi rõ phải tắt dev server trước.

**Given** `.gitignore`
**When** story hoàn tất
**Then** file có các dòng `.e2e/` và `storage/`.

### Story 1.4: Chuyển sang file trạng thái, giữ đơn cũ, chỉ một tiến trình

Là chủ shop,
Tôi muốn lần đầu chạy bản mới thì mọi đơn cũ trong `orders.json` được chuyển sang file trạng thái, và chỉ một server được chạy trên file đó,
Để không mất đơn nào và không có hai tiến trình ghi đè nhau.

**Truy vết:** FR-4, FR-5, FR-18 (đọc) · AD-5, AD-15
**File dự kiến:**
- `src/features/orders/server.ts`: đọc `STORE_FILE` (mặc định `storage/shop-store.json`); `ORDERS_FILE` chỉ dùng cho lần nhập đầu.
- `order-repository.ts`: `ensureInitialized`, `importLegacyOrders`, PID lock. `createJsonFileOrderRepository` giữ hành vi, kiểu trả về đổi thành `LegacyOrderFile`.

**Test bắt buộc:** integration trên `mkdtemp` cho từng nhánh nhập; test PID lock.
**Phụ thuộc:** Story 1.2, Story 1.3.

**Acceptance Criteria:**

**Given** chưa có `STORE_FILE`, và `ORDERS_FILE` chứa 3 đơn hợp lệ
**When** thao tác đầu tiên chạy
**Then** `ensureInitialized()` chạy trong mutex, kiểm tra lại `STORE_FILE` sau khi lấy khóa, rồi tạo store gồm 3 đơn nguyên trạng, với `inventory = inventoryBaseline = stock` trong `products.ts`
**And** từ lúc đó không ghi `orders.json` nữa.

**Given** không có cả `STORE_FILE` lẫn `ORDERS_FILE`
**When** khởi tạo
**Then** store được tạo với `orders: []` và tồn kho lấy từ `products.ts`.

**Given** `ORDERS_FILE` tồn tại nhưng không phải mảng `Order` hợp lệ
**When** khởi tạo
**Then** ném lỗi và không tạo store; route trả 500 qua `handleRouteError`, không ghi đè gì.

**Given** hai request đầu tiên đến đồng thời
**When** cả hai gọi `ensureInitialized`
**Then** việc nhập chỉ chạy đúng một lần.

**Given** một tiến trình đang giữ PID lock của `STORE_FILE`
**When** tiến trình thứ hai mở cùng store
**Then** tiến trình thứ hai bị từ chối kèm thông điệp rõ ràng
**And** lock của tiến trình đã chết (PID không còn) được thu hồi.

**Given** module `server.ts` được import (kể cả khi `next build` gom dữ liệu trang)
**When** chưa có thao tác đọc/ghi nào
**Then** chưa lấy PID lock và chưa tạo file nào trong `storage/`; lock lấy **lười** ở thao tác đầu tiên
**And** cùng một PID lấy lại lock (HMR của `next dev`) thì thành công.

**Given** `/orders` và `/orders/[id]`, với dữ liệu nhập từ `orders.json` chỉ có trường cũ
**When** mở trang
**Then** không lỗi 500 (FR-18).

**Câu hỏi mở:** lịch sao lưu và thời gian lưu giữ `shop-store.json` do chủ shop quyết. Copy file khi server đang chạy là an toàn.
**Rủi ro chấp nhận:** Windows có thể cấp lại PID của tiến trình đã chết cho tiến trình khác, khi đó lock cũ bị coi là còn sống. Cách xử lý: xóa file lock bằng tay khi server đã dừng.

### Story 1.5: Mô hình Order ghi lịch sử từ ngày đầu

Là khách và chủ shop,
Tôi muốn mỗi đơn mới và mỗi lần khách tự hủy đều để lại Mốc giờ trong lịch sử,
Để về sau Trang theo dõi và Hàng đợi hiện được giờ thật, không phải bịa.

**Truy vết:** FR-4, FR-7 (actor "khách"), FR-18 · AD-10
**File dự kiến:** `src/features/orders/types.ts` (`StatusChange`, `Actor`, `CancelReason`, `CANCEL_REASON_LABELS`, và các trường tùy chọn `cancellation`, `stockApplied`, `flags`, `statusHistory`); `state-schema.ts`; `order-service.ts`
**Test bắt buộc:** unit cho schema và cho `placeOrder`/`cancelOrder`.
**Phụ thuộc:** Story 1.4.
**Ngoài phạm vi:** `describeStatusChange` và các chuỗi hiển thị (thuộc Epic 3 và Epic 4).

**Acceptance Criteria:**

**Given** khách đặt một đơn mới
**When** `placeOrder` thành công
**Then** đơn có `statusHistory = [{ to: "pending", at: createdAt, actor: { kind: "customer" } }]`.

**Given** khách tự hủy một đơn `pending`
**When** `cancelOrder` thành công
**Then** `statusHistory` có thêm `{ from: "pending", to: "cancelled", at, actor: { kind: "customer" } }`
**And** Tồn kho không đổi (FR-2).

**Given** một đơn cũ không có `statusHistory`, `cancellation` hay `flags`
**When** đọc qua schema
**Then** parse thành công, vì mọi trường mới đều tùy chọn.

**Given** response của `GET/POST /api/orders` và `GET /api/orders/:id`
**When** so với trước story
**Then** mọi trường cũ giữ nguyên tên và kiểu; chỉ có trường mới được thêm vào (FR-4).

### Story 1.6: Đặt hàng kiểm tra Tồn kho lưu bền

Là khách,
Tôi muốn hệ thống từ chối số lượng vượt tồn kho thật ngay lúc tôi đặt hàng,
Để tôi không đặt món mà shop không còn.

**Truy vết:** FR-3, FR-5 · AD-9
**File dự kiến:** `src/features/inventory/stock.ts` (mới: `checkShortfall`, `reconcileInventoryKeys`); `src/features/inventory/types.ts`; `order-service.ts` (mutator của `placeOrder` đọc `state.inventory`)
**Test bắt buộc:** unit `stock.ts`; integration `placeOrder`.
**Phụ thuộc:** Story 1.5.

**Acceptance Criteria:**

**Given** Tồn kho lưu bền của X = 1
**When** khách đặt X×2
**Then** trả 409 `INSUFFICIENT_STOCK`, thông điệp giữ nguyên như hiện tại
**And** không đơn nào được tạo; Tồn kho không đổi, vì đặt hàng không trừ kho.

**Given** `products.ts` có sản phẩm mới chưa có trong `inventory`, hoặc `inventory` có id không còn trong catalog
**When** store được đọc
**Then** `reconcileInventoryKeys` thêm sản phẩm mới với tồn kho = `stock` khai báo (và cộng vào `inventoryBaseline`), giữ nguyên id thừa; không bao giờ ra `NaN` hay số âm.

**Given** server vừa restart
**When** đọc Tồn kho
**Then** giá trị bằng lần commit gần nhất (FR-5).

### Story 1.7: Cửa hàng hiển thị tồn kho thật

Là khách,
Tôi muốn trang sản phẩm, bộ lọc "còn hàng" và giỏ hàng dùng tồn kho thật,
Để tôi không thấy "Còn hàng" cho món đã hết.

**Truy vết:** FR-3, FR-4 · AD-9
**File dự kiến:**
- `inventory/stock.ts` (`withLiveStock`).
- `src/features/catalog/catalog-service.ts`: thêm tham số `source` cho `getProductBySlug`, `getFeaturedProducts`, `getRelatedProducts`, `queryProducts`.
- `src/app/page.tsx`, `src/app/products/page.tsx`, `src/app/products/[slug]/page.tsx`: dùng `force-dynamic`; trang chi tiết bỏ `generateStaticParams`.
- `src/app/api/products/route.ts`, `src/app/api/products/[slug]/route.ts`.
- `catalog-service.test.ts`.

**Test bắt buộc:** unit `withLiveStock` và catalog có `source`; E2E `shopping-flow.spec.ts` xanh.
**Phụ thuộc:** Story 1.6.

**Acceptance Criteria:**

**Given** Tồn kho lưu bền của X = 0 (đặt bằng fixture)
**When** mở `/products/[slug]` của X
**Then** `StockBadge` hiện "Hết hàng"
**And** `GET /api/products?inStock=true` không trả X.

**Given** Tồn kho lưu bền của X = 3 (`LOW_STOCK_THRESHOLD = 5`)
**When** mở trang của X
**Then** hiện "Chỉ còn 3 sản phẩm", và giỏ hàng không cho số lượng vượt 3 (`getMaxQuantity`, trần vẫn là 10).

**Given** store hỏng hoặc không đọc được
**When** mở trang sản phẩm hoặc gọi `/api/products*`
**Then** trả lỗi (trang `error.tsx` / 500 qua `handleRouteError`), **không bao giờ** quay về `stock` của `products.ts`.

**Given** catalog-service
**When** gọi mà không truyền `source`
**Then** hàm vẫn đồng bộ và đọc `products.ts` như cũ; test catalog hiện có xanh mà không sửa assertion.

**Given** response `GET /api/products*`
**When** so với trước story
**Then** shape giữ nguyên; chỉ giá trị `stock` lấy từ Tồn kho lưu bền (FR-4).

### Story 1.8: Chủ shop đặt lại tồn kho bằng lệnh

Là chủ shop,
Tôi muốn đặt lại tồn kho của một số sản phẩm bằng một lệnh,
Để khi nhập hàng về, con số trên web đúng mà không phải sửa file bằng tay.

**Truy vết:** FR-5 (Out of Scope), SM-2 · AD-16
**File dự kiến:** `scripts/stock-set.ts` (mới); `package.json` (script `stock:set`)
**Test bắt buộc:** integration chạy hàm của script trên `mkdtemp`.
**Phụ thuộc:** Story 1.6.

**Acceptance Criteria:**

**Given** store có Tồn kho p004 = 2 và baseline p004 = 5
**When** chạy `npm run stock:set -- p004=10`
**Then** `inventory.p004 = 10`, và `inventoryBaseline.p004` được cộng thêm phần chênh lệch (+8)
**And** lệnh đi qua `update` và tôn trọng PID lock.

**Given** server đang chạy và giữ PID lock
**When** chạy `stock:set`
**Then** lệnh dừng với thông điệp yêu cầu tắt server trước, không ghi gì.

**Given** tham số sai (id không có trong catalog, số âm, hoặc không phải số nguyên)
**When** chạy lệnh
**Then** lệnh báo lỗi cho từng tham số và không ghi gì.

**Đã chốt:** PRD FR-5 đã được sửa để dùng `npm run stock:set` (AD-16).

## Epic 2: Khu nhân viên và Hàng đợi

Nhân viên đăng nhập bằng PIN và vào một khu làm việc riêng, tách khỏi cửa hàng, để xem Hàng đợi có Đèn tồn kho. Ở cuối epic này thẻ đơn **chưa có nút hành động**; nút đến ở Epic 3. Đây là điểm review đã được chấp nhận, không phải lỗi.

### Story 2.1: Cấu hình nhân viên và phiên đăng nhập có ký

Là chủ shop,
Tôi muốn khai báo danh sách nhân viên cùng PIN trong cấu hình server, và phiên đăng nhập không thể bị giả mạo,
Để chỉ người của shop vào được Khu nhân viên, và biết ai đã thao tác.

**Truy vết:** FR-6, NFR-4 · AD-13, AD-17 (`UNAUTHORIZED`)
**File dự kiến:** `src/features/staff/staff-config.ts` (mới), `src/features/staff/session.ts` (mới), `src/features/orders/order-errors.ts` (thêm `UNAUTHORIZED` → 401), các file `*.test.ts` cạnh mỗi file
**Test bắt buộc:** unit cho parse cấu hình, so PIN, ký và xác minh cookie.
**Phụ thuộc:** không có (song song với Epic 1).

**Acceptance Criteria:**

**Given** `STAFF_PINS="An:123456,Hoa:654321"` và `STAFF_SESSION_SECRET` dài ≥ 32 ký tự
**When** `staff-config.ts` parse bằng Zod
**Then** nhận 2 Nhân viên
**And** PIN phải có 6–8 chữ số; tên trùng hoặc PIN trùng bị coi là cấu hình sai.

**Given** thiếu `STAFF_PINS`, thiếu `STAFF_SESSION_SECRET`, hoặc cấu hình sai
**When** hệ thống đọc cấu hình
**Then** trả trạng thái "chưa cấu hình", mọi lần kiểm PIN đều thất bại (Khu nhân viên đóng, không mở tự do).

**Given** một PIN gửi lên
**When** so với cấu hình
**Then** so `HMAC-SHA256(secret, pin)` với digest của **từng** PIN bằng `timingSafeEqual` (độ dài cố định), duyệt hết danh sách
**And** PIN độ dài bất kỳ cũng không làm `timingSafeEqual` ném lỗi.

**Given** Nhân viên "An" vừa đăng nhập
**When** tạo phiên
**Then** cookie `shoplite_staff = base64url(JSON{name, exp}).base64url(HMAC)`, `httpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 12 giờ; thêm `Secure` khi `NODE_ENV=production`.

**Given** cookie bị sửa chữ ký, đã quá `exp`, hoặc mang `name` không còn trong `STAFF_PINS`
**When** xác minh
**Then** phiên không hợp lệ.

**Given** `OrderError("UNAUTHORIZED", …)`
**When** đi qua `handleRouteError`
**Then** trả 401 `{ error: { code: "UNAUTHORIZED", message } }`.

**Given** mọi đường lỗi ở trên
**When** ghi log
**Then** PIN và secret không bao giờ xuất hiện trong log hay response.

### Story 2.2: Đăng nhập, đăng xuất và chống dò PIN

Là Nhân viên,
Tôi muốn đăng nhập bằng PIN và đăng xuất qua API, trong khi người lạ không thể dò PIN nhanh,
Để Khu nhân viên vừa dùng tiện vừa an toàn.

**Truy vết:** FR-6, NFR-4 · AD-13, AD-14, AD-17
**File dự kiến:** `src/app/api/staff/session/route.ts` (mới: `POST`, `DELETE`), `src/features/staff/login-throttle.ts` (mới), `src/features/staff/server.ts` (mới: `requireStaff`), các test cạnh file
**Test bắt buộc:** unit cho throttle (dùng đồng hồ giả); integration cho route.
**Phụ thuộc:** Story 2.1.

**Acceptance Criteria:**

**Given** PIN đúng của An
**When** `POST /api/staff/session {pin}`
**Then** trả 204 kèm `Set-Cookie` phiên của An.

**Given** PIN sai, hoặc Khu nhân viên chưa cấu hình
**When** `POST /api/staff/session`
**Then** trả 401 `UNAUTHORIZED` với thông điệp luôn là "PIN không đúng" (hoặc "Khu nhân viên chưa được cấu hình" khi thiếu cấu hình), không lộ PIN có thuộc ai hay không.

**Given** body không phải JSON hoặc thiếu `pin`
**When** `POST`
**Then** trả 400 `VALIDATION_ERROR` qua `readJsonBody` và Zod.

**Given** `n` lần sai toàn cục trong 15 phút gần nhất
**When** có lần kiểm PIN tiếp theo
**Then** mọi lần kiểm chạy **tuần tự** qua mutex của `login-throttle.ts`; sau mỗi lần sai, mutex bị giữ thêm `min(1s × 2^(n−1), 30s)`
**And** đăng nhập đúng đặt `n = 0`; không khóa cứng, không dựa vào IP hay `x-forwarded-for`, không thêm mã lỗi mới.

**Given** đang có phiên
**When** `DELETE /api/staff/session`
**Then** trả 204 và xóa cookie.

**Given** một handler `/api/staff/**` (ngoài `session`) gọi `requireStaff()`
**When** request không có phiên hợp lệ
**Then** trả 401 `UNAUTHORIZED`
**And** khi có phiên, `requireStaff()` trả `{ name }` lấy từ cookie, không bao giờ lấy từ body.

**Given** body của `/api/staff/session`
**When** có lỗi xảy ra
**Then** không log body.

**Given** đã có 5 lần kiểm PIN đang chờ mutex
**When** một `POST /api/staff/session` mới đến
**Then** trả ngay 401 `UNAUTHORIZED` "Đang có nhiều lần thử, vui lòng thử lại sau" mà không vào hàng chờ (AD-14 đã cập nhật)
**And** sau khi hàng chờ vơi đi, Nhân viên đăng nhập bằng PIN đúng thì thành công.

### Story 2.3: Trang đăng nhập PIN và bảo vệ route `/staff/*`

Là Nhân viên,
Tôi muốn mở bookmark `/staff` thì được đưa tới ô nhập PIN, rồi quay lại đúng trang đang muốn vào,
Để vào ca nhanh bằng một tay.

**Truy vết:** FR-6 · AD-13, AD-18 (401 → login) · UX-DR2, UX-DR17
**File dự kiến:** `src/proxy.ts` (mới, matcher `/staff/:path*`), `src/app/staff/login/page.tsx` (+ client form), `src/app/staff/(protected)/layout.tsx` (gọi `requireStaff()`, nếu không có phiên thì redirect), `src/app/staff/(protected)/page.tsx` (tạm thời: tiêu đề Hàng đợi)
**Test bắt buộc:** unit cho hàm kiểm `next`; E2E đăng nhập đúng/sai ở viewport 360.
**Phụ thuộc:** Story 2.2, Story 1.3.

**Acceptance Criteria:**

**Given** chưa có cookie phiên
**When** mở `/staff` hoặc `/staff/orders/X`
**Then** `proxy.ts` chuyển tới `/staff/login?next=<path>`
**And** cookie có nhưng sai hoặc hết hạn thì thêm `&reason=expired`; trang login hiện "Phiên đã hết hạn, vui lòng nhập lại PIN".

**Given** `/staff/login`
**When** proxy chạy
**Then** cho qua ngay, không tạo vòng lặp redirect.

**Given** proxy bị bỏ qua (gọi thẳng)
**When** render `(protected)/layout.tsx` mà không có phiên hợp lệ
**Then** `requireStaff()` redirect `/staff/login`. Đây mới là kiểm tra quyết định.

**Given** form PIN
**When** hiển thị
**Then** có `<label>` "Mã PIN", ô `inputmode="numeric"` `text-2xl` chữ cách rộng, nút primary `lg` rộng hết thẻ "Vào Hàng đợi"; Enter để gửi (DESIGN.md "PIN form").

**Given** PIN sai (401)
**When** gửi
**Then** ô bị xóa, focus quay lại ô, hiện "PIN không đúng" với `role="alert"`.

**Given** PIN đúng và `next=/staff/orders/X`
**When** đăng nhập xong
**Then** điều hướng tới `/staff/orders/X`.

**Given** `next` không bắt đầu bằng `/staff`, hoặc chứa `//` hay `\`
**When** đăng nhập xong
**Then** điều hướng tới `/staff` (chặn open redirect).

**Given** Khu nhân viên chưa cấu hình
**When** mở `/staff/login`
**Then** hiện "Khu nhân viên chưa được cấu hình", không có ô nhập.

**Given** lỗi mạng hoặc 500 khi gửi
**When** form nhận lỗi
**Then** hiện "Không thực hiện được, vui lòng thử lại" và nút bật lại.

### Story 2.4: Khung Khu nhân viên tách khỏi cửa hàng

Là Nhân viên,
Tôi muốn Khu nhân viên có header tối riêng với tên mình, nút làm mới và nút đăng xuất,
Để luôn biết mình đang ở khu làm việc, và rời ca an toàn.

**Truy vết:** FR-6, FR-13 (làm mới) · AD-13, AD-18, AD-20 · UX-DR1, UX-DR16
**File dự kiến:** `src/app/layout.tsx` (chỉ còn `html/body`/font), `src/app/(shop)/layout.tsx` (mới: Header + `<main>` + Footer của cửa hàng; các trang cửa hàng hiện có được chuyển vào `(shop)/`, URL không đổi), `src/app/staff/(protected)/layout.tsx` (Staff header), `src/features/staff/components/staff-header.tsx` (mới)
**Test bắt buộc:** E2E `shopping-flow.spec.ts` xanh (URL không đổi); E2E: đăng xuất xong mở `/staff` thì bị chuyển về login.
**Phụ thuộc:** Story 2.3.
**Ghi chú:** route group `(shop)` nay là **AD-20** trong spine (Toantv duyệt 2026-11-21).

**Acceptance Criteria:**

**Given** một trang `/staff/*` đã đăng nhập
**When** render
**Then** chỉ có Staff header: cao 3.5rem, nền `slate-900`, chữ trắng; bên trái là ô logo indigo + "Khu nhân viên"; bên phải là tên Nhân viên, nút làm mới (icon `RefreshCw`, có nhãn cho trình đọc màn hình) và nút ghost "Đăng xuất"
**And** không có Header, Footer, giỏ hàng hay link nào sang cửa hàng.

**Given** các trang cửa hàng (`/`, `/products`, `/cart`, `/checkout`, `/orders`, `/orders/[id]`)
**When** render sau khi tách layout
**Then** giữ nguyên Header/Footer và giao diện như trước; cửa hàng không có link nào sang Khu nhân viên.

**Given** Nhân viên chạm "Đăng xuất"
**When** `DELETE /api/staff/session` trả 204
**Then** điều hướng tới `/staff/login`.

**Given** Nhân viên chạm nút làm mới
**When** chạm
**Then** `startTransition(() => router.refresh())`, không tải lại toàn trang; không có tự làm mới định kỳ (OQ-5 đã chốt).

**Given** focus bàn phím trên header tối
**When** Tab qua các nút
**Then** outline focus màu trắng nhìn thấy được.

### Story 2.5: Hàng đợi chỉ đọc, có Đèn tồn kho

Là Nhân viên,
Tôi muốn mở Hàng đợi trên điện thoại là thấy các đơn cần xử lý theo nhóm, đơn chờ lâu nhất trên cùng, và biết đơn nào đủ hàng,
Để biết ngay phải xử lý đơn nào trước.

**Truy vết:** FR-13, FR-14, FR-18 · AD-9 (`getStockLight`), AD-18 · UX-DR3, UX-DR4, UX-DR5, UX-DR13, UX-DR16 · mockup `key-staff-queue.html`
**File dự kiến:** `src/app/staff/(protected)/page.tsx`, `src/app/staff/(protected)/loading.tsx`, `src/features/orders/timeline.ts` (mới: `enteredCurrentStatusAt`, `formatWaiting`), `src/features/orders/queue.ts` (mới: `buildQueue`, hàm thuần), `src/features/inventory/stock.ts` (`getStockLight`), `src/features/staff/components/queue-group.tsx`, `queue-order-card.tsx`, `stock-light.tsx`, các test cạnh file, `e2e/staff-queue.spec.ts` (mới)
**Test bắt buộc:** unit cho `buildQueue`, `getStockLight`, `formatWaiting`; E2E ở viewport 360.
**Phụ thuộc:** Story 2.4, Story 1.6.
**Ngoài phạm vi:** nút hành động trên thẻ, việc khóa nút và `aria-describedby` (Epic 3).

**Acceptance Criteria:**

**Given** các đơn `pending`, `confirmed`, `shipping`, `delivered`, `cancelled`
**When** mở `/staff`
**Then** hiện ba nhóm cố định theo thứ tự Chờ xác nhận → Đã xác nhận → Đang giao, nhãn lấy từ `ORDER_STATUS_LABELS`, mỗi nhóm có chip đếm
**And** đơn `delivered` và `cancelled` không xuất hiện.

**Given** hai đơn `pending` tạo lúc 20:00 và 21:00
**When** xếp nhóm
**Then** đơn 20:00 nằm trên
**And** thời điểm vào trạng thái hiện tại lấy từ bản ghi `statusHistory` cuối cùng; đơn cũ không có lịch sử thì dùng `createdAt` cho `pending` (FR-18). `[ASSUMPTION]` các trạng thái khác dùng `updatedAt`.

**Given** một thẻ đơn
**When** hiển thị
**Then** có mã đơn, "Chờ 11 giờ" (`text-xs` slate-500), badge trạng thái, emoji sản phẩm chồng nhau, tên khách, số món, tổng tiền (`formatCurrency`); thẻ có id `order-card-‹id›`, nhóm có id `queue-group-‹status›`
**And** chạm vào thân thẻ mở `/staff/orders/[id]`.

**Given** đơn `pending` X×2 và Tồn kho X = 2
**When** hiển thị
**Then** Đèn "Đủ hàng" màu emerald, icon `CircleCheck`, có chữ.

**Given** đơn `pending` X×2 (Micro thu âm) và Tồn kho X = 1
**When** hiển thị
**Then** Đèn "Thiếu hàng" màu rose, icon `TriangleAlert`, kèm dòng "Micro thu âm: cần 2, còn 1, thiếu 1"
**And** đơn `confirmed` và `shipping` không có Đèn.

**Given** một nhóm không có đơn
**When** hiển thị
**Then** vẫn có tiêu đề, chip "0" và dòng "Không có đơn"
**And** khi cả ba nhóm đều rỗng thì hiện `EmptyState` "✅" "Không còn đơn cần xử lý" / "Đơn mới sẽ hiện ở đây.", không có nút.

**Given** đang tải
**When** render
**Then** hiện skeleton 3 thẻ `animate-pulse rounded-2xl bg-slate-200/60`.

**Given** viewport 360×800 (E2E)
**When** mở Hàng đợi có đơn tên khách dài và đơn đèn đỏ
**Then** không cuộn ngang; tiêu đề nhóm dính dưới header khi cuộn; một cột `max-w-2xl px-4`.

**Given** một đơn cũ chỉ có các trường cũ
**When** Hàng đợi render
**Then** không lỗi 500; mốc thiếu hiện "—".

## Epic 3: Xử lý đơn an toàn từ Hàng đợi

Nhân viên đưa đơn đi theo đúng Bảng chuyển hợp lệ. Thao tác nào làm hàng thật thay đổi thì đổi Tồn kho trong cùng một thao tác nguyên tử. Thao tác lặp bị từ chối, kèm thông tin ai đã làm. Hủy đơn luôn có lý do. Thứ tự kiểm tra lỗi cố định theo AD-7: 400 shape → 404 → 409 cặp không hợp lệ → 409 CAS → 400 lý do → 409 thiếu hàng.

### Story 3.1: Xác nhận đơn trừ kho nguyên tử, từ chối thao tác lặp

Là Nhân viên,
Tôi muốn xác nhận một đơn thì kho bị trừ đúng một lần, kể cả khi đồng nghiệp bấm cùng lúc hoặc đĩa lỗi giữa chừng,
Để không bao giờ bán quá tồn kho.

**Truy vết:** FR-7 (Nhân viên), FR-8, FR-9, FR-10, SM-1 · AD-6, AD-7, AD-9, AD-10, AD-12 (`describeStatusChange`)
**File dự kiến:**
- `src/features/orders/order-transitions.ts` (mới): `ORDER_TRANSITIONS` và mutator thuần, đồng bộ.
- `src/features/inventory/stock.ts`: `deduct`.
- `src/features/orders/timeline.ts`: `describeStatusChange`.
- `src/features/orders/order-service.ts`: `transitionOrder(id, request, actor)`.
- Các file test cạnh mỗi file trên.

**Test bắt buộc:**
- unit cho bảng chuyển, mutator và `describeStatusChange`;
- integration chèn lỗi giữa chừng (AD-6);
- tranh món cuối đồng thời;
- hai Nhân viên xác nhận cùng lúc.

**Phụ thuộc:** Story 1.6. Kiểu `Actor` (gồm `{kind:"staff", name}`) đã có từ Story 1.5, nên story này không cần Epic 2.
**Ngoài phạm vi:** hủy kèm lý do (Story 3.2), route API (Story 3.3), UI.

**Acceptance Criteria:**

**Given** `ORDER_TRANSITIONS` chỉ gồm `pending→confirmed|cancelled`, `confirmed→shipping|cancelled`, `shipping→delivered|cancelled`
**When** yêu cầu `delivered→pending`, `pending→shipping`, `cancelled→*` hoặc `delivered→*`
**Then** ném 409 `INVALID_STATUS_TRANSITION`; đơn và kho không đổi.

**Given** đơn X×2, Y×1 với Tồn kho X=5, Y=3
**When** An gửi `transitionOrder(id, {from:"pending", to:"confirmed"}, {kind:"staff", name:"An"})`
**Then** trong một lần `update`: X=3, Y=2, đơn chuyển `confirmed`, `stockApplied = true`
**And** `statusHistory` có thêm `{from:"pending", to:"confirmed", at, actor:{kind:"staff", name:"An"}}`.

**Given** đơn X×2 với Tồn kho X=1
**When** xác nhận
**Then** ném 409 `INSUFFICIENT_STOCK`, `details` nêu số thiếu của từng dòng
**And** đơn vẫn `pending`, kho không đổi.

**Given** `confirmed→shipping` hoặc `shipping→delivered`
**When** thực hiện
**Then** Tồn kho không đổi; `statusHistory` ghi đúng actor và Mốc giờ.

**Given** port fs bật `failNextCommit` ngay trong lần commit của thao tác xác nhận
**When** thao tác thất bại và một repository mới mở lại cùng file (mô phỏng restart)
**Then** đơn vẫn `pending` và kho chưa trừ, không có trạng thái nửa vời (FR-9).

**Given** hai đơn `pending` cùng cần món cuối cùng (Tồn kho X=1)
**When** xác nhận cả hai đồng thời
**Then** đúng một đơn thành công; đơn kia nhận 409 `INSUFFICIENT_STOCK`; X = 0, không âm.

**Given** An và Hoa cùng gửi `{from:"pending", to:"confirmed"}` cho một đơn
**When** cả hai chạy đồng thời
**Then** một yêu cầu thành công, yêu cầu kia nhận 409 `INVALID_STATUS_TRANSITION` với thông điệp "Đã xác nhận bởi An lúc 08:05" (CAS trong mutex)
**And** kho chỉ bị trừ một lần. Bấm hai lần cũng cho kết quả như vậy.

**Given** `describeStatusChange(order)`
**When** đơn đã `shipping` bởi Hoa lúc 15:30, hoặc đơn cũ không có lịch sử
**Then** trả "Đã bắt đầu giao bởi Hoa lúc 15:30" hoặc "Đơn đã ở trạng thái ‹nhãn›"
**And** không bao giờ sinh ra "Đã đã…"; động từ lấy theo bảng của AD-12, giờ theo `Asia/Ho_Chi_Minh`.

**Given** dòng hàng có `productId` không có trong `inventory` (sản phẩm đã bị gỡ khỏi catalog)
**When** xác nhận hoặc tính Đèn
**Then** coi tồn kho là 0: 409 `INSUFFICIENT_STOCK`, đèn đỏ; không bao giờ ra `NaN`.

**Given** đơn không tồn tại
**When** gọi `transitionOrder`
**Then** ném 404 `ORDER_NOT_FOUND`.

### Story 3.2: Hủy đơn kèm lý do, hoàn kho, giao thất bại

Là Nhân viên,
Tôi muốn hủy một đơn bằng lý do chọn từ danh sách, và kho được hoàn đúng số đã trừ (đơn giao thất bại thì chỉ hoàn khi hàng đã về shop),
Để kho luôn khớp với hàng thật trên kệ.

**Truy vết:** FR-8, FR-11, FR-12, SM-2 · AD-7 (bước 5), AD-8, AD-9 (`restock`), AD-17 (quy tắc lý do)
**File dự kiến:** `order-transitions.ts` (`validateCancelReason`), `inventory/stock.ts` (`restock`), `order-service.ts`, các file test
**Test bắt buộc:** unit cho quy tắc lý do và `restock`; integration cho từng nhánh hủy.
**Phụ thuộc:** Story 3.1.

**Acceptance Criteria:**

**Given** đơn `confirmed` X×2 (`stockApplied = true`)
**When** Nhân viên hủy với `reason: "customer_changed_mind"`
**Then** trong một lần `update`: X tăng đúng 2, đơn chuyển `cancelled`, `cancellation = {reason, note?}` được lưu, `stockApplied = false`, và `statusHistory` có thêm một dòng với actor Nhân viên.

**Given** đơn `pending`
**When** Nhân viên hủy với `reason: "out_of_stock"`
**Then** đơn chuyển `cancelled`, Tồn kho không đổi.

**Given** hủy từ `pending` hoặc `confirmed`
**When** thiếu `reason`, `reason` không thuộc `{out_of_stock, customer_changed_mind, unreachable, other}`, hoặc `other` mà thiếu `note`
**Then** ném 400 `VALIDATION_ERROR`; đơn và kho không đổi.

**Given** đơn `shipping`
**When** hủy mà không có `reason: "delivery_failed"` kèm `returnedToShop: true`
**Then** ném 400 `VALIDATION_ERROR`; Tồn kho không đổi.

**Given** đơn `shipping` X×2
**When** hủy với `reason: "delivery_failed"` và `returnedToShop: true`
**Then** X được hoàn đúng 2, đơn chuyển `cancelled`.

**Given** một chuyển không phải hủy (ví dụ `pending→confirmed`)
**When** request có kèm `reason`
**Then** ném 400 `VALIDATION_ERROR`.

**Given** hai yêu cầu cùng có lỗi cặp chuyển và thiếu lý do
**When** kiểm tra
**Then** lỗi trả về theo đúng thứ tự AD-7, nghĩa là 409 cặp không hợp lệ đi trước 400 lý do.

**Given** đường hủy của khách `cancelOrder`
**When** story hoàn tất
**Then** đường này không đổi và không nhận `reason` (AD-8).

**Đã chốt (OQ-3):** v1 không có cờ `packed`. `confirmed` được coi là chưa đóng gói, nên hủy luôn hoàn kho.

### Story 3.3: API chuyển trạng thái cho Nhân viên

Là Nhân viên,
Tôi muốn một endpoint duy nhất để chuyển trạng thái, có kiểm phiên và trả lỗi rõ ràng,
Để mọi màn hình dùng chung một hợp đồng.

**Truy vết:** FR-4, FR-6, FR-8..FR-12 · AD-13, AD-17
**File dự kiến:** `src/app/api/staff/orders/[id]/transitions/route.ts` (mới), `src/features/orders/transition-schema.ts` (mới), `route.test.ts` cạnh route
**Test bắt buộc:** integration cho route với repository in-memory, mỗi mã lỗi một ca.
**Phụ thuộc:** Story 3.2, Story 2.2.

**Acceptance Criteria:**

**Given** request không có phiên hợp lệ
**When** gọi `POST /api/staff/orders/:id/transitions`
**Then** trả 401 `UNAUTHORIZED`, và `requireStaff()` chạy trước mọi việc khác.

**Given** phiên của An
**When** gửi `{from:"pending", to:"confirmed"}`
**Then** trả 200 cùng `Order` đầy đủ, actor lấy từ phiên
**And** trường `actor` hay tên gửi trong body đều bị bỏ qua.

**Given** body không phải JSON, `from`/`to` không thuộc `ORDER_STATUSES`, `reason` lạ, hoặc `note` không nằm trong khoảng 1–200 ký tự
**When** gửi
**Then** trả 400 `VALIDATION_ERROR` qua `readJsonBody` và Zod (`z.object`, không `discriminatedUnion`).

**Given** mã đơn không tồn tại, cặp chuyển không hợp lệ, CAS lệch, hoặc thiếu hàng
**When** gửi
**Then** trả lần lượt 404 `ORDER_NOT_FOUND`, 409 `INVALID_STATUS_TRANSITION`, 409 `INVALID_STATUS_TRANSITION` kèm "Đã xác nhận bởi …", 409 `INSUFFICIENT_STOCK` kèm `details`
**And** mọi lỗi có dạng `{error:{code, message, details?}}` qua `handleRouteError`.

**Given** endpoint khách `PATCH /api/orders/:id`
**When** story hoàn tất
**Then** endpoint đó không đổi và test hiện có xanh (FR-2).

### Story 3.4: Một chạm Xác nhận / Bắt đầu giao / Đã giao trên Hàng đợi

Là Nhân viên,
Tôi muốn chạm một lần trên thẻ đơn để đi bước tiếp theo, và thấy thẻ chuyển nhóm ngay sau khi server trả lời,
Để xử lý hết Hàng đợi buổi sáng trong vài phút.

**Truy vết:** FR-13 (đổi nhóm), FR-14 (khóa nút), FR-15, SM-3 · AD-18 · UX-DR4..UX-DR8, UX-DR17 · mockup `key-staff-queue.html` (xung đột + đang gửi) · UJ-1
**File dự kiến:**
- `src/features/staff/components/transition-button.tsx` (mới, client).
- `src/features/staff/components/queue-notice-provider.tsx` (mới): Conflict notice theo `orderId`, `nextFocusTarget`.
- `src/features/staff/components/conflict-notice.tsx`.
- `queue-order-card.tsx`.
- `e2e/staff-queue.spec.ts`.

**Test bắt buộc:**
- unit cho `nextActionFor(status)` và `nextFocusTarget`;
- E2E ở viewport 360: xác nhận một đơn đèn xanh trong một chạm, dưới 10 giây;
- E2E hai browser context xác nhận cùng một đơn.

**Phụ thuộc:** Story 3.3, Story 2.5.

**Acceptance Criteria:**

**Given** thẻ `pending` (đèn xanh), `confirmed`, `shipping`
**When** hiển thị
**Then** cuối thẻ có một nút primary `lg` rộng hết thẻ, lần lượt "Xác nhận", "Bắt đầu giao", "Đã giao"; chạm một lần là gửi, không hỏi lại.

**Given** thẻ `pending` đèn đỏ
**When** hiển thị
**Then** nút Xác nhận bị disabled, có `aria-describedby` trỏ tới dòng "Không đủ hàng để xác nhận".

**Given** Nhân viên chạm "Xác nhận"
**When** đang chờ server
**Then** nút đổi thành "Đang xác nhận…" và mọi nút trên thẻ bị disabled; UI không đổi trước khi có phản hồi (không optimistic).

**Given** server trả 200
**When** `startTransition(() => router.refresh())` xong
**Then** thẻ nằm ở nhóm kế tiếp, chip đếm cập nhật
**And** focus chuyển sang thẻ kế tiếp trong nhóm cũ; nhóm cũ hết thẻ thì focus sang tiêu đề nhóm.

**Given** Hoa và An cùng xác nhận một đơn (hai context)
**When** yêu cầu của Hoa nhận 409 `INVALID_STATUS_TRANSITION`
**Then** thẻ của Hoa hiện Conflict notice (nền sky, icon `Info`, `role="status"`) "Đã xác nhận bởi An lúc 08:05", rồi refresh và nằm ở nhóm Đã xác nhận
**And** notice còn sau refresh, chỉ ẩn khi cuộn hoặc bấm nút làm mới.

**Given** server trả 409 `INSUFFICIENT_STOCK` (đèn đã cũ)
**When** refresh xong
**Then** đèn chuyển đỏ kèm số thiếu và nút bị khóa.

**Given** lỗi mạng hoặc 500
**When** gửi
**Then** **không** refresh; dòng `text-rose-700` "Không thực hiện được, vui lòng thử lại" hiện dưới nút; nút bật lại; dữ liệu không đổi.

**Given** lần xác nhận đầu đã commit nhưng response bị mất (lỗi mạng)
**When** Nhân viên bấm lại
**Then** nhận 409 với "Đã xác nhận bởi ‹chính mình› lúc …", thẻ chuyển nhóm, kho chỉ trừ một lần.

**Given** API trả 401
**When** gửi
**Then** `location.assign("/staff/login?reason=expired&next=" + path hiện tại)`.

**Given** mã lỗi kỹ thuật
**When** hiển thị lỗi
**Then** UI chỉ hiện `error.message`, không bao giờ hiện `code`.

### Story 3.5: Chi tiết đơn cho Nhân viên

Là Nhân viên,
Tôi muốn mở một đơn để thấy đủ dòng hàng, khách, địa chỉ và lịch sử kèm tên người thao tác, cùng các hành động hợp lệ,
Để xử lý được các trường hợp cần gọi khách.

**Truy vết:** FR-7, FR-14, FR-15, FR-18 · AD-10, AD-13, AD-18 · UX-DR10, UX-DR14 · mockup `key-staff-order-detail.html`
**File dự kiến:** `src/app/staff/(protected)/orders/[id]/page.tsx` (mới), `loading.tsx`, `src/features/orders/components/progress-stepper.tsx` (mới, có prop `showActor`), dùng lại `transition-button.tsx` và `stock-light.tsx`
**Test bắt buộc:** unit cho dữ liệu stepper; E2E mở chi tiết từ Hàng đợi.
**Phụ thuộc:** Story 3.4.

**Acceptance Criteria:**

**Given** một đơn `confirmed` do An xác nhận lúc 08:05
**When** mở `/staff/orders/[id]`
**Then** hiện mọi dòng hàng, tên khách, số điện thoại, địa chỉ, tổng tiền, và Đèn tồn kho nếu đơn `pending`
**And** stepper dọc 4 bước dạng `<ol>`, bước hiện tại có `aria-current="step"`, mỗi bước đã qua ghi "21/11 08:05 · bởi An" (`formatDateTime`).

**Given** đơn `pending`, `confirmed` hoặc `shipping`
**When** hiển thị
**Then** chỉ có nút hành động chính hợp lệ (dùng chung `transition-button`) và nút secondary "Hủy đơn"; nút hủy chỉ mở hộp, không bao giờ hủy ngay trong một chạm.

**Given** đơn `delivered` hoặc `cancelled`
**When** hiển thị
**Then** không có nút chuyển trạng thái nào; stepper kết thúc ở trạng thái cuối (bước hủy màu rose, "Đã hủy" kèm Mốc giờ và lý do).

**Given** đơn cũ thiếu Mốc giờ
**When** hiển thị
**Then** bước thiếu giờ hiện "—", Mốc đặt lấy từ `createdAt`, không lỗi 500.

**Given** mã đơn không tồn tại
**When** mở trang
**Then** `notFound()`.

**Given** chuyển trạng thái thành công từ trang chi tiết
**When** refresh xong
**Then** trang hiện trạng thái mới; 409 hiện Conflict notice ngay trên trang.

### Story 3.6: Hộp hủy inline với lý do bắt buộc

Là Nhân viên,
Tôi muốn hủy đơn qua hai bước (mở hộp, chọn lý do, xác nhận),
Để không bao giờ hủy nhầm chỉ bằng một chạm.

**Truy vết:** FR-11, FR-12, FR-15, SM-C2 · AD-17, AD-18 · UX-DR9 · mockup `key-staff-order-detail.html` (hộp hủy `confirmed`, giao thất bại `shipping`) · UJ-3
**File dự kiến:** `src/features/staff/components/cancel-sheet.tsx` (mới, client), trang chi tiết đơn, `e2e/staff-cancel.spec.ts` (mới)
**Test bắt buộc:** unit cho điều kiện bật nút; E2E UJ-3 ở viewport 360, dùng sản phẩm riêng của spec.
**Phụ thuộc:** Story 3.5.

**Acceptance Criteria:**

**Given** đơn `pending` hoặc `confirmed`
**When** chạm "Hủy đơn"
**Then** hộp `bg-rose-50` mở inline ngay tại chỗ (không dùng dialog), với `<fieldset><legend>Lý do hủy</legend>` gồm 4 radio từ `CANCEL_REASON_LABELS`, mỗi vùng chạm ≥ 44px
**And** nút danger "Xác nhận hủy" bị disabled cho tới khi chọn lý do.

**Given** chọn "Khác"
**When** hộp hiển thị
**Then** có ô ghi chú bắt buộc (1–200 ký tự); ô còn trống thì nút vẫn disabled.

**Given** đơn `shipping`
**When** mở hộp
**Then** chỉ có lý do "Giao thất bại" và checkbox bắt buộc "Hàng đã về shop" có label bấm được; chưa tick thì nút không bật.

**Given** chủ shop chọn "Khách đổi ý" trên đơn `confirmed` rồi chạm "Xác nhận hủy"
**When** server trả 200
**Then** nút hiện "Đang hủy…" rồi stepper kết thúc ở "Đã hủy · Khách đổi ý", các nút chuyển trạng thái biến mất
**And** quay lại Hàng đợi thì đơn đã không còn; Tồn kho của sản phẩm trong spec tăng đúng số đã trừ (E2E kiểm qua trang sản phẩm).

**Given** server trả 400 hoặc 409
**When** gửi
**Then** hiện `error.message` của server (409 thì hiện Conflict notice), hộp giữ nguyên lựa chọn.

**Given** lỗi mạng hoặc 500
**When** gửi
**Then** hiện "Không thực hiện được, vui lòng thử lại", nút bật lại.

## Epic 4: Khách theo dõi đơn không cần nhắn shop

Mở `/orders/[id]` là khách thấy ngay ba điều: đơn đang ở đâu, bao giờ tới, phải trả bao nhiêu. Bên dưới là thanh tiến trình có Mốc giờ thật. Trang không lộ tên nhân viên. Đơn cũ vẫn hiển thị an toàn.

**Phụ thuộc của epic:** Story 1.5 và Story 3.1. Làm song song được với Story 3.2..3.6.

### Story 4.1: Dữ liệu công khai cho khách không lộ thông tin nội bộ

Là khách,
Tôi muốn trang và API công khai chỉ trả những gì tôi cần,
Để thông tin nội bộ của shop (tên nhân viên, ghi chú) không lộ ra ngoài.

**Truy vết:** FR-4, FR-17, NFR-5 · AD-11
**File dự kiến:**
- `src/features/orders/public-order.ts` (mới, `toPublicOrder`)
- `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts`
- `src/app/(shop)/orders/page.tsx`, `src/app/(shop)/orders/[id]/page.tsx`
- `public-order.test.ts`, `route.test.ts` (không sửa assertion cũ)

**Test bắt buộc:** unit cho `toPublicOrder`; integration cho các route khách.
**Phụ thuộc:** Story 1.5 và Story 3.1 (để có đơn mang actor Nhân viên).

**Acceptance Criteria:**

**Given** một đơn đã được An xác nhận và bị hủy kèm `cancellation.note`
**When** gọi `GET /api/orders/:id`, `GET /api/orders`, `PATCH /api/orders/:id` hoặc mở `/orders`, `/orders/[id]`
**Then** mọi `statusHistory[].actor` chỉ còn `{ kind }`, không có `name`
**And** không có `cancellation.note` và `stockApplied`; `cancellation.reason` vẫn còn.

**Given** response của các route khách
**When** so với trước story
**Then** mọi trường hiện có giữ nguyên tên và giá trị (FR-4); test hiện có xanh, không sửa assertion.

**Given** API nhân viên `POST /api/staff/orders/:id/transitions`
**When** trả kết quả
**Then** vẫn trả `Order` đầy đủ, không đi qua `toPublicOrder`.

**Given** một đơn cũ không có `statusHistory` và `cancellation`
**When** đi qua `toPublicOrder`
**Then** không lỗi, giữ nguyên dữ liệu.

### Story 4.2: Tính Ngày dự kiến giao và Trạng thái thanh toán

Là khách,
Tôi muốn thấy khoảng ngày giao và số tiền phải trả bằng câu dễ hiểu,
Để chuẩn bị nhận hàng và chuẩn bị tiền.

**Truy vết:** FR-16, FR-23 (nền "quá hạn") · AD-12
**File dự kiến:**
- `src/features/checkout/pricing.ts` (thêm `minDays`/`maxDays` vào `SHIPPING_OPTIONS`, giữ nguyên `description`)
- `src/features/orders/delivery-estimate.ts` (mới: `estimateDelivery`, `isPastDeliveryWindow`)
- `src/features/orders/timeline.ts` (`describePayment`)
- các test cạnh file

**Test bắt buộc:** unit cho mọi nhánh, chạy với múi giờ máy test khác `Asia/Ho_Chi_Minh`.
**Phụ thuộc:** Story 1.5.

**Acceptance Criteria:**

**Given** `SHIPPING_OPTIONS`
**When** story hoàn tất
**Then** giao tiêu chuẩn có `minDays: 3, maxDays: 5`, giao nhanh có `minDays: 1, maxDays: 2`; `description` và phí giữ nguyên (FR-1).

**Given** đơn có Mốc `confirmed` vào thứ Bảy 21/11/2026 theo giờ VN
**When** gọi `estimateDelivery`
**Then** giao tiêu chuẩn ra "25–27/11", giao nhanh ra "23–24/11"
**And** chỉ đếm ngày làm việc T2–T6, không tính ngày lễ, bắt đầu từ ngày làm việc kế tiếp sau Mốc `confirmed`.

**Given** Mốc `confirmed` lúc 23:30 giờ VN (tức ngày hôm trước theo UTC)
**When** tính
**Then** ngày được xác định theo `Asia/Ho_Chi_Minh`, không theo UTC hay múi giờ của máy.

**Given** đơn `pending`, `delivered`, `cancelled`, hoặc đơn cũ thiếu Mốc `confirmed`
**When** gọi `estimateDelivery`
**Then** trả lần lượt: "Sẽ có sau khi shop xác nhận", ngày giao thực tế, ẩn, "—".

**Given** `describePayment`
**When** đơn `cod` chưa giao / `cod` đã giao / `bank_transfer` / `cod` đã hủy / `bank_transfer` đã hủy
**Then** trả lần lượt:
- "Thanh toán khi nhận: ‹tổng›"
- "Đã thanh toán"
- "Chuyển khoản: ‹tổng›"
- "Đơn đã hủy, không cần thanh toán"
- "Chuyển khoản: ‹tổng› · liên hệ shop nếu đã chuyển"

**And** tiền định dạng bằng `formatCurrency`; `bank_transfer` không bao giờ hiện "Đã thanh toán".

**Given** `isPastDeliveryWindow(order, now)` với đơn `shipping`
**When** `now` qua 23:59 giờ VN của ngày cuối trong khoảng dự kiến
**Then** trả `true`; trước thời điểm đó thì trả `false`. Hàm này là nền cho FR-23.

**Đã chốt:**
- Ví dụ trong UJ-2 và EXPERIENCE đã sửa thành 25–27/11.
- OQ-4: ngày làm việc T2–T6, không tính ngày lễ.
- OQ-2: v1 không có hành động "Đã nhận tiền".

### Story 4.3: Ba thông tin chính ở màn hình đầu

Là khách (anh Minh),
Tôi muốn mở trang đơn là thấy ngay trạng thái, ngày dự kiến giao và số tiền phải trả mà không cần cuộn,
Để không phải nhắn tin hỏi shop.

**Truy vết:** FR-2, FR-16, SM-5 · AD-11, AD-12 · UX-DR11, UX-DR12, UX-DR17 · mockup `key-customer-tracking.html` · UJ-2
**File dự kiến:**
- `src/app/(shop)/orders/[id]/page.tsx`
- `src/features/orders/components/key-info-card.tsx` (mới)

**Test bắt buộc:** E2E ở viewport 360.
**Phụ thuộc:** Story 4.1, Story 4.2.

**Acceptance Criteria:**

**Given** một đơn `shipping`, thanh toán `cod`, tổng 1.250.000 ₫
**When** mở `/orders/[id]` ở viewport 360×800
**Then** Key info card hiện đủ ba dòng theo thứ tự Trạng thái / Dự kiến giao / Thanh toán
**And** mỗi dòng có nhãn `text-xs` slate-500 và giá trị `text-lg` 700, nằm trọn trong màn hình đầu, không cần cuộn.

**Given** Key info card
**When** hiển thị
**Then** giá trị trạng thái lấy từ `ORDER_STATUS_LABELS`
**And** `OrderStatusBadge` giữ ở tiêu đề trang, không lặp lại trong card; card không có nút hành động.

**Given** các mục Sản phẩm, Giao tới, Thanh toán và vận chuyển hiện có
**When** hiển thị
**Then** chúng nằm trong `<details>` "Chi tiết đơn hàng", đóng mặc định.

**Given** đơn `pending`
**When** hiển thị
**Then** Dự kiến giao ghi "Sẽ có sau khi shop xác nhận"
**And** nút "Hủy đơn hàng" hiện có (`CancelOrderButton`) vẫn hoạt động như cũ (FR-2).

**Given** đơn `cancelled`
**When** hiển thị
**Then** dòng Dự kiến giao bị ẩn.

**Given** vừa đặt hàng xong (`?placed=1`)
**When** trang mở
**Then** banner emerald "Đặt hàng thành công!" hiện có vẫn còn, nằm trên Key info card.

**Given** mã đơn không tồn tại
**When** mở trang
**Then** `notFound()` hiện có.

### Story 4.4: Thanh tiến trình có Mốc giờ thật cho khách

Là khách,
Tôi muốn thấy đơn đã qua những bước nào và lúc nào, kể cả khi đơn bị hủy thì vì sao,
Để biết chắc hôm nay hàng đã tới chưa.

**Truy vết:** FR-17, FR-18, SM-5 · AD-10, AD-11, AD-12 · UX-DR10, UX-DR12 · mockup `key-customer-tracking.html` (`shipping` và `cancelled` có đơn cũ) · UJ-2, UJ-3
**File dự kiến:**
- `src/app/(shop)/orders/[id]/page.tsx`
- dùng lại `progress-stepper.tsx` (Story 3.5) với `showActor={false}`
- `e2e/customer-tracking.spec.ts` (mới)

**Test bắt buộc:** E2E ở viewport 360 cho đủ 5 trạng thái và cho một đơn cũ.
**Phụ thuộc:** Story 4.3, Story 3.5.

**Acceptance Criteria:**

**Given** một đơn `shipping` đặt 20/11 21:40, xác nhận 21/11 08:05, bắt đầu giao 21/11 15:30
**When** mở Trang theo dõi
**Then** stepper hiện Chờ xác nhận 20/11 21:40 → Đã xác nhận 21/11 08:05 → Đang giao 21/11 15:30 → Đã giao (trống)
**And** giờ hiển thị bằng `formatDateTime`; bước hiện tại có `aria-current="step"`; mỗi bước có chữ, không chỉ có màu.

**Given** đơn đã được Nhân viên An thao tác
**When** khách xem stepper
**Then** không có tên "An" hay chữ "bởi …" nào trên trang.

**Given** một đơn `confirmed` bị hủy với lý do "Khách đổi ý"
**When** mở Trang theo dõi
**Then** stepper kết thúc ở bước "Đã hủy" màu rose, kèm Mốc giờ và "Khách đổi ý", thay cho các bước còn lại.

**Given** một đơn cũ chỉ có các trường cũ, đang ở `confirmed`
**When** mở trang
**Then** bước Chờ xác nhận lấy giờ từ `createdAt`, bước Đã xác nhận hiện "—", không lỗi 500 (FR-18).

**Given** viewport 360×800 và lần lượt mỗi trạng thái `pending`, `confirmed`, `shipping`, `delivered`, `cancelled`
**When** mở trang
**Then** Key info card nằm trong màn hình đầu ở cả 5 trạng thái (SM-5), không cuộn ngang.

## Epic 5 (SHOULD): Vận hành sâu hơn

Các story trong epic này là SHOULD, làm nếu kịp. Story nào cũng đứng độc lập trên Epic 1–4; dừng ở story nào thì bản phát hành vẫn trọn vẹn.

### Story 5.1: Lịch sử trạng thái của đơn

Là Nhân viên,
Tôi muốn xem mọi lần chuyển trạng thái của một đơn, kèm người làm, lúc nào và lý do,
Để trả lời được khách khi có thắc mắc.

**Truy vết:** FR-19 · AD-10, AD-12 · UX-DR14
**File dự kiến:**
- `src/features/orders/timeline.ts` (`buildHistoryRows`)
- `src/features/staff/components/status-history.tsx` (mới)
- `src/app/staff/(protected)/orders/[id]/page.tsx`
- test cạnh file

**Test bắt buộc:** unit `buildHistoryRows`; E2E đi đủ 4 bước.
**Phụ thuộc:** Story 3.5.

**Acceptance Criteria:**

**Given** một đơn đi đủ `pending → confirmed → shipping → delivered`
**When** mở chi tiết đơn nhân viên
**Then** lịch sử có đúng 4 dòng theo thứ tự thời gian: dòng tạo đơn (Người thao tác "khách") và 3 lần chuyển
**And** mỗi dòng ghi từ, sang (nhãn `ORDER_STATUS_LABELS`), Người thao tác, Mốc giờ (`formatDateTime`).

**Given** đơn bị hủy với lý do "Khác" kèm ghi chú
**When** xem lịch sử
**Then** dòng hủy hiện nhãn lý do từ `CANCEL_REASON_LABELS` và ghi chú.

**Given** một đơn cũ không có `statusHistory`
**When** xem lịch sử
**Then** hiện một dòng tạo đơn lấy từ `createdAt`, kèm "Đơn đã ở trạng thái ‹nhãn›"; không bịa thêm các bước còn thiếu.

**Given** Trang theo dõi của khách
**When** story hoàn tất
**Then** khách không thấy lịch sử này (AD-11).

### Story 5.2: Sổ kho để đối soát tồn kho

Là chủ shop,
Tôi muốn mỗi lần tồn kho thay đổi đều được ghi một dòng có lý do và mã đơn,
Để chứng minh được tồn kho luôn khớp với hàng thật.

**Truy vết:** FR-20, SM-2, NFR-2 · AD-3, AD-7, AD-9, AD-16
**File dự kiến:**
- `src/features/inventory/types.ts` (`StockLedgerEntry`)
- `src/features/inventory/stock.ts` (`deduct`, `restock` sinh dòng sổ; `verifyLedger`)
- `state-schema.ts` (`stockLedger?`)
- `scripts/stock-set.ts` (lý do `manual_adjustment`)
- test cạnh file

**Test bắt buộc:** unit `verifyLedger`; integration chạy chuỗi xác nhận/hủy/stock:set rồi kiểm bất biến.
**Phụ thuộc:** Story 3.2, Story 1.8.

**Acceptance Criteria:**

**Given** Nhân viên An xác nhận đơn X×2
**When** commit
**Then** `stockLedger` có thêm `{productId:"X", delta:-2, orderId, reason:"order_confirmed", actor:An, at}` trong **cùng** lần commit với đơn và kho.

**Given** hủy đơn `confirmed`, hoặc hủy đơn `shipping` khi hàng đã về shop
**When** commit
**Then** mỗi dòng hàng sinh một dòng sổ có `delta` dương và lý do tương ứng.

**Given** chạy `npm run stock:set -- p004=10` khi đang có 2
**When** commit
**Then** sổ có dòng `{productId:"p004", delta:+8, reason:"manual_adjustment"}`, không có `orderId`.

**Given** một trạng thái bất kỳ sau chuỗi thao tác ngẫu nhiên trong test
**When** gọi `verifyLedger(state)`
**Then** với mọi sản phẩm, `inventory = inventoryBaseline + tổng delta trong sổ`
**And** dòng sổ chỉ được sinh bởi `inventory/stock.ts`; không có chỗ nào khác ghi vào `stockLedger`.

**Given** store được tạo trước story này, chưa có `stockLedger`
**When** đọc
**Then** sổ coi như rỗng, bất biến vẫn đúng vì `inventoryBaseline` đã được dời theo AD-16.

### Story 5.3: Bộ đếm đơn và hàng sắp hết

Là chủ shop,
Tôi muốn liếc một cái là biết bao nhiêu đơn ở mỗi trạng thái và món nào sắp hết,
Để nhập hàng kịp lúc.

**Truy vết:** FR-21 · AD-9 · UX-DR16
**File dự kiến:**
- `src/features/orders/queue.ts` (`countByStatus`)
- `src/features/inventory/stock.ts` (`lowStockProducts`, dùng `LOW_STOCK_THRESHOLD`)
- `src/features/staff/components/queue-summary.tsx` (mới)
- `src/app/staff/(protected)/page.tsx`

**Test bắt buộc:** unit cho cả hai hàm; E2E ở viewport 360.
**Phụ thuộc:** Story 2.5.

**Acceptance Criteria:**

**Given** 3 đơn `pending` và 1 đơn `shipping`
**When** mở Hàng đợi
**Then** bộ đếm hiện đúng 3 và 1 (các trạng thái khác hiện 0).

**Given** sản phẩm A có Tồn kho 5 và sản phẩm B có Tồn kho 6
**When** xem danh sách sắp hết
**Then** A nằm trong danh sách, B thì không; mỗi mục ghi tên và "còn N".

**Given** không có sản phẩm nào sắp hết
**When** hiển thị
**Then** khối danh sách sắp hết không hiện, hoặc hiện một dòng "Không có món sắp hết".

**Given** viewport 360
**When** hiển thị bộ đếm và danh sách
**Then** vẫn một cột, không cuộn ngang, không dùng bảng nhiều cột.

### Story 5.4: Khách gửi yêu cầu hủy đơn đã xác nhận

Là khách,
Tôi muốn gửi yêu cầu hủy cho đơn đã được shop xác nhận,
Để không phải gọi điện mà shop vẫn biết tôi muốn hủy.

**Truy vết:** FR-2, FR-22 · AD-4, AD-8, AD-10 (`flags.cancelRequestedAt`), AD-11 · UX-DR15 · UJ-2 (trường hợp biên)
**File dự kiến:**
- `src/app/api/orders/[id]/cancel-request/route.ts` (mới, **đề xuất**)
- `order-service.ts` (`requestCancellation`)
- `src/features/orders/components/cancel-request-button.tsx`, `alert-strip.tsx` (mới)
- `src/app/(shop)/orders/[id]/page.tsx`

**Test bắt buộc:** integration route; E2E ở viewport 360.
**Phụ thuộc:** Story 4.3.

**Acceptance Criteria:**

**Given** đơn `confirmed` chưa có yêu cầu
**When** khách chạm "Gửi yêu cầu hủy" rồi xác nhận
**Then** `POST /api/orders/:id/cancel-request` đặt `flags.cancelRequestedAt` qua `update`
**And** Trạng thái đơn và Tồn kho không đổi.

**Given** đơn đã có yêu cầu hủy
**When** khách mở Trang theo dõi
**Then** hiện một Alert strip amber (icon `TriangleAlert`) "Đã gửi yêu cầu hủy, shop sẽ liên hệ bạn", không có nút gửi lại.

**Given** đơn ở `pending`, `shipping`, `delivered` hoặc `cancelled`
**When** gửi yêu cầu hủy
**Then** trả 409 `INVALID_STATUS_TRANSITION`
**And** đơn `pending` vẫn dùng nút hủy trực tiếp hiện có.

**Given** `PATCH /api/orders/:id {status:"cancelled"}` cho một đơn `confirmed`
**When** gọi
**Then** vẫn trả 409 như FR-2.

**Câu hỏi mở:** spine để route cụ thể cho FR-22 ở mục Deferred. `POST /api/orders/:id/cancel-request` chỉ là đề xuất, cần duyệt khi bắt đầu story.

### Story 5.5: Nhân viên duyệt hoặc từ chối yêu cầu hủy

Là Nhân viên,
Tôi muốn thấy ngay đơn nào khách xin hủy, rồi duyệt hoặc từ chối,
Để khách không phải chờ.

**Truy vết:** FR-11, FR-22 · AD-7, AD-8, AD-17 · UX-DR4, UX-DR15
**File dự kiến:**
- `src/app/api/staff/orders/[id]/cancel-request/route.ts` (mới, **đề xuất**, `DELETE` = từ chối)
- `order-service.ts`
- `queue-order-card.tsx` và trang chi tiết nhân viên
- `cancel-sheet.tsx`

**Test bắt buộc:** integration route; E2E duyệt và từ chối.
**Phụ thuộc:** Story 5.4, Story 3.6.

**Acceptance Criteria:**

**Given** đơn `confirmed` có `flags.cancelRequestedAt`
**When** mở Hàng đợi hoặc chi tiết đơn
**Then** thẻ hiện một Alert strip "Khách yêu cầu hủy"; mỗi bề mặt tối đa một dải.

**Given** Nhân viên duyệt
**When** hủy qua hộp hủy (Story 3.6) với lý do "Khách đổi ý"
**Then** đơn chuyển `cancelled`, kho được hoàn, cờ yêu cầu được xóa trong cùng lần commit.

**Given** Nhân viên từ chối
**When** gọi `DELETE /api/staff/orders/:id/cancel-request`
**Then** cờ được xóa, Trạng thái đơn và Tồn kho không đổi, `statusHistory` không thêm dòng
**And** Alert strip của khách biến mất.

**Given** request không có phiên
**When** gọi route từ chối
**Then** trả 401 `UNAUTHORIZED`.

### Story 5.6: Cảnh báo đơn đứng yên

Là chủ shop,
Tôi muốn Hàng đợi đánh dấu đơn nằm quá lâu ở một trạng thái,
Để không đơn nào bị bỏ quên.

**Truy vết:** FR-23, SM-4 · AD-12 · UX-DR15
**File dự kiến:**
- `src/features/orders/timeline.ts` (`isStale(order, now)`, dùng `isPastDeliveryWindow` của Story 4.2)
- `queue-order-card.tsx`
- test cạnh file

**Test bắt buộc:** unit với đồng hồ giả, chạy ở múi giờ khác `Asia/Ho_Chi_Minh`.
**Phụ thuộc:** Story 2.5, Story 4.2.

**Acceptance Criteria:**

**Given** một đơn `pending` tạo lúc 08:00 hôm qua
**When** `now` là 08:01 hôm nay
**Then** đơn được đánh dấu đứng yên
**And** một đơn tạo lúc 09:00 hôm qua thì chưa bị đánh dấu.

**Given** một đơn `confirmed` có Mốc `confirmed` quá 24 giờ
**When** hiển thị Hàng đợi
**Then** đơn được đánh dấu.

**Given** một đơn `shipping` mà `now` đã qua 23:59 giờ VN của ngày cuối trong khoảng dự kiến giao
**When** hiển thị
**Then** đơn được đánh dấu.

**Given** một đơn được đánh dấu
**When** hiển thị thẻ
**Then** thẻ có Alert strip amber kèm chữ (ví dụ "Chờ quá 24 giờ"), không phân biệt chỉ bằng màu; mỗi thẻ tối đa một dải. Nếu thẻ đã có dải yêu cầu hủy (Story 5.5) thì dải đó được ưu tiên.

**Given** một đơn cũ không có Mốc giờ của trạng thái hiện tại
**When** tính đứng yên
**Then** dùng cùng mốc với Story 2.5 (`createdAt` cho `pending`, `updatedAt` cho các trạng thái khác, `[ASSUMPTION]`); không lỗi.

**Ghi chú:** khi có lý do trễ cho khách (Notes của FR-23), Alert strip của Story 5.4 là chỗ đặt thông tin này. v1 chưa làm.

## Bảng truy vết CAP → Story

Mỗi tiêu chí trong `acceptance-criteria.md` có một story sở hữu duy nhất. Story ghi trong ngoặc chỉ dùng lại kết quả của story sở hữu.

| CAP / FR | Story sở hữu | Ghi chú |
|---|---|---|
| CAP-1 / FR-1 | 1.2 | Giữ nguyên khi `placeOrder` vào mutator |
| CAP-2 / FR-2 | 1.2 | Thêm `statusHistory` ở 1.5. Kiểm lại "PATCH cho đơn confirmed vẫn 409" ở 5.4 |
| CAP-3 / FR-3 | 1.6 (kiểm lúc đặt), 1.7 (nhãn, lọc, giỏ) | 1.3 giữ E2E xanh |
| CAP-4 / FR-4 | 1.5 (trường chỉ được thêm), 1.7 (API sản phẩm), 4.1 (API khách) | Mọi story giữ `npm run check` xanh |
| CAP-5 / FR-5 | 1.1, 1.4, 1.6, 1.8 | |
| CAP-6 / FR-6 | 2.1, 2.2, 2.3 | Khung khu nhân viên ở 2.4 |
| CAP-7 / FR-7 | 1.5 (actor "khách"), 3.1 (actor Nhân viên) | Hiển thị actor ở 3.5 |
| CAP-8 / FR-8 | 3.1 (bảng, CAS), 3.2 (các nhánh hủy) | Lỗi HTTP ở 3.3 |
| CAP-9 / FR-9 | 3.1 | Test chèn lỗi giữa chừng và tranh món cuối |
| CAP-10 / FR-10 | 3.1 (server), 3.4 (Conflict notice) | Test hai nhân viên cùng xác nhận |
| CAP-11 / FR-11 | 3.2 (luật, hoàn kho), 3.6 (UI) | Lý do hiện cho khách ở 4.4 |
| CAP-12 / FR-12 | 3.2 (luật), 3.6 (UI) | |
| CAP-13 / FR-13 | 2.5 (nhóm, sắp, 360px), 3.4 (đổi nhóm sau thao tác) | Nút làm mới ở 2.4 |
| CAP-14 / FR-14 | 2.5 (hiển thị đèn), 3.4 (khóa nút, `aria-describedby`) | |
| CAP-15 / FR-15 | 3.4 (một chạm), 3.5 (chỉ hiện hành động hợp lệ), 3.6 (hủy hai bước) | |
| CAP-16 / FR-16 | 4.2 (quy tắc), 4.3 (màn hình đầu 360px) | |
| CAP-17 / FR-17 | 4.4 | 4.1 bảo đảm không lộ tên |
| CAP-18 / FR-18 | 1.4 (nhập đơn cũ, không 500), 1.5 (schema), 4.4 (hiển thị "—") | Hàng đợi ở 2.5, chi tiết ở 3.5 |
| CAP-19 / FR-19 | 5.1 | SHOULD |
| CAP-20 / FR-20 | 5.2 | SHOULD |
| CAP-21 / FR-21 | 5.3 | SHOULD |
| CAP-22 / FR-22 | 5.4 (khách), 5.5 (Nhân viên) | SHOULD |
| CAP-23 / FR-23 | 5.6 | Dựa trên `isPastDeliveryWindow` ở 4.2. SHOULD |

**Phủ UX-DR:**

| UX-DR | Story |
|---|---|
| 1 | 2.4 |
| 2 | 2.3 |
| 3 | 2.5 |
| 4 | 2.5, 3.4 |
| 5 | 2.5, 3.4 |
| 6 | 3.4 |
| 7 | 3.4 |
| 8 | 3.4 |
| 9 | 3.6 |
| 10 | 3.5, 4.4 |
| 11 | 4.3 |
| 12 | 4.3 |
| 13 | 2.5, 3.5 |
| 14 | 3.5 |
| 15 | 5.4, 5.5, 5.6 |
| 16 | 2.4, 2.5, 5.3 |
| 17 | 2.3, 3.4, 4.3 |

## Câu hỏi mở

Đã chốt ngày 2026-11-21 và đã sửa trong tài liệu nguồn: FR-5/`stock:set`, ví dụ 25–27/11, OQ-2, OQ-3, OQ-4, AD-20, giới hạn hàng chờ PIN (AD-14). Còn lại:

| Câu hỏi | Story bị ảnh hưởng | Người quyết |
|---|---|---|
| Lịch sao lưu và thời gian lưu giữ `shop-store.json` | 1.4 | Chủ shop |
| Đơn cũ `confirmed`/`shipping` dùng `updatedAt` làm mốc vào trạng thái `[ASSUMPTION]` | 2.5, 5.6 | Toantv |
| Route cho FR-22 (`/api/orders/:id/cancel-request`, `/api/staff/orders/:id/cancel-request`) mới là đề xuất | 5.4, 5.5 | Architect |
| Xác nhận worker Playwright có nạp lại config hay không (F1) | 1.3 | Dev |
