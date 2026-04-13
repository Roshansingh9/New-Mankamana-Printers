import { Request, Response } from "express";
import { getClientTransactionsService, getAdminTransactionsService, deductForOrderService } from "../../services/wallet/wallet-transaction.service";
import { transactionQuerySchema, adminTransactionQuerySchema, confirmWalletPaymentSchema } from "../../validators/wallet.validator";
import { withRequestDedupe } from "../../utils/request-dedupe";

// getWalletTransactions: Returns a history of all credits and debits for the current client
export const getWalletTransactions = async (req: Request, res: Response) => {
  try {
    const validated = transactionQuerySchema.safeParse(req.query);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const clientId = (req as any).user.id;
    const data = await getClientTransactionsService({
      clientId,
      type: validated.data.type,
      source: validated.data.source,
      page: validated.data.page,
      limit: validated.data.limit,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getAdminTransactions: Provides a system-wide view of all financial movements for administrative audit
export const getAdminTransactions = async (req: Request, res: Response) => {
  try {
    const validated = adminTransactionQuerySchema.safeParse(req.query);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const data = await getAdminTransactionsService({
      clientId: validated.data.clientId,
      type: validated.data.type,
      source: validated.data.source,
      dateFrom: validated.data.dateFrom,
      dateTo: validated.data.dateTo,
      page: validated.data.page,
      limit: validated.data.limit,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching admin transactions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// confirmWalletPayment: Finalizes an order by deducting the required amount from the client's wallet balance
export const confirmWalletPayment = async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
    const clientId = (req as any).user.id;

    const validated = confirmWalletPaymentSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const result = await withRequestDedupe(
      `client:wallet-pay:${clientId}:${orderId}`,
      () => deductForOrderService(orderId, clientId),
      8000
    );

    res.status(200).json({
      success: true,
      message: "Wallet payment applied successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error confirming wallet payment:", error);
    res.status(400).json({ success: false, message: error.message || "Wallet payment failed" });
  }
};
