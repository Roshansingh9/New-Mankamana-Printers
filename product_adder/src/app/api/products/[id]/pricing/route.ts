import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const variant = await db.productVariant.findFirst({
    where: { product_id: id },
    include: { option_groups: { include: { values: true } }, pricing: { where: { is_active: true }, orderBy: { created_at: "asc" } } },
  });
  if (!variant) return NextResponse.json([]);

  const groupMap: Record<string, { label: string; values: Record<string, string> }> = {};
  for (const g of variant.option_groups) {
    groupMap[g.name] = { label: g.label, values: {} };
    for (const v of g.values) groupMap[g.name].values[v.code] = v.label;
  }

  return NextResponse.json(variant.pricing.map(row => {
    const opts = Object.entries(row.selected_options as Record<string, string>).map(([fk, val]) => ({
      field_id: fk, field_key: fk, label: groupMap[fk]?.label ?? fk, value: val,
      display_value: groupMap[fk]?.values[val] ?? val,
    }));
    return { id: row.id, unit_price: Number(row.price), selected_options: opts };
  }));
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { selectedOptions, unit_price } = await req.json();

  const variant = await db.productVariant.findFirst({ where: { product_id: id }, include: { option_groups: true } });
  if (!variant) return NextResponse.json({ error: "No variant" }, { status: 404 });

  const idToName: Record<string, string> = {};
  for (const g of variant.option_groups) idToName[g.id] = g.name;

  const resolved: Record<string, string> = {};
  if (Array.isArray(selectedOptions)) {
    for (const o of selectedOptions) resolved[idToName[o.fieldId] ?? o.fieldId] = o.value;
  }

  const sortedKeys = Object.keys(resolved).sort();
  const combination_key = sortedKeys.length === 0 ? "__NO_OPTIONS__" : sortedKeys.map(k => `${k}:${resolved[k]}`).join("|");

  const exists = await db.variantPricing.findFirst({ where: { variant_id: variant.id, combination_key } });
  if (exists) return NextResponse.json({ error: "Combination already exists" }, { status: 409 });

  const pricing = await db.variantPricing.create({
    data: { variant_id: variant.id, combination_key, selected_options: resolved, price: unit_price ?? 0 },
  });

  return NextResponse.json({
    id: pricing.id,
    unit_price: Number(pricing.price),
    selected_options: Object.entries(resolved).map(([fk, val]) => ({ field_id: fk, field_key: fk, value: val, display_value: val })),
  }, { status: 201 });
}
