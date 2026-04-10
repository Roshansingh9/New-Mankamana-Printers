import { supabase } from "./supabase";
import { v4 as uuidv4 } from "uuid";

// MIME type → file extension mapping (extension from MIME, not from user-supplied filename)
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * getSupabasePublicUrl
 *
 * Generates the public URL for a stored file path.
 * DB should store only the path (e.g. "qr-codes/uuid.png"),
 * and this function generates the full URL dynamically.
 */
export const getSupabasePublicUrl = (filePath: string): string => {
  const bucketName = process.env.SUPABASE_BUCKET || "printing-assets";
  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
  return data.publicUrl;
};

/**
 * uploadToSupabasePath
 *
 * Uploads a Multer file to the `printing-assets` Supabase bucket.
 * Returns the file PATH (e.g. "qr-codes/uuid.png") — NOT the full URL.
 * Use getSupabasePublicUrl(path) to generate the URL dynamically.
 *
 * Folder structure inside the bucket:
 *   designs/submissions/      – client design submissions awaiting review
 *   designs/approved/         – admin-approved design files
 *   templates/{category-slug}/– free design templates, organised by category
 *   orders/payment-proofs/    – payment proof screenshots/PDFs for orders
 *   wallet/payment-proofs/    – payment proof screenshots/PDFs for wallet top-ups
 *   products/images/          – product catalogue images
 *   qr-codes/                 – QR code images
 *   general/                  – catch-all for everything else
 */
export const uploadToSupabasePath = async (
  file: Express.Multer.File,
  folder: string = "general"
): Promise<string> => {
  const bucketName = process.env.SUPABASE_BUCKET || "printing-assets";

  const fileExtension = MIME_TO_EXT[file.mimetype] ?? "bin";
  const filePath = `${folder}/${uuidv4()}.${fileExtension}`;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error(`Failed to upload file to Supabase: ${error.message}`);
  }

  return filePath;
};

/**
 * deleteFromSupabase
 *
 * Deletes a file from Supabase storage by path.
 * Call this before uploading a replacement file.
 */
export const deleteFromSupabase = async (filePath: string): Promise<void> => {
  const bucketName = process.env.SUPABASE_BUCKET || "printing-assets";
  const { error } = await supabase.storage.from(bucketName).remove([filePath]);
  if (error) {
    console.error("Supabase delete error:", error);
  }
};

/**
 * uploadToSupabase (legacy)
 *
 * Returns the full public URL for backward-compatibility with existing code.
 * New code should use uploadToSupabasePath + getSupabasePublicUrl.
 */
export const uploadToSupabase = async (
  file: Express.Multer.File,
  folder: string = "general"
): Promise<string> => {
  const filePath = await uploadToSupabasePath(file, folder);
  return getSupabasePublicUrl(filePath);
};

// uploadFileToSupabase: Thin alias used by the generic upload controller
export const uploadFileToSupabase = async (
  file: Express.Multer.File,
  folder: string = "general"
): Promise<string> => {
  const filePath = await uploadToSupabasePath(file, folder);
  return getSupabasePublicUrl(filePath);
};
