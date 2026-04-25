import { proxy } from "../../../_proxy";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ product_id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { product_id } = await params;
  return proxy(`/admin/products/${product_id}`, "GET");
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { product_id } = await params;
  return proxy(`/admin/products/${product_id}`, "PATCH", await req.json().catch(() => null));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { product_id } = await params;
  return proxy(`/admin/pa/products/${product_id}`, "DELETE");
}
