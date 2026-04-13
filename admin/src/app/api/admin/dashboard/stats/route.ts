import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";
const AUTH_TOKEN_COOKIE = "admin-auth-token";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
}

export async function GET() {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch data in parallel from available endpoints
  const [ordersRes, registrationsRes, designsRes, clientsRes] = await Promise.allSettled([
    fetch(`${API_BASE_URL}/admin/orders`, { headers, next: { revalidate: 15 } }),
    fetch(`${API_BASE_URL}/admin/registration-requests?status=PENDING`, { headers, next: { revalidate: 15 } }),
    fetch(`${API_BASE_URL}/admin/design-submissions?status=PENDING_REVIEW`, { headers, next: { revalidate: 15 } }),
    fetch(`${API_BASE_URL}/admin/clients`, { headers, next: { revalidate: 15 } }),
  ]);

  const parseJson = async (res: PromiseSettledResult<Response>) => {
    if (res.status === "rejected") return null;
    try { return await res.value.json(); } catch { return null; }
  };

  const [orders, registrations, designs, clients] = await Promise.all([
    parseJson(ordersRes),
    parseJson(registrationsRes),
    parseJson(designsRes),
    parseJson(clientsRes),
  ]);

  const ordersData = Array.isArray(orders?.data) ? orders.data : [];
  const registrationsData = Array.isArray(registrations?.data) ? registrations.data : [];
  // design-submissions returns { data: { items: [], pagination: {} } }
  const designsData = Array.isArray(designs?.data?.items) ? designs.data.items : [];
  const clientsData = Array.isArray(clients?.data) ? clients.data : [];

  const activeStatuses = ["ORDER_PLACED", "ORDER_PROCESSING", "ORDER_PREPARED", "ORDER_DISPATCHED"];

  return NextResponse.json({
    success: true,
    data: {
      active_orders: ordersData.filter((o: any) => activeStatuses.includes(o.status)).length,
      total_orders: ordersData.length,
      pending_registrations: registrationsData.length,
      pending_designs: designsData.length,
      total_clients: clientsData.length,
    },
  }, {
    headers: {
      "Cache-Control": "private, max-age=15",
    },
  });
}
