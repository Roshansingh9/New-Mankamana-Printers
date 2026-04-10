import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";
const AUTH_TOKEN_COOKIE = "admin-auth-token";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
}

async function toJsonResponse(apiResponse: Response) {
  const contentType = apiResponse.headers.get("content-type") || "";
  const rawBody = await apiResponse.text();
  let data: unknown = null;
  if (contentType.includes("application/json")) {
    try { data = JSON.parse(rawBody); } catch { data = { message: "Invalid JSON from backend." }; }
  } else {
    data = { message: rawBody || "Unexpected response from backend." };
  }
  return NextResponse.json(data, { status: apiResponse.status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ client_id: string }> }
) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  const { client_id } = await context.params;
  const apiResponse = await fetch(
    `${API_BASE_URL}/admin/clients/${client_id}/designs`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  return toJsonResponse(apiResponse);
}
