import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { label } = await req.json();
  const value = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const opt = await db.optionValue.create({ data: { group_id: id, code: value, label, display_order: 0 } });
  return NextResponse.json({ id: opt.id, value: opt.code, label: opt.label }, { status: 201 });
}
