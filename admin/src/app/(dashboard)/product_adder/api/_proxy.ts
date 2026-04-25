// Shared proxy helper — used only by product_adder/api/* route handlers.
// Keeps every route file small and avoids duplicated boilerplate.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";
const COOKIE = "admin-auth-token";

export async function token(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE)?.value;
}

export function unauthorized() {
  return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
}

export async function proxy(
  backendPath: string,
  method: string,
  body?: unknown
): Promise<NextResponse> {
  const tok = await token();
  if (!tok) return unauthorized();

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${tok}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  };

  const res = await fetch(`${BACKEND}${backendPath}`, init);
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  return NextResponse.json(data, { status: res.status });
}
