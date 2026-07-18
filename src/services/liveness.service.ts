import { supabase } from "../libs/supabaseClient.js";
import { uploadToStorage } from "../libs/r2Client.js";
import { grayscaleHash, hashSimilarity, eyesOpenCount } from "../utils/image.js";
import { AppError } from "../middleware/errorHandler.middleware.js";
import { env } from "../config/env.js";

export async function verifyLiveness(userId: string, frames: string[]) {
  const bufs = frames.map(f => Buffer.from(f, "base64"));

  const hashes = await Promise.all(bufs.map(b => grayscaleHash(b)));

  for (let i = 0; i < hashes.length; i++) {
    for (let j = i + 1; j < hashes.length; j++) {
      if (hashSimilarity(hashes[i], hashes[j]) < 0.05) {
        throw new AppError(400, "LIVENESS_FAILED", "Duplicate frame detected — static photo");
      }
    }
  }

  const eyeCounts = await Promise.all(bufs.map(b => eyesOpenCount(b)));
  const totalOpen = eyeCounts.reduce((a, c) => a + c, 0);
  if (totalOpen < 2) {
    throw new AppError(400, "LIVENESS_FAILED", "Eyes not detected as open in 2+ frames");
  }

  await Promise.all(bufs.map((buf, i) =>
    uploadToStorage(`liveness/${userId}/${Date.now()}_${i}.jpg`, buf, "image/jpeg"),
  ));

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
