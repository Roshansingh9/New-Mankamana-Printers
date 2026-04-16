import { Request, Response } from "express";
import {
  createDesignSubmissionService,
  getMySubmissionsService,
  getMySubmissionByIdService,
  getAdminSubmissionsService,
  getAdminSubmissionByIdService,
  approveSubmissionService,
  rejectSubmissionService
} from "../../services/design/design-submission.service";
import { designSubmissionSchema, designSubmissionQuerySchema, adminDesignSubmissionQuerySchema, adminApproveSubmissionSchema, adminRejectSubmissionSchema } from "../../validators/design-submission.validator";
import { AppError } from "../../utils/apperror";
import { uploadToSupabase, downloadFromSupabase } from "../../utils/file-upload";

// createDesignSubmission: Handles client uploads for new design reviews, including Supabase file storage
export const createDesignSubmission = async (req: Request, res: Response, next: any) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: [{ field: "file", message: "File is required" }] });
    }

    const { templateId, productId, title, notes } = req.body;
    const clientId = (req as any).user.id; // User must be authenticated as client

    // Validate body
    const validatedBody = designSubmissionSchema.safeParse({ templateId, title, notes });
    if (!validatedBody.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validatedBody.error.issues });
    }

    let fileUrl = "";
    try {
      fileUrl = await uploadToSupabase(file, "designs/submissions");
    } catch (uploadError: any) {
      return res.status(500).json({ success: false, message: "File upload failed", error: uploadError.message });
    }

    const submission = await createDesignSubmissionService({
      clientId,
      templateId: validatedBody.data.templateId,
      productId: typeof productId === "string" ? productId : undefined,
      title: validatedBody.data.title,
      notes: validatedBody.data.notes,
      fileUrl: fileUrl,
      fileType: file.mimetype === "application/pdf" ? "pdf" : (file.mimetype.includes("png") ? "png" : "jpg"),
      fileSize: file.size,
    });

    res.status(201).json({
      success: true,
      message: "Design submitted successfully",
      data: {
        submissionId: submission.id,
        status: submission.status,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    console.error("Error submitting design:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getMySubmissions: Lists all review requests submitted by the currently logged-in client
export const getMySubmissions = async (req: Request, res: Response) => {
  try {
    const validatedQuery = designSubmissionQuerySchema.safeParse(req.query);
    if (!validatedQuery.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validatedQuery.error.issues });
    }

    const { status, page, limit } = validatedQuery.data;
    const clientId = (req as any).user.id;

    const data = await getMySubmissionsService({
      clientId,
      status: status as any,
      page: page || 1,
      limit: limit || 10,
    });

    // Formatting response to fit spec exactly
    const items = data.items.map((i: any) => ({
      submissionId: i.id,
      title: i.title,
      status: i.status,
      template: i.template ? { id: i.template.id, title: i.template.title } : null,
      submittedAt: i.submittedAt,
      feedbackMessage: i.feedbackMessage,
      approvedDesignId: i.approvedDesignId,
      designCode: i.approvedDesign?.designCode ?? null,
      approvedFileUrl: i.approvedDesign?.approvedFileUrl ?? null,
      approvedAt: i.approvedDesign?.approvedAt ?? null,
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: data.pagination,
      },
    });
  } catch (error) {
    console.error("Error fetching my submissions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getMySubmissionById: Fetches detailed status and feedback for a specific client submission
export const getMySubmissionById = async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.submissionId as string;
    const clientId = (req as any).user.id;

    const submission = await getMySubmissionByIdService(submissionId, clientId);

    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        submissionId: submission.id,
        title: submission.title,
        notes: submission.notes,
        status: submission.status,
        fileUrl: submission.fileUrl,
        template: submission.template ? { id: submission.template.id, title: submission.template.title } : null,
        feedbackMessage: submission.feedbackMessage,
        submittedAt: submission.submittedAt,
        reviewedAt: submission.reviewedAt,
        approvedDesignId: submission.approvedDesignId,
      },
    });
  } catch (error) {
    console.error("Error fetching my submission:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getAdminSubmissions: Admin overview of all pending and reviewed design submissions
export const getAdminSubmissions = async (req: Request, res: Response) => {
  try {
    const validatedQuery = adminDesignSubmissionQuerySchema.safeParse(req.query);
    if (!validatedQuery.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validatedQuery.error.issues });
    }

    const { status, clientId, page, limit, sort } = validatedQuery.data;

    const data = await getAdminSubmissionsService({
      status: status as any,
      clientId,
      page: page || 1,
      limit: limit || 20,
      sort: sort as any,
    });

    const items = data.items.map((i: any) => ({
      submissionId: i.id,
      title: i.title,
      status: i.status,
      notes: i.notes,
      fileUrl: i.fileUrl,
      fileType: i.fileType,
      client: i.client ? { id: i.client.id, name: i.client.business_name, phone: i.client.phone_number } : null,
      product: i.product ? { id: i.product.id, name: i.product.name } : null,
      submittedAt: i.submittedAt,
      designCode: i.approvedDesign?.designCode ?? null,
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: data.pagination,
      },
    });
  } catch (error) {
    console.error("Error fetching admin submissions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getAdminSubmissionById: Retrieves full technical details of a submission for admin review
export const getAdminSubmissionById = async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.submissionId as string;
    const submission = await getAdminSubmissionByIdService(submissionId);

    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        submissionId: submission.id,
        title: submission.title,
        notes: submission.notes,
        status: submission.status,
        fileUrl: submission.fileUrl,
        fileType: submission.fileType,
        fileSize: submission.fileSize,
        template: submission.template ? { id: submission.template.id, title: submission.template.title } : null,
        client: submission.client ? { id: submission.client.id, name: submission.client.business_name, phone: submission.client.phone_number } : null,
        feedbackMessage: submission.feedbackMessage,
        submittedAt: submission.submittedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching admin submission by ID:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// approveSubmission: Transition a submission to APPROVED and generate a permanent design code
export const approveSubmission = async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.submissionId as string;
    const adminId = (req as any).user.id;

    const validatedBody = adminApproveSubmissionSchema.safeParse(req.body);
    if (!validatedBody.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validatedBody.error.issues });
    }

    const { note, extraPrice } = validatedBody.data;

    const result = await approveSubmissionService(submissionId, adminId, note, extraPrice);

    res.status(201).json({
      success: true,
      message: "Design approved successfully",
      data: {
        approvedDesignId: result.approvedDesign.id,
        designCode: result.approvedDesign.designCode,
        status: result.approvedDesign.status,
      },
    });
  } catch (error: any) {
    console.error("Error approving submission:", error);
    res.status(400).json({ success: false, message: error.message || "Approval failed" });
  }
};

// rejectSubmission: Rejects a submission and provides feedback to the client
export const rejectSubmission = async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.submissionId as string;
    const adminId = (req as any).user.id;

    const validatedBody = adminRejectSubmissionSchema.safeParse(req.body);
    if (!validatedBody.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validatedBody.error.issues });
    }

    const { feedbackMessage } = validatedBody.data;

    const updatedSubmission = await rejectSubmissionService(submissionId, adminId, feedbackMessage);

    res.status(200).json({
      success: true,
      message: "Design rejected successfully",
      data: {
        submissionId: updatedSubmission.id,
        status: "REJECTED",
        feedbackMessage: updatedSubmission.feedbackMessage,
        reviewedAt: updatedSubmission.reviewedAt,
      },
    });
  } catch (error: any) {
    console.error("Error rejecting submission:", error);
    res.status(400).json({ success: false, message: error.message || "Rejection failed" });
  }
};

// getAdminSubmissionFile: Admin proxy — streams any design submission file for admin review
export const getAdminSubmissionFile = async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.submissionId as string;
    const submission = await getAdminSubmissionByIdService(submissionId);
    if (!submission) return res.status(404).end();

    const filePath = (submission as any).fileUrl;
    if (!filePath) return res.status(404).end();

    if (filePath.startsWith("http")) return res.redirect(302, filePath);

    const { buffer, mimeType } = await downloadFromSupabase(filePath);
    const ext = filePath.split(".").pop() || "bin";
    const fileName = (submission as any).title
      ? `${String((submission as any).title).replace(/[^a-zA-Z0-9_\-. ]/g, "_")}.${ext}`
      : "design-file";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.setHeader("Cache-Control", "private, max-age=120");
    return res.send(buffer);
  } catch (error) {
    console.error("Error proxying admin design submission file:", error);
    return res.status(500).end();
  }
};

// getMySubmissionFile: Client proxy — streams the submitted design file from private Supabase storage
export const getMySubmissionFile = async (req: Request, res: Response) => {
  try {
    const submissionId = req.params.submissionId as string;
    const clientId = (req as any).user.id;

    const submission = await getMySubmissionByIdService(submissionId, clientId);
    if (!submission) return res.status(404).end();

    const filePath = submission.fileUrl;
    if (!filePath) return res.status(404).end();

    if (filePath.startsWith("http")) return res.redirect(302, filePath);

    const { buffer, mimeType } = await downloadFromSupabase(filePath);
    const fileName = submission.title
      ? `${submission.title.replace(/[^a-zA-Z0-9_\-. ]/g, "_")}.${filePath.split(".").pop() || "bin"}`
      : "design-file";
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.setHeader("Cache-Control", "private, max-age=120");
    return res.send(buffer);
  } catch (error) {
    console.error("Error proxying design submission file:", error);
    return res.status(500).end();
  }
};
