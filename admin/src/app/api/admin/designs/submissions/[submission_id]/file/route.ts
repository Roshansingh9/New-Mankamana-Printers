import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";
const AUTH_TOKEN_COOKIE = "admin-auth-token";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_TOKEN_COOKIE)?.value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ submission_id: string }> }
) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ message: "Not authenticated." }, { status: 401 });

  const { submission_id } = await context.params;
  const apiResponse = await fetch(
    `${API_BASE_URL}/admin/design-submissions/${submission_id}/file`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  if (!apiResponse.ok) return new NextResponse(null, { status: apiResponse.status });

  const buffer = await apiResponse.arrayBuffer();
  const contentType = apiResponse.headers.get("content-type") || "application/octet-stream";
  const contentDisposition = apiResponse.headers.get("content-disposition") || "inline";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "private, max-age=120",
    },
  });
}
