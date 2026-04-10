import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { protect } from "../../middleware/auth.middleware";
import * as adminController from "../../controller/admin/admin.controller";
import * as publicCatalogController from "../../controller/catalog/public-catalog.controller";
import { createRegistrationRequestSchema } from "../../validators/registration.validator";
import { trackPageView } from "../../controller/analytics/analytics.controller";
import rateLimit from "express-rate-limit";

const registrationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many registration attempts. Please try again later." },
});

const router = Router();

// CLIENT SELF-REGISTRATION: Open endpoint for new clients to submit a registration request
router.post(
  "/register-request",
  registrationRateLimiter,
  validate(createRegistrationRequestSchema),
  adminController.createRegistrationRequest
);

// CLIENT CATALOG APIs: Browse products, variants, options, and calculate exact-match pricing
router.get("/products", protect, publicCatalogController.getProductsController);
router.get("/products/:productId", protect, publicCatalogController.getProductByIdController);
router.get("/products/:productId/variants", protect, publicCatalogController.getProductVariantsController);
router.get("/variants/:variantId/options", protect, publicCatalogController.getVariantOptionsController);
router.post("/pricing/calculate", protect, publicCatalogController.calculatePricingController);

// LEGACY CATALOG API: Retained for backwards compatibility (now auth-gated to prevent price scraping)
router.post("/variants/:variantId/calculate-price", protect, publicCatalogController.calculatePriceController);

// ANALYTICS: Public page-view tracking (no auth required)
router.post("/analytics/pageview", trackPageView);

export default router;
