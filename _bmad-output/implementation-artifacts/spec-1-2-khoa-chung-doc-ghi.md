---
title: 'Story 1.2: Khóa chung cho đọc/ghi, đặt và hủy đơn không đè nhau'
type: 'feature'
created: '2026-11-21'
status: 'done'
baseline_commit: '4e7cf3c4506b8877c4344b7d89ea753fc79589d8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Repository hiện tại đọc rồi ghi mà không có khóa. Vì vậy hai đơn được đặt cùng lúc, hoặc một lần khách hủy chạy chồng lên một lần ghi khác, có thể đè mất thay đổi của nhau. `cancelOrder` còn quyết định dựa trên một bản đọc có thể đã cũ.

**Approach:** Mở rộng port `OrderRepository` (chỉ thêm, theo AD-4) với `readState()` và `update(mutator)`. Mọi phương thức chạy trong một mutex dùng chung theo từng file. Mutator đồng bộ, nhận bản sao của state; mutator ném lỗi thì không ghi gì. Có ba adapter dùng chung lõi này: in-memory, file trạng thái mới (dựa trên Story 1.1), và file `orders.json` cũ (làm cầu nối cho tới Story 1.4). `cancelOrder` chạy hẳn trong mutator.

## Boundaries & Constraints

**Always:**
- Interface giữ nguyên `findAll`, `findById`, `save` (thêm hoặc cập nhật theo id) và thêm:
  - `readState(): Promise<ShopState>`
  - `update<T>(mutator: (s: ShopState) => { state: ShopState; result: T }): Promise<T>`
- `update` giữ khóa suốt ba bước đọc → mutator → kiểm bất biến → commit, và luôn nhả khóa (kể cả khi lỗi).
- Mutex là singleton trên `globalThis`, khóa theo `path.resolve(file)`; trên win32 khóa được viết thường. Hai repository mở cùng một file phải dùng chung một mutex.
- Chữ ký `createOrderService({ repository, findProduct?, now?, generateId? })` giữ nguyên. `createInMemoryOrderRepository(seed?, { inventory?, failNextCommit? })` vẫn gọi được với `()` hoặc `(seed)` như cũ.
- Mã lỗi, thông điệp và HTTP status của `POST /api/orders` và `PATCH /api/orders/:id` giữ nguyên (FR-1, FR-2).

**Never:**
- Không sửa `server.ts`, route hay test hiện có. Không đổi assertion cũ nào.
- Không đổi cách kiểm tra tồn kho trong `placeOrder`: vẫn đọc `product.stock`, việc đổi thuộc Story 1.6.
- Không cache state giữa các lần gọi. Không thêm dependency. Không thêm khóa PID hay `ensureInitialized` (thuộc Story 1.4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tuần tự hóa | 2 `update` trên cùng file chạy đồng thời | chạy lần lượt; mutator thứ hai thấy kết quả của mutator thứ nhất | N/A |
| Không mất đơn | 20 `placeOrder` đồng thời trên repo file trạng thái | file có đủ 20 đơn, id khác nhau | N/A |
| Hai instance cùng file | 2 repo mở cùng một đường dẫn (khác chữ hoa/thường trên win32) cùng `update` | dùng chung mutex, không mất cập nhật | N/A |
| Mutator ném lỗi | mutator ném `OrderError` | `update` reject với đúng lỗi đó; không commit; lần `update` sau vẫn chạy | lỗi được ném lên |
| Mutator sửa tại chỗ rồi ném | mutator đổi `s.orders[0].status` rồi ném | state của cả adapter in-memory lẫn file giữ nguyên như cũ | lỗi được ném lên |
| Bất biến sai | mutator trả về tồn kho âm | reject `ShopStateError`; không commit | ném lỗi |
| Commit hỏng (in-memory) | `failNextCommit: true` | `update` đầu tiên reject; state không đổi; lần sau thành công | ném lỗi |
| File chưa có | repo file trạng thái, file chưa tồn tại | `readState()` trả state rỗng `{schemaVersion:1, orders:[], inventory:{}, inventoryBaseline:{}}` và không tạo file | N/A |
| Khách hủy đơn | đơn `pending`, gọi `PATCH {status:"cancelled"}` | 200, đơn `cancelled`, `updatedAt` mới | N/A |
| Hủy sai trạng thái | đơn `confirmed`/`shipping`/`delivered`/`cancelled` | 409 `INVALID_STATUS_TRANSITION`, thông điệp cũ; đơn không đổi | lỗi ném từ trong mutator |
| Hủy đơn không có | id không tồn tại | 404 `ORDER_NOT_FOUND` | lỗi ném từ trong mutator |
| Hủy chạy cùng đặt đơn | `cancelOrder(A)` và `placeOrder(B)` đồng thời trên repo file | A là `cancelled` và B tồn tại, không lần nào đè lần nào | N/A |

</frozen-after-approval>

## Code Map

- `src/features/orders/shop-state-file.ts` -- `createShopStateFile(file, deps)` gồm `read()`/`commit()` (Story 1.1). Repo file trạng thái dùng lại nguyên, không sửa.
- `src/features/orders/state-schema.ts` -- `ShopState`, `assertShopStateInvariants`, `ShopStateError`.
- `src/features/orders/order-repository.ts` -- interface và 2 adapter cũ. `createJsonFileOrderRepository` (đọc/ghi mảng `Order[]`) phải giữ nguyên hành vi, vì test hiện có kiểm tra file thô là một mảng có length 1.
- `src/features/orders/order-service.ts` -- `placeOrder` (dòng cuối gọi `repository.save(order)`, giữ nguyên), `cancelOrder` (hiện đọc rồi `save`, cần chuyển sang `update`), `getOrder`, `listOrders`.
- `src/features/orders/server.ts` -- production đang dùng `createJsonFileOrderRepository(ORDERS_FILE)`, giữ nguyên tới Story 1.4. Vì thế adapter cũ cũng phải có `update`.
- `src/app/api/orders/route.test.ts` -- mock `createOrderService({ repository: createInMemoryOrderRepository() })`, phải xanh mà không sửa.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/orders/mutex.ts` -- `createMutex()` dùng promise chain, có `runExclusive(fn)`; thêm `getFileMutex(file, platform?)` dùng registry trên `globalThis` (`Symbol.for`), khóa theo `path.resolve`, viết thường trên win32.
- [x] `src/features/orders/mutex.test.ts` -- kiểm tra thứ tự tuần tự; lỗi không làm kẹt khóa; cùng đường dẫn thì ra cùng instance, kể cả khác chữ hoa/thường trên win32.
- [x] `src/features/orders/order-repository.ts` -- mở rộng interface. Thêm lõi chung nội bộ `createStateRepository({ mutex, load, persist })` để cài 5 phương thức (`save` = upsert qua `update`). Ba adapter dùng lõi này:
  - in-memory, có `inventory` và `failNextCommit`;
  - `createJsonFileShopRepository(file, deps?)` trên `createShopStateFile`;
  - `createJsonFileOrderRepository` cũ: nạp mảng thành state có tồn kho rỗng, khi ghi chỉ ghi lại `orders` (cầu nối tới Story 1.4).
- [x] `src/features/orders/order-repository.test.ts` -- thêm test (không sửa test cũ) phủ các dòng Tuần tự hóa, Hai instance cùng file, Mutator ném lỗi, Sửa tại chỗ rồi ném, Bất biến sai, `failNextCommit`, File chưa có. Mỗi ca chạy trên cả adapter in-memory và adapter file.
- [x] `src/features/orders/order-service.ts` -- `cancelOrder` dùng `repository.update`: tìm đơn, kiểm tra trạng thái và ném lỗi ngay trong mutator, trả về đơn đã hủy.
- [x] `src/features/orders/order-service.test.ts` -- thêm test 20 `placeOrder` đồng thời và test hủy chạy cùng đặt đơn, đều trên `createJsonFileShopRepository` với `mkdtemp`.

**Acceptance Criteria:**
- Given story hoàn tất, when chạy `npm run check`, then lint, typecheck và mọi test (cũ và mới) đều xanh, không sửa assertion cũ nào.
- Given code production, when tìm các chỗ gọi `repository.save`, then chỉ còn lần gọi trong `placeOrder` (thêm đơn mới).

## Implementation Notes

- Implement trực tiếp trong phiên chính.
- Test mới được tách ra file riêng để không đụng test cũ:
  - `order-repository-state.test.ts` thay vì sửa `order-repository.test.ts`;
  - `order-service-concurrency.test.ts` thay vì sửa `order-service.test.ts`.
- Thêm `src/app/api/orders/[id]/route.test.ts` vì trước đây route `PATCH` chưa có test nào; file này phủ các dòng 200/409/404/400 của bảng I/O.
- Repo không có file cấu hình Prettier, nhưng code gốc được format với `printWidth: 100`. File của story này được format bằng `--print-width 100` để diff chỉ còn thay đổi thật.
- Sau review: 8 patch (xem Triage Log). `npm run check`: exit 0, 18 file test, 170 test.

## Spec Change Log

## Review Triage Log

| # | Nguồn | Phát hiện | Verdict | Bằng chứng / xử lý |
|---|---|---|---|---|
| 1 | Blind | Adapter in-memory: `inventory` và `inventoryBaseline` trỏ cùng một object | high | Chạy thử với node: `structuredClone({i:x,b:x})` cho `i===b`, nên giảm tồn kho thì baseline giảm theo, và test in-memory sẽ lệch với production ở Story 1.6/3.x. **patch**: clone từng trường riêng; test decrement giờ kiểm tra baseline vẫn bằng 5 |
| 2 | Blind, Edge, VG | `cancelOrder` lấy `updatedAt` trước khi giữ khóa | low | `now()` được gọi trước `update`. **patch**: chuyển vào trong mutator |
| 3 | VG | Adapter `orders.json` (production) chưa có test hai instance dùng chung khóa | medium | Đổi sang `createMutex()` thì mọi test vẫn qua. **patch**: thêm test hai instance, 10 lần save đan xen |
| 4 | Blind | Dòng matrix "hai instance khác hoa/thường" chỉ được test ở mức key | low | **patch**: thêm test `it.runIf(win32)` với hai repo dùng hai đường dẫn khác hoa/thường, 10 lần update |
| 5 | Blind | Không test việc nhả khóa sau lỗi commit của adapter file, cũng không test tác vụ async bị reject | low | **patch**: thêm test `rename` lỗi EIO thì lần sau vẫn thành công, và test async reject trong mutex |
| 6 | Blind | `failNextCommit` ném `ShopStateError`, trùng với lỗi dữ liệu | low | **patch**: tách thành `InjectedCommitError` |
| 7 | Edge, Blind | In-memory không chạy `parseShopState` lúc commit; seed không được kiểm | low | Adapter file có chạy, adapter in-memory thì không. **patch**: parse khi commit, kiểm seed khi dựng |
| 8 | Blind | Thông điệp `ORDER_NOT_FOUND` bị nhân đôi; test route tự viết tay state rỗng | low | **patch**: dùng helper `orderNotFound` và `emptyShopState()` |
| 9 | Blind | Adapter `orders.json` âm thầm bỏ các thay đổi tồn kho | low | Có thật nhưng chưa có caller nào đổi tồn kho trước Story 1.4 (khi đó production sẽ chuyển sang adapter file trạng thái). Sửa sẽ phải thêm guard, nên **reject**; JSDoc của adapter đã ghi rõ |
| 10 | Blind, Edge, VG | File `orders.json` cũ có id trùng thì mọi lần ghi sau đều lỗi | low | `save` cũ là upsert nên không tự sinh id trùng, chỉ xảy ra khi sửa file bằng tay. **reject** |
| 11 | Blind, Edge | Mutex không reentrant và không có timeout | false | Mutator có kiểu đồng bộ và không gọi được repository. Một lần fs bị treo thì vẫn treo, có timeout hay không. **reject** |
| 12 | Blind, Edge | Khóa không xử lý trường hợp macOS không phân biệt hoa/thường, hoặc symlink | false | AD-4 quy định khóa theo `path.resolve` và viết thường trên win32; môi trường production là Windows hoặc Linux (spine) |
| 13 | Edge | Ghi từ tiến trình khác vẫn có thể đè nhau | false | Ngoài phạm vi khóa trong tiến trình; PID lock là việc của Story 1.4 (AD-5) |
| 14 | Blind, Edge | Registry mutex chỉ tăng, không bao giờ xóa | low | Mỗi đường dẫn chỉ tốn một entry. **reject** |
| 15 | Edge | `save` là upsert, nên id trùng ngẫu nhiên sẽ ghi đè đơn khác | low | Hành vi có từ trước (upsert vốn vậy); xác suất trùng 6 ký tự hex trong một ngày rất thấp. **defer** |
| 16 | Edge | `orders.json` không phải mảng bị ghi đè bằng mảng | false | Hành vi có từ trước; Story 1.4 có AC "file không phải mảng thì ném lỗi" |
| 17 | Blind | Thiếu test hồi quy `POST` cho nhánh lỗi bất biến mới | low | Test `POST` hiện có vẫn xanh mà không sửa; nhánh mới chỉ xảy ra khi dữ liệu đã hỏng. **reject** |

## Design Notes

Ba adapter dùng chung một lõi, nên quy tắc khóa, bản sao và bất biến chỉ nằm ở một chỗ:

```ts
function createStateRepository({ mutex, load, persist }): OrderRepository {
  const update = (m) => mutex.runExclusive(async () => {
    const { state, result } = m(structuredClone(await load()));
    assertShopStateInvariants(state);
    await persist(state);
    return result;
  });
  // readState / findAll / findById chạy qua mutex.runExclusive(load)
}
```

Adapter `orders.json` cũ chỉ là cầu nối: production vẫn chạy trên nó cho tới Story 1.4, và nó không lưu tồn kho.

## Verification

**Commands:**
- `npx vitest run src/features/orders src/app/api/orders` -- expected: mọi test xanh.
- `npm run check` -- expected: exit 0.
