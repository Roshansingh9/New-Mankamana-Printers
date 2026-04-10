/**
 * Catalog seed: Card Holders, Pamphlet, Poster, Bill Books
 *
 * Run:  npx ts-node --project tsconfig.json prisma/seed-catalog.ts
 *
 * Expected VariantPricing row counts after seed:
 *   Card Holders : 2
 *   Pamphlet     : 21
 *   Poster       : 120
 *   Bill Books   : 12
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ── Bucket URL helpers ────────────────────────────────────────────────────────
const SUPABASE_URL = "https://hvvdnlsrwpenyulgfgsz.supabase.co";
const BUCKET = "printing-assets";
const ASSETS = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/product-assets`;

function productThumb(productSlug: string) {
  return `${ASSETS}/${productSlug}/thumb.jpg`;
}
function variantPreview(productSlug: string, variantSlug: string) {
  return `${ASSETS}/${productSlug}/${variantSlug}/preview.jpg`;
}
function swatch(productSlug: string, label: string) {
  const name = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${ASSETS}/${productSlug}/swatches/${name}.jpg`;
}

// ── Combination-key builder ───────────────────────────────────────────────────
// Only include pricing-dimension groups; sort alphabetically by group name.
function combKey(dims: Array<{ group: string; code: string }>) {
  return dims
    .slice()
    .sort((a, b) => a.group.localeCompare(b.group))
    .map(({ group, code }) => `${group}:${code}`)
    .join("|");
}

// ── Upsert helpers ────────────────────────────────────────────────────────────
async function upsertCategory(slug: string, name: string) {
  return prisma.productCategory.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
}

async function upsertProduct(
  code: string,
  name: string,
  categoryId: string,
  imageUrl: string,
  opts?: { description?: string; productionDays?: number }
) {
  return prisma.product.upsert({
    where: { product_code: code },
    update: { name, category_id: categoryId, image_url: imageUrl },
    create: {
      product_code: code,
      name,
      category_id: categoryId,
      image_url: imageUrl,
      description: opts?.description ?? null,
      production_days: opts?.productionDays ?? 3,
    },
  });
}

async function upsertVariant(
  productId: string,
  variantCode: string,
  variantName: string,
  minQty = 1
) {
  return prisma.productVariant.upsert({
    where: { variant_code: variantCode },
    update: { variant_name: variantName, product_id: productId, min_quantity: minQty },
    create: { product_id: productId, variant_code: variantCode, variant_name: variantName, min_quantity: minQty },
  });
}

async function upsertOptionGroup(
  variantId: string,
  name: string,
  label: string,
  isPricingDimension: boolean,
  displayOrder = 0
) {
  return prisma.optionGroup.upsert({
    where: { variant_id_name: { variant_id: variantId, name } },
    update: { label, is_pricing_dimension: isPricingDimension, display_order: displayOrder },
    create: {
      variant_id: variantId,
      name,
      label,
      is_pricing_dimension: isPricingDimension,
      display_order: displayOrder,
    },
  });
}

async function upsertOptionValue(
  groupId: string,
  code: string,
  label: string,
  displayOrder = 0,
  imageUrl?: string
) {
  return prisma.optionValue.upsert({
    where: { group_id_code: { group_id: groupId, code } },
    update: { label, display_order: displayOrder, image_url: imageUrl ?? null },
    create: { group_id: groupId, code, label, display_order: displayOrder, image_url: imageUrl ?? null },
  });
}

async function upsertPricing(
  variantId: string,
  combinationKey: string,
  selectedOptions: Record<string, string>,
  price: number
) {
  const data = {
    selected_options: selectedOptions as Prisma.InputJsonValue,
    price: new Prisma.Decimal(price),
  };
  return prisma.variantPricing.upsert({
    where: { variant_id_combination_key: { variant_id: variantId, combination_key: combinationKey } },
    update: data,
    create: { variant_id: variantId, combination_key: combinationKey, ...data },
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// CARD HOLDERS
// ═════════════════════════════════════════════════════════════════════════════
async function seedCardHolders() {
  console.log("\n▶ Card Holders");
  const cat = await upsertCategory("card-holders", "Card Holders");
  const prod = await upsertProduct("CARD-001", "Card Holders", cat.id, productThumb("card-holders"));

  // Horizontal variant (product 360 in source)
  const hVariant = await upsertVariant(prod.id, "CARD-001-H", "Horizontal");
  const hQtyGrp = await upsertOptionGroup(hVariant.id, "quantity", "Quantity", true, 0);
  await upsertOptionValue(hQtyGrp.id, "5", "5", 0);
  const hTypeGrp = await upsertOptionGroup(hVariant.id, "holder-type", "Holder Type", false, 1);
  for (const [i, lbl] of ["H - 1", "H - 2", "H - 3", "H - 4"].entries()) {
    await upsertOptionValue(hTypeGrp.id, `h-${i + 1}`, lbl, i, swatch("card-holders", lbl));
  }
  // 1 pricing row
  await upsertPricing(hVariant.id, combKey([{ group: "quantity", code: "5" }]), { quantity: "5" }, 80);

  // Vertical variant (product 361 in source)
  const vVariant = await upsertVariant(prod.id, "CARD-001-V", "Vertical");
  const vQtyGrp = await upsertOptionGroup(vVariant.id, "quantity", "Quantity", true, 0);
  await upsertOptionValue(vQtyGrp.id, "5", "5", 0);
  const vTypeGrp = await upsertOptionGroup(vVariant.id, "holder-type", "Holder Type", false, 1);
  for (const [i, lbl] of ["V - 1", "V - 2", "V - 3", "V - 4"].entries()) {
    await upsertOptionValue(vTypeGrp.id, `v-${i + 1}`, lbl, i, swatch("card-holders", lbl));
  }
  // 1 pricing row
  await upsertPricing(vVariant.id, combKey([{ group: "quantity", code: "5" }]), { quantity: "5" }, 80);

  console.log("  ✓ Card Holders seeded (2 pricing rows expected)");
}

// ═════════════════════════════════════════════════════════════════════════════
// PAMPHLET
// ═════════════════════════════════════════════════════════════════════════════
async function seedPamphlet() {
  console.log("\n▶ Pamphlet");
  const cat = await upsertCategory("pamphlets", "Pamphlets");
  const prod = await upsertProduct("PMP-001", "Pamphlet", cat.id, productThumb("pamphlet"));

  const QTY_TIERS = ["1000", "2000", "3000", "4000", "8000", "12000", "16000"];

  // ── Variant 1: A4 (Single Side only — product 226 in source) ────────────
  const v1 = await upsertVariant(prod.id, "PMP-001-V1", "A4 (Single Side)");

  const v1SizeGrp = await upsertOptionGroup(v1.id, "size", "Size", true, 0);
  await upsertOptionValue(v1SizeGrp.id, "letter", 'Letter Size - 8.5"x11"', 0);

  const v1PrintGrp = await upsertOptionGroup(v1.id, "printing", "Printing", true, 1);
  await upsertOptionValue(v1PrintGrp.id, "single", "Single Side", 0, swatch("pamphlet", "Single Side"));

  const v1QtyGrp = await upsertOptionGroup(v1.id, "qty", "Qty.", true, 2);
  for (const [i, q] of QTY_TIERS.entries()) {
    await upsertOptionValue(v1QtyGrp.id, q, q, i);
  }

  // 7 pricing rows — sizes and printing are fixed; only qty varies
  const v1Prices: Record<string, number> = {
    "1000": 799, "2000": 1529, "3000": 2249, "4000": 2539,
    "8000": 4789, "12000": 6979, "16000": 8829,
  };
  for (const q of QTY_TIERS) {
    const key = combKey([
      { group: "printing", code: "single" },
      { group: "qty", code: q },
      { group: "size", code: "letter" },
    ]);
    await upsertPricing(v1.id, key, { printing: "single", qty: q, size: "letter" }, v1Prices[q]);
  }

  // ── Variant 2: A4 (Single & Double Side — product 227 in source) ────────
  const v2 = await upsertVariant(prod.id, "PMP-001-V2", "A4 (Single & Double Side)");

  const v2SizeGrp = await upsertOptionGroup(v2.id, "size", "Size", true, 0);
  await upsertOptionValue(v2SizeGrp.id, "letter", 'Letter Size - 8.5"x11"', 0);

  const v2PrintGrp = await upsertOptionGroup(v2.id, "printing", "Printing", true, 1);
  await upsertOptionValue(v2PrintGrp.id, "single", "Single Side", 0, swatch("pamphlet", "Single Side"));
  await upsertOptionValue(v2PrintGrp.id, "both", "Both Side", 1, swatch("pamphlet", "Both Side"));

  const v2QtyGrp = await upsertOptionGroup(v2.id, "qty", "Qty.", true, 2);
  for (const [i, q] of QTY_TIERS.entries()) {
    await upsertOptionValue(v2QtyGrp.id, q, q, i);
  }

  // 14 pricing rows
  const v2SinglePrices: Record<string, number> = {
    "1000": 949, "2000": 1819, "3000": 2679, "4000": 3149,
    "8000": 5959, "12000": 8689, "16000": 11049,
  };
  const v2BothPrices: Record<string, number> = {
    "1000": 1309, "2000": 2499, "3000": 3679, "4000": 3919,
    "8000": 7979, "12000": 10699, "16000": 13449,
  };
  for (const [printCode, priceMap] of [
    ["single", v2SinglePrices] as const,
    ["both", v2BothPrices] as const,
  ]) {
    for (const q of QTY_TIERS) {
      const key = combKey([
        { group: "printing", code: printCode },
        { group: "qty", code: q },
        { group: "size", code: "letter" },
      ]);
      await upsertPricing(v2.id, key, { printing: printCode, qty: q, size: "letter" }, priceMap[q]);
    }
  }

  console.log("  ✓ Pamphlet seeded (21 pricing rows expected)");
}

// ═════════════════════════════════════════════════════════════════════════════
// POSTER
// ═════════════════════════════════════════════════════════════════════════════
async function seedPoster() {
  console.log("\n▶ Poster");
  const cat = await upsertCategory("posters", "Posters");
  const prod = await upsertProduct("PST-001", "Poster", cat.id, productThumb("poster"));

  const PRINTING = [
    { code: "single", label: "Single Side" },
    { code: "both", label: "Both Side" },
  ] as const;

  const PAPER_QUALITY = [
    { code: "70gsm-maplitho", label: "70 GSM - Maplitho Paper" },
    { code: "90gsm-art", label: "90 GSM - Art Paper" },
    { code: "115gsm-art", label: "115 GSM - Art Paper" },
    { code: "170gsm-art", label: "170 GSM - Art Paper" },
  ] as const;

  const QTY = ["1000", "2000", "3000", "4000", "5000"] as const;

  // Price tables indexed as [printing_idx][paper_idx][qty_idx]
  // product 230 → A4 / product 231 → A3 / product 232 → A2
  const POSTER_PRICES: number[][][][] = [
    // ── Variant 1 (A4, product 230) ─────────────────────────────────────────
    [
      // Single Side
      [
        [2459, 4079, 5639, 7159, 8629],   // 70gsm maplitho
        [2869, 4879, 6849, 8769, 10639],  // 90gsm art
        [3299, 5759, 8179, 10509, 12809], // 115gsm art
        [4279, 7669, 11029, 14339, 17609],// 170gsm art
      ],
      // Both Side
      [
        [3779, 5829, 7789, 9659, 11419],
        [4169, 6629, 8999, 11269, 13439],
        [4599, 7499, 10309, 13009, 15619],
        [5559, 9419, 13179, 16859, 20399],
      ],
    ],
    // ── Variant 2 (A3, product 231) ─────────────────────────────────────────
    [
      [
        [2899, 4969, 6969, 8929, 10839],
        [3459, 6079, 8629, 11149, 13619],
        [4059, 7279, 10439, 13559, 16619],
        [5389, 9919, 14409, 18839, 23229],
      ],
      [
        [4199, 6719, 9119, 11429, 13639],
        [4759, 7819, 10789, 13649, 16419],
        [5359, 9029, 12589, 16059, 19719],
        [6689, 11669, 16559, 21349, 26029],
      ],
    ],
    // ── Variant 3 (A2, product 232) ─────────────────────────────────────────
    [
      [
        [3829, 6809, 9739, 12619, 15449],
        [4629, 8419, 12159, 15839, 19479],
        [5509, 10159, 14769, 19329, 23829],
        [7419, 13989, 20519, 26989, 33409],
      ],
      [
        [5329, 8959, 12489, 15919, 19249],
        [6129, 10569, 14909, 19139, 23279],
        [7009, 12309, 17519, 22629, 27629],
        [8919, 16139, 23269, 30289, 37209],
      ],
    ],
  ];

  const VARIANTS = [
    { code: "PST-001-A4", name: "A4 (21×29.7 cm)", slug: "a4" },
    { code: "PST-001-A3", name: "A3 (29.7×42 cm)", slug: "a3" },
    { code: "PST-001-A2", name: "A2 (42×59.4 cm)", slug: "a2" },
  ];

  for (const [vi, varDef] of VARIANTS.entries()) {
    const variant = await upsertVariant(prod.id, varDef.code, varDef.name);

    const printGrp = await upsertOptionGroup(variant.id, "printing", "Printing", true, 0);
    for (const [pi, p] of PRINTING.entries()) {
      await upsertOptionValue(printGrp.id, p.code, p.label, pi, swatch("poster", p.label));
    }

    const pqGrp = await upsertOptionGroup(variant.id, "paper-quality", "Paper Quality", true, 1);
    for (const [qi, pq] of PAPER_QUALITY.entries()) {
      await upsertOptionValue(pqGrp.id, pq.code, pq.label, qi);
    }

    const qtyGrp = await upsertOptionGroup(variant.id, "qty", "Qty.", true, 2);
    for (const [qi, q] of QTY.entries()) {
      await upsertOptionValue(qtyGrp.id, q, q, qi);
    }

    // 40 pricing rows per variant
    for (const [pi, print] of PRINTING.entries()) {
      for (const [pqi, pq] of PAPER_QUALITY.entries()) {
        for (const [qi, q] of QTY.entries()) {
          const price = POSTER_PRICES[vi][pi][pqi][qi];
          const key = combKey([
            { group: "paper-quality", code: pq.code },
            { group: "printing", code: print.code },
            { group: "qty", code: q },
          ]);
          await upsertPricing(variant.id, key, { "paper-quality": pq.code, printing: print.code, qty: q }, price);
        }
      }
    }
  }

  console.log("  ✓ Poster seeded (120 pricing rows expected)");
}

// ═════════════════════════════════════════════════════════════════════════════
// BILL BOOKS
// ═════════════════════════════════════════════════════════════════════════════
async function seedBillBooks() {
  console.log("\n▶ Bill Books");
  const cat = await upsertCategory("bill-books", "Bill Books");
  const prod = await upsertProduct("BB-001", "Bill Books", cat.id, productThumb("bill-books"));

  const PAPER_QUALITY_BB = [
    { code: "100gsm-deo-1side", label: "100 GSM DEO Paper ( 1 Side Printing )" },
    { code: "100gsm-deo-2side", label: "100 GSM DEO Paper ( 2 Side Printing )" },
    { code: "90gsm-sunshine-1side", label: "90 GSM Sunshine Paper ( 1 Side Printing )" },
  ] as const;

  const BINDING = [
    { code: "normal", label: "Normal" },
    { code: "premium", label: "Premium" },
  ] as const;

  // ── Variant 1: 2-Copy (Duplicate, product 25) ────────────────────────────
  const v1 = await upsertVariant(prod.id, "BB-001-2C", "2-Copy (Duplicate)", 1);

  const v1QtyGrp = await upsertOptionGroup(v1.id, "quantity", "Quantity", true, 0);
  await upsertOptionValue(v1QtyGrp.id, "10", "10 Books", 0);

  const v1PqGrp = await upsertOptionGroup(v1.id, "paper-quality", "1st Paper Quality", true, 1);
  for (const [i, pq] of PAPER_QUALITY_BB.entries()) {
    await upsertOptionValue(v1PqGrp.id, pq.code, pq.label, i, swatch("bill-books", pq.label));
  }

  // 2nd copy paper color — NOT a pricing dimension
  const v1Copy2Grp = await upsertOptionGroup(v1.id, "copy-2-color", "2nd Copy Paper Color", false, 2);
  for (const [i, lbl] of ["White", "Pink", "Yellow"].entries()) {
    await upsertOptionValue(v1Copy2Grp.id, lbl.toLowerCase(), lbl, i);
  }

  const v1BindGrp = await upsertOptionGroup(v1.id, "binding-quality", "Binding Quality", true, 3);
  for (const [i, b] of BINDING.entries()) {
    await upsertOptionValue(v1BindGrp.id, b.code, b.label, i);
  }

  // 6 pricing rows: 3 paper × 2 binding × 1 qty
  // Combination key: binding-quality, paper-quality, quantity (alphabetical)
  const v1Prices: Record<string, Record<string, number>> = {
    "100gsm-deo-1side":   { normal: 225,   premium: 239.9 },
    "100gsm-deo-2side":   { normal: 266.9, premium: 274.9 },
    "90gsm-sunshine-1side": { normal: 214.9, premium: 223.9 },
  };
  for (const pq of PAPER_QUALITY_BB) {
    for (const b of BINDING) {
      const key = combKey([
        { group: "binding-quality", code: b.code },
        { group: "paper-quality", code: pq.code },
        { group: "quantity", code: "10" },
      ]);
      await upsertPricing(
        v1.id,
        key,
        { "binding-quality": b.code, "paper-quality": pq.code, quantity: "10" },
        v1Prices[pq.code][b.code]
      );
    }
  }

  // ── Variant 2: 3-Copy (Triplicate, product 48) ───────────────────────────
  const v2 = await upsertVariant(prod.id, "BB-001-3C", "3-Copy (Triplicate)", 1);

  const v2QtyGrp = await upsertOptionGroup(v2.id, "quantity", "Quantity", true, 0);
  await upsertOptionValue(v2QtyGrp.id, "20", "20 Books", 0);

  const v2PqGrp = await upsertOptionGroup(v2.id, "paper-quality", "1st Paper Quality", true, 1);
  for (const [i, pq] of PAPER_QUALITY_BB.entries()) {
    await upsertOptionValue(v2PqGrp.id, pq.code, pq.label, i, swatch("bill-books", pq.label));
  }

  // 2nd and 3rd copy colors — NOT pricing dimensions
  const v2Copy2Grp = await upsertOptionGroup(v2.id, "copy-2-color", "2nd Copy Paper Color", false, 2);
  for (const [i, lbl] of ["White", "Pink", "Yellow"].entries()) {
    await upsertOptionValue(v2Copy2Grp.id, lbl.toLowerCase(), lbl, i);
  }
  const v2Copy3Grp = await upsertOptionGroup(v2.id, "copy-3-color", "3rd Copy Paper Color", false, 3);
  for (const [i, lbl] of ["White", "Pink", "Yellow"].entries()) {
    await upsertOptionValue(v2Copy3Grp.id, lbl.toLowerCase(), lbl, i);
  }

  const v2BindGrp = await upsertOptionGroup(v2.id, "binding-quality", "Binding Quality", true, 4);
  for (const [i, b] of BINDING.entries()) {
    await upsertOptionValue(v2BindGrp.id, b.code, b.label, i);
  }

  // 6 pricing rows
  const v2Prices: Record<string, Record<string, number>> = {
    "100gsm-deo-1side":   { normal: 152.95, premium: 164.95 },
    "100gsm-deo-2side":   { normal: 177.45, premium: 185.95 },
    "90gsm-sunshine-1side": { normal: 151.95, premium: 160.45 },
  };
  for (const pq of PAPER_QUALITY_BB) {
    for (const b of BINDING) {
      const key = combKey([
        { group: "binding-quality", code: b.code },
        { group: "paper-quality", code: pq.code },
        { group: "quantity", code: "20" },
      ]);
      await upsertPricing(
        v2.id,
        key,
        { "binding-quality": b.code, "paper-quality": pq.code, quantity: "20" },
        v2Prices[pq.code][b.code]
      );
    }
  }

  console.log("  ✓ Bill Books seeded (12 pricing rows expected)");
}

// ═════════════════════════════════════════════════════════════════════════════
// VERIFY
// ═════════════════════════════════════════════════════════════════════════════
async function verify() {
  console.log("\n─── Verification ───");

  const countFor = async (productCode: string) => {
    const product = await prisma.product.findUnique({
      where: { product_code: productCode },
      include: { variants: { include: { pricing: true } } },
    });
    return product?.variants.reduce((sum, v) => sum + v.pricing.length, 0) ?? 0;
  };

  const ch = await countFor("CARD-001");
  const pm = await countFor("PMP-001");
  const ps = await countFor("PST-001");
  const bb = await countFor("BB-001");

  console.log(`  Card Holders : ${ch} rows  (expected 2)   ${ch === 2 ? "✅" : "❌ MISMATCH"}`);
  console.log(`  Pamphlet     : ${pm} rows  (expected 21)  ${pm === 21 ? "✅" : "❌ MISMATCH"}`);
  console.log(`  Poster       : ${ps} rows  (expected 120) ${ps === 120 ? "✅" : "❌ MISMATCH"}`);
  console.log(`  Bill Books   : ${bb} rows  (expected 12)  ${bb === 12 ? "✅" : "❌ MISMATCH"}`);

  const ok = ch === 2 && pm === 21 && ps === 120 && bb === 12;
  if (!ok) {
    console.error("\n❌ Row count mismatch — seed has errors. Stopping.");
    process.exit(1);
  }
  console.log("\n✅ All counts match.");
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("🌱 Starting catalog seed…");

  await seedCardHolders();
  await seedPamphlet();
  await seedPoster();
  await seedBillBooks();
  await verify();
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
