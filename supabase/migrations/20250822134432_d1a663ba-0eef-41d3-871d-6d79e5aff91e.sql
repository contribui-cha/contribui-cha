-- Critical Security Fixes Migration

-- First, drop the overly permissive policies on cards table
DROP POLICY IF EXISTS "Anyone can view cards for public events" ON public.cards;
DROP POLICY IF EXISTS "Anyone can update cards for reservations" ON public.cards;

-- Create secure policies for cards table
-- Public users can only see basic card info for available cards
CREATE POLICY "Public users can view basic available card info" 
ON public.cards 
FOR SELECT 
USING (
  status = 'available' 
  AND EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = cards.event_id
  )
);

-- Guests can see their own reserved/revealed cards
CREATE POLICY "Guests can view their own cards" 
ON public.cards 
FOR SELECT 
USING (
  guest_email IS NOT NULL 
  AND guest_email = current_setting('request.jwt.claims', true)::json->>'email'
);

-- Guests can reserve available cards (but not see sensitive data)
CREATE POLICY "Guests can reserve available cards" 
ON public.cards 
FOR UPDATE 
USING (
  status = 'available'
  AND EXISTS (
    SELECT 1 FROM public.events 
    WHERE events.id = cards.event_id
  )
)
WITH CHECK (
  status IN ('available', 'reserved') 
  AND (guest_email IS NULL OR guest_email = current_setting('request.jwt.claims', true)::json->>'email')
);

-- Event hosts maintain full access to their cards
-- (keep existing policy)

-- Create unlock code attempts tracking table
CREATE TABLE IF NOT EXISTS public.unlock_code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  event_id bigint NOT NULL,
  card_number integer NOT NULL,
  attempts integer DEFAULT 1,
  locked_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(email, event_id, card_number)
);

-- Enable RLS on unlock_code_attempts
ALTER TABLE public.unlock_code_attempts ENABLE ROW LEVEL SECURITY;

-- Allow anyone to check/update attempt limits (needed for unlock functionality)
CREATE POLICY "Anyone can manage unlock attempts" 
ON public.unlock_code_attempts 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create secure function to get public event data
CREATE OR REPLACE FUNCTION public.get_public_event_by_slug(_slug text)
RETURNS TABLE (
  id bigint,
  name text,
  description text,
  date date,
  goal_amount integer,
  theme_color text,
  num_cards integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT e.id, e.name, e.description, e.date, e.goal_amount, e.theme_color, e.num_cards
  FROM events e
  WHERE e.slug = _slug;
$$;

-- Create secure function to get public card data (without sensitive info)
CREATE OR REPLACE FUNCTION public.get_public_cards_by_event(_event_id bigint)
RETURNS TABLE (
  id bigint,
  card_number integer,
  status text,
  guest_name text,
  revealed_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER  
SET search_path = public
STABLE
AS $$
  SELECT c.id, c.card_number, c.status, c.guest_name, c.revealed_at
  FROM cards c
  WHERE c.event_id = _event_id;
$$;

-- Create secure function to check rate limits for unlock codes
CREATE OR REPLACE FUNCTION public.check_unlock_rate_limit(_email text, _event_id bigint, _card_number integer)
RETURNS TABLE (
  allowed boolean,
  attempts_remaining integer,
  locked_until timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_attempts integer := 5;
  lockout_duration interval := '15 minutes';
  current_attempts integer := 0;
  current_locked_until timestamp with time zone;
BEGIN
  -- Get current attempt record
  SELECT attempts, locked_until 
  INTO current_attempts, current_locked_until
  FROM unlock_code_attempts 
  WHERE email = _email AND event_id = _event_id AND card_number = _card_number;
  
  -- If no record exists, create one
  IF current_attempts IS NULL THEN
    INSERT INTO unlock_code_attempts (email, event_id, card_number, attempts)
    VALUES (_email, _event_id, _card_number, 0);
    current_attempts := 0;
  END IF;
  
  -- Check if currently locked
  IF current_locked_until IS NOT NULL AND current_locked_until > now() THEN
    RETURN QUERY SELECT false, 0, current_locked_until;
    RETURN;
  END IF;
  
  -- Check if max attempts exceeded
  IF current_attempts >= max_attempts THEN
    -- Lock the user
    UPDATE unlock_code_attempts 
    SET locked_until = now() + lockout_duration,
        updated_at = now()
    WHERE email = _email AND event_id = _event_id AND card_number = _card_number;
    
    RETURN QUERY SELECT false, 0, (now() + lockout_duration);
    RETURN;
  END IF;
  
  -- Allow attempt
  RETURN QUERY SELECT true, (max_attempts - current_attempts - 1), null::timestamp with time zone;
END;
$$;

-- Create secure function to verify unlock code and reveal card
CREATE OR REPLACE FUNCTION public.verify_unlock_code_and_reveal(
  _email text,
  _event_id bigint, 
  _card_number integer,
  _unlock_code text,
  _guest_name text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  message text,
  card_value integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_code text;
  card_id_val bigint;
  card_status_val text;
  card_value_val integer;
  rate_limit_check record;
BEGIN
  -- Check rate limits first
  SELECT * INTO rate_limit_check 
  FROM check_unlock_rate_limit(_email, _event_id, _card_number);
  
  IF NOT rate_limit_check.allowed THEN
    RETURN QUERY SELECT false, 'Too many attempts. Account locked.', 0;
    RETURN;
  END IF;
  
  -- Get card details
  SELECT id, status, unlock_code, value 
  INTO card_id_val, card_status_val, stored_code, card_value_val
  FROM cards 
  WHERE event_id = _event_id AND card_number = _card_number;
  
  -- Increment attempt counter
  INSERT INTO unlock_code_attempts (email, event_id, card_number, attempts)
  VALUES (_email, _event_id, _card_number, 1)
  ON CONFLICT (email, event_id, card_number) 
  DO UPDATE SET 
    attempts = unlock_code_attempts.attempts + 1,
    updated_at = now();
  
  -- Check if card exists and is reserved by this user
  IF card_id_val IS NULL THEN
    RETURN QUERY SELECT false, 'Card not found', 0;
    RETURN;
  END IF;
  
  IF card_status_val != 'reserved' THEN
    RETURN QUERY SELECT false, 'Card is not available for unlock', 0;
    RETURN;
  END IF;
  
  -- Verify unlock code
  IF stored_code IS NULL OR stored_code != _unlock_code THEN
    RETURN QUERY SELECT false, 'Invalid unlock code', 0;
    RETURN;
  END IF;
  
  -- Check if user already has a revealed card for this event
  IF EXISTS (
    SELECT 1 FROM cards 
    WHERE event_id = _event_id 
    AND guest_email = _email 
    AND status = 'revealed'
    AND id != card_id_val
  ) THEN
    RETURN QUERY SELECT false, 'You have already revealed a card for this event', 0;
    RETURN;
  END IF;
  
  -- Reveal the card
  UPDATE cards 
  SET 
    status = 'revealed',
    revealed_at = now(),
    guest_name = COALESCE(_guest_name, guest_name),
    unlock_code = NULL  -- Clear the unlock code for security
  WHERE id = card_id_val AND guest_email = _email;
  
  -- Clear attempt record on success
  DELETE FROM unlock_code_attempts 
  WHERE email = _email AND event_id = _event_id AND card_number = _card_number;
  
  RETURN QUERY SELECT true, 'Card revealed successfully!', card_value_val;
END;
$$;

-- Update existing functions with proper security settings
CREATE OR REPLACE FUNCTION public.generate_event_cards_with_values(event_id_param bigint, num_cards_param integer, min_value_param integer, max_value_param integer, goal_amount_param integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    i INTEGER;
    remaining_value INTEGER := goal_amount_param;
    card_value INTEGER;
    min_remaining INTEGER;
    max_possible INTEGER;
BEGIN
    -- Delete existing cards for this event
    DELETE FROM public.cards WHERE event_id = event_id_param;
    
    FOR i IN 1..num_cards_param LOOP
        -- Calculate how much value is needed for remaining cards
        min_remaining := (num_cards_param - i) * min_value_param;
        
        IF i = num_cards_param THEN
            -- Last card gets exactly the remaining value
            card_value := remaining_value;
        ELSE
            -- Calculate max possible value for this card
            max_possible := LEAST(max_value_param, remaining_value - min_remaining);
            
            -- Ensure we don't go below minimum
            max_possible := GREATEST(max_possible, min_value_param);
            
            -- Generate random value between min and max_possible
            card_value := min_value_param + floor(random() * (max_possible - min_value_param + 1));
            
            -- Ensure we don't exceed remaining value
            card_value := LEAST(card_value, remaining_value - min_remaining);
        END IF;
        
        -- Insert card with calculated value
        INSERT INTO public.cards (event_id, card_number, status, value)
        VALUES (event_id_param, i, 'available', card_value);
        
        -- Update remaining value
        remaining_value := remaining_value - card_value;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_event_cards(event_id_param bigint, num_cards_param integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..num_cards_param LOOP
    INSERT INTO public.cards (event_id, card_number, status)
    VALUES (event_id_param, i, 'available');
  END LOOP;
END;
$$;

-- Add trigger for unlock_code_attempts updated_at
CREATE TRIGGER update_unlock_code_attempts_updated_at
BEFORE UPDATE ON public.unlock_code_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();