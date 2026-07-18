import { randomUUID } from "crypto";
import { supabase } from "../libs/supabaseClient.js";
import { AppError } from "../middleware/errorHandler.middleware.js";
import { NEGATIVE_REVIEW_TAGS, SWIPE } from "../config/constants.js";

type Action = "like" | "superlike" | "pass";

function needsReset(resetDate: string | null): boolean {
  if (!resetDate) return true;
  const d = new Date(resetDate);
  const now = new Date();
  return (
    d.getUTCFullYear() !== now.getUTCFullYear() ||
    d.getUTCMonth() !== now.getUTCMonth() ||
    d.getUTCDate() !== now.getUTCDate()
  );
}

function dailyCap(tier: string | null, kind: "swipe" | "superlike"): number {
  const t = (tier ?? "FREE").toUpperCase();
  if (kind === "superlike") {
    if (t === "PRO") return SWIPE.SUPERLIKE_PRO;
    if (t === "PLUS") return SWIPE.SUPERLIKE_PLUS;
    return SWIPE.SUPERLIKE_FREE;
  }
  if (t === "PRO") return SWIPE.PRO_DAILY;
  if (t === "PLUS") return SWIPE.PLUS_DAILY;
  return SWIPE.FREE_DAILY;
}

async function loadViewer(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, status, subscription_tier, swipe_count_today, bonus_swipes_today, swipe_reset_date",
    )
    .eq("id", userId)
    .single();
  if (error || !data) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
  if (data.status === "banned" || data.status === "suspended") {
    throw new AppError(403, "ACCOUNT_RESTRICTED", "Account restricted");
  }
  return data;
}

async function ensureDailyCounters(viewer: {
  id: string;
  swipe_count_today: number | null;
  bonus_swipes_today: number | null;
  swipe_reset_date: string | null;
}) {
  if (!needsReset(viewer.swipe_reset_date)) {
    return {
      swipe_count_today: viewer.swipe_count_today ?? 0,
      bonus_swipes_today: viewer.bonus_swipes_today ?? 0,
    };
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({
      swipe_count_today: 0,
      bonus_swipes_today: 0,
      swipe_reset_date: new Date().toISOString(),
    })
    .eq("id", viewer.id)
    .select("swipe_count_today, bonus_swipes_today")
    .single();
  if (error) throw new AppError(500, "QUOTA_RESET_FAILED", error.message);
  return {
    swipe_count_today: data.swipe_count_today ?? 0,
    bonus_swipes_today: data.bonus_swipes_today ?? 0,
  };
}

async function assertQuota(userId: string, kind: "swipe" | "superlike") {
  const viewer = await loadViewer(userId);
  const counters = await ensureDailyCounters(viewer);
  const cap = dailyCap(viewer.subscription_tier, kind);
  const budget = cap + (kind === "swipe" ? counters.bonus_swipes_today : 0);
  if (counters.swipe_count_today >= budget && kind === "swipe") {
    throw new AppError(429, "SWIPE_QUOTA", "Daily swipe limit reached");
  }
  // Superlike counts against swipe quota too + separate soft cap
  if (kind === "superlike") {
    if (counters.swipe_count_today >= dailyCap(viewer.subscription_tier, "swipe") + counters.bonus_swipes_today) {
      throw new AppError(429, "SWIPE_QUOTA", "Daily swipe limit reached");
    }
    const { count } = await supabase
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .eq("swiper_id", userId)
      .eq("action", "superlike")
      .gte("created_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());
    if ((count ?? 0) >= dailyCap(viewer.subscription_tier, "superlike")) {
      throw new AppError(429, "SUPERLIKE_QUOTA", "Daily superlike limit reached");
    }
  }
  return viewer;
}

async function recordSwipe(swiperId: string, targetId: string, action: Action) {
  if (swiperId === targetId) {
    throw new AppError(400, "SELF_SWIPE", "Cannot swipe yourself");
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, status")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.status !== "active") {
    throw new AppError(404, "TARGET_NOT_FOUND", "Profile not available");
  }

  const { error } = await supabase.from("swipes").insert({
    swiper_id: swiperId,
    target_id: targetId,
    action,
  });
  if (error) {
    if (error.code === "23505") {
      throw new AppError(409, "ALREADY_SWIPED", "Already swiped this profile");
    }
    throw new AppError(400, "SWIPE_FAILED", error.message);
  }

  // atomic increment
  await supabase.rpc("increment_swipe_count", { p_user_id: swiperId, p_delta: 1 });
}

async function tryMatch(swiperId: string, targetId: string): Promise<{
  matched: boolean;
  roomId?: string;
}> {
  const { data: reverse } = await supabase
    .from("swipes")
    .select("id, action")
    .eq("swiper_id", targetId)
    .eq("target_id", swiperId)
    .in("action", ["like", "superlike"])
    .maybeSingle();

  if (!reverse) return { matched: false };

  // create room + members
  const { data: room, error: rErr } = await supabase
    .from("rooms")
    .insert({})
    .select("id")
    .single();
  if (rErr || !room) throw new AppError(500, "ROOM_CREATE_FAILED", rErr?.message ?? "room");

  const { error: mErr } = await supabase.from("room_members").insert([
    { room_id: room.id, user_id: swiperId },
    { room_id: room.id, user_id: targetId },
  ]);
  if (mErr) throw new AppError(500, "ROOM_MEMBER_FAILED", mErr.message);

  return { matched: true, roomId: room.id };
}

export async function like(swiperId: string, targetId: string) {
  await assertQuota(swiperId, "swipe");
  await recordSwipe(swiperId, targetId, "like");
  const match = await tryMatch(swiperId, targetId);
  return { ok: true, action: "like" as const, ...match };
}

export async function superlike(swiperId: string, targetId: string) {
  await assertQuota(swiperId, "superlike");
  await recordSwipe(swiperId, targetId, "superlike");
  const match = await tryMatch(swiperId, targetId);
  return { ok: true, action: "superlike" as const, ...match };
}

export async function passBatch(
  reviewerId: string,
  items: { target_id: string; tags: string[]; review_text?: string }[],
) {
  if (items.length === 0 || items.length > SWIPE.BATCH_SIZE) {
    throw new AppError(400, "BATCH_SIZE", `Batch must be 1–${SWIPE.BATCH_SIZE}`);
  }

  await assertQuota(reviewerId, "swipe");
  // pass batch burns one swipe per item for quota honesty
  const viewer = await loadViewer(reviewerId);
  const counters = await ensureDailyCounters(viewer);
  const budget =
    dailyCap(viewer.subscription_tier, "swipe") + counters.bonus_swipes_today;
  if (counters.swipe_count_today + items.length > budget) {
    throw new AppError(429, "SWIPE_QUOTA", "Not enough swipes for this batch");
  }

  const batchId = randomUUID();
  const cooldownMs = SWIPE.REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const since = new Date(Date.now() - cooldownMs).toISOString();

  for (const item of items) {
    if (item.target_id === reviewerId) {
      throw new AppError(400, "SELF_SWIPE", "Cannot review yourself");
    }
    if (!item.tags?.length) {
      throw new AppError(400, "TAGS_REQUIRED", "Each pass needs at least one tag");
    }

    // cooldown reviewer→target
    const { data: prior } = await supabase
      .from("reviews")
      .select("id")
      .eq("reviewer_id", reviewerId)
      .eq("target_user_id", item.target_id)
      .gte("created_at", since)
      .maybeSingle();
    if (prior) {
      throw new AppError(409, "REVIEW_COOLDOWN", "Already reviewed this user recently", {
        target_id: item.target_id,
      });
    }

    // insert pass swipe (ignore if already swiped with like — shouldn't happen)
    const { error: sErr } = await supabase.from("swipes").upsert(
      {
        swiper_id: reviewerId,
        target_id: item.target_id,
        action: "pass",
      },
      { onConflict: "swiper_id,target_id", ignoreDuplicates: true },
    );
    if (sErr) throw new AppError(400, "SWIPE_FAILED", sErr.message);

    const { error: rErr } = await supabase.from("reviews").insert({
      target_user_id: item.target_id,
      reviewer_id: reviewerId,
      tags: item.tags,
      review_text: item.review_text ?? null,
      batch_id: batchId,
    });
    if (rErr) throw new AppError(400, "REVIEW_FAILED", rErr.message);

    // trust delta — simple, no credibility weight yet
    // ponytail: full credibility pipeline when abuse shows up
    let delta = 0;
    for (const tag of item.tags) {
      delta += NEGATIVE_REVIEW_TAGS.has(tag) ? -5 : -1;
    }
    if (delta !== 0) {
      const { data: t } = await supabase
        .from("profiles")
        .select("trust_score")
        .eq("id", item.target_id)
        .single();
      if (t) {
        const next = Math.max(0, Math.min(200, (t.trust_score ?? 100) + delta));
        await supabase.from("profiles").update({ trust_score: next }).eq("id", item.target_id);
      }
    }
  }

  // atomic increment
  await supabase
    .rpc("increment_swipe_count", { p_user_id: reviewerId, p_delta: items.length });

  return { ok: true, batch_id: batchId, count: items.length };
}
