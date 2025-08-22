-- Fix remaining security warnings

-- Fix function search path issues for existing functions that don't have it set
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, plan)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', new.email), 
    'basic'
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_card_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user already has a revealed card for this event
  IF NEW.status = 'revealed' AND (
    SELECT COUNT(*) 
    FROM cards 
    WHERE event_id = NEW.event_id 
    AND guest_email = NEW.guest_email 
    AND status = 'revealed'
    AND id != NEW.id
  ) > 0 THEN
    RAISE EXCEPTION 'Usuário já revelou um card para este evento';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Configure auth settings for better security
-- Note: These settings require manual configuration in Supabase dashboard
-- The user will need to:
-- 1. Go to Authentication > Settings in Supabase dashboard  
-- 2. Set OTP expiry to 600 seconds (10 minutes) or less
-- 3. Enable "Leaked password protection" under Password settings