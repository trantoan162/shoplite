---
title: 'Story 1.5: Mô hình Order ghi lịch sử từ ngày đầu'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_commit: '47e39e7e9aa8099a27939fec487a8eaeda33a81a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hiện `Order` chỉ có `createdAt` và `updatedAt`. Vì vậy Trang theo dõi (Epic 4) và Hàng đợi (Epic 2/3) sau này không có Mốc giờ thật để hiển thị. Ngoài ra, nếu lịch sử chỉ bắt đầu được ghi từ Epic 3, mọi đơn đặt trước thời điểm đó sẽ thiếu dòng "tạo đơn".

**Approach:** Mở rộng `Order` chỉ bằng các trường tùy chọn theo AD-10: `statusHistory`, `cancellation`, `stockApplied`, `flags`, cùng các kiểu `Actor`, `StatusChange`, `CancelReason` và `CANCEL_REASON_LABELS`. Schema đọc file kiểm cả các trường mới. Từ story này, `placeOrder` ghi dòng tạo đơn và `cancelOrder` ghi dòng hủy, cả hai với actor là khách.

## Boundaries & Constraints

**Always:**
- Các kiểu đúng như AD-10:
  - `Actor = {kind:"staff"; name} | {kind:"customer"}`
  - `StatusChange = {from: OrderStatus | null; to; at: ISO; actor}`
  - `CancelReason = out_of_stock | customer_changed_mind | unreachable | other | delivery_failed`
- Nhãn: Hết hàng, Khách đổi ý, Không liên lạc được khách, Khác, Giao thất bại.
- Dòng đầu tiên của `statusHistory` là `{from: null, to: "pending", at: createdAt, actor: {kind: "customer"}}`.
- Khách hủy đơn: thêm dòng `{from: "pending", to: "cancelled", at, actor: {kind: "customer"}}`, trong đó `at` trùng với `updatedAt` mới.
- Đơn cũ không có `statusHistory`: khi hủy, tạo mảng mới chỉ gồm dòng hủy. Không bịa thêm dòng tạo đơn.
- Schema dùng `looseObject`; trường mới đều optional và được validate nếu có mặt.

**Never:**
- Không đổi tên, không xóa trường cũ. Không ghi bù dữ liệu vào đơn cũ.
- Không viết `describeStatusChange` hay chuỗi hiển thị nào (thuộc Epic 3/4).
- Không đổi luồng tồn kho.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Đặt đơn | `placeOrder` hợp lệ | đơn có `statusHistory` gồm 1 dòng `from: null → pending`, `at = createdAt`, actor khách | N/A |
| Khách hủy | đơn `pending` có lịch sử 1 dòng | lịch sử có 2 dòng, dòng 2 là `pending → cancelled`, `at = updatedAt`; tồn kho không đổi | N/A |
| Hủy đơn cũ | đơn `pending` không có `statusHistory` | `statusHistory` = [dòng hủy]; không có dòng tạo đơn bịa ra | N/A |
| Đọc đơn cũ | đơn chỉ có trường cũ | parse thành công | N/A |
| Trường mới sai | `statusHistory[0].to = "lost"` hoặc `cancellation.reason = "x"` | `parseShopState` ném `ShopStateError` | ném lỗi |
| API | `POST /api/orders` | response giữ mọi trường cũ, có thêm `statusHistory` | N/A |

</frozen-after-approval>

## Implementation Notes

- Spec được tự duyệt theo chỉ đạo của người dùng ("làm tự động, khỏi hỏi lại", 2026-11-22).
- Fixture "giữ trường lạ" của Story 1.1 đổi từ `statusHistory: [{ to }]` thành `futureField`, vì `statusHistory` giờ là trường có schema. Mục đích của test (trường lạ được giữ nguyên) vẫn được kiểm, cộng thêm test giữ khóa lạ bên trong dòng lịch sử và actor.
- Kết quả: vitest 222/222, lint và tsc sạch, E2E 3/3. Trong store E2E, mỗi đơn có `statusHistory` gồm 1 dòng `null → pending`, actor là khách.

## Spec Change Log

## Review Triage Log

| # | Nguồn | Phát hiện | Verdict | Xử lý |
|---|---|---|---|---|
| 1 | Blind, VG, Edge | Dòng "API" trong bảng I/O chưa có test: response `POST`/`PATCH` có `statusHistory` không | medium | **patch**: thêm 1 test vào mỗi file route test (không sửa assertion cũ) |
| 2 | Blind, Edge | `at` và `cancelRequestedAt` chấp nhận chuỗi bất kỳ | medium | **patch**: dùng `z.iso.datetime()`; fixture đổi sang ISO thật, có thêm ca từ chối |
| 3 | Blind, Edge | Tên actor staff có thể rỗng | low | **patch**: `min(1)`, kèm test |
| 4 | Blind | `from: "pending"` viết cứng trong `cancelOrder` | low | **patch**: dùng `order.status` |
| 5 | Blind, VG | Thiếu ca từ chối cho `flags`, `from`, `note`, `returnedToShop`, `statusHistory` không phải mảng | low | **patch**: thêm 9 ca |
| 6 | Blind | Test đơn cũ chỉ kiểm "không ném"; test hủy đơn cũ không đọc lại từ repository | low | **patch**: kiểm parse nguyên trạng, không ghi bù; đọc lại bản đã lưu |
| 7 | Blind | Mất test khóa lạ bên trong dòng lịch sử sau khi đổi fixture | low | **patch**: thêm test giữ khóa lạ trong dòng lịch sử và actor |
| 8 | Blind | `createdAt.toISOString()` gọi 3 lần | low | **patch**: tính một lần |
| 9 | Blind, Edge | Schema không kiểm lịch sử khớp với `status` (dòng cuối, chuỗi from→to) | low | Chỉ có giá trị khi file bị sửa tay; thêm refine làm tăng độ phức tạp. **reject** |
| 10 | Blind | Khách hủy không ghi `cancellation.reason` | false | FR-2 không yêu cầu lý do cho khách; lý do thuộc Epic 3 (FR-11) |
| 11 | Blind | Thứ tự `CANCEL_REASONS` để "Khác" nằm giữa | false | UI Epic 3 tự chọn danh sách theo trạng thái (UX-DR9) |
| 12 | VG, Edge | Có sửa fixture của test cũ | false | Đó là test do Story 1.1 viết, không thuộc bộ test baseline; đã ghi ở Implementation Notes |

## Code Map

- `src/features/orders/types.ts` -- `Order`, `ORDER_STATUSES`, `ORDER_STATUS_LABELS`; thêm kiểu và nhãn ở đây.
- `src/features/orders/state-schema.ts:35` -- `orderSchema` (`looseObject`); thêm schema optional cho các trường mới. Output của schema phải gán được vào `Order`, không ép kiểu.
- `src/features/orders/order-service.ts:92` -- object `order` trong `placeOrder`; `cancelOrder` ở mutator.
- `src/features/orders/order-service.test.ts` -- test cũ dùng `toMatchObject` / `toEqual(order)`, vẫn đúng khi có thêm trường.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/orders/types.ts` -- thêm `Actor`, `StatusChange`, `CANCEL_REASONS`/`CancelReason`, `CANCEL_REASON_LABELS`, `OrderCancellation`, cùng các trường optional của `Order`.
- [x] `src/features/orders/state-schema.ts` -- thêm schema cho `actor`, `statusChange`, `cancellation` và `flags` (`looseObject`, optional).
- [x] `src/features/orders/order-service.ts` -- `placeOrder` ghi dòng tạo đơn; `cancelOrder` thêm dòng hủy.
- [x] `src/features/orders/order-history.test.ts` -- phủ toàn bộ I/O Matrix.

**Acceptance Criteria:**
- Given story hoàn tất, when chạy `npm run check` và E2E, then cả hai đều xanh và không sửa assertion cũ.

## Verification

**Commands:**
- `npx vitest run src/features/orders src/app/api/orders --maxWorkers=4` -- expected: xanh.
- `npm run check` -- expected: exit 0.
- `npx playwright test` -- expected: 3/3 xanh.
