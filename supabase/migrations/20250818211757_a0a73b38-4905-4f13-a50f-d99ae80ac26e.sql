-- Fix security warning: Function Search Path Mutable
-- Update the generate_event_cards function with proper search_path
CREATE OR REPLACE FUNCTION public.generate_event_cards(event_id_param BIGINT, num_cards_param INTEGER)
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