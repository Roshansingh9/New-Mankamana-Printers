"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
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
import { useToast } from "@/hooks/use-toast";
import {
  Check,
  X,
  Eye,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Hourglass,
  Download,
  FileText,
  ExternalLink,
} from "lucide-react";
import {
  approveDesignSubmission,
  fetchAllDesignSubmissions,
  rejectDesignSubmission,
  type DesignListItem,
} from "@/services/designApprovalService";

const STATUS_CONFIG = {
  Pending: {
    label: "Pending",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-1 ring-amber-200/60",
    dot: "bg-amber-500",
    icon: Hourglass,
  },
  Approved: {
    label: "Approved",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-1 ring-emerald-200/60",
    dot: "bg-emerald-500",
    icon: CheckCircle,
  },
  Rejected: {
    label: "Rejected",
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    ring: "ring-1 ring-red-200/60",
    dot: "bg-red-500",
    icon: XCircle,
  },
};

export default function DesignApprovalPage() {
  const { toast } = useToast();
  const [designs, setDesigns] = useState<DesignListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<DesignListItem | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveTargetId, setApproveTargetId] = useState<string | null>(null);
  const [extraPrice, setExtraPrice] = useState("");

  const loadDesigns = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Single source of truth: ALL submissions (pending/approved/rejected).
      // Previously fetching submissions + approved-designs separately caused each approved
      // submission to appear twice on this page.
      const all = await fetchAllDesignSubmissions();
      setDesigns(all);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load designs.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDesigns();
  }, []);

  const openApproveDialog = (id: string) => {
    setApproveTargetId(id);
    setExtraPrice("");
    setIsApproveOpen(true);
  };

  const handleApprove = async (id: string, extra?: number) => {
    // Optimistically disable the button before the async call
    setActionId(id);
    try {
      await approveDesignSubmission(id, undefined, extra);
      // Optimistically mark as Approved in local state immediately, then refresh
      setDesigns((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "Approved" } : d))
      );
      await loadDesigns();
      toast({
        title: "Design Approved",
        description: "The design has been approved and the client has been notified.",
        variant: "success",
      });
      setIsViewOpen(false);
      setIsApproveOpen(false);
      window.dispatchEvent(new Event("stats-updated"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to approve design.";
      toast({
        title: "Approval Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    setActionId(id);
    try {
      await rejectDesignSubmission(id, reason);
      setDesigns((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "Rejected" } : d))
      );
      toast({
        title: "Design Rejected",
        description: "The client has been notified.",
        variant: "destructive",
      });
      setIsViewOpen(false);
      setIsRejectOpen(false);
      window.dispatchEvent(new Event("stats-updated"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reject design.";
      toast({ title: "Rejection Failed", description: message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const openRejectDialog = (id: string) => {
    setRejectTargetId(id);
    setRejectReason("");
    setIsRejectOpen(true);
  };

  const stats = {
    pending: designs.filter((d) => d.status === "Pending").length,
    approved: designs.filter((d) => d.status === "Approved").length,
    rejected: designs.filter((d) => d.status === "Rejected").length,
  };

  // Download file via fetch → blob so the browser saves it (works cross-origin for public Supabase URLs)
  const handleDownload = async (url: string, title: string, fileType?: string) => {
    const ext = fileType === "pdf" ? "pdf" : fileType === "png" ? "png" : "jpg";
    const filename = `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.${ext}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Design Approval
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Review and approve designs before sending to print.
          </p>
        </div>
        {/* Status summary */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              {stats.pending}
            </span>
            <span className="text-slate-500">pending</span>
          </div>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              {stats.approved}
            </span>
            <span className="text-slate-500">approved</span>
          </div>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              {stats.rejected}
            </span>
            <span className="text-slate-500">rejected</span>
          </div>
        </div>
      </div>

      {loadError ? (
        <Card className="border border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-start gap-2 p-4 text-sm text-red-700">
            <span>{loadError}</span>
            <Button size="sm" variant="outline" onClick={loadDesigns}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Design Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center text-sm text-slate-500">
              Loading designs...
            </CardContent>
          </Card>
        ) : designs.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center text-sm text-slate-500">
              No design submissions available.
            </CardContent>
          </Card>
        ) : (
          designs.map((design) => {
            const cfg = STATUS_CONFIG[design.status as keyof typeof STATUS_CONFIG];
            const isPending = design.status === "Pending";
            return (
              <Card
                key={design.id}
                className="group overflow-hidden transition-all hover:shadow-md"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {design.fileType === "pdf" ? (
                    /* PDF — can't thumbnail; show a document icon card instead */
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-red-50 dark:bg-red-950/20">
                      <FileText className="h-10 w-10 text-red-400" />
                      <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">PDF Document</span>
                    </div>
                  ) : design.image ? (
                    <img
                      src={design.image}
                      alt={design.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                      No preview available
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute right-3 top-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${cfg.bg} ${cfg.text} ${cfg.ring}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-2 bg-white/95 text-slate-900 hover:bg-white shadow-lg"
                      onClick={() => {
                        setSelectedDesign(design);
                        setIsViewOpen(true);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Full Review
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <CardHeader className="p-4 pb-0">
                  <CardTitle className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {design.title}
                  </CardTitle>
                  <div className="flex items-center gap-3 pt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {design.designer}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {design.submittedDate}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2.5">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {design.client}
                  </p>
                  {design.productName && (
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                      📦 {design.productName}
                    </p>
                  )}
                  {design.designCode && (
                    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Code:{" "}
                      <span className="font-mono tracking-wide">{design.designCode}</span>
                    </p>
                  )}
                </CardContent>

                <CardFooter className="gap-2 border-t border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => {
                      setSelectedDesign(design);
                      setIsViewOpen(true);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Review
                  </Button>
                  {design.fileUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      title="Download file"
                      onClick={() => handleDownload(design.fileUrl!, design.title, design.fileType)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {isPending && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => openApproveDialog(design.id)}
                        disabled={actionId !== null}
                      >
                        <Check className="h-3.5 w-3.5" />
                        {actionId === design.id ? "Approving..." : "Approve"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1.5"
                        onClick={() => openRejectDialog(design.id)}
                        disabled={actionId !== null}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>

      {/* Review Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedDesign?.title}</DialogTitle>
            <DialogDescription>
              Submitted by <strong>{selectedDesign?.designer}</strong> &mdash;{" "}
              {selectedDesign?.client}
              {selectedDesign?.productName && (
                <>
                  {" "}
                  &middot; Product:{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {selectedDesign.productName}
                  </span>
                </>
              )}
              {selectedDesign?.designCode && (
                <>
                  {" "}
                  &middot; Code:{" "}
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {selectedDesign.designCode}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {/* Preview area — image or PDF */}
          <div className="min-h-80 max-h-[520px] w-full overflow-hidden rounded-lg bg-slate-100 shadow-inner dark:bg-slate-800">
            {selectedDesign?.fileType === "pdf" && selectedDesign.fileUrl ? (
              <iframe
                src={selectedDesign.fileUrl}
                title={selectedDesign.title}
                className="h-[480px] w-full border-0"
              />
            ) : selectedDesign?.fileUrl ? (
              <img
                src={selectedDesign.fileUrl}
                alt={selectedDesign.title}
                className="max-h-[480px] w-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex min-h-80 w-full items-center justify-center text-sm text-slate-400">
                No preview available
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {/* Left: file actions */}
            <div className="flex gap-2">
              {selectedDesign?.fileUrl && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => window.open(selectedDesign.fileUrl, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Tab
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleDownload(selectedDesign.fileUrl!, selectedDesign.title, selectedDesign.fileType)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </>
              )}
            </div>
            {/* Right: review actions */}
            <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            {selectedDesign?.status === "Pending" && (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  onClick={() => selectedDesign && openRejectDialog(selectedDesign.id)}
                  disabled={actionId !== null}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button
                  type="button"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => selectedDesign && openApproveDialog(selectedDesign.id)}
                  disabled={actionId !== null}
                >
                  <Check className="h-4 w-4" />
                  Approve Design
                </Button>
              </>
            )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog — with optional extra price surcharge */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve Design</DialogTitle>
            <DialogDescription>
              Optionally set a per-unit extra price surcharge for orders using this design. Leave blank or 0 for no surcharge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="extra-price">Extra Price per Unit (NPR)</Label>
            <input
              id="extra-price"
              type="number"
              min="0"
              step="1"
              value={extraPrice}
              onChange={(e) => setExtraPrice(e.target.value)}
              placeholder="e.g. 500 (leave blank for 0)"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {extraPrice && Number(extraPrice) > 0 && (
              <p className="text-xs text-slate-500">
                NPR {Number(extraPrice).toLocaleString()} will be added per unit to any order using this design.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                if (!approveTargetId) return;
                const extra = extraPrice && Number(extraPrice) > 0 ? Number(extraPrice) : 0;
                handleApprove(approveTargetId, extra);
              }}
              disabled={actionId !== null}
            >
              <Check className="h-4 w-4" />
              {actionId === approveTargetId ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Design</DialogTitle>
            <DialogDescription>
              Add a short reason to help the client fix the submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="design-reject-reason">Rejection Reason</Label>
            <textarea
              id="design-reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={4}
              placeholder="Describe why this design was rejected..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-red-500 dark:focus:ring-red-900/40"
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                rejectTargetId && handleReject(rejectTargetId, rejectReason.trim())
              }
              disabled={
                !rejectTargetId ||
                rejectReason.trim().length === 0 ||
                actionId !== null
              }
            >
              {actionId === rejectTargetId ? "Rejecting..." : "Reject Design"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
