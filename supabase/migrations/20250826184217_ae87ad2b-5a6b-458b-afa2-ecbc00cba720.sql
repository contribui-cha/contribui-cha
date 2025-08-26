-- Fix ambiguous column reference in check_unlock_rate_limit function
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
  
  -- Get current attempt record - specify table alias to avoid ambiguity
  SELECT uca.attempts, uca.locked_until 
  INTO current_attempts, current_locked_until
  FROM unlock_code_attempts uca
  WHERE uca.email = clean_email AND uca.event_id = _event_id AND uca.card_number = _card_number;
  
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