import prisma from "../../connect";
import { getVariantPricingCombination, calculateOrderAmount, normalizeSelectedOptions } from "../catalog/product-pricing.service";
import { sendOrderPlaced, sendOrderStatusUpdate } from "../../utils/email";

// ORDER_PLACED → ORDER_PROCESSING → ORDER_PREPARED → ORDER_DISPATCHED → ORDER_DELIVERED
const ORDER_STATUS_FLOW: Record<string, string | null> = {
  ORDER_PLACED: "ORDER_PROCESSING",
  ORDER_PROCESSING: "ORDER_PREPARED",
  ORDER_PREPARED: "ORDER_DISPATCHED",
  ORDER_DISPATCHED: "ORDER_DELIVERED",
  ORDER_DELIVERED: null,
};

// How long after placement before the order is automatically moved to ORDER_PROCESSING (2 minutes)
const AUTO_PROCESSING_DELAY_MS = 2 * 60 * 1000;

// autoAdvanceToProcessing: Called by setTimeout or startup sweep to move an ORDER_PLACED order forward
async function autoAdvanceToProcessing(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        expected_delivery_date: true,
        variant: { select: { variant_name: true, product: { select: { name: true } } } },
        client: { select: { email: true, business_name: true } },
      },
    });
    // Guard: only advance if still in ORDER_PLACED (admin may have cancelled it in the meantime)
    if (!order || order.status !== "ORDER_PLACED") return;
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "ORDER_PROCESSING", updated_at: new Date() },
    });
    // Fire email notification (non-blocking)
    sendOrderStatusUpdate({
      to: order.client.email,
      businessName: order.client.business_name,
      orderId,
      productName: order.variant.product.name,
      variantName: order.variant.variant_name,
      newStatus: "ORDER_PROCESSING",
      expectedDeliveryDate: order.expected_delivery_date,
    }).catch((err) => console.error(`[Email] Order processing notification failed for ${orderId}:`, err));
  } catch (err) {
    console.error(`[AutoTransition] Failed to advance order ${orderId} to ORDER_PROCESSING:`, err);
  }
}

// sweepStalePlacedOrders: On server startup, advance any ORDER_PLACED orders older than the delay
// (handles the case where the server restarted before the scheduled setTimeout fired)
export async function sweepStalePlacedOrders(): Promise<void> {
  const threshold = new Date(Date.now() - AUTO_PROCESSING_DELAY_MS);
  const staleOrders = await prisma.order.findMany({
    where: { status: "ORDER_PLACED", created_at: { lt: threshold } },
    select: { id: true },
  });
  for (const { id } of staleOrders) {
    await autoAdvanceToProcessing(id);
  }
  if (staleOrders.length > 0) {
    console.log(`[AutoTransition] Advanced ${staleOrders.length} stale order(s) → ORDER_PROCESSING on startup`);
  }
}

// createProductOrderService: Core logic for placing a new order, resolving pricing and saving configurations
export const createProductOrderService = async (data: {
  userId: string;
  variantId: string;
  quantity: number;
  options: Record<string, unknown> & {
    configDetails?: Array<{
      groupName: string;
      groupLabel: string;
      selectedCode: string;
      selectedLabel: string;
    }>;
  };
  notes?: string;
  designCode?: string;
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  paymentProofMimeType?: string;
  paymentProofFileSize?: number;
}) => {
  const { userId, variantId, quantity, options, notes, designCode,
    paymentProofUrl, paymentProofFileName, paymentProofMimeType, paymentProofFileSize } = data;
  const selectedOptions = normalizeSelectedOptions(options);

  const pricingRow = await getVariantPricingCombination(variantId, selectedOptions);
  if (!pricingRow) {
    throw new Error("Invalid combination of options for this product variant.");
  }

  const unitPrice = Number(pricingRow.price);
  const pricingDiscount =
    pricingRow.discount_type && Number(pricingRow.discount_value) > 0
      ? {
          type: pricingRow.discount_type as "percentage" | "fixed",
          value: Number(pricingRow.discount_value),
        }
      : undefined;

  const { totalAmount, discountAmount, finalAmount } = calculateOrderAmount(
    unitPrice,
    quantity,
    pricingDiscount
  );

  const pricingSnapshot = {
    pricingRowId: pricingRow.id,
    pricing: selectedOptions,
    unit_price: unitPrice,
    base_total: totalAmount,
    discount: pricingDiscount
      ? {
          type: pricingDiscount.type,
          value: pricingDiscount.value,
          amount: discountAmount,
        }
      : null,
    final_total: finalAmount,
    designCode: designCode || null,
  };

  const newOrder = await prisma.$transaction(async (tx) => {
    let approvedDesignId: string | null = null;

    if (designCode) {
      const approvedDesign = await tx.approvedDesign.findFirst({
        where: {
          designCode,
          clientId: userId,
          status: "ACTIVE",
        },
      });

      if (!approvedDesign) {
        throw new Error("Invalid design code. Please use an active approved design code belonging to your account.");
      }

      approvedDesignId = approvedDesign.id;
    }

    const order = await tx.order.create({
      data: {
        user_id: userId,
        variant_id: variantId,
        quantity: quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        discount_type: pricingDiscount?.type || null,
        discount_value: pricingDiscount?.value || 0,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        notes: notes,
        designId: approvedDesignId,
        pricing_snapshot: pricingSnapshot as any,
        status: "ORDER_PLACED",
        payment_status: paymentProofUrl ? "PROOF_SUBMITTED" : "PENDING",
        payment_proof_url: paymentProofUrl || null,
        payment_proof_file_name: paymentProofFileName || null,
        payment_proof_mime_type: paymentProofMimeType || null,
        payment_proof_file_size: paymentProofFileSize || null,
      },
    });

    if (options.configDetails && options.configDetails.length > 0) {
      await tx.orderConfiguration.createMany({
        data: options.configDetails.map((config) => ({
          order_id: order.id,
          group_name: config.groupName,
          group_label: config.groupLabel,
          selected_code: config.selectedCode,
          selected_label: config.selectedLabel,
        })),
      });
    }

    return order;
  });

  // Schedule automatic transition ORDER_PLACED → ORDER_PROCESSING after the delay
  setTimeout(() => autoAdvanceToProcessing(newOrder.id), AUTO_PROCESSING_DELAY_MS);

  // Send order confirmation email (non-blocking)
  prisma.order.findUnique({
    where: { id: newOrder.id },
    select: {
      quantity: true,
      final_amount: true,
      variant: { select: { variant_name: true, product: { select: { name: true } } } },
      client: { select: { email: true, business_name: true } },
    },
  }).then((o) => {
    if (!o) return;
    return sendOrderPlaced({
      to: o.client.email,
      businessName: o.client.business_name,
      orderId: newOrder.id,
      productName: o.variant.product.name,
      variantName: o.variant.variant_name,
      quantity: o.quantity,
      finalAmount: Number(o.final_amount),
    });
  }).catch((err) => console.error(`[Email] Order placed notification failed for ${newOrder.id}:`, err));

  return newOrder;
};

// getOrderDetailsService: Retrieves full details of a specific order including variant and config info
export const getOrderDetailsService = async (orderId: string) => {
  return await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      approvedDesign: {
        select: {
          id: true,
          designCode: true,
          status: true,
        },
      },
      variant: {
        include: {
          product: true,
        },
      },
      configurations: true,
    },
  });
};

// getClientOrdersService: Lists all orders placed by a specific client
export const getClientOrdersService = async (userId: string) => {
  return await prisma.order.findMany({
    where: { user_id: userId },
    include: {
      approvedDesign: {
        select: {
          designCode: true,
        },
      },
      variant: {
        select: {
          variant_name: true,
          product: { select: { name: true } }
        }
      }
    },
    orderBy: { created_at: "desc" },
  });
};

// getAllOrdersService: Provides an administrative overview of every order in the system
export const getAllOrdersService = async () => {
  return await prisma.order.findMany({
    include: {
      client: { select: { business_name: true, phone_number: true } },
      approvedDesign: {
        select: {
          designCode: true,
        },
      },
      variant: {
        select: {
          variant_name: true,
          product: { select: { name: true } }
        }
      }
    },
    orderBy: { created_at: "desc" },
  });
};

// updateOrderStatusService: Logic to transition an order status; admin can cancel any active order
export const updateOrderStatusService = async (orderId: string, status: string, expectedDeliveryDate?: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const FINAL_STATUSES = ["ORDER_DELIVERED", "ORDER_CANCELLED"];

  if (FINAL_STATUSES.includes(order.status as string)) {
    throw new Error(`Cannot update a ${order.status.replace("ORDER_", "").toLowerCase()} order.`);
  }

  if (status === "ORDER_CANCELLED") {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: "ORDER_CANCELLED" as any, updated_at: new Date() },
      include: {
        client: { select: { email: true, business_name: true } },
        variant: { select: { variant_name: true, product: { select: { name: true } } } },
      },
    });
    sendOrderStatusUpdate({
      to: updated.client.email,
      businessName: updated.client.business_name,
      orderId,
      productName: updated.variant.product.name,
      variantName: updated.variant.variant_name,
      newStatus: "ORDER_CANCELLED",
    }).catch((err) => console.error(`[Email] Order cancel notification failed for ${orderId}:`, err));
    return updated;
  }

  const allowedNextStatus = ORDER_STATUS_FLOW[order.status];
  if (allowedNextStatus !== status) {
    throw new Error(
      `Invalid status transition. Current status is ${order.status}. Allowed next status is ${allowedNextStatus ?? "none (order is complete)"}.`
    );
  }

  const updateData: any = { status: status as any, updated_at: new Date() };
  if (expectedDeliveryDate) {
    updateData.expected_delivery_date = new Date(expectedDeliveryDate);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: {
      client: { select: { email: true, business_name: true } },
      variant: { select: { variant_name: true, product: { select: { name: true } } } },
    },
  });
  sendOrderStatusUpdate({
    to: updated.client.email,
    businessName: updated.client.business_name,
    orderId,
    productName: updated.variant.product.name,
    variantName: updated.variant.variant_name,
    newStatus: status,
    expectedDeliveryDate: updated.expected_delivery_date,
  }).catch((err) => console.error(`[Email] Order status notification failed for ${orderId}:`, err));
  return updated;
};

// setOrderDeliveryDateService: Admin sets or updates the expected delivery date without changing status
export const setOrderDeliveryDateService = async (orderId: string, expectedDeliveryDate: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  return await prisma.order.update({
    where: { id: orderId },
    data: { expected_delivery_date: new Date(expectedDeliveryDate), updated_at: new Date() },
  });
};
