-- Fix ambiguous column reference in verify_unlock_code_and_reveal function
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
BEGIN
  -- Check rate limits first
  SELECT * INTO rate_limit_check 
  FROM check_unlock_rate_limit(_email, _event_id, _card_number);
  
  IF NOT rate_limit_check.allowed THEN
    RETURN QUERY SELECT false, 'Too many attempts. Account locked.', 0;
    RETURN;
  END IF;
  
  -- Get card details
  SELECT c.id, c.status, c.unlock_code, c.value, c.guest_email, c.reserved_until
  INTO card_id_val, card_status_val, stored_code, card_value_val, existing_email, reserved_until_val
  FROM cards c
  WHERE c.event_id = _event_id AND c.card_number = _card_number;
  
  -- Increment attempt counter
  INSERT INTO unlock_code_attempts (email, event_id, card_number, attempts)
  VALUES (_email, _event_id, _card_number, 1)
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
    IF existing_email != _email THEN
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
    AND guest_email = _email 
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
    guest_email = _email,
    guest_name = COALESCE(_guest_name, guest_name),
    reserved_until = now() + INTERVAL '24 hours',
    unlock_code = NULL  -- Clear the unlock code for security
  WHERE id = card_id_val;
  
  -- Clear attempt record on success
  DELETE FROM unlock_code_attempts 
  WHERE email = _email AND event_id = _event_id AND card_number = _card_number;
  
  RETURN QUERY SELECT true, 'Card reserved successfully! You have 24 hours to complete your contribution.', card_value_val;
END;
$function$;