export type DesignStatusUi = "Pending" | "Approved" | "Rejected";

export interface DesignListItem {
  id: string;
  title: string;
  client: string;
  designer: string;
  submittedDate: string;
  status: DesignStatusUi;
  image: string;
  fileUrl?: string;
  fileType?: string;
  designCode?: string;
  productName?: string;
}

interface SubmissionApi {
  submissionId: string;
  title: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  submittedAt: string;
  fileUrl?: string | null;
  fileType?: string | null;   // "pdf" | "png" | "jpg"
  notes?: string | null;
  designCode?: string | null;
  client?: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
  } | null;
  product?: {
    id?: string | null;
    name?: string | null;
  } | null;
}

const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toISOString().split("T")[0];
};

const safeJson = async (response: Response) => {
  const raw = await response.text();
  if (!raw || raw.trim().length === 0) return {};
  try { return JSON.parse(raw); } catch { return { message: raw }; }
};

import { cachedJsonFetch, invalidateCacheKey } from "@/lib/requestCache";

const mapSubmission = (s: SubmissionApi): DesignListItem => {
  // fileUrl from the API is a raw Supabase private storage path, not a URL.
  // Always use the proxy endpoint so the browser can actually load the file.
  const proxyUrl = s.fileUrl ? `/api/admin/designs/submissions/${s.submissionId}/file` : undefined;
  return {
    id: s.submissionId,
    title: s.title || `Submission ${s.submissionId.slice(0, 6)}`,
    client: s.client?.name || "Unknown Client",
    designer: s.client?.name || "Client",
    submittedDate: formatDate(s.submittedAt),
    status: s.status === "PENDING_REVIEW" ? "Pending" : s.status === "APPROVED" ? "Approved" : "Rejected",
    // image only used for non-PDF thumbnails; PDF cards show a document icon instead
    image: s.fileType === "pdf" ? "" : (proxyUrl || ""),
    fileUrl: proxyUrl,
    fileType: s.fileType || undefined,
    designCode: s.designCode ?? undefined,
    productName: s.product?.name ?? undefined,
  };
};

const DESIGNS_CACHE_KEY = "admin-designs-submissions";

// fetchAllDesignSubmissions: Loads ALL submissions (pending + approved + rejected) for the admin review page.
// Cached for 15 s so the page loads instantly on revisit; invalidated after approve/reject.
export const fetchAllDesignSubmissions = async (): Promise<DesignListItem[]> => {
  const data = await cachedJsonFetch<any>(DESIGNS_CACHE_KEY, "/api/admin/designs/submissions?limit=200", 15_000);
  if (!data?.data) throw new Error(data?.message || "Failed to load design submissions.");
  return (data.data.items || []).map(mapSubmission);
};

export const invalidateDesignsCache = () => invalidateCacheKey(DESIGNS_CACHE_KEY);

export const approveDesignSubmission = async (
  submissionId: string,
  note?: string,
  extraPrice?: number
) => {
  const response = await fetch("/api/admin/designs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId, note, extraPrice }),
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to approve design.");
  }

  invalidateDesignsCache();
  return data;
};

export const rejectDesignSubmission = async (
  submissionId: string,
  reason: string
) => {
  const response = await fetch(
    `/api/admin/designs/submissions/${submissionId}/reject`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedbackMessage: reason }),
    }
  );

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to reject design.");
  }

  invalidateDesignsCache();
  return data;
};
