import { proxy } from "../../../../_proxy";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ field_id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { field_id } = await params;
  return proxy(`/admin/fields/${field_id}/options`, "POST", await req.json().catch(() => null));
}
