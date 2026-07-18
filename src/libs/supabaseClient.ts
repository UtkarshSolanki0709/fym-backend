import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

/**
 * Admin / DB client — service role. No session persistence.
 * Use for profiles, swipes, JWT getUser, etc.
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

/**
 * Auth client for OTP send/verify.
 * Prefer publishable/anon key (user auth path). Fall back to secret if unset.
 * Twilio Verify + service-role edge cases → publishable is safer for OTP.
 */
const authKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_SECRET_KEY;

export const supabaseAuth = createClient(env.SUPABASE_URL, authKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
