-- 006: Safety & compliance MVP — blocks table, report/grievance column
-- guarantees, like notes, who-liked-you index.
-- Every statement is idempotent — safe to re-run. report_tickets /
-- report_evidence / grievance_tickets already exist in the live project
-- (referenced by 005); the CREATE TABLE IF NOT EXISTS guards only cover
-- fresh environments.

-- ════════════════════════════════════════════════════════════════════
-- 1. blocks: hard social wall. Blocked users disappear from discovery,
--    who-liked-you, and future matching for BOTH directions.
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_no_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT uq_blocks_pair UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks (blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "blocks_select_own" ON public.blocks
    FOR SELECT TO authenticated USING (blocker_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "blocks_insert_own" ON public.blocks
    FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════════════
-- 2. report_tickets: guarantee the columns the safety API writes.
--    consent_at + agreement_version are the DPDP Act artifacts.
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.report_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'open',
  consent_at timestamptz NOT NULL DEFAULT now(),
  agreement_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.report_tickets ADD COLUMN IF NOT EXISTS reasons text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.report_tickets ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.report_tickets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE public.report_tickets ADD COLUMN IF NOT EXISTS consent_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.report_tickets ADD COLUMN IF NOT EXISTS agreement_version text NOT NULL DEFAULT 'v1';
CREATE INDEX IF NOT EXISTS idx_report_tickets_reporter ON public.report_tickets (reporter_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════
-- 3. grievance_tickets: IT-Rules 2021 grievance channel
-- ════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.grievance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'general',
  description text NOT NULL DEFAULT '',
  contact_email text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.grievance_tickets ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE public.grievance_tickets ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.grievance_tickets ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.grievance_tickets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
CREATE INDEX IF NOT EXISTS idx_grievance_reporter ON public.grievance_tickets (reporter_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════════
-- 4. swipes.note: optional comment attached to a like/superlike
--    (deck comment box). Surfaced only in who-liked-you.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE public.swipes ADD COLUMN IF NOT EXISTS note text;

-- ════════════════════════════════════════════════════════════════════
-- 5. who-liked-you hot path: incoming likes for a target
-- ════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_swipes_target_incoming
  ON public.swipes (target_id, created_at DESC)
  WHERE action IN ('like', 'superlike');
