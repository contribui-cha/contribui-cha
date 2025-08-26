-- Corrigir a função verify_unlock_code_and_reveal para tratar cards reservados corretamente
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
  -- Validar e limpar email
  clean_email := lower(trim(_email));
  IF clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' THEN
    RETURN QUERY SELECT false, 'Formato de email inválido', 0;
    RETURN;
  END IF;

  -- Obter detalhes do card
  SELECT c.id, c.status, c.unlock_code, c.value, c.guest_email, c.reserved_until
  INTO card_id_val, card_status_val, stored_code, card_value_val, existing_email, reserved_until_val
  FROM cards c
  WHERE c.event_id = _event_id AND c.card_number = _card_number;
  
  -- Verificar se o card existe
  IF card_id_val IS NULL THEN
    RETURN QUERY SELECT false, 'Card não encontrado', 0;
    RETURN;
  END IF;

  -- CASO ESPECIAL 1: Card reservado para o mesmo email (sucesso automático)
  IF card_status_val = 'reserved' AND existing_email = clean_email THEN
    -- Verificar se a reserva ainda é válida
    IF reserved_until_val IS NOT NULL AND reserved_until_val > now() THEN
      -- Sucesso automático - card já reservado para este email
      RETURN QUERY SELECT true, 'Card já reservado para você! Você tem 24 horas para completar sua contribuição.', card_value_val;
      RETURN;
    ELSE
      -- Reserva expirou, resetar card para disponível
      UPDATE cards 
      SET status = 'available', guest_email = NULL, reserved_until = NULL, unlock_code = NULL
      WHERE id = card_id_val;
      card_status_val := 'available';
      existing_email := NULL;
      reserved_until_val := NULL;
      stored_code := NULL;
    END IF;
  END IF;

  -- CASO ESPECIAL 2: Card reservado para outro email
  IF card_status_val = 'reserved' AND existing_email != clean_email THEN
    -- Verificar se reserva ainda é válida
    IF reserved_until_val IS NOT NULL AND reserved_until_val > now() THEN
      RETURN QUERY SELECT false, 'Card está reservado por outro usuário', 0;
      RETURN;
    ELSE
      -- Reserva expirou, resetar card para disponível
      UPDATE cards 
      SET status = 'available', guest_email = NULL, reserved_until = NULL, unlock_code = NULL
      WHERE id = card_id_val;
      card_status_val := 'available';
      existing_email := NULL;
      reserved_until_val := NULL;
      stored_code := NULL;
    END IF;
  END IF;

  -- Verificar se card está disponível para desbloqueio
  IF card_status_val != 'available' THEN
    RETURN QUERY SELECT false, 'Card não está disponível para desbloqueio', 0;
    RETURN;
  END IF;

  -- Validar formato do código de desbloqueio (deve ter 6 dígitos)
  IF _unlock_code !~ '^[0-9]{6}$' THEN
    RETURN QUERY SELECT false, 'Código deve ter 6 dígitos', 0;
    RETURN;
  END IF;

  -- Verificar limite de tentativas
  SELECT * INTO rate_limit_check 
  FROM check_unlock_rate_limit(clean_email, _event_id, _card_number);
  
  IF NOT rate_limit_check.allowed THEN
    RETURN QUERY SELECT false, 'Muitas tentativas. Tente novamente mais tarde.', 0;
    RETURN;
  END IF;
  
  -- Incrementar contador de tentativas
  INSERT INTO unlock_code_attempts (email, event_id, card_number, attempts)
  VALUES (clean_email, _event_id, _card_number, 1)
  ON CONFLICT (email, event_id, card_number) 
  DO UPDATE SET 
    attempts = unlock_code_attempts.attempts + 1,
    updated_at = now();
  
  -- Verificar código de desbloqueio
  IF stored_code IS NULL OR stored_code != _unlock_code THEN
    RETURN QUERY SELECT false, 'Código de desbloqueio inválido', 0;
    RETURN;
  END IF;
  
  -- Verificar se o usuário já possui um card revelado para este evento
  IF EXISTS (
    SELECT 1 FROM cards 
    WHERE event_id = _event_id 
    AND guest_email = clean_email 
    AND status = 'revealed'
    AND id != card_id_val
  ) THEN
    RETURN QUERY SELECT false, 'Você já revelou um card para este evento', 0;
    RETURN;
  END IF;
  
  -- Reservar o card por 24 horas
  UPDATE cards 
  SET 
    status = 'reserved',
    guest_email = clean_email,
    guest_name = COALESCE(_guest_name, guest_name),
    reserved_until = now() + INTERVAL '24 hours',
    unlock_code = NULL  -- Limpar código por segurança
  WHERE id = card_id_val;
  
  -- Limpar registro de tentativas em caso de sucesso
  DELETE FROM unlock_code_attempts 
  WHERE email = clean_email AND event_id = _event_id AND card_number = _card_number;
  
  RETURN QUERY SELECT true, 'Card reservado com sucesso! Você tem 24 horas para completar sua contribuição.', card_value_val;
END;
$function$