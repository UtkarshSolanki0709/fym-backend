import { supabase } from "../libs/supabaseClient.js";
import { uploadToStorage, deleteFromStorage } from "../libs/r2Client.js";
import { AppError } from "../middleware/errorHandler.middleware.js";
import { PHOTO } from "../config/constants.js";
import { randomUUID } from "crypto";


function r2Key(userId: string, filename: string) {
  return `profiles/${userId}/${filename}`;
}

function toWKT(loc: { lat: number; lng: number } | any) {
  if (loc && typeof loc === "object" && "lat" in loc && "lng" in loc) {
    return `POINT(${loc.lng} ${loc.lat})`;
  }
  return loc;
}

/** Drop undefined keys so Supabase doesn't try to write them */
function cleanPayload(updates: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Auth users can exist without profiles.profiles if handle_new_user trigger
 * is missing/failed. OTP signup often hits this. Create row on demand.
 */
export async function ensureProfile(userId: string) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      trust_score: 100,
      subscription_tier: "FREE",
      status: "active",
      onboarding_step: "auth_done",
    })
    .select("id")
    .maybeSingle();

  if (created) return created;

  // race: concurrent insert
  const { data: again } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (again) return again;

  throw new AppError(
    500,
    "PROFILE_CREATE_FAILED",
    error?.message ?? "Could not create profile row",
  );
}

export async function getProfile(userId: string) {
  await ensureProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new AppError(404, "PROFILE_NOT_FOUND", error?.message ?? "Profile not found");
  }
  return data;
}

export async function updateProfile(userId: string, updates: Record<string, any>) {
  await ensureProfile(userId);

  if (updates.display_name !== undefined) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", updates.display_name)
      .neq("id", userId)
      .maybeSingle();
    if (taken) throw new AppError(409, "NAME_TAKEN", "Display name already taken");
  }

  const payload = cleanPayload({ ...updates });
  if (payload.geolocation) {
    payload.geolocation = toWKT(payload.geolocation);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  // 0 rows → classic "Cannot coerce the result to a single JSON object" with .single()
  if (error) throw new AppError(400, "UPDATE_FAILED", error.message);
  if (!data) {
    throw new AppError(
      400,
      "UPDATE_FAILED",
      "Profile update matched no rows — profile may be missing or blocked",
    );
  }
  return data;
}

const ALLOWED_MIME: Record<string, string> = {
  "ffd8ffe0": "image/jpeg",
  "ffd8ffe1": "image/jpeg",
  "ffd8ffe2": "image/jpeg",
  "89504e47": "image/png",
  "52494646": "image/webp",
};
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function detectMime(buf: Buffer): string | null {
  const hex = buf.subarray(0, 4).toString("hex");
  for (const [sig, mime] of Object.entries(ALLOWED_MIME)) {
    if (hex.startsWith(sig)) return mime;
  }
  return null;
}

export async function addPhoto(userId: string, base64: string) {
  const { count } = await supabase
    .from("profiles")
    .select("photos", { count: "exact", head: true })
    .eq("id", userId)
    .single();
  if (count && count >= PHOTO.MAX_COUNT) {
    throw new AppError(400, "PHOTO_LIMIT", `Max ${PHOTO.MAX_COUNT} photos`);
  }

  const buf = Buffer.from(base64, "base64");
  if (buf.length > MAX_PHOTO_BYTES) {
    throw new AppError(400, "PHOTO_TOO_LARGE", `Photo exceeds ${MAX_PHOTO_BYTES / 1024 / 1024}MB`);
  }
  const mime = detectMime(buf);
  if (!mime) {
    throw new AppError(400, "INVALID_PHOTO", "Only JPEG, PNG, WebP allowed");
  }

  const id = randomUUID();
  const ext = mime.split("/")[1];
  const key = r2Key(userId, `${id}.${ext}`);
  const url = await uploadToStorage(key, buf, mime);

  const { data, error } = await supabase
    .rpc("append_photo", { p_user_id: userId, p_photo: { id, url } });
  if (error) {
    await deleteFromStorage(key);
    throw new AppError(500, "UPLOAD_FAILED", error.message);
  }

  return { id, url };
}

export async function deletePhoto(userId: string, photoId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("photos")
    .eq("id", userId)
    .single();
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");

  const photo = profile.photos?.find((p: { id: string }) => p.id === photoId);
  if (!photo) throw new AppError(404, "PHOTO_NOT_FOUND", "Photo not found");

  const key = r2Key(userId, `${photoId}.jpg`);
  await Promise.all([
    deleteFromStorage(key),
    supabase.rpc("remove_photo", { p_user_id: userId, p_photo_id: photoId }),
  ]);
}

export async function updateInterests(userId: string, interests: string[]) {
  await ensureProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .update({ interests })
    .eq("id", userId)
    .select("interests")
    .maybeSingle();
  if (error || !data) throw new AppError(400, "UPDATE_FAILED", error?.message ?? "No profile");
  return data.interests;
}

export async function updatePrompts(userId: string, prompts: { question: string; answer: string }[]) {
  await ensureProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .update({ prompts })
    .eq("id", userId)
    .select("prompts")
    .maybeSingle();
  if (error || !data) throw new AppError(400, "UPDATE_FAILED", error?.message ?? "No profile");
  return data.prompts;
}

export async function updateQuiz(userId: string, answers: { question_id: string; value: number }[]) {
  await ensureProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .update({ quiz: answers })
    .eq("id", userId)
    .select("quiz")
    .maybeSingle();
  if (error || !data) throw new AppError(400, "UPDATE_FAILED", error?.message ?? "No profile");
  return data.quiz;
}

export async function updatePreferences(
  userId: string,
  prefs: { age_min?: number; age_max?: number; distance_km?: number; gender_preference?: string },
) {
  await ensureProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .update(prefs)
    .eq("id", userId)
    .select("*")
    .maybeSingle();
  if (error || !data) throw new AppError(400, "UPDATE_FAILED", error?.message ?? "No profile");
  return data;
}

export async function getOnboardingStatus(userId: string) {
  await ensureProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_step, is_verified, display_name, photos, interests")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");

  const stepOrder = ["liveness_done", "basic_info", "photos", "interests", "prompts", "quiz", "complete"];
  const currentIdx = stepOrder.indexOf(data.onboarding_step ?? "");

  return {
    onboarding_step: data.onboarding_step ?? "start",
    is_verified: data.is_verified,
    has_name: !!data.display_name,
    has_photos: (data.photos?.length ?? 0) > 0,
    has_interests: (data.interests?.length ?? 0) > 0,
    next_step: currentIdx >= 0 && currentIdx < stepOrder.length - 1 ? stepOrder[currentIdx + 1] : null,
  };
}

export async function updateOnboardingStep(userId: string, step: string) {
  await ensureProfile(userId);
  const { data, error } = await supabase
    .from("profiles")
    .update({ onboarding_step: step })
    .eq("id", userId)
    .select("onboarding_step")
    .maybeSingle();
  if (error || !data) throw new AppError(400, "UPDATE_FAILED", error?.message ?? "No profile");
  return { onboarding_step: data.onboarding_step };
}
