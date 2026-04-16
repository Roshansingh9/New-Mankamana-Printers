import prisma from "../../connect";
import { AppError } from "../../utils/apperror";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { sendClientCredentials, sendPasswordReset, sendClientDeactivated, sendClientProfileUpdated } from "../../utils/email";

// getRegistrationRequestsService: Logic to fetch registration requests with optional status and search filtering
export const getRegistrationRequestsService = async (filters: { status?: string; search?: string } = {}) => {
  const { status, search } = filters;
  
  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { business_name: { contains: search, mode: "insensitive" } },
      { phone_number: { contains: search } },
    ];
  }

  const data = await prisma.registrationRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return {
    message: "Registration requests fetched successfully",
    data,
  };
};

// createRegistrationRequestService: Validates and persists a new client registration attempt
export const createRegistrationRequestService = async (data: {
  business_name: string;
  owner_name: string;
  email: string;
  phone_number: string;
  business_address?: string;
  notes?: string;
}) => {
  // Check if already an active client with this phone
  const existingClient = await prisma.client.findUnique({
    where: { phone_number: data.phone_number }
  });
  if (existingClient) {
    throw new AppError("This phone number is already registered as a client. Please log in.", 400);
  }

  // Check if already an active client with this email
  const clientByEmail = await prisma.client.findFirst({
    where: { email: data.email }
  });
  if (clientByEmail) {
    throw new AppError("This email address is already registered as a client. Please log in.", 400);
  }

  // Check for any existing request with this phone number (any status)
  const existingRequest = await prisma.registrationRequest.findFirst({
    where: { phone_number: data.phone_number }
  });
  if (existingRequest) {
    if (existingRequest.status === "PENDING") {
      throw new AppError("A registration request for this phone number is already pending review.", 400);
    }
    if (existingRequest.status === "APPROVED") {
      throw new AppError("This phone number has already been approved. Please log in with your credentials.", 400);
    }
    if (existingRequest.status === "REJECTED") {
      throw new AppError("A previous registration request for this phone number was rejected. Please contact New Mankamana Printers for assistance.", 400);
    }
  }

  // Check for any existing request with the same business name (case-insensitive)
  const existingByBusiness = await prisma.registrationRequest.findFirst({
    where: {
      business_name: { equals: data.business_name, mode: "insensitive" },
      status: { in: ["PENDING", "APPROVED"] }
    }
  });
  if (existingByBusiness) {
    throw new AppError("A registration request for this business name already exists.", 400);
  }

  const newRequest = await prisma.registrationRequest.create({
    data: {
      ...data,
      status: "PENDING"
    },
  });

  return {
    message: "Registration request submitted successfully",
    data: {
      id: newRequest.id,
      status: newRequest.status,
    },
  };
};

// getRegistrationRequestByIdService: Fetches a single registration request by its ID
export const getRegistrationRequestByIdService = async (request_id: string) => {
  const data = await prisma.registrationRequest.findUnique({
    where: { id: request_id },
  });

  if (!data) throw new AppError("Request not found", 404);

  return {
    message: "Registration request fetched",
    data,
  };
};

// approveRegistrationRequestService: Handles the atomic transition of a request to a Client account, including password generation
export const approveRegistrationRequestService = async (request_id: string, admin_id: string) => {
  const request = await prisma.registrationRequest.findUnique({
    where: { id: request_id },
  });

  if (!request) throw new AppError("Registration request not found", 404);
  if (request.status !== "PENDING") throw new AppError("Request is not in pending status", 400);

  const phone_number = request.phone_number;

  // Final check for existing client
  const existingClient = await prisma.client.findUnique({ where: { phone_number } });
  if (existingClient) throw new AppError("Client already exists for this phone number", 400);

  const clientCode = "MP" + randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars, cryptographically random
  const rawPassword = randomBytes(8).toString("base64url"); // ~11 chars, URL-safe, cryptographically random
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const result = await prisma.$transaction(async (tx: any) => {
    const newClient = await tx.client.create({
      data: {
        client_code: clientCode,
        phone_number: phone_number,
        password: hashedPassword,
        business_name: request.business_name,
        owner_name: request.owner_name,
        email: request.email,
        address: request.business_address,
        status: "active"
      }
    });

    await tx.walletAccount.create({
      data: {
        clientId: newClient.id,
        currency: "NPR",
        availableBalance: 0,
      },
    });

    const updatedRequest = await tx.registrationRequest.update({
      where: { id: request_id },
      data: {
        status: "APPROVED"
      }
    });

    return { newClient, updatedRequest };
  });

  // Send credentials to client via email (non-blocking — failure doesn't roll back approval)
  sendClientCredentials({
    to: request.email,
    businessName: request.business_name,
    clientCode,
    phoneNumber: phone_number,
    password: rawPassword,
  }).catch((err) => console.error("[Email] Failed to send credentials:", err));

  return {
    message: "Client approved and created successfully",
    credentials: {
      phone_number: phone_number,
      // rawPassword intentionally NOT returned — sent to client via email only
    },
    client: result.newClient
  };
};

// rejectRegistrationRequestService: Updates a request status to REJECTED and saves the admin's reason
export const rejectRegistrationRequestService = async (request_id: string, admin_id: string, reason: string) => {
  const request = await prisma.registrationRequest.findUnique({
    where: { id: request_id },
  });

  if (!request) throw new AppError("Request not found", 404);
  if (request.status !== "PENDING") throw new AppError("Request is not in pending status", 400);

  await prisma.registrationRequest.update({
    where: { id: request_id },
    data: {
      status: "REJECTED",
      rejection_reason: reason
    },
  });

  return { message: "Registration request rejected" };
};

// markCredentialsSentService removed as fields are deleted from schema

// getClientsService: Fetches all clients from the database (password excluded)
export const getClientsService = async () => {
  const data = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      client_code: true,
      phone_number: true,
      business_name: true,
      owner_name: true,
      email: true,
      address: true,
      status: true,
      createdAt: true,
    },
  });
  return { message: "Clients fetched", data };
};

// getClientByIdService: Retrieves a detailed client record including their profile info (password excluded)
export const getClientByIdService = async (id: string) => {
  const data = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      client_code: true,
      phone_number: true,
      business_name: true,
      owner_name: true,
      email: true,
      address: true,
      status: true,
      createdAt: true,
    },
  });
  if (!data) throw new AppError("Client not found", 404);
  return { message: "Client fetched", data };
};

// updateClientProfileService: Allows admin to update mutable client fields; sends a diff email to the client
export const updateClientProfileService = async (
  clientId: string,
  updates: Partial<{
    business_name: string;
    owner_name: string;
    email: string;
    phone_number: string;
    address: string;
  }>
) => {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError("Client not found", 404);

  // Build the diff for the notification email
  const FIELD_LABELS: Record<string, string> = {
    business_name: "Business Name",
    owner_name: "Owner Name",
    email: "Email Address",
    phone_number: "Phone Number",
    address: "Address",
  };

  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];
  const data: Record<string, string> = {};

  for (const [key, newVal] of Object.entries(updates)) {
    if (newVal === undefined || newVal === null) continue;
    const trimmed = String(newVal).trim();
    if (!trimmed) continue;
    const oldVal = String((client as any)[key] ?? "").trim();
    if (trimmed !== oldVal) {
      changes.push({ field: FIELD_LABELS[key] ?? key, oldValue: oldVal || "—", newValue: trimmed });
      data[key] = trimmed;
    }
  }

  if (Object.keys(data).length === 0) {
    return { message: "No changes detected.", data: client };
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data,
    select: {
      id: true, client_code: true, phone_number: true, business_name: true,
      owner_name: true, email: true, address: true, status: true, createdAt: true,
    },
  });

  // Send notification email (non-blocking)
  sendClientProfileUpdated({
    to: updated.email,
    ownerName: updated.owner_name,
    businessName: updated.business_name,
    changes,
  }).catch((err) => console.error("[Email] Failed to send profile updated email:", err));

  return { message: "Client profile updated successfully.", data: updated };
};

// resetClientPasswordService: Generates a new password for a client, updates the hash, and emails the new credentials
export const resetClientPasswordService = async (clientId: string) => {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError("Client not found", 404);

  const newPassword = randomBytes(8).toString("base64url");
  const hashed = await bcrypt.hash(newPassword, 12);

  await prisma.client.update({
    where: { id: clientId },
    data: { password: hashed },
  });

  // Email the reset password (non-blocking)
  sendPasswordReset({
    to: client.email,
    ownerName: client.owner_name,
    businessName: client.business_name,
    phoneNumber: client.phone_number,
    newPassword,
  }).catch((err) => console.error("[Email] Failed to send password reset email:", err));

  return {
    message: "Password reset successfully. New credentials sent to client email.",
    credentials: {
      phone_number: client.phone_number,
      // new_password intentionally NOT returned — sent to client via email only
    },
  };
};

// toggleClientStatusService: Activates or deactivates a client account; sends email on deactivation
export const toggleClientStatusService = async (clientId: string, reason?: string) => {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError("Client not found", 404);

  const newStatus = client.status === "active" ? "inactive" : "active";

  await prisma.client.update({
    where: { id: clientId },
    data: { status: newStatus },
  });

  if (newStatus === "inactive") {
    sendClientDeactivated({
      to: client.email,
      ownerName: client.owner_name,
      businessName: client.business_name,
      reason,
    }).catch((err) => console.error("[Email] Failed to send deactivation email:", err));
  }

  return {
    message: `Client account ${newStatus === "active" ? "activated" : "deactivated"} successfully.`,
    status: newStatus,
  };
};

// getClientOrdersAdminService: Returns all orders placed by a specific client for admin view
export const getClientOrdersAdminService = async (clientId: string) => {
  return await prisma.order.findMany({
    where: { user_id: clientId },
    include: {
      variant: { select: { variant_name: true, product: { select: { name: true } } } },
      approvedDesign: { select: { designCode: true } },
    },
    orderBy: { created_at: "desc" },
  });
};

// getClientDesignsAdminService: Returns all design submissions by a specific client for admin view
export const getClientDesignsAdminService = async (clientId: string) => {
  return await prisma.designSubmission.findMany({
    where: { clientId },
    select: {
      id: true,
      title: true,
      status: true,
      submittedAt: true,
      fileUrl: true,
      fileType: true,
      feedbackMessage: true,
      approvedDesign: { select: { designCode: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
};
