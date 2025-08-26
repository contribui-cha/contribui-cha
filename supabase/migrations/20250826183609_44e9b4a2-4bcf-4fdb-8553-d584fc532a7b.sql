-- Security fixes while maintaining public event access

-- 1. Update get_public_event_by_slug to filter sensitive data
CREATE OR REPLACE FUNCTION public.get_public_event_by_slug(_slug text)
 RETURNS TABLE(id bigint, name text, description text, date date, goal_amount integer, theme_color text, num_cards integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Only return public-safe fields, excluding host_id and other sensitive data
  SELECT e.id, e.name, e.description, e.date, e.goal_amount, e.theme_color, e.num_cards
  FROM events e
  WHERE e.slug = _slug;
$function$;

-- 2. Fix Cards RLS policies for better security
DROP POLICY IF EXISTS "Guests can reserve available cards" ON public.cards;
CREATE POLICY "Guests can reserve available cards" 
ON public.cards 
FOR UPDATE 
USING (
  status = 'available' AND 
  EXISTS (SELECT 1 FROM events WHERE events.id = cards.event_id)
)
WITH CHECK (
  status IN ('available', 'reserved') AND
  (guest_email IS NULL OR guest_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$') AND
  -- Ensure user can only reserve one card per event
  NOT EXISTS (
    SELECT 1 FROM cards other_cards 
    WHERE other_cards.event_id = cards.event_id 
    AND other_cards.guest_email = cards.guest_email 
    AND other_cards.status IN ('reserved', 'revealed')
    AND other_cards.id != cards.id
  )
);

-- 3. Enhanced unlock code validation function with better security
CREATE OR REPLACE FUNCTION public.verify_unlock_code_and_reveal(_email text, _event_id bigint, _card_number integer, _unlock_code text, _guest_name text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text, card_value integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stored_code text;
  card_id_val bigint;
  card_status_val text;
  card_value_val integer;
  existing_email text;
  reserved_until_val timestamp with time zone;
  rate_limit_check record;
  clean_email text;
BEGIN
  -- Validate and sanitize email
  clean_email := lower(trim(_email));
  IF clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
    RETURN QUERY SELECT false, 'Invalid email format', 0;
    RETURN;
  END IF;

  -- Validate unlock code format (must be 6 digits)
  IF _unlock_code !~ '^[0-9]{6}$' THEN
    RETURN QUERY SELECT false, 'Invalid unlock code format', 0;
    RETURN;
  END IF;

  -- Check rate limits first
  SELECT * INTO rate_limit_check 
  FROM check_unlock_rate_limit(clean_email, _event_id, _card_number);
  
  IF NOT rate_limit_check.allowed THEN
    RETURN QUERY SELECT false, 'Too many attempts. Please try again later.', 0;
    RETURN;
  END IF;
  
  -- Get card details
  SELECT c.id, c.status, c.unlock_code, c.value, c.guest_email, c.reserved_until
  INTO card_id_val, card_status_val, stored_code, card_value_val, existing_email, reserved_until_val
  FROM cards c
  WHERE c.event_id = _event_id AND c.card_number = _card_number;
  
  -- Increment attempt counter
  INSERT INTO unlock_code_attempts (email, event_id, card_number, attempts)
  VALUES (clean_email, _event_id, _card_number, 1)
  ON CONFLICT (email, event_id, card_number) 
  DO UPDATE SET 
    attempts = unlock_code_attempts.attempts + 1,
    updated_at = now();
  
  -- Check if card exists
  IF card_id_val IS NULL THEN
    RETURN QUERY SELECT false, 'Card not found', 0;
    RETURN;
  END IF;
  
  -- Check if card is available or reserved by this user
  IF card_status_val = 'available' THEN
    -- Card is available, proceed with unlock
    NULL;
  ELSIF card_status_val = 'reserved' THEN
    -- Check if reserved by this email and still within reservation period
    IF existing_email != clean_email THEN
      IF reserved_until_val IS NOT NULL AND reserved_until_val > now() THEN
        RETURN QUERY SELECT false, 'Card is reserved by another user', 0;
        RETURN;
      ELSE
        -- Reservation expired, reset card to available
        UPDATE cards 
        SET status = 'available', guest_email = NULL, reserved_until = NULL
        WHERE id = card_id_val;
      END IF;
    ELSE
      -- Same email, check if reservation is still valid
      IF reserved_until_val IS NOT NULL AND reserved_until_val <= now() THEN
        -- Reservation expired, reset card
        UPDATE cards 
        SET status = 'available', guest_email = NULL, reserved_until = NULL
        WHERE id = card_id_val;
        RETURN QUERY SELECT false, 'Your reservation has expired', 0;
        RETURN;
      END IF;
    END IF;
  ELSE
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
    AND guest_email = clean_email 
    AND status = 'revealed'
    AND id != card_id_val
  ) THEN
    RETURN QUERY SELECT false, 'You have already revealed a card for this event', 0;
    RETURN;
  END IF;
  
  -- Reserve the card for 24 hours (don't reveal yet)
  UPDATE cards 
  SET 
    status = 'reserved',
    guest_email = clean_email,
    guest_name = COALESCE(_guest_name, guest_name),
    reserved_until = now() + INTERVAL '24 hours',
    unlock_code = NULL  -- Clear the unlock code for security
  WHERE id = card_id_val;
  
  -- Clear attempt record on success
  DELETE FROM unlock_code_attempts 
  WHERE email = clean_email AND event_id = _event_id AND card_number = _card_number;
  
  RETURN QUERY SELECT true, 'Card reserved successfully! You have 24 hours to complete your contribution.', card_value_val;
END;
$function$;

-- 4. Enhanced rate limiting function with progressive delays
CREATE OR REPLACE FUNCTION public.check_unlock_rate_limit(_email text, _event_id bigint, _card_number integer)
 RETURNS TABLE(allowed boolean, attempts_remaining integer, locked_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  max_attempts integer := 5;
  base_lockout_duration interval := '5 minutes';
  current_attempts integer := 0;
  current_locked_until timestamp with time zone;
  clean_email text;
  lockout_multiplier integer := 1;
BEGIN
  -- Sanitize email
  clean_email := lower(trim(_email));
  
  -- Get current attempt record
  SELECT attempts, locked_until 
  INTO current_attempts, current_locked_until
  FROM unlock_code_attempts 
  WHERE email = clean_email AND event_id = _event_id AND card_number = _card_number;
  
  -- If no record exists, create one
  IF current_attempts IS NULL THEN
    INSERT INTO unlock_code_attempts (email, event_id, card_number, attempts)
    VALUES (clean_email, _event_id, _card_number, 0);
    current_attempts := 0;
  END IF;
  
  -- Check if currently locked
  IF current_locked_until IS NOT NULL AND current_locked_until > now() THEN
    RETURN QUERY SELECT false, 0, current_locked_until;
    RETURN;
  END IF;
  
  -- Progressive lockout: increase duration with each violation
  lockout_multiplier := GREATEST(1, current_attempts - max_attempts + 1);
  
  -- Check if max attempts exceeded
  IF current_attempts >= max_attempts THEN
    -- Lock the user with progressive duration
    UPDATE unlock_code_attempts 
    SET locked_until = now() + (base_lockout_duration * lockout_multiplier),
        updated_at = now()
    WHERE email = clean_email AND event_id = _event_id AND card_number = _card_number;
    
    RETURN QUERY SELECT false, 0, (now() + (base_lockout_duration * lockout_multiplier));
    RETURN;
  END IF;
  
  -- Allow attempt
  RETURN QUERY SELECT true, (max_attempts - current_attempts - 1), null::timestamp with time zone;
END;
$function$;

-- 5. Add function to clean expired reservations regularly
CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE cards 
  SET status = 'available', guest_email = NULL, reserved_until = NULL, guest_name = NULL
  WHERE status = 'reserved' AND reserved_until IS NOT NULL AND reserved_until <= now();
  
  -- Also clean old unlock attempt records (older than 7 days)
  DELETE FROM unlock_code_attempts 
  WHERE updated_at < now() - INTERVAL '7 days';
$function$;