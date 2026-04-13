import { Router } from "express";
import multer from "multer";
import * as orderController from "../../controller/orders/product-order.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";
import { confirmWalletPayment } from "../../controller/wallet/wallet-transaction.controller";
import rateLimit from "express-rate-limit";
import { requireIdempotencyKey } from "../../middleware/idempotency.middleware";

const router = Router();
const criticalActionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many order actions. Please wait a moment and retry." },
});

// Multer: accept payment proof image/pdf with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only png, jpg, jpeg, pdf files are allowed for payment proof"));
    }
  },
});

// CLIENT ROUTES
router.post(
  "/",
  protect,
  restrictTo("CLIENT"),
  criticalActionRateLimiter,
  requireIdempotencyKey,
  upload.single("paymentProof"),
  orderController.createProductOrder
);

router.get(
  "/",
  protect,
  restrictTo("CLIENT"),
  orderController.getMyOrders
);

router.get(
  "/:orderId",
  protect,
  restrictTo("CLIENT"),
  orderController.getOrderDetails
);
router.patch(
  "/:orderId/cancel",
  protect,
  restrictTo("CLIENT"),
  criticalActionRateLimiter,
  requireIdempotencyKey,
  orderController.cancelMyOrder
);

router.post(
  "/:orderId/confirm-wallet-payment",
  protect,
  restrictTo("CLIENT"),
  criticalActionRateLimiter,
  requireIdempotencyKey,
  confirmWalletPayment
);

export default router;
