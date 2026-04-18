"use client";

import { useState, useEffect } from "react";
import { cachedJsonFetch, invalidateCacheKey } from "@/lib/requestCache";

const ORDERS_CACHE_KEY = "admin-orders-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Package, Clock, CheckCircle2, Printer, Truck,
  RefreshCw, Calendar, XCircle, ChevronRight, AlertTriangle,
  Eye, FileText, X, Wallet,
} from "lucide-react";

type OrderStatus =
  | "ORDER_PLACED" | "ORDER_PROCESSING" | "ORDER_PREPARED"
  | "ORDER_DISPATCHED" | "ORDER_DELIVERED" | "ORDER_CANCELLED";

interface OrderConfig {
  group_label: string;
  selected_label: string;
}

interface StatusHistoryEntry {
  status: string;
  changed_at: string;
  changed_by?: string | null;
}

interface Order {
  id: string;
  status: OrderStatus;
  final_amount: number;
  total_amount: number;
  unit_price?: number;
  discount_amount?: number;
  quantity: number;
  payment_status: string;
  created_at: string;
  expected_delivery_date?: string | null;
  notes?: string | null;
  payment_proof_url?: string | null;
  payment_proof_file_name?: string | null;
  payment_proof_mime_type?: string | null;
  pricing_snapshot?: unknown;
  configurations?: OrderConfig[];
  client?: { business_name: string; phone_number?: string; client_code?: string; email?: string };
  variant?: { variant_name: string; product?: { name: string } };
  approvedDesign?: { designCode: string } | null;
  statusHistory?: StatusHistoryEntry[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  ORDER_PLACED: "Order Placed", ORDER_PROCESSING: "Processing",
  ORDER_PREPARED: "Prepared", ORDER_DISPATCHED: "Dispatched",
  ORDER_DELIVERED: "Delivered", ORDER_CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  ORDER_PLACED: "bg-slate-100 text-slate-700 border-slate-200",
  ORDER_PROCESSING: "bg-blue-100 text-blue-700 border-blue-200",
  ORDER_PREPARED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  ORDER_DISPATCHED: "bg-amber-100 text-amber-700 border-amber-200",
  ORDER_DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ORDER_CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

// Strict lifecycle: ORDER_PLACED → PROCESSING → PREPARED → DISPATCHED → DELIVERED
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  ORDER_PLACED:      "ORDER_PROCESSING",
  ORDER_PROCESSING:  "ORDER_PREPARED",
  ORDER_PREPARED:    "ORDER_DISPATCHED",
  ORDER_DISPATCHED:  "ORDER_DELIVERED",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  ORDER_PLACED:      "Accept Order",
  ORDER_PROCESSING:  "Mark Prepared",
  ORDER_PREPARED:    "Mark Dispatched",
  ORDER_DISPATCHED:  "Mark Delivered",
};

const STATUS_FLOW: OrderStatus[] = [
  "ORDER_PLACED", "ORDER_PROCESSING", "ORDER_PREPARED", "ORDER_DISPATCHED", "ORDER_DELIVERED",
];

const ALL_FILTER_TABS = [
  { label: "All", value: "All" },
  { label: "Placed", value: "ORDER_PLACED" },
  { label: "Processing", value: "ORDER_PROCESSING" },
  { label: "Prepared", value: "ORDER_PREPARED" },
  { label: "Dispatched", value: "ORDER_DISPATCHED" },
  { label: "Delivered", value: "ORDER_DELIVERED" },
  { label: "Cancelled", value: "ORDER_CANCELLED" },
];

// ── Order Detail Modal ───────────────────────────────────────────────────────
function OrderDetailModal({
  order,
  onClose,
  onAdvance,
  onCancel,
  onSetDate,
  advancing,
}: {
  order: Order;
  onClose: () => void;
  onAdvance: (order: Order) => void;
  onCancel: (order: Order) => void;
  onSetDate: (order: Order) => void;
  advancing: boolean;
}) {
  const isCancelled = order.status === "ORDER_CANCELLED";
  const isDelivered = order.status === "ORDER_DELIVERED";
  const isPending = order.status === "ORDER_PLACED";
  const isFinal = isCancelled || isDelivered;
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = NEXT_STATUS[order.status];
  const nextLabel = NEXT_LABEL[order.status];

  const proofProxyUrl = order.payment_proof_url
    ? `/api/admin/orders/${order.id}/payment-proof`
    : null;
  const isImage = order.payment_proof_mime_type?.startsWith("image/") ||
    order.payment_proof_url?.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
  const isPdfProof = order.payment_proof_mime_type === "application/pdf" ||
    order.payment_proof_url?.toLowerCase().includes(".pdf");
  const isPaidViaWallet = order.payment_status === "PAID";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl dark:bg-slate-900 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="font-mono text-xs font-semibold text-slate-400">#{order.id}</p>
            <h2 className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
              {order.variant?.product?.name ?? "—"} — {order.variant?.variant_name ?? ""}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {order.client?.business_name} · {order.client?.phone_number}
            </p>
          </div>
          <button type="button" title="Close" aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Progress bar */}
          {!isCancelled && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Order Progress</p>
              <div className="flex items-start justify-between relative">
                <div className="absolute top-3 left-4 right-4 h-0.5 bg-slate-200 dark:bg-slate-700" />
                <div
                  className="absolute top-3 left-4 h-0.5 bg-blue-600 transition-all"
                  style={{ width: `calc(${(Math.max(currentIdx, 0) / (STATUS_FLOW.length - 1)) * 100}% - 2rem)` }}
                />
                {STATUS_FLOW.map((s, idx) => (
                  <div key={s} className="flex flex-col items-center gap-1 relative z-10">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                      idx < currentIdx ? "bg-blue-600 border-blue-600 text-white" :
                      idx === currentIdx ? "bg-white border-blue-600 text-blue-600 dark:bg-slate-900" :
                      "bg-white border-slate-300 text-slate-400 dark:bg-slate-900 dark:border-slate-700"
                    }`}>
                      {idx < currentIdx ? "✓" : idx + 1}
                    </div>
                    <span className={`text-[9px] font-semibold leading-tight text-center max-w-[50px] ${
                      idx <= currentIdx ? "text-blue-700 dark:text-blue-400" : "text-slate-400"
                    }`}>{STATUS_LABELS[s]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isCancelled && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-center gap-2 text-red-700 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-400">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">This order has been cancelled.</span>
            </div>
          )}

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2.5 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</p>
              <p className="text-sm font-semibold mt-0.5 text-slate-800 dark:text-slate-200">NPR {Number(order.final_amount).toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2.5 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity</p>
              <p className="text-sm font-semibold mt-0.5 text-slate-800 dark:text-slate-200">{order.quantity.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2.5 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment</p>
              {isPaidViaWallet ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-semibold text-emerald-600">Paid</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <Wallet className="h-2.5 w-2.5" /> Wallet
                  </span>
                </div>
              ) : (
                <p className={`text-sm font-semibold mt-0.5 ${
                  order.payment_status === "PROOF_SUBMITTED" ? "text-blue-600" :
                  order.payment_status === "CONFIRMED" ? "text-emerald-600" :
                  "text-slate-800 dark:text-slate-200"
                }`}>{order.payment_status.replace(/_/g, " ")}</p>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2.5 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Placed</p>
              <p className="text-xs font-semibold mt-0.5 text-slate-800 dark:text-slate-200">{new Date(order.created_at).toLocaleString("en-NP", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>

          {/* Delivery date */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. Delivery</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {order.expected_delivery_date
                    ? new Date(order.expected_delivery_date).toLocaleDateString("en-NP", { day: "numeric", month: "long", year: "numeric" })
                    : "Not set"}
                </p>
              </div>
            </div>
            {!isCancelled && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onSetDate(order)}>
                {order.expected_delivery_date ? "Change" : "Set Date"}
              </Button>
            )}
          </div>

          {/* Configuration */}
          {order.configurations && order.configurations.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Configuration</p>
              <div className="rounded-xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                {order.configurations.map((c, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-sm text-slate-500 dark:text-slate-400">{c.group_label}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{c.selected_label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Design code */}
          {order.approvedDesign && (
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Approved Design</p>
              <p className="font-mono text-sm font-bold text-indigo-800 dark:text-indigo-300 mt-0.5">{order.approvedDesign.designCode}</p>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Client Remarks</p>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">{order.notes}</p>
            </div>
          )}

          {/* Status History Timeline */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Order Timeline</p>
              <div className="rounded-xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-800 overflow-hidden">
                {order.statusHistory.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{STATUS_LABELS[h.status as OrderStatus] || h.status.replace("ORDER_", "")}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(h.changed_at).toLocaleString("en-NP", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {h.changed_by ? ` · ${h.changed_by}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice (shown when order is accepted / ORDER_PROCESSING+) */}
          {!isCancelled && order.status !== "ORDER_PLACED" && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Invoice</p>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="bg-slate-800 dark:bg-slate-900 px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Invoice No.</p>
                    <p className="font-mono text-amber-400 font-bold text-sm">INV-{order.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Client</p>
                    <p className="text-xs font-semibold text-white">{order.client?.business_name}</p>
                    {order.client?.client_code && <p className="text-[10px] text-slate-400">{order.client.client_code}</p>}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-800 divide-y divide-slate-50 dark:divide-slate-700">
                  {(() => {
                    const snap = order.pricing_snapshot as any;
                    const unitPrice = order.unit_price ?? (snap?.unit_price ? Number(snap.unit_price) : 0);
                    const baseTotal = Number((unitPrice * order.quantity).toFixed(2));
                    const discount = Number(order.discount_amount ?? 0);
                    const designSurcharge = snap?.designExtraPrice ? Number(snap.designExtraPrice) * order.quantity : 0;
                    return (
                      <>
                        <div className="flex justify-between px-4 py-2.5 text-sm">
                          <span className="text-slate-500">{order.variant?.product?.name} — {order.variant?.variant_name} × {order.quantity.toLocaleString()}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">NPR {baseTotal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span>
                        </div>
                        {discount > 0 && (
                          <div className="flex justify-between px-4 py-2.5 text-sm">
                            <span className="text-emerald-600">Discount</span>
                            <span className="font-semibold text-emerald-600">− NPR {discount.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {designSurcharge > 0 && (
                          <div className="flex justify-between px-4 py-2.5 text-sm">
                            <span className="text-indigo-600">Design Surcharge{order.approvedDesign ? ` (${order.approvedDesign.designCode})` : ""}</span>
                            <span className="font-semibold text-indigo-600">+ NPR {designSurcharge.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700/50">
                          <span className="font-bold text-slate-900 dark:text-white">Total</span>
                          <span className="font-extrabold text-slate-900 dark:text-white">NPR {Number(order.final_amount).toLocaleString("en-NP", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 flex justify-between text-[10px] text-slate-400">
                  <span>Payment: {order.payment_status === "PAID" ? "Wallet" : "Bank Transfer"}</span>
                  <span>Placed: {new Date(order.created_at).toLocaleString("en-NP", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment proof */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Proof</p>
            {isPaidViaWallet && !order.payment_proof_url ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-900/40 px-4 py-3 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Paid via wallet — no payment proof required.</p>
              </div>
            ) : proofProxyUrl ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {isImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proofProxyUrl}
                    alt="Payment proof"
                    className="w-full max-h-56 object-contain bg-slate-50 dark:bg-slate-800"
                  />
                )}
                {isPdfProof && (
                  <div className="flex items-center justify-center h-24 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <FileText className="h-8 w-8 text-blue-400" />
                  </div>
                )}
                <a
                  href={proofProxyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-blue-600 font-medium truncate flex-1">
                    {order.payment_proof_file_name || "View payment proof"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                </a>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No payment proof submitted.</p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        {!isFinal && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
            {isPending ? (
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={() => onCancel(order)}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancel Order
              </Button>
            ) : null}
            <div className="flex-1" />
            {nextStatus && nextLabel && (
              <Button
                size="sm"
                disabled={advancing}
                onClick={() => onAdvance(order)}
                className="bg-[#0061FF] text-white hover:bg-[#0052d9] px-5"
              >
                {advancing ? "Updating…" : nextLabel} →
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cancel confirm modal ──────────────────────────────────────────────────────
function CancelModal({ order, onConfirm, onClose, loading }: {
  order: Order; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Cancel Order?</h2>
            <p className="text-xs text-slate-500 mt-0.5">#{order.id.slice(0, 8)} · {order.client?.business_name}</p>
          </div>
        </div>
        <p className="text-sm text-red-500 mb-5">This action cannot be undone.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Keep</Button>
          <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm} disabled={loading}>
            {loading ? "Cancelling…" : "Yes, Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delivery date modal ───────────────────────────────────────────────────────
function DeliveryDateModal({ order, onSave, onClose, loading }: {
  order: Order; onSave: (date: string) => void; onClose: () => void; loading: boolean;
}) {
  const existing = order.expected_delivery_date
    ? new Date(order.expected_delivery_date).toISOString().split("T")[0]
    : "";
  const [date, setDate] = useState(existing);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl">
        <h2 className="font-bold text-slate-900 dark:text-white mb-4">Set Delivery Date</h2>
        <input
          type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)}
          aria-label="Delivery date"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-5 outline-none focus:border-[#0061FF] focus:ring-1 focus:ring-[#0061FF] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button className="flex-1 bg-[#0061FF] text-white hover:bg-[#0052d9]" onClick={() => date && onSave(date)} disabled={!date || loading}>
            {loading ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: OrderStatus }) {
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {STATUS_FLOW.map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-colors ${
          i <= idx ? "w-5 bg-[#0061FF]" : "w-3 bg-slate-200 dark:bg-slate-700"
        }`} />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrderManagementPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  useEffect(() => {
    if (!detailOrder) return;
    fetch(`/api/admin/orders/${detailOrder.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setDetailOrder((prev) => prev ? { ...prev, statusHistory: d.data.statusHistory, configurations: d.data.configurations ?? prev.configurations, unit_price: d.data.unit_price ?? prev.unit_price } : null);
        }
      })
      .catch(() => {});
  }, [detailOrder?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dateTarget, setDateTarget] = useState<Order | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (forceRefresh) invalidateCacheKey(ORDERS_CACHE_KEY);
      const json = await cachedJsonFetch<any>(ORDERS_CACHE_KEY, "/api/admin/orders", 20_000);
      setOrders(Array.isArray(json) ? json : json.data ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const openDetail = async (order: Order) => {
    // Fetch full details (includes configurations + payment_proof_url)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, { cache: "no-store" });
      const json = await res.json();
      setDetailOrder(json.data ?? json ?? order);
    } catch {
      setDetailOrder(order);
    }
  };

  const handleAdvanceStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setAdvancingId(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update status");
      invalidateCacheKey(ORDERS_CACHE_KEY);
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: next } : o));
      setDetailOrder((prev) => prev?.id === order.id ? { ...prev, status: next } : prev);
      toast({ title: "Status Updated", description: `Order moved to ${STATUS_LABELS[next]}` });
      window.dispatchEvent(new Event("stats-updated"));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdvancingId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${cancelTarget.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ORDER_CANCELLED" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to cancel order");
      invalidateCacheKey(ORDERS_CACHE_KEY);
      const updated = { ...cancelTarget, status: "ORDER_CANCELLED" as OrderStatus };
      setOrders((prev) => prev.map((o) => o.id === cancelTarget.id ? updated : o));
      setDetailOrder((prev) => prev?.id === cancelTarget.id ? updated : prev);
      toast({ title: "Order Cancelled" });
      window.dispatchEvent(new Event("stats-updated"));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setCancelTarget(null);
    }
  };

  const handleSetDeliveryDate = async (date: string) => {
    if (!dateTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${dateTarget.id}/delivery-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_delivery_date: date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to set date");
      invalidateCacheKey(ORDERS_CACHE_KEY);
      const updated = { ...dateTarget, expected_delivery_date: date };
      setOrders((prev) => prev.map((o) => o.id === dateTarget.id ? updated : o));
      setDetailOrder((prev) => prev?.id === dateTarget.id ? updated : prev);
      toast({ title: "Delivery Date Set", description: new Date(date).toLocaleDateString() });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setDateTarget(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const clientName = order.client?.business_name ?? "";
    const productName = order.variant?.product?.name ?? order.variant?.variant_name ?? "";
    const matchesSearch =
      clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    active: orders.filter((o) => ["ORDER_PLACED","ORDER_PROCESSING"].includes(o.status)).length,
    prepared: orders.filter((o) => o.status === "ORDER_PREPARED").length,
    delivered: orders.filter((o) => o.status === "ORDER_DELIVERED").length,
  };

  return (
    <>
      {/* Modals */}
      {cancelTarget && (
        <CancelModal order={cancelTarget} onConfirm={handleCancel} onClose={() => setCancelTarget(null)} loading={actionLoading} />
      )}
      {dateTarget && (
        <DeliveryDateModal order={dateTarget} onSave={handleSetDeliveryDate} onClose={() => setDateTarget(null)} loading={actionLoading} />
      )}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onAdvance={handleAdvanceStatus}
          onCancel={(o) => { setDetailOrder(null); setCancelTarget(o); }}
          onSetDate={(o) => { setDateTarget(o); }}
          advancing={advancingId === detailOrder.id}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0061FF]">Fulfillment</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Order Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Click any order to view details, payment proof, and manage status.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Orders", value: stats.total, icon: Package, color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
            { label: "In Production", value: stats.active, icon: Printer, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" },
            { label: "Ready / Prepared", value: stats.prepared, icon: Truck, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400" },
            { label: "Completed", value: stats.delivered, icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                    <h3 className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
                  </div>
                  <div className={`rounded-full p-3 ${color}`}><Icon className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Orders table */}
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 pb-0 dark:border-slate-800">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Orders</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search orders..."
                      className="h-9 w-48 rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-[#0061FF] focus:ring-1 focus:ring-[#0061FF] dark:border-slate-700 dark:bg-slate-900 dark:text-white md:w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline" size="icon" onClick={() => fetchOrders(true)} title="Refresh" aria-label="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-3">
                {ALL_FILTER_TABS.map((tab) => (
                  <button
                    type="button" key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      statusFilter === tab.value
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    {tab.label}
                    {tab.value !== "All" && (
                      <span className="ml-1.5 tabular-nums opacity-60">
                        {orders.filter((o) => o.status === tab.value).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
                {[1,2,3].map(i => (
                  <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
                    <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 rounded ml-auto" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Order</th>
                      <th className="px-5 py-3.5 font-semibold">Client</th>
                      <th className="px-5 py-3.5 font-semibold">Product</th>
                      <th className="px-5 py-3.5 font-semibold">Amount</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 font-semibold">Delivery</th>
                      <th className="px-5 py-3.5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No orders found.</td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isCancelled = order.status === "ORDER_CANCELLED";
                        const isDelivered = order.status === "ORDER_DELIVERED";
                        const isPending = order.status === "ORDER_PLACED";
                        const isFinal = isCancelled || isDelivered;
                        const nextStatus = NEXT_STATUS[order.status];
                        const nextLabel = NEXT_LABEL[order.status];

                        return (
                          <tr
                            key={order.id}
                            className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 cursor-pointer"
                            onClick={() => openDetail(order)}
                          >
                            <td className="px-5 py-4">
                              <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                                #{order.id.slice(0, 8)}
                              </p>
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="h-3 w-3" />
                                {new Date(order.created_at).toLocaleDateString()}
                              </div>
                              <div className="mt-1.5">
                                {isCancelled ? (
                                  <span className="text-[10px] text-red-500 font-medium">Cancelled</span>
                                ) : (
                                  <StatusPill status={order.status} />
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-medium text-slate-900 dark:text-white">{order.client?.business_name ?? "—"}</p>
                              <p className="text-[11px] text-slate-400">{order.client?.phone_number ?? ""}</p>
                            </td>

                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                              <p className="font-medium">{order.variant?.product?.name ?? "—"}</p>
                              <p className="text-[11px] text-slate-400">{order.variant?.variant_name} · Qty {order.quantity}</p>
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-semibold text-slate-900 dark:text-white">
                                NPR {Number(order.final_amount).toLocaleString()}
                              </p>
                              <p className={`text-[11px] font-medium ${
                                order.payment_status === "CONFIRMED" ? "text-emerald-600" :
                                order.payment_status === "PROOF_SUBMITTED" ? "text-blue-600" :
                                "text-slate-400"
                              }`}>
                                {order.payment_status.replace(/_/g, " ")}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                                {STATUS_LABELS[order.status]}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-xs text-slate-500">
                              {order.expected_delivery_date
                                ? new Date(order.expected_delivery_date).toLocaleDateString()
                                : <span className="text-slate-300">—</span>}
                            </td>

                            <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={(e) => { e.stopPropagation(); openDetail(order); }}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" /> View
                                </Button>
                                {!isFinal && nextStatus && nextLabel && (
                                  <Button
                                    size="sm"
                                    disabled={advancingId === order.id || actionLoading}
                                    onClick={(e) => { e.stopPropagation(); handleAdvanceStatus(order); }}
                                    className="h-7 px-2.5 text-xs bg-[#0061FF] text-white hover:bg-[#0052d9]"
                                  >
                                    {advancingId === order.id ? "…" : nextLabel}
                                  </Button>
                                )}
                                {isPending && (
                                  <Button
                                    size="sm" variant="ghost"
                                    disabled={actionLoading}
                                    className="h-7 w-7 p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                                    onClick={(e) => { e.stopPropagation(); setCancelTarget(order); }}
                                    title="Cancel order" aria-label="Cancel order"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && (
              <div className="px-5 py-3 text-right text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
