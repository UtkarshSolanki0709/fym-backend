import { supabase } from "../libs/supabaseClient.js";
import { AppError } from "../middleware/errorHandler.middleware.js";

function photoUrl(photos: unknown): string | null {
  if (!Array.isArray(photos) || !photos[0]) return null;
  const p = photos[0] as { url?: string };
  return p.url ?? null;
}

export async function listMatches(userId: string) {
  const { data: memberships, error } = await supabase
    .from("room_members")
    .select("room_id, joined_at")
    .eq("user_id", userId);
  if (error) throw new AppError(500, "MATCHES_FAILED", error.message);
  if (!memberships?.length) return { matches: [] as unknown[] };

  const roomIds = memberships.map((m) => m.room_id as string);

  const { data: peers } = await supabase
    .from("room_members")
    .select("room_id, user_id")
    .in("room_id", roomIds)
    .neq("user_id", userId);

  const peerByRoom = new Map<string, string>();
  for (const p of peers ?? []) {
    peerByRoom.set(p.room_id as string, p.user_id as string);
  }

  const peerIds = [...new Set([...peerByRoom.values()])];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, photos, last_active_at, age")
    .in("id", peerIds.length ? peerIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const { data: reads } = await supabase
    .from("room_reads")
    .select("room_id, last_read_at")
    .eq("user_id", userId)
    .in("room_id", roomIds);
  const readByRoom = new Map(
    (reads ?? []).map((r) => [r.room_id as string, r.last_read_at as string]),
  );

  // Batch fetch messages for all rooms to eliminate N+1 queries
  const { data: allMessages } = await supabase
    .from("messages")
    .select("id, room_id, sender_id, ciphertext, nonce, content_type, created_at")
    .in("room_id", roomIds)
    .order("created_at", { ascending: false });

  type MessageRow = NonNullable<typeof allMessages>[number];
  const lastByRoom = new Map<string, MessageRow>();
  const unreadByRoom = new Map<string, number>();

  for (const m of allMessages ?? []) {
    const rId = m.room_id as string;
    if (!lastByRoom.has(rId)) {
      lastByRoom.set(rId, m);
    }
    const lastRead = readByRoom.get(rId) ?? "1970-01-01";
    if (m.sender_id !== userId && m.created_at > lastRead) {
      unreadByRoom.set(rId, (unreadByRoom.get(rId) ?? 0) + 1);
    }
  }

  const matches = [];
  for (const roomId of roomIds) {
    const peerId = peerByRoom.get(roomId);
    if (!peerId) continue;
    const prof = profileById.get(peerId);
    const last = lastByRoom.get(roomId) ?? null;
    const unread = unreadByRoom.get(roomId) ?? 0;

    matches.push({
      room_id: roomId,
      peer: {
        id: peerId,
        display_name: (prof?.display_name as string) ?? "Match",
        age: prof?.age ?? null,
        photo_url: photoUrl(prof?.photos),
        last_active_at: prof?.last_active_at ?? null,
      },
      last_message: last
        ? {
            id: last.id,
            sender_id: last.sender_id,
            ciphertext: last.ciphertext,
            nonce: last.nonce,
            content_type: last.content_type ?? "text",
            created_at: last.created_at,
          }
        : null,
      unread,
      joined_at: memberships.find((m) => m.room_id === roomId)?.joined_at,
    });
  }

  matches.sort((a, b) => {
    const ta = a.last_message?.created_at ?? a.joined_at ?? "";
    const tb = b.last_message?.created_at ?? b.joined_at ?? "";
    return tb.localeCompare(ta);
  });

  return { matches };
}
