import prisma from "../../connect";
import { getVariantPricingCombination, calculateOrderAmount, normalizeSelectedOptions } from "../catalog/product-pricing.service";
import { sendOrderPlaced, sendOrderStatusUpdate } from "../../utils/email";

// ORDER_PLACED → ORDER_PROCESSING → ORDER_PREPARED → ORDER_DISPATCHED → ORDER_DELIVERED
const FINAL_STATUSES = ["ORDER_DELIVERED", "ORDER_CANCELLED"];
const CANCELLABLE_PENDING_STATES = new Set(["ORDER_PLACED"]);
const ACCEPTABLE_STATES = new Set(["ORDER_PLACED"]);
const COMPLETABLE_STATES = new Set(["ORDER_PROCESSING", "ORDER_PREPARED", "ORDER_DISPATCHED"]);

const getLifecycleStatus = (status: string): "pending" | "accepted" | "cancelled" | "completed" => {
  if (status === "ORDER_PLACED") return "pending";
  if (status === "ORDER_CANCELLED") return "cancelled";
  if (status === "ORDER_DELIVERED") return "completed";
  return "accepted";
};

// Lifecycle now requires explicit admin acceptance.
const AUTO_PROCESSING_DELAY_MS = 0;

async function autoAdvanceToProcessing(_orderId: string): Promise<void> {
  return;
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

    // Write initial status history row
    await tx.orderStatusHistory.create({
      data: { order_id: order.id, status: "ORDER_PLACED", changed_by: "client" },
    });

    return order;
  });

  // Schedule automatic transition ORDER_PLACED → ORDER_PROCESSING after the delay
  // setTimeout intentionally removed: lifecycle requires explicit admin acceptance.

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
      statusHistory: {
        orderBy: { changed_at: "asc" },
      },
    },
  });
};

// getClientOrdersService: Lists all orders placed by a specific client
export const getClientOrdersService = async (userId: string) => {
  const orders = await prisma.order.findMany({
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

  return orders.map((order) => ({
    ...order,
    lifecycle_status: getLifecycleStatus(String(order.status)),
    can_client_cancel: CANCELLABLE_PENDING_STATES.has(String(order.status)),
  }));
};

// getAllOrdersService: Provides an administrative overview of every order in the system
export const getAllOrdersService = async () => {
  const orders = await prisma.order.findMany({
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

  return orders.map((order) => ({
    ...order,
    lifecycle_status: getLifecycleStatus(String(order.status)),
    allowed_admin_actions: {
      accept: ACCEPTABLE_STATES.has(String(order.status)),
      cancel: CANCELLABLE_PENDING_STATES.has(String(order.status)),
      complete: COMPLETABLE_STATES.has(String(order.status)),
    },
  }));
};

const includeWithContext = {
  client: { select: { email: true, business_name: true } },
  variant: { select: { variant_name: true, product: { select: { name: true } } } },
} as const;

const refundOrderToWallet = async (
  tx: any,
  order: { id: string; user_id: string; payment_status: string; walletTransactionId: string | null; final_amount: any }
) => {
  if (order.payment_status !== "PAID" || !order.walletTransactionId) return;

  const existingRefund = await tx.walletTransaction.findFirst({
    where: { source: "REFUND", sourceId: order.id, clientId: order.user_id },
    select: { id: true },
  });
  if (existingRefund) return;

  const wallet = await tx.walletAccount.findUnique({ where: { clientId: order.user_id } });
  if (!wallet) return;

  const refundAmount = Number(order.final_amount);
  const balanceBefore = Number(wallet.availableBalance);
  const balanceAfter = balanceBefore + refundAmount;

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      clientId: order.user_id,
      type: "CREDIT",
      source: "REFUND",
      sourceId: order.id,
      amount: refundAmount,
      currency: wallet.currency,
      balanceBefore,
      balanceAfter,
      description: `Refund for cancelled order ${order.id}`,
    },
  });

  await tx.walletAccount.update({
    where: { id: wallet.id },
    data: { availableBalance: balanceAfter },
  });

  await tx.order.update({
    where: { id: order.id },
    data: { payment_status: "REFUNDED" },
  });
};

export const updateOrderStatusService = async (
  orderId: string,
  status: string,
  expectedDeliveryDate?: string,
  actor: "admin" | "client" = "admin"
) => {
  const changedBy = actor === "admin" ? "admin" : "client";

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: includeWithContext,
    });

    if (!order) throw new Error("Order not found");

    if (FINAL_STATUSES.includes(String(order.status))) {
      if (String(order.status) === status) {
        return { order, noOp: true, message: "Action already completed." };
      }
      throw new Error(`Cannot update a ${String(order.status).replace("ORDER_", "").toLowerCase()} order.`);
    }

    if (actor === "client" && status !== "ORDER_CANCELLED") {
      throw new Error("Client can only cancel pending orders.");
    }

    if (status === "ORDER_CANCELLED") {
      if (!CANCELLABLE_PENDING_STATES.has(String(order.status))) {
        throw new Error("Cancel is allowed only if the order is pending.");
      }
      const cancelled = await tx.order.update({
        where: { id: order.id },
        data: { status: "ORDER_CANCELLED", updated_at: new Date() },
        include: includeWithContext,
      });
      await tx.orderStatusHistory.create({
        data: { order_id: order.id, status: "ORDER_CANCELLED", changed_by: changedBy },
      });
      await refundOrderToWallet(tx, order);
      return { order: cancelled, noOp: false, message: "Order cancelled." };
    }

    if (status === "ORDER_PROCESSING") {
      if (!ACCEPTABLE_STATES.has(String(order.status))) {
        if (String(order.status) === "ORDER_PROCESSING") {
          return { order, noOp: true, message: "Order already accepted." };
        }
        throw new Error("Accept is allowed only if order is pending.");
      }
    } else if (status === "ORDER_DELIVERED") {
      if (!COMPLETABLE_STATES.has(String(order.status))) {
        if (String(order.status) === "ORDER_DELIVERED") {
          return { order, noOp: true, message: "Order already completed." };
        }
        throw new Error("Complete is allowed only for accepted orders.");
      }
    } else {
      throw new Error("Unsupported status transition.");
    }

    const updateData: any = { status, updated_at: new Date() };
    if (expectedDeliveryDate) {
      updateData.expected_delivery_date = new Date(expectedDeliveryDate);
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: updateData,
      include: includeWithContext,
    });

    await tx.orderStatusHistory.create({
      data: { order_id: order.id, status, changed_by: changedBy },
    });

    return { order: updated, noOp: false, message: "Order status updated." };
  });

  sendOrderStatusUpdate({
    to: result.order.client.email,
    businessName: result.order.client.business_name,
    orderId,
    productName: result.order.variant.product.name,
    variantName: result.order.variant.variant_name,
    newStatus: result.order.status,
    expectedDeliveryDate: result.order.expected_delivery_date,
  }).catch((err) => console.error(`[Email] Order status notification failed for ${orderId}:`, err));

  return result;
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
