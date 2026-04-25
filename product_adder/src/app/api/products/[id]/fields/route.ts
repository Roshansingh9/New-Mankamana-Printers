import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { label, is_pricing_field } = await req.json();

  const variant = await db.productVariant.findFirst({ where: { product_id: id } });
  if (!variant) return NextResponse.json({ error: "Product has no variant" }, { status: 404 });

  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
  const group = await db.optionGroup.create({
    data: { variant_id: variant.id, name: key, label, is_required: true, is_pricing_dimension: !!is_pricing_field, display_order: 0 },
  });

  return NextResponse.json({ id: group.id, field_key: group.name, label: group.label, is_pricing_field: group.is_pricing_dimension, choices: [] }, { status: 201 });
}
