import { supabase } from "../libs/supabaseClient.js";
import { AppError } from "../middleware/errorHandler.middleware.js";
import { RANKING, SWIPE } from "../config/constants.js";
import {
  activityRecency,
  interestOverlap,
  matchScore,
  noveltyScore,
  parseGeo,
  preferenceFit,
  proximityScore,
  trustNorm,
} from "../utils/scoring.js";
import { resolvePhotoUrls } from "../utils/photoUrls.js";
import { needsReset } from "../utils/quota.js";

export type DiscoveryCard = {
  id: string;
  display_name: string | null;
  age: number | null;
  bio: string | null;
  photos: unknown;
  interests: string[] | null;
  prompts: unknown;
  is_verified: boolean | null;
  trust_score: number | null;
  distance_km: number | null;
  match_score: number;
  vibe: string | null;
};

export async function getDiscoveryBatch(viewerId: string): Promise<{
  profiles: DiscoveryCard[];
  remaining_today: number | null;
}> {
  const { data: viewer, error: vErr } = await supabase
    .from("profiles")
    .select(
      "id, age, interests, geolocation, age_min, age_max, distance_km, swipe_count_today, bonus_swipes_today, swipe_reset_date, subscription_tier, status",
    )
    .eq("id", viewerId)
    .single();

  if (vErr || !viewer) throw new AppError(404, "PROFILE_NOT_FOUND", "Viewer profile not found");
  if (viewer.status === "banned" || viewer.status === "suspended") {
    throw new AppError(403, "ACCOUNT_RESTRICTED", "Account cannot use discovery");
  }

  const [{ data: swipedRows }, { data: iBlocked }, { data: blockedMe }] = await Promise.all([
    supabase.from("swipes").select("target_id").eq("swiper_id", viewerId),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", viewerId),
    supabase.from("blocks").select("blocker_id").eq("blocked_id", viewerId),
  ]);

  const exclude = new Set<string>([
    viewerId,
    ...(swipedRows ?? []).map((r) => r.target_id),
    // blocked in either direction — never resurface that person
    ...(iBlocked ?? []).map((r) => r.blocked_id),
    ...(blockedMe ?? []).map((r) => r.blocker_id),
  ]);

  const ageMin = viewer.age_min ?? 18;
  const ageMax = viewer.age_max ?? 99;
  const radiusKm = viewer.distance_km ?? 50;
  const viewerGeo = parseGeo(viewer.geolocation);

  // Fetch a pool wider than batch — score in app (ponytail: no RPC yet)
  let q = supabase
    .from("profiles")
    .select(
      "id, display_name, age, bio, photos, interests, prompts, is_verified, trust_score, trust_score_percentile, last_active_at, created_at, geolocation, status, onboarding_step",
    )
    .eq("status", "active")
    .gt("trust_score_percentile", RANKING.TRUST_FLOOR)
    .gte("age", ageMin)
    .lte("age", ageMax)
    .not("display_name", "is", null)
    .limit(120);

  const { data: pool, error: pErr } = await q;
  if (pErr) throw new AppError(500, "DISCOVERY_FAILED", pErr.message);

  const candidates = (pool ?? []).filter((p) => !exclude.has(p.id));

  const scored: DiscoveryCard[] = [];
  for (const p of candidates) {
    const candGeo = parseGeo(p.geolocation);
    const prox = proximityScore(viewerGeo, candGeo, radiusKm);
    // Hard distance filter when both have geo
    if (viewerGeo && candGeo && prox.distanceKm != null && prox.distanceKm > radiusKm) {
      continue;
    }

    const parts = {
      preference_fit: preferenceFit(viewer.age, p.age),
      trust_norm: trustNorm(p.trust_score_percentile, p.trust_score),
      proximity: prox.score,
      activity_recency: activityRecency(p.last_active_at),
      interest_overlap: interestOverlap(viewer.interests, p.interests),
      novelty: noveltyScore(p.created_at),
    };
    const score = matchScore(parts);

    scored.push({
      id: p.id,
      display_name: p.display_name,
      age: p.age,
      bio: p.bio,
      photos: resolvePhotoUrls(p.photos),
      interests: p.interests,
      prompts: p.prompts,
      is_verified: p.is_verified,
      trust_score: p.trust_score,
      distance_km: prox.distanceKm != null ? Math.round(prox.distanceKm * 10) / 10 : null,
      match_score: Math.round(score * 1000) / 1000,
      vibe: p.bio,
    });
  }

  scored.sort((a, b) => b.match_score - a.match_score);
  const profiles = scored.slice(0, RANKING.BATCH);

  const remaining = remainingSwipes(viewer);

  // touch last_active
  void supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", viewerId);

  return { profiles, remaining_today: remaining };
}

function remainingSwipes(viewer: {
  swipe_count_today: number | null;
  bonus_swipes_today: number | null;
  swipe_reset_date: string | null;
  subscription_tier: string | null;
}): number {
  const tier = (viewer.subscription_tier ?? "FREE").toUpperCase();
  const cap =
    tier === "PRO" ? SWIPE.PRO_DAILY : tier === "PLUS" ? SWIPE.PLUS_DAILY : SWIPE.FREE_DAILY;
  const used = needsReset(viewer.swipe_reset_date) ? 0 : (viewer.swipe_count_today ?? 0);
  const bonus = needsReset(viewer.swipe_reset_date) ? 0 : (viewer.bonus_swipes_today ?? 0);
  return Math.max(0, cap + bonus - used);
}


