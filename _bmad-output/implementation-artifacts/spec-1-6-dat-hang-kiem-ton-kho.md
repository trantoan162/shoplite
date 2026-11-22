---
title: 'Story 1.6: Đặt hàng kiểm tra Tồn kho lưu bền'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_commit: '459df93139be9f1338650f8ddc77881a93580a91'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `placeOrder` đang so số lượng đặt với `product.stock`, là hằng số trong `products.ts`. Tồn kho lưu bền (`ShopState.inventory`) đã có nhưng chưa ai đọc. Ngoài ra, việc kiểm tra và ghi đơn mới đang là hai bước tách rời.

**Approach:** Thêm module thuần `src/features/inventory/` (AD-9) gồm `availableStock`, `checkShortfall` và `reconcileInventoryKeys`. `placeOrder` kiểm tra tồn kho và chèn đơn trong **cùng một** mutator, đọc `state.inventory`. Repository file trạng thái nhận thêm hook `reconcile` chạy trong mutex sau mỗi lần nạp state; production dùng hook này để thêm key cho sản phẩm mới của catalog.

## Boundaries & Constraints

**Always:**
- Đặt hàng **không** trừ kho.
- Thông điệp 409 `INSUFFICIENT_STOCK` giữ nguyên câu chữ: hết hàng thì `Sản phẩm "‹tên›" đã hết hàng`; còn ít hơn số đặt thì `Sản phẩm "‹tên›" chỉ còn N sản phẩm`. Thứ tự kiểm tra giữ như cũ (theo thứ tự dòng hàng sau khi gộp).
- Tồn kho khả dụng:
  - `state.inventory` có key của sản phẩm thì dùng giá trị đó;
  - không có key thì dùng `stock` khai báo của sản phẩm, đúng giá trị mà `reconcileInventoryKeys` sẽ thêm. Nhờ vậy repository in-memory không seed tồn kho vẫn chạy như cũ.
- `reconcileInventoryKeys(levels, products)`:
  - là hàm thuần, trả object mới;
  - thêm key thiếu vào cả `inventory` lẫn `inventoryBaseline`, bằng `stock` khai báo;
  - giữ nguyên các id thừa;
  - `stock` không phải số nguyên ≥ 0 thì coi là 0, không bao giờ ra `NaN` hay số âm.
- Module `inventory` không import `orders` và không có I/O (AD-9, sơ đồ phụ thuộc trong spine).
- Chèn đơn kiểu insert-only: id đã tồn tại thì ném lỗi, không ghi đè (xử lý mục trong `deferred-work`).

**Never:**
- Không đổi hợp đồng `POST /api/orders` và không sửa assertion cũ.
- Không đổi catalog hay trang sản phẩm; đó là việc của Story 1.7.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Thiếu hàng | `inventory.X = 1`, đặt X×2 (catalog khai 40) | 409, thông điệp "chỉ còn 1 sản phẩm"; không tạo đơn; tồn kho không đổi | `OrderError` |
| Hết hàng | `inventory.X = 0` | 409, thông điệp "đã hết hàng" | `OrderError` |
| Đủ hàng | `inventory.X = 2`, đặt X×2 | 201; tồn kho vẫn bằng 2 (không trừ) | N/A |
| Không có key | in-memory không seed tồn kho, đặt p010×2 | dùng `stock` khai báo, chạy như trước | N/A |
| Hai đơn đồng thời | `inventory.X = 1`, hai đơn X×1 cùng lúc | cả hai được tạo (đặt hàng không giữ hàng) | N/A |
| Sản phẩm mới | `products` có id chưa có trong store | sau khi nạp: key được thêm với `stock` khai báo vào cả hai map | N/A |
| Id thừa | store có id không còn trong catalog | giữ nguyên | N/A |
| Stock hỏng | sản phẩm có `stock` âm hoặc `NaN` | key mới = 0 | N/A |
| Restart | commit rồi mở repository mới | đọc ra đúng tồn kho đã commit | N/A |
| Trùng id | `generateId` trả id đã có | ném lỗi; đơn cũ không bị ghi đè | ném lỗi |

</frozen-after-approval>

## Implementation Notes

- Spec được tự duyệt theo chỉ đạo của người dùng (2026-11-22).
- Thêm module `src/features/inventory/` (`types.ts`, `stock.ts`): hàm thuần, không import `orders`.
- `placeOrder` tra sản phẩm, kiểm tồn kho, sinh mã đơn và chèn đơn, tất cả trong một mutator. Mã đơn bị trùng thì thử lại tối đa 5 lần; nhờ vậy mục insert-only trong `deferred-work` đã xử lý xong.
- Repository: deps `reconcile` chạy trong mutex. Kết quả được kiểm schema và bất biến ngay, và được áp trước lần commit khởi tạo.
- Kết quả: vitest 249/249, lint và tsc sạch, E2E 3/3. Store E2E có đủ 16 key tồn kho.

## Spec Change Log

## Review Triage Log

| # | Nguồn | Phát hiện | Verdict | Xử lý |
|---|---|---|---|---|
| 1 | Edge | Thứ tự kiểm tra đổi: mọi `PRODUCT_NOT_FOUND` chạy trước mọi kiểm tồn kho (lệch spec "giữ như cũ") | medium | **patch**: dựng dòng hàng trong mutator, kiểm lần lượt từng dòng; có test giỏ [thiếu hàng, không có sản phẩm] trả `INSUFFICIENT_STOCK` |
| 2 | VG | Wiring `reconcile` trong `server.ts` chưa có test | medium | Xóa dòng `reconcile` thì mọi test vẫn qua. **patch**: thêm test `server.test.ts` trong đó store cũ thiếu key `p010` được thêm key và ghi xuống sau `update` |
| 3 | Blind, Edge | Kết quả `reconcile` không được kiểm; bước khởi tạo commit trước rồi mới reconcile | medium | **patch**: `reconciled()` = parse + bất biến; áp trước `file.commit` lúc khởi tạo |
| 4 | Blind, Edge | Mã đơn trùng thì ném `Error` thường và trả 500 | low | **patch**: thử lại `generateId` tối đa 5 lần trong mutator; có test |
| 5 | Blind | Đã dựng đơn và tiêu mã đơn trước khi biết có bị từ chối không | low | **patch** (đi kèm #1): mã đơn chỉ được sinh khi mọi dòng hợp lệ; có test |
| 6 | Blind, Edge, VG | `checkShortfall` coi key thiếu là 0, khác `placeOrder` | low | Cố ý: dùng cho bước xác nhận ở Story 3.1. **patch**: thêm tham số `fallback` và ghi rõ trong doc |
| 7 | Blind | `%p` không phải placeholder của Vitest | low | **patch**: đổi thành `%s` |
| 8 | Blind | Doc của `save` đã cũ | low | **patch**: ghi rõ "chỉ dùng cho test và script" |
| 9 | Blind | Chỉ báo dòng thiếu hàng đầu tiên | false | Hành vi cũ, spec yêu cầu giữ nguyên |
| 10 | Blind | Tồn kho lưu trữ thắng `stock` mới trong `products.ts` | false | AD-9 chủ ý; đổi tồn kho bằng `stock:set` (Story 1.8) |
| 11 | Blind | `availableStock` không kẹp giá trị NaN hay âm | false | Lúc đọc, schema và `assertShopStateInvariants` (Story 1.4) đã chặn các giá trị này |
| 12 | Blind | "409" trong tên test không được kiểm ở tầng HTTP | false | `route.test.ts` "409 - vượt quá tồn kho" đã kiểm qua `update` |
| 13 | Edge | `checkShortfall` với số lượng NaN, 0 hoặc âm | low | Caller đã validate số lượng (checkout schema). **reject** |

## Code Map

- `src/features/orders/order-service.ts:55` -- `placeOrder`: hiện dựng `orderItems`, kiểm tra `product.stock` rồi gọi `save`. Cần chuyển phần kiểm tra và chèn vào `update`.
- `src/features/orders/order-repository.ts` -- `createJsonFileShopRepository(file, { initialize, lock, ... })`; thêm deps `reconcile`, áp trong `load`.
- `src/features/orders/server.ts` -- truyền `reconcile` dùng `products`.
- `src/features/catalog/types.ts` -- `Product { id, stock, name, ... }`.
- `src/app/api/orders/route.test.ts` -- test 409 với p004 (catalog `stock: 0`) phải vẫn xanh khi in-memory không seed tồn kho.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/inventory/types.ts` -- kiểu `InventoryLevels` và `Shortfall`.
- [x] `src/features/inventory/stock.ts` -- `availableStock`, `checkShortfall(lines, inventory)`, `reconcileInventoryKeys`.
- [x] `src/features/inventory/stock.test.ts` -- unit test cho cả 3 hàm.
- [x] `src/features/orders/order-service.ts` -- dời phần kiểm tra tồn kho vào `repository.update`, kèm insert-only.
- [x] `src/features/orders/order-repository.ts`, `server.ts` -- deps `reconcile`.
- [x] `src/features/orders/place-order-stock.test.ts` -- phủ các dòng còn lại của I/O Matrix.

**Acceptance Criteria:**
- Given story hoàn tất, when chạy `npm run check` và E2E, then cả hai đều xanh mà không sửa assertion cũ nào.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=4` -- expected: xanh.
- `npm run check` -- expected: exit 0.
- `npx playwright test` -- expected: 3/3.
