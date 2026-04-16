import prisma from "../../connect";
import { Prisma } from "@prisma/client";
import { sendDesignApproved, sendDesignRejected } from "../../utils/email";

// createDesignSubmissionService: Atomic transaction to submit a new design for review
export const createDesignSubmissionService = async (data: {
  clientId: string;
  templateId?: string;
  productId?: string;
  title?: string;
  notes?: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}) => {
  return await prisma.$transaction(async (tx) => {
    const submission = await tx.designSubmission.create({
      data: {
        clientId: data.clientId,
        templateId: data.templateId,
        productId: data.productId,
        title: data.title,
        notes: data.notes,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
        status: "PENDING_REVIEW",
      },
    });

    // Create an admin notification internally
    // Currently, notification table is for clients as per schema but we can just skip or add a log.
    
    return submission;
  });
};

// getMySubmissionsService: Paginated history of design reviews for a specific client
export const getMySubmissionsService = async (options: {
  clientId: string;
  status?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  page: number;
  limit: number;
}) => {
  const { clientId, status, page, limit } = options;

  const where: any = { clientId };
  if (status) {
    where.status = status;
  }

  const [items, totalItems] = await Promise.all([
    prisma.designSubmission.findMany({
      where,
      include: {
        template: { select: { id: true, title: true } },
        approvedDesign: { select: { designCode: true, approvedFileUrl: true, approvedAt: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { submittedAt: "desc" },
    }),
    prisma.designSubmission.count({ where }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return { items, pagination: { page, limit, totalItems, totalPages } };
};

// getMySubmissionByIdService: Detailed status check for a client's own submission
export const getMySubmissionByIdService = async (submissionId: string, clientId: string) => {
  return await prisma.designSubmission.findFirst({
    where: { id: submissionId, clientId },
    include: {
      template: { select: { id: true, title: true } },
    },
  });
};

// getAdminSubmissionsService: Paginated administrative overview of all pending/reviewed submissions
export const getAdminSubmissionsService = async (options: {
  status?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  clientId?: string;
  page: number;
  limit: number;
  sort: "submittedAt.desc" | "submittedAt.asc";
}) => {
  const { status, clientId, page, limit, sort } = options;

  const where: any = {};
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;

  const [items, totalItems] = await Promise.all([
    prisma.designSubmission.findMany({
      where,
      include: {
        client: { select: { id: true, business_name: true, phone_number: true } },
        product: { select: { id: true, name: true } },
        approvedDesign: { select: { designCode: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { submittedAt: sort === "submittedAt.desc" ? "desc" : "asc" },
    }),
    prisma.designSubmission.count({ where }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  return { items, pagination: { page, limit, totalItems, totalPages } };
};

// getAdminSubmissionByIdService: Full technical details of a submission for administrative review
export const getAdminSubmissionByIdService = async (submissionId: string) => {
  return await prisma.designSubmission.findUnique({
    where: { id: submissionId },
    include: {
      client: { select: { id: true, business_name: true, phone_number: true } },
      template: { select: { id: true, title: true } },
    },
  });
};

// approveSubmissionService: Complex atomic transaction that marks a submission as approved and creates its public design identity
export const approveSubmissionService = async (
  submissionId: string,
  adminId: string,
  note?: string,
  extraPrice?: number
) => {
  // Pre-flight check and email data fetch before transaction
  const submissionWithClient = await prisma.designSubmission.findUnique({
    where: { id: submissionId },
    include: { client: { select: { email: true, business_name: true } } },
  });

  if (!submissionWithClient) throw new Error("Submission not found");
  if (submissionWithClient.status !== "PENDING_REVIEW") {
    throw new Error(
      submissionWithClient.status === "APPROVED"
        ? "This submission has already been approved."
        : "This submission has already been reviewed and cannot be approved."
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read inside transaction to guard against concurrent approval
      const submission = await tx.designSubmission.findUnique({ where: { id: submissionId } });
      if (!submission) throw new Error("Submission not found");
      if (submission.status !== "PENDING_REVIEW") {
        throw new Error(
          submission.status === "APPROVED"
            ? "This submission has already been approved."
            : "This submission has already been reviewed and cannot be approved."
        );
      }

      // Generate cryptographically random design code
      const { randomBytes } = await import("crypto");
      const nanoId = randomBytes(3).toString("hex").toUpperCase();
      const designCode = `DSN-${new Date().getFullYear()}-${nanoId}`;

      const approvedDesign = await tx.approvedDesign.create({
        data: {
          designCode,
          clientId: submission.clientId,
          submissionId: submission.id,
          approvedFileUrl: submission.fileUrl,
          approvedBy_id: adminId,
          // Copy productId from submission so we can filter by product in checkout
          productId: (submission as any).productId ?? null,
          extraPrice: extraPrice ?? 0,
          status: "ACTIVE",
        },
      });

      const updatedSubmission = await tx.designSubmission.update({
        where: { id: submissionId },
        data: {
          status: "APPROVED",
          approvedDesignId: approvedDesign.id,
          reviewedBy_id: adminId,
          reviewedAt: new Date(),
          feedbackMessage: note,
        },
      });

      return { submission: updatedSubmission, approvedDesign };
    });

    // Send approval email (non-blocking)
    if (submissionWithClient.client) {
      sendDesignApproved({
        to: submissionWithClient.client.email,
        businessName: submissionWithClient.client.business_name,
        designCode: result.approvedDesign.designCode,
        designTitle: submissionWithClient.title ?? undefined,
      }).catch((err) => console.error("[Email] Failed to send design approval:", err));
    }

    return result;
  } catch (err: any) {
    // P2002: unique constraint on submissionId — a concurrent request already created the ApprovedDesign
    if (err?.code === "P2002") {
      throw new Error("This submission has already been approved (concurrent request).");
    }
    throw err;
  }
};

// rejectSubmissionService: Rejects a submission and captures administrative feedback for the client
export const rejectSubmissionService = async (
  submissionId: string,
  adminId: string,
  feedbackMessage: string
) => {
  // Fetch client email before transaction
  const submissionWithClient = await prisma.designSubmission.findUnique({
    where: { id: submissionId },
    include: { client: { select: { email: true, business_name: true } } },
  });

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const submission = await tx.designSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new Error("Submission not found");
    if (submission.status !== "PENDING_REVIEW") throw new Error("Submission is not pending review");

    return await tx.designSubmission.update({
      where: { id: submissionId },
      data: {
        status: "REJECTED",
        reviewedBy_id: adminId,
        reviewedAt: new Date(),
        feedbackMessage,
      },
    });
  });

  // Send rejection email (non-blocking)
  if (submissionWithClient?.client) {
    sendDesignRejected({
      to: submissionWithClient.client.email,
      businessName: submissionWithClient.client.business_name,
      designTitle: submissionWithClient.title ?? undefined,
      feedbackMessage,
    }).catch((err) => console.error("[Email] Failed to send design rejection:", err));
  }

  return updatedSubmission;
};
