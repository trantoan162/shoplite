---
name: ShopLite
description: Cửa hàng đồ công nghệ mini, Next.js + Tailwind CSS v4. DESIGN.md này ghi lại design system ngầm định đang có trong code và chỉ bổ sung phần delta cho Khu nhân viên và Trang theo dõi đơn.
status: final
created: 2026-11-21
updated: 2026-11-21
sources:
  - _bmad-output/planning-artifacts/prds/prd-shoplite-bmad-module4-2026-11-21/prd.md
colors:
  # HIỆN CÓ: bảng màu Tailwind v4.3.3 mặc định, không override (globals.css chỉ đổi font).
  # Giá trị hex được quy đổi từ OKLCH trong tailwindcss/theme.css. Tên token = tên class Tailwind.
  indigo-50: '#eef2ff'
  indigo-100: '#e0e7ff'
  indigo-200: '#c6d2ff'
  indigo-500: '#615fff'
  indigo-600: '#4f39f6'
  indigo-700: '#432dd7'
  slate-50: '#f8fafc'
  slate-100: '#f1f5f9'
  slate-200: '#e2e8f0'
  slate-300: '#cad5e2'
  slate-400: '#90a1b9'
  slate-500: '#62748e'
  slate-600: '#45556c'
  slate-700: '#314158'
  slate-900: '#0f172b'
  rose-50: '#fff1f2'
  rose-200: '#ffccd3'
  rose-500: '#ff2056'
  rose-600: '#ec003f'
  rose-700: '#c70036'
  rose-900: '#8b0836'   # chữ câu hỏi trong hộp xác nhận hủy (CancelOrderButton)
  emerald-50: '#ecfdf5'
  emerald-200: '#a4f4cf'
  emerald-600: '#009966'
  emerald-700: '#007a55'
  amber-50: '#fffbeb'
  amber-200: '#fee685'
  amber-700: '#bb4d00'
  sky-50: '#f0f9ff'
  sky-200: '#b8e6fe'
  sky-700: '#0069a8'
  white: '#ffffff'
  # Vai trò ngữ nghĩa (alias, không thêm màu mới)
  primary: '{colors.indigo-600}'
  primary-hover: '{colors.indigo-500}'
  surface-page: '{colors.slate-50}'
  surface-card: '{colors.white}'
  text-primary: '{colors.slate-900}'
  text-muted: '{colors.slate-500}'
  border-card: '{colors.slate-200}'
  danger: '{colors.rose-600}'
  success: '{colors.emerald-600}'
typography:
  # HIỆN CÓ: Be Vietnam Pro (next/font, subsets latin + vietnamese, weight 400/500/600/700).
  page-title:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 1.5rem      # text-2xl
    fontWeight: '700'
  section-title:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 1.125rem    # text-lg
    fontWeight: '600'
  body:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 0.875rem    # text-sm
    fontWeight: '400'
  label:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 0.875rem
    fontWeight: '600'
  caption:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 0.75rem     # text-xs
    fontWeight: '600'
  # DELTA: con số lớn trong Ba thông tin chính
  key-figure:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 1.125rem    # text-lg
    fontWeight: '700'
rounded:
  # HIỆN CÓ
  lg: 0.5rem      # rounded-lg: ô logo, nút icon
  xl: 0.75rem     # rounded-xl: nút, hộp xác nhận inline
  2xl: 1rem       # rounded-2xl: thẻ
  full: 9999px    # badge, ảnh emoji tròn
spacing:
  # HIỆN CÓ: thang Tailwind 0.25rem. Các mức đang dùng:
  '1': 0.25rem
  '2': 0.5rem
  '3': 0.75rem
  '4': 1rem
  '5': 1.25rem
  '6': 1.5rem
  '8': 2rem
  page-gutter: 1rem       # px-4
  card-padding: 1.25rem   # p-5 (thẻ nội dung); p-4 cho thẻ danh sách
components:
  # ---------- HIỆN CÓ (src/components/ui/button.tsx) ----------
  button-primary:
    background: '{colors.indigo-600}'
    backgroundHover: '{colors.indigo-500}'
    foreground: '{colors.white}'
    radius: '{rounded.xl}'
  button-secondary:
    background: '{colors.white}'
    foreground: '{colors.slate-900}'
    border: '1px inset {colors.slate-300}'
    radius: '{rounded.xl}'
  button-ghost:
    foreground: '{colors.slate-700}'
    backgroundHover: '{colors.slate-100}'
    radius: '{rounded.xl}'
  button-danger:
    background: '{colors.rose-600}'
    backgroundHover: '{colors.rose-500}'
    foreground: '{colors.white}'
    radius: '{rounded.xl}'
  button-size:
    sm: 2rem    # h-8
    md: 2.5rem  # h-10
    lg: 3rem    # h-12
  card:
    background: '{colors.white}'
    border: '1px {colors.slate-200}'
    radius: '{rounded.2xl}'
    shadow: 'shadow-sm'
  empty-state:
    background: '{colors.white}'
    border: '1px dashed {colors.slate-300}'
    radius: '{rounded.2xl}'
  # HIỆN CÓ (src/features/orders/components/order-status-badge.tsx)
  status-badge-pending: { background: '{colors.amber-50}', foreground: '{colors.amber-700}', ring: '{colors.amber-200}' }
  status-badge-confirmed: { background: '{colors.sky-50}', foreground: '{colors.sky-700}', ring: '{colors.sky-200}' }
  status-badge-shipping: { background: '{colors.indigo-50}', foreground: '{colors.indigo-700}', ring: '{colors.indigo-200}' }
  status-badge-delivered: { background: '{colors.emerald-50}', foreground: '{colors.emerald-700}', ring: '{colors.emerald-200}' }
  status-badge-cancelled: { background: '{colors.slate-100}', foreground: '{colors.slate-500}', ring: '{colors.slate-200}' }
  # ---------- DELTA ----------
  staff-header:
    background: '{colors.slate-900}'
    foreground: '{colors.white}'
    height: 3.5rem
  stock-light-ok:
    background: '{colors.emerald-50}'
    foreground: '{colors.emerald-700}'
    ring: '{colors.emerald-200}'
    icon: 'lucide CircleCheck'
  stock-light-short:
    background: '{colors.rose-50}'
    foreground: '{colors.rose-700}'
    ring: '{colors.rose-200}'
    icon: 'lucide TriangleAlert'
  queue-order-card:
    extends: '{components.card}'
    padding: '{spacing.4}'
    primaryAction: 'button-primary, size lg, full width'
  queue-group-header:
    typography: '{typography.label}'
    foreground: '{colors.slate-700}'
    countBadge: '{colors.slate-200} / {colors.slate-700}, rounded full'
  progress-step-done: { dot: '{colors.indigo-600}', line: '{colors.indigo-600}', label: '{colors.slate-900}' }
  progress-step-todo: { dot: '{colors.slate-300}', line: '{colors.slate-200}', label: '{colors.slate-400}' }
  progress-step-cancelled: { dot: '{colors.rose-600}', label: '{colors.rose-700}' }
  key-info-card:
    extends: '{components.card}'
    figure: '{typography.key-figure}'
  alert-strip:
    background: '{colors.amber-50}'
    foreground: '{colors.amber-700}'
    ring: '{colors.amber-200}'
    radius: '{rounded.xl}'
  conflict-notice:
    background: '{colors.sky-50}'
    foreground: '{colors.sky-700}'
    ring: '{colors.sky-200}'
    radius: '{rounded.xl}'
---

## Brand & Style

ShopLite là cửa hàng đồ công nghệ mini, sáng và gọn: nền slate rất nhạt, thẻ trắng bo tròn lớn, một màu nhấn indigo, ảnh sản phẩm là emoji trên gradient pastel. Phong cách thân thiện nhưng không trang trí thừa.

Tài liệu này **không thiết kế lại**. Mọi token trong mục "HIỆN CÓ" được ghi nhận từ code (`src/app/layout.tsx`, `src/app/globals.css`, `src/components/ui/*`, `src/features/orders/components/order-status-badge.tsx`). Phần **delta** chỉ phục vụ hai bề mặt mới: **Khu nhân viên** (công cụ làm việc, ưu tiên mobile) và **Trang theo dõi** nâng cấp. Khu nhân viên dùng cùng ngôn ngữ thị giác với cửa hàng, chỉ khác ở thanh header tối để nhân viên luôn biết mình đang ở khu vực làm việc.

## Colors

Toàn bộ là bảng màu mặc định của Tailwind v4.3.3, không override. Tailwind v4 khai báo màu bằng OKLCH; frontmatter ghi hex đã quy đổi. Ví dụ indigo-600 = `oklch(51.1% 0.262 276.966)` ≈ `#4f39f6`. Khi code thì dùng class Tailwind (`bg-indigo-600`), không viết mã hex.

- **Indigo (`{colors.indigo-600}`)**: màu hành động chính (nút primary, logo, link hover) và các bước đã qua trên thanh tiến trình. Không dùng cho cảnh báo.
- **Slate**: nền trang `{colors.slate-50}`, chữ `{colors.slate-900}`, chữ phụ `{colors.slate-500}`, viền thẻ `{colors.slate-200}`. Delta: `{colors.slate-900}` làm nền header Khu nhân viên.
- **Rose (`{colors.rose-600}`)**: nguy hiểm và lỗi. Dùng cho nút hủy, thông điệp lỗi, và delta **đèn tồn kho thiếu hàng**.
- **Emerald (`{colors.emerald-600}`)**: thành công. Dùng cho thông báo đặt hàng thành công, badge Đã giao, và delta **đèn tồn kho đủ hàng**.
- **Amber / Sky / Indigo / Emerald / Slate nhạt**: năm màu badge trạng thái đơn hiện có. Delta: amber cho **dải cảnh báo** (đơn đứng yên, yêu cầu hủy), sky cho **thông báo xung đột** ("Đã xác nhận bởi An lúc 08:05"). Sky được chọn vì đây là thông tin, không phải lỗi.

Không thêm màu mới. Mọi trạng thái đều có kèm chữ hoặc icon, không phân biệt chỉ bằng màu.

## Typography

Be Vietnam Pro cho mọi chữ, qua biến `--font-sans`. Thang chữ đang dùng: tiêu đề trang `text-2xl` đậm 700, tiêu đề mục `text-lg` 600, nội dung `text-sm`, badge `text-xs` 600. Delta duy nhất: `{typography.key-figure}` (`text-lg` 700) cho giá trị trong Ba thông tin chính, ví dụ "Đang giao", "25–27/11", "1.250.000 ₫". Số tiền dùng `formatCurrency` hiện có.

## Layout & Spacing

- **Hiện có:** vùng nội dung `mx-auto max-w-4xl px-4 py-8`; header `max-w-6xl h-16`; khoảng cách giữa thẻ `gap-3` (danh sách) hoặc `gap-6` (các mục).
- **Delta, Khu nhân viên:** thiết kế cho chiều rộng 390px trước, một cột duy nhất `max-w-2xl px-4`. Hàng đợi là các nhóm trạng thái xếp dọc trên một trang. Trên desktop vẫn một cột, không có bảng nhiều cột.
- **Delta, Trang theo dõi:** khối Ba thông tin chính và thanh tiến trình nằm trong màn hình đầu ở 390px; các phần khác gập lại bên dưới.

## Elevation & Depth

Hiện có: thẻ `shadow-sm`, khi hover lên `shadow-md` (thẻ có link). Header cửa hàng dùng `bg-white/90 backdrop-blur`. Delta: header Khu nhân viên đặc (`{colors.slate-900}`), không blur. Không thêm mức đổ bóng mới.

## Shapes

Hiện có: thẻ `{rounded.2xl}`, nút và hộp xác nhận `{rounded.xl}`, nút icon `{rounded.lg}`, badge và ảnh emoji `{rounded.full}`. Delta theo đúng quy ước này: đèn tồn kho và chip đếm là `{rounded.full}` (cùng họ với badge); dải cảnh báo và thông báo xung đột là `{rounded.xl}` (cùng họ với hộp xác nhận hủy).

## Components

Mockup tham chiếu: [`mockups/key-staff-queue.html`](mockups/key-staff-queue.html), [`mockups/key-staff-order-detail.html`](mockups/key-staff-order-detail.html), [`mockups/key-customer-tracking.html`](mockups/key-customer-tracking.html). Nếu mockup và spine mâu thuẫn, spine thắng.

**Hiện có, dùng nguyên, không sửa:** `Button` (primary / secondary / ghost / danger; sm / md / lg; disabled `opacity-50`; focus `outline-2 outline-offset-2`), `EmptyState`, `OrderStatusBadge`, `ProductImage` (emoji trên gradient), `QuantityInput`, `PriceTag`, mẫu xác nhận inline của `CancelOrderButton`.

**Delta:**

- **Staff header**: cao 3.5rem, nền `{colors.slate-900}`, chữ trắng. Bên trái: ô logo indigo hiện có cùng chữ "Khu nhân viên". Bên phải: tên Nhân viên và nút ghost "Đăng xuất" (chữ trắng). Không có giỏ hàng hay link cửa hàng.
- **Stock light (Đèn tồn kho)**: chip `{rounded.full}` `text-xs` 600.
  - Đủ hàng: `{components.stock-light-ok}` + icon `CircleCheck` + chữ "Đủ hàng".
  - Thiếu hàng: `{components.stock-light-short}` + icon `TriangleAlert` + chữ "Thiếu hàng". Bên dưới, từng dòng thiếu ghi bằng `text-sm` `{colors.rose-700}`: "Micro thu âm: cần 2, còn 1, thiếu 1".
- **Queue order card**: thẻ `{components.card}` `p-4`.
  - Hàng 1: mã đơn (600) + thời gian chờ (`text-xs` slate-500), badge trạng thái bên phải.
  - Hàng 2: emoji tròn chồng nhau (giống `/orders`) + tên khách + số món + tổng tiền.
  - Hàng 3 (chỉ đơn `pending`): Đèn tồn kho.
  - Cuối thẻ: một nút hành động chính `lg` rộng hết thẻ. Khi đèn đỏ, nút ở trạng thái disabled.
- **Queue group header**: nhãn nhóm (`{typography.label}`) + chip đếm số đơn, sticky dưới header khi cuộn.
- **Progress stepper**: dọc, 4 bước. Chấm 12px nối bằng đường 2px.
  - Bước đã qua: `{components.progress-step-done}`, kèm Mốc giờ `text-xs` slate-500.
  - Bước chưa tới: `{components.progress-step-todo}`, không ghi giờ.
  - Đơn hủy: bước cuối thay bằng `{components.progress-step-cancelled}` "Đã hủy" + Mốc giờ + lý do.
- **Key info card**: thẻ chứa ba dòng, mỗi dòng gồm nhãn `text-xs` slate-500 ở trên và giá trị `{typography.key-figure}` ở dưới. Giá trị trạng thái là nhãn chữ từ `ORDER_STATUS_LABELS`; `OrderStatusBadge` giữ ở tiêu đề trang như hiện tại, không lặp lại trong card.
- **Alert strip**: `{components.alert-strip}`, icon `TriangleAlert`, một câu và tối đa một nút `sm`.
- **Conflict notice**: `{components.conflict-notice}`, icon `Info`, hiện ngay trên thẻ đơn vừa bị từ chối.
- **Cancel sheet**: dùng lại mẫu xác nhận inline `bg-rose-50` của `CancelOrderButton`, thêm danh sách lý do dạng radio (vùng chạm cao ít nhất 44px) và nút danger "Xác nhận hủy".
- **PIN form**: thẻ ở giữa màn hình; ô nhập `inputmode="numeric"` với `text-2xl` và chữ cách rộng; nút primary `lg` rộng hết thẻ.

## Do's and Don'ts

| Nên | Không nên |
|---|---|
| Dùng class Tailwind có sẵn (`bg-indigo-600`, `ring-slate-200`) | Viết mã hex hoặc thêm màu tùy chỉnh vào `globals.css` |
| Dùng lại `Button`, `OrderStatusBadge`, `EmptyState` | Tạo biến thể nút mới cho Khu nhân viên |
| Đèn tồn kho luôn có icon + chữ | Chỉ dùng chấm xanh/đỏ không chữ |
| Thẻ `rounded-2xl ring-1 ring-slate-200 shadow-sm` | Thẻ có viền đậm, bo nhỏ, hoặc đổ bóng lớn |
| Một cột trên mọi kích thước ở Khu nhân viên | Bảng nhiều cột kiểu admin truyền thống |
| Rose chỉ cho thiếu hàng, lỗi, hủy | Rose cho trạng thái thông thường như "Chờ xác nhận" |
