import { Router } from "express";
import multer from "multer";
import { protect, restrictTo } from "../../middleware/auth.middleware";
import { getPaymentDetails, getQrImage } from "../../controller/wallet/payment-details.controller";
import { getWalletBalance, validateCheckout } from "../../controller/wallet/wallet-account.controller";
import { submitTopupRequest, getMyTopupRequests, getMyTopupRequestById } from "../../controller/wallet/topup-request.controller";
import { getWalletTransactions, confirmWalletPayment } from "../../controller/wallet/wallet-transaction.controller";
import { getClientNotifications, markClientNotificationRead } from "../../controller/wallet/wallet-notification.controller";
import rateLimit from "express-rate-limit";
import { requireIdempotencyKey } from "../../middleware/idempotency.middleware";

const router = Router();
const walletCriticalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many wallet actions. Please try again shortly." },
});

// Multer memory storage for proof uploads to Supabase
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error("Only png, jpg, jpeg, pdf files are allowed"));
    }
  },
});

// Public: QR image proxy — no auth required; image is publicly visible to all users
// Must be declared BEFORE the protect middleware so unauthenticated browsers can load it
router.get("/qr-image", getQrImage);

// All other client wallet routes require CLIENT auth
router.use(protect, restrictTo("CLIENT"));

// Payment details: View platform bank details to make a transfer
router.get("/payment-details", getPaymentDetails);

// Top-up requests: Submit new proof of transfer and track personal requests
router.post("/topup-requests", walletCriticalRateLimiter, requireIdempotencyKey, upload.single("proofFile"), submitTopupRequest);
router.get("/topup-requests", getMyTopupRequests);
router.get("/topup-requests/:requestId", getMyTopupRequestById);

// Balance: Quick check of current available wallet funds
router.get("/balance", getWalletBalance);

// Transactions: Personal history of wallet credits and debits
router.get("/transactions", getWalletTransactions);

// Validate checkout: Verify if wallet has sufficient funds for a potential order
router.post("/validate-checkout", walletCriticalRateLimiter, validateCheckout);

// Notifications: Personal wallet-related push alerts
router.get("/notifications", getClientNotifications);
router.patch("/notifications/:notificationId/read", walletCriticalRateLimiter, requireIdempotencyKey, markClientNotificationRead);



export default router;
