// =====================================================================
// FYM Media Storage Client (Supabase Storage Adapter)
// Path: backend/src/libs/supabaseStorage.ts
// Handles uploading and deleting files directly from Supabase Storage buckets.
// =====================================================================

import { supabase } from "./supabaseClient.js";

/**
 * Ensures a Supabase storage bucket exists and is configured public.
 */
async function ensureBucket(bucketName: string) {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const exists = buckets?.some((b) => b.name === bucketName);
    if (!exists) {
      console.log(`[Storage] Creating public bucket: "${bucketName}"`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        fileSizeLimit: 5242880, // 5MB
      });
      if (createError) throw createError;
    }
  } catch (err: any) {
    console.warn(`[Storage Warning] Failed to verify/create bucket "${bucketName}":`, err.message);
  }
}

/**
 * Uploads a file buffer to a Supabase Storage bucket.
 * Parses the key "bucket/path/to/file" to extract bucket name and path.
 */
export async function uploadToStorage(key: string, body: Buffer, contentType: string): Promise<string> {
  const parts = key.split("/");
  const bucket = parts[0];
  const path = parts.slice(1).join("/");

  // Ensure the target bucket exists before upload
  await ensureBucket(bucket);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, body, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Deletes a file from Supabase Storage bucket.
 */
export async function deleteFromStorage(key: string): Promise<void> {
  const parts = key.split("/");
  const bucket = parts[0];
  const path = parts.slice(1).join("/");

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw new Error(`Supabase Storage delete failed: ${error.message}`);
  }
}
