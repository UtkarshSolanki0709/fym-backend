import { supabase } from "../libs/supabaseClient.js";

export async function registerToken(
  userId: string,
  token: string,
  platform: string,
) {
  const { error } = await supabase.from("device_push_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: platform || "unknown",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" },
  );
  if (error) throw error;
  return { ok: true };
}

/** Notify peer of new chat message — no plaintext body. */
export async function notifyNewMessage(roomId: string, senderId: string) {
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId);
  const recipients = (members ?? [])
    .map((m) => m.user_id as string)
    .filter((id) => id !== senderId);
  if (!recipients.length) return;

  const { data: sender } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", senderId)
    .maybeSingle();
  const name = (sender?.display_name as string) || "Someone";

  const { data: tokens } = await supabase
    .from("device_push_tokens")
    .select("token")
    .in("user_id", recipients);
  if (!tokens?.length) return;

  const messages = tokens.map((t) => ({
    to: t.token as string,
    title: "New message",
    body: `From ${name}`,
    data: { roomId, type: "chat" },
    sound: "default",
  }));

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch {
    // ponytail: push best-effort
  }
}
