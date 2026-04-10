"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Package,
  Clock,
  CheckCircle2,
  Printer,
  Truck,
  RefreshCw,
  Calendar,
  XCircle,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

type OrderStatus =
  | "ORDER_PLACED"
  | "ORDER_PROCESSING"
  | "ORDER_PREPARED"
  | "ORDER_DISPATCHED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED";

interface Order {
  id: string;
  status: OrderStatus;
  final_amount: number;
  quantity: number;
  payment_status: string;
  created_at: string;
  expected_delivery_date?: string | null;
  notes?: string | null;
  client?: {
    business_name: string;
    phone_number?: string;
    client_code?: string;
  };
  variant?: {
    variant_name: string;
    product?: { name: string };
  };
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  ORDER_PLACED: "Order Placed",
  ORDER_PROCESSING: "Processing",
  ORDER_PREPARED: "Prepared",
  ORDER_DISPATCHED: "Dispatched",
  ORDER_DELIVERED: "Delivered",
  ORDER_CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  ORDER_PLACED: "bg-slate-100 text-slate-700 border-slate-200",
  ORDER_PROCESSING: "bg-blue-100 text-blue-700 border-blue-200",
  ORDER_PREPARED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  ORDER_DISPATCHED: "bg-amber-100 text-amber-700 border-amber-200",
  ORDER_DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ORDER_CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

// ORDER_PLACED auto-advances; admin manually drives everything from ORDER_PROCESSING onwards
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  ORDER_PROCESSING: "ORDER_PREPARED",
  ORDER_PREPARED: "ORDER_DISPATCHED",
  ORDER_DISPATCHED: "ORDER_DELIVERED",
};

const STATUS_FLOW: OrderStatus[] = [
  "ORDER_PLACED",
  "ORDER_PROCESSING",
  "ORDER_PREPARED",
  "ORDER_DISPATCHED",
  "ORDER_DELIVERED",
];

const ALL_FILTER_TABS: { label: string; value: string }[] = [
  { label: "All", value: "All" },
  { label: "Placed", value: "ORDER_PLACED" },
  { label: "Processing", value: "ORDER_PROCESSING" },
  { label: "Prepared", value: "ORDER_PREPARED" },
  { label: "Dispatched", value: "ORDER_DISPATCHED" },
  { label: "Delivered", value: "ORDER_DELIVERED" },
  { label: "Cancelled", value: "ORDER_CANCELLED" },
];

// ── Cancel confirmation modal ──────────────────────────────────────────────
function CancelModal({
  order,
  onConfirm,
  onClose,
  loading,
}: {
  order: Order;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cancel Order</h2>
        </div>
        <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to cancel this order?
        </p>
        <div className="my-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">Order ID</p>
          <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
            {order.id.slice(0, 8)}...
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Client</p>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {order.client?.business_name ?? "—"}
          </p>
        </div>
        <p className="mb-5 text-xs text-red-500">This action cannot be undone.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Keep Order
          </Button>
          <Button
            className="flex-1 bg-red-600 text-white hover:bg-red-700"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Cancelling..." : "Yes, Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delivery date popover ─────────────────────────────────────────────────
function DeliveryDatePopover({
  order,
  onSave,
  onClose,
  loading,
}: {
  order: Order;
  onSave: (date: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const existing = order.expected_delivery_date
    ? new Date(order.expected_delivery_date).toISOString().split("T")[0]
    : "";
  const [date, setDate] = useState(existing);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
          Set Expected Delivery Date
        </h2>
        <input
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Expected delivery date"
          title="Expected delivery date"
          className="mb-5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#0061FF] focus:ring-1 focus:ring-[#0061FF] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-[#0061FF] text-white hover:bg-[#0052d9]"
            onClick={() => date && onSave(date)}
            disabled={!date || loading}
          >
            {loading ? "Saving..." : "Save Date"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Status progress bar ───────────────────────────────────────────────────
function StatusProgress({ status }: { status: OrderStatus }) {
  if (status === "ORDER_CANCELLED") return null;
  const currentIdx = STATUS_FLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {STATUS_FLOW.map((s, idx) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={`h-1.5 w-5 rounded-full transition-colors ${
              idx <= currentIdx ? "bg-[#0061FF]" : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function OrderManagementPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [deliveryTarget, setDeliveryTarget] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load orders");
      setOrders(Array.isArray(json) ? json : json.data ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleAdvanceStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setUpdatingId(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update status");
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
      toast({ title: "Status Updated", description: `Order moved to ${STATUS_LABELS[next]}` });
      window.dispatchEvent(new Event("stats-updated"));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
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
      setOrders((prev) =>
        prev.map((o) => (o.id === cancelTarget.id ? { ...o, status: "ORDER_CANCELLED" } : o))
      );
      toast({ title: "Order Cancelled", description: "The order has been cancelled." });
      window.dispatchEvent(new Event("stats-updated"));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setCancelTarget(null);
    }
  };

  const handleSetDeliveryDate = async (date: string) => {
    if (!deliveryTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${deliveryTarget.id}/delivery-date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_delivery_date: date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to set date");
      setOrders((prev) =>
        prev.map((o) =>
          o.id === deliveryTarget.id ? { ...o, expected_delivery_date: date } : o
        )
      );
      toast({ title: "Delivery Date Set", description: `Expected delivery: ${new Date(date).toLocaleDateString()}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setDeliveryTarget(null);
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

  const activeStatuses: OrderStatus[] = ["ORDER_PLACED", "ORDER_PROCESSING", "ORDER_PREPARED", "ORDER_DISPATCHED"];
  const stats = {
    total: orders.length,
    active: orders.filter((o) => activeStatuses.includes(o.status)).length,
    prepared: orders.filter((o) => o.status === "ORDER_PREPARED").length,
    delivered: orders.filter((o) => o.status === "ORDER_DELIVERED").length,
  };

  return (
    <>
      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
          loading={actionLoading}
        />
      )}
      {deliveryTarget && (
        <DeliveryDatePopover
          order={deliveryTarget}
          onSave={handleSetDeliveryDate}
          onClose={() => setDeliveryTarget(null)}
          loading={actionLoading}
        />
      )}

      <div className="space-y-6">
        {/* Page header */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0061FF]">Fulfillment</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Order Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track and manage print orders from placement to delivery.
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
                  <div className={`rounded-full p-3 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
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
                  <Button type="button" variant="outline" size="icon" onClick={fetchOrders} title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* Filter tabs */}
              <div className="flex gap-1 overflow-x-auto pb-3">
                {ALL_FILTER_TABS.map((tab) => (
                  <button
                    type="button"
                    key={tab.value}
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
              <div className="px-6 py-16 text-center text-sm text-slate-500">Loading orders...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Order</th>
                      <th className="px-5 py-3.5 font-semibold">Client</th>
                      <th className="px-5 py-3.5 font-semibold">Product</th>
                      <th className="px-5 py-3.5 font-semibold">Amount</th>
                      <th className="px-5 py-3.5 font-semibold">Status</th>
                      <th className="px-5 py-3.5 font-semibold">Est. Delivery</th>
                      <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          No orders found.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isCancelled = order.status === "ORDER_CANCELLED";
                        const isDelivered = order.status === "ORDER_DELIVERED";
                        const isFinal = isCancelled || isDelivered;
                        const nextStatus = NEXT_STATUS[order.status];

                        return (
                          <tr
                            key={order.id}
                            className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                          >
                            {/* Order ID + date */}
                            <td className="px-5 py-4">
                              <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                                #{order.id.slice(0, 8)}
                              </p>
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="h-3 w-3" />
                                {new Date(order.created_at).toLocaleDateString()}
                              </div>
                              <div className="mt-1">
                                <StatusProgress status={order.status} />
                              </div>
                            </td>

                            {/* Client */}
                            <td className="px-5 py-4">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {order.client?.business_name ?? "—"}
                              </p>
                              <p className="text-[11px] text-slate-400">{order.client?.phone_number ?? ""}</p>
                            </td>

                            {/* Product */}
                            <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                              <p>{order.variant?.product?.name ?? order.variant?.variant_name ?? "—"}</p>
                              <p className="text-[11px] text-slate-400">Qty: {order.quantity}</p>
                            </td>

                            {/* Amount */}
                            <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                              NPR {Number(order.final_amount).toLocaleString()}
                              <p className={`text-[11px] font-normal ${
                                order.payment_status === "CONFIRMED"
                                  ? "text-emerald-600"
                                  : order.payment_status === "PROOF_SUBMITTED"
                                  ? "text-blue-600"
                                  : "text-slate-400"
                              }`}>
                                {order.payment_status.replace(/_/g, " ")}
                              </p>
                            </td>

                            {/* Status badge */}
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}
                              >
                                {STATUS_LABELS[order.status]}
                              </span>
                            </td>

                            {/* Expected delivery */}
                            <td className="px-5 py-4">
                              {order.expected_delivery_date ? (
                                <button
                                  type="button"
                                  onClick={() => !isCancelled && setDeliveryTarget(order)}
                                  className={`flex items-center gap-1 text-xs ${
                                    isCancelled
                                      ? "cursor-default text-slate-400"
                                      : "text-[#0061FF] hover:underline"
                                  }`}
                                  title={isCancelled ? "Delivery date" : "Edit delivery date"}
                                  aria-label={isCancelled ? "Delivery date" : "Edit delivery date"}
                                >
                                  <Calendar className="h-3 w-3" />
                                  {new Date(order.expected_delivery_date).toLocaleDateString()}
                                </button>
                              ) : !isCancelled ? (
                                <button
                                  type="button"
                                  onClick={() => setDeliveryTarget(order)}
                                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#0061FF]"
                                  title="Set delivery date"
                                  aria-label="Set delivery date"
                                >
                                  <Calendar className="h-3 w-3" />
                                  Set date
                                </button>
                              ) : (
                                <span className="text-xs text-slate-300">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* ORDER_PLACED auto-advances — show indicator instead of advance button */}
                                {order.status === "ORDER_PLACED" && (
                                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    <Clock className="h-3 w-3 animate-spin" style={{ animationDuration: "3s" }} />
                                    Auto-processing…
                                  </span>
                                )}
                                {/* Manual advance button for ORDER_PROCESSING → DELIVERED */}
                                {!isFinal && nextStatus && (
                                  <Button
                                    size="sm"
                                    disabled={updatingId === order.id}
                                    onClick={() => handleAdvanceStatus(order)}
                                    className="h-8 bg-[#0061FF] px-3 text-xs text-white hover:bg-[#0052d9]"
                                  >
                                    {updatingId === order.id ? (
                                      "..."
                                    ) : (
                                      <>
                                        <ChevronRight className="mr-0.5 h-3 w-3" />
                                        {STATUS_LABELS[nextStatus]}
                                      </>
                                    )}
                                  </Button>
                                )}
                                {!isFinal && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCancelTarget(order)}
                                    className="h-8 border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                                    title="Cancel order"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {isFinal && (
                                  <span className="text-xs text-slate-400">
                                    {isCancelled ? "Cancelled" : "Delivered"}
                                  </span>
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
            {!loading && filteredOrders.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 text-right text-xs text-slate-400 dark:border-slate-800">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
