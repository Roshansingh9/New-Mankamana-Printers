import { proxy } from "../_proxy";

export const GET = () => proxy("/admin/services", "GET");

export async function POST(req: Request) {
  return proxy("/admin/services", "POST", await req.json().catch(() => null));
}
