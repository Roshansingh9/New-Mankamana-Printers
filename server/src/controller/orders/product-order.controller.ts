import { Request, Response } from "express";
import * as orderService from "../../services/orders/product-order.service";
import { createProductOrderSchema, updateOrderStatusSchema, setDeliveryDateSchema } from "../../validators/order.validator";
import { uploadToSupabase, downloadFromSupabase } from "../../utils/file-upload";
import { withRequestDedupe } from "../../utils/request-dedupe";
import { generateInvoicePdf } from "../../utils/pdf";
import prisma from "../../connect";

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
    // Multipart FormData sends nested/array fields as JSON strings — parse before Zod validation
    if (req.body.options && typeof req.body.options.configDetails === "string") {
      try { req.body.options.configDetails = JSON.parse(req.body.options.configDetails); }
      catch { req.body.options.configDetails = []; }
    }
    if (req.body.attachmentUrls && typeof req.body.attachmentUrls === "string") {
      try { req.body.attachmentUrls = JSON.parse(req.body.attachmentUrls); }
      catch { req.body.attachmentUrls = []; }
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

// getOrderAttachmentFile: Admin proxy — streams a single attachment from the order-attachments bucket
export const getOrderAttachmentFile = async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
    const fileKey = req.params.fileKey as string | undefined;
    if (!fileKey) return res.status(400).json({ success: false, message: "Missing file key" });

    // Reject path traversal attempts before any DB or storage lookup
    if (fileKey.includes("..") || fileKey.includes("/") || fileKey.includes("\\")) {
      return res.status(400).json({ success: false, message: "Invalid file key" });
    }

    const order = await orderService.getOrderDetailsService(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const expectedPath = `orders/${orderId}/${fileKey}`;
    const urls = (order.attachment_urls as string[] | null) ?? [];
    if (!urls.includes(expectedPath)) {
      return res.status(403).json({ success: false, message: "File not associated with this order" });
    }

    const { buffer, mimeType } = await downloadFromSupabase(expectedPath);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${fileKey}"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.send(buffer);
  } catch (error) {
    console.error("Error proxying order attachment:", error);
    return res.status(500).end();
  }
};

// getOrderPaymentProof: Admin proxy that downloads the payment proof from Supabase and streams it to the browser
export const getOrderPaymentProof = async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId as string;
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

// downloadOrderInvoice: Admin-only — generates and streams a PDF invoice for any order
export const downloadOrderInvoice = async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: { select: { business_name: true, client_code: true, phone_number: true } },
        variant: { include: { product: true } },
        configurations: true,
        approvedDesign: { select: { designCode: true } },
        statusHistory: { orderBy: { changed_at: "asc" } },
      },
    });

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Find when order was accepted (moved to ORDER_PROCESSING)
    const acceptedEntry = order.statusHistory.find((h) => h.status === "ORDER_PROCESSING");
    const acceptedAt = acceptedEntry?.changed_at ?? order.created_at;

    const snap = order.pricing_snapshot as any;
    const designSurcharge = snap?.designExtraPrice ? Number(snap.designExtraPrice) * order.quantity : 0;

    const pdfBuffer = await generateInvoicePdf({
      orderId: order.id,
      businessName: order.client.business_name,
      clientCode: order.client.client_code || "",
      phone: order.client.phone_number,
      productName: order.variant.product.name,
      variantName: order.variant.variant_name,
      quantity: order.quantity,
      unitPrice: Number(order.unit_price),
      discountAmount: Number(order.discount_amount ?? 0),
      designSurcharge,
      finalAmount: Number(order.final_amount),
      configurations: order.configurations.map((c) => ({
        group_label: c.group_label,
        selected_label: c.selected_label,
      })),
      designCode: order.approvedDesign?.designCode ?? null,
      notes: order.notes ?? null,
      paymentMethod: order.walletTransactionId ? "Wallet" : "Bank Transfer",
      acceptedAt,
    });

    const invoiceNumber = `INV-${order.id.slice(0, 8).toUpperCase()}`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoiceNumber}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating order invoice PDF:", error);
    return res.status(500).json({ success: false, message: "Failed to generate invoice" });
  }
};
