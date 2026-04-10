"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  AlertTriangle,
  Palette,
  Fingerprint,
  ShieldCheck,
  FileOutput,
  ChevronRight,
  Copy,
  Check,
  Package,
  Users,
  Eye,
  Activity,
  TrendingUp,
  CalendarDays,
} from "lucide-react";

type OrderStatus = "ORDER_PLACED" | "ORDER_PROCESSING" | "ORDER_PREPARED" | "ORDER_DISPATCHED" | "ORDER_DELIVERED" | "ORDER_CANCELLED";

const STATUS_LABELS: Record<OrderStatus, string> = {
  ORDER_PLACED: "Placed", ORDER_PROCESSING: "Processing", ORDER_PREPARED: "Prepared",
  ORDER_DISPATCHED: "Dispatched", ORDER_DELIVERED: "Delivered", ORDER_CANCELLED: "Cancelled",
};
const STATUS_COLORS: Record<OrderStatus, string> = {
  ORDER_PLACED: "bg-amber-100 text-amber-600", ORDER_PROCESSING: "bg-blue-100 text-blue-600",
  ORDER_PREPARED: "bg-indigo-100 text-indigo-600", ORDER_DISPATCHED: "bg-purple-100 text-purple-600",
  ORDER_DELIVERED: "bg-emerald-100 text-emerald-600", ORDER_CANCELLED: "bg-red-100 text-red-600",
};

interface DashboardStats {
  active_orders: number;
  total_orders: number;
  pending_registrations: number;
  pending_designs: number;
  total_clients: number;
}

interface VisitorStats {
  pageViews: { total: number; today: number; thisWeek: number; thisMonth: number };
  uniqueVisitors: { total: number; today: number };
  currentlyOnline: number;
}

interface RecentOrder {
  id: string;
  status: OrderStatus;
  final_amount: number;
  created_at: string;
  client?: { business_name: string };
  variant?: { variant_name: string; product?: { name: string } };
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [generatedId, setGeneratedId] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j.data) setStats(j.data); })
      .catch(() => {});

    fetch("/api/admin/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const data: RecentOrder[] = Array.isArray(j) ? j : j.data ?? [];
        setRecentOrders(data.slice(0, 5));
      })
      .catch(() => {});

    const loadVisitors = () => {
      fetch("/api/admin/analytics", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => { if (j.data) setVisitorStats(j.data); })
        .catch(() => {});
    };
    loadVisitors();
    const interval = setInterval(loadVisitors, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleGenerateId = () => {
    const id = `DSN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedId(id);
    setIsCopied(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedId);
    setIsCopied(true);
    toast({ title: "Copied to clipboard", description: `Design ID ${generatedId} copied.` });
  };

  const handleExportReport = async () => {
    try {
      toast({ title: "Generating Report…", description: "Fetching order data." });

      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const json = await res.json();
      const allOrders: RecentOrder[] = Array.isArray(json) ? json : json.data ?? [];

      // Filter to current month
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      const monthOrders = allOrders.filter((o) => {
        const d = new Date(o.created_at);
        return d.getMonth() === month && d.getFullYear() === year;
      });

      if (monthOrders.length === 0) {
        toast({ title: "No Data", description: "No orders found for the current month." });
        return;
      }

      // Build CSV
      const headers = ["Order ID", "Client", "Product", "Variant", "Status", "Amount (NPR)", "Date"];
      const rows = monthOrders.map((o) => [
        o.id,
        o.client?.business_name ?? "",
        o.variant?.product?.name ?? "",
        o.variant?.variant_name ?? "",
        STATUS_LABELS[o.status] ?? o.status,
        o.final_amount.toFixed(2),
        new Date(o.created_at).toLocaleDateString("en-NP"),
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `monthly-report-${year}-${String(month + 1).padStart(2, "0")}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: "Report Exported", description: `${monthOrders.length} orders exported to CSV.` });
    } catch {
      toast({ title: "Export Failed", description: "Could not generate the monthly report.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0061FF]">Operations Overview</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Monitor orders, approvals, and production readiness in one place.
        </p>
      </div>

      {/* Visitor Analytics */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#0061FF]" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">Website Visitors</span>
          </div>
          {visitorStats !== null && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {visitorStats.currentlyOnline} online now
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800 sm:grid-cols-4">
          {[
            { label: "Today's Visits", value: visitorStats?.pageViews.today, icon: Eye, color: "text-[#0061FF]" },
            { label: "Unique Today", value: visitorStats?.uniqueVisitors.today, icon: Users, color: "text-violet-600" },
            { label: "This Week", value: visitorStats?.pageViews.thisWeek, icon: TrendingUp, color: "text-emerald-600" },
            { label: "This Month", value: visitorStats?.pageViews.thisMonth, icon: CalendarDays, color: "text-amber-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex flex-col items-center justify-center gap-1 px-4 py-4">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {value !== undefined ? value.toLocaleString() : "—"}
              </span>
              <span className="text-center text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800">
          <CardContent className="p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Active Orders</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats ? stats.active_orders : "—"}
            </h3>
            <div className="mt-2 flex items-center text-xs font-medium text-slate-500">
              <Package className="mr-1 h-3 w-3" />
              <span>{stats ? `${stats.total_orders} total` : "Loading..."}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800">
          <CardContent className="p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Total Clients</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats ? stats.total_clients : "—"}
            </h3>
            <div className="mt-2 flex items-center text-xs font-medium text-slate-500">
              <Users className="mr-1 h-3 w-3" />
              <span>Approved clients</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800">
          <CardContent className="p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Registrations</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats ? stats.pending_registrations : "—"}
            </h3>
            <div className="mt-2 flex items-center text-xs font-medium text-amber-500">
              <AlertTriangle className="mr-1 h-3 w-3" />
              <span>Awaiting review</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800">
          <CardContent className="p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Designs</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats ? stats.pending_designs : "—"}
            </h3>
            <div className="mt-2 flex items-center text-xs font-medium text-[#0061FF]">
              <Palette className="mr-1 h-3 w-3" />
              <span>Needs review</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Orders Table */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Orders</h2>
            <Button type="button" variant="link" className="text-[#0061FF]" onClick={() => router.push("/orders")}>
              View All
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Order ID</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Client</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Product</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Amount</th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-400">
                      No recent orders.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-mono text-xs font-medium text-slate-900 dark:text-white">
                        {order.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {order.client?.business_name ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {order.variant?.product?.name ?? order.variant?.variant_name ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-slate-900 dark:text-white">
                        NPR {Number(order.final_amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Quick Actions & System Health */}
        <div className="space-y-6">
          <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base font-bold">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="group flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    onClick={handleGenerateId}
                  >
                    <div className="flex items-center gap-3">
                      <Fingerprint className="text-[#0061FF]" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Generate Design ID
                      </span>
                    </div>
                    <ChevronRight className="text-slate-400 transition-transform group-hover:translate-x-1" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate Design ID</DialogTitle>
                    <DialogDescription>
                      Use this unique ID for tracking new design projects.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center space-x-2">
                    <div className="grid flex-1 gap-2">
                      <Label htmlFor="link" className="sr-only">
                        Link
                      </Label>
                      <Input
                        id="link"
                        defaultValue={generatedId}
                        readOnly
                      />
                    </div>
                    <Button type="submit" size="sm" className="px-3" onClick={copyToClipboard}>
                      <span className="sr-only">Copy</span>
                      {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <DialogFooter className="sm:justify-start">
                    <DialogDescription className="text-xs">
                      This ID is valid for 24 hours.
                    </DialogDescription>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <button
                type="button"
                className="group flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                onClick={() => router.push("/registration-requests")}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-[#0061FF]" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Approve New Client
                  </span>
                </div>
                <ChevronRight className="text-slate-400 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                className="group flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                onClick={handleExportReport}
              >
                <div className="flex items-center gap-3">
                  <FileOutput className="text-[#0061FF]" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Export Monthly Report
                  </span>
                </div>
                <ChevronRight className="text-slate-400 transition-transform group-hover:translate-x-1" />
              </button>
            </CardContent>
          </Card>

          <div className="rounded-xl bg-gradient-to-br from-[#0057e6] to-[#003da8] p-6 text-white shadow-lg shadow-blue-700/30">
            <h2 className="mb-2 text-base font-bold">System Health</h2>
            <p className="mb-4 text-xs text-white/80">
              All printing servers are operating normally with 99.9% uptime.
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-[94%] bg-white"></div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest opacity-80">
              <span>Load Capacity</span>
              <span>94% Optimal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
