# Epic 1 Context: Tồn kho thật, sống qua restart

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Đưa Đơn hàng và Tồn kho vào chung một file trạng thái, ghi nguyên tử và đi qua một khóa chung. Nhờ vậy Tồn kho được lưu bền, còn nguyên sau restart, và là nguồn duy nhất cho mọi nơi đọc tồn kho. Đây là nền cho việc xác nhận đơn mà không bán quá tồn kho (Epic 3). Hành vi đang chạy của cửa hàng giữ nguyên: server tính lại giá, khách chỉ tự hủy đơn đang chờ xác nhận, kiểm tra tồn kho lúc đặt, hợp đồng API và định dạng lỗi không đổi. Đơn cũ trong `orders.json` phải được chuyển sang mà không mất. E2E phải chạy trên dữ liệu riêng.

## Stories

- Story 1.1: Kho trạng thái một file, ghi nguyên tử
- Story 1.2: Khóa chung cho đọc/ghi, đặt và hủy đơn không đè nhau
- Story 1.3: Cô lập dữ liệu khi chạy E2E
- Story 1.4: Chuyển sang file trạng thái, giữ đơn cũ, chỉ một tiến trình
- Story 1.5: Mô hình Order ghi lịch sử từ ngày đầu
- Story 1.6: Đặt hàng kiểm tra Tồn kho lưu bền
- Story 1.7: Cửa hàng hiển thị tồn kho thật
- Story 1.8: Chủ shop đặt lại tồn kho bằng lệnh

## Requirements & Constraints

- Không database, không dịch vụ ngoài, không dependency mới. Dữ liệu là file JSON trong `storage/`. Chỉ một tiến trình Node, không scale ngang.
- Ghi theo kiểu tất cả hoặc không: lỗi đĩa hay crash giữa chừng không bao giờ để lại file hỏng hoặc trạng thái nửa vời. Tồn kho không bao giờ âm.
- Lần đầu khởi động mà chưa có dữ liệu: Tồn kho của mỗi sản phẩm = `stock` khai báo trong `src/data/products.ts`. Sau đó sửa `products.ts` không còn đổi tồn kho.
- Hợp đồng API hiện có không đổi. Đơn hàng chỉ được **thêm** trường tùy chọn. Mọi test hiện có trong `npm run check` phải xanh mà không sửa assertion về trường cũ.
- Khách tự hủy qua `PATCH /api/orders/:id {status:"cancelled"}`: không cần đăng nhập, chỉ cho đơn `pending`, mã lỗi và thông điệp giữ nguyên. Hủy đơn `pending` không đổi tồn kho.
- Đặt hàng: giá do server tính; số lượng vượt tồn kho thì 409 `INSUFFICIENT_STOCK` với thông điệp như cũ; đặt hàng không trừ kho.
- Đơn cũ chỉ có các trường hiện tại vẫn đọc được, không lỗi 500.
- Thay đổi tồn kho ngoài luồng đơn chỉ có một đường là `npm run stock:set`.

## Technical Decisions

- **Bố cục:** code nghiệp vụ nằm trong `src/features/<feature>/`; `src/app` chỉ chứa route. Instance có I/O xuất qua `features/*/server.ts`, chỉ import phía server. Feature mới: `inventory` chỉ chứa hàm thuần và kiểu, không import `orders`, không I/O. Hàm thuần có `*.test.ts` đặt cạnh.
- **ShopState (một file `STORE_FILE`, mặc định `storage/shop-store.json`):** `{ schemaVersion: 1, orders: Order[], inventory: Record<productId, number>, inventoryBaseline: Record<productId, number>, stockLedger?: StockLedgerEntry[] }`. Không có đường ghi nào khác vào file này.
- **Commit nguyên tử:**
  1. `mkdir -p` thư mục chứa;
  2. ghi `<file>.tmp` bằng `FileHandle`, gọi `sync()`, đóng;
  3. `rename` sang file chính, retry khi gặp `EPERM`/`EACCES`/`EBUSY` (tối đa 5 lần, backoff 20→320 ms);
  4. `fsync` thư mục (bỏ qua trên win32).

  Hết retry thì ném lỗi, file cũ còn nguyên. Lúc đọc thì bỏ qua `.tmp` sót lại; commit sau ghi đè nó.
- **Điểm chèn lỗi:** adapter JSON nhận một `fs` port inject được, gồm `mkdir`, `open → FileHandle{ writeFile, sync, close }`, `rename`, `readFile`, `fsyncDir`. Repo in-memory nhận `failNextCommit`. Điểm chèn lỗi chỉ đưa vào qua deps, không bao giờ qua biến môi trường.
- **Port `OrderRepository` mở rộng thêm** (không bỏ gì):
  - `findAll`, `findById` và `save` giữ nguyên. `save` chỉ dùng để thêm đơn mới và dựng dữ liệu test.
  - Thêm `readState()` và `update(mutator)`.
  - Mọi phương thức chạy trong một mutex `globalThis`, khóa theo `path.resolve(file)` (viết thường trên win32).
  - Mutator đồng bộ, thuần và nhận bản sao. Mutator ném lỗi thì không ghi gì. Khóa luôn được nhả trong `finally`. Không cache trạng thái.
  - Trước khi commit phải kiểm tra: mọi `inventory[id]` là số nguyên ≥ 0, id đơn duy nhất.
- **Chữ ký service:** `createOrderService({ repository, findProduct?, now?, generateId? })` giữ nguyên.
- **Một tiến trình:** PID lock `<STORE_FILE>.lock` (cờ `wx`), lấy lười ở lần truy cập đầu tiên.
  - PID còn sống: lỗi khởi động rõ ràng.
  - PID đã chết: ghi đè lock.
  - Cùng PID lấy lại lock (HMR) vẫn được.
- **Khởi tạo:** `ensureInitialized()` chạy trong mutex và kiểm tra lại `STORE_FILE` sau khi lấy khóa.
  - Đơn cũ nhập từ `ORDERS_FILE`. Không có file thì là `[]`. File hỏng thì ném lỗi và không tạo store.
  - Sau lần nhập không ghi `orders.json` nữa.
  - JSON trạng thái hỏng thì trả 500 và không ghi đè.
- **Mô hình Order:** chỉ thêm các trường tùy chọn `statusHistory`, `cancellation`, `stockApplied`, `flags`, cùng các kiểu `Actor` và `StatusChange`. Schema Zod dùng `z.looseObject` ở mọi cấp, có test round-trip giữ nguyên trường lạ. Thời gian lưu dạng ISO UTC.
- **Tồn kho:** catalog giữ đồng bộ. Ranh giới server dùng `withLiveStock(products, levels)` (trả object mới), truyền vào qua tham số `source`. Chỉ `inventory/stock.ts` thay đổi tồn kho. `reconcileInventoryKeys` thêm key cho sản phẩm mới. Trang có tồn kho dùng `force-dynamic`; trang chi tiết sản phẩm bỏ `generateStaticParams`. Store không đọc được thì báo lỗi, không bao giờ quay về hằng số trong `products.ts`.
- **Lỗi:** dùng `OrderError` và `handleRouteError`/`jsonError`/`readJsonBody` (`src/lib/http.ts`). Dạng lỗi `{ error: { code, message, details? } }`.

## Cross-Story Dependencies

- Chuỗi phụ thuộc: 1.1 → 1.2 → (1.3 làm độc lập) → 1.4 → 1.5 → 1.6 → 1.7 và 1.8.
- Story 1.3 phải xong trước 1.4, để lần chuyển store không đụng vào `storage/` thật.
- Epic 2 chạy song song được với epic này. Story 2.5 cần 1.6.
- Story 3.1 cần 1.6. Kiểu `Actor` có từ Story 1.5.
