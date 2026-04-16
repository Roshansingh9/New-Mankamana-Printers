"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, Users, Phone, Mail, Building2, RefreshCw, KeyRound, MapPin, User, Eye, Ban, CheckCircle, FileText, Download, ExternalLink, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: string;
  client_code?: string | null;
  business_name: string;
  owner_name: string;
  phone_number: string;
  email: string;
  address?: string | null;
  status: string;
  createdAt?: string;
}

interface ResetResult {
  phone_number: string;
  new_password: string;
}

interface ClientOrder {
  id: string;
  status: string;
  quantity: number;
  final_amount: string | number;
  created_at: string;
  variant: { variant_name: string; product: { name: string } };
  approvedDesign?: { designCode: string } | null;
}

interface ClientDesign {
  id: string;
  title?: string | null;
  status: string;
  submittedAt: string;
  fileUrl: string;
  fileType: string;
  feedbackMessage?: string | null;
  approvedDesign?: { designCode: string } | null;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  ORDER_PLACED: "Placed",
  ORDER_PROCESSING: "Processing",
  ORDER_PREPARED: "Prepared",
  ORDER_DISPATCHED: "Dispatched",
  ORDER_DELIVERED: "Delivered",
  ORDER_CANCELLED: "Cancelled",
};

export default function ClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientOrders, setClientOrders] = useState<ClientOrder[]>([]);
  const [clientDesigns, setClientDesigns] = useState<ClientDesign[]>([]);
  const [detailTab, setDetailTab] = useState<"info" | "orders" | "designs">("info");
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    business_name: "", owner_name: "", email: "", phone_number: "", address: "",
  });

  const handleResetPassword = async (client: Client) => {
    setResettingId(client.id);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/reset-password`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Reset failed");
      setResetResult(json.credentials);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResettingId(null);
    }
  };

  const handleToggleStatus = async (client: Client) => {
    setTogglingId(client.id);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/toggle-status`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update status");
      toast({ title: "Success", description: json.message });
      setClients((prev) => prev.map((c) => c.id === client.id ? { ...c, status: json.status } : c));
      if (selectedClient?.id === client.id) {
        setSelectedClient((prev) => prev ? { ...prev, status: json.status } : prev);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clients", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load clients");
      const data = Array.isArray(json) ? json : json.data ?? [];
      setClients(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleUpdateClient = async () => {
    if (!selectedClient) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/clients/${selectedClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update client");
      const updated: Client = json.data;
      setSelectedClient(updated);
      setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setIsEditing(false);
      toast({ title: "Client Updated", description: "Profile saved and client notified by email." });
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const openClientDetail = async (client: Client) => {
    setSelectedClient(client);
    setIsEditing(false);
    setDetailTab("info");
    setDetailLoading(true);
    try {
      const [ordersRes, designsRes] = await Promise.all([
        fetch(`/api/admin/clients/${client.id}/orders`),
        fetch(`/api/admin/clients/${client.id}/designs`),
      ]);
      const [ordersJson, designsJson] = await Promise.all([ordersRes.json(), designsRes.json()]);
      setClientOrders(ordersJson.data || []);
      setClientDesigns(designsJson.data || []);
    } catch {
      setClientOrders([]);
      setClientDesigns([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownload = async (url: string, title: string, fileType?: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${title}.${fileType || "file"}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.business_name.toLowerCase().includes(q) ||
      c.phone_number.includes(q) ||
      (c.client_code ?? "").toLowerCase().includes(q)
    );
  });

  const activeCount = clients.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0061FF]">Client Operations</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Clients Directory</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Track approved businesses, review profiles, and monitor engagement.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Total Clients", value: clients.length, icon: Users },
          { label: "Active", value: activeCount, icon: Building2 },
          { label: "Inactive", value: clients.length - activeCount, icon: Phone },
        ].map((stat) => (
          <Card key={stat.label} className="border-slate-200/80 shadow-sm dark:border-slate-800">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              </div>
              <div className="rounded-full bg-slate-100 p-3 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <stat.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg font-semibold">Client List</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-[#0061FF] focus:ring-1 focus:ring-[#0061FF] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Search by client or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={fetchClients} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">Loading clients...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Client</th>
                    <th className="px-6 py-4 font-semibold">Contact</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        No clients found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((client) => (
                      <tr
                        key={client.id}
                        className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        onClick={() => openClientDetail(client)}
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {client.business_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {client.client_code ?? client.id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Phone className="h-3.5 w-3.5" />
                            {client.phone_number}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <Mail className="h-3.5 w-3.5" />
                            {client.email}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={client.status === "active" ? "default" : "secondary"}>
                            {client.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-slate-400">
                              {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "—"}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); openClientDetail(client); }}
                              className="gap-1 text-xs"
                            >
                              <Eye className="h-3 w-3" />
                              Details
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={resettingId === client.id}
                              onClick={(e) => { e.stopPropagation(); handleResetPassword(client); }}
                              className="gap-1 text-xs"
                            >
                              <KeyRound className="h-3 w-3" />
                              {resettingId === client.id ? "…" : "Reset"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={togglingId === client.id}
                              onClick={(e) => { e.stopPropagation(); handleToggleStatus(client); }}
                              className={`gap-1 text-xs ${client.status === "active" ? "text-red-600 hover:text-red-700 border-red-200 hover:border-red-300" : "text-emerald-600 hover:text-emerald-700 border-emerald-200 hover:border-emerald-300"}`}
                            >
                              {client.status === "active" ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                              {togglingId === client.id ? "…" : client.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset password result dialog */}
      <Dialog open={!!resetResult} onOpenChange={() => setResetResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Credentials Generated</DialogTitle>
            <DialogDescription>
              The password has been reset and emailed to the client.
            </DialogDescription>
          </DialogHeader>
          {resetResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-3 dark:border-slate-700 dark:bg-slate-800">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Login ID (Phone)</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-white">{resetResult.phone_number}</p>
              </div>
            </div>
          )}
          <Button type="button" onClick={() => setResetResult(null)} className="w-full bg-[#0061FF] hover:bg-[#0050d5]">Done</Button>
        </DialogContent>
      </Dialog>

      {/* Client detail dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#0061FF]" />
              {selectedClient?.business_name}
            </DialogTitle>
            <DialogDescription>Client profile, orders, and designs</DialogDescription>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            {(["info", "orders", "designs"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDetailTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${detailTab === tab ? "border-[#0061FF] text-[#0061FF]" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {tab}
                {tab === "orders" && !detailLoading && ` (${clientOrders.length})`}
                {tab === "designs" && !detailLoading && ` (${clientDesigns.length})`}
              </button>
            ))}
          </div>

          {detailLoading ? (
            <div className="py-8 text-center text-sm text-slate-400 animate-pulse">Loading…</div>
          ) : (
            <>
              {detailTab === "info" && selectedClient && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Client Code</p>
                      <p className="mt-1 font-mono text-sm font-bold text-[#0061FF]">
                        {selectedClient.client_code ?? selectedClient.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
                      <p className="mt-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${selectedClient.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {selectedClient.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Edit / View toggle */}
                  <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Profile Details</p>
                      {!isEditing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => {
                            setEditForm({
                              business_name: selectedClient.business_name,
                              owner_name: selectedClient.owner_name,
                              email: selectedClient.email,
                              phone_number: selectedClient.phone_number,
                              address: selectedClient.address ?? "",
                            });
                            setIsEditing(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setIsEditing(false)}>
                            <X className="h-3 w-3" /> Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 gap-1 text-xs bg-[#0061FF] hover:bg-[#0050d5]"
                            disabled={savingEdit}
                            onClick={handleUpdateClient}
                          >
                            <Save className="h-3 w-3" />
                            {savingEdit ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="p-4 space-y-3">
                        {([
                          { key: "business_name", label: "Business Name", icon: Building2 },
                          { key: "owner_name", label: "Owner Name", icon: User },
                          { key: "email", label: "Email Address", icon: Mail },
                          { key: "phone_number", label: "Phone Number", icon: Phone },
                          { key: "address", label: "Address", icon: MapPin },
                        ] as const).map(({ key, label, icon: Icon }) => (
                          <div key={key}>
                            <label htmlFor={`edit-${key}`} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              <Icon className="h-3 w-3" /> {label}
                            </label>
                            <input
                              id={`edit-${key}`}
                              type="text"
                              value={editForm[key]}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, [key]: e.target.value }))}
                              placeholder={label}
                              title={label}
                              className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#0061FF] focus:ring-1 focus:ring-[#0061FF] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                          </div>
                        ))}
                        <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5 border border-amber-100">
                          The client will receive an email listing all changes made.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {[
                          { icon: User, label: "Owner", value: selectedClient.owner_name },
                          { icon: Phone, label: "Phone", value: selectedClient.phone_number },
                          { icon: Mail, label: "Email", value: selectedClient.email },
                          ...(selectedClient.address ? [{ icon: MapPin, label: "Address", value: selectedClient.address }] : []),
                          { icon: Building2, label: "Joined", value: selectedClient.createdAt ? new Date(selectedClient.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—" },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex items-start gap-3">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailTab === "orders" && (
                <div>
                  {clientOrders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">No orders yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientOrders.map((order) => (
                        <div key={order.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800">{order.variant.product.name}</span>
                              <span className="text-slate-500"> — {order.variant.variant_name}</span>
                              {/* Order ID as a link to the orders page with pre-filter */}
                              <a
                                href={`/orders?search=${order.id}`}
                                className="ml-2 font-mono text-[10px] text-[#0061FF] hover:underline"
                                title="Open in Orders page"
                              >
                                #{order.id.slice(0, 8)}
                              </a>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${order.status === "ORDER_DELIVERED" ? "bg-emerald-100 text-emerald-700" : order.status === "ORDER_CANCELLED" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                              {ORDER_STATUS_LABELS[order.status] ?? order.status}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>Qty: {order.quantity}</span>
                            <span>NPR {Number(order.final_amount).toLocaleString()}</span>
                            <span>{new Date(order.created_at).toLocaleDateString()}</span>
                            {order.approvedDesign && <span className="font-mono text-[#0061FF]">{order.approvedDesign.designCode}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === "designs" && (
                <div>
                  {clientDesigns.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">No design submissions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientDesigns.map((design) => (
                        <div key={design.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                              <div>
                                <div className="font-semibold text-slate-800">{design.title || `Submission ${design.id.slice(0, 6)}`}</div>
                                <div className="text-xs text-slate-500">{new Date(design.submittedAt).toLocaleDateString()}{design.approvedDesign && <span className="ml-2 font-mono text-[#0061FF]">{design.approvedDesign.designCode}</span>}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${design.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : design.status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                {design.status === "PENDING_REVIEW" ? "Pending" : design.status === "APPROVED" ? "Approved" : "Rejected"}
                              </span>
                              <a href={design.fileUrl} target="_blank" rel="noreferrer" className="rounded p-1 hover:bg-slate-200" title="Open">
                                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                              </a>
                              <button type="button" onClick={() => handleDownload(design.fileUrl, design.title || design.id, design.fileType)} className="rounded p-1 hover:bg-slate-200" title="Download">
                                <Download className="h-3.5 w-3.5 text-slate-500" />
                              </button>
                            </div>
                          </div>
                          {design.feedbackMessage && (
                            <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{design.feedbackMessage}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setSelectedClient(null)}>Close</Button>
            <Button
              type="button"
              variant="outline"
              className={`flex-1 gap-2 ${selectedClient?.status === "active" ? "text-red-600 border-red-200 hover:border-red-300" : "text-emerald-600 border-emerald-200 hover:border-emerald-300"}`}
              disabled={togglingId === selectedClient?.id}
              onClick={() => { if (selectedClient) handleToggleStatus(selectedClient); }}
            >
              {selectedClient?.status === "active" ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              {selectedClient?.status === "active" ? "Deactivate Account" : "Activate Account"}
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2 bg-[#0061FF] hover:bg-[#0050d5]"
              disabled={resettingId === selectedClient?.id}
              onClick={() => { if (selectedClient) handleResetPassword(selectedClient); setSelectedClient(null); }}
            >
              <KeyRound className="h-4 w-4" />
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
