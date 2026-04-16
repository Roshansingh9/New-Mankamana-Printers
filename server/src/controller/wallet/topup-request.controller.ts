import { Request, Response } from "express";
import {
  submitTopupService,
  getClientTopupsService,
  getClientTopupByIdService,
  getAdminTopupsService,
  getAdminTopupByIdService,
  approveTopupService,
  rejectTopupService,
  adjustApprovedTopupService,
} from "../../services/wallet/topup-request.service";
import {
  submitTopupSchema,
  topupQuerySchema,
  adminTopupQuerySchema,
  approveTopupSchema,
  rejectTopupSchema,
  adjustTopupSchema,
} from "../../validators/wallet.validator";
import { uploadToSupabase, downloadFromSupabase } from "../../utils/file-upload";
import { withRequestDedupe } from "../../utils/request-dedupe";

// submitTopupRequest: Allows a client to submit a proof-of-payment (file) for balance top-up approval
export const submitTopupRequest = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "Payment proof file is required" });
    }

    const validated = submitTopupSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    // Upload proof to Supabase private bucket
    let proofUrl: string;
    try {
      proofUrl = await uploadToSupabase(file, "wallet/payment-proofs");
    } catch (uploadError: any) {
      return res.status(500).json({ success: false, message: "Proof upload failed", error: uploadError.message });
    }

    const clientId = (req as any).user.id;
    const request = await submitTopupService({
      clientId,
      submittedAmount: validated.data.amount,
      paymentMethod: validated.data.paymentMethod as "BANK_TRANSFER",
      transferReference: validated.data.transferReference,
      note: validated.data.note,
      proofFilePath: proofUrl,
      proofFileName: file.originalname,
      proofMimeType: file.mimetype,
      proofFileSize: file.size,
    });

    res.status(201).json({
      success: true,
      message: "Top-up request submitted successfully",
      data: {
        requestId: request.id,
        status: request.status,
        submittedAmount: Number(request.submittedAmount),
        submittedAt: request.createdAt,
      },
    });
  } catch (error) {
    console.error("Error submitting topup:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getMyTopupRequests: Lists all pending and processed top-up requests for the current client
export const getMyTopupRequests = async (req: Request, res: Response) => {
  try {
    const validated = topupQuerySchema.safeParse(req.query);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const clientId = (req as any).user.id;
    const data = await getClientTopupsService({
      clientId,
      status: validated.data.status,
      page: validated.data.page,
      limit: validated.data.limit,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching topup requests:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getMyTopupRequestById: Returns the specifics and status of a single top-up request
export const getMyTopupRequestById = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    const clientId = (req as any).user.id;

    const request = await getClientTopupByIdService(requestId, clientId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Top-up request not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        requestId: request.id,
        submittedAmount: Number(request.submittedAmount),
        approvedAmount: request.approvedAmount ? Number(request.approvedAmount) : null,
        paymentMethod: request.paymentMethod,
        transferReference: request.transferReference,
        note: request.note,
        proofFileUrl: request.proofFilePath,
        status: request.status,
        rejectionReason: request.rejectionReason,
        submittedAt: request.createdAt,
        reviewedAt: request.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching topup request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getAdminTopupRequests: Admin-only view to browse and filter all top-up submissions across the platform
export const getAdminTopupRequests = async (req: Request, res: Response) => {
  try {
    const validated = adminTopupQuerySchema.safeParse(req.query);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const data = await getAdminTopupsService({
      status: validated.data.status,
      clientId: validated.data.clientId,
      paymentMethod: validated.data.paymentMethod,
      page: validated.data.page,
      limit: validated.data.limit,
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching admin topup requests:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getAdminTopupRequestById: Detailed administrative view of a specific top-up request, including proof file
export const getAdminTopupRequestById = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    const request = await getAdminTopupByIdService(requestId);

    if (!request) {
      return res.status(404).json({ success: false, message: "Top-up request not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        requestId: request.id,
        client: request.client
          ? { id: request.client.id, name: request.client.business_name, phone: request.client.phone_number }
          : null,
        submittedAmount: Number(request.submittedAmount),
        approvedAmount: request.approvedAmount ? Number(request.approvedAmount) : null,
        paymentMethod: request.paymentMethod,
        transferReference: request.transferReference,
        note: request.note,
        proofFileUrl: request.proofFilePath,
        status: request.status,
        rejectionReason: request.rejectionReason,
        submittedAt: request.createdAt,
        reviewedAt: request.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching admin topup request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// approveTopupRequest: Validates a payment and adds the approved amount to the client's wallet
export const approveTopupRequest = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    const adminId = (req as any).user.id;

    const validated = approveTopupSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const result = await withRequestDedupe(
      `admin:topup:approve:${adminId}:${requestId}`,
      () =>
        approveTopupService(
          requestId,
          adminId,
          validated.data.approvedAmount,
          validated.data.note
        ),
      8000
    );

    res.status(200).json({
      success: true,
      message: "Top-up request approved successfully",
      data: {
        requestId: result.request.id,
        status: "APPROVED",
        submittedAmount: Number(result.request.submittedAmount),
        approvedAmount: Number(result.request.approvedAmount),
        walletTransactionId: result.transaction.id,
        newWalletBalance: result.newBalance,
        approvedAt: result.request.reviewedAt,
      },
    });
  } catch (error: any) {
    console.error("Error approving topup:", error);
    res.status(400).json({ success: false, message: error.message || "Approval failed" });
  }
};

// rejectTopupRequest: Denies a top-up request and provides a rejection reason to the client
export const rejectTopupRequest = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    const adminId = (req as any).user.id;

    const validated = rejectTopupSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const result = await withRequestDedupe(
      `admin:topup:reject:${adminId}:${requestId}`,
      () =>
        rejectTopupService(
          requestId,
          adminId,
          validated.data.reason,
          validated.data.reasonCode
        ),
      8000
    );

    res.status(200).json({
      success: true,
      message: "Top-up request rejected successfully",
      data: {
        requestId: result.id,
        status: "REJECTED",
        reason: result.rejectionReason,
        reviewedAt: result.reviewedAt,
      },
    });
  } catch (error: any) {
    console.error("Error rejecting topup:", error);
    res.status(400).json({ success: false, message: error.message || "Rejection failed" });
  }
};

export const adjustApprovedTopupRequest = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    const adminId = (req as any).user.id;

    const validated = adjustTopupSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validated.error.issues });
    }

    const result = await withRequestDedupe(
      `admin:topup:adjust:${adminId}:${requestId}`,
      () =>
        adjustApprovedTopupService(
          requestId,
          adminId,
          validated.data.approvedAmount,
          validated.data.reason
        ),
      8000
    );

    return res.status(200).json({
      success: true,
      message: "Top-up adjustment applied successfully",
      data: {
        requestId: result.request.id,
        adjustedApprovedAmount: Number(result.request.approvedAmount),
        previousApprovedAmount: result.previousApproved,
        delta: result.delta,
        walletTransactionId: result.transaction.id,
        newWalletBalance: result.newBalance,
        reviewedAt: result.request.reviewedAt,
      },
    });
  } catch (error: any) {
    console.error("Error adjusting topup:", error);
    return res.status(400).json({ success: false, message: error.message || "Adjustment failed" });
  }
};

// getTopupProof: Admin proxy that downloads the payment proof from Supabase and streams it to the browser
export const getTopupProof = async (req: Request, res: Response) => {
  try {
    const requestId = req.params.requestId as string;
    const request = await getAdminTopupByIdService(requestId);
    if (!request?.proofFilePath) return res.status(404).end();

    const proofPath = request.proofFilePath;
    if (proofPath.startsWith("http")) return res.redirect(302, proofPath);

    const { buffer, mimeType } = await downloadFromSupabase(proofPath);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${request.proofFileName || "proof"}"`);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.send(buffer);
  } catch (error) {
    console.error("Error proxying topup proof:", error);
    return res.status(500).end();
  }
};
