import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  await db.optionValue.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
