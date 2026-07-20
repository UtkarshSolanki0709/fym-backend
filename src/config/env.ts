import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("*"),
  // Optional for deploys without R2 - photo upload will fail gracefully
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).default("fymback"),
  /** Legacy public CDN base — prefer encrypted private objects + /media */
  R2_PUBLIC_URL: z.string().default(""),
  /** Public API origin for signed media URLs (e.g. https://xxx.up.railway.app) */
  API_PUBLIC_URL: z.string().optional(),
  /** 32-byte key, base64. Optional — derived from SUPABASE_SECRET_KEY if unset */
  MEDIA_ENCRYPTION_KEY: z.string().optional(),
  /** HMAC secret for /media signed URLs. Optional — derived if unset */
  MEDIA_SIGNING_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid env:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
