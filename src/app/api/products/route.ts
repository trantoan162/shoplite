import { NextResponse, type NextRequest } from "next/server";
import { parseCatalogQuery, queryProducts } from "@/features/catalog/catalog-service";
import { getLiveProducts } from "@/features/orders/server";
import { handleRouteError } from "@/lib/http";

// Tồn kho thay đổi theo đơn hàng (AD-9): không cache.
export const dynamic = "force-dynamic";

/** GET /api/products?q=&category=&minPrice=&maxPrice=&inStock=1&sort=&page= */
export async function GET(request: NextRequest) {
  try {
    const query = parseCatalogQuery(Object.fromEntries(request.nextUrl.searchParams));
    return NextResponse.json(queryProducts(query, await getLiveProducts()));
  } catch (error) {
    return handleRouteError(error);
  }
}
