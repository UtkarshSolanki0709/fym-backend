import { supabase } from "../libs/supabaseClient.js";
import { AppError } from "../middleware/errorHandler.middleware.js";

export async function sendOtp(phone: string) {
  const { data, error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw new AppError(400, "OTP_SEND_FAILED", error.message);
  return { success: true };
}

export async function verifyOtp(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) throw new AppError(400, "OTP_VERIFY_FAILED", error.message);
  return { session: data.session, user: data.user };
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new AppError(400, "SIGNUP_FAILED", error.message);
  return { session: data.session, user: data.user };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AppError(401, "SIGNIN_FAILED", error.message);
  return { session: data.session, user: data.user };
}

export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw new AppError(400, "REFRESH_FAILED", error.message);
  return { session: data.session, user: data.user };
}
