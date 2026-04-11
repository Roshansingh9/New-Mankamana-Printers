import { Request, Response } from "express";
import { uploadToSupabasePath, getSupabasePublicUrl } from "../utils/file-upload";

// Folders that callers are permitted to upload into via the generic /uploads endpoint
const ALLOWED_FOLDERS = new Set([
  "general",
  "designs/submissions",
  "designs/approved",
  "orders/payment-proofs",
  "wallet/payment-proofs",
  "templates/general",
  "products/images",
  "profile",
  "qr-codes",
]);

// uploadFile: Generic handler to upload a single file to Supabase storage, with optional folder specification
// Returns both the file path (for DB storage) and the full public URL (for immediate display)
export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const requestedFolder = String(req.body.folder || "general");
    const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : "general";

    const { path: filePath, bucket, isPrivate } = await uploadToSupabasePath(req.file, folder);
    const fileUrl = isPrivate ? filePath : getSupabasePublicUrl(filePath, bucket);

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      data: { filePath, fileUrl },
    });
  } catch (error: any) {
    console.error("Upload Error:", error.message);
    res.status(500).json({ success: false, message: "Failed to upload file" });
  }
};
