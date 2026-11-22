---
title: 'Story 1.1: Kho trạng thái một file, ghi nguyên tử'
type: 'feature'
created: '2026-11-21'
status: 'done'
baseline_commit: '4bbb393584f8d0717240aed5dfa9898e34f5d00b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hiện mỗi lần `save()` đọc toàn bộ `orders.json`, sửa rồi ghi đè, và không `sync`. Tồn kho cũng chưa được lưu ở đâu. Máy chết hoặc đĩa lỗi giữa chừng có thể để lại file hỏng, và chưa có cách nào chứng minh tính nguyên tử bằng test.

**Approach:** Thêm lớp lưu trữ cấp thấp cho `ShopState` (đơn + tồn kho trong một file) theo AD-3: schema Zod giữ trường lạ, commit qua `.tmp` → `sync` → `rename` có retry → fsync thư mục, và một `fs` port inject được để test chèn lỗi (AD-6). Story này chưa nối vào service hay route; mutex và `update()` thuộc Story 1.2.

## Boundaries & Constraints

**Always:**
- `ShopState = { schemaVersion: 1, orders, inventory, inventoryBaseline, stockLedger? }`. Schema dùng `z.looseObject` ở **mọi cấp** (state, order, customer, item, image, ledger entry).
- Trình tự commit:
  1. `mkdir -p` thư mục chứa.
  2. Mở `<file>.tmp` với cờ `"w"`, `writeFile`, `sync()`, `close()`.
  3. `rename` sang file chính. Retry khi gặp `EPERM`/`EACCES`/`EBUSY`, tối đa 5 lần, backoff 20/40/80/160/320 ms.
  4. `fsyncDir`, nhưng không làm trên `win32`.
- Trước khi ghi phải kiểm tra bất biến: mọi giá trị `inventory` và `inventoryBaseline` là số nguyên ≥ 0, id đơn duy nhất. Vi phạm thì ném lỗi, không đụng đĩa.
- Điểm chèn lỗi (port `fs`, `sleep`, `platform`) chỉ đưa vào qua tham số deps; mặc định là `node:fs/promises` thật.

**Never:**
- Không sửa `order-repository.ts`, `order-service.ts`, `server.ts` hay route nào. `createJsonFileOrderRepository` cùng test của nó giữ nguyên.
- Không thêm mutex, `update()`, PID lock hay khởi tạo store. Các phần đó thuộc Story 1.2 và 1.4.
- Không thêm dependency. Không đọc điểm chèn lỗi từ biến môi trường. Không cache state.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chưa có file | `STORE_FILE` không tồn tại | `read()` trả `null` | N/A |
| Ghi rồi đọc | commit một state hợp lệ, thư mục cha chưa có | thư mục được tạo; `read()` trả state bằng đúng state đã ghi | N/A |
| Lỗi trước rename | port ném lỗi ở `writeFile`, `sync` hoặc `rename` | `commit` reject; file chính giữ nguyên từng byte; một instance mới đọc ra state cũ | lỗi được ném lên |
| Windows bận | `rename` ném `EPERM` 2 lần rồi thành công | commit thành công, `rename` được gọi 3 lần | N/A |
| Hết retry | `rename` luôn ném `EBUSY` | reject sau 1 + 5 lần thử; file cũ còn nguyên | ném lỗi cuối cùng |
| Lỗi khác | `rename` ném `ENOSPC` | không retry, reject ngay | ném lỗi |
| `.tmp` sót lại | có `<file>.tmp` chứa rác | `read()` bỏ qua nó; commit kế tiếp ghi đè nó | N/A |
| Trường lạ | đơn có `foo: 1`, gốc có `extra: {}` | đọc → commit → đọc giữ nguyên `foo` và `extra` | N/A |
| File hỏng | JSON sai cú pháp, hoặc `schemaVersion` khác 1, hoặc thiếu `orders` | `read()` ném lỗi mô tả rõ; không ghi gì | ném lỗi |
| Bất biến sai | `inventory.p001 = -1`, `1.5`, hoặc hai đơn trùng id | `commit` ném lỗi, không gọi `open` | ném lỗi |
| win32 | `platform = "win32"` | không gọi `fsyncDir` | N/A |

</frozen-after-approval>

## Code Map

- `src/features/orders/order-repository.ts` -- adapter cũ; dùng làm mẫu `mkdir`/`.tmp`/`rename`. **Không sửa** (Story 1.2 mới tích hợp).
- `src/features/orders/order-repository.test.ts` -- mẫu test: `// @vitest-environment node`, `mkdtemp`, `rm` trong `afterEach`, có `sampleOrder()`.
- `src/features/orders/types.ts` -- `Order`, `OrderItem`, `OrderCustomer`, `ORDER_STATUSES`. Schema mới phải khớp các kiểu này (dùng `satisfies` hoặc test kiểu).
- `src/features/checkout/checkout-schema.ts` (`PAYMENT_METHODS`) và `src/features/checkout/pricing.ts` (`SHIPPING_METHODS`) -- dùng lại cho `z.enum`.
- `vitest.config.ts` -- môi trường mặc định jsdom, nên file test có fs phải khai báo `// @vitest-environment node`.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/orders/state-schema.ts` -- tạo `orderSchema`, `shopStateSchema` (`looseObject` mọi cấp, `schemaVersion: z.literal(1)`, `inventory` là `z.record(z.string(), z.number())`), type `ShopState`, hàm `parseShopState(raw: unknown): ShopState` (ném lỗi có thông điệp) và `assertShopStateInvariants(state)` -- nguồn schema duy nhất cho các story sau.
- [x] `src/features/orders/state-schema.test.ts` -- test round-trip giữ trường lạ, reject sai version, test bất biến (âm, lẻ, trùng id) -- AD-10.
- [x] `src/features/orders/shop-state-file.ts` -- `createShopStateFile(filePath, deps?)` trả `{ read(): Promise<ShopState | null>; commit(state): Promise<void> }`; deps `{ fs?: ShopStateFs; sleep?: (ms) => Promise<void>; platform?: NodeJS.Platform }`. Export interface `ShopStateFs` và `defaultShopStateFs` -- port chèn lỗi của AD-6.
- [x] `src/features/orders/shop-state-file.test.ts` -- phủ mọi dòng của I/O Matrix. Chạy trên `mkdtemp` thật; lỗi được chèn bằng cách bọc `defaultShopStateFs`; dùng `sleep` giả để test chạy nhanh.

**Acceptance Criteria:**
- Given story hoàn tất, when chạy `npm run check`, then lint, typecheck và toàn bộ test (cũ và mới) đều xanh, không sửa assertion cũ nào.
- Given `ShopState` trong TypeScript, when so với `Order` ở `types.ts`, then một `Order` hợp lệ gán được vào `ShopState["orders"][number]` mà không cần ép kiểu.

## Implementation Notes

- Implement trực tiếp trong phiên chính (không dùng subagent cho step-03). Tạo 4 file: `state-schema.ts`, `state-schema.test.ts`, `shop-state-file.ts`, `shop-state-file.test.ts`. Không sửa file cũ nào.
- Sau review: bỏ `as ShopState` ở `parseShopState`. Output của schema giờ phải gán được vào `ShopState`/`Order`. Đã thử xóa `total` khỏi `orderSchema`, typecheck báo lỗi như mong đợi.
- `read()` giờ kiểm tra cả bất biến và bỏ BOM UTF-8. `commit()` không để lỗi `close()` che mất lỗi gốc của `writeFile`/`sync`.
- `npm run check`: exit 0, 14 file test, 129 test.

## Spec Change Log

## Review Triage Log

| # | Nguồn | Phát hiện | Verdict | Bằng chứng / xử lý |
|---|---|---|---|---|
| 1 | Blind, VG | `as ShopState` che việc schema lệch khỏi `Order`; AC kiểu chỉ được thỏa một cách tầm thường | medium | Xóa `total: z.number()` mà typecheck vẫn qua. **patch**: bỏ cast, đã thử xóa `total` thì tsc báo lỗi |
| 2 | Blind, VG | Schema lồng (item, image, customer, enum, baseline) không có test reject | low | Không có ca reject nào trong test cũ. **patch**: thêm 7 ca vào `state-schema.test.ts` |
| 3 | VG | Không test nhánh retry `EACCES` | low | grep không thấy `EACCES` trong test. **patch**: đổi sang `it.each` EPERM/EACCES/EBUSY |
| 4 | Blind, VG | Test "bất biến sai" chỉ spy `open`, không bắt `mkdir` | low | Chuyển `mkdir` lên trước validate thì test vẫn qua. **patch**: spy mọi hàm ghi và kiểm tra thư mục không tồn tại |
| 5 | Blind, VG | Assert `open` không được gọi trong test "file hỏng" luôn đúng, vô nghĩa | low | `read()` không bao giờ gọi `open`. **patch**: dùng `expectNoWrites` và kiểm tra không có `.tmp` |
| 6 | Blind, Edge | `read()` không kiểm bất biến, file xấu khiến mọi commit sau đều lỗi | medium | Đọc qua `parseShopState` mà không gọi `assertShopStateInvariants`. **patch**: kiểm bất biến khi đọc, kèm test |
| 7 | Blind, Edge | Lỗi `close()` trong `finally` che lỗi gốc | medium | `finally { await handle.close() }` ném đè lên lỗi. **patch**: chỉ ném lỗi close khi phần ghi thành công, kèm 2 test |
| 8 | Edge | File có BOM bị coi là JSON hỏng | low | `JSON.parse` không chấp nhận BOM. **patch** một dòng, kèm test |
| 9 | Blind, Edge | Lỗi đọc khác ENOENT không có test và trả errno thô | low | Hành vi đúng: lỗi I/O khác với file hỏng. **patch** chỉ thêm test truyền lỗi lên |
| 10 | Blind | Tên `noSleep` gây hiểu nhầm | low | Đó là factory `vi.fn` chứ không phải mock. **patch**: đổi thành `fakeSleep()` |
| 11 | Blind, Edge | `fsyncDir` lỗi sau khi `rename` đã xong thì `commit` reject dù dữ liệu đã thay | low | Có thật nhưng chỉ xảy ra trên FS không hỗ trợ fsync thư mục; sửa phải thêm nhánh. **reject** theo luật low. Ghi chú cho Story 1.2: CAS phía trên làm lần thử lại an toàn |
| 12 | Blind, Edge | `.tmp` không bị xóa sau khi lỗi | false | Spec frozen chủ đích chọn bỏ qua `.tmp` sót lại và ghi đè ở commit sau; đã có test |
| 13 | Edge | Đường `.tmp` cố định nên hai commit đồng thời đè nhau | false | Theo hợp đồng lớp này không có khóa; Story 1.2 tuần tự hóa bằng mutex, Story 1.4 thêm PID lock; hiện chưa có caller |
| 14 | Edge | `.tmp` sót lại là thư mục hoặc file read-only | low | Hầu như không gặp; sửa phải thêm `rm`. **reject** |
| 15 | Blind, Edge | Trường lạ chứa BigInt/Date/undefined làm hỏng round-trip | low | State luôn đến từ JSON hoặc object thuần do server dựng. **reject** |
| 16 | Edge | Zod bỏ key `__proto__` trong `inventory` | low | Khóa tồn kho là `p001`… **reject** |
| 17 | Blind, Edge | Key `inventory` và `inventoryBaseline` lệch nhau, hoặc tồn kho lớn hơn baseline | false | Không thuộc tập bất biến của AD-4; key được đối soát ở Story 1.6 (`reconcileInventoryKeys`) |
| 18 | Blind, Edge | Số lượng hoặc tiền âm/lẻ trên đơn vẫn qua schema | low | Đơn do server tạo, đã qua schema checkout. **reject** |
| 19 | Blind | Retry `EPERM`/`EACCES` trên mọi nền tảng làm chậm lỗi quyền vĩnh viễn ~620 ms | false | AD-3 và spec frozen quy định retry không phân biệt nền tảng |

## Design Notes

Tách lớp file ra `shop-state-file.ts` thay vì nhét vào `order-repository.ts` (epics ghi "dự kiến"). Lý do: Story 1.2 sẽ dựng `createJsonFileShopRepository` (có mutex, `readState`, `update`) trên `read`/`commit` này, còn file cũ thì để yên cho tới khi được tích hợp. Ví dụ port:

```ts
export interface ShopStateFs {
  mkdir(dir: string): Promise<void>;
  open(file: string): Promise<{ writeFile(data: string): Promise<void>; sync(): Promise<void>; close(): Promise<void> }>;
  rename(from: string, to: string): Promise<void>;
  readFile(file: string): Promise<string>; // ENOENT giữ nguyên code
  fsyncDir(dir: string): Promise<void>;
}
```

## Verification

**Commands:**
- `npx vitest run src/features/orders` -- expected: mọi test của `state-schema` và `shop-state-file` xanh.
- `npm run check` -- expected: thoát với mã 0.
