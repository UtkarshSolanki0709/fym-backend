CREATE OR REPLACE FUNCTION increment_swipe_count(p_user_id UUID, p_delta INT DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET swipe_count_today = COALESCE(swipe_count_today, 0) + p_delta
  WHERE id = p_user_id;
END;
$$;
