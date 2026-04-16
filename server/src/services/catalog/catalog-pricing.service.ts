import prisma from "../../connect";
import { ApiError } from "../../utils/api-error";
import { withCache } from "../../utils/cache";
import { invalidateCatalogPricingForVariant } from "./catalog-cache.service";
import {
  buildCombinationKey,
  normalizeSelectedOptions,
} from "./product-pricing.service";

type SelectedOptions = Record<string, string>;

type PricingRowLike = {
  id: string;
  price: unknown;
  discount_type: string | null;
  discount_value: unknown;
  is_active: boolean;
  variant_id: string;
  selected_options: unknown;
};

const toSelectedOptions = (value: unknown): SelectedOptions => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<SelectedOptions>((acc, [key, rawValue]) => {
    if (typeof rawValue === "string" && rawValue.trim().length > 0) {
      acc[key] = rawValue.trim();
    }
    return acc;
  }, {});
};

const getFixedDiscountAmount = (pricingRow: Pick<PricingRowLike, "discount_type" | "discount_value">) => {
  if (!pricingRow.discount_type) {
    return 0;
  }

  if (pricingRow.discount_type !== "fixed") {
    throw new ApiError(
      "Only fixed discounts are supported by the catalog pricing APIs.",
      500,
      "UNSUPPORTED_DISCOUNT_TYPE"
    );
  }

  return Number(pricingRow.discount_value ?? 0);
};

const mapCatalogPricingRow = (pricingRow: PricingRowLike) => {
  const selectedOptions = toSelectedOptions(pricingRow.selected_options);

  return {
    id: pricingRow.id,
    holder_type: selectedOptions.holder_type ?? null,
    paper_quality: selectedOptions.paper_quality ?? null,
    page_color: selectedOptions.page_color ?? null,
    binding: selectedOptions.binding ?? null,
    price: Number(pricingRow.price),
    discount: getFixedDiscountAmount(pricingRow),
    is_active: pricingRow.is_active,
  };
};

// listActiveProductsService: Fetches the active product catalog for authenticated users
export const listActiveProductsService = async () => {
  return withCache("catalog:active-products", 60_000, async () => {
    const products = await prisma.product.findMany({
      where: { is_active: true },
      select: {
        id: true,
        product_code: true,
        name: true,
        description: true,
        image_url: true,
        production_days: true,
      },
      orderBy: { created_at: "asc" },
    });

    return products.map((product) => ({
      ...product,
      production_days: Number(product.production_days),
    }));
  });
};

// getActiveProductByIdService: Returns a single active product by id
export const getActiveProductByIdService = async (productId: string) => {
  return withCache(`catalog:product:${productId}`, 60_000, async () => {
    const product = await prisma.product.findFirst({
      where: { id: productId, is_active: true },
      select: {
        id: true,
        product_code: true,
        name: true,
        description: true,
        image_url: true,
        preview_images: true,
        production_days: true,
      },
    });
    if (!product) throw new ApiError("Product not found.", 404, "PRODUCT_NOT_FOUND");
    return { ...product, production_days: Number(product.production_days) };
  });
};

// listActiveVariantsByProductService: Returns active variants for a specific active product
export const listActiveVariantsByProductService = async (productId: string) => {
  return withCache(`catalog:variants:${productId}`, 60_000, async () => {
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        is_active: true,
      },
      select: {
        id: true,
        product_code: true,
      },
    });

    if (!product) {
      throw new ApiError("Product not found.", 404, "PRODUCT_NOT_FOUND");
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        product_id: productId,
        is_active: true,
      },
      select: {
        id: true,
        variant_code: true,
        variant_name: true,
        min_quantity: true,
      },
      orderBy: { created_at: "asc" },
    });

    return {
      product_id: product.id,
      product_code: product.product_code,
      data: variants.map((variant) => ({
        ...variant,
        min_quantity: Number(variant.min_quantity),
      })),
    };
  });
};

// listVariantOptionsService: Builds the option group tree for an active product variant.
// Also returns all active pricing rows so the client can compute prices locally
// without a separate API round-trip.
export const listVariantOptionsService = async (variantId: string) => {
  return withCache(`catalog:variant-options:${variantId}`, 60_000, async () => {
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: variantId,
        is_active: true,
      },
      select: {
        id: true,
        variant_code: true,
        min_quantity: true,
      },
    });

    if (!variant) {
      throw new ApiError("Variant not found.", 404, "VARIANT_NOT_FOUND");
    }

    // Fetch option groups AND pricing rows in parallel
    const [optionGroups, pricingRows] = await Promise.all([
      prisma.optionGroup.findMany({
        where: { variant_id: variantId },
        select: {
          id: true,
          name: true,
          label: true,
          display_order: true,
          is_required: true,
          is_pricing_dimension: true,
          values: {
            where: { is_active: true },
            select: {
              id: true,
              code: true,
              label: true,
              display_order: true,
            },
            orderBy: { display_order: "asc" },
          },
        },
        orderBy: { display_order: "asc" },
      }),
      prisma.variantPricing.findMany({
        where: { variant_id: variantId, is_active: true },
        select: {
          combination_key: true,
          price: true,
          discount_type: true,
          discount_value: true,
        },
      }),
    ]);

    return {
      variant_id: variant.id,
      variant_code: variant.variant_code,
      min_quantity: Number(variant.min_quantity),
      option_groups: optionGroups.map((group) => ({
        id: group.id,
        name: group.name,
        label: group.label,
        display_order: Number(group.display_order),
        is_required: group.is_required,
        is_pricing_dimension: group.is_pricing_dimension,
        values: group.values.map((value) => ({
          id: value.id,
          code: value.code,
          label: value.label,
          display_order: Number(value.display_order),
        })),
      })),
      // All active pricing rows for this variant, keyed by combination_key.
      // combination_key is a sorted JSON string of pricing-dimension option codes.
      // The client can build the same key and look up prices locally.
      pricing_rows: pricingRows.map((row) => {
        const price = Number(row.price);
        const dv = Number(row.discount_value ?? 0);
        let discountAmount = 0;
        if (row.discount_type === "fixed") {
          discountAmount = dv;
        } else if (row.discount_type === "percentage") {
          discountAmount = Number((price * dv / 100).toFixed(2));
        }
        return {
          combination_key: row.combination_key as string,
          price,
          discount: discountAmount,
          discount_type: row.discount_type ?? null,
          discount_value: dv,
        };
      }),
    };
  });
};

// calculateCatalogPricingService: Resolves exact-match pricing for a variant option combination
export const calculateCatalogPricingService = async (input: {
  variant_id: string;
  selected_options: Record<string, unknown>;
  quantity: number;
}) => {
  const normalizedSelectedOptions = normalizeSelectedOptions(input.selected_options);
  const optionsKey = Object.entries(normalizedSelectedOptions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");

  return withCache(
    `catalog:pricing:${input.variant_id}:${input.quantity}:${optionsKey}`,
    60_000,
    async () => {
      const [variant, groups] = await Promise.all([
        prisma.productVariant.findFirst({
          where: {
            id: input.variant_id,
            is_active: true,
          },
          select: {
            id: true,
            variant_code: true,
            min_quantity: true,
          },
        }),
        prisma.optionGroup.findMany({
          where: {
            variant_id: input.variant_id,
          },
          select: {
            name: true,
            label: true,
            is_required: true,
            is_pricing_dimension: true,
            values: {
              where: {
                is_active: true,
              },
              select: {
                code: true,
              },
            },
          },
        }),
      ]);

      if (!variant) {
        throw new ApiError("Variant not found.", 404, "VARIANT_NOT_FOUND");
      }

      if (input.quantity < Number(variant.min_quantity)) {
        throw new ApiError(
          `Quantity must be at least ${variant.min_quantity} for this variant.`,
          400,
          "MIN_QUANTITY_NOT_MET"
        );
      }

      const groupMap = new Map(groups.map((group) => [group.name, group]));
      const unknownGroupNames = Object.keys(normalizedSelectedOptions).filter((groupName) => !groupMap.has(groupName));

      if (unknownGroupNames.length > 0) {
        throw new ApiError(
          `Unsupported option group(s): ${unknownGroupNames.join(", ")}.`,
          422,
          "INVALID_OPTION_GROUP"
        );
      }

      const missingRequiredGroups = groups
        .filter((group) => group.is_required && normalizedSelectedOptions[group.name] === undefined)
        .map((group) => group.name);

      if (missingRequiredGroups.length > 0) {
        throw new ApiError(
          `Missing required option group(s): ${missingRequiredGroups.join(", ")}.`,
          422,
          "REQUIRED_OPTION_MISSING"
        );
      }

      for (const [groupName, selectedCode] of Object.entries(normalizedSelectedOptions)) {
        const group = groupMap.get(groupName);

        if (!group) {
          continue;
        }

        const isValidCode = group.values.some((value) => value.code === selectedCode);

        if (!isValidCode) {
          throw new ApiError(
            `Invalid option value '${selectedCode}' supplied for group '${groupName}'.`,
            422,
            "INVALID_OPTION_VALUE"
          );
        }
      }

      const pricingDimensionNames = new Set(
        groups
          .filter((group) => group.is_pricing_dimension)
          .map((group) => group.name)
      );
      const pricingOptions = Object.fromEntries(
        Object.entries(normalizedSelectedOptions).filter(([key]) => pricingDimensionNames.has(key))
      );
      const combinationKey = buildCombinationKey(pricingOptions);
      const pricingRow = await prisma.variantPricing.findFirst({
        where: {
          variant_id: variant.id,
          combination_key: combinationKey,
          is_active: true,
        },
      });

      if (!pricingRow) {
        throw new ApiError("This combination is currently unavailable.", 422, "PRICING_COMBINATION_NOT_FOUND");
      }

      const unitPrice = Number(pricingRow.price);
      const discount = getFixedDiscountAmount(pricingRow);

      if (discount > unitPrice) {
        throw new ApiError(
          "Configured discount exceeds unit price for this pricing row.",
          500,
          "INVALID_PRICING_CONFIGURATION"
        );
      }

      const finalUnitPrice = Number((unitPrice - discount).toFixed(2));
      const totalPrice = Number((finalUnitPrice * input.quantity).toFixed(2));

      return {
        variant_id: variant.id,
        variant_code: variant.variant_code,
        selected_options: normalizedSelectedOptions,
        quantity: input.quantity,
        unit_price: Number(unitPrice.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        final_unit_price: finalUnitPrice,
        total_price: totalPrice,
      };
    }
  );
};

// listAdminPricingByVariantService: Returns all pricing rows for a variant for admin review
export const listAdminPricingByVariantService = async (variantId: string) => {
  const variant = await prisma.productVariant.findUnique({
    where: {
      id: variantId,
    },
    select: {
      id: true,
      variant_code: true,
    },
  });

  if (!variant) {
    throw new ApiError("Variant not found.", 404, "VARIANT_NOT_FOUND");
  }

  const pricingRows = await prisma.variantPricing.findMany({
    where: {
      variant_id: variant.id,
    },
    orderBy: {
      created_at: "asc",
    },
  });

  return {
    variant_id: variant.id,
    variant_code: variant.variant_code,
    data: pricingRows.map((row) => mapCatalogPricingRow(row)),
  };
};

// updateAdminPricingService: Updates only the price and fixed discount values for a pricing row
export const updateAdminPricingService = async (
  pricingId: string,
  input: {
    price?: number;
    discount?: number;
  }
) => {
  const existingPricing = await prisma.variantPricing.findUnique({
    where: {
      id: pricingId,
    },
  });

  if (!existingPricing) {
    throw new ApiError("Pricing row not found.", 404, "PRICING_NOT_FOUND");
  }

  const currentDiscount = getFixedDiscountAmount(existingPricing);
  const effectivePrice = input.price ?? Number(existingPricing.price);
  const effectiveDiscount = input.discount ?? currentDiscount;

  if (effectiveDiscount > effectivePrice) {
    throw new ApiError("Discount must not exceed the price.", 400, "DISCOUNT_EXCEEDS_PRICE");
  }

  const updatedPricing = await prisma.variantPricing.update({
    where: {
      id: pricingId,
    },
    data: {
      price: input.price,
      discount_type: effectiveDiscount > 0 ? "fixed" : null,
      discount_value: effectiveDiscount,
    },
  });

  await invalidateCatalogPricingForVariant(updatedPricing.variant_id);

  return {
    variant_id: updatedPricing.variant_id,
    ...mapCatalogPricingRow(updatedPricing),
  };
};

// buildLegacyCalculatePriceResponse: Adapts the newer pricing result into the legacy calculate-price shape
export const buildLegacyCalculatePriceResponse = async (variantId: string, body: { quantity: number; options: Record<string, unknown> }) => {
  const pricingResponse = await calculateCatalogPricingService({
    variant_id: variantId,
    selected_options: body.options,
    quantity: body.quantity,
  });

  return {
    unitPrice: pricingResponse.unit_price,
    quantity: pricingResponse.quantity,
    discountType: pricingResponse.discount > 0 ? "fixed" : null,
    discountValue: pricingResponse.discount,
    discountAmount: Number((pricingResponse.discount * pricingResponse.quantity).toFixed(2)),
    totalAmount: Number((pricingResponse.unit_price * pricingResponse.quantity).toFixed(2)),
    finalAmount: pricingResponse.total_price,
    selectedOptions: pricingResponse.selected_options,
  };
};
