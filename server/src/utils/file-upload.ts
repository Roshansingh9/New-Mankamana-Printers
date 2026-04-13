import { randomUUID } from "crypto";
import { supabase } from "./supabase";
import { withRetry } from "./resilience";

// MIME type → file extension mapping (extension from MIME, not from user-supplied filename)
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Bucket routing table.
 * Maps a folder prefix to the correct Supabase bucket.
 * Private buckets must be accessed via signed URLs, never public URLs.
 */
const FOLDER_TO_BUCKET: { prefix: string; bucket: string; isPrivate: boolean }[] = [
  { prefix: "designs/submissions", bucket: "design-files",    isPrivate: true  },
  { prefix: "designs/approved",    bucket: "design-files",    isPrivate: true  },
  { prefix: "orders/payment-proofs", bucket: "payment-proofs", isPrivate: true },
  { prefix: "wallet/payment-proofs", bucket: "payment-proofs", isPrivate: true },
  { prefix: "templates",           bucket: "design-templates", isPrivate: false },
  { prefix: "products",            bucket: "product-assets",   isPrivate: false },
  { prefix: "banners",             bucket: "banners",          isPrivate: false },
  { prefix: "company",             bucket: "product-assets",   isPrivate: false },
  { prefix: "option-values",       bucket: "product-assets",   isPrivate: false },
];

const FALLBACK_BUCKET = process.env.SUPABASE_BUCKET || "printing-assets";

function resolveBucket(folder: string): { bucket: string; isPrivate: boolean } {
  const match = FOLDER_TO_BUCKET.find((r) => folder.startsWith(r.prefix));
  return match ?? { bucket: FALLBACK_BUCKET, isPrivate: false };
}

/**
 * getSupabasePublicUrl
 * Returns a public CDN URL for files in public buckets.
 * Do NOT call this for private buckets (design-files, payment-proofs).
 */
export const getSupabasePublicUrl = (filePath: string, bucket?: string): string => {
  const resolvedBucket = bucket ?? FALLBACK_BUCKET;
  const { data } = supabase.storage.from(resolvedBucket).getPublicUrl(filePath);
  return data.publicUrl;
};

/**
 * getSignedUrl
 * Generates a time-limited signed URL for files in private buckets.
 * Default expiry: 1 hour (3600 seconds).
 */
export const getSignedUrl = async (
  filePath: string,
  bucket: string,
  expiresIn = 3600
): Promise<string> => {
  const { data, error } = await withRetry(
    () =>
      supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn),
    { retries: 2, timeoutMs: 8000, backoffMs: 250 }
  );

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`);
  }
  return data.signedUrl;
};

/**
 * uploadToSupabasePath
 * Uploads a Multer file to the correct bucket based on the folder prefix.
 * Returns the file PATH only (e.g. "designs/submissions/uuid.png").
 * For private buckets, call getSignedUrl(path, bucket) to serve the file.
 */
export const uploadToSupabasePath = async (
  file: Express.Multer.File,
  folder: string = "general"
): Promise<{ path: string; bucket: string; isPrivate: boolean }> => {
  const { bucket, isPrivate } = resolveBucket(folder);

  const fileExtension = MIME_TO_EXT[file.mimetype] ?? "bin";
  const filePath = `${folder}/${randomUUID()}.${fileExtension}`;

  const { error } = await withRetry(
    () =>
      supabase.storage
        .from(bucket)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        }),
    { retries: 2, timeoutMs: 10000, backoffMs: 300 }
  );

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error(`Failed to upload file to Supabase: ${error.message}`);
  }

  return { path: filePath, bucket, isPrivate };
};

/**
 * deleteFromSupabase
 * Deletes a file from the correct bucket by folder-resolved path.
 */
export const deleteFromSupabase = async (filePath: string, bucket?: string): Promise<void> => {
  const resolvedBucket = bucket ?? resolveBucket(filePath.split("/")[0]).bucket;
  const { error } = await withRetry(
    () => supabase.storage.from(resolvedBucket).remove([filePath]),
    { retries: 1, timeoutMs: 8000, backoffMs: 200, fallback: async () => ({ data: null, error: null }) }
  );
  if (error) {
    console.error("Supabase delete error:", error);
  }
};

/**
 * uploadToSupabase (legacy compat)
 * Returns full public URL. Only safe for public buckets.
 * New code should use uploadToSupabasePath directly.
 */
export const uploadToSupabase = async (
  file: Express.Multer.File,
  folder: string = "general"
): Promise<string> => {
  const { path, bucket, isPrivate } = await uploadToSupabasePath(file, folder);
  if (isPrivate) {
    // For private buckets, return just the path — callers must use getSignedUrl
    return path;
  }
  return getSupabasePublicUrl(path, bucket);
};

// uploadFileToSupabase: Thin alias used by the generic upload controller
export const uploadFileToSupabase = async (
  file: Express.Multer.File,
  folder: string = "general"
): Promise<string> => {
  return uploadToSupabase(file, folder);
};
