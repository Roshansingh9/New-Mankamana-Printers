import { Request, Response } from "express";
import prisma from "../../connect";
import {
  invalidateAllCatalogCaches,
  invalidateCatalogCachesForProduct,
  invalidateCatalogCachesForVariant,
  invalidateCatalogPricingForVariant,
} from "../../services/catalog/catalog-cache.service";

// Mapping layer: AdminService <-> ProductCategory
// Mapping layer: AdminProduct <-> Product + first ProductVariant
// Mapping layer: AdminProductField <-> OptionGroup
// Mapping layer: AdminProductFieldOption <-> OptionValue
// Mapping layer: PricingRow <-> VariantPricing

// ─── SERVICES (ProductCategory) ───────────────────────────────────────────────

export const listServices = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { created_at: "asc" },
    });
    const data = categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      is_active: c.is_active,
    }));
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createService = async (req: Request, res: Response) => {
  try {
    const { name, description, is_active } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "name is required" });
    }
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const uniqueSlug = `${slug}-${Date.now()}`;
    const category = await prisma.productCategory.create({
      data: { name, slug: uniqueSlug, description: description ?? null, is_active: is_active ?? true },
    });
    await invalidateAllCatalogCaches();
    res.status(201).json({
      success: true,
      data: { id: category.id, name: category.name, description: category.description, is_active: category.is_active },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

export const listProducts = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { is_active: true },
      include: {
        variants: {
          take: 1,
          include: {
            option_groups: {
              include: { values: { orderBy: { display_order: "asc" } } },
              orderBy: { display_order: "asc" },
            },
          },
        },
      },
      orderBy: { created_at: "asc" },
    });

    const data = products.map((p) => {
      const variant = p.variants[0];
      return {
        id: p.id,
        service_id: p.category_id,
        product_code: p.product_code,
        name: p.name,
        description: p.description,
        fields: variant
          ? variant.option_groups.map((g) => ({
              id: g.id,
              field_key: g.name,
              label: g.label,
              type: "select",
              is_required: g.is_required,
              is_pricing_field: g.is_pricing_dimension,
              display_order: g.display_order,
              options: g.values.map((v) => ({
                id: v.id,
                value: v.code,
                label: v.label,
                display_order: v.display_order,
              })),
            }))
          : [],
      };
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProductUnderService = async (req: Request, res: Response) => {
  try {
    const serviceId = req.params.serviceId as string;
    const { product_code, name, description } = req.body;
    if (!product_code || !name) {
      return res.status(400).json({ success: false, message: "product_code and name are required" });
    }

    const category = await prisma.productCategory.findUnique({ where: { id: serviceId } });
    if (!category) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    const product = await prisma.product.create({
      data: {
        category_id: serviceId,
        product_code,
        name,
        description: description ?? null,
      },
    });

    // Create a default variant so the product is usable immediately
    await prisma.productVariant.create({
      data: {
        product_id: product.id,
        variant_code: `${product_code}-V1`,
        variant_name: name,
      },
    });
    await invalidateCatalogCachesForProduct(product.id);

    res.status(201).json({
      success: true,
      data: {
        id: product.id,
        service_id: product.category_id,
        product_code: product.product_code,
        name: product.name,
        description: product.description,
        fields: [],
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, message: "Product code already exists" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          take: 1,
          include: {
            option_groups: {
              include: { values: { orderBy: { display_order: "asc" } } },
              orderBy: { display_order: "asc" },
            },
          },
        },
      },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    const variant = product.variants[0];
    res.json({
      success: true,
      data: {
        id: product.id,
        service_id: product.category_id,
        product_code: product.product_code,
        name: product.name,
        description: product.description,
        fields: variant
          ? variant.option_groups.map((g) => ({
              id: g.id,
              field_key: g.name,
              label: g.label,
              type: "select",
              is_required: g.is_required,
              is_pricing_field: g.is_pricing_dimension,
              display_order: g.display_order,
              options: g.values.map((v) => ({
                id: v.id,
                value: v.code,
                label: v.label,
                display_order: v.display_order,
              })),
            }))
          : [],
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;
    const { name, description, product_code } = req.body;

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(product_code !== undefined && { product_code }),
      },
    });
    await invalidateCatalogCachesForProduct(product.id);
    res.json({
      success: true,
      data: {
        id: product.id,
        service_id: product.category_id,
        product_code: product.product_code,
        name: product.name,
        description: product.description,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeProductDiscount = async (req: Request, res: Response) => {
  // Discount is per-pricing-row, not per-product. Return success as no-op.
  res.json({ success: true, message: "Discount removed" });
};

// ─── FIELDS (OptionGroup) ──────────────────────────────────────────────────────

export const createProductField = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;
    const { field_key, label, is_required, display_order } = req.body;
    if (!field_key || !label) {
      return res.status(400).json({ success: false, message: "field_key and label are required" });
    }

    const variant = await prisma.productVariant.findFirst({ where: { product_id: productId } });
    if (!variant) {
      return res.status(404).json({ success: false, message: "Product has no variant. Create the product first." });
    }

    const group = await prisma.optionGroup.create({
      data: {
        variant_id: variant.id,
        name: field_key,
        label,
        is_required: is_required ?? true,
        display_order: display_order ?? 0,
      },
    });
    await invalidateCatalogCachesForVariant(variant.id, productId);
    res.status(201).json({
      success: true,
      data: {
        id: group.id,
        field_key: group.name,
        label: group.label,
        type: "select",
        is_required: group.is_required,
        is_pricing_field: group.is_pricing_dimension,
        display_order: group.display_order,
        options: [],
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, message: "A field with this key already exists for this product" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateField = async (req: Request, res: Response) => {
  try {
    const fieldId = req.params.fieldId as string;
    const { label, is_required, is_pricing_field, display_order } = req.body;

    const group = await prisma.optionGroup.update({
      where: { id: fieldId },
      data: {
        ...(label !== undefined && { label }),
        ...(is_required !== undefined && { is_required }),
        ...(is_pricing_field !== undefined && { is_pricing_dimension: is_pricing_field }),
        ...(display_order !== undefined && { display_order }),
      },
      include: { values: { orderBy: { display_order: "asc" } } },
    });
    await invalidateCatalogCachesForVariant(group.variant_id);
    res.json({
      success: true,
      data: {
        id: group.id,
        field_key: group.name,
        label: group.label,
        type: "select",
        is_required: group.is_required,
        is_pricing_field: group.is_pricing_dimension,
        display_order: group.display_order,
        options: group.values.map((v) => ({
          id: v.id,
          value: v.code,
          label: v.label,
          display_order: v.display_order,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── OPTIONS (OptionValue) ─────────────────────────────────────────────────────

export const createFieldOption = async (req: Request, res: Response) => {
  try {
    const fieldId = req.params.fieldId as string;
    const { value, label, display_order } = req.body;
    if (!value || !label) {
      return res.status(400).json({ success: false, message: "value and label are required" });
    }

    const optionValue = await prisma.optionValue.create({
      data: {
        group_id: fieldId,
        code: value,
        label,
        display_order: display_order ?? 0,
      },
    });
    const group = await prisma.optionGroup.findUnique({
      where: { id: fieldId },
      select: { variant_id: true },
    });
    if (group?.variant_id) {
      await invalidateCatalogCachesForVariant(group.variant_id);
    }
    res.status(201).json({
      success: true,
      data: { id: optionValue.id, value: optionValue.code, label: optionValue.label, display_order: optionValue.display_order },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ success: false, message: "An option with this value already exists in this field" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOption = async (req: Request, res: Response) => {
  try {
    const optionId = req.params.optionId as string;
    const { value, label, display_order } = req.body;

    const optionValue = await prisma.optionValue.update({
      where: { id: optionId },
      data: {
        ...(value !== undefined && { code: value }),
        ...(label !== undefined && { label }),
        ...(display_order !== undefined && { display_order }),
      },
    });
    const group = await prisma.optionGroup.findUnique({
      where: { id: optionValue.group_id },
      select: { variant_id: true },
    });
    if (group?.variant_id) {
      await invalidateCatalogCachesForVariant(group.variant_id);
    }
    res.json({
      success: true,
      data: { id: optionValue.id, value: optionValue.code, label: optionValue.label, display_order: optionValue.display_order },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PRICING (VariantPricing) ──────────────────────────────────────────────────

export const getProductPricing = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;
    const variant = await prisma.productVariant.findFirst({
      where: { product_id: productId },
      include: {
        option_groups: {
          include: { values: true },
        },
        pricing: {
          where: { is_active: true },
          orderBy: { created_at: "asc" },
        },
      },
    });
    if (!variant) {
      return res.json({ success: true, data: [] });
    }

    // Build a lookup: group.name -> group, value.code -> value
    const groupMap: Record<string, { id: string; label: string; values: Record<string, { id: string; label: string }> }> = {};
    for (const g of variant.option_groups) {
      groupMap[g.name] = { id: g.id, label: g.label, values: {} };
      for (const v of g.values) {
        groupMap[g.name].values[v.code] = { id: v.id, label: v.label };
      }
    }

    const data = variant.pricing.map((row) => {
      const selectedOpts = row.selected_options as Record<string, string>;
      return {
        id: row.id,
        unit_price: Number(row.price),
        discount_type: row.discount_type as "percentage" | "fixed" | null,
        discount_value: row.discount_value ? Number(row.discount_value) : null,
        selected_options: Object.entries(selectedOpts).map(([fieldKey, val]) => ({
          field_id: groupMap[fieldKey]?.id ?? fieldKey,
          field_key: fieldKey,
          label: groupMap[fieldKey]?.label ?? fieldKey,
          value: val,
          display_value: groupMap[fieldKey]?.values[val]?.label ?? val,
        })),
      };
    });
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProductPricing = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId as string;
    const { selectedOptions, unit_price, discount_type, discount_value } = req.body;

    if (!unit_price) {
      return res.status(400).json({ success: false, message: "unit_price is required" });
    }

    const variant = await prisma.productVariant.findFirst({ where: { product_id: productId } });
    if (!variant) {
      return res.status(404).json({ success: false, message: "Product has no variant" });
    }

    // Build combination_key and selected_options object from selectedOptions array
    // selectedOptions: [{ fieldId, value }] where fieldId is the OptionGroup id
    const groups = await prisma.optionGroup.findMany({
      where: { variant_id: variant.id },
    });
    const groupIdToName: Record<string, string> = {};
    for (const g of groups) {
      groupIdToName[g.id] = g.name;
    }

    const resolvedOptions: Record<string, string> = {};
    if (Array.isArray(selectedOptions)) {
      for (const opt of selectedOptions) {
        const key = groupIdToName[opt.fieldId] ?? opt.fieldId;
        resolvedOptions[key] = opt.value;
      }
    }

    const sortedKeys = Object.keys(resolvedOptions).sort();
    const combination_key = sortedKeys.length === 0
      ? "__NO_OPTIONS__"
      : sortedKeys.map((k) => `${k}:${resolvedOptions[k]}`).join("|");

    const existing = await prisma.variantPricing.findFirst({
      where: { variant_id: variant.id, combination_key },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "Pricing for this combination already exists" });
    }

    const pricing = await prisma.variantPricing.create({
      data: {
        variant_id: variant.id,
        combination_key,
        selected_options: resolvedOptions,
        price: unit_price,
        discount_type: discount_type ?? null,
        discount_value: discount_value ?? 0,
      },
    });
    await invalidateCatalogPricingForVariant(variant.id);

    res.status(201).json({
      success: true,
      data: {
        id: pricing.id,
        unit_price: Number(pricing.price),
        discount_type: pricing.discount_type,
        discount_value: pricing.discount_value ? Number(pricing.discount_value) : null,
        selected_options: Object.entries(resolvedOptions).map(([fieldKey, val]) => ({
          field_id: fieldKey,
          field_key: fieldKey,
          value: val,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePricingRow = async (req: Request, res: Response) => {
  try {
    const pricingId = req.params.pricingId as string;
    const { unit_price, discount_type, discount_value } = req.body;

    const pricing = await prisma.variantPricing.update({
      where: { id: pricingId },
      data: {
        ...(unit_price !== undefined && { price: unit_price }),
        ...(discount_type !== undefined && { discount_type }),
        ...(discount_value !== undefined && { discount_value }),
      },
    });
    await invalidateCatalogPricingForVariant(pricing.variant_id);
    res.json({
      success: true,
      data: {
        id: pricing.id,
        unit_price: Number(pricing.price),
        discount_type: pricing.discount_type,
        discount_value: pricing.discount_value ? Number(pricing.discount_value) : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removePricingDiscount = async (req: Request, res: Response) => {
  try {
    const pricingId = req.params.pricingId as string;
    const pricing = await prisma.variantPricing.update({
      where: { id: pricingId },
      data: { discount_type: null, discount_value: 0 },
    });
    await invalidateCatalogPricingForVariant(pricing.variant_id);
    res.json({ success: true, message: "Discount removed" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
