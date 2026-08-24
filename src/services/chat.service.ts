import { randomUUID } from "crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { supabase } from "../libs/supabaseClient.js";
import { AppError } from "../middleware/errorHandler.middleware.js";
import { isR2Enabled, getS3Client } from "../libs/r2Client.js";
import { env } from "../config/env.js";
import { notifyNewMessage } from "./push.service.js";

async function assertMember(roomId: string, userId: string) {
  const { data, error } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AppError(500, "MEMBER_CHECK_FAILED", error.message);
  if (!data) throw new AppError(403, "NOT_ROOM_MEMBER", "Not a member of this room");
}

export async function listMessages(
  roomId: string,
  userId: string,
  opts: { cursor?: string; limit?: number },
) {
  await assertMember(roomId, userId);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

  let q = supabase
    .from("messages")
    .select(
      "id, room_id, sender_id, ciphertext, nonce, content_type, client_id, status, created_at",
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.cursor) q = q.lt("created_at", opts.cursor);

  const { data, error } = await q;
  if (error) throw new AppError(500, "MESSAGES_FETCH_FAILED", error.message);
  const messages = data ?? [];
  return {
    messages,
    next_cursor: messages.length ? messages[messages.length - 1]!.created_at : null,
  };
}

export async function sendMessage(
  roomId: string,
  userId: string,
  body: {
    ciphertext: string;
    nonce: string;
    client_id: string;
    content_type?: string;
  },
) {
  await assertMember(roomId, userId);

  const content_type = body.content_type ?? "text";
  if (!["text", "image", "system"].includes(content_type)) {
    throw new AppError(400, "BAD_CONTENT_TYPE", "Invalid content_type");
  }
  if (!body.ciphertext?.length || !body.nonce?.length || !body.client_id) {
    throw new AppError(400, "BAD_MESSAGE", "ciphertext, nonce, client_id required");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: userId,
      ciphertext: body.ciphertext,
      nonce: body.nonce,
      client_id: body.client_id,
      content_type,
      status: "sent",
    })
    .select(
      "id, room_id, sender_id, ciphertext, nonce, content_type, client_id, status, created_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("messages")
        .select(
          "id, room_id, sender_id, ciphertext, nonce, content_type, client_id, status, created_at",
        )
        .eq("sender_id", userId)
        .eq("client_id", body.client_id)
        .maybeSingle();
      if (existing) return existing;
    }
    throw new AppError(400, "MESSAGE_SEND_FAILED", error.message);
  }

  void notifyNewMessage(roomId, userId).catch(() => undefined);
  return data;
}

export async function markRead(roomId: string, userId: string) {
  await assertMember(roomId, userId);
  const { error } = await supabase.from("room_reads").upsert(
    {
      room_id: roomId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "room_id,user_id" },
  );
  if (error) throw new AppError(500, "READ_MARK_FAILED", error.message);
  return { ok: true };
}

/** Client already E2EE-encrypted bytes — store raw blob, no server re-encrypt. */
export async function storeChatMedia(
  roomId: string,
  userId: string,
  payload: { ciphertext_b64: string; mime: string },
) {
  await assertMember(roomId, userId);
  if (!payload.ciphertext_b64 || payload.ciphertext_b64.length > 7_000_000) {
    throw new AppError(400, "MEDIA_TOO_LARGE", "Encrypted media empty or too large");
  }
  if (!isR2Enabled()) {
    // demo: return media_id that embeds nothing — client keeps blob local keyed by mediaId
    const mediaId = `local:${randomUUID()}`;
    return { media_id: mediaId, storage: "local" as const };
  }

  const s3 = getS3Client();
  const key = `chat/${roomId}/${randomUUID()}.bin`;
  const buf = Buffer.from(payload.ciphertext_b64, "base64");
  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buf,
      ContentType: "application/octet-stream",
      Metadata: { "x-fym-mime": payload.mime || "application/octet-stream" },
    }),
  );
  return { media_id: key, storage: "r2" as const };
}

export async function getChatMedia(
  roomId: string,
  userId: string,
  mediaId: string,
) {
  await assertMember(roomId, userId);
  if (mediaId.startsWith("local:")) {
    throw new AppError(404, "MEDIA_LOCAL", "Local-only media not on server");
  }
  if (!isR2Enabled()) throw new AppError(503, "R2_OFF", "Media storage unavailable");

  const s3 = getS3Client();
  const out = await s3.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: mediaId }),
  );
  const bytes = Buffer.from(await out.Body!.transformToByteArray());
  return { ciphertext_b64: bytes.toString("base64") };
}
