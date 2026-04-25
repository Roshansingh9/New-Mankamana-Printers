import { proxy } from "../../../../_proxy";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ product_id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { product_id } = await params;
  return proxy(`/admin/products/${product_id}/fields`, "POST", await req.json().catch(() => null));
}
