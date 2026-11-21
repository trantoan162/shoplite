import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { E2E_ORDERS_FILE, E2E_STORE_FILE, REAL_STORAGE_DIR } from "./e2e-env";

/** Đọc mã đơn trong một file dữ liệu: ShopState `{ orders }` hoặc mảng `Order[]` cũ. */
function orderIdsIn(file: string): string[] {
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
  const orders = Array.isArray(data) ? data : ((data as { orders?: unknown[] }).orders ?? []);
  return orders.map((order) => (order as { id: string }).id);
}

// AD-19: đơn tạo trong E2E phải nằm trong `.e2e/`, không bao giờ trong `storage/` thật.
test("đơn tạo trong E2E được ghi vào .e2e/, không vào storage/", async ({ request }) => {
  const response = await request.post("/api/orders", {
    data: {
      customer: { fullName: "E2E Isolation", phone: "0912345678", address: "1 Lê Lợi, Huế" },
      shippingMethod: "standard",
      paymentMethod: "cod",
      // Sản phẩm riêng của spec này (không dùng p006 của shopping-flow).
      items: [{ productId: "p010", quantity: 1 }],
    },
  });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };

  // Theo file server đang thật sự ghi: store mới (từ Story 1.4) hoặc orders.json cũ.
  const e2eIds = [...orderIdsIn(E2E_STORE_FILE), ...orderIdsIn(E2E_ORDERS_FILE)];
  expect(e2eIds).toContain(id);

  for (const name of ["orders.json", "shop-store.json"]) {
    expect(orderIdsIn(path.join(REAL_STORAGE_DIR, name))).not.toContain(id);
  }
});
