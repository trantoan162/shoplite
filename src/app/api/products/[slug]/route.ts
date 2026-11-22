import { NextResponse } from "next/server";
import { getProductBySlug } from "@/features/catalog/catalog-service";
import { getLiveProducts } from "@/features/orders/server";
import { handleRouteError, jsonError } from "@/lib/http";

// Tồn kho thay đổi theo đơn hàng (AD-9): không cache.
export const dynamic = "force-dynamic";

/** GET /api/products/:slug */
export async function GET(_request: Request, ctx: RouteContext<"/api/products/[slug]">) {
  const { slug } = await ctx.params;
  // Slug không có trong catalog tĩnh → 404 ngay, không cần đọc store.
  if (!getProductBySlug(slug)) {
    return jsonError(404, "PRODUCT_NOT_FOUND", `Không tìm thấy sản phẩm "${slug}"`);
  }
  try {
    const product = getProductBySlug(slug, await getLiveProducts())!;
    return NextResponse.json(product);
  } catch (error) {
    return handleRouteError(error);
  }
}
