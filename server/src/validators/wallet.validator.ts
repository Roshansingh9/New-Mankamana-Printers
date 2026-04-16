import { z } from "zod";

const bankTransferOnlySchema = z
  .string()
  .trim()
  .min(1, "paymentMethod is required")
  .max(100, "paymentMethod is too long");

// -- Top-up request --
// submitTopupSchema: Validates a client's reported payment amount and method
export const submitTopupSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paymentMethod: bankTransferOnlySchema,
  transferReference: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
}).strict();

// -- Approve top-up --
// approveTopupSchema: Validates the official amount confirmed by admin during top-up approval
export const approveTopupSchema = z.object({
  approvedAmount: z.coerce.number().positive("Approved amount must be greater than 0"),
  note: z.string().max(500).optional(),
}).strict();

// -- Reject top-up --
// rejectTopupSchema: Ensures a valid rejection reason and category code are provided by admin
export const rejectTopupSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(1000),
  reasonCode: z.enum(["INVALID_PROOF", "AMOUNT_MISMATCH", "PAYMENT_NOT_FOUND", "DUPLICATE_REQUEST"]).optional(),
}).strict();

export const adjustTopupSchema = z.object({
  approvedAmount: z.coerce.number().positive("Adjusted amount must be greater than 0"),
  reason: z.string().min(5, "Reason is required").max(1000),
}).strict();

// -- Company payment details --
// createPaymentDetailsSchema: Validates platform-wide banking and QR payment information
export const createPaymentDetailsSchema = z.object({
  companyName: z.string().min(1),
  bankName: z.string().min(1),
  accountName: z.string().min(1),
  accountNumber: z.string().min(1),
  branch: z.string().nullish().transform((v) => v ?? undefined),
  paymentId: z.string().nullish().transform((v) => v ?? undefined),
  qrImageUrl: z.string().nullish().transform((v) => v ?? undefined),
  note: z.string().max(500).nullish().transform((v) => v ?? undefined),
  isActive: z.coerce.boolean().optional().default(true),
}).strict();

// -- Validate checkout --
// validateCheckoutSchema: Ensures a positive order amount for pre-payment balance checks
export const validateCheckoutSchema = z.object({
  orderAmount: z.coerce.number().positive("Order amount must be greater than 0"),
}).strict();

// -- Confirm wallet payment --
// confirmWalletPaymentSchema: Strict confirmation flag for finalizing wallet deductions
export const confirmWalletPaymentSchema = z.object({
  useWallet: z.boolean().refine((v) => v === true, { message: "useWallet must be true" }),
}).strict();

// -- Query schemas --
// topupQuerySchema: Filters for a client's personal history of top-up requests
export const topupQuerySchema = z.object({
  status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

// adminTopupQuerySchema: Advanced filters for administrative management of all top-ups
export const adminTopupQuerySchema = z.object({
  status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
  clientId: z.string().optional(),
  paymentMethod: bankTransferOnlySchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
}).strict();

// transactionQuerySchema: Basic history filters for client's wallet transactions
export const transactionQuerySchema = z.object({
  type: z.enum(["CREDIT", "DEBIT"]).optional(),
  source: z.enum(["TOPUP", "ORDER", "REFUND", "ADJUSTMENT"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
}).strict();

// adminTransactionQuerySchema: Detailed system-wide audit trail filters for administrators
export const adminTransactionQuerySchema = z.object({
  clientId: z.string().optional(),
  type: z.enum(["CREDIT", "DEBIT"]).optional(),
  source: z.enum(["TOPUP", "ORDER", "REFUND", "ADJUSTMENT"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
}).strict();

// notificationQuerySchema: Standard filters for dismissing or browsing in-app alerts
export const notificationQuerySchema = z.object({
  isRead: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
}).strict();
