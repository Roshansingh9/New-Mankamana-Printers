import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { unit_price } = await req.json();
  const row = await db.variantPricing.update({ where: { id }, data: { price: unit_price } });
  return NextResponse.json({ id: row.id, unit_price: Number(row.price) });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  await db.variantPricing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
