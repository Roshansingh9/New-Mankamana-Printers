"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAuthHeaders } from "@/store/authStore";
import { getStatusColor, getStatusLabel, formatDate, formatCurrency } from "@/utils/helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

const STATUS_FILTERS = [
    { label: "All Orders", value: "ALL" },
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

const STATUS_ICONS: Record<string, string> = {
    ORDER_PLACED: "📋",
    ORDER_PROCESSING: "🖨️",
    ORDER_PREPARED: "📦",
    ORDER_DISPATCHED: "🚚",
    ORDER_DELIVERED: "✅",
    ORDER_CANCELLED: "❌",
};

interface OrderConfig {
    group_label: string;
    selected_label: string;
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
}

function OrderProgressBar({ status }: { status: string }) {
    if (status === "ORDER_CANCELLED") {
        return (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 w-fit">
                ✕ Cancelled
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
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                            idx < currentIdx ? "bg-blue-600 text-white" :
                            idx === currentIdx ? "bg-blue-600 text-white ring-2 ring-blue-200" :
                            "bg-slate-200 text-slate-400"
                        }`}
                    >
                        {idx < currentIdx ? "✓" : idx + 1}
                    </div>
                    {idx < STATUS_FLOW.length - 1 && (
                        <div className={`h-0.5 w-4 ${idx < currentIdx ? "bg-blue-600" : "bg-slate-200"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}

function OrderDetailModal({ order, onClose }: { order: ApiOrder; onClose: () => void }) {
    const isCancelled = order.status === "ORDER_CANCELLED";
    const currentIdx = STATUS_FLOW.indexOf(order.status);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
                    <div>
                        <p className="font-mono text-xs text-blue-600 font-bold">#{order.id.slice(0, 8)}</p>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">
                            {order.variant.product.name} — {order.variant.variant_name}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold leading-none p-1" aria-label="Close">✕</button>
                </div>

                <div className="px-5 py-4 space-y-5">
                    {/* Status track */}
                    {!isCancelled ? (
                        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Order Progress</p>
                            <div className="flex justify-between relative">
                                <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-200 mx-5" />
                                <div
                                    className="absolute top-3 left-0 h-0.5 bg-blue-600 mx-5 transition-all"
                                    style={{ width: `${Math.min(currentIdx / (STATUS_FLOW.length - 1), 1) * 100}%` }}
                                />
                                {STATUS_FLOW.map((s, idx) => (
                                    <div key={s} className="flex flex-col items-center gap-1.5 relative z-10">
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                                            idx < currentIdx ? "bg-blue-600 border-blue-600 text-white" :
                                            idx === currentIdx ? "bg-white border-blue-600 text-blue-600" :
                                            "bg-white border-slate-300 text-slate-400"
                                        }`}>
                                            {idx < currentIdx ? "✓" : STATUS_ICONS[s]}
                                        </div>
                                        <span className={`text-[9px] font-semibold text-center leading-tight ${
                                            idx <= currentIdx ? "text-blue-700" : "text-slate-400"
                                        }`}>{STATUS_STEP_LABELS[s]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-semibold text-red-600 flex items-center gap-2">
                            ✕ This order has been cancelled
                        </div>
                    )}

                    {/* Key info */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: "Amount", value: formatCurrency(order.final_amount) },
                            { label: "Quantity", value: order.quantity.toLocaleString() },
                            { label: "Payment", value: order.payment_status.replace(/_/g, " ") },
                            { label: "Placed On", value: formatDate(order.created_at) },
                        ].map(({ label, value }) => (
                            <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                                <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Delivery date */}
                    {order.expected_delivery_date && (
                        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 flex items-center gap-3">
                            <span className="text-xl">📅</span>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Est. Delivery</p>
                                <p className="text-sm font-bold text-blue-900">
                                    {new Date(order.expected_delivery_date).toLocaleDateString("en-NP", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Configuration */}
                    {order.configurations && order.configurations.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Configuration</p>
                            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                                {order.configurations.map((c, i) => (
                                    <div key={i} className="flex justify-between px-4 py-2.5 text-sm">
                                        <span className="text-slate-500">{c.group_label}</span>
                                        <span className="font-medium text-slate-800">{c.selected_label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Design code */}
                    {order.approvedDesign && (
                        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Design Code</p>
                            <p className="font-mono text-sm font-bold text-indigo-800 mt-0.5">{order.approvedDesign.designCode}</p>
                        </div>
                    )}

                    {/* Notes */}
                    {order.notes && (
                        <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Remarks</p>
                            <p className="text-sm text-amber-800 mt-0.5">{order.notes}</p>
                        </div>
                    )}

                    {/* Payment proof */}
                    {order.payment_proof_url && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Proof</p>
                            <a
                                href={order.payment_proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 transition-colors"
                            >
                                <span className="text-2xl">🧾</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-blue-600 truncate">
                                        {order.payment_proof_file_name || "View payment proof"}
                                    </p>
                                    <p className="text-[10px] text-slate-400">Click to open</p>
                                </div>
                                <span className="text-slate-400">↗</span>
                            </a>
                        </div>
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
        fetch(`${API_BASE}/orders`, {
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        })
            .then((r) => r.json())
            .then((data) => {
                if (!data.success) { setError(data.message || "Failed to load orders"); return; }
                setOrders(data.data || []);
            })
            .catch(() => setError("Network error. Please try again."))
            .finally(() => setLoading(false));
    }, []);

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
                setError(payload.message || "Unable to cancel order");
                return;
            }
            setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "ORDER_CANCELLED" } : o)));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder({ ...selectedOrder, status: "ORDER_CANCELLED" });
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-900">Order History</h1>
                        <p className="text-slate-500 text-sm mt-1">Track and manage your printing orders.</p>
                    </div>
                    <Link
                        href="/services"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-blue-200"
                    >
                        + New Order
                    </Link>
                </div>

                {/* Stats strip */}
                {!loading && orders.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
                        {[
                            { label: "Total", count: orders.length, color: "bg-slate-100 text-slate-700" },
                            { label: "Active", count: orders.filter(o => ["ORDER_PLACED","ORDER_PROCESSING","ORDER_PREPARED"].includes(o.status)).length, color: "bg-blue-50 text-blue-700" },
                            { label: "Dispatched", count: orders.filter(o => o.status === "ORDER_DISPATCHED").length, color: "bg-amber-50 text-amber-700" },
                            { label: "Delivered", count: orders.filter(o => o.status === "ORDER_DELIVERED").length, color: "bg-emerald-50 text-emerald-700" },
                            { label: "Cancelled", count: orders.filter(o => o.status === "ORDER_CANCELLED").length, color: "bg-red-50 text-red-700" },
                        ].map(({ label, count, color }) => (
                            <div key={label} className={`rounded-xl ${color} px-3 py-2.5 text-center`}>
                                <p className="text-xl font-bold">{count}</p>
                                <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search orders…"
                            className="w-full sm:w-56 pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
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
                                        ? "bg-blue-600 text-white"
                                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Notice */}
                <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <span className="text-amber-500 mt-0.5">ℹ</span>
                    <p className="text-xs text-amber-800">
                        You can cancel only pending orders. Once accepted by admin, cancellation is locked.
                    </p>
                </div>

                {/* Content */}
                {loading && (
                    <div className="space-y-3">
                        {[1,2,3].map(i => (
                            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                                <div className="flex gap-4">
                                    <div className="h-12 w-12 bg-slate-100 rounded-xl" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                                        <div className="h-3 bg-slate-100 rounded w-1/4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && !loading && (
                    <div className="bg-white rounded-2xl border border-red-200 p-10 text-center">
                        <p className="text-red-500 font-medium">{error}</p>
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-14 text-center">
                        <p className="text-5xl mb-3">📭</p>
                        <p className="font-semibold text-slate-700">No orders found</p>
                        <p className="text-sm text-slate-400 mt-1">
                            {search || statusFilter !== "ALL" ? "Try adjusting your filters." : "Place your first order to get started."}
                        </p>
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
                                    className={`bg-white rounded-2xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                                        isCancelled ? "border-red-100 opacity-75" :
                                        isDelivered ? "border-emerald-100" :
                                        "border-slate-200"
                                    }`}
                                >
                                    <div className="p-4 sm:p-5">
                                        <div className="flex items-start gap-3 sm:gap-4">
                                            {/* Icon */}
                                            <div className={`flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center text-xl ${
                                                isCancelled ? "bg-red-50" :
                                                isDelivered ? "bg-emerald-50" :
                                                "bg-blue-50"
                                            }`}>
                                                {STATUS_ICONS[order.status] || "📋"}
                                            </div>

                                            {/* Main info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm leading-tight">
                                                            {order.variant.product.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{order.variant.variant_name} · Qty: {order.quantity}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className="font-bold text-slate-900 text-sm">{formatCurrency(order.final_amount)}</p>
                                                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusColor(order.status)}`}>
                                                            {getStatusLabel(order.status)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Progress */}
                                                <div className="mt-3">
                                                    <OrderProgressBar status={order.status} />
                                                </div>

                                                {/* Footer meta */}
                                                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
                                                    <span>#{order.id.slice(0, 8)}</span>
                                                    <span>{formatDate(order.created_at)}</span>
                                                    <span className={`font-medium ${
                                                        order.payment_status === "CONFIRMED" ? "text-emerald-600" :
                                                        order.payment_status === "PROOF_SUBMITTED" ? "text-blue-600" :
                                                        "text-slate-400"
                                                    }`}>
                                                        {order.payment_status.replace(/_/g, " ")}
                                                    </span>
                                                    {order.expected_delivery_date && (
                                                        <span className="text-blue-600 font-medium">
                                                            📅 {new Date(order.expected_delivery_date).toLocaleDateString("en-NP", { day: "numeric", month: "short" })}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Chevron */}
                                            <div className="flex items-center gap-2">
                                                {order.status === "ORDER_PLACED" && (
                                                    <button
                                                        type="button"
                                                        disabled={cancellingId === order.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleCancelOrder(order.id);
                                                        }}
                                                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                                                    >
                                                        {cancellingId === order.id ? "Cancelling..." : "Cancel"}
                                                    </button>
                                                )}
                                                <span className="text-slate-300 text-lg flex-shrink-0 mt-1">›</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <p className="text-right text-xs text-slate-400 pt-1">
                            Showing {filtered.length} of {orders.length} orders
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
