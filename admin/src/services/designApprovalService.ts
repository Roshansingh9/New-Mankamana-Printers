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

const mapSubmission = (s: SubmissionApi): DesignListItem => ({
  id: s.submissionId,
  title: s.title || `Submission ${s.submissionId.slice(0, 6)}`,
  client: s.client?.name || "Unknown Client",
  designer: s.client?.name || "Client",
  submittedDate: formatDate(s.submittedAt),
  status: s.status === "PENDING_REVIEW" ? "Pending" : s.status === "APPROVED" ? "Approved" : "Rejected",
  // image only used for non-PDF thumbnails; PDF cards show a document icon instead
  image: s.fileType === "pdf" ? "" : (s.fileUrl || ""),
  fileUrl: s.fileUrl || undefined,
  fileType: s.fileType || undefined,
  designCode: s.designCode ?? undefined,
});

// fetchAllDesignSubmissions: Loads ALL submissions (pending + approved + rejected) for the admin review page.
// Using a single source avoids duplicate cards that occurred when merging submissions + approved-designs lists.
export const fetchAllDesignSubmissions = async (): Promise<DesignListItem[]> => {
  const response = await fetch("/api/admin/designs/submissions?limit=200", {
    method: "GET",
    cache: "no-store",
  });
  const data = await safeJson(response);
  if (!response.ok) throw new Error(data?.message || "Failed to load design submissions.");
  return (data?.data?.items || []).map(mapSubmission);
};

export const approveDesignSubmission = async (
  submissionId: string,
  note?: string
) => {
  const response = await fetch("/api/admin/designs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId, note }),
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to approve design.");
  }

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

  return data;
};
