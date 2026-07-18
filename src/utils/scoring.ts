import { RANKING } from "../config/constants.js";

export type ViewerGeo = { lat: number; lng: number } | null;

/** Haversine km — no PostGIS dependency in app layer */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function parseGeo(raw: unknown): { lat: number; lng: number } | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    // GeoJSON Point from PostGIS
    if (o.type === "Point" && Array.isArray(o.coordinates)) {
      const [lng, lat] = o.coordinates as number[];
      if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
    }
    if (typeof o.lat === "number" && typeof o.lng === "number") {
      return { lat: o.lat, lng: o.lng };
    }
  }
  if (typeof raw === "string") {
    // WKT POINT(lng lat)
    const m = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (m) return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
  }
  return null;
}

export function preferenceFit(viewerAge: number | null, candidateAge: number | null): number {
  // Hard filters done upstream. Soft: prefer similar age band.
  if (viewerAge == null || candidateAge == null) return 0.7;
  const gap = Math.abs(viewerAge - candidateAge);
  if (gap <= 2) return 1;
  if (gap <= 5) return 0.85;
  if (gap <= 10) return 0.6;
  return 0.35;
}

export function trustNorm(percentile: number | null, trustScore: number | null): number {
  if (percentile != null && !Number.isNaN(Number(percentile))) {
    return Math.min(1, Math.max(0, Number(percentile)));
  }
  // fallback raw score 0–100
  return Math.min(1, Math.max(0, (trustScore ?? 50) / 100));
}

export function proximityScore(
  viewer: ViewerGeo,
  candidate: ViewerGeo,
  radiusKm: number,
): { score: number; distanceKm: number | null } {
  if (!viewer || !candidate) return { score: 0.5, distanceKm: null };
  const d = distanceKm(viewer, candidate);
  if (d > radiusKm) return { score: 0, distanceKm: d };
  // linear inverse within radius
  return { score: 1 - d / radiusKm, distanceKm: d };
}

export function activityRecency(lastActiveAt: string | null): number {
  if (!lastActiveAt) return 0.2;
  const hours = (Date.now() - new Date(lastActiveAt).getTime()) / 3_600_000;
  if (hours < 24) return 1;
  if (hours < 24 * 7) return 0.75;
  if (hours < 24 * 30) return 0.4;
  return 0.15;
}

export function interestOverlap(a: string[] | null, b: string[] | null): number {
  const A = new Set((a ?? []).map((s) => s.toLowerCase()));
  const B = new Set((b ?? []).map((s) => s.toLowerCase()));
  if (A.size === 0 || B.size === 0) return 0.3;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function noveltyScore(createdAt: string | null, neverShownBoost = true): number {
  // ponytail: no impressions table yet — boost young accounts
  if (!createdAt) return neverShownBoost ? 0.5 : 0.3;
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours < 72) return 1;
  if (hours < 24 * 14) return 0.6;
  return 0.3;
}

export function matchScore(parts: {
  preference_fit: number;
  trust_norm: number;
  proximity: number;
  activity_recency: number;
  interest_overlap: number;
  novelty: number;
}): number {
  return (
    RANKING.preference_fit * parts.preference_fit +
    RANKING.trust_score * parts.trust_norm +
    RANKING.proximity * parts.proximity +
    RANKING.activity_recency * parts.activity_recency +
    RANKING.interest_overlap * parts.interest_overlap +
    RANKING.novelty * parts.novelty
  );
}
