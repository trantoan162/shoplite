import { describe, expect, it } from "vitest";
import { products } from "@/data/products";
import {
  getFeaturedProducts,
  getProductBySlug,
  getRelatedProducts,
  getStockStatus,
  queryProducts,
} from "./catalog-service";

// Bản catalog có tồn kho khác catalog tĩnh — mô phỏng `withLiveStock` ở ranh giới server.
const live = products.map((p) => ({ ...p, stock: 0 }));

describe("catalog-service — tham số source (AD-9)", () => {
  it("getProductBySlug đọc từ source khi được truyền, mặc định vẫn đọc catalog tĩnh", () => {
    const slug = products[0].slug;
    expect(getProductBySlug(slug, live)?.stock).toBe(0);
    expect(getProductBySlug(slug)?.stock).toBe(products[0].stock);
  });

  it("getFeaturedProducts lấy sản phẩm từ source", () => {
    expect(getFeaturedProducts(4, live).every((p) => p.stock === 0)).toBe(true);
    expect(getFeaturedProducts(4).map((p) => p.id)).toEqual(
      getFeaturedProducts(4, live).map((p) => p.id),
    );
  });

  it("getRelatedProducts lấy sản phẩm từ source", () => {
    const product = getProductBySlug("tai-nghe-khong-day-soundmax-pro")!;
    const related = getRelatedProducts(product, 4, live);
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((p) => p.stock === 0)).toBe(true);
  });

  it("queryProducts lọc inStock theo source", () => {
    expect(queryProducts({ sort: "featured", page: 1, inStock: true }, live).total).toBe(0);
  });

  it("getStockStatus của tồn kho thật 3 là 'low-stock'", () => {
    expect(getStockStatus({ stock: 3 })).toBe("low-stock");
  });
});
