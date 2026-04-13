import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";
const AUTH_TOKEN_COOKIE = "admin-auth-token";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
}

export async function GET() {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  try {
    const [visitorRes, perfRes] = await Promise.all([
      fetch(`${API_BASE_URL}/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 20 },
      }),
      fetch(`${API_BASE_URL}/admin/performance`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 20 },
      }),
    ]);
    const visitorData = await visitorRes.json().catch(() => ({}));
    const performanceData = await perfRes.json().catch(() => null);
    const data = {
      ...visitorData,
      performance: performanceData?.data ?? null,
    };
    return NextResponse.json(data, {
      status: visitorRes.status,
      headers: { "Cache-Control": "private, max-age=20" },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to fetch analytics" }, { status: 502 });
  }
}
