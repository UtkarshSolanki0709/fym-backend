import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { encryptMedia } from "../utils/mediaCrypto.js";

let _s3: S3Client | null = null;

function s3() {
  if (!_s3) {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
    }
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3;
}

export function isR2Enabled(): boolean {
  return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
}

export async function initStorage() {
  if (!isR2Enabled()) {
    console.log("R2 not configured, skipping bucket check");
    return;
  }
  await s3().send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME }));
}

/**
 * Upload AES-GCM encrypted bytes to private R2.
 * Returns storage key (never a public CDN URL).
 */
export async function uploadEncrypted(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ key: string }> {
  if (!isR2Enabled()) throw new Error("R2 not configured");
  const encrypted = encryptMedia(body);
  await s3().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: encrypted,
      ContentType: "application/octet-stream",
      Metadata: {
        "x-fym-mime": contentType,
        "x-fym-enc": "aes-256-gcm-v1",
      },
    }),
  );
  return { key };
}

/** @deprecated use uploadEncrypted — kept for callers that still pass plain */
export async function uploadToStorage(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await uploadEncrypted(key, body, contentType);
  // No public URL — caller must use signed /media links
  return key;
}

export async function getObject(key: string): Promise<{
  body: Buffer;
  mime?: string;
  encrypted: boolean;
}> {
  if (!isR2Enabled()) throw new Error("R2 not configured");
  const res = await s3().send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("Empty object body");
  const body = Buffer.from(bytes);
  const mime = res.Metadata?.["x-fym-mime"] || res.Metadata?.["x_fym_mime"];
  const encMeta = res.Metadata?.["x-fym-enc"] || res.Metadata?.["x_fym_enc"];
  return {
    body,
    mime,
    encrypted: Boolean(encMeta) || body[0] === 1,
  };
}

export async function deleteFromStorage(key: string): Promise<void> {
  if (!isR2Enabled()) throw new Error("R2 not configured");
  try {
    await s3().send(
      new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
    );
  } catch (error: any) {
    throw new Error(`Cloudflare R2 delete failed: ${error.message}`);
  }
}
