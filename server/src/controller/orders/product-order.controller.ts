import { Request, Response } from "express";
import * as orderService from "../../services/orders/product-order.service";
import { createProductOrderSchema, updateOrderStatusSchema, setDeliveryDateSchema } from "../../validators/order.validator";
import { uploadToSupabase, downloadFromSupabase } from "../../utils/file-upload";
import { withRequestDedupe } from "../../utils/request-dedupe";

// Converts raw Prisma Decimal fields to numbers for any single order object
// returned by service calls that don't go through serializeOrder() in the service layer.
const toApiOrder = (order: any) => ({
  ...order,
  unit_price: Number(order.unit_price),
  total_amount: Number(order.total_amount),
  discount_value: Number(order.discount_value ?? 0),
  discount_amount: Number(order.discount_amount ?? 0),
  final_amount: Number(order.final_amount),
});

// createProductOrder: Handles the placement of a new order by a client, with optional payment proof upload
export const createProductOrder = async (req: Request, res: Response) => {
  try {
    // When sent as multipart FormData, options.configDetails arrives as a JSON string — parse it back to array
    if (req.body.options && typeof req.body.options.configDetails === "string") {
      try {
        req.body.options.configDetails = JSON.parse(req.body.options.configDetails);
      } catch {
        req.body.options.configDetails = [];
      }
    }

    const validated = createProductOrderSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    let paymentProofUrl: string | undefined;
    let paymentProofFileName: string | undefined;
    let paymentProofMimeType: string | undefined;
    let paymentProofFileSize: number | undefined;

    // Accept pre-uploaded proof path OR raw file (two separate flows)
    const paymentProofPath = req.body.paymentProofPath as string | undefined;
    if (req.file) {
      // Legacy flow: client sent file directly — upload it now
      try {
        paymentProofUrl = await uploadToSupabase(req.file, "orders/payment-proofs");
        paymentProofFileName = req.file.originalname;
        paymentProofMimeType = req.file.mimetype;
        paymentProofFileSize = req.file.size;
      } catch (uploadError: any) {
        return res.status(500).json({ success: false, message: "Payment proof upload failed", error: uploadError.message });
      }
    } else if (paymentProofPath) {
      // New flow: client uploaded the file first and sent us the URL/path
      paymentProofUrl = paymentProofPath;
      paymentProofFileName = req.body.paymentProofFileName as string | undefined;
      paymentProofMimeType = req.body.paymentProofMimeType as string | undefined;
    }

    const userId = (req as any).user.id;
    const attachmentUrls: string[] | undefined = req.body.attachmentUrls
      ? (Array.isArray(req.body.attachmentUrls) ? req.body.attachmentUrls : JSON.parse(req.body.attachmentUrls))
      : undefined;
    const order = await orderService.createProductOrderService({
      userId,
      ...validated.data,
      paymentProofUrl,
      paymentProofFileName,
      paymentProofMimeType,
      paymentProofFileSize,
      attachmentUrls,
    });

    res.status(201).json({ success: true, message: "Order placed successfully", data: toApiOrder(order) });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Internal server error" });
  }
};

// getMyOrders: List all orders belonging to the currently logged-in client
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const orders = await orderService.getClientOrdersService(userId);
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getAdminOrders: Admin-only view to fetch all orders in the system
export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    const orders = await orderService.getAllOrdersService();
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getOrderDetails: Fetches comprehensive info for a specific order (accessible by owner or admin)
export const getOrderDetails = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const currentUser = (req as any).user;
    const order = await orderService.getOrderDetailsService(orderId as string);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (currentUser.role === "CLIENT" && order.user_id !== currentUser.id) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const apiOrder = toApiOrder(order);
    res.status(200).json({ success: true, data: apiOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// updateOrderStatus: Admin-only function to transition an order through its processing states
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const validated = updateOrderStatusSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const result = await withRequestDedupe(
      `admin:order-status:${(req as any).user.id}:${orderId}:${validated.data.status}`,
      () =>
        orderService.updateOrderStatusService(
          orderId as string,
          validated.data.status,
          validated.data.expected_delivery_date,
          "admin"
        ),
      8000
    );
    res.status(200).json({
      success: true,
      message: result.noOp ? result.message : "Order status updated successfully",
      data: toApiOrder(result.order),
      noOp: result.noOp,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Internal server error" });
  }
};

export const cancelMyOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = (req as any).user.id;

    const order = await orderService.getOrderDetailsService(orderId as string);
    if (!order || order.user_id !== userId) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const result = await withRequestDedupe(
      `client:cancel-order:${userId}:${orderId}`,
      () => orderService.updateOrderStatusService(orderId as string, "ORDER_CANCELLED", undefined, "client"),
      8000
    );

    return res.status(200).json({
      success: true,
      message: result.noOp ? result.message : "Order cancelled successfully",
      data: toApiOrder(result.order),
      noOp: result.noOp,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message || "Cancellation failed" });
  }
};

// setOrderDeliveryDate: Admin-only — set or update expected delivery date without changing status
export const setOrderDeliveryDate = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const validated = setDeliveryDateSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }
    const order = await orderService.setOrderDeliveryDateService(orderId as string, validated.data.expected_delivery_date);
    res.status(200).json({ success: true, message: "Expected delivery date updated", data: toApiOrder(order) });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Internal server error" });
  }
};

// getOrderPaymentProof: Admin proxy that downloads the payment proof from Supabase and streams it to the browser
export const getOrderPaymentProof = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await orderService.getOrderDetailsService(orderId);
    if (!order?.payment_proof_url) return res.status(404).end();

    const proofPath = order.payment_proof_url;
    if (proofPath.startsWith("http")) return res.redirect(302, proofPath);

    const { buffer, mimeType } = await downloadFromSupabase(proofPath);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${order.payment_proof_file_name || "proof"}"`);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.send(buffer);
  } catch (error) {
    console.error("Error proxying order payment proof:", error);
    return res.status(500).end();
  }
};
