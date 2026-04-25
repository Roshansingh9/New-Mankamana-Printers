import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const data = await db.productCategory.findMany({ where: { is_active: true }, orderBy: { created_at: "asc" } });
  return NextResponse.json(data.map(c => ({ id: c.id, name: c.name })));
}
