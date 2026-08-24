-- 003_ensure_profile_trigger.sql
-- Ensure auth.users insert creates public.profiles (fixes missing row → update .single() errors)
-- Run in Supabase SQL editor if trigger not already present.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, trust_score, subscription_tier, status, onboarding_step)
  VALUES (NEW.id, 100, 'FREE', 'active', 'auth_done')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
