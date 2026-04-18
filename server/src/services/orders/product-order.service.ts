import prisma from "../../connect";
import { getVariantPricingCombination, calculateOrderAmount, normalizeSelectedOptions } from "../catalog/product-pricing.service";
import { sendOrderPlaced, sendOrderStatusUpdate, sendOrderInvoice } from "../../utils/email";
import { withCache, invalidateCacheKey } from "../../utils/cache";

const ORDER_LIST_TTL_MS = 30_000; // 30 s — balances freshness vs DB load
const clientOrdersCacheKey = (userId: string) => `orders:client:${userId}`;
const ADMIN_ORDERS_CACHE_KEY = "orders:admin:all";

// serializeOrder: Converts Prisma Decimal fields to numbers so JSON serialization is always numeric,
// not the string representation that Prisma's Decimal.toJSON() produces.
// DB is the source of truth — every layer above must faithfully represent its types.
function serializeOrder<T extends {
  unit_price: unknown; total_amount: unknown; discount_value: unknown;
  discount_amount: unknown; final_amount: unknown;
}>(order: T): Omit<T, "unit_price" | "total_amount" | "discount_value" | "discount_amount" | "final_amount"> & {
  unit_price: number; total_amount: number; discount_value: number;
  discount_amount: number; final_amount: number;
} {
  return {
    ...order,
    unit_price: Number(order.unit_price),
    total_amount: Number(order.total_amount),
    discount_value: Number(order.discount_value),
    discount_amount: Number(order.discount_amount),
    final_amount: Number(order.final_amount),
  };
}

// ORDER_PLACED → ORDER_PROCESSING → ORDER_PREPARED → ORDER_DISPATCHED → ORDER_DELIVERED
const FINAL_STATUSES = ["ORDER_DELIVERED", "ORDER_CANCELLED"];
// Strict sequential chain: each status maps to the ONLY valid next status
const STATUS_CHAIN: Record<string, string> = {
  ORDER_PLACED:      "ORDER_PROCESSING",
  ORDER_PROCESSING:  "ORDER_PREPARED",
  ORDER_PREPARED:    "ORDER_DISPATCHED",
  ORDER_DISPATCHED:  "ORDER_DELIVERED",
};
const CANCELLABLE_PENDING_STATES = new Set(["ORDER_PLACED"]);

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
  useWallet?: boolean;
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  paymentProofMimeType?: string;
  paymentProofFileSize?: number;
  attachmentUrls?: string[];
}) => {
  const { userId, variantId, quantity, options, notes, designCode, useWallet,
    paymentProofUrl, paymentProofFileName, paymentProofMimeType, paymentProofFileSize, attachmentUrls } = data;
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

  // effectiveFinalAmount may increase if the approved design carries an extra price surcharge
  let effectiveFinalAmount = finalAmount;

  const pricingSnapshot: Record<string, unknown> = {
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

      // Add design extra price surcharge (per unit set by admin at approval)
      const designExtraPrice = Number(approvedDesign.extraPrice ?? 0);
      if (designExtraPrice > 0) {
        const extraTotal = Number((designExtraPrice * quantity).toFixed(2));
        effectiveFinalAmount = Number((effectiveFinalAmount + extraTotal).toFixed(2));
        pricingSnapshot.designExtraPrice = designExtraPrice;
        pricingSnapshot.final_total = effectiveFinalAmount;
      }
    }

    // Wallet pre-check: verify balance BEFORE creating the order to fail fast
    let walletSnapshot: { id: string; currency: string; balanceBefore: number } | null = null;
    if (useWallet) {
      const wallet = await tx.walletAccount.findUnique({
        where: { clientId: userId },
        select: { id: true, availableBalance: true, currency: true },
      });
      if (!wallet) throw new Error("Wallet not found. Please contact support.");
      const available = Number(wallet.availableBalance);
      if (available < effectiveFinalAmount) {
        throw new Error(
          `Insufficient wallet balance. Available: NPR ${available.toFixed(2)}, Required: NPR ${effectiveFinalAmount.toFixed(2)}.`
        );
      }
      walletSnapshot = { id: wallet.id, currency: wallet.currency, balanceBefore: available };
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
        final_amount: effectiveFinalAmount,
        notes: notes,
        designId: approvedDesignId,
        pricing_snapshot: pricingSnapshot as any,
        status: "ORDER_PLACED",
        payment_status: useWallet ? "PAID" : paymentProofUrl ? "PROOF_SUBMITTED" : "PENDING",
        payment_proof_url: paymentProofUrl || null,
        payment_proof_file_name: paymentProofFileName || null,
        payment_proof_mime_type: paymentProofMimeType || null,
        payment_proof_file_size: paymentProofFileSize || null,
        attachment_urls: attachmentUrls && attachmentUrls.length > 0 ? attachmentUrls : undefined,
      },
    });

    // Wallet deduction: atomically debit balance and link transaction to order
    if (useWallet && walletSnapshot) {
      const balanceBefore = walletSnapshot.balanceBefore;
      const balanceAfter = Number((balanceBefore - effectiveFinalAmount).toFixed(2));

      const walletTxn = await tx.walletTransaction.create({
        data: {
          walletId: walletSnapshot.id,
          clientId: userId,
          type: "DEBIT",
          source: "ORDER",
          sourceId: order.id,
          amount: effectiveFinalAmount,
          currency: walletSnapshot.currency,
          balanceBefore,
          balanceAfter,
          description: `Payment for order ${order.id}`,
        },
      });

      await tx.walletAccount.update({
        where: { id: walletSnapshot.id },
        data: { availableBalance: balanceAfter },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { walletTransactionId: walletTxn.id },
      });
    }

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
  }, { timeout: 15000 });

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

  // Invalidate caches so next list requests see the new order
  void invalidateClientOrdersCache(newOrder.user_id);
  void invalidateAdminOrdersCache();

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
// L1+L2 (in-process + Redis) cached for 30 s; invalidated on new order or status change.
export const getClientOrdersService = async (userId: string) => {
  return withCache(clientOrdersCacheKey(userId), ORDER_LIST_TTL_MS, async () => {
    const orders = await prisma.order.findMany({
      where: { user_id: userId },
      include: {
        approvedDesign: { select: { designCode: true } },
        variant: { select: { variant_name: true, product: { select: { name: true } } } },
      },
      orderBy: { created_at: "desc" },
    });
    return orders.map((order) => ({
      ...serializeOrder(order),
      lifecycle_status: getLifecycleStatus(String(order.status)),
      can_client_cancel: CANCELLABLE_PENDING_STATES.has(String(order.status)),
    }));
  });
};

export const invalidateClientOrdersCache = (userId: string) =>
  invalidateCacheKey(clientOrdersCacheKey(userId));

// getAllOrdersService: Provides an administrative overview of every order in the system
// L1+L2 (in-process + Redis) cached for 30 s; invalidated on any status change.
export const getAllOrdersService = async () => {
  return withCache(ADMIN_ORDERS_CACHE_KEY, ORDER_LIST_TTL_MS, async () => {
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

  return orders.map((order) => {
    const s = String(order.status);
    const isFinal = FINAL_STATUSES.includes(s);
    return {
      ...serializeOrder(order),
      lifecycle_status: getLifecycleStatus(s),
      allowed_admin_actions: {
        advance: !isFinal && s in STATUS_CHAIN,
        cancel: !isFinal,
        next_status: STATUS_CHAIN[s] ?? null,
      },
    };
  });
  }); // end withCache
};

export const invalidateAdminOrdersCache = () => invalidateCacheKey(ADMIN_ORDERS_CACHE_KEY);

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

    // Clients can only cancel; they cannot advance the status
    if (actor === "client" && status !== "ORDER_CANCELLED") {
      throw new Error("Clients can only cancel orders.");
    }

    if (status === "ORDER_CANCELLED") {
      // Client: only ORDER_PLACED can be cancelled
      if (actor === "client" && !CANCELLABLE_PENDING_STATES.has(String(order.status))) {
        throw new Error("You can only cancel an order before it has been accepted.");
      }
      // Admin: can cancel any non-final order
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

    // Enforce strict sequential chain for all forward transitions
    const expectedNext = STATUS_CHAIN[String(order.status)];
    if (!expectedNext) {
      throw new Error(`Cannot advance an order that is already ${String(order.status).replace("ORDER_", "").toLowerCase()}.`);
    }
    if (status !== expectedNext) {
      throw new Error(
        `Invalid transition: order is currently ${String(order.status).replace("ORDER_", "").toLowerCase()}, next step must be ${expectedNext.replace("ORDER_", "").toLowerCase()}.`
      );
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
  }, { timeout: 15000 });

  // For ORDER_PROCESSING transitions on wallet-paid orders, include wallet deduction summary
  const emailExtras: { walletDeducted?: number; walletBalanceAfter?: number } = {};
  if (String(result.order.status) === "ORDER_PROCESSING" && (result.order as any).payment_status === "PAID") {
    try {
      const walletTxn = await prisma.walletTransaction.findFirst({
        where: { source: "ORDER", sourceId: orderId, type: "DEBIT" },
        select: { amount: true, balanceAfter: true },
        orderBy: { createdAt: "desc" },
      });
      if (walletTxn) {
        emailExtras.walletDeducted = Number(walletTxn.amount);
        emailExtras.walletBalanceAfter = Number(walletTxn.balanceAfter);
      }
    } catch { /* non-critical — email still sends without wallet block */ }
  }

  sendOrderStatusUpdate({
    to: result.order.client.email,
    businessName: result.order.client.business_name,
    orderId,
    productName: result.order.variant.product.name,
    variantName: result.order.variant.variant_name,
    newStatus: result.order.status,
    expectedDeliveryDate: result.order.expected_delivery_date,
    ...emailExtras,
  }).catch((err) => console.error(`[Email] Order status notification failed for ${orderId}:`, err));

  // Send invoice email when order is accepted (ORDER_PROCESSING)
  if (String(result.order.status) === "ORDER_PROCESSING") {
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        quantity: true,
        unit_price: true,
        discount_amount: true,
        final_amount: true,
        notes: true,
        created_at: true,
        payment_status: true,
        pricing_snapshot: true,
        configurations: { select: { group_label: true, selected_label: true } },
        approvedDesign: { select: { designCode: true } },
        variant: { select: { variant_name: true, product: { select: { name: true } } } },
        client: { select: { email: true, business_name: true, phone_number: true, client_code: true } },
      },
    }).then((o) => {
      if (!o) return;
      const snap = o.pricing_snapshot as any;
      return sendOrderInvoice({
        to: o.client.email,
        businessName: o.client.business_name,
        clientCode: o.client.client_code || "",
        phone: o.client.phone_number,
        orderId: o.id,
        productName: o.variant.product.name,
        variantName: o.variant.variant_name,
        quantity: o.quantity,
        unitPrice: Number(o.unit_price),
        discountAmount: Number(o.discount_amount ?? 0),
        designSurcharge: snap?.designExtraPrice ? Number(snap.designExtraPrice) * o.quantity : 0,
        finalAmount: Number(o.final_amount),
        configurations: o.configurations,
        designCode: o.approvedDesign?.designCode,
        notes: o.notes,
        paymentMethod: o.payment_status === "PAID" ? "Wallet" : "Bank Transfer",
        acceptedAt: new Date(),
      });
    }).catch((err) => console.error(`[Email] Invoice send failed for ${orderId}:`, err));
  }

  // Invalidate list caches after any status change
  void invalidateClientOrdersCache(result.order.user_id);
  void invalidateAdminOrdersCache();

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
