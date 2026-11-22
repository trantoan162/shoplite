---
title: 'Story 1.7: Cửa hàng hiển thị tồn kho thật'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_commit: 'ac6526e256db3963b40b50e7d9ccec90805dcae7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trang chủ, `/products`, `/products/[slug]` và `/api/products*` vẫn đọc `stock` cố định trong `products.ts`. Trong khi đó đặt hàng (Story 1.6) đã kiểm theo tồn kho lưu bền. Hệ quả: khách có thể thấy "Còn hàng", thêm vào giỏ, rồi lúc đặt mới bị báo hết hàng.

**Approach:** Theo AD-9, catalog vẫn giữ đồng bộ và thuần.
- Thêm tham số `source` vào `getProductBySlug`, `getFeaturedProducts`, `getRelatedProducts`; `queryProducts` đã có sẵn tham số này.
- Thêm `withLiveStock(products, inventory)` (hàm thuần, ở `inventory/stock.ts`), trả về các object sản phẩm mới mang tồn kho thật.
- Ranh giới server (`orders/server.ts`) xuất `getLiveProducts()`, đọc tồn kho qua cùng repository với đơn hàng.
- Các trang có tồn kho dùng `force-dynamic`; trang chi tiết bỏ `generateStaticParams`.

## Boundaries & Constraints

**Always:**
- Gọi các hàm catalog mà không truyền `source` thì chạy như cũ: vẫn đồng bộ và đọc `products.ts`.
- `withLiveStock` không sửa `products`. Sản phẩm thiếu key tồn kho thì dùng `stock` khai báo, giống logic của `placeOrder`.
- Shape response của `GET /api/products*` giữ nguyên; chỉ giá trị `stock` thay đổi.
- Không đọc được store thì báo lỗi: trang hiện `error.tsx`, API trả 500 qua `handleRouteError`. **Không bao giờ** quay về `stock` trong `products.ts`.
- Client (`StockBadge`, giỏ hàng, `getMaxQuantity`) không đổi: vẫn nhận `stock` qua props.

**Never:**
- Không đổi component client, không đổi `generateMetadata` (chỉ dùng tên sản phẩm). Không sửa assertion cũ.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hết hàng | tồn kho X = 0 | `GET /api/products/[slug]` của X trả `stock: 0`; `?inStock=true` không còn X | N/A |
| Còn ít | tồn kho X = 3 | API trả `stock: 3`, `getStockStatus` ra "low" | N/A |
| Thiếu key | store không có key X | dùng `stock` khai báo | N/A |
| Không truyền source | các hàm catalog không có `source` | kết quả như trước (test catalog cũ xanh) | N/A |
| Store hỏng | `readState` ném lỗi | API trả 500 `INTERNAL_ERROR`; không trả `stock` khai báo | `handleRouteError` |
| Không sửa đầu vào | gọi `withLiveStock(products, …)` | `products` không đổi; trả object mới | N/A |

</frozen-after-approval>

## Implementation Notes

- Spec được tự duyệt theo chỉ đạo của người dùng (2026-11-22).
- `next build`: `/`, `/products`, `/products/[slug]`, `/api/products*` đều là `ƒ` (động), `storage/` không được tạo.
- Sau review, E2E gieo `p015 = 0` vào store E2E (catalog khai báo 18) và thêm `e2e/live-stock.spec.ts`. Store E2E vẫn bắt đầu không có đơn.
- Kết quả: vitest 264/264, lint và tsc sạch, E2E 4/4.

## Spec Change Log

## Review Triage Log

| # | Nguồn | Phát hiện | Verdict | Xử lý |
|---|---|---|---|---|
| 1 | VG, Blind | `getLiveProducts` thật chưa có test nào; route test mock toàn bộ | medium | **patch**: `server.test.ts` có 2 ca: store ghi `p001=0` thì trả 0; store hỏng thì reject |
| 2 | VG, Blind | Trang cửa hàng chưa có test tự động nào dùng tồn kho thật | medium | **patch**: E2E gieo p015 = 0. Trang hiện "tạm hết hàng" và không có khối mua; API trả `stock: 0`; lọc "còn hàng" mất đúng 1 sản phẩm |
| 3 | Edge, Blind | Slug không tồn tại mà store hỏng thì ra 500 thay vì 404 | low | **patch**: kiểm slug với catalog tĩnh trước, cả trang và API, có test |
| 4 | Blind | Test lọc `inStock` không có đối chứng dương | low | **patch**: có thêm test tổng giảm đúng 1 |
| 5 | Edge, Blind | Spy `console.error` không được restore; route list không kiểm `error.code` | low | **patch** |
| 6 | Edge | Fixture dùng `find(stock > 5)!` không có guard | low | **patch**: đổi sang id cố định `p001`, kèm guard |
| 7 | Blind | Checklist trong spec còn `[ ]` | low | **patch** |
| 8 | Edge, Blind | Mỗi lần xem catalog đi qua mutex và clone cả store | low | Store nhỏ (dưới 100 đơn/ngày), spine Deferred đã ghi "xem lại khi file > vài MB". **reject** |
| 9 | Blind | GET catalog có thể tạo store (initialize) | false | AD-15 chủ ý: khởi tạo ở thao tác đầu tiên, bất kể loại thao tác |
| 10 | Blind | Giỏ hàng vẫn dùng ảnh chụp `stock` | false | AD-9 chủ ý ("stock trong giỏ là ảnh chụp"); server kiểm lần cuối lúc đặt (FR-3, Story 1.6) |
| 11 | Blind | Test `getStockStatus` không liên quan story | low | Giữ làm tài liệu cho dòng "Còn ít" của I/O Matrix. **reject** |

## Code Map

- `src/features/catalog/catalog-service.ts:47,55,63` -- `getProductBySlug`, `getFeaturedProducts`, `getRelatedProducts` đang đọc biến `products`; `queryProducts(query, source = products)` tại dòng 140.
- `src/features/inventory/stock.ts` -- `availableStock`, `declaredStock` (Story 1.6); thêm `withLiveStock`.
- `src/features/orders/server.ts` -- repository dùng chung; thêm `getLiveProducts()`.
- `src/app/page.tsx`, `src/app/products/page.tsx`, `src/app/products/[slug]/page.tsx` (`generateStaticParams` ở dòng 21), `src/app/api/products/route.ts`, `src/app/api/products/[slug]/route.ts`.
- `src/features/catalog/catalog-service.test.ts` -- test cũ, phải xanh.

## Tasks & Acceptance

**Execution:**
- [x] `src/features/inventory/stock.ts` -- thêm `withLiveStock`, kèm test.
- [x] `src/features/catalog/catalog-service.ts` -- thêm tham số `source` mặc định là `products`, kèm test.
- [x] `src/features/orders/server.ts` -- thêm `getLiveProducts()`.
- [x] 3 trang -- `force-dynamic`, dùng `await getLiveProducts()` làm `source`; trang chi tiết bỏ `generateStaticParams`.
- [x] 2 route API -- truyền `source` sống; bọc `handleRouteError`; thêm `force-dynamic`.
- [x] `src/app/api/products/route.test.ts` (mới) -- phủ I/O Matrix qua route, mock `getLiveProducts`.

**Acceptance Criteria:**
- Given story hoàn tất, when chạy `npm run check`, `next build` và E2E, then tất cả xanh; trong output build, các trang `/`, `/products`, `/products/[slug]` hiện là động (ƒ).

## Verification

**Commands:**
- `npx vitest run --maxWorkers=2` -- expected: xanh.
- `npx next build` -- expected: exit 0, các route trên đánh dấu `ƒ`.
- `npx playwright test` -- expected: 3/3.
