import { supabase } from "../libs/supabaseClient.js";
import { AppError } from "../middleware/errorHandler.middleware.js";

export async function publishKey(userId: string, publicKey: string) {
  const key = publicKey.trim();
  if (key.length < 20 || key.length > 8000) {
    throw new AppError(400, "INVALID_KEY", "public_key length invalid");
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ public_key: key })
    .eq("id", userId)
    .select("id, public_key")
    .single();
  if (error || !data) {
    throw new AppError(400, "KEY_PUBLISH_FAILED", error?.message ?? "publish failed");
  }
  return { user_id: data.id, public_key: data.public_key as string };
}

export async function getKey(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, public_key")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new AppError(500, "KEY_FETCH_FAILED", error.message);
  if (!data?.public_key) {
    throw new AppError(404, "KEY_NOT_FOUND", "No public key for user");
  }
  return { user_id: data.id, public_key: data.public_key as string };
}
