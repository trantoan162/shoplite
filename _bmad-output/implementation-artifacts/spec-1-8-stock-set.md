---
title: 'Story 1.8: Chủ shop đặt lại tồn kho bằng lệnh'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_commit: '3ea39e4780913cd391da4af819b5596ae35db9e4'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tồn kho giờ nằm trong `shop-store.json`. Muốn đổi khi nhập hàng về, chủ shop chỉ còn cách sửa file bằng tay. Làm vậy dễ hỏng JSON, dễ lệch `inventoryBaseline` (cần cho đối soát SM-2), và có thể ghi đè trong lúc server đang chạy.

**Approach:** Theo AD-16, thêm một đường duy nhất là `npm run stock:set -- p004=10 …`.
- Script dùng chính repository của server: đi qua `update`, mutex, ghi nguyên tử, và tôn trọng PID lock.
- Script đặt `inventory[id]` về số mới, và cộng phần chênh lệch vào `inventoryBaseline[id]`.
- Phần thuần (parse tham số, tính mức mới) nằm ở `inventory/stock.ts`.
- Phần điều phối nằm ở `orders/stock-set.ts`. `orders/shop-store.ts` dùng chung cấu hình repository (initialize, reconcile) giữa server và script.
- Script chạy bằng Node có sẵn (strip types) cộng một resolve hook nhỏ cho alias `@/` và import không đuôi. Không thêm dependency.

## Boundaries & Constraints

**Always:**
- Tham số có dạng `‹id›=‹số›`.
  - `id` phải có trong catalog.
  - Số phải là số nguyên ≥ 0, chỉ gồm chữ số.
  - Cùng một id không được xuất hiện hai lần.
  - Không có tham số nào là lỗi.
- Có lỗi tham số thì báo **tất cả** lỗi cùng lúc, thoát với mã 1, và không ghi gì.
- `inventoryBaseline[id] += mới − cũ`, nên đẳng thức "tồn kho = baseline − đã xuất" vẫn giữ.
- Server đang giữ PID lock thì thoát mã 1 với thông điệp "dừng server trước", không ghi gì. Script chạy xong, kể cả khi lỗi, phải thả lock của mình.
- Store chưa tồn tại thì khởi tạo y như server (nhập `ORDERS_FILE`, tồn kho bằng `stock` khai báo), sau đó mới áp lệnh.
- In ra từng thay đổi dạng `p004: 2 → 10 (+8)`.

**Never:**
- Không ghi dòng Sổ kho: `stockLedger` thuộc Story 5.2 (FR-20); 5.2 sẽ thêm lý do `manual_adjustment`.
- Không thêm dependency. Không có giao diện web.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Đặt lại | store: p004 tồn 2, baseline 5; `p004=10` | tồn 10, baseline 13; in `p004: 2 → 10 (+8)`; exit 0 | N/A |
| Giảm | p010 tồn 200, baseline 200; `p010=150` | tồn 150, baseline 150 (−50) | N/A |
| Nhiều id | `p001=1 p002=2` | cả hai được đặt trong một lần commit | N/A |
| Tham số sai | `p999=1 p001=-1 p002=1.5 p003 p001=2` | liệt kê mọi lỗi; exit 1; file không đổi | lỗi tham số |
| Trùng id | `p001=1 p001=2` | lỗi "trùng"; không ghi | lỗi tham số |
| Không tham số | (rỗng) | lỗi kèm hướng dẫn cú pháp; exit 1 | lỗi tham số |
| Server đang chạy | lock của một PID khác còn sống | exit 1, thông điệp "dừng server trước"; file không đổi | `StoreLockedError` |
| Chưa có store | không có `STORE_FILE` | khởi tạo store rồi áp lệnh | N/A |
| Chạy thật | `node … scripts/stock-set.mts p010=5`, `STORE_FILE` trỏ vào file tạm | exit 0, file có `p010: 5`; không cần dependency mới | N/A |

</frozen-after-approval>

## Implementation Notes

- Spec được tự duyệt theo chỉ đạo của người dùng (2026-11-22).
- Script là `scripts/stock-set.mts`, chạy bằng Node có sẵn: `--experimental-strip-types` cộng resolve hook `scripts/ts-resolve*.mjs` cho alias `@/` và import không đuôi. Không thêm dependency. `jiti` có sẵn trong `node_modules` nhưng chỉ là dependency gián tiếp, nên không dùng.
- `StoreLockedError` bỏ parameter properties. `tsconfig` bật `erasableSyntaxOnly` để `tsc` chặn cú pháp mà strip-types không chạy được.
- `server.ts` và script dùng chung `createShopStore()` (`orders/shop-store.ts`).
- Chạy thật trên file tạm: `p010: 200 → 5 (-195)`, exit 0; tham số sai liệt kê đủ 4 lỗi, exit 1, không ghi gì.
- Kết quả: `npm run check` exit 0 (277 test; vitest giới hạn `maxWorkers: 4` vì chạy song song tối đa làm máy quá tải và test bị timeout), E2E 4/4.

## Spec Change Log

## Review Triage Log

| # | Nguồn | Phát hiện | Verdict | Xử lý |
|---|---|---|---|---|
| 1 | Blind, Edge, VG | Lỗi khác lock (store hỏng, vi phạm bất biến, I/O) khiến script in stack trace | medium | **patch**: `ShopStateError` trả về một dòng lỗi; script bọc try/catch; có test store hỏng (file không đổi, lock được thả) |
| 2 | Edge, Blind, VG | `finally` thả **mọi** lock của tiến trình | medium | **patch**: thêm `releaseStoreLock(storeFile)`; có test lock của store khác vẫn còn |
| 3 | Blind, Edge | Không có gì chặn cú pháp mà strip-types không chạy được | medium | **patch**: `erasableSyntaxOnly` trong `tsconfig` (TS 5.9.3) |
| 4 | Blind | Trùng id chỉ được bắt ở các dòng hợp lệ | low | **patch**: kiểm trùng trước; có test |
| 5 | Blind | Thông điệp khi không xác định được chủ lock thiếu hướng dẫn | low | **patch**: luôn kèm "Hãy dừng server trước" |
| 6 | Edge, Blind | Test subprocess phụ thuộc cwd, không có timeout | low | **patch**: `cwd: REPO_ROOT`, `timeout: 30s` |
| 7 | Blind | Chưa test nhiều id qua `runStockSet` | low | **patch** |
| 8 | Blind | Spine/epics ghi `scripts/stock-set.ts`; README thiếu exit code và `STORE_FILE` | low | **patch**: sửa Structural Seed và bảng FR-5 trong spine; bổ sung README |
| 9 | Edge | Server lấy lock lười, nên server vừa khởi động chưa giữ lock | low | Có thật: lúc đó script chạy được, nhưng an toàn vì server không cache state và mọi lần ghi đều đi qua file nguyên tử. **patch** README ghi rõ "luôn dừng server trước" |
| 10 | VG | Nhánh `ownerPid: null` của `runStockSet` chưa có test | low | Nhánh race hiếm, chỉ khác câu chữ. **defer**; không thêm test giả |
| 11 | Edge, Blind | Baseline có thể âm nếu state đã lệch | low | Bất biến của repository chặn lại và (sau #1) báo một dòng. **reject** |
| 12 | Edge | Số lượng gần `MAX_SAFE_INTEGER` | low | Đã có `isSafeInteger` cho số lượng; không thực tế. **reject** |
| 13 | Edge, Blind | Resolve hook chưa xử lý `.js`→`.ts`, `.mts`, `/index.tsx` | low | `src/` không dùng các dạng này; test subprocess sẽ phát hiện nếu sau này có. **reject** |
| 14 | Blind | Đặt bằng giá trị cũ vẫn ghi và in `(+0)` | low | Vô hại. **reject** |
| 15 | VG | Chưa kiểm trên Node 22.12 (`engines`) | low | Môi trường dev và CI hiện là Node 24. **defer** |

## Code Map

- `src/features/orders/server.ts` -- đang tự cấu hình `createJsonFileShopRepository` (initialize, reconcile); chuyển sang `createShopStore` để script dùng chung.
- `src/features/orders/order-repository.ts` -- `createJsonFileShopRepository(file, { initialize, lock, reconcile })`.
- `src/features/orders/process-lock.ts` -- `StoreLockedError`, `releaseStoreLocks`. Constructor dùng parameter properties, mà Node strip-types không hỗ trợ, nên cần đổi sang field thường.
- `src/features/inventory/stock.ts` -- `availableStock`, `declaredStock`, `reconcileInventoryKeys`.
- `package.json` -- thêm script `stock:set`.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/inventory/stock.ts` -- thêm `parseStockSetArgs` và `applyStockSet`, kèm test.
- [x] `src/features/orders/shop-store.ts` -- `createShopStore({ storeFile, ordersFile, lock? })`; `server.ts` dùng hàm này.
- [x] `src/features/orders/stock-set.ts` -- `runStockSet({ storeFile, ordersFile, args, lock? })` trả về thay đổi hoặc danh sách lỗi; luôn thả lock.
- [x] `src/features/orders/process-lock.ts` -- bỏ parameter properties.
- [x] `scripts/stock-set.mts`, `scripts/ts-resolve.mjs`, `scripts/ts-resolve-hooks.mjs`, cùng script `stock:set` trong `package.json`.
- [x] `src/features/orders/stock-set.test.ts` -- phủ I/O Matrix, gồm một ca chạy script thật bằng `child_process`.
- [x] `README.md` -- hướng dẫn dùng `stock:set`.

**Acceptance Criteria:**
- Given story hoàn tất, when chạy `npm run check` và E2E, then cả hai xanh.
- Given `STORE_FILE` trỏ vào file tạm, when chạy `npm run stock:set -- p010=5`, then exit 0 và file có `p010: 5`.

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- expected: xanh.
- `STORE_FILE=<tmp> npm run stock:set -- p010=5` -- expected: exit 0, in `p010: 200 → 5 (-195)`.
- `npx playwright test` -- expected: 4/4.
