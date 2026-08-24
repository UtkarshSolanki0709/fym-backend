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
  return { success: true, channel: "phone" as const, phone };
}

/** Email OTP via Supabase → Brevo (configured in Supabase Auth SMTP). */
export async function sendEmailOtp(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new AppError(400, "INVALID_EMAIL", "Valid email required");
  }

  const { error } = await supabaseAuth.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) throw new AppError(400, "OTP_SEND_FAILED", error.message);
  return { success: true, channel: "email" as const, email };
}

export async function verifyOtp(phoneRaw: string, tokenRaw: string) {
  const phone = normalizeE164(phoneRaw);
  const token = String(tokenRaw ?? "").replace(/\D/g, "");

  if (!isE164(phone)) {
    throw new AppError(400, "INVALID_PHONE", "Phone must be E.164 (e.g. +9198XXXXXXXX)");
  }
  if (token.length < 4 || token.length > 10) {
    throw new AppError(400, "INVALID_TOKEN", "OTP must be 4–10 digits");
  }

  const { data, error } = await supabaseAuth.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) throw new AppError(400, "OTP_VERIFY_FAILED", error.message);
  if (!data.session) {
    throw new AppError(400, "OTP_VERIFY_FAILED", "No session returned — check phone OTP provider");
  }

  return { session: data.session, user: data.user };
}

export async function verifyEmailOtp(emailRaw: string, tokenRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  const token = String(tokenRaw ?? "").replace(/\D/g, "");
  if (!email.includes("@")) {
    throw new AppError(400, "INVALID_EMAIL", "Valid email required");
  }
  if (token.length < 4 || token.length > 10) {
    throw new AppError(400, "INVALID_TOKEN", "OTP must be 4–10 digits");
  }

  // email OTP type for Brevo/Supabase email templates
  const { data, error } = await supabaseAuth.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) throw new AppError(400, "OTP_VERIFY_FAILED", error.message);
  if (!data.session) {
    throw new AppError(400, "OTP_VERIFY_FAILED", "No session — check email OTP / Brevo templates");
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

/** Brevo delivers reset link (Supabase Auth email template). */
export async function requestPasswordReset(emailRaw: string, redirectTo?: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new AppError(400, "INVALID_EMAIL", "Valid email required");
  }
  const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || undefined,
  });
  if (error) throw new AppError(400, "RESET_FAILED", error.message);
  // always success-shaped (don't leak whether email exists)
  return { success: true, email };
}

export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw new AppError(400, "REFRESH_FAILED", error.message);
  return { session: data.session, user: data.user };
}
