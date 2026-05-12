import { proxy } from "../../_proxy";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ field_id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { field_id } = await params;
  return proxy(`/admin/pa/fields/${field_id}`, "PATCH", await req.json().catch(() => null));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { field_id } = await params;
  return proxy(`/admin/pa/fields/${field_id}`, "DELETE");
}
