import { Request, Response } from "express";
import { ZodError } from "zod";
import {
  calculatePricingBodySchema,
  legacyCalculatePriceBodySchema,
  productIdParamSchema,
  variantIdParamSchema,
} from "../../validators/catalog.validator";
import { ApiError } from "../../utils/api-error";
import {
  buildLegacyCalculatePriceResponse,
  calculateCatalogPricingService,
  getActiveProductByIdService,
  listActiveProductsService,
  listActiveVariantsByProductService,
  listVariantOptionsService,
} from "../../services/catalog/catalog-pricing.service";

const sendErrorResponse = (res: Response, error: unknown, context: string) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues.map((issue) => issue.message).join(", "),
      },
    });
  }

  console.error(`${context}:`, error);
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    },
  });
};

// getProductsController: Returns all active top-level products for authenticated catalog browsing
export const getProductsController = async (_req: Request, res: Response) => {
  try {
    const products = await listActiveProductsService();
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Get products failed");
  }
};

// getProductByIdController: Returns a single active product by id
export const getProductByIdController = async (req: Request, res: Response) => {
  try {
    const params = productIdParamSchema.parse(req.params);
    const product = await getActiveProductByIdService(params.productId);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return sendErrorResponse(res, error, "Get product by id failed");
  }
};

// getProductVariantsController: Returns active variants for a specific active product
export const getProductVariantsController = async (req: Request, res: Response) => {
  try {
    const params = productIdParamSchema.parse(req.params);
    const variants = await listActiveVariantsByProductService(params.productId);
    res.setHeader("Cache-Control", "private, max-age=60");

    return res.status(200).json({
      success: true,
      product_id: variants.product_id,
      product_code: variants.product_code,
      data: variants.data,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Get product variants failed");
  }
};

// getVariantOptionsController: Returns option groups and active option values for a variant
export const getVariantOptionsController = async (req: Request, res: Response) => {
  try {
    const params = variantIdParamSchema.parse(req.params);
    const options = await listVariantOptionsService(params.variantId);
    res.setHeader("Cache-Control", "private, max-age=60");

    return res.status(200).json({
      success: true,
      variant_id: options.variant_id,
      variant_code: options.variant_code,
      min_quantity: options.min_quantity,
      option_groups: options.option_groups,
      pricing_rows: options.pricing_rows,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Get variant options failed");
  }
};

// calculatePricingController: Calculates exact-match pricing for a selected option combination
export const calculatePricingController = async (req: Request, res: Response) => {
  try {
    const body = calculatePricingBodySchema.parse(req.body);
    const pricing = await calculateCatalogPricingService(body);
    res.setHeader("Cache-Control", "private, max-age=15");

    return res.status(200).json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Calculate pricing failed");
  }
};

// calculatePriceController: Legacy API retained for backwards compatibility with older clients
export const calculatePriceController = async (req: Request, res: Response) => {
  try {
    const params = variantIdParamSchema.parse(req.params);
    const body = legacyCalculatePriceBodySchema.parse(req.body);
    const response = await buildLegacyCalculatePriceResponse(params.variantId, body);

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    return sendErrorResponse(res, error, "Legacy calculate price failed");
  }
};
