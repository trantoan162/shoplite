---
title: "Addendum: PRD Vận hành đơn hàng ShopLite"
created: 2026-11-21
updated: 2026-11-21
---

# Addendum: dành cho Architect và Dev

Phần này giữ các lựa chọn kỹ thuật và chi tiết hiện trạng, những thứ không nên nằm trong PRD. Architect quyết định cuối cùng ở `bmad-architecture`.

## Hiện trạng code liên quan (kiểm chứng trên `805f721`)

| Chủ đề | Vị trí | Ghi chú cho thiết kế |
|---|---|---|
| Trạng thái đơn | `src/features/orders/types.ts` (`ORDER_STATUSES`, `ORDER_STATUS_LABELS`) | `Order` mới chỉ có `createdAt` và `updatedAt`. Cần thêm Mốc giờ theo từng trạng thái, Người thao tác và lý do hủy, và chỉ được *thêm* trường (FR-4) |
| Logic đơn | `src/features/orders/order-service.ts` (`placeOrder`, `listOrders`, `getOrder`, `cancelOrder`) | `cancelOrder` hiện là đường hủy của khách (FR-2). Thao tác của nhân viên nên là hàm riêng, để không nới lỏng FR-2 |
| Mã lỗi | `src/features/orders/order-errors.ts` | Đã có `INVALID_STATUS_TRANSITION` (409) và `INSUFFICIENT_STOCK` (409), dùng lại được. Cần thêm `UNAUTHORIZED` (401) cho FR-6 |
| Lưu trữ | `src/features/orders/order-repository.ts` | Mỗi lần `save()` đọc toàn file, sửa, rồi ghi file tạm và `rename`. Ghi từng lần thì an toàn, nhưng **không khóa**: hai request đồng thời có thể đè mất thay đổi của nhau. Interface `OrderRepository` và repo in-memory giúp test dễ |
| Instance phía server | `src/features/orders/server.ts` | Đọc biến `ORDERS_FILE`. Chỉ import file này từ code chạy trên server |
| Tồn kho | `src/data/products.ts` (`stock`, read-only); `catalog-service.ts` (`getProductById`, `getStockStatus`, `LOW_STOCK_THRESHOLD = 5`, lọc `inStock`) | Các hàm catalog hiện đều *đồng bộ* và đọc hằng số. Tồn kho lưu bền sẽ phải đọc bất đồng bộ, nên chữ ký hàm và mọi nơi gọi (`placeOrder`, trang sản phẩm, `/api/products`) sẽ thay đổi |
| Giỏ hàng | `src/features/cart/cart-reducer.ts` (`getMaxQuantity`), `cart/types.ts` (`stock` lưu trong item ở localStorage) | `stock` trong giỏ là ảnh chụp tại lúc thêm vào giỏ. Server vẫn là nơi kiểm tra cuối cùng (FR-3) |
| API đơn | `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts` | PATCH chỉ nhận `{status:"cancelled"}`, giữ nguyên. Next 16: `RouteContext<...>` và `await ctx.params` |
| Trang khách | `src/app/orders/[id]/page.tsx` (`dynamic = "force-dynamic"`), `src/app/orders/page.tsx` | `/orders` liệt kê mọi đơn, xem OQ-1 |
| Lỗi HTTP | `src/lib/http.ts` (`jsonError`, `handleRouteError`, `readJsonBody`) | Mọi route mới đi qua đây |
| Giao hàng | `src/features/checkout/pricing.ts` (`SHIPPING_OPTIONS`: tiêu chuẩn "3–5 ngày làm việc", nhanh "1–2 ngày làm việc") | Số ngày hiện chỉ có trong chuỗi `description`. FR-16 cần dạng số, nên đề xuất thêm trường `minDays` / `maxDays` |
| E2E | `playwright.config.ts` | Dùng `npm run dev`, `reuseExistingServer` khi chạy local, không đặt `ORDERS_FILE`, nên E2E ghi vào `storage/orders.json` thật. Test tương tranh nên dùng file riêng |

## Phương án kỹ thuật cho tính nguyên tử (FR-9 đến FR-12)

Ràng buộc: chỉ dùng file, chạy một tiến trình Node (Non-Goal: không scale ngang).

1. **Một file trạng thái chung** (đơn và tồn kho cùng file), ghi file tạm rồi `rename`, cộng một mutex trong tiến trình bao quanh toàn bộ "đọc → kiểm tra → ghi". Nguyên tử thật vì `rename` là một thao tác duy nhất. Nhược điểm: phá vỡ ranh giới `OrderRepository` hiện có.
2. **Hai file** (`orders.json`, `inventory.json`) cộng mutex chung. Đơn giản hơn, nhưng nếu tiến trình chết giữa hai lần ghi thì đơn và kho lệch nhau. Muốn an toàn phải có cơ chế khôi phục, ví dụ ghi Sổ kho trước rồi dựng lại.
3. **Sổ kho là nguồn sự thật** (FR-20): Tồn kho = khởi tạo + tổng các dòng trong sổ. Mỗi lần chuyển trạng thái ghi một bản ghi gồm cả đơn và các dòng sổ kho. Đẹp về đối soát (SM-2), nhưng phải đọc nhiều hơn.

Kiểm thử FR-9 (không có trạng thái nửa vời): repository cần một điểm chèn lỗi, ví dụ repo in-memory ném lỗi giữa lần ghi, để test chứng minh tính nguyên tử.

Kiểm tra "trạng thái hiện tại == trạng thái Từ" (compare-and-set), đặt **bên trong** mutex, là cơ chế đáp ứng FR-10.

## Danh tính nhân viên (FR-6, FR-7)

- Cấu hình: biến môi trường, ví dụ `STAFF_PINS="An:1234,Hoa:5678"`, hoặc một file bị gitignore. `.env.local` đã có `PAYMENT_API_KEY`; không in hay commit giá trị bí mật.
- Phiên: cookie `httpOnly` đã ký, chứa tên nhân viên. Không cần lưu phiên phía server.
- Giới hạn tốc độ thử PIN (PRD OQ-6): cân nhắc chặn tạm sau N lần sai, vì PIN 4 số dễ dò.

## Phương án đã cân nhắc và loại

- **Giữ hàng lúc khách đặt:** loại (đã chốt ở brief). Đánh đổi: đơn đến sau có thể bị đèn đỏ.
- **Thêm trạng thái `cancel_requested` hoặc `awaiting_customer`:** loại; dùng Cờ phụ để giữ nguyên 5 trạng thái.
- **SQLite hay database nhúng:** loại do ràng buộc "không thêm database".
