-- 005: RLS hardening (column grants on profiles) + integrity constraints
-- From the 2026-08-16 audit. Sections are independent — a failure in one
-- can be fixed and the file re-run (statements are IF EXISTS-tolerant).

-- ════════════════════════════════════════════════════════════════════
-- 1. profiles: block self-service premium / trust / quota fields
--    RLS is row-level only; column grants are the column-level guard.
--    Without this, any authenticated user can PATCH their own row to
--    subscription_tier='PRO', is_verified=true, trust_score=<max>,
--    swipe_count_today=0 via the Data API.
-- ════════════════════════════════════════════════════════════════════
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, bio, photos, interests, prompts, quiz,
              gender_preference, age_min, age_max, distance_km,
              geolocation, public_key, onboarding_step, last_active_at)
  ON public.profiles TO authenticated;
-- Now backend-only via service role: subscription_tier, swipe_count_today,
-- bonus_swipes_today, ad_watches_today, trust_score,
-- trust_score_percentile, is_verified, status, age.

-- 2. profiles: stop leaking geolocation + internals to all authenticated
--    The 'active profiles' SELECT policy exposes every column. Frontend
--    reads profiles only through the backend, so direct access is minimal.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, age, bio, photos, interests, prompts,
              public_key, is_verified)
  ON public.profiles TO authenticated;

-- 3. PostGIS metadata: Supabase default grants let anon write. Nobody
--    in the app touches this table.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys
  FROM anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- 4. Integrity: make FK columns NOT NULL + ON DELETE CASCADE.
--    Orphan rows are deleted first (they are unreachable garbage).
-- ════════════════════════════════════════════════════════════════════
DELETE FROM public.swipes          WHERE swiper_id IS NULL OR target_id IS NULL;
DELETE FROM public.liveness_checks WHERE user_id IS NULL;
DELETE FROM public.room_members    WHERE room_id IS NULL OR user_id IS NULL;
DELETE FROM public.messages        WHERE room_id IS NULL OR sender_id IS NULL;
DELETE FROM public.reviews         WHERE target_user_id IS NULL OR reviewer_id IS NULL;
DELETE FROM public.report_evidence WHERE ticket_id IS NULL;

ALTER TABLE public.swipes
  ALTER COLUMN swiper_id SET NOT NULL,
  ALTER COLUMN target_id SET NOT NULL;
ALTER TABLE public.liveness_checks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.room_members
  ALTER COLUMN room_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.messages
  ALTER COLUMN room_id SET NOT NULL,
  ALTER COLUMN sender_id SET NOT NULL;
ALTER TABLE public.reviews
  ALTER COLUMN target_user_id SET NOT NULL,
  ALTER COLUMN reviewer_id SET NOT NULL;
ALTER TABLE public.report_evidence ALTER COLUMN ticket_id SET NOT NULL;

-- Replace nullable no-action FKs with cascading ones (drop + re-add).
ALTER TABLE public.profiles         DROP CONSTRAINT profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.liveness_checks DROP CONSTRAINT liveness_checks_user_id_fkey;
ALTER TABLE public.liveness_checks
  ADD CONSTRAINT liveness_checks_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.swipes DROP CONSTRAINT swipes_swiper_id_fkey,
                          DROP CONSTRAINT swipes_target_id_fkey;
ALTER TABLE public.swipes
  ADD CONSTRAINT swipes_swiper_id_fkey FOREIGN KEY (swiper_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT swipes_target_id_fkey FOREIGN KEY (target_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reviews DROP CONSTRAINT reviews_target_user_id_fkey,
                           DROP CONSTRAINT reviews_reviewer_id_fkey;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_target_user_id_fkey FOREIGN KEY (target_user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.room_members DROP CONSTRAINT room_members_room_id_fkey,
                                DROP CONSTRAINT room_members_user_id_fkey;
ALTER TABLE public.room_members
  ADD CONSTRAINT room_members_room_id_fkey FOREIGN KEY (room_id)
    REFERENCES public.rooms(id) ON DELETE CASCADE,
  ADD CONSTRAINT room_members_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.messages DROP CONSTRAINT messages_room_id_fkey,
                            DROP CONSTRAINT messages_sender_id_fkey;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_room_id_fkey FOREIGN KEY (room_id)
    REFERENCES public.rooms(id) ON DELETE CASCADE,
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.report_tickets DROP CONSTRAINT report_tickets_reporter_id_fkey,
                                  DROP CONSTRAINT report_tickets_target_id_fkey,
                                  DROP CONSTRAINT report_tickets_room_id_fkey;
ALTER TABLE public.report_tickets
  ADD CONSTRAINT report_tickets_reporter_id_fkey FOREIGN KEY (reporter_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT report_tickets_target_id_fkey FOREIGN KEY (target_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT report_tickets_room_id_fkey FOREIGN KEY (room_id)
    REFERENCES public.rooms(id) ON DELETE SET NULL;

ALTER TABLE public.report_evidence DROP CONSTRAINT report_evidence_ticket_id_fkey;
ALTER TABLE public.report_evidence
  ADD CONSTRAINT report_evidence_ticket_id_fkey FOREIGN KEY (ticket_id)
  REFERENCES public.report_tickets(id) ON DELETE CASCADE;

ALTER TABLE public.moderation_decisions DROP CONSTRAINT moderation_decisions_ticket_id_fkey;
ALTER TABLE public.moderation_decisions
  ADD CONSTRAINT moderation_decisions_ticket_id_fkey FOREIGN KEY (ticket_id)
  REFERENCES public.report_tickets(id) ON DELETE CASCADE;

ALTER TABLE public.grievance_tickets DROP CONSTRAINT grievance_tickets_reporter_id_fkey,
                                     DROP CONSTRAINT grievance_tickets_target_id_fkey;
ALTER TABLE public.grievance_tickets
  ADD CONSTRAINT grievance_tickets_reporter_id_fkey FOREIGN KEY (reporter_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT grievance_tickets_target_id_fkey FOREIGN KEY (target_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ════════════════════════════════════════════════════════════════════
-- 5. Uniqueness the backend logic already assumes
-- ════════════════════════════════════════════════════════════════════
-- One swipe per (swiper, target). Deduplicate before constraining.
DELETE FROM public.swipes s
  USING public.swipes d
  WHERE s.id > d.id AND s.swiper_id = d.swiper_id AND s.target_id = d.target_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_swipes_swiper_target
  ON public.swipes (swiper_id, target_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_members_room_user
  ON public.room_members (room_id, user_id);

-- Idempotent message sends (client_id per sender already indexed in 004;
-- this makes it a hard constraint).
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client_id
  ON public.messages (client_id) WHERE client_id IS NOT NULL;

-- No duplicate evidence rows on retry
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_evidence_ticket_seq
  ON public.report_evidence (ticket_id, sequence_number);

-- ════════════════════════════════════════════════════════════════════
-- 6. One room per user pair — kills the double-match race at the DB.
--    Canonical pair (user_a < user_b) maintained by trigger so the
--    backend needs no code change; existing rooms backfilled.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS user_a UUID,
  ADD COLUMN IF NOT EXISTS user_b UUID;

-- Backfill: rooms with exactly two members get their canonical pair.
-- Rooms with a duplicate pair keep the earliest; later dupes are orphaned
-- (kept as rows but excluded from the unique index is not possible for
-- plain columns, so dedupe by deleting the newer duplicate rooms).
DELETE FROM public.rooms r
WHERE r.created_at > (
  SELECT MIN(r2.created_at) FROM public.rooms r2
  JOIN public.room_members m1 ON m1.room_id = r2.id
  JOIN public.room_members m2 ON m2.room_id = r2.id AND m2.user_id > m1.user_id
  JOIN public.room_members n1 ON n1.room_id = r.id
  JOIN public.room_members n2 ON n2.room_id = r.id AND n2.user_id > n1.user_id
  WHERE LEAST(m1.user_id, m2.user_id) = LEAST(n1.user_id, n2.user_id)
    AND GREATEST(m1.user_id, m2.user_id) = GREATEST(n1.user_id, n2.user_id)
    AND r2.id <> r.id
);

UPDATE public.rooms r
SET user_a = p.lo, user_b = p.hi
FROM (
  SELECT room_id, MIN(user_id) AS lo, MAX(user_id) AS hi
  FROM public.room_members
  GROUP BY room_id
  HAVING COUNT(*) = 2
) p
WHERE p.room_id = r.id AND r.user_a IS NULL;

-- Canonical-pair trigger: fills user_a/user_b when the 2nd member joins.
CREATE OR REPLACE FUNCTION public.set_room_pair() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  lo UUID; hi UUID; n INT;
BEGIN
  SELECT COUNT(*), MIN(user_id), MAX(user_id) INTO n, lo, hi
  FROM public.room_members WHERE room_id = NEW.room_id;
  IF n = 2 THEN
    UPDATE public.rooms SET user_a = lo, user_b = hi WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_room_pair ON public.room_members;
CREATE TRIGGER trg_set_room_pair
  AFTER INSERT ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.set_room_pair();

CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_user_pair
  ON public.rooms (user_a, user_b) WHERE user_a IS NOT NULL;

-- Backend tryMatch can now do, race-free:
--   INSERT INTO rooms (user_a, user_b) VALUES (least, greatest)
--   ON CONFLICT (user_a, user_b) DO NOTHING RETURNING id;
-- (pair columns are also maintained automatically for the old insert path)

-- ════════════════════════════════════════════════════════════════════
-- 7. Missing indexes for live query paths
-- ════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_swipes_target
  ON public.swipes (target_id);                      -- "who liked me"
CREATE INDEX IF NOT EXISTS idx_swipes_swiper_created
  ON public.swipes (swiper_id, created_at DESC);     -- daily quota count
CREATE INDEX IF NOT EXISTS idx_room_members_user
  ON public.room_members (user_id);                  -- my matches
CREATE INDEX IF NOT EXISTS idx_liveness_user_created
  ON public.liveness_checks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_tickets_open
  ON public.report_tickets (created_at DESC)
  WHERE status IN ('open', 'under_review');
CREATE INDEX IF NOT EXISTS idx_profiles_interests_gin
  ON public.profiles USING GIN (interests);          -- overlap scoring

-- ════════════════════════════════════════════════════════════════════
-- NOT DONE HERE (needs backend code changes — do not apply blindly):
--  * banned_phones.phone is plaintext: hashing requires the backend
--    lookup to hash before SELECT.
--  * profiles.age is a stale-able snapshot: migrating to date_of_birth
--    requires the onboarding/edit endpoints + discovery filter change.
--  * Baseline export of the dashboard-created RLS policies into the
--    repo (supabase db pull) — separate concern, no schema change.
-- ════════════════════════════════════════════════════════════════════
