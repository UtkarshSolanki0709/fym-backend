/** Normalize to E.164. Strips spaces; fixes common `+`→space corruption. */
export function normalizeE164(raw: string): string {
  let s = String(raw ?? "").trim();
  // query-string sometimes turns "+" into space → " 9198…"
  if (/^\s+\d/.test(s)) s = "+" + s.trim();
  s = s.replace(/[^\d+]/g, "");
  // only leading +
  if (s.includes("+")) s = "+" + s.replace(/\+/g, "").replace(/\D/g, "");
  else s = "+" + s.replace(/\D/g, "");
  return s;
}

export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
