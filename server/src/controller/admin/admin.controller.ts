import { Request, Response, NextFunction } from "express";
import * as adminService from "../../services/admin/admin.service";
import { AppError } from "../../utils/apperror";

// getRegistrationRequests: Fetches a list of client sign-up requests, optional filtering by status and search
export const getRegistrationRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, search } = req.query;
    const result = await adminService.getRegistrationRequestsService({ 
      status: status as string, 
      search: search as string 
    });
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

// createRegistrationRequest: Public handler for new clients to submit their business details for review
export const createRegistrationRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await adminService.createRegistrationRequestService(req.body);
    res.status(201).json(result);
  } catch (error: any) {
    next(error);
  }
};

// getRegistrationRequestById: Returns the full details of a specific registration application
export const getRegistrationRequestById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { request_id } = req.params;
    const result = await adminService.getRegistrationRequestByIdService(request_id as string);
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

// approveRegistrationRequest: Converts a request into a Client account, generates a randomized password, and initializes their wallet
export const approveRegistrationRequest = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { request_id } = req.params;
    const admin_id = req.user.id;

    const result = await adminService.approveRegistrationRequestService(request_id as string, admin_id);
    res.status(200).json({
      success: true,
      message: "Client approved successfully. Credentials sent to client email.",
      data: {
        clientId: result.credentials.phone_number,
        clientUuid: result.client.id,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

// rejectRegistrationRequest: Marks a request as REJECTED and saves a reason provided by the admin
export const rejectRegistrationRequest = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { request_id } = req.params;
    const admin_id = req.user.id;
    const { reason } = req.body;

    const result = await adminService.rejectRegistrationRequestService(request_id as string, admin_id, reason);
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

// markCredentialsSent controller removed as fields are deleted from schema

// getClients: Retrieves a comprehensive list of all verified clients in the platform
export const getClients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getClientsService();
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

// getClientById: Fetches the profile and current account status of a single client
export const getClientById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await adminService.getClientByIdService(id as string);
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

// resetClientPassword: Generates a new password for a client, stores the hash, and emails the new credentials
export const resetClientPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await adminService.resetClientPasswordService(id as string);
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

// toggleClientStatus: Activates or deactivates a client account and sends email on deactivation
export const toggleClientStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await adminService.toggleClientStatusService(id, reason);
    res.status(200).json(result);
  } catch (error: any) {
    next(error);
  }
};

// getClientOrders: Returns all orders placed by a specific client for admin view
export const getClientOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await adminService.getClientOrdersAdminService(id);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    next(error);
  }
};

// getClientDesigns: Returns all design submissions by a specific client for admin view
export const getClientDesigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await adminService.getClientDesignsAdminService(id);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    next(error);
  }
};