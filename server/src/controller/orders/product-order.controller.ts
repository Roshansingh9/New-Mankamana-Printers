import { Request, Response } from "express";
import * as orderService from "../../services/orders/product-order.service";
import { createProductOrderSchema, updateOrderStatusSchema, setDeliveryDateSchema } from "../../validators/order.validator";
import { uploadToSupabase } from "../../utils/file-upload";

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
    const order = await orderService.createProductOrderService({
      userId,
      ...validated.data,
      paymentProofUrl,
      paymentProofFileName,
      paymentProofMimeType,
      paymentProofFileSize,
    });

    res.status(201).json({ success: true, message: "Order placed successfully", data: order });
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
    res.status(200).json({ success: true, data: order });
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

    const order = await orderService.updateOrderStatusService(
      orderId as string,
      validated.data.status,
      validated.data.expected_delivery_date
    );
    res.status(200).json({ success: true, message: "Order status updated successfully", data: order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Internal server error" });
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
    res.status(200).json({ success: true, message: "Expected delivery date updated", data: order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Internal server error" });
  }
};
