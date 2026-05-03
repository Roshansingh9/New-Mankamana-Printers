import { proxy } from "../_proxy";

export const GET = () => proxy("/admin/products", "GET");
