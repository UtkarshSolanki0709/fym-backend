-- Chat extras: content_type, client_id, room_reads, push tokens
-- Ponytail audit: composite PK on push tokens, drop dead idx_messages_room, RLS on new tables

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'image', 'system'));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client
  ON public.messages (sender_id, client_id)
  WHERE client_id IS NOT NULL;

-- (room_id, created_at DESC) covers former room_id-only index
CREATE INDEX IF NOT EXISTS idx_messages_room_created
  ON public.messages (room_id, created_at DESC);

DROP INDEX IF EXISTS public.idx_messages_room;

CREATE TABLE IF NOT EXISTS public.room_reads (
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- No surrogate id: lookups/upserts are always (user_id, token)
DROP TABLE IF EXISTS public.device_push_tokens;
CREATE TABLE public.device_push_tokens (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, token)
);

-- ── RLS (match rest of schema) ─────────────────────────
ALTER TABLE public.room_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow members to read own room_reads" ON public.room_reads;
CREATE POLICY "Allow members to read own room_reads" ON public.room_reads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow members to insert own room_reads" ON public.room_reads;
CREATE POLICY "Allow members to insert own room_reads" ON public.room_reads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow members to update own room_reads" ON public.room_reads;
CREATE POLICY "Allow members to update own room_reads" ON public.room_reads
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to manage own push tokens" ON public.device_push_tokens;
CREATE POLICY "Allow users to manage own push tokens" ON public.device_push_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime (ops — run in Supabase if not already):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
