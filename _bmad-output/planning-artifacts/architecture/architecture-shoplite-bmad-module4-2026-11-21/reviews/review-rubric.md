# Architecture Spine Review (rubric): ShopLite — Vận hành đơn hàng

- **Spine:** `ARCHITECTURE-SPINE.md` (draft, 2026-11-21)
- **PRD:** `prds/prd-shoplite-bmad-module4-2026-11-21/prd.md` (+ addendum, EXPERIENCE.md)
- **Codebase kiểm chứng:** commit `805f721` (`src/features/orders/*`, `catalog-service.ts`, `lib/http.ts`, `order-service.test.ts`, `order-repository.test.ts`, `app/api/orders/route.test.ts`, `playwright.config.ts`, `next.config.ts`, `.gitignore`)
- **Ghi chú:** chưa có file epics/stories; điểm phân kỳ được đánh giá theo các story suy ra từ FR-1..FR-23 và EXPERIENCE.md.

## Verdict

**Gần đạt — cần sửa trước khi tách epic (2 high, 7 medium, 6 low).**

Spine chọn đúng các điểm phân kỳ quan trọng nhất: một file trạng thái + rename (AD-3), một port `ShopStore` với mutex quanh toàn bộ read→mutate→commit (AD-4), CAS `from` trong mutator (AD-6), hai đường hủy tách biệt (AD-7), `statusHistory` là nguồn Mốc giờ duy nhất (AD-9), xác thực thật tại handler (AD-10), bảng API/lỗi (AD-12), luồng UI server-first (AD-13), cô lập dữ liệu test (AD-14). Rule phần lớn kiểm chứng được bằng test. Văn phong ngắn, là quyết định chứ không phải lập luận.

Hai lỗ hổng thật sự: (1) spine không chốt chữ ký `createOrderService` sau khi chuyển sang `ShopStore`, trong khi `order-service.test.ts` và `route.test.ts` dựng service bằng `{ repository }` và gọi `repository.save` trực tiếp; (2) quy tắc seed lazy của AD-8 phá con đường nhập hàng duy nhất mà PRD cho phép ("sửa dữ liệu khởi tạo", FR-5 Out of Scope). Ngoài ra phần vận hành (TLS/reverse proxy, process manager, backup/restore, nơi đặt secret) mới là một câu, chưa đủ để coi là đã quyết hay đã hoãn.

## 1. Điểm phân kỳ: đã chốt / còn sót

| Điểm phân kỳ | Trạng thái | Ghi chú |
|---|---|---|
| Nơi lưu đơn + kho, tính nguyên tử | Chốt (AD-3, AD-4) | Tốt. |
| Khóa tương tranh | Chốt (AD-4) | Mutex per-path trên `globalThis`. |
| Bảng chuyển trạng thái, UI suy nút | Chốt (AD-6) | Tốt. |
| Mô hình dữ liệu mở rộng | Chốt (AD-9) | Tốt. |
| API staff, mã lỗi | Chốt (AD-12) | Tốt. |
| Auth, phiên, proxy | Chốt (AD-10) | Mâu thuẫn với login page và quy ước env (F-6, F-9). |
| Luồng làm mới UI | Chốt (AD-13) | Tốt. |
| **Chữ ký `createOrderService` / test seam** | **Sót** | F-1. |
| **Cách đổi Tồn kho (nhập hàng) trong v1** | **Sót, mâu thuẫn PRD** | F-2. |
| Overlay live stock cho featured/related/bySlug | Chốt một nửa | F-7. |
| Thông điệp xung đột FR-10 | Chốt nhưng sai mẫu | F-4. |
| Hàm suy Trạng thái thanh toán (FR-16) | Sót chỗ đặt | F-13. |
| Hành động "từ chối yêu cầu hủy" (FR-22) | Sót | F-12. |
| Vận hành (TLS, process, backup, secret, log) | Một câu, chưa quyết | F-5. |

## 2. Findings

### High

**F-1 — Hợp đồng `createOrderService` sau khi đổi sang `ShopStore` chưa chốt; test hiện có sẽ gãy hoặc hai dev làm hai kiểu.**
`order-service.test.ts` dựng `createOrderService({ repository, now, generateId })`, rồi `repository.save({ ...order, status: "confirmed" })` và mong `cancelOrder` thấy thay đổi đó. `route.test.ts` mock `@/features/orders/server` bằng `createOrderService({ repository: createInMemoryOrderRepository() })`. AD-2 nói service nhận `{ store, now, ... }`; AD-4 nói `placeOrder`/`cancelOrder` chạy qua `store.update` và `OrderRepository` là façade trên `ShopStore`. Nếu deps đổi thành `store`, `npm run check` gãy ở typecheck và runtime (SM-6, FR-4). Nếu giữ `repository`, service không có `update` nguyên tử. Spine không chọn. Thêm nữa, seed lazy từ `products.ts` (cần cho test `INSUFFICIENT_STOCK` với p011/p004) không nói là trách nhiệm của port hay của adapter, nên in-memory store có thể khác JSON adapter.
*Fix:* thêm vào AD-4 một rule: `createOrderService` chấp nhận `{ store }` **hoặc** `{ repository }` cũ; `createInMemoryOrderRepository(seed)` trả façade dựng trên `createInMemoryShopStore` và expose store đó để service dùng chung (hoặc service tự bọc repository vào một in-memory `ShopStore` có mutex). Seed lazy nằm trong một hàm thuần dùng chung (`inventory/stock.ts#resolveLevel`) mà cả hai adapter gọi. Ghi rõ: ba file test hiện có chạy nguyên văn.

**F-2 — Seed lazy (AD-8) phá con đường nhập hàng duy nhất của PRD; không có quy trình đổi Tồn kho.**
PRD FR-5 Out of Scope: "muốn đổi Tồn kho thì sửa dữ liệu khởi tạo". AD-8: giá trị khởi tạo chỉ dùng khi key thiếu. Sau lần xác nhận đầu tiên, key đã được ghi, nên sửa `products.ts` không còn tác dụng với sản phẩm đó, nhưng vẫn có tác dụng với sản phẩm chưa từng bị trừ: hành vi không nhất quán. Người vận hành sẽ sửa tay `shop-store.json` khi server đang chạy, ngoài mutex, mất cập nhật và phá bất biến SM-2/FR-20 ("khởi tạo + tổng sổ kho"). Đây cũng là chỗ hai story (FR-5 và FR-20) sẽ hiểu "giá trị khởi tạo" khác nhau.
*Fix:* thêm rule: (a) seed được **ghi cứng** vào `inventory` ở commit đầu tiên (khi migrate, AD-15), không còn seed lazy theo đọc, trừ sản phẩm mới thêm; (b) nhập hàng v1 = script `npm run stock:set <productId> <qty>` dùng chính `ShopStore.update` (cùng mutex chỉ khi chạy trong tiến trình, hoặc yêu cầu dừng server), ghi dòng Sổ kho `reason: "manual_adjust"` nếu FR-20 đã có; (c) chốt baseline cho FR-20 (sổ bắt đầu bằng dòng `initial` cho mọi sản phẩm tại thời điểm bật sổ). Báo PM: PRD FR-5 Out of Scope cần sửa theo.

### Medium

**F-3 — Đồ thị import mâu thuẫn với code hiện có và với AD-12.**
`src/lib/http.ts` import `OrderError` từ `features/orders/order-errors` (lib → orders), nhưng đồ thị chỉ có `api --> lib`, `staff --> lib`, và nói "Không có chiều ngược lại". AD-12 bắt `UNAUTHORIZED`/`TOO_MANY_ATTEMPTS` là `OrderError`, nên `staff` phải import `orders/order-errors` — cạnh `staff --> orders` không có. Ai viết lint ranh giới từ đồ thị này sẽ thấy code hiện có vi phạm. `src/components` cũng không có trong đồ thị.
*Fix:* thêm cạnh `lib --> orders/order-errors` và `staff --> orders/order-errors` (ghi rõ chỉ module lỗi), thêm `src/components`; hoặc chuyển `OrderError` sang `lib/app-error.ts` và để `orders/order-errors.ts` re-export (test import cũ vẫn chạy).

**F-4 — Mẫu thông điệp xung đột của AD-6 sinh ra câu sai và thiếu nhánh đơn cũ.**
"Đã ‹nhãn trạng thái hiện tại, viết thường› bởi ‹actor› lúc ‹HH:mm›" với nhãn "Đã xác nhận" cho ra "Đã đã xác nhận bởi An…"; với "Đang giao" cho ra "Đã đang giao…". FR-10/UX yêu cầu đúng "Đã xác nhận bởi An lúc 08:05". Không quy định actor `customer` hiển thị gì ("khách"), đơn cũ không có `statusHistory` hiển thị gì, và "HH:mm" theo múi giờ nào (`formatDateTime` hiện ra cả ngày, không có helper HH:mm). Cặp `from→to` không hợp lệ cũng không có thông điệp.
*Fix:* thay bằng bảng `CONFLICT_VERBS` trong `order-transitions.ts` (`confirmed: "Đã xác nhận"`, `shipping: "Đã bắt đầu giao"`, `delivered: "Đã giao"`, `cancelled: "Đã hủy"`), mẫu `"{verb} bởi {actor.kind==="customer" ? "khách" : name} lúc {HH:mm Asia/Ho_Chi_Minh}"`; thiếu mốc → `"Đơn đã ở trạng thái {label}"`; thêm `formatTime` vào `lib/format.ts`.

**F-5 — Operational envelope mới là một câu; nhiều chiều chưa quyết cũng chưa hoãn.**
"Một tiến trình `next start` trên một máy… sao lưu = copy file" chưa nói: TLS/reverse proxy (cookie `Secure` khi production sẽ làm hỏng đăng nhập nếu chạy HTTP trong LAN); có proxy hay không (quyết định AD-11 có được tin `x-forwarded-for`); process manager và tự khởi động lại; nơi đặt `STAFF_PINS`/`STAFF_SESSION_SECRET` ở production (`.env.local` hiện chứa `PAYMENT_API_KEY`, `.env.*` đã gitignore); lịch backup, retention, quy trình restore (restore khi server đang chạy có an toàn không — có, vì không cache, nên nói ra); log đi đâu ngoài `console.error`; health check. Máy dev là Windows, nhưng spine không nói OS mục tiêu.
*Fix:* thêm mục "Operational envelope" dạng bảng: Deploy (OS, `next start` sau reverse proxy TLS hoặc HTTP-only với `Secure` tắt có chủ ý), Process (systemd/pm2/NSSM, 1 instance), Config (file env nào, ai giữ), Backup (cron copy `shop-store.json` + giữ N bản, restore = copy đè, không cần dừng server), Observability (stdout của process manager; log đăng nhập sai/khóa không kèm PIN), mỗi dòng ghi Decided/Deferred.

**F-6 — "Mọi page `/staff/**` gọi `requireStaff()`" bao cả `/staff/login`; layout dùng chung gây vòng redirect.**
AD-10 Authoritative áp cho mọi page `/staff/**`; seed đặt `staff/login/page.tsx` dưới `staff/layout.tsx`. Một dev đặt `requireStaff()` vào layout (chỗ tự nhiên nhất) sẽ tạo vòng lặp; dev khác đặt vào từng page. Thêm: `next=<path>` không được ràng buộc → open redirect.
*Fix:* dùng route group `app/staff/(protected)/layout.tsx` gọi `requireStaff()`, login ở ngoài group; rule "`next` chỉ nhận đường dẫn tương đối bắt đầu bằng `/staff`, còn lại bỏ".

**F-7 — AD-8 "overlay trước khi gọi hàm catalog" không áp được cho `getFeaturedProducts`, `getRelatedProducts`, `getProductBySlug`.**
Ba hàm này đọc thẳng hằng `products`, không có tham số `source`. Một dev sẽ thêm tham số `source` (đổi chữ ký), dev khác overlay sau (`withLiveStock(getRelatedProducts(p), levels)`). Cả hai đều chạy nhưng code lệch nhau.
*Fix:* chốt một kiểu: "overlay **sau** cho hàm trả về `Product`/`Product[]`; chỉ `queryProducts` (vì lọc `inStock`) nhận `source` đã overlay". Không thêm tham số mới vào catalog.

**F-8 — Rename không khóa trên Windows có thể EPERM/EBUSY; AD-5 không đòi test được điều này.**
`read()` không lấy khóa và commit dùng `rename` đè. Trên Windows, antivirus/indexer hoặc handle đọc đang mở có thể làm `rename` lỗi `EPERM`/`EACCES`/`EBUSY` không định kỳ (lý do `graceful-fs` retry). Máy dev là Windows; test tương tranh của AD-5 chạy trên file thật sẽ flaky, và lỗi commit sẽ thành 500 cho người dùng. Cũng chưa nói `mkdir -p` thư mục cha trước khi ghi (code hiện có làm việc này).
*Fix:* thêm vào AD-3: "rename retry tối đa ~10 lần, backoff 10–100 ms, chỉ với EPERM/EACCES/EBUSY; vẫn lỗi thì ném, state không đổi"; "commit tạo thư mục cha nếu thiếu".

**F-9 — Chống dò PIN (AD-11) mở cửa cho khóa toàn bộ nhân viên và dựa vào header giả được.**
Không có reverse proxy, `x-forwarded-for` do client tự đặt: kẻ dò đổi header mỗi lần để né khóa theo IP, chỉ còn khóa toàn cục chặn — và khóa toàn cục 30 lần/60 phút cho phép bất kỳ ai khóa mọi nhân viên liên tục bằng 30 request mỗi 15 phút. Rule ngăn được dò PIN nhưng tạo lỗ DoS cho đúng người dùng chính.
*Fix:* rule "chỉ tin `x-forwarded-for` khi `TRUST_PROXY=1`" (gắn với F-5); khóa toàn cục không chặn thiết bị đang có cookie hợp lệ (đã đăng nhập thì không bị ảnh hưởng) và ghi log cảnh báo; hoặc chốt PIN tối thiểu 6 số thay cho khóa toàn cục.

### Low

**F-10 — Env chỉ đọc trong `features/*/server.ts` mâu thuẫn với `proxy.ts`.** Proxy cần `STAFF_SESSION_SECRET` và `STAFF_PINS` để xác minh cookie, nhưng chỉ được import phần thuần của `staff`. *Fix:* cho phép `staff/staff-config.ts` (thuần, không fs) đọc env, hoặc `proxy.ts` đọc env rồi truyền vào `verifySession(cookie, config)`; sửa dòng quy ước.

**F-11 — Migration (AD-15) có thể chạy lại và hồi sinh dữ liệu cũ.** Nếu `shop-store.json` bị xóa/mất (restore hỏng), lần đọc sau lại import `orders.json` cũ và reset kho về seed, không báo gì. Hai request đầu đồng thời cũng cần kiểm tra lại "file đã tồn tại" bên trong mutex. *Fix:* sau import, đổi tên `orders.json` → `orders.json.migrated`; check-again trong mutex.

**F-12 — FR-22 "Nhân viên từ chối yêu cầu hủy" không có đường ghi.** Từ chối không phải chuyển trạng thái, nên không đi qua `transitions`; Deferred chỉ hoãn endpoint của khách. Có thể dẫn tới một route staff tự đặt, hoặc ghi `flags` ngoài mutator. *Fix:* thêm vào Deferred: "từ chối = xóa `flags.cancelRequestedAt` qua `store.update`, endpoint staff quyết cùng story FR-22"; `confirmed→cancelled` cũng xóa cờ.

**F-13 — Chỗ đặt hàm Trạng thái thanh toán (FR-16) chưa có.** Map chỉ có `delivery-estimate.ts`, `timeline.ts`. *Fix:* thêm `orders/payment-status.ts` (thuần, có test) vào AD-2 và Structural Seed.

**F-14 — Deferred CSRF dựa vào "chỉ nhận `application/json`" nhưng không AD nào bắt.** `readJsonBody` không kiểm `Content-Type`. *Fix:* thêm vào AD-12: handler `/api/staff/**` trả 415/400 nếu `Content-Type` không phải `application/json` (không áp cho route khách cũ để giữ FR-4).

**F-15 — "Mutator làm việc trên bản sao" không nói ai clone.** *Fix:* "store truyền `structuredClone(state)` cho mutator".

## 3. Từng tiêu chí của checklist

| Tiêu chí | Kết quả | Ghi chú |
|---|---|---|
| Chốt đúng điểm phân kỳ, không sót | **Một phần** | Sót F-1, F-2; chốt một nửa F-7, F-12, F-13. |
| Rule kiểm chứng được và thật sự ngăn phân kỳ đã nêu | **Phần lớn đạt** | AD-3/4/5/6 kiểm được bằng test. AD-6 mẫu thông điệp sai (F-4), AD-11 có lỗ (F-9), AD-10 tự mâu thuẫn (F-6). |
| Deferred không để hai unit phân kỳ | **Phần lớn đạt** | FR-22 bỏ sót phía staff (F-12); CSRF dựa vào rule không có (F-14); baseline Sổ kho (F-2c). Các mục còn lại (ngày lễ, OQ-2/3, hiệu năng, scale) an toàn vì nằm gọn một module. |
| Tech hiện hành | **Đạt** | Khớp `package.json`: Next 16.4.2 (`proxy.ts` là quy ước của Next 16), React 19.3.0, Zod ^4.6.7, Vitest ^5.0.5, Playwright ^1.64.1, Node ≥ 22.12. `force-dynamic` hợp lệ vì `next.config.ts` không bật `cacheComponents`; nên ghi rule "không bật `cacheComponents` trong phạm vi này" để tránh xung đột về sau. Không thêm dependency. |
| Phê chuẩn, không đi ngược brownfield | **Một phần** | Giữ `OrderError`, `http.ts`, `OrderRepository`, `createJsonFileOrderRepository`, catalog đồng bộ, `CancelOrderButton`, mã đơn, format. Đi ngược: đồ thị import (F-3), chữ ký service (F-1). |
| Phủ mọi FR | **Đạt về ánh xạ** | `binds` và Capability Map đủ FR-1..FR-23. Thiếu chỗ đặt FR-16 payment (F-13) và nửa staff của FR-22 (F-12). |
| Mọi chiều của altitude: quyết / hoãn / mở | **Chưa đạt ở vận hành** | Deploy, môi trường, backup, config/secrets, observability chỉ một câu (F-5). |
| Ngắn gọn: quyết định, không lập luận | **Đạt** | "Prevents" là một dòng; lập luận để ở addendum. Vài chỗ có lý do ngắn trong Deferred, chấp nhận được. |

## 4. Test hiện có: còn chạy nguyên assertion không?

| Test | Kết quả theo spine hiện tại | Điều kiện |
|---|---|---|
| `orders/order-repository.test.ts` | **Chạy** | AD-15 giữ `createJsonFileOrderRepository` và test của nó nguyên văn. |
| `orders/order-service.test.ts` | **Không xác định → nhiều khả năng gãy** | Dựng bằng `{ repository }` và gọi `repository.save` trực tiếp; spine nói service nhận `{ store }` (F-1). Assertion vẫn đúng nếu F-1 được sửa như đề xuất: `toEqual(order)` vẫn khớp khi đơn có thêm `statusHistory` vì cả bản trả về và bản lưu đều có; `INSUFFICIENT_STOCK` với p011/p004 khớp nếu in-memory store cũng seed từ `products.ts`. |
| `app/api/orders/route.test.ts` | **Không xác định** | Mock `orders/server` với `{ repository }` (F-1). Chạy được nếu `orderService` không kéo `store/server` hay `inventory/server` có fs vào lúc import. |
| `catalog/catalog-service.test.ts` | **Chạy** | Catalog giữ đồng bộ, chữ ký không đổi (nếu theo F-7 thì không thêm tham số). |
| `checkout/pricing.test.ts` | **Chạy** | Thêm `minDays`/`maxDays` vào `SHIPPING_OPTIONS` không ảnh hưởng assertion (không có `toEqual` trên cả object). |
| `e2e/shopping-flow.spec.ts` | **Chạy** | State `.e2e/` mới seed từ `products.ts`; `playwright.config.ts` phải sửa (`webServer.env`, `reuseExistingServer: false`, `globalSetup`) — sửa config, không sửa assertion. |
| cart, checkout-form, product-card | **Chạy** | Client nhận `stock` qua props, không đổi. |

## 5. Tóm tắt việc cần sửa (theo thứ tự)

1. F-1: chốt chữ ký `createOrderService` tương thích `{ repository }` và test seam in-memory.
2. F-2: bỏ seed lazy sau commit đầu, chốt quy trình nhập hàng + baseline Sổ kho; báo PM sửa FR-5 Out of Scope.
3. F-5: thêm bảng Operational envelope (deploy/TLS, process, config/secrets, backup/restore, observability).
4. F-4, F-6, F-3: sửa mẫu thông điệp xung đột, route group cho trang staff + ràng buộc `next`, đồ thị import.
5. F-7, F-8, F-9 rồi các mục low.
