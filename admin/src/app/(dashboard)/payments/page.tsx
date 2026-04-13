"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  adjustAdminTopupRequest,
  approveAdminTopupRequest,
  createAdminPaymentDetails,
  fetchAdminClientWalletSummary,
  fetchAdminTopupRequestById,
  fetchAdminTopupRequests,
  fetchAdminWalletNotifications,
  fetchAdminWalletTransactions,
  markAdminWalletNotificationRead,
  rejectAdminTopupRequest,
  type WalletClientSummaryApi,
  type WalletNotificationApi,
  type WalletTopupDetailApi,
  type WalletTopupListItemApi,
  type WalletTransactionApi,
} from "@/services/walletService";
import {
  CheckCircle,
  ClipboardCheck,
  Receipt,
  Search,
  XCircle,
  Bell,
  Wallet,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "PENDING",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};
const STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW:
    "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300",
  PENDING:
    "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300",
  APPROVED:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300",
  REJECTED:
    "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-300",
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split("T")[0];
};

const formatCurrency = (amount?: number | null, currency = "NPR") => {
  if (amount === null || amount === undefined) return "-";
  return `${currency} ${amount.toLocaleString()}`;
};

const formatPaymentMethod = (method?: string | null) => {
  if (!method) return "-";
  if (method === "BANK_TRANSFER") return "Bank Transfer";
  return method;
};

export default function PaymentsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [topupRequests, setTopupRequests] = useState<WalletTopupListItemApi[]>(
    []
  );
  const [transactions, setTransactions] = useState<WalletTransactionApi[]>([]);
  const [notifications, setNotifications] = useState<WalletNotificationApi[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTopup, setSelectedTopup] =
    useState<WalletTopupDetailApi | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonCode, setRejectReasonCode] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [decisionLoading, setDecisionLoading] = useState<"approve" | "reject" | "adjust" | null>(null);

  const [paymentForm, setPaymentForm] = useState({
    companyName: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    branch: "",
    paymentId: "",
    note: "",
  });
  const [qrFile, setQrFile] = useState<File | null>(null);

  const [clientLookupId, setClientLookupId] = useState("");
  const [clientSummary, setClientSummary] =
    useState<WalletClientSummaryApi | null>(null);
  const [clientSummaryLoading, setClientSummaryLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [topupsResponse, transactionsResponse, notificationsResponse] =
        await Promise.all([
          fetchAdminTopupRequests({ page: 1, limit: 50 }),
          fetchAdminWalletTransactions({ page: 1, limit: 50 }),
          fetchAdminWalletNotifications({ page: 1, limit: 20 }),
        ]);

      setTopupRequests(topupsResponse.data.items || []);
      setTransactions(transactionsResponse.data.items || []);
      setNotifications(notificationsResponse.data.items || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load wallet data."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredTopups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return topupRequests;
    return topupRequests.filter((topup) =>
      [topup.client?.name, topup.client?.id, topup.requestId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [searchTerm, topupRequests]);

  const pendingCount = topupRequests.filter(
    (t) => t.status === "PENDING_REVIEW"
  ).length;
  const approvedCount = topupRequests.filter(
    (t) => t.status === "APPROVED"
  ).length;
  const rejectedCount = topupRequests.filter(
    (t) => t.status === "REJECTED"
  ).length;

  const openDetail = async (request: WalletTopupListItemApi) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setSelectedTopup(null);
    try {
      const response = await fetchAdminTopupRequestById(request.requestId);
      setSelectedTopup(response.data);
      setApproveAmount(
        response.data.approvedAmount?.toString() ??
          response.data.submittedAmount.toString()
      );
      setApproveNote("");
      setAdjustReason("");
    } catch (err) {
      toast({
        title: "Unable to load request",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
      setIsDetailOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTopup) return;
    const amount = Number(approveAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a valid approved amount.",
        variant: "destructive",
      });
      return;
    }

    setDecisionLoading("approve");
    try {
      await approveAdminTopupRequest({
        requestId: selectedTopup.requestId,
        approvedAmount: amount,
        note: approveNote.trim() || undefined,
      });
      toast({
        title: "Top-up approved",
        description: "Wallet credited successfully.",
        variant: "success",
      });
      await loadData();
      const refreshed = await fetchAdminTopupRequestById(
        selectedTopup.requestId
      );
      setSelectedTopup(refreshed.data);
    } catch (err) {
      toast({
        title: "Approval failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setDecisionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedTopup) return;
    if (!rejectReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Add a short reason before rejecting the request.",
        variant: "destructive",
      });
      return;
    }

    setDecisionLoading("reject");
    try {
      await rejectAdminTopupRequest({
        requestId: selectedTopup.requestId,
        reason: rejectReason.trim(),
        reasonCode: rejectReasonCode.trim() || undefined,
      });
      toast({
        title: "Top-up rejected",
        description: "Client has been notified.",
      });
      setIsRejectOpen(false);
      setRejectReason("");
      setRejectReasonCode("");
      await loadData();
      const refreshed = await fetchAdminTopupRequestById(
        selectedTopup.requestId
      );
      setSelectedTopup(refreshed.data);
    } catch (err) {
      toast({
        title: "Rejection failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setDecisionLoading(null);
    }
  };

  const handleAdjustApproved = async () => {
    if (!selectedTopup || selectedTopup.status !== "APPROVED") return;
    const amount = Number(approveAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a valid adjusted amount.",
        variant: "destructive",
      });
      return;
    }
    const submitted = Number(selectedTopup.submittedAmount);
    if (amount !== submitted && !approveNote.trim()) {
      toast({
        title: "Approval note required",
        description: "Add a note when approved amount differs from submitted amount.",
        variant: "destructive",
      });
      return;
    }
    if (!adjustReason.trim()) {
      toast({
        title: "Reason required",
        description: "Provide a reason for this correction.",
        variant: "destructive",
      });
      return;
    }

    setDecisionLoading("adjust");
    try {
      await adjustAdminTopupRequest({
        requestId: selectedTopup.requestId,
        approvedAmount: amount,
        reason: adjustReason.trim(),
      });
      toast({
        title: "Top-up adjusted",
        description: "Wallet balance and ledger updated.",
        variant: "success",
      });
      await loadData();
      const refreshed = await fetchAdminTopupRequestById(selectedTopup.requestId);
      setSelectedTopup(refreshed.data);
      setAdjustReason("");
    } catch (err) {
      toast({
        title: "Adjustment failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setDecisionLoading(null);
    }
  };

  const handleSavePaymentDetails = async () => {
    try {
      await createAdminPaymentDetails({
        companyName: paymentForm.companyName,
        bankName: paymentForm.bankName,
        accountName: paymentForm.accountName,
        accountNumber: paymentForm.accountNumber,
        branch: paymentForm.branch || undefined,
        paymentId: paymentForm.paymentId || undefined,
        qrFile: qrFile || undefined,
        note: paymentForm.note || undefined,
        isActive: true,
      });
      toast({
        title: "Payment details saved",
        description: "Clients will see the updated details immediately.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const handleClientLookup = async () => {
    if (!clientLookupId.trim()) {
      toast({
        title: "Client ID required",
        description: "Enter a client ID to fetch wallet summary.",
        variant: "destructive",
      });
      return;
    }
    setClientSummaryLoading(true);
    try {
      const response = await fetchAdminClientWalletSummary(
        clientLookupId.trim()
      );
      setClientSummary(response.data);
    } catch (err) {
      toast({
        title: "Lookup failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setClientSummaryLoading(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await markAdminWalletNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((note) =>
          note.notificationId === notificationId
            ? { ...note, isRead: true }
            : note
        )
      );
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Wallet & Payment Requests
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Review wallet top-up submissions, verify payment proofs, and audit
            wallet transactions.
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => void loadData()}
          disabled={isLoading}
        >
          <ClipboardCheck className="h-4 w-4" />
          {isLoading ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Pending Requests",
            value: pendingCount,
            icon: ClipboardCheck,
            bg: "bg-amber-50 dark:bg-amber-900/20",
            color: "text-amber-600 dark:text-amber-300",
          },
          {
            label: "Approved",
            value: approvedCount,
            icon: CheckCircle,
            bg: "bg-emerald-50 dark:bg-emerald-900/20",
            color: "text-emerald-600 dark:text-emerald-300",
          },
          {
            label: "Rejected",
            value: rejectedCount,
            icon: XCircle,
            bg: "bg-red-50 dark:bg-red-900/20",
            color: "text-red-600 dark:text-red-300",
          },
          {
            label: "Transactions",
            value: transactions.length,
            icon: Receipt,
            bg: "bg-slate-100 dark:bg-slate-800/40",
            color: "text-slate-600 dark:text-slate-200",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {stat.value}
                  </h3>
                </div>
                <div className={`rounded-xl p-2.5 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input
              value={paymentForm.companyName}
              onChange={(event) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  companyName: event.target.value,
                }))
              }
              placeholder="New Mankamana Printers"
            />
          </div>
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input
              value={paymentForm.bankName}
              onChange={(event) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  bankName: event.target.value,
                }))
              }
              placeholder="Himalayan Bank"
            />
          </div>
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input
              value={paymentForm.accountName}
              onChange={(event) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  accountName: event.target.value,
                }))
              }
              placeholder="New Mankamana Printers"
            />
          </div>
          <div className="space-y-2">
            <Label>Account Number</Label>
            <Input
              value={paymentForm.accountNumber}
              onChange={(event) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  accountNumber: event.target.value,
                }))
              }
              placeholder="0012345678"
            />
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            <Input
              value={paymentForm.branch}
              onChange={(event) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  branch: event.target.value,
                }))
              }
              placeholder="Kathmandu"
            />
          </div>
          <div className="space-y-2">
            <Label>Payment ID</Label>
            <Input
              value={paymentForm.paymentId}
              onChange={(event) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  paymentId: event.target.value,
                }))
              }
              placeholder="company@upi"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>QR Image</Label>
            <label
              htmlFor="qr-file-input"
              className={`flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-sm ${qrFile ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-500"}`}
            >
              <input
                id="qr-file-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => setQrFile(e.target.files?.[0] || null)}
              />
              {qrFile ? `✓ ${qrFile.name} (click to change)` : "Click to upload QR image (PNG, JPG)"}
            </label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Input
              value={paymentForm.note}
              onChange={(event) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  note: event.target.value,
                }))
              }
              placeholder="Optional instructions for clients"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button className="gap-2" onClick={handleSavePaymentDetails}>
              Save Payment Details
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <CardTitle className="text-base font-semibold">
              Top-up Requests
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 pl-9"
                placeholder="Search by client, ID, request..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-800">
                <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                  {[
                    "Request ID",
                    "Client",
                    "Amount",
                    "Method",
                    "Submitted",
                    "Status",
                    "Actions",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                        i === 6 ? "text-right" : ""
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTopups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-6 text-center text-sm text-slate-500"
                    >
                      No top-up requests found.
                    </td>
                  </tr>
                ) : (
                  filteredTopups.map((request) => (
                    <tr
                      key={request.requestId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {request.requestId}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {request.client?.name || "Unknown client"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {request.client?.id || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(request.submittedAmount)}
                        {request.mismatchFlag ? (
                          <div className="mt-1 text-[10px] font-semibold text-amber-600">
                            Amount mismatch reviewed
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatPaymentMethod(request.paymentMethod)}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatDate(request.submittedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            STATUS_STYLES[request.status]
                          }`}
                        >
                          {STATUS_LABELS[request.status] ?? request.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isDetailLoading}
                          onClick={() => void openDetail(request)}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <CardTitle className="text-base font-semibold">
              Wallet Transactions
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input className="h-9 w-40" placeholder="Client ID" />
              <Input className="h-9 w-32" placeholder="Type" />
              <Input className="h-9 w-32" placeholder="Source" />
              <Input className="h-9 w-36" type="date" />
              <Input className="h-9 w-36" type="date" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-800">
                <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                  {[
                    "Txn ID",
                    "Client",
                    "Type",
                    "Source",
                    "Amount",
                    "Date",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-6 text-center text-sm text-slate-500"
                    >
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr
                      key={txn.transactionId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {txn.transactionId}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {txn.client?.name || "-"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {txn.client?.id || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{txn.type}</td>
                      <td className="px-5 py-4 text-slate-500">{txn.source}</td>
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(txn.amount, txn.currency)}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {formatDate(txn.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-semibold">
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {notifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">
                No notifications yet.
              </div>
            ) : (
              notifications.map((note) => (
                <div
                  key={note.notificationId}
                  className={`rounded-lg border p-4 ${
                    note.isRead
                      ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                      : "border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {note.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {note.message}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {formatDate(note.createdAt)}
                      </p>
                    </div>
                    {!note.isRead ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void handleMarkNotificationRead(note.notificationId)
                        }
                      >
                        Mark read
                      </Button>
                    ) : (
                      <Bell className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-semibold">
              Client Wallet Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                value={clientLookupId}
                onChange={(event) => setClientLookupId(event.target.value)}
                placeholder="CL-1051"
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => void handleClientLookup()}
              disabled={clientSummaryLoading}
            >
              <Wallet className="h-4 w-4" />
              {clientSummaryLoading ? "Fetching..." : "Fetch Wallet Summary"}
            </Button>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {clientSummary ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase text-slate-400">Client</p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {clientSummary.client.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {clientSummary.client.id}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Available Balance</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatCurrency(
                        clientSummary.availableBalance,
                        clientSummary.currency
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Total Credits</span>
                    <span>
                      {formatCurrency(
                        clientSummary.totalCredits,
                        clientSummary.currency
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Total Debits</span>
                    <span>
                      {formatCurrency(
                        clientSummary.totalDebits,
                        clientSummary.currency
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Enter a client ID to view wallet balances and totals.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Top-up Request Review</DialogTitle>
            <DialogDescription>
              Verify the proof against bank records before approving.
            </DialogDescription>
          </DialogHeader>
          {isDetailLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading request details...
            </div>
          ) : selectedTopup ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase text-slate-400">Client</p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {selectedTopup.client?.name || "Unknown client"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedTopup.client?.id || "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedTopup.client?.phone || ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Request</p>
                    <p className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {selectedTopup.requestId}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(selectedTopup.submittedAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Submitted</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(selectedTopup.submittedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-400">Method</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {formatPaymentMethod(selectedTopup.paymentMethod)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Ref: {selectedTopup.transferReference || "-"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs uppercase text-slate-400">
                      Client note
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {selectedTopup.note || "No additional note."}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Verification checklist
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li>Compare amount and reference with bank statement.</li>
                    <li>Ensure the payer name matches the client record.</li>
                    <li>
                      Confirm transfer date is within 24 hours of submission.
                    </li>
                  </ul>
                </div>
                {selectedTopup.rejectionReason ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                    Rejection Reason: {selectedTopup.rejectionReason}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                  {selectedTopup.proofFileUrl ? (
                    <img
                      src={selectedTopup.proofFileUrl}
                      alt="Payment proof"
                      className="h-56 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-sm text-slate-400">
                      Proof image not available
                    </div>
                  )}
                </div>
                {selectedTopup.proofFileUrl ? (
                  <a
                    href={selectedTopup.proofFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-[#0061FF] hover:underline"
                  >
                    Open full proof image
                  </a>
                ) : null}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      STATUS_STYLES[selectedTopup.status]
                    }`}
                  >
                    {STATUS_LABELS[selectedTopup.status] ?? selectedTopup.status}
                  </span>
                  {selectedTopup.reviewedAt ? (
                    <p className="text-xs text-slate-500">
                      Reviewed: {formatDate(selectedTopup.reviewedAt)}
                    </p>
                  ) : null}
                </div>

                {selectedTopup.status === "PENDING_REVIEW" ? (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="space-y-1.5">
                      <Label>Approved Amount</Label>
                      <Input
                        type="number"
                        min={0}
                        value={approveAmount}
                        onChange={(event) =>
                          setApproveAmount(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Approval Note (optional)</Label>
                      <Input
                        value={approveNote}
                        onChange={(event) => setApproveNote(event.target.value)}
                        placeholder="Verified with bank statement"
                      />
                    </div>
                  </div>
                ) : null}
                {selectedTopup.status === "APPROVED" ? (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="space-y-1.5">
                      <Label>Adjust Approved Amount</Label>
                      <Input
                        type="number"
                        min={0}
                        value={approveAmount}
                        onChange={(event) => setApproveAmount(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Adjustment Reason</Label>
                      <Input
                        value={adjustReason}
                        onChange={(event) => setAdjustReason(event.target.value)}
                        placeholder="Correction after proof re-check"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleAdjustApproved}
                      disabled={decisionLoading !== null}
                    >
                      {decisionLoading === "adjust" ? "Applying..." : "Apply Adjustment"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} disabled={decisionLoading !== null}>
              Close
            </Button>
            {selectedTopup?.status === "PENDING_REVIEW" ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={decisionLoading !== null}
                  onClick={() => setIsRejectOpen(true)}
                >
                  Reject
                </Button>
                <Button className="gap-2" onClick={handleApprove} disabled={decisionLoading !== null}>
                  <CheckCircle className="h-4 w-4" />
                  {decisionLoading === "approve" ? "Approving..." : "Approve"}
                </Button>
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Top-up Request</DialogTitle>
            <DialogDescription>
              A rejection reason is mandatory for the client record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Input
                placeholder="Proof mismatch or invalid reference"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason Code (optional)</Label>
              <Input
                placeholder="INVALID_PROOF"
                value={rejectReasonCode}
                onChange={(event) => setRejectReasonCode(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              disabled={decisionLoading !== null}
              onClick={() => {
                setIsRejectOpen(false);
                setRejectReason("");
                setRejectReasonCode("");
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={decisionLoading !== null}>
              {decisionLoading === "reject" ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
