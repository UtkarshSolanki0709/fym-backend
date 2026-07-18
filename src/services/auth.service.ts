import { supabaseAuth } from "../libs/supabaseClient.js";
import { AppError } from "../middleware/errorHandler.middleware.js";
import { isE164, normalizeE164 } from "../utils/phone.js";

export async function sendOtp(phoneRaw: string) {
  const phone = normalizeE164(phoneRaw);
  if (!isE164(phone)) {
    throw new AppError(400, "INVALID_PHONE", "Phone must be E.164 (e.g. +9198XXXXXXXX)");
  }

  const { error } = await supabaseAuth.auth.signInWithOtp({ phone });
  if (error) throw new AppError(400, "OTP_SEND_FAILED", error.message);
  return { success: true, phone };
}

export async function verifyOtp(phoneRaw: string, tokenRaw: string) {
  const phone = normalizeE164(phoneRaw);
  // digits only — SMS may include spaces/dashes if user pastes
  const token = String(tokenRaw ?? "").replace(/\D/g, "");

  if (!isE164(phone)) {
    throw new AppError(400, "INVALID_PHONE", "Phone must be E.164 (e.g. +9198XXXXXXXX)");
  }
  if (token.length < 4 || token.length > 10) {
    throw new AppError(400, "INVALID_TOKEN", "OTP must be 4–10 digits");
  }

  // type: 'sms' required for phone OTP (not 'phone_change')
  const { data, error } = await supabaseAuth.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    // Surface provider message; common: expired (Twilio Verify window ~10m, Supabase may enforce tighter)
    throw new AppError(400, "OTP_VERIFY_FAILED", error.message);
  }
  if (!data.session) {
    throw new AppError(400, "OTP_VERIFY_FAILED", "No session returned — check Auth phone provider config");
  }

  return { session: data.session, user: data.user };
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabaseAuth.auth.signUp({ email, password });
  if (error) throw new AppError(400, "SIGNUP_FAILED", error.message);
  return { session: data.session, user: data.user };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) throw new AppError(401, "SIGNIN_FAILED", error.message);
  return { session: data.session, user: data.user };
}

export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw new AppError(400, "REFRESH_FAILED", error.message);
  return { session: data.session, user: data.user };
}
