"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/store/authStore";
import { fetchJsonCached, invalidateClientCache } from "@/utils/requestCache";
import { getStatusColor, getStatusLabel, formatDate, formatCurrency } from "@/utils/helpers";
import { notify } from "@/utils/notifications";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

const STATUS_FILTERS = [
    { label: "All", value: "ALL" },
    { label: "Placed", value: "ORDER_PLACED" },
    { label: "Processing", value: "ORDER_PROCESSING" },
    { label: "Prepared", value: "ORDER_PREPARED" },
    { label: "Dispatched", value: "ORDER_DISPATCHED" },
    { label: "Delivered", value: "ORDER_DELIVERED" },
    { label: "Cancelled", value: "ORDER_CANCELLED" },
];

const STATUS_FLOW = ["ORDER_PLACED", "ORDER_PROCESSING", "ORDER_PREPARED", "ORDER_DISPATCHED", "ORDER_DELIVERED"];

const STATUS_STEP_LABELS: Record<string, string> = {
    ORDER_PLACED: "Placed",
    ORDER_PROCESSING: "Processing",
    ORDER_PREPARED: "Prepared",
    ORDER_DISPATCHED: "Dispatched",
    ORDER_DELIVERED: "Delivered",
};

const STATUS_SVG: Record<string, React.ReactNode> = {
    ORDER_PLACED: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    ORDER_PROCESSING: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    ORDER_PREPARED: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    ORDER_DISPATCHED: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
    ORDER_DELIVERED: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
};

interface OrderConfig {
    group_label: string;
    selected_label: string;
}

interface StatusHistoryEntry {
    status: string;
    changed_at: string;
    changed_by?: string | null;
}

interface ApiOrder {
    id: string;
    quantity: number;
    unit_price: string | number;
    final_amount: string | number;
    total_amount: string | number;
    discount_amount?: string | number;
    status: string;
    payment_status: string;
    notes?: string;
    created_at: string;
    expected_delivery_date?: string | null;
    payment_proof_url?: string | null;
    payment_proof_file_name?: string | null;
    configurations?: OrderConfig[];
    variant: {
        variant_name: string;
        product: { name: string; image_url?: string | null };
    };
    approvedDesign?: { designCode: string } | null;
    statusHistory?: StatusHistoryEntry[];
}

function OrderProgressBar({ status }: { status: string }) {
    if (status === "ORDER_CANCELLED") {
        return (
            <div className="flex items-center gap-1.5 text-[0.7rem] font-semibold text-red-500">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Cancelled
            </div>
        );
    }
    const currentIdx = STATUS_FLOW.indexOf(status);
    return (
        <div className="flex items-center gap-0.5">
            {STATUS_FLOW.map((s, idx) => (
                <div key={s} className="flex items-center">
                    <div
                        title={STATUS_STEP_LABELS[s]}
                        className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                            idx < currentIdx ? "bg-emerald-500 text-white" :
                            idx === currentIdx ? "bg-[#0f172a] text-white ring-2 ring-[#0f172a]/20" :
                            "bg-slate-100 text-slate-400"
                        }`}
                    >
                        {idx < currentIdx ? (
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                            <span className="text-[9px] font-bold">{idx + 1}</span>
                        )}
                    </div>
                    {idx < STATUS_FLOW.length - 1 && (
                        <div className={`h-0.5 w-4 ${idx < currentIdx ? "bg-emerald-500" : "bg-slate-200"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

function OrderDetailModal({ order, onClose, onCancel, cancelling }: {
    order: ApiOrder;
    onClose: () => void;
    onCancel: (id: string) => void;
    cancelling: boolean;
}) {
    const isCancelled = order.status === "ORDER_CANCELLED";
    const currentIdx = STATUS_FLOW.indexOf(order.status);
    const progressPct = currentIdx <= 0 ? 0 : (currentIdx / (STATUS_FLOW.length - 1)) * 100;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-[#0f172a] px-5 py-4 flex items-start justify-between rounded-t-2xl sm:rounded-t-2xl">
                    <div>
                        <p className="font-mono text-[0.72rem] text-amber-400 font-bold tracking-widest">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="font-bold text-white text-sm mt-0.5 leading-tight">
                            {order.variant.product.name}
                        </p>
                        <p className="text-slate-400 text-xs mt-0.5">{order.variant.variant_name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Status track */}
                    {!isCancelled ? (
                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                            <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">Order Progress</p>
                            <div className="relative flex justify-between">
                                {/* Background track */}
                                <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-200 mx-4" />
                                {/* Progress fill */}
                                <div
                                    className="absolute top-3 left-4 h-0.5 bg-emerald-500 transition-all duration-700"
                                    style={{ width: `calc(${progressPct}% - 2rem)` }}
                                />
                                {STATUS_FLOW.map((s, idx) => (
                                    <div key={s} className="flex flex-col items-center gap-1.5 relative z-10">
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all ${
                                            idx < currentIdx ? "bg-emerald-500 border-emerald-500 text-white" :
                                            idx === currentIdx ? "bg-white border-[#0f172a] text-[#0f172a]" :
                                            "bg-white border-slate-300 text-slate-400"
                                        }`}>
                                            {idx < currentIdx ? (
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            ) : (
                                                <span className="w-3.5 h-3.5 flex items-center justify-center">{STATUS_SVG[s]}</span>
                                            )}
                                        </div>
                                        <span className={`text-[0.6rem] font-bold text-center leading-tight max-w-[44px] ${
                                            idx <= currentIdx ? "text-[#0f172a]" : "text-slate-400"
                                        }`}>{STATUS_STEP_LABELS[s]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-semibold text-red-600 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            This order has been cancelled
                        </div>
                    )}

                    {/* Key info grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {[
                            { label: "Amount", value: formatCurrency(order.final_amount) },
                            { label: "Quantity", value: order.quantity.toLocaleString() },
                            { label: "Payment", value: order.payment_status.replace(/_/g, " ") },
                            { label: "Placed On", value: new Date(order.created_at).toLocaleString("en-NP", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                        ].map(({ label, value }) => (
                            <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5 border border-slate-100">
                                <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
                                <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Delivery date */}
                    {order.expected_delivery_date && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center">
                                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <div>
                                <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-amber-500">Est. Delivery</p>
                                <p className="text-sm font-bold text-amber-900">
                                    {new Date(order.expected_delivery_date).toLocaleDateString("en-NP", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Status History */}
                    {order.statusHistory && order.statusHistory.length > 0 && (
                        <div>
                            <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-2">Order Timeline</p>
                            <div className="rounded-xl border border-slate-100 overflow-hidden">
                                {order.statusHistory.map((h, i) => (
                                    <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800">{STATUS_STEP_LABELS[h.status] || h.status.replace("ORDER_", "")}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {new Date(h.changed_at).toLocaleString("en-NP", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                {h.changed_by ? ` · by ${h.changed_by}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Configuration */}
                    {order.configurations && order.configurations.length > 0 && (
                        <div>
                            <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-2">Configuration</p>
                            <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                                {order.configurations.map((c, i) => (
                                    <div key={i} className="flex justify-between px-4 py-2.5 text-sm">
                                        <span className="text-slate-500">{c.group_label}</span>
                                        <span className="font-semibold text-slate-900">{c.selected_label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Design code */}
                    {order.approvedDesign && (
                        <div className="rounded-lg bg-[#0f172a]/5 border border-[#0f172a]/10 px-4 py-3">
                            <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-slate-500">Design Code</p>
                            <p className="font-mono text-sm font-bold text-[#0f172a] mt-0.5">{order.approvedDesign.designCode}</p>
                        </div>
                    )}

                    {/* Notes */}
                    {order.notes && (
                        <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                            <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-amber-500">Remarks</p>
                            <p className="text-sm text-amber-800 mt-0.5">{order.notes}</p>
                        </div>
                    )}

                    {/* Payment proof */}
                    {order.payment_proof_url && (
                        <div>
                            <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-slate-400 mb-2">Payment Proof</p>
                            <a
                                href={order.payment_proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-[#0f172a] truncate">
                                        {order.payment_proof_file_name || "View payment proof"}
                                    </p>
                                    <p className="text-[10px] text-slate-400">Click to open</p>
                                </div>
                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                    )}

                    {/* Cancel button */}
                    {order.status === "ORDER_PLACED" && (
                        <button
                            type="button"
                            disabled={cancelling}
                            onClick={() => onCancel(order.id)}
                            className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors"
                        >
                            {cancelling ? "Cancelling…" : "Cancel This Order"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<ApiOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [search, setSearch] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedOrder) return;
        fetch(`${API_BASE}/orders/${selectedOrder.id}`, { headers: getAuthHeaders() })
            .then((r) => r.json())
            .then((d) => {
                if (d.success && d.data?.statusHistory) {
                    setSelectedOrder((prev) => prev ? { ...prev, statusHistory: d.data.statusHistory } : null);
                }
            })
            .catch(() => {});
    }, [selectedOrder?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchOrders = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);
        try {
            const data = await fetchJsonCached<any>(
                "client-orders",
                `${API_BASE}/orders`,
                { headers: { ...getAuthHeaders(), "Content-Type": "application/json" } },
                30_000
            );
            if (!data.success) { setError(data.error?.message || data.message || "Failed to load orders"); return; }
            setOrders(data.data || []);
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchOrders(true);
        const id = setInterval(() => void fetchOrders(false), 30_000);
        return () => clearInterval(id);
    }, [fetchOrders]);

    const filtered = orders.filter((o) => {
        const matchStatus = statusFilter === "ALL" || o.status === statusFilter;
        const matchSearch =
            search === "" ||
            o.id.toLowerCase().includes(search.toLowerCase()) ||
            o.variant.product.name.toLowerCase().includes(search.toLowerCase()) ||
            o.variant.variant_name.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
    });

    const handleCancelOrder = async (orderId: string) => {
        setCancellingId(orderId);
        try {
            const response = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
                method: "PATCH",
                headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                notify.error(payload.message || "Unable to cancel order");
                return;
            }
            invalidateClientCache("client-orders");
            setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "ORDER_CANCELLED" } : o)));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder((prev) => prev ? { ...prev, status: "ORDER_CANCELLED" } : null);
            }
            notify.success("Order cancelled.");
        } catch {
            notify.error("Network error. Please try again.");
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <div className="min-h-[calc(100vh-68px)] bg-[#f8f7f4]">
            {selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onCancel={handleCancelOrder}
                    cancelling={cancellingId === selectedOrder.id}
                />
            )}

            {/* Hero header */}
            <div className="relative overflow-hidden bg-[#0f172a] px-6 py-10 sm:py-12">
                <div className="hero-grid-overlay pointer-events-none absolute inset-0" />
                <div className="relative max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <span className="inline-block mb-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[0.68rem] font-bold tracking-[0.12em] uppercase">
                            B2B Account
                        </span>
                        <h1 className="font-serif text-3xl sm:text-4xl font-black text-white leading-tight">
                            Order History
                        </h1>
                        <p className="mt-1.5 text-slate-400 text-sm">Track and manage all your printing orders.</p>
                    </div>
                    <Link
                        href="/services"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 text-[#0f172a] text-sm font-bold rounded-lg hover:bg-amber-300 transition-colors shrink-0"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        New Order
                    </Link>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* Stats strip */}
                {!loading && orders.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
                        {[
                            { label: "Total", count: orders.length, cls: "bg-white border border-slate-100 text-slate-700" },
                            { label: "Active", count: orders.filter(o => ["ORDER_PLACED","ORDER_PROCESSING","ORDER_PREPARED"].includes(o.status)).length, cls: "bg-[#0f172a]/5 border border-[#0f172a]/10 text-[#0f172a]" },
                            { label: "Dispatched", count: orders.filter(o => o.status === "ORDER_DISPATCHED").length, cls: "bg-amber-50 border border-amber-100 text-amber-700" },
                            { label: "Delivered", count: orders.filter(o => o.status === "ORDER_DELIVERED").length, cls: "bg-emerald-50 border border-emerald-100 text-emerald-700" },
                            { label: "Cancelled", count: orders.filter(o => o.status === "ORDER_CANCELLED").length, cls: "bg-red-50 border border-red-100 text-red-700" },
                        ].map(({ label, count, cls }) => (
                            <div key={label} className={`rounded-xl ${cls} px-3 py-2.5 text-center`}>
                                <p className="text-xl font-extrabold">{count}</p>
                                <p className="text-[0.65rem] font-bold uppercase tracking-wider opacity-70">{label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                    <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by product or order ID…"
                            className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/10 outline-none"
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {STATUS_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setStatusFilter(f.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    statusFilter === f.value
                                        ? "bg-[#0f172a] text-white"
                                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notice */}
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3">
                    <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-xs text-amber-800">
                        Orders can only be cancelled while in <strong>Placed</strong> status. Once accepted by admin, cancellation is locked.
                    </p>
                </div>

                {/* Loading skeletons */}
                {loading && (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
                                <div className="flex gap-4">
                                    <div className="h-11 w-11 bg-slate-100 rounded-xl shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3.5 bg-slate-100 rounded w-2/5" />
                                        <div className="h-3 bg-slate-100 rounded w-3/5" />
                                        <div className="h-3 bg-slate-100 rounded w-1/4" />
                                    </div>
                                    <div className="h-10 w-20 bg-slate-100 rounded-lg shrink-0" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && !loading && (
                    <div className="bg-white rounded-2xl border border-red-100 p-10 text-center">
                        <svg className="w-8 h-8 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <p className="text-red-500 font-semibold">{error}</p>
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
                        <div className="text-5xl mb-3">📭</div>
                        <p className="font-bold text-slate-700">No orders found</p>
                        <p className="text-sm text-slate-400 mt-1">
                            {search || statusFilter !== "ALL"
                                ? "Try adjusting your filters."
                                : "Place your first order to get started."}
                        </p>
                        {!search && statusFilter === "ALL" && (
                            <Link href="/services" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#0f172a] text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
                                Browse Services
                            </Link>
                        )}
                    </div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <div className="space-y-3">
                        {filtered.map((order) => {
                            const isCancelled = order.status === "ORDER_CANCELLED";
                            const isDelivered = order.status === "ORDER_DELIVERED";
                            return (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`bg-white rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                                        isCancelled ? "border-red-100 opacity-70" :
                                        isDelivered ? "border-emerald-100" :
                                        "border-slate-100 hover:border-slate-200"
                                    }`}
                                >
                                    <div className="p-4 sm:p-5">
                                        <div className="flex items-start gap-3 sm:gap-4">
                                            {/* Status icon */}
                                            <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${
                                                isCancelled ? "bg-red-50 text-red-400" :
                                                isDelivered ? "bg-emerald-50 text-emerald-600" :
                                                "bg-slate-50 text-slate-600"
                                            }`}>
                                                {STATUS_SVG[order.status] || STATUS_SVG.ORDER_PLACED}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm leading-tight">
                                                            {order.variant.product.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {order.variant.variant_name} · Qty {order.quantity.toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-extrabold text-[#0f172a] text-sm">{formatCurrency(order.final_amount)}</p>
                                                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${getStatusColor(order.status)}`}>
                                                            {getStatusLabel(order.status)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-3">
                                                    <OrderProgressBar status={order.status} />
                                                </div>

                                                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                                                    <span className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</span>
                                                    <span>{formatDate(order.created_at)}</span>
                                                    <span className={`font-semibold ${
                                                        order.payment_status === "CONFIRMED" || order.payment_status === "PAID" ? "text-emerald-600" :
                                                        order.payment_status === "PROOF_SUBMITTED" ? "text-amber-600" :
                                                        "text-slate-400"
                                                    }`}>
                                                        {order.payment_status.replace(/_/g, " ")}
                                                    </span>
                                                    {order.expected_delivery_date && (
                                                        <span className="text-amber-600 font-semibold">
                                                            {new Date(order.expected_delivery_date).toLocaleDateString("en-NP", { day: "numeric", month: "short" })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Chevron */}
                                            <svg className="w-4 h-4 text-slate-300 shrink-0 mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <p className="text-right text-xs text-slate-400 pt-1">
                            {filtered.length} of {orders.length} orders
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
