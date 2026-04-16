import { Request, Response } from "express";
import {
  getMyApprovedDesignsService,
  getMyDesignByIdService,
  verifyDesignIdService,
  getAdminDesignsService,
  getAdminDesignByIdService,
  archiveDesignService
} from "../../services/design/approved-design.service";
import { verifyDesignSchema, adminApprovedDesignQuerySchema, archiveDesignSchema } from "../../validators/approved-design.validator";

// CLIENT APIs
// getMyDesigns: Lists all approved designs belonging to the logged-in client (for order form dropdown)
// Optional query param: ?productName=Card+Holders — returns only designs matching that product
export const getMyDesigns = async (req: Request, res: Response) => {
  try {
    const clientId = (req as any).user.id;
    const productId = (req.query.productId as string) || undefined;
    const productName = (req.query.productName as string) || undefined;
    const designs = await getMyApprovedDesignsService(clientId, productId, productName);

    res.status(200).json({
      success: true,
      data: designs.map((d: any) => ({
        designCode: d.designCode,
        title: d.submission?.title || null,
        approvedAt: d.approvedAt,
        status: d.status,
        approvedFileUrl: d.approvedFileUrl || null,
        extraPrice: Number(d.extraPrice ?? 0),
        categoryName: d.submission?.template?.category?.name || null,
        categorySlug: d.submission?.template?.category?.slug || null,
      })),
    });
  } catch (error) {
    console.error("Error fetching my designs:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getMyDesignById: Allows a client to fetch details of one of their approved designs
export const getMyDesignById = async (req: Request, res: Response) => {
  try {
    const { designId } = req.params;
    const clientId = (req as any).user.id; // User must be authenticated as client

    const design = await getMyDesignByIdService(designId as string, clientId);

    if (!design) {
      return res.status(404).json({ success: false, message: "Approved design not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        designId: design.designCode,
        status: design.status,
        submissionId: design.submissionId,
        approvedAt: design.approvedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching approved design:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// verifyDesignId: Checks if a public design code is valid and belongs to the client
export const verifyDesignId = async (req: Request, res: Response) => {
  try {
    const validatedBody = verifyDesignSchema.safeParse(req.body);
    if (!validatedBody.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validatedBody.error.issues });
    }

    const { designId } = validatedBody.data;
    const clientId = (req as any).user.id;

    const result = await verifyDesignIdService(designId, clientId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error verifying design:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ADMIN APIs
// getAdminDesigns: Lists all approved designs in the system for administrative oversight
export const getAdminDesigns = async (req: Request, res: Response) => {
  try {
    const validatedQuery = adminApprovedDesignQuerySchema.safeParse(req.query);
    if (!validatedQuery.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validatedQuery.error.issues });
    }

    const { status, clientId, search, page, limit } = validatedQuery.data;

    const data = await getAdminDesignsService({
      status: status as any,
      clientId,
      search,
      page: page || 1,
      limit: limit || 20,
    });

    const items = data.items.map((i: any) => ({
      designId: i.designCode,
      status: i.status,
      client: i.client ? { id: i.client.id, name: i.client.business_name } : null,
      submissionId: i.submissionId,
      approvedAt: i.approvedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: data.pagination,
      },
    });
  } catch (error) {
    console.error("Error fetching admin designs:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// getAdminDesignById: Retrieves full details and file URLs for a specific approved design
export const getAdminDesignById = async (req: Request, res: Response) => {
  try {
    const { designId } = req.params;

    const design = await getAdminDesignByIdService(designId as string);

    if (!design) {
      return res.status(404).json({ success: false, message: "Design not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        designId: design.designCode,
        status: design.status,
        approvedFileUrl: design.approvedFileUrl,
        submissionId: design.submissionId,
        client: design.client ? { id: design.client.id, name: design.client.business_name, phone: design.client.phone_number } : null,
        approvedAt: design.approvedAt,
        approvedBy: design.approvedBy ? { id: design.approvedBy.id, name: design.approvedBy.name } : null,
      },
    });
  } catch (error) {
    console.error("Error fetching admin design by ID:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// archiveDesign: Marks an approved design as ARCHIVED with a provided reason
export const archiveDesign = async (req: Request, res: Response) => {
  try {
    const { designId } = req.params;
    const adminId = (req as any).user.id;

    const validatedBody = archiveDesignSchema.safeParse(req.body);
    if (!validatedBody.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validatedBody.error.issues });
    }

    const result = await archiveDesignService(designId as string, adminId, validatedBody.data.reason);

    res.status(200).json({
      success: true,
      message: "Design archived successfully",
      data: {
        designId: result.designCode,
        status: result.status,
      },
    });
  } catch (error: any) {
    console.error("Error archiving design:", error);
    res.status(400).json({ success: false, message: error.message || "Archive failed" });
  }
};
