import { supabase } from "../libs/supabaseClient.js";
import { uploadEncrypted, getObject, isR2Enabled } from "../libs/r2Client.js";
import { decryptMedia, isEncryptedBlob } from "../utils/mediaCrypto.js";
import { storageKeyFromPhoto, type PhotoRecord } from "../utils/photoUrls.js";
import { grayscaleHash, hashSimilarity, eyesOpenCount } from "../utils/image.js";
import { AppError } from "../middleware/errorHandler.middleware.js";

const PHOTO_SIMILARITY_THRESHOLD = 0.15;

export async function verifyLiveness(userId: string, frames: string[]) {
  const bufs = frames.map((f) => Buffer.from(f, "base64"));

  const hashes = await Promise.all(bufs.map((b) => grayscaleHash(b)));

  for (let i = 0; i < hashes.length; i++) {
    for (let j = i + 1; j < hashes.length; j++) {
      if (hashSimilarity(hashes[i], hashes[j]) < 0.05) {
        throw new AppError(400, "LIVENESS_FAILED", "Duplicate frame detected — static photo");
      }
    }
  }

  const eyeCounts = await Promise.all(bufs.map((b) => eyesOpenCount(b)));
  const totalOpen = eyeCounts.reduce((a, c) => a + c, 0);
  if (totalOpen < 2) {
    throw new AppError(400, "LIVENESS_FAILED", "Eyes not detected as open in 2+ frames");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("photos")
    .eq("id", userId)
    .maybeSingle();

  const photosList = (profile?.photos as PhotoRecord[] | null) ?? [];
  if (photosList.length > 0 && isR2Enabled()) {
    const photoBuffers: Buffer[] = [];
    for (const p of photosList) {
      const key = storageKeyFromPhoto(p, userId);
      if (!key) continue;
      try {
        const obj = await getObject(key);
        let bytes = obj.body;
        if (obj.encrypted || isEncryptedBlob(bytes)) {
          bytes = decryptMedia(bytes);
        }
        photoBuffers.push(bytes);
      } catch (err) {
        console.warn("Could not retrieve/decrypt photo for liveness check:", key, err);
      }
    }

    if (photoBuffers.length > 0) {
      const photoHashes = await Promise.all(
        photoBuffers.map((buf) => grayscaleHash(buf)),
      );

      let matchFound = false;
      for (const livenessHash of hashes) {
        for (const photoHash of photoHashes) {
          if (hashSimilarity(livenessHash, photoHash) < PHOTO_SIMILARITY_THRESHOLD) {
            matchFound = true;
            break;
          }
        }
        if (matchFound) break;
      }

      if (!matchFound) {
        throw new AppError(400, "LIVENESS_FAILED", "Face does not match stored profile photos");
      }
    }
  }

  if (isR2Enabled()) {
    await Promise.all(
      bufs.map((buf, i) =>
        uploadEncrypted(`liveness/${userId}/${Date.now()}_${i}.jpg`, buf, "image/jpeg"),
      ),
    );
  }

  await supabase.from("profiles").update({
    is_verified: true,
    onboarding_step: "liveness_done",
  }).eq("id", userId);

  await supabase.from("liveness_checks").insert({
    user_id: userId,
    passed: true,
    eye_open_frames: totalOpen,
  });

  return { verified: true };
}
