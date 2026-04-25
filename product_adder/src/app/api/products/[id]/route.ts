import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { name, description } = await req.json();
  const p = await db.product.update({
    where: { id },
    data: { ...(name && { name }), ...(description !== undefined && { description }) },
  });
  return NextResponse.json({ id: p.id, name: p.name, description: p.description });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  await db.product.update({ where: { id }, data: { is_active: false } });
  return NextResponse.json({ ok: true });
}
