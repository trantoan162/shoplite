import { expect, test } from "@playwright/test";
import { E2E_SOLD_OUT_PRODUCT } from "./e2e-env";

// Story 1.7: cửa hàng đọc tồn kho lưu bền, không đọc `stock` khai báo trong products.ts.
test("sản phẩm hết hàng trong store hiện 'Hết hàng' và bị lọc khỏi 'còn hàng'", async ({
  page,
  request,
}) => {
  await page.goto(`/products/${E2E_SOLD_OUT_PRODUCT.slug}`);
  // Catalog khai báo còn 18 nhưng store ghi 0: trang phải theo store.
  await expect(page.getByText("Sản phẩm tạm hết hàng. Vui lòng quay lại sau.")).toBeVisible();
  await expect(page.getByTestId("purchase-panel")).toHaveCount(0);

  const detail = await (await request.get(`/api/products/${E2E_SOLD_OUT_PRODUCT.slug}`)).json();
  expect(detail.stock).toBe(0);

  // Đối chứng: không lọc thì có, lọc "còn hàng" thì mất.
  const all = await (
    await request.get(`/api/products?category=${E2E_SOLD_OUT_PRODUCT.category}`)
  ).json();
  const inStock = await (
    await request.get(`/api/products?category=${E2E_SOLD_OUT_PRODUCT.category}&inStock=1`)
  ).json();
  const ids = (body: { items: { id: string }[] }) => body.items.map((item) => item.id);
  expect(ids(all)).toContain(E2E_SOLD_OUT_PRODUCT.id);
  expect(ids(inStock)).not.toContain(E2E_SOLD_OUT_PRODUCT.id);
  expect(inStock.total).toBe(all.total - 1);
});
