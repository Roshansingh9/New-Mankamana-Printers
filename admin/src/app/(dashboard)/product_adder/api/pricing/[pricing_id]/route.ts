import { proxy } from "../../../_proxy";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ pricing_id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { pricing_id } = await params;
  return proxy(`/admin/pricing/${pricing_id}`, "PATCH", await req.json().catch(() => null));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { pricing_id } = await params;
  return proxy(`/admin/pa/pricing/${pricing_id}`, "DELETE");
}
