import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

let _s3: S3Client | null = null;

function s3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
  }
  return _s3;
}

export async function initStorage() {
  await s3().send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME }));
}

export async function uploadToStorage(key: string, body: Buffer, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: contentType });
  try {
    await s3().send(command);
    return `${env.R2_PUBLIC_URL}/${key}`;
  } catch (error: any) {
    throw new Error(`Cloudflare R2 upload failed: ${error.message}`);
  }
}

export async function deleteFromStorage(key: string): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key });
  try {
    await s3().send(command);
  } catch (error: any) {
    throw new Error(`Cloudflare R2 delete failed: ${error.message}`);
  }
}