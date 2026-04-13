import { PrismaClient, Prisma } from "@prisma/client";
import { buildCombinationKey, normalizeSelectedOptions } from "./product-pricing.service";
import {
  invalidateCatalogCachesForProduct,
  invalidateCatalogCachesForVariant,
  invalidateCatalogPricingForVariant,
} from "./catalog-cache.service";
const prisma = new PrismaClient();

// Product Management
// createProductService: Logic to add a new base product to the catalog
export const createProductService = async (data: any) => {
  const product = await prisma.product.create({ data });
  await invalidateCatalogCachesForProduct(product.id);
  return product;
};

// getAllProductsService: Fetches all products including their nested variants
export const getAllProductsService = async () => {
  return await prisma.product.findMany({
    include: { variants: true },
  });
};

// Variant Management
// createVariantService: Logic to persist a new style/version (variant) of a product
export const createVariantService = async (productId: string, data: any) => {
  const variant = await prisma.productVariant.create({
    data: {
      product_id: productId,
      ...data,
    },
  });
  await invalidateCatalogCachesForProduct(productId);
  return variant;
};

// Option Group & Value Management
// createOptionGroupService: Groups related customization options for a variant
export const createOptionGroupService = async (variantId: string, data: any) => {
  const group = await prisma.optionGroup.create({
    data: {
      variant_id: variantId,
      ...data,
    },
  });
  await invalidateCatalogCachesForVariant(variantId);
  return group;
};

// createOptionValueService: Logic to add specific values (e.g., 'A4', 'Glossy') to an option group
export const createOptionValueService = async (groupId: string, data: any) => {
  const optionValue = await prisma.optionValue.create({
    data: {
      group_id: groupId,
      ...data,
    },
  });
  const group = await prisma.optionGroup.findUnique({
    where: { id: groupId },
    select: { variant_id: true },
  });
  if (group?.variant_id) {
    await invalidateCatalogCachesForVariant(group.variant_id);
  }
  return optionValue;
};

// Pricing Combination Management
// createVariantPricingService: Defines a specific price point for a combination of option values
export const createVariantPricingService = async (variantId: string, data: any) => {
  const fallbackSelectedOptions = Object.fromEntries(
    Object.entries(data).filter(([key]) => !["price", "discount_type", "discount_value", "is_active", "selectedOptions", "options"].includes(key))
  );
  const selectedOptions = normalizeSelectedOptions(data.selectedOptions ?? data.options ?? fallbackSelectedOptions);
  const combinationKey = buildCombinationKey(selectedOptions);

  const existingPricing = await prisma.variantPricing.findFirst({
    where: {
      variant_id: variantId,
      combination_key: combinationKey,
    },
  });

  if (existingPricing) {
    throw new Error("A pricing row already exists for this exact option combination.");
  }

  const pricing = await prisma.variantPricing.create({
    data: {
      variant_id: variantId,
      combination_key: combinationKey,
      selected_options: selectedOptions as Prisma.InputJsonObject,
      price: data.price,
      discount_type: data.discount_type ?? null,
      discount_value: data.discount_value ?? 0,
      is_active: data.is_active ?? true,
    },
  });
  await invalidateCatalogPricingForVariant(variantId);
  return pricing;
};

// getVariantDetailsWithPricingInfo: Deep retrieval of a variant's full options and pricing matrix
export const getVariantDetailsWithPricingInfo = async (variantId: string) => {
  return await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      option_groups: {
        include: { values: true },
      },
      pricing: true,
    },
  });
};
