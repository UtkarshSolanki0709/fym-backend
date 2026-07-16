import { supabase } from "../libs/supabaseClient.js";
import { uploadToStorage, deleteFromStorage } from "../libs/supabaseStorage.js";
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

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
  return data;
}

export async function updateProfile(userId: string, updates: Record<string, any>) {
  if (updates.display_name !== undefined) {
    const { error: dup } = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", updates.display_name)
      .neq("id", userId)
      .maybeSingle();
    if (dup) throw new AppError(409, "NAME_TAKEN", "Display name already taken");
  }

  const payload = { ...updates };
  if (payload.geolocation) {
    payload.geolocation = toWKT(payload.geolocation);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new AppError(400, "UPDATE_FAILED", error.message);
  return data;
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
  const id = randomUUID();
  const key = r2Key(userId, `${id}.jpg`);
  const url = await uploadToStorage(key, buf, "image/jpeg");

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
  const { data, error } = await supabase
    .from("profiles")
    .update({ interests })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new AppError(400, "UPDATE_FAILED", error.message);
  return data.interests;
}

export async function updatePrompts(userId: string, prompts: { question: string; answer: string }[]) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ prompts })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new AppError(400, "UPDATE_FAILED", error.message);
  return data.prompts;
}

export async function updateQuiz(userId: string, answers: { question_id: string; value: number }[]) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ quiz: answers })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new AppError(400, "UPDATE_FAILED", error.message);
  return data.quiz;
}

export async function updatePreferences(
  userId: string,
  prefs: { age_min?: number; age_max?: number; distance_km?: number; gender_preference?: string },
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(prefs)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new AppError(400, "UPDATE_FAILED", error.message);
  return data;
}

export async function getOnboardingStatus(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_step, is_verified, display_name, photos, interests")
    .eq("id", userId)
    .single();
  if (error) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");

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
  const { data, error } = await supabase
    .from("profiles")
    .update({ onboarding_step: step })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new AppError(400, "UPDATE_FAILED", error.message);
  return { onboarding_step: data.onboarding_step };
}
