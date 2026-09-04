-- 007: blocks table constraints — the live blocks table predates 006, so its
-- CREATE TABLE (with CHECK + UNIQUE) never applied. The block upsert in
-- safety.service.ts requires a unique index on (blocker_id, blocked_id).
-- Idempotent — safe to re-run.

-- Dedupe first (keep earliest block) so the unique index can be created.
DELETE FROM public.blocks a
  USING public.blocks b
  WHERE a.blocker_id = b.blocker_id
    AND a.blocked_id = b.blocked_id
    AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_blocks_pair
  ON public.blocks (blocker_id, blocked_id);

-- Self-block guard (constraint may already exist if the table was fresh)
DO $$ BEGIN
  ALTER TABLE public.blocks
    ADD CONSTRAINT blocks_no_self CHECK (blocker_id <> blocked_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- report_tickets: 006 added consent_at/notes as new columns on a table that
-- already had the canonical consent_given_at/reporter_notes. Drop the dupes
-- so there is exactly one source of truth for the DPDP artifacts.
ALTER TABLE public.report_tickets DROP COLUMN IF EXISTS consent_at;
ALTER TABLE public.report_tickets DROP COLUMN IF EXISTS notes;
