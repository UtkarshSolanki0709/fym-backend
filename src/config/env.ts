import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_SECRET_KEY: requireEnv("SUPABASE_SECRET_KEY"),
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",

};
