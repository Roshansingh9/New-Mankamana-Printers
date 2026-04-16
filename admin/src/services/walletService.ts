export type WalletTopupStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface WalletTopupClient {
  id: string;
  name: string;
  phone?: string | null;
}

export interface WalletTopupListItemApi {
  requestId: string;
  client: WalletTopupClient | null;
  submittedAmount: number;
  approvedAmount?: number | null;
  paymentMethod: string;
  status: WalletTopupStatus;
  mismatchFlag?: boolean;
  submittedAt: string;
}

export interface WalletTopupDetailApi {
  requestId: string;
  client: WalletTopupClient | null;
  submittedAmount: number;
  approvedAmount?: number | null;
  paymentMethod: string;
  transferReference?: string | null;
  note?: string | null;
  proofFileUrl?: string | null;
  status: WalletTopupStatus;
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
}

export interface WalletTopupListResponseApi {
  items: WalletTopupListItemApi[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface WalletTransactionApi {
  transactionId: string;
  client: { id: string; name: string } | null;
  type: string;
  source: string;
  sourceId?: string | null;
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description?: string | null;
  createdAt: string;
}

export interface WalletTransactionResponseApi {
  items: WalletTransactionApi[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface WalletNotificationApi {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  referenceId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface WalletNotificationResponseApi {
  items: WalletNotificationApi[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface WalletClientSummaryApi {
  client: { id: string; name: string; phone?: string | null };
  currency: string;
  availableBalance: number;
  totalCredits: number;
  totalDebits: number;
}

import { cachedJsonFetch, invalidateCacheKey } from "@/lib/requestCache";

const safeJson = async (response: Response) => {
  const raw = await response.text();
  if (!raw || raw.trim().length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
};

const TOPUP_REQUESTS_CACHE_KEY = "admin-wallet-topup-requests";
const TRANSACTIONS_CACHE_KEY = "admin-wallet-transactions";
const PAYMENT_DETAILS_CACHE_KEY = "admin-wallet-payment-details";

export const invalidateWalletCache = () => {
  invalidateCacheKey(TOPUP_REQUESTS_CACHE_KEY);
  invalidateCacheKey(TRANSACTIONS_CACHE_KEY);
};

export const fetchAdminTopupRequests = async (params?: {
  status?: string;
  clientId?: string;
  paymentMethod?: string;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.clientId) query.set("clientId", params.clientId);
  if (params?.paymentMethod) query.set("paymentMethod", params.paymentMethod);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const url = `/api/admin/wallet/topup-requests${query.toString() ? `?${query}` : ""}`;
  const cacheKey = query.toString() ? `${TOPUP_REQUESTS_CACHE_KEY}:${query}` : TOPUP_REQUESTS_CACHE_KEY;

  const data = await cachedJsonFetch<any>(cacheKey, url, 15_000);
  if (!data?.success) throw new Error(data?.message || "Failed to load top-up requests.");
  return data as { success: boolean; data: WalletTopupListResponseApi };
};

export const fetchAdminTopupRequestById = async (requestId: string) => {
  const response = await fetch(`/api/admin/wallet/topup-requests/${requestId}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to load top-up request.");
  }

  return data as { success: boolean; data: WalletTopupDetailApi };
};

export const approveAdminTopupRequest = async (params: {
  requestId: string;
  approvedAmount: number;
  note?: string;
}) => {
  const response = await fetch(
    `/api/admin/wallet/topup-requests/${params.requestId}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        approvedAmount: params.approvedAmount,
        note: params.note,
      }),
    }
  );

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to approve top-up request.");
  }

  return data as {
    success: boolean;
    message: string;
    data?: {
      requestId: string;
      status: string;
      submittedAmount: number;
      approvedAmount: number;
      walletTransactionId: string;
      newWalletBalance: number;
      approvedAt: string;
    };
  };
};

export const rejectAdminTopupRequest = async (params: {
  requestId: string;
  reason: string;
  reasonCode?: string;
}) => {
  const response = await fetch(
    `/api/admin/wallet/topup-requests/${params.requestId}/reject`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: params.reason,
        reasonCode: params.reasonCode,
      }),
    }
  );

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to reject top-up request.");
  }

  return data as {
    success: boolean;
    message: string;
    data?: { requestId: string; status: string; reason: string; reviewedAt: string };
  };
};

export const adjustAdminTopupRequest = async (params: {
  requestId: string;
  approvedAmount: number;
  reason: string;
}) => {
  const response = await fetch(`/api/admin/wallet/topup-requests/${params.requestId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      approvedAmount: params.approvedAmount,
      reason: params.reason,
    }),
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to adjust top-up request.");
  }

  return data as {
    success: boolean;
    message: string;
    data?: {
      requestId: string;
      adjustedApprovedAmount: number;
      previousApprovedAmount: number;
      delta: number;
      walletTransactionId: string;
      newWalletBalance: number;
      reviewedAt: string;
    };
  };
};

export const fetchAdminWalletTransactions = async (params?: {
  clientId?: string;
  type?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.clientId) query.set("clientId", params.clientId);
  if (params?.type) query.set("type", params.type);
  if (params?.source) query.set("source", params.source);
  if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params?.dateTo) query.set("dateTo", params.dateTo);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const url = `/api/admin/wallet/transactions${query.toString() ? `?${query}` : ""}`;
  const cacheKey = query.toString() ? `${TRANSACTIONS_CACHE_KEY}:${query}` : TRANSACTIONS_CACHE_KEY;

  const data = await cachedJsonFetch<any>(cacheKey, url, 30_000);
  if (!data?.success) throw new Error(data?.message || "Failed to load wallet transactions.");
  return data as { success: boolean; data: WalletTransactionResponseApi };
};

export interface AdminPaymentDetailsApi {
  companyName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string | null;
  paymentId?: string | null;
  qrImageUrl?: string | null;
  note?: string | null;
}

export const fetchAdminPaymentDetails = async (): Promise<AdminPaymentDetailsApi | null> => {
  const data = await cachedJsonFetch<any>(PAYMENT_DETAILS_CACHE_KEY, "/api/admin/wallet/payment-details", 60_000);
  if (!data?.success) return null;
  return (data as { success: boolean; data: AdminPaymentDetailsApi }).data ?? null;
};

export const invalidatePaymentDetailsCache = () => invalidateCacheKey(PAYMENT_DETAILS_CACHE_KEY);

export const createAdminPaymentDetails = async (payload: {
  companyName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
  paymentId?: string;
  qrFile?: File | null;
  note?: string;
  isActive?: boolean;
}) => {
  const { qrFile, ...rest } = payload;

  if (qrFile) {
    // Upload QR as multipart so the backend can store the file
    const formData = new FormData();
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, String(v));
    });
    formData.append("qrImage", qrFile);

    const response = await fetch(`/api/admin/wallet/payment-details`, {
      method: "POST",
      body: formData,
    });
    const data = await safeJson(response);
    if (!response.ok) throw new Error(data?.message || "Failed to save payment details.");
    return data as { success: boolean; message: string; data?: unknown };
  }

  // No file — send JSON
  const response = await fetch(`/api/admin/wallet/payment-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rest),
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to save payment details.");
  }

  return data as { success: boolean; message: string; data?: unknown };
};

export const fetchAdminWalletNotifications = async (params?: {
  isRead?: boolean;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.isRead !== undefined) query.set("isRead", String(params.isRead));
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const response = await fetch(
    `/api/admin/wallet/notifications${query.toString() ? `?${query}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to load notifications.");
  }

  return data as { success: boolean; data: WalletNotificationResponseApi };
};

export const markAdminWalletNotificationRead = async (notificationId: string) => {
  const response = await fetch(
    `/api/admin/wallet/notifications/${notificationId}/read`,
    {
      method: "PATCH",
    }
  );

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to mark notification as read.");
  }

  return data as { success: boolean; message: string };
};

export const fetchAdminClientWalletSummary = async (clientId: string) => {
  const response = await fetch(`/api/admin/wallet/clients/${clientId}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to load client wallet summary.");
  }

  return data as { success: boolean; data: WalletClientSummaryApi };
};
