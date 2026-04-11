-- ═══════════════════════════════════════════════════════════════════════════════
-- ADD A NEW PRODUCT — paste into Supabase SQL Editor, fill in << >> placeholders,
-- then run as a single transaction.
--
-- BUCKET IMAGE CONVENTION (product-assets bucket — PUBLIC):
--   product-assets/<<product-slug>>/thumb.jpeg         ← thumbnail (catalog card)
--   product-assets/<<product-slug>>/preview-1.jpeg     ← carousel image 1
--   product-assets/<<product-slug>>/preview-2.jpeg     ← carousel image 2
--   ...
--
-- Upload images first, then fill in the URLs below.
--
-- COMBINATION KEY FORMAT (variant_pricing):
--   Only groups where is_pricing_dimension = true are included.
--   Sort group names A→Z, join with "|".
--   Format: "groupname:valuecode|groupname:valuecode"
--   Example: "paper-quality:90gsm|printing:single"
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Product Category (skip if already exists) ────────────────────────────
INSERT INTO product_categories (name, slug, description, is_active)
VALUES (
    '<<Category Name>>',         -- e.g. 'Brochures'
    '<<category-slug>>',         -- e.g. 'brochures'
    '<<Optional description>>',  -- or NULL
    true
)
ON CONFLICT (slug) DO NOTHING;

-- ─── 2. Product ───────────────────────────────────────────────────────────────
INSERT INTO products (category_id, product_code, name, description, image_url, preview_images, is_active)
VALUES (
    (SELECT id FROM product_categories WHERE slug = '<<category-slug>>'),
    '<<PROD-CODE>>',             -- unique code e.g. 'BRO-001'
    '<<Product Name>>',          -- e.g. 'Brochure'
    '<<Optional description>>',  -- or NULL
    'https://hvvdnlsrwpenyulgfgsz.supabase.co/storage/v1/object/public/product-assets/<<product-slug>>/thumb.jpeg',
    ARRAY[
        'https://hvvdnlsrwpenyulgfgsz.supabase.co/storage/v1/object/public/product-assets/<<product-slug>>/preview-1.jpeg',
        'https://hvvdnlsrwpenyulgfgsz.supabase.co/storage/v1/object/public/product-assets/<<product-slug>>/preview-2.jpeg'
        -- add more preview URLs as needed
    ],
    true
)
ON CONFLICT (product_code) DO UPDATE
    SET name           = EXCLUDED.name,
        description    = EXCLUDED.description,
        image_url      = EXCLUDED.image_url,
        preview_images = EXCLUDED.preview_images;

-- ─── 3. Variant(s) ───────────────────────────────────────────────────────────
-- Repeat this block for each variant (e.g. A4, A3, Horizontal, Vertical …)
INSERT INTO product_variants (product_id, variant_code, variant_name, min_quantity, is_active)
VALUES (
    (SELECT id FROM products WHERE product_code = '<<PROD-CODE>>'),
    '<<PROD-CODE-V1>>',          -- unique variant code e.g. 'BRO-001-A4'
    '<<Variant Name>>',          -- e.g. 'A4 (21×29.7 cm)'
    1,                           -- min_quantity: set to bundle size (e.g. 5 means order in multiples of 5)
    true
)
ON CONFLICT (variant_code) DO UPDATE
    SET variant_name = EXCLUDED.variant_name,
        min_quantity = EXCLUDED.min_quantity;

-- ─── 4. Option Groups ─────────────────────────────────────────────────────────
-- is_pricing_dimension = true  → included in combination_key (affects price)
-- is_pricing_dimension = false → display-only (e.g. holder style, colour)
-- display_order controls render order in the UI.

INSERT INTO option_groups (variant_id, name, label, display_order, is_required, is_pricing_dimension)
VALUES
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'printing',       -- internal name used in combination_key
        'Printing',       -- label shown to client
        0,
        true,
        true
    ),
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'paper_quality',
        'Paper Quality',
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
INSERT INTO option_values (group_id, code, label, display_order, is_active, image_url)
VALUES
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
    ),
    (
        (SELECT id FROM option_groups
         WHERE variant_id = (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>')
           AND name = 'paper_quality'),
        '90gsm', '90 GSM', 0, true, NULL
    ),
    (
        (SELECT id FROM option_groups
         WHERE variant_id = (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>')
           AND name = 'paper_quality'),
        '130gsm', '130 GSM', 1, true, NULL
    )
ON CONFLICT (group_id, code) DO UPDATE
    SET label         = EXCLUDED.label,
        display_order = EXCLUDED.display_order,
        image_url     = EXCLUDED.image_url;

-- ─── 6. Variant Pricing ───────────────────────────────────────────────────────
-- combination_key: pricing-dimension groups only, sorted A→Z by name, joined with "|"
-- One row per unique combination.

INSERT INTO variant_pricing
    (variant_id, combination_key, selected_options, price, discount_type, discount_value, is_active)
VALUES
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'paper_quality:90gsm|printing:single',
        '{"paper_quality":"90gsm","printing":"single"}',
        799.00, NULL, 0.00, true
    ),
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'paper_quality:90gsm|printing:both',
        '{"paper_quality":"90gsm","printing":"both"}',
        999.00, NULL, 0.00, true
    ),
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'paper_quality:130gsm|printing:single',
        '{"paper_quality":"130gsm","printing":"single"}',
        1099.00, NULL, 0.00, true
    ),
    (
        (SELECT id FROM product_variants WHERE variant_code = '<<PROD-CODE-V1>>'),
        'paper_quality:130gsm|printing:both',
        '{"paper_quality":"130gsm","printing":"both"}',
        1399.00, NULL, 0.00, true
    )
ON CONFLICT (variant_id, combination_key) DO UPDATE
    SET selected_options = EXCLUDED.selected_options,
        price            = EXCLUDED.price,
        discount_type    = EXCLUDED.discount_type,
        discount_value   = EXCLUDED.discount_value;

-- ─── 7. Verify ────────────────────────────────────────────────────────────────
SELECT
    p.product_code,
    p.name                    AS product,
    pv.variant_code,
    pv.variant_name           AS variant,
    pv.min_quantity,
    COUNT(vpr.id)             AS pricing_rows
FROM products p
JOIN product_variants pv      ON pv.product_id = p.id
LEFT JOIN variant_pricing vpr ON vpr.variant_id = pv.id
WHERE p.product_code = '<<PROD-CODE>>'
GROUP BY p.product_code, p.name, pv.variant_code, pv.variant_name, pv.min_quantity
ORDER BY pv.variant_code;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMBINATION KEY REFERENCE
-- ─────────────────────────────────────────────────────────────────────────────
-- Rules:
--   1. Only include groups where is_pricing_dimension = true
--   2. Sort group names A→Z
--   3. Join with "|"
--
-- Examples:
--   1 dim:  "printing:single"
--   2 dims: "paper_quality:90gsm|printing:single"
--   3 dims: "paper_quality:90gsm|printing:single|size:a4"
-- ═══════════════════════════════════════════════════════════════════════════════
