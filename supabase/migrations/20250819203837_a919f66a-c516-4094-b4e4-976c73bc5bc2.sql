-- Criar função para gerar valores aleatórios para os cards que somem exatamente a meta
CREATE OR REPLACE FUNCTION public.generate_event_cards_with_values(
    event_id_param bigint, 
    num_cards_param integer,
    min_value_param integer,
    max_value_param integer,
    goal_amount_param integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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