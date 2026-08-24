-- 002_swipe_uniques.sql
-- Live Supabase already has tables (profiles, swipes, reviews, rooms…).
-- This only adds constraints/indexes Phase 1 swipe code needs.
-- Run in Supabase SQL editor AFTER the dup checks below return 0 rows.

-- ── Preflight (run first; must return no rows) ─────────────────────
-- SELECT swiper_id, target_id, count(*) FROM public.swipes
--   GROUP BY 1, 2 HAVING count(*) > 1;
-- SELECT room_id, user_id, count(*) FROM public.room_members
--   GROUP BY 1, 2 HAVING count(*) > 1;

ALTER TABLE public.swipes
  ADD CONSTRAINT swipes_swiper_target_unique UNIQUE (swiper_id, target_id);

ALTER TABLE public.room_members
  ADD CONSTRAINT room_members_room_user_unique UNIQUE (room_id, user_id);

CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON public.swipes (swiper_id);
CREATE INDEX IF NOT EXISTS idx_swipes_target ON public.swipes (target_id);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON public.reviews (target_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_trust ON public.profiles (trust_score);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles (last_active_at);
CREATE INDEX IF NOT EXISTS idx_profiles_geo ON public.profiles USING gist (geolocation);
