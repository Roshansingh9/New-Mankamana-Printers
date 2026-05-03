import { proxy } from "../../../_proxy";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ service_id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { service_id } = await params;
  return proxy(`/admin/services/${service_id}/products`, "POST", await req.json().catch(() => null));
}
