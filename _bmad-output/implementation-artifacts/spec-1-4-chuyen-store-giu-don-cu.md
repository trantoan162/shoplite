---
title: 'Story 1.4: Chuyển sang file trạng thái, giữ đơn cũ, chỉ một tiến trình'
type: 'feature'
created: '2026-11-21'
status: 'done'
baseline_commit: '72c185c859862d78a944985a6120fcf2f1f51912'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Production vẫn ghi đơn vào `storage/orders.json` qua adapter cầu nối. File trạng thái mới (có tồn kho, ghi nguyên tử) đã có nhưng chưa được dùng, và không có gì ngăn hai tiến trình cùng ghi một store.

**Approach:** `server.ts` chuyển sang `createJsonFileShopRepository(STORE_FILE)`. Ở thao tác đầu tiên, `ensureInitialized` chạy trong mutex: nếu store chưa có thì nhập nguyên trạng các đơn từ `ORDERS_FILE` và đặt tồn kho bằng `stock` trong `products.ts` (AD-15). Store được giữ bởi một PID lock `<STORE_FILE>.lock`, lấy lười ở lần truy cập đầu (AD-5).

## Boundaries & Constraints

**Always:**
- **Khởi tạo** chạy trong mutex. Sau khi giữ khóa, đọc lại `STORE_FILE` để kiểm, nên khởi tạo chỉ xảy ra một lần.
  - Có `ORDERS_FILE` hợp lệ: nhập đơn nguyên trạng, kể cả trường lạ.
  - Không có `ORDERS_FILE`: `orders = []`.
  - `ORDERS_FILE` có nhưng không phải mảng `Order` hợp lệ: ném `ShopStateError` và **không** tạo store.
  - `inventory` và `inventoryBaseline` đều bằng `stock` của mọi sản phẩm.
  - Từ đó trở đi không ghi vào `orders.json` nữa.
- **PID lock**: tạo file với cờ `wx` và ghi PID.
  - Lock của chính PID này (HMR, nhiều repo trong một tiến trình): dùng lại.
  - Lock của PID khác còn sống: ném `StoreLockedError` kèm thông điệp rõ ràng.
  - Lock của PID đã chết: ghi đè.
  - Thoát bình thường thì xóa lock của mình.
- **Import không có tác dụng phụ**: import `server.ts`, kể cả lúc `next build`, không lấy lock và không tạo file.
- Store JSON hỏng thì ném `ShopStateError` (route trả 500 qua `handleRouteError`), không ghi đè.
- Biến môi trường: `STORE_FILE` (mặc định `storage/shop-store.json`) và `ORDERS_FILE` (mặc định `storage/orders.json`, chỉ dùng để nhập lần đầu).

**Never:**
- Không xóa hay sửa `orders.json`.
- Không đổi hành vi của `placeOrder`: việc kiểm tra tồn kho lưu bền thuộc Story 1.6.
- Không đổi chữ ký `createOrderService`. Không thêm dependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nhập đơn cũ | chưa có store; `ORDERS_FILE` có 3 đơn (1 đơn có trường lạ) | store gồm 3 đơn nguyên trạng; `inventory = inventoryBaseline = stock`; `orders.json` không đổi từng byte | N/A |
| Không có file nào | chưa có store, chưa có `ORDERS_FILE` | store `orders: []`, tồn kho = `stock` | N/A |
| File cũ hỏng | `ORDERS_FILE` là `{}` hoặc chứa một đơn sai schema | ném `ShopStateError`; không tạo `STORE_FILE` | lỗi được ném lên |
| Hai request đầu | hai thao tác đồng thời khi chưa có store | bước khởi tạo chạy đúng 1 lần | N/A |
| Sau khởi tạo | đặt đơn mới | đơn nằm trong `STORE_FILE`; `orders.json` không đổi | N/A |
| Store hỏng | `STORE_FILE` là JSON sai | ném `ShopStateError`; file không bị ghi đè | lỗi được ném lên |
| Lock PID khác còn sống | file lock chứa PID của một tiến trình đang chạy | ném `StoreLockedError` có tên file và PID | lỗi được ném lên |
| Lock PID đã chết | file lock chứa PID không tồn tại | ghi đè lock, chạy bình thường | N/A |
| Cùng PID | hai repository trên cùng file trong một tiến trình | cả hai đều chạy | N/A |
| Import thuần | chỉ tạo repository, chưa gọi gì | không có file lock, không có store | N/A |
| Thả lock | gọi `releaseStoreLocks()` (hook thoát) | file lock của mình bị xóa | lỗi xóa bị bỏ qua |

</frozen-after-approval>

## Code Map

- `src/features/orders/server.ts` -- hiện dùng `createJsonFileOrderRepository(ORDERS_FILE)`; cần đổi sang repository file trạng thái.
- `src/features/orders/order-repository.ts:85` -- `createJsonFileShopRepository(file, deps)`. Khi file chưa có thì `load` trả `emptyShopState()`. Cần thêm deps `initialize` và lock.
- `src/features/orders/state-schema.ts` -- `orderSchema` (`looseObject`) dùng để validate đơn cũ; `ShopStateError`.
- `src/features/orders/shop-state-file.ts` -- `read()` trả `null` khi chưa có file; `commit()`.
- `src/data/products.ts` -- `products[].id` và `.stock` là nguồn tồn kho khởi tạo. Truyền qua tham số để test không phụ thuộc catalog thật.
- `src/features/orders/order-repository-state.test.ts` -- mẫu test chạy trên `mkdtemp`.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/orders/store-init.ts` -- `importLegacyOrders(file)` (validate bằng `z.array(orderSchema)`) và `buildInitialShopState(legacyOrders, products)`.
- [x] `src/features/orders/process-lock.ts` -- `acquireStoreLock(file, deps?)`: registry trên `globalThis`, cờ `wx`, xử lý lock của PID còn sống hay đã chết bằng `process.kill(pid, 0)`. Thêm `releaseStoreLocks()`, `StoreLockedError`, và đăng ký `process.once("exit")` một lần.
- [x] `src/features/orders/order-repository.ts` -- `createJsonFileShopRepository(file, { ...fileDeps, initialize?, lock? })`. Trong mutex, lấy lock trước rồi mới đọc; nếu chưa có store và có `initialize` thì commit kết quả của nó.
- [x] `src/features/orders/server.ts` -- dùng `STORE_FILE` và `initialize` từ `ORDERS_FILE` + `products`; cập nhật doc comment.
- [x] `src/features/orders/store-init.test.ts`, `src/features/orders/process-lock.test.ts` -- phủ toàn bộ I/O Matrix trên `mkdtemp`.

**Acceptance Criteria:**
- Given story hoàn tất, when chạy `npm run check` và `npm run test:e2e`, then cả hai xanh. E2E chạy trên `.e2e/shop-store.json` và `data-isolation.spec.ts` thấy đơn trong store mới.
- Given `storage/` không tồn tại, when chạy `npx next build`, then build thành công và `storage/` vẫn không tồn tại.

## Implementation Notes

- Implement trực tiếp trong phiên chính.
- Test `file chưa tồn tại` của Story 1.2 giờ truyền `lock: false`. Lý do: lần truy cập đầu tạo file lock theo AD-5, đây là thay đổi có chủ ý; phần lock có test riêng trong `process-lock.test.ts`.
- E2E 3/3 xanh trên `.e2e/shop-store.json`: 2 đơn, 16 sản phẩm tồn kho, `storage/` không được tạo. `next dev` dừng một lần vì thông báo bảo mật của Next, chạy lại thì xanh. Nhiều request đều chạy mà không gặp `StoreLockedError`, nên `next dev` chạy một tiến trình.
- Sau E2E còn sót `shop-store.json.lock`: Playwright kill server nên hook `exit` không chạy. PID trong file đã chết (`ESRCH`), lần sau sẽ được ghi đè.
- `next build` exit 0; `storage/` không được tạo.
- `npm run check`: exit 0.
- Sau review: 13 patch. 137 test orders/api xanh, chạy 2 lần liên tiếp để kiểm ổn định.
  - Lần test bị treo trước đó là do pipe hoặc tiến trình sót lại, không phải do code: ghi ra file thì 10/10 xanh trong 1,8 giây.
  - Prettier độ rộng 100 đã format lại luôn 4 file của Story 1.1; chỉ đổi format (một phần của mục trong `deferred-work`).
- **E2E sau patch chưa chạy được**: `next dev` dừng cả 3/3 lần vì thông báo bảo mật Next 16.4.2. Sẽ kiểm lại sau khi nâng Next lên 16.4.6 (commit riêng). E2E trước patch đã xanh 3/3.

## Spec Change Log

## Review Triage Log

| # | Nguồn | Phát hiện | Verdict | Bằng chứng / xử lý |
|---|---|---|---|---|
| 1 | VG | Wiring production trong `server.ts` (STORE_FILE, nhập ORDERS_FILE, catalog thật) chưa có test nào; `data-isolation` vẫn qua nếu đơn nằm ở file cũ | medium | Route test mock `server.ts`, còn E2E chấp nhận đơn ở cả hai file. **patch**: thêm `server.test.ts` (đặt env, import thật, kiểm đơn cũ được nhập, đơn mới vào store, tồn kho bằng catalog, file cũ giữ nguyên từng byte). E2E giờ chỉ chấp nhận `E2E_STORE_FILE` và kiểm `E2E_ORDERS_FILE` không tồn tại |
| 2 | Blind, Edge | Lock vừa tạo bằng `wx` còn rỗng có thể bị tiến trình khác đọc thành lock hỏng rồi xóa | medium | `wx` tạo file trước khi ghi PID. **patch**: ghi PID ra file tạm rồi `link` sang tên lock, nên không ai đọc thấy lock rỗng |
| 3 | Blind, Edge | Hai tiến trình cùng thấy một lock đã chết, cùng xóa rồi cùng tạo lại lock | medium | Có thật nếu hai tiến trình khởi động cùng lúc trên một lock chết; cách sửa an toàn (thay thế nguyên tử rồi xác minh lại) không nhỏ. **defer** |
| 4 | Blind, Edge | `parseInt` dễ dãi: `4242abc` hoặc `12.5` bị đọc thành PID | low | **patch**: chỉ chấp nhận chuỗi toàn chữ số, có test |
| 5 | Blind, Edge | Lỗi cuối báo "PID -1" | low | **patch**: `ownerPid: null` kèm thông điệp riêng |
| 6 | Blind, Edge | PID bị cấp lại cho tiến trình khác thì lock chặn mãi | low | Rủi ro đã chấp nhận (epics 1.4). **patch** một phần: thông điệp hướng dẫn xóa file lock, có test. Ghi thêm nonce hay start-time vào lock: **defer** |
| 7 | Blind, Edge | Dừng bằng SIGINT/SIGTERM không thả lock | low | Nhánh "PID đã chết thì ghi đè" xử lý được, đã kiểm (lock sót sau E2E có PID `ESRCH`). Thêm handler signal có thể chen vào shutdown của Next. **reject** |
| 8 | Blind, Edge | `lock: { isAlive }` làm mất `platform` | low | **patch**: gộp `{ platform, ...lock }` |
| 9 | Blind, Edge | Registry bỏ qua deps; test không gọi `releaseStoreLocks` | low | **patch**: thêm `releaseStoreLocks()` vào `afterEach` của 3 file test |
| 10 | Blind | Đường mặc định tạo lock nhưng test 1.2 chuyển sang `lock: false` nên không còn kiểm | low | **patch**: thêm test mặc định tạo lock nhưng không tạo store |
| 11 | VG, Blind | Bỏ BOM ở `importLegacyOrders` chưa có test; regex chứa ký tự U+FEFF trần | low | **patch**: viết thành `\uFEFF` ở cả 2 file và thêm test BOM |
| 12 | Blind | Thiếu test "initialize xong nhưng commit đầu lỗi" | low | **patch**: rename lỗi thì không tạo store; lần sau `initialize` chạy lại; file cũ không đổi |
| 13 | Edge | `STORE_FILE=""` bị resolve thành thư mục hiện tại | low | **patch**: đổi `??` thành `\|\|` |
| 14 | Blind, VG | Comment E2E cũ vẫn ghi "Story 1.4 sẽ chuyển" | low | **patch** |
| 15 | Blind, Edge | Lock không được kiểm lại sau khi đã lấy | low | Chỉ có ý nghĩa nếu xảy ra race #3. **reject** (gộp vào defer #3) |
| 16 | Blind, Edge | `StoreLockedError` và lỗi nhập đơn cũ chỉ hiện thành 500 chung | low | `handleRouteError` có `console.error` đầy đủ thông điệp; AD-17 không cho thêm mã lỗi mới. **reject** |
| 17 | Edge | `releaseStoreLocks` chạy khi lock đang lấy dở | low | Chỉ xảy ra lúc thoát. **reject** |
| 18 | Edge | `STORE_FILE` trùng `ORDERS_FILE` | low | Cấu hình sai hiển nhiên. **reject** |
| 19 | Blind, Edge | `products` có id trùng thì bị gộp | false | Catalog tĩnh, id duy nhất |
| 20 | Blind | Tồn kho khởi tạo bằng toàn bộ `stock` dù có đơn cũ `pending` | false | Đúng FR-3: chỉ trừ kho khi xác nhận |
| 21 | Edge | Đơn cũ thiếu trường thì cả store không khởi tạo được | false | AD-15 chủ ý; thông điệp có vị trí đơn sai (`prettifyError`) |
| 22 | Edge | Reader cũ dễ dãi (không phải mảng → `[]`) nay ném lỗi | false | AD-15 chủ ý, để không tạo store với 0 đơn từ một file hỏng |

## Design Notes

`createJsonFileOrderRepository` vẫn giữ kiểu `OrderRepository` thay vì đổi sang `LegacyOrderFile` như AD-15 ghi. Lý do: sau story này nó không còn caller nào trong production, còn test hiện có (nhiều instance, `update`) vẫn dùng được. Nhập đơn cũ đi qua `importLegacyOrders`, không qua adapter đó.

```ts
load: async () => {
  if (lock) await acquireStoreLock(filePath);
  const existing = await file.read();
  if (existing || !initialize) return existing ?? emptyShopState();
  const state = await initialize();   // chỉ chạy khi đang giữ mutex
  await file.commit(state);
  return state;
}
```

## Verification

**Commands:**
- `npx vitest run src/features/orders src/app/api/orders` -- expected: xanh.
- `npm run check` -- expected: exit 0.
- `npx playwright test` -- expected: 3/3 xanh.
- `npx next build`, sau đó `ls storage` -- expected: build thành công, `storage/` không tồn tại.
