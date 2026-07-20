import { Router } from "express";
import { getObject } from "../libs/r2Client.js";
import { decryptMedia, isEncryptedBlob, verifyMediaSignature } from "../utils/mediaCrypto.js";
import { AppError } from "../middleware/errorHandler.middleware.js";

const router = Router();

/**
 * GET /media?k=profiles/...&exp=...&sig=...
 * Streams decrypted image bytes. Short-lived HMAC; no public R2 CDN.
 */
router.get("/media", async (req, res, next) => {
  try {
    const key = String(req.query.k ?? "");
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? "");

    if (!key || !sig || !Number.isFinite(exp)) {
      throw new AppError(400, "BAD_MEDIA_REQUEST", "Missing k, exp, or sig");
    }
    // path traversal guard
    if (key.includes("..") || key.startsWith("/") || !/^(profiles|liveness)\//.test(key)) {
      throw new AppError(400, "BAD_MEDIA_KEY", "Invalid media key");
    }
    if (!verifyMediaSignature(key, exp, sig)) {
      throw new AppError(403, "MEDIA_SIG_INVALID", "Media link expired or invalid");
    }

    const obj = await getObject(key);
    let bytes = obj.body;
    if (obj.encrypted || isEncryptedBlob(bytes)) {
      try {
        bytes = decryptMedia(bytes);
      } catch {
        throw new AppError(500, "DECRYPT_FAILED", "Could not decrypt media");
      }
    }

    const mime =
      obj.mime ||
      (key.endsWith(".png")
        ? "image/png"
        : key.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");

    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(bytes);
  } catch (e) {
    next(e);
  }
});

export default router;
