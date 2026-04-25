import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const products = await db.product.findMany({
    where: { is_active: true },
    include: {
      variants: {
        take: 1,
        include: { option_groups: { include: { values: { orderBy: { display_order: "asc" } } }, orderBy: { display_order: "asc" } } },
      },
    },
    orderBy: { created_at: "asc" },
  });

  return NextResponse.json(products.map(p => {
    const v = p.variants[0];
    return {
      id: p.id,
      name: p.name,
      product_code: p.product_code,
      description: p.description,
      service_id: p.category_id,
      options: v ? v.option_groups.map(g => ({
        id: g.id,
        field_key: g.name,
        label: g.label,
        is_pricing_field: g.is_pricing_dimension,
        choices: g.values.map(v => ({ id: v.id, value: v.code, label: v.label })),
      })) : [],
    };
  }));
}

export async function POST(req: Request) {
  const { service_id, name, description } = await req.json();
  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 8) + "-" + String(Date.now()).slice(-3);

  const product = await db.product.create({
    data: { category_id: service_id, product_code: code, name: name.trim(), description: description?.trim() ?? null },
  });
  // auto-create default variant
  await db.productVariant.create({
    data: { product_id: product.id, variant_code: code + "-V1", variant_name: product.name },
  });

  return NextResponse.json({ id: product.id, name: product.name, product_code: product.product_code, description: product.description, service_id: product.category_id, options: [] }, { status: 201 });
}
