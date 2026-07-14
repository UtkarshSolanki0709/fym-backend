-- =====================================================================
-- FYM (Find Your Mate) — Supabase Database Schema Snapshot
-- Location: backend/src/db/schema.sql
-- Covers: PostGIS, public.profiles, liveness, swipes, reviews, chat rooms,
--         E2EE messages, moderation tickets, device/phone bans, RLS, triggers & RPCs.
-- =====================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Drop existing tables/functions if restarting (optional, run carefully in dev)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();

-- =====================================================================
-- 1. Profiles Table (Linked to auth.users)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT UNIQUE,
  age INTEGER CHECK (age >= 18 AND age <= 120),
  bio TEXT,
  trust_score INTEGER DEFAULT 100 CHECK (trust_score >= 0),
  trust_score_percentile NUMERIC(5, 4) DEFAULT 1.0000,
  is_verified BOOLEAN DEFAULT FALSE,
  subscription_tier TEXT DEFAULT 'FREE' CHECK (subscription_tier IN ('FREE', 'PLUS', 'PRO')),
  swipe_count_today INTEGER DEFAULT 0 CHECK (swipe_count_today >= 0),
  bonus_swipes_today INTEGER DEFAULT 0 CHECK (bonus_swipes_today >= 0),
  ad_watches_today INTEGER DEFAULT 0 CHECK (ad_watches_today >= 0),
  swipe_reset_date TIMESTAMPTZ DEFAULT NOW(),
  geolocation GEOGRAPHY(Point, 4326),
  public_key TEXT,
  onboarding_step TEXT DEFAULT 'auth_done',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  photos JSONB DEFAULT '[]'::jsonb, -- Array of { id: string, url: string }
  interests TEXT[] DEFAULT '{}',
  prompts JSONB DEFAULT '[]'::jsonb, -- Array of { question: string, answer: string }
  quiz JSONB NOT NULL DEFAULT '[]'::jsonb,
  gender_preference TEXT CHECK (gender_preference IN ('male','female','both')),
  age_min INTEGER CHECK (age_min >= 18 AND age_min <= 120),
  age_max INTEGER CHECK (age_max >= 18 AND age_max <= 120),
  distance_km INTEGER NOT NULL DEFAULT 50 CHECK (distance_km >= 1 AND distance_km <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 2. Liveness Checks Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.liveness_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  passed BOOLEAN NOT NULL,
  eye_open_frames INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 3. Swipes & Matches Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'superlike', 'pass')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(swiper_id, target_id)
);

-- =====================================================================
-- 4. Left-Swipe Feedback Reviews Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  review_text TEXT,
  batch_id UUID, -- Tied to 5-pass batch submission
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 5. E2EE Chat Rooms & Membership
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.room_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- =====================================================================
-- 6. Encrypted Messages Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL, -- AES-GCM Encrypted payload
  nonce TEXT NOT NULL,       -- Crypto initialization vector (IV)
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 7. Reporting & Grievance Tickets
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.report_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  reporter_notes TEXT,
  consent_given_at TIMESTAMPTZ NOT NULL,
  agreement_version TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved_warning_target', 'resolved_banned', 'resolved_no_action', 'resolved_reporter_warned')),
  assigned_moderator_id UUID, -- Admin/moderator handling the ticket
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.report_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.report_tickets(id) ON DELETE CASCADE,
  moderator_encrypted_payload TEXT NOT NULL, -- Encrypted with moderator public key
  sequence_number INTEGER NOT NULL,
  content_hash TEXT, -- Chain-of-custody checksum
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.moderation_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES public.report_tickets(id) ON DELETE CASCADE,
  moderator_id UUID,
  decision TEXT NOT NULL,
  rationale_internal TEXT NOT NULL,
  outcome_message_sent TEXT,
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grievance_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- =====================================================================
-- 8. Ban Blocklists
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.banned_devices (
  device_hash TEXT PRIMARY KEY, -- One-way hash of device ID
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

CREATE TABLE IF NOT EXISTS public.banned_phones (
  phone TEXT PRIMARY KEY, -- Full E.164 phone string
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT
);

-- =====================================================================
-- 9. Discovery Algorithm Configuration
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ranking_config (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default weights for discovery scoring
INSERT INTO public.ranking_config (key, value) VALUES
  ('weight_preference_fit', 0.35),
  ('weight_trust_score', 0.20),
  ('weight_proximity', 0.15),
  ('weight_activity_recency', 0.15),
  ('weight_interest_overlap', 0.10),
  ('weight_novelty', 0.05)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- =====================================================================
-- 10. Database Indexes for Performance
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_geo ON public.profiles USING gist (geolocation);
CREATE INDEX IF NOT EXISTS idx_profiles_trust ON public.profiles (trust_score);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles (last_active_at);
CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON public.swipes (swiper_id);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON public.reviews (target_user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room ON public.messages (room_id);
CREATE INDEX IF NOT EXISTS idx_report_status ON public.report_tickets (status);


-- =====================================================================
-- 11. Stored Procedures (RPCs)
-- =====================================================================

-- RPC: Append Photo
-- Appends a photo object to profiles.photos JSONB array
CREATE OR REPLACE FUNCTION public.append_photo(p_user_id UUID, p_photo JSONB)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET photos = COALESCE(photos, '[]'::jsonb) || p_photo
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Remove Photo
-- Removes a photo object from profiles.photos JSONB array by photo ID
CREATE OR REPLACE FUNCTION public.remove_photo(p_user_id UUID, p_photo_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET photos = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(photos, '[]'::jsonb)) AS elem
    WHERE elem->>'id' <> p_photo_id
  )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper Function: Check if user is a member of a room (SECURITY DEFINER to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================================
-- 12. Public Trigger Functions & Triggers
-- =====================================================================

-- Trigger function: Automatically create profile when user is registered in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, trust_score, subscription_tier, status, onboarding_step)
  VALUES (new.id, 100, 'FREE', 'active', 'auth_done');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users table
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger function: Prevent authenticated users from modifying system-protected columns on public.profiles
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- 'authenticated' is the standard client role in Supabase
  IF current_setting('role') = 'authenticated' THEN
    IF NEW.trust_score IS DISTINCT FROM OLD.trust_score OR
       NEW.trust_score_percentile IS DISTINCT FROM OLD.trust_score_percentile OR
       NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
       NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier OR
       NEW.swipe_count_today IS DISTINCT FROM OLD.swipe_count_today OR
       NEW.bonus_swipes_today IS DISTINCT FROM OLD.bonus_swipes_today OR
       NEW.ad_watches_today IS DISTINCT FROM OLD.ad_watches_today OR
       NEW.swipe_reset_date IS DISTINCT FROM OLD.swipe_reset_date OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.id IS DISTINCT FROM OLD.id
    THEN
      RAISE EXCEPTION 'Unauthorized to modify system-protected columns (trust_score, is_verified, subscription_tier, etc.)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to profiles table
CREATE OR REPLACE TRIGGER on_profile_update_protect_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();


-- =====================================================================
-- 13. Row-Level Security (RLS) Policies
-- =====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liveness_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grievance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_phones ENABLE ROW LEVEL SECURITY;

-- --- Profiles RLS ---
CREATE POLICY "Allow authenticated read for active profiles" ON public.profiles
  FOR SELECT TO authenticated USING (status = 'active');

CREATE POLICY "Allow users to update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- --- Liveness Checks RLS ---
CREATE POLICY "Allow users to view own liveness checks" ON public.liveness_checks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- --- Swipes RLS ---
CREATE POLICY "Allow swiper access to own swipes" ON public.swipes
  FOR SELECT TO authenticated USING (auth.uid() = swiper_id);

-- --- Reviews RLS ---
CREATE POLICY "Allow reviewers to read own reviews" ON public.reviews
  FOR SELECT TO authenticated USING (auth.uid() = reviewer_id);

-- --- Rooms & Members RLS ---
CREATE POLICY "Allow members to read rooms" ON public.rooms
  FOR SELECT TO authenticated USING (public.is_room_member(id, auth.uid()));

CREATE POLICY "Allow members to read room relationships" ON public.room_members
  FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));

-- --- Messages RLS ---
CREATE POLICY "Allow room members to read messages" ON public.messages
  FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));

CREATE POLICY "Allow room members to send messages" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND
    public.is_room_member(room_id, auth.uid())
  );

-- --- Safety Reports & Decisions RLS ---
CREATE POLICY "Allow reporters to read own tickets" ON public.report_tickets
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

CREATE POLICY "Allow reporters to insert report tickets" ON public.report_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Allow reporters to insert evidence" ON public.report_evidence
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.report_tickets
      WHERE id = ticket_id AND reporter_id = auth.uid()
    )
  );

-- --- Grievance Tickets RLS ---
CREATE POLICY "Allow users to read own grievance tickets" ON public.grievance_tickets
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);

CREATE POLICY "Allow users to insert grievance tickets" ON public.grievance_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Decisions and general bans are restricted. Read/Write allowed only via service role (backend).

