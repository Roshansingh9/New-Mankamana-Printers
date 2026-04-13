import { Router } from "express";
import multer from "multer";
import { protect, restrictTo } from "../../middleware/auth.middleware";
import { createPaymentDetails } from "../../controller/wallet/payment-details.controller";
import {
  getAdminTopupRequests,
  getAdminTopupRequestById,
  approveTopupRequest,
  rejectTopupRequest,
  adjustApprovedTopupRequest,
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (["image/png", "image/jpeg", "image/jpg"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only png, jpg, jpeg images are allowed for QR code"));
    }
  },
});

// All admin wallet routes require ADMIN auth
router.use(protect, restrictTo("ADMIN"));

// Payment details management: Define the platform's bank/QR details for top-ups
router.post("/payment-details", adminWalletCriticalRateLimiter, requireIdempotencyKey, upload.single("qrImage"), createPaymentDetails);

// Top-up request management: Review and process client balance top-up submissions
router.get("/topup-requests", getAdminTopupRequests);
router.get("/topup-requests/:requestId", getAdminTopupRequestById);
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
