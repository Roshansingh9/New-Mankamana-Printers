import { Router } from "express";
import * as adminController from "../../controller/admin/admin.controller";
import * as authController from "../../controller/auth/auth.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";
import * as designSubmissionController from "../../controller/design/design-submission.controller";
import * as approvedDesignController from "../../controller/design/approved-design.controller";
import * as adminProductController from "../../controller/catalog/admin-product.controller";
import * as adminPricingController from "../../controller/catalog/admin-pricing.controller";
import * as adminCatalogController from "../../controller/admin/admin-catalog.controller";
import * as productOrderController from "../../controller/orders/product-order.controller";
import { getVisitorStats } from "../../controller/analytics/analytics.controller";
import { validate } from "../../middleware/validate.middleware";
import rateLimit from "express-rate-limit";

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again in 15 minutes." },
});
// Legacy validators removed

const router = Router();

// ADMIN AUTH: Specialized authentication routes for administrative access
router.post("/auth/login", authRateLimiter, authController.loginAdmin);
router.post("/auth/logout", authController.logout);
router.get("/auth/me", protect, restrictTo("ADMIN"), authController.getMe);

// REGISTRATION REQUESTS: Manage incoming client registration and approval/rejection workflows
router.get("/registration-requests", protect, restrictTo("ADMIN"), adminController.getRegistrationRequests);
router.get("/registration-requests/:request_id", protect, restrictTo("ADMIN"), adminController.getRegistrationRequestById);
router.post("/registration-requests/:request_id/approve", protect, restrictTo("ADMIN"), adminController.approveRegistrationRequest);
router.patch("/registration-requests/:request_id/reject", protect, restrictTo("ADMIN"), adminController.rejectRegistrationRequest);

// CLIENTS: View and manage approved client profiles
router.get("/clients", protect, restrictTo("ADMIN"), adminController.getClients);
router.get("/clients/:id", protect, restrictTo("ADMIN"), adminController.getClientById);
router.post("/clients/:id/reset-password", protect, restrictTo("ADMIN"), adminController.resetClientPassword);
router.patch("/clients/:id/toggle-status", protect, restrictTo("ADMIN"), adminController.toggleClientStatus);
router.get("/clients/:id/orders", protect, restrictTo("ADMIN"), adminController.getClientOrders);
router.get("/clients/:id/designs", protect, restrictTo("ADMIN"), adminController.getClientDesigns);

// DESIGN SUBMISSIONS: Review, approve, or reject custom designs submitted by clients
router.get("/design-submissions", protect, restrictTo("ADMIN"), designSubmissionController.getAdminSubmissions);
router.get("/design-submissions/:submissionId", protect, restrictTo("ADMIN"), designSubmissionController.getAdminSubmissionById);
router.post("/design-submissions/:submissionId/approve", protect, restrictTo("ADMIN"), designSubmissionController.approveSubmission);
router.patch("/design-submissions/:submissionId/reject", protect, restrictTo("ADMIN"), designSubmissionController.rejectSubmission);

// APPROVED DESIGNS: Manage the repository of designs that have passed review
router.get("/designs", protect, restrictTo("ADMIN"), approvedDesignController.getAdminDesigns);
router.get("/designs/:designId", protect, restrictTo("ADMIN"), approvedDesignController.getAdminDesignById);
router.patch("/designs/:designId/archive", protect, restrictTo("ADMIN"), approvedDesignController.archiveDesign);

import * as templateController from "../../controller/design/template.controller";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// TEMPLATES: Manage design templates and categories for client use
router.post("/templates/categories", protect, restrictTo("ADMIN"), templateController.createTemplateCategory);
router.post("/templates", protect, restrictTo("ADMIN"), upload.single("file"), templateController.createTemplate);

// CATALOG MANAGEMENT (Admin UI simplified model): Services -> Products -> Fields -> Options -> Pricing
router.get("/services", protect, restrictTo("ADMIN"), adminCatalogController.listServices);
router.post("/services/:serviceId/products", protect, restrictTo("ADMIN"), adminCatalogController.createProductUnderService);
router.get("/products", protect, restrictTo("ADMIN"), adminCatalogController.listProducts);
router.get("/products/:productId", protect, restrictTo("ADMIN"), adminCatalogController.getProductById);
router.patch("/products/:productId", protect, restrictTo("ADMIN"), adminCatalogController.updateProduct);
router.delete("/products/:productId/discount", protect, restrictTo("ADMIN"), adminCatalogController.removeProductDiscount);
router.post("/products/:productId/fields", protect, restrictTo("ADMIN"), adminCatalogController.createProductField);
router.patch("/fields/:fieldId", protect, restrictTo("ADMIN"), adminCatalogController.updateField);
router.post("/fields/:fieldId/options", protect, restrictTo("ADMIN"), adminCatalogController.createFieldOption);
router.patch("/options/:optionId", protect, restrictTo("ADMIN"), adminCatalogController.updateOption);
router.get("/products/:productId/pricing", protect, restrictTo("ADMIN"), adminCatalogController.getProductPricing);
router.post("/products/:productId/pricing", protect, restrictTo("ADMIN"), adminCatalogController.createProductPricing);
router.patch("/pricing/:pricingId", protect, restrictTo("ADMIN"), adminCatalogController.updatePricingRow);
router.delete("/pricing/:pricingId/discount", protect, restrictTo("ADMIN"), adminCatalogController.removePricingDiscount);

// UNIVERSAL PRODUCT & PRICING MANAGEMENT: Low-level variant/group/value APIs (kept for backward compatibility)
router.post("/products-raw", protect, restrictTo("ADMIN"), adminProductController.createProduct);
router.post("/products-raw/:productId/variants", protect, restrictTo("ADMIN"), adminProductController.createVariant);
router.post("/variants/:variantId/option-groups", protect, restrictTo("ADMIN"), adminProductController.createOptionGroup);
router.post("/groups/:groupId/option-values", protect, restrictTo("ADMIN"), adminProductController.createOptionValue);
router.post("/variants/:variantId/pricing", protect, restrictTo("ADMIN"), adminProductController.createVariantPricing);
router.get("/variants/:variantId/full-details", protect, restrictTo("ADMIN"), adminProductController.getVariantFullDetails);
// ADMIN PRICING APIs: Review and update pricing rows without changing catalog structure
router.get("/pricing/:variantId", protect, restrictTo("ADMIN"), adminPricingController.getVariantPricingMatrix);

// ORDERS MANAGEMENT: Overview and status updates for all client orders
router.get("/orders", protect, restrictTo("ADMIN"), productOrderController.getAdminOrders);
router.patch("/orders/:orderId/status", protect, restrictTo("ADMIN"), productOrderController.updateOrderStatus);
router.patch("/orders/:orderId/delivery-date", protect, restrictTo("ADMIN"), productOrderController.setOrderDeliveryDate);
router.get("/orders/:orderId", protect, restrictTo("ADMIN"), productOrderController.getOrderDetails);

// ANALYTICS: Visitor and page-view stats for admin dashboard
router.get("/analytics", protect, restrictTo("ADMIN"), getVisitorStats);

export default router;
