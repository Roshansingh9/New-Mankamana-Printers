import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";
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
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = { message: "Invalid JSON from backend." };
    }
  } else {
    data = { message: rawBody || "Unexpected response from backend." };
  }

  return NextResponse.json(data, { status: apiResponse.status });
}

export async function GET(request: Request) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { message: "Not authenticated." },
      { status: 401 }
    );
  }

  const apiResponse = await fetch(`${API_BASE_URL}/admin/designs`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  return toJsonResponse(apiResponse);
}

export async function POST(request: Request) {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json(
      { message: "Not authenticated." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const submissionId = body?.submissionId as string | undefined;

  if (!submissionId) {
    return NextResponse.json(
      { message: "submissionId is required." },
      { status: 400 }
    );
  }

  const payload: Record<string, unknown> = {};
  if (body?.note) payload.note = body.note;
  if (typeof body?.extraPrice === "number" && body.extraPrice > 0) payload.extraPrice = body.extraPrice;

  const apiResponse = await fetch(
    `${API_BASE_URL}/admin/design-submissions/${submissionId}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    }
  );

  return toJsonResponse(apiResponse);
}
