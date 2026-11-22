// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { products } from "@/data/products";
import { withLiveStock } from "@/features/inventory/stock";
import { GET as getProduct } from "./[slug]/route";
import { GET as listProducts } from "./route";

// Thay ranh giới server (đọc store) bằng tồn kho giả lập điều khiển được từ test.
const live = vi.hoisted(() => ({
  inventory: {} as Record<string, number>,
  fail: false,
}));

vi.mock("@/features/orders/server", async () => {
  const { products } = await import("@/data/products");
  const { withLiveStock } = await import("@/features/inventory/stock");
  return {
    getLiveProducts: async () => {
      if (live.fail) throw new Error("store hỏng");
      return withLiveStock(products, live.inventory);
    },
  };
});

const target = products.find((p) => p.id === "p001")!; // khai báo stock 25
if (!target || target.stock <= 5) throw new Error("fixture: cần p001 còn hàng trong catalog");
const list = (search = "") =>
  listProducts(new NextRequest(`http://localhost/api/products${search}`));
const detail = (slug: string) =>
  getProduct(new Request(`http://localhost/api/products/${slug}`), {
    params: Promise.resolve({ slug }),
  });

beforeEach(() => {
  live.inventory = {};
  live.fail = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/products* đọc tồn kho thật (FR-3, AD-9)", () => {
  it("đối chứng: ?inStock=true lọc theo tồn kho thật, tổng giảm đúng 1", async () => {
    const totalWithTarget = (await (await list("?inStock=true")).json()).total;
    live.inventory = { [target.id]: 0 };
    expect((await (await list("?inStock=true")).json()).total).toBe(totalWithTarget - 1);
  });

  it("tồn kho = 0 → chi tiết trả stock 0 và ?inStock=true không còn sản phẩm đó", async () => {
    live.inventory = { [target.id]: 0 };

    expect((await (await detail(target.slug)).json()).stock).toBe(0);
    const body = await (await list("?inStock=true&page=1")).json();
    const all = [body];
    for (let page = 2; page <= body.totalPages; page++) {
      all.push(await (await list(`?inStock=true&page=${page}`)).json());
    }
    const ids = all.flatMap((p: { items: { id: string }[] }) => p.items.map((item) => item.id));
    expect(ids).not.toContain(target.id);
  });

  it("tồn kho = 3 → API trả stock 3", async () => {
    live.inventory = { [target.id]: 3 };
    expect((await (await detail(target.slug)).json()).stock).toBe(3);
  });

  it("không có key → dùng stock khai báo; shape response giữ nguyên", async () => {
    const response = await detail(target.slug);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(target);
  });

  it("slug không có → 404 ngay cả khi store hỏng (không đọc store)", async () => {
    live.fail = true;
    expect((await detail("khong-co")).status).toBe(404);
  });

  it("slug không có → 404 PRODUCT_NOT_FOUND như cũ", async () => {
    const response = await detail("khong-co");
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("store không đọc được → 500, không quay về stock khai báo", async () => {
    live.fail = true;

    const detailRes = await detail(target.slug);
    const listRes = await list();

    expect(detailRes.status).toBe(500);
    expect((await detailRes.json()).error.code).toBe("INTERNAL_ERROR");
    expect(listRes.status).toBe(500);
    expect((await listRes.json()).error.code).toBe("INTERNAL_ERROR");
  });
});

describe("withLiveStock", () => {
  it("trả object mới mang tồn kho thật; không sửa catalog", () => {
    const before = structuredClone(products);
    const result = withLiveStock(products, { [target.id]: 1 });

    expect(result.find((p) => p.id === target.id)?.stock).toBe(1);
    expect(result.find((p) => p.id === target.id)).not.toBe(target);
    expect(products).toEqual(before);
  });
});
