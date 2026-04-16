import { z } from "zod";

// designSubmissionSchema: Validates metadata for client design review uploads
export const designSubmissionSchema = z.object({
  templateId: z.string().optional(),
  title: z.string().max(150).optional(),
  notes: z.string().max(1000).optional(),
});

// designSubmissionQuerySchema: Basic filtering for client's historical submissions
export const designSubmissionQuerySchema = z.object({
  status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
});

// adminDesignSubmissionQuerySchema: Extensive filters for admin workflow management of designs
export const adminDesignSubmissionQuerySchema = z.object({
  status: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
  clientId: z.string().optional(),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  sort: z.enum(["submittedAt.desc", "submittedAt.asc"]).optional().default("submittedAt.desc"),
});

// adminApproveSubmissionSchema: Allows admin to add a final approval note and an optional extra price surcharge
export const adminApproveSubmissionSchema = z.object({
  note: z.string().max(500).optional(),
  extraPrice: z.number().min(0).optional().default(0),
});

// adminRejectSubmissionSchema: Requires a clear feedback message for the client upon rejection
export const adminRejectSubmissionSchema = z.object({
  feedbackMessage: z.string().max(1000),
});
