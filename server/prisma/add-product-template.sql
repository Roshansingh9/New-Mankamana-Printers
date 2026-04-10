-- ═══════════════════════════════════════════════════════════════════════════════
-- ADD A NEW PRODUCT — paste this into the Supabase SQL Editor and fill in the
-- placeholder values (marked with <<  >>).  Run it as a single transaction.
--
-- BUCKET IMAGE PATH CONVENTION:
--   printing-assets/product-assets/<<product-slug>>/thumb.jpg       ← product card image
--   printing-assets/product-assets/<<product-slug>>/<<variant-slug>>/preview.jpg
--   printing-assets/product-assets/<<product-slug>>/swatches/<<label-slug>>.jpg
--
-- COMBINATION KEY FORMAT:
--   Only groups where is_pricing_dimension = true are included.
--   Keys are sorted alphabetically by group name, joined with "|".
--   Format: "groupname:valuecode|groupname:valuecode"
--   Example: "paper-quality:90gsm-art|printing:single|qty:1000"
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Product Category (skip if category already exists) ────────────────────
INSERT INTO product_categories (name, slug, description, is_active)
VALUES (
    '<<Category Name>>',        -- e.g. 'Brochures'
    '<<category-slug>>',        -- e.g. 'brochures'  (lowercase, hyphens)
    '<<Optional description>>', -- or NULL
    true
)
ON CONFLICT (slug) DO NOTHING;

-- ─── 2. Product ───────────────────────────────────────────────────────────────
INSERT INTO products (category_id, product_code, name, description, image_url, production_days, is_active)
VALUES (
    (SELECT id FROM product_categories WHERE slug = '<<category-slug>>'),
    '<<PROD-CODE>>',            -- unique code e.g. 'BRO-001'
    '<<Product Name>>',         -- e.g. 'Brochure'
    '<<Optional description>>', -- or NULL
    'https://hvvdnlsrwpenyulgfgsz.supabase.co/storage/v1/object/public/printing-assets/product-assets/<<product-slug>>/thumb.jpg',
    3,                          -- production_days
    true
)
ON CONFLICT (product_code) DO UPDATE
    SET name        = EXCLUDED.name,
        description = EXCLUDED.description,
        image_url   = EXCLUDED.image_url;

-- ─── 3. Variant ───────────────────────────────────────────────────────────────
-- Repeat this block for each variant (e.g. A4, A3, Horizontal, Vertical …)
INSERT INTO product_variants (product_id, variant_code, variant_name, min_quantity, is_active)
VALUES (
    (SELECT id FROM products WHERE product_code = '<<PROD-CODE>>'),
    '<<PROD-CODE-V1>>',         -- unique variant code e.g. 'BRO-001-A4'
    '<<Variant Name>>',         -- e.g. 'A4 (21×29.7 cm)'
    1,                          -- min_quantity (1 means no enforced minimum)
    true
)
ON CONFLICT (variant_code) DO UPDATE
    SET variant_name = EXCLUDED.variant_name,
        min_quantity = EXCLUDED.min_quantity;

-- ─── 4. Option Groups ─────────────────────────────────────────────────────────
-- is_pricing_dimension = true  → included in the combination key (affects price)
-- is_pricing_dimension = false → display-only (colour choice, holder style, etc.)
-- display_order controls the UI render order.

INSERT INTO option_groups (variant_id, name, label, display_order, is_required, is_pricing_dimension)
VALUES
    -- Group 1: e.g. Quantity tier (pricing dimension)
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'qty',          -- internal name — used as the key in combination_key
        'Qty.',         -- displayed label
        0,              -- display_order
        true,           -- is_required
        true            -- is_pricing_dimension
    ),
    -- Group 2: e.g. Printing side (pricing dimension)
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'printing',
        'Printing',
        1,
        true,
        true
    )
    -- Add more groups as needed …
ON CONFLICT (variant_id, name) DO UPDATE
    SET label                = EXCLUDED.label,
        display_order        = EXCLUDED.display_order,
        is_pricing_dimension = EXCLUDED.is_pricing_dimension;

-- ─── 5. Option Values ─────────────────────────────────────────────────────────
-- code  = the short identifier used in combination keys (lowercase, hyphens)
-- label = what the client sees in the dropdown
-- image_url is optional (used for swatch thumbnails)

INSERT INTO option_values (group_id, code, label, display_order, is_active, image_url)
VALUES
    -- Qty values
    (
        (SELECT id FROM option_groups
         WHERE variant_id = (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>')
           AND name = 'qty'),
        '1000', '1000', 0, true, NULL
    ),
    (
        (SELECT id FROM option_groups
         WHERE variant_id = (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>')
           AND name = 'qty'),
        '2000', '2000', 1, true, NULL
    ),
    -- Printing values
    (
        (SELECT id FROM option_groups
         WHERE variant_id = (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>')
           AND name = 'printing'),
        'single', 'Single Side', 0, true, NULL
    ),
    (
        (SELECT id FROM option_groups
         WHERE variant_id = (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>')
           AND name = 'printing'),
        'both', 'Both Side', 1, true, NULL
    )
ON CONFLICT (group_id, code) DO UPDATE
    SET label         = EXCLUDED.label,
        display_order = EXCLUDED.display_order,
        image_url     = EXCLUDED.image_url;

-- ─── 6. Variant Pricing ───────────────────────────────────────────────────────
-- combination_key: only pricing-dimension groups, sorted A→Z by name, joined with "|"
-- selected_options: JSON object with ALL group name→code pairs (including display-only)
-- price: base price (Decimal, e.g. 799.00)
-- discount_type / discount_value: optional fixed discount

INSERT INTO variant_pricing
    (variant_id, combination_key, selected_options, price, discount_type, discount_value, is_active)
VALUES
    -- Single Side / 1000
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'printing:single|qty:1000',               -- combination_key (alphabetical by group name)
        '{"printing":"single","qty":"1000"}',     -- selected_options JSON
        799.00,
        NULL, 0.00, true
    ),
    -- Single Side / 2000
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'printing:single|qty:2000',
        '{"printing":"single","qty":"2000"}',
        1529.00,
        NULL, 0.00, true
    ),
    -- Both Side / 1000
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'printing:both|qty:1000',
        '{"printing":"both","qty":"1000"}',
        1309.00,
        NULL, 0.00, true
    ),
    -- Both Side / 2000
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'printing:both|qty:2000',
        '{"printing":"both","qty":"2000"}',
        2499.00,
        NULL, 0.00, true
    )
    -- Add one row per combination …
ON CONFLICT (variant_id, combination_key) DO UPDATE
    SET selected_options = EXCLUDED.selected_options,
        price            = EXCLUDED.price,
        discount_type    = EXCLUDED.discount_type,
        discount_value   = EXCLUDED.discount_value;

-- ─── 7. Verify ────────────────────────────────────────────────────────────────
SELECT
    p.product_code,
    p.name                        AS product,
    pv.variant_code,
    pv.variant_name               AS variant,
    COUNT(vpr.id)                 AS pricing_rows
FROM products p
JOIN product_variants pv  ON pv.product_id   = p.id
LEFT JOIN variant_pricing vpr ON vpr.variant_id = pv.id
WHERE p.product_code = '<<PROD-CODE>>'
GROUP BY p.product_code, p.name, pv.variant_code, pv.variant_name
ORDER BY pv.variant_code;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- QUICK REFERENCE — combination_key examples
-- ───────────────────────────────────────────────────────────────────────────────
-- 2 dims (printing + qty):
--   printing:single|qty:1000
--   printing:both|qty:2000
--
-- 3 dims (paper-quality + printing + qty):
--   paper-quality:90gsm-art|printing:single|qty:1000
--
-- 1 dim (quantity only — display-only groups are excluded):
--   quantity:5
--
-- Always sort group names A→Z before joining with "|"
-- ═══════════════════════════════════════════════════════════════════════════════
