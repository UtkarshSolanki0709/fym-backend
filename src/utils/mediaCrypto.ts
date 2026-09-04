import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "../config/env.js";

const VERSION = 1;
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer {
  if (env.MEDIA_ENCRYPTION_KEY) {
    const buf = Buffer.from(env.MEDIA_ENCRYPTION_KEY, "base64");
    if (buf.length !== 32) {
      throw new Error("MEDIA_ENCRYPTION_KEY must be 32 bytes base64-encoded");
    }
    return buf;
  }
  // Fallback so deploys without a dedicated key still encrypt
  return createHash("sha256")
    .update(`fym-media-v1:${env.SUPABASE_SECRET_KEY}`)
    .digest();
}

function signingSecret(): Buffer {
  if (env.MEDIA_SIGNING_SECRET) {
    return Buffer.from(env.MEDIA_SIGNING_SECRET, "utf8");
  }
  return createHash("sha256")
    .update(`fym-media-sign-v1:${env.SUPABASE_SECRET_KEY}`)
    .digest();
}

/** AES-256-GCM. Wire format: version(1) | iv(12) | tag(16) | ciphertext */
export function encryptMedia(plain: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]);
}

export function decryptMedia(blob: Buffer): Buffer {
  if (blob.length < 1 + IV_LEN + TAG_LEN + 1) {
    throw new Error("Encrypted media blob too short");
  }
  const version = blob[0];
  if (version !== VERSION) {
    throw new Error(`Unsupported media crypto version: ${version}`);
  }
  const iv = blob.subarray(1, 1 + IV_LEN);
  const tag = blob.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const ciphertext = blob.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Detect if buffer looks like our envelope (vs plain JPEG/PNG) */
export function isEncryptedBlob(buf: Buffer): boolean {
  return buf.length > 1 + IV_LEN + TAG_LEN && buf[0] === VERSION;
}

const DEFAULT_TTL_SEC = 7 * 24 * 3600; // 7 days (prevents photos expiring after 15 mins)

export function signMediaPath(storageKey: string, ttlSec = DEFAULT_TTL_SEC): {
  exp: number;
  sig: string;
} {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = createHmac("sha256", signingSecret())
    .update(`${storageKey}.${exp}`)
    .digest("base64url");
  return { exp, sig };
}

export function verifyMediaSignature(
  storageKey: string,
  exp: number,
  sig: string,
): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", signingSecret())
    .update(`${storageKey}.${exp}`)
    .digest("base64url");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Public API base for building media URLs (Render / local) */
export function mediaPublicBase(): string {
  const base = (
    env.API_PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "https://fym-backend-tec9.onrender.com"
  ).replace(/\/$/, "");
  return base;
}

export function buildSignedMediaUrl(storageKey: string, ttlSec = DEFAULT_TTL_SEC): string {
  const { exp, sig } = signMediaPath(storageKey, ttlSec);
  const q = new URLSearchParams({
    k: storageKey,
    exp: String(exp),
    sig,
  });
  return `${mediaPublicBase()}/media?${q.toString()}`;
}
