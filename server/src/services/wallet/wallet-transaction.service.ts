import prisma from "../../connect";
import { getOrCreateWalletService } from "./wallet-account.service";

// getClientTransactionsService: Paginated retrieval of the authenticated client's financial transaction history
export const getClientTransactionsService = async (params: {
  clientId: string;
  type?: string;
  source?: string;
  page: number;
  limit: number;
}) => {
  const where: any = { clientId: params.clientId };
  if (params.type) where.type = params.type;
  if (params.source) where.source = params.source;

  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    items: items.map((i) => ({
      transactionId: i.id,
      type: i.type,
      source: i.source,
      sourceId: i.sourceId,
      amount: Number(i.amount),
      currency: i.currency,
      balanceBefore: Number(i.balanceBefore),
      balanceAfter: Number(i.balanceAfter),
      description: i.description,
      createdAt: i.createdAt,
    })),
    pagination: {
      page: params.page,
      limit: params.limit,
      totalItems: total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
};

// getAdminTransactionsService: Comprehensive paginated audit trail of all transactions across the entire system
export const getAdminTransactionsService = async (params: {
  clientId?: string;
  type?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}) => {
  const where: any = {};
  if (params.clientId) where.clientId = params.clientId;
  if (params.type) where.type = params.type;
  if (params.source) where.source = params.source;
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
  }

  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      include: {
        client: { select: { id: true, business_name: true } },
      },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    items: items.map((i) => ({
      transactionId: i.id,
      client: i.client ? { id: i.client.id, name: i.client.business_name } : null,
      type: i.type,
      source: i.source,
      sourceId: i.sourceId,
      amount: Number(i.amount),
      currency: i.currency,
      balanceBefore: Number(i.balanceBefore),
      balanceAfter: Number(i.balanceAfter),
      description: i.description,
      createdAt: i.createdAt,
    })),
    pagination: {
      page: params.page,
      limit: params.limit,
      totalItems: total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
};

// deductForOrderService: High-integrity atomic transaction for deducting wallet funds to pay for an order
export const deductForOrderService = async (orderId: string, clientId: string) => {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch order
    const order = await tx.order.findUnique({ 
      where: { id: orderId },
      include: { variant: { include: { product: true } } }
    });
    if (!order) throw new Error("Order not found");
    if (order.user_id !== clientId) throw new Error("Order does not belong to you");
    if (order.payment_status === "PAID" || order.walletTransactionId) throw new Error("Order already paid");
    if (String(order.status) !== "ORDER_PLACED") {
      throw new Error("Wallet payment is only allowed while order is pending.");
    }
    
    const orderAmount = Number(order.final_amount);

    // 2. Get wallet with lock
    const wallet = await tx.walletAccount.findUnique({
      where: { clientId },
    });
    if (!wallet) throw new Error("Wallet not found. Please top up first.");

    const currentBalance = Number(wallet.availableBalance);
    if (currentBalance < orderAmount) {
      throw new Error(`Insufficient wallet balance. Available: NPR ${currentBalance}, Required: NPR ${orderAmount}`);
    }

    const newBalance = currentBalance - orderAmount;

    // 3. Create debit transaction
    const txn = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        clientId,
        type: "DEBIT",
        source: "ORDER",
        sourceId: orderId,
        amount: orderAmount,
        currency: wallet.currency,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `Payment for order: ${order.variant.product.name} (${order.variant.variant_name})`,
      },
    });

    // 4. Update wallet balance
    await tx.walletAccount.update({
      where: { id: wallet.id },
      data: { availableBalance: newBalance },
    });

    // 5. Update order
    await tx.order.update({
      where: { id: orderId },
      data: {
        walletTransactionId: txn.id,
        payment_status: "PAID",
      },
    });

    // 6. Create notification
    await tx.notification.create({
      data: {
        recipientRole: "CLIENT",
        recipientId: clientId,
        clientId,
        type: "wallet_debited_for_order",
        title: "Wallet payment applied",
        message: `NPR ${orderAmount} deducted from wallet for ${order.variant.product.name}`,
        referenceId: orderId,
      },
    });

    return {
      orderId,
      walletTransactionId: txn.id,
      paymentStatus: "PAID",
      deductedAmount: orderAmount,
      newWalletBalance: newBalance,
    };
  });
};
