import { proxy } from "../../../_proxy";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ product_id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { product_id } = await params;
  return proxy(`/admin/products/${product_id}/pricing`, "GET");
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { product_id } = await params;
  return proxy(`/admin/products/${product_id}/pricing`, "POST", await req.json().catch(() => null));
}
