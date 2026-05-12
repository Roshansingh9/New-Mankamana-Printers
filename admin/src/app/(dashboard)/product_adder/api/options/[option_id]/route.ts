import { proxy } from "../../_proxy";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ option_id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { option_id } = await params;
  return proxy(`/admin/pa/options/${option_id}`, "PATCH", await req.json().catch(() => null));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { option_id } = await params;
  return proxy(`/admin/pa/options/${option_id}`, "DELETE");
}
