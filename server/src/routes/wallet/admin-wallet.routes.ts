import { Router } from "express";
import multer from "multer";
import { protect, restrictTo } from "../../middleware/auth.middleware";
import { createPaymentDetails, getPaymentDetails } from "../../controller/wallet/payment-details.controller";
import {
  getAdminTopupRequests,
  getAdminTopupRequestById,
  approveTopupRequest,
  rejectTopupRequest,
  adjustApprovedTopupRequest,
  getTopupProof,
} from "../../controller/wallet/topup-request.controller";
import { getAdminTransactions } from "../../controller/wallet/wallet-transaction.controller";
import { getAdminNotifications, markAdminNotificationRead, getAdminClientWalletSummary } from "../../controller/wallet/wallet-notification.controller";
import rateLimit from "express-rate-limit";
import { requireIdempotencyKey } from "../../middleware/idempotency.middleware";

const router = Router();
const adminWalletCriticalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many admin wallet actions. Please slow down." },
});

const QR_ALLOWED_MIMES = [
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
  "image/bmp", "image/tiff", "image/svg+xml",
  "application/pdf",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (QR_ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Allowed: PNG, JPG, GIF, WebP, BMP, TIFF, SVG, PDF"));
    }
  },
});

// All admin wallet routes require ADMIN auth
router.use(protect, restrictTo("ADMIN"));

// Payment details management: Define the platform's bank/QR details for top-ups
// IMPORTANT: upload.single("qrImage") runs BEFORE requireIdempotencyKey so that
// req.body is populated (by multer) when the idempotency key is derived — otherwise
// every multipart save hashes an empty body and gets the same derived key.
router.get("/payment-details", getPaymentDetails);
router.post("/payment-details", adminWalletCriticalRateLimiter, upload.single("qrImage"), requireIdempotencyKey, createPaymentDetails);

// Top-up request management: Review and process client balance top-up submissions
router.get("/topup-requests", getAdminTopupRequests);
router.get("/topup-requests/:requestId", getAdminTopupRequestById);
router.get("/topup-requests/:requestId/proof", getTopupProof);
router.patch("/topup-requests/:requestId", adminWalletCriticalRateLimiter, requireIdempotencyKey, adjustApprovedTopupRequest);
router.post("/topup-requests/:requestId/approve", adminWalletCriticalRateLimiter, requireIdempotencyKey, approveTopupRequest);
router.patch("/topup-requests/:requestId/reject", adminWalletCriticalRateLimiter, requireIdempotencyKey, rejectTopupRequest);

// Transaction log: View all financial wallet movements across the platform
router.get("/transactions", getAdminTransactions);

// Notifications: Admin-specific alerts and read-status management
router.get("/notifications", getAdminNotifications);
router.patch("/notifications/:notificationId/read", adminWalletCriticalRateLimiter, requireIdempotencyKey, markAdminNotificationRead);

// Client wallet summary: Fetch a specific client's financial status
router.get("/clients/:clientId", getAdminClientWalletSummary);

export default router;
