-- Corrigir função generate_event_cards_with_values para gerar valores VERDADEIRAMENTE aleatórios
CREATE OR REPLACE FUNCTION public.generate_event_cards_with_values(event_id_param bigint, num_cards_param integer, min_value_param integer, max_value_param integer, goal_amount_param integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    i INTEGER;
    remaining_value INTEGER := goal_amount_param;
    card_value INTEGER;
    min_remaining INTEGER;
    max_possible INTEGER;
    values_array INTEGER[] := '{}';
    total_allocated INTEGER := 0;
    adjustment INTEGER;
BEGIN
    -- Validação matemática básica
    IF min_value_param * num_cards_param > goal_amount_param THEN
        RAISE EXCEPTION 'Configuração impossível: Valor mínimo por card (%) × Número de cards (%) = % é maior que a meta (%)', 
            min_value_param, num_cards_param, min_value_param * num_cards_param, goal_amount_param;
    END IF;
    
    IF max_value_param * num_cards_param < goal_amount_param THEN
        RAISE EXCEPTION 'Configuração impossível: Valor máximo por card (%) × Número de cards (%) = % é menor que a meta (%)', 
            max_value_param, num_cards_param, max_value_param * num_cards_param, goal_amount_param;
    END IF;
    
    -- Delete existing cards for this event
    DELETE FROM public.cards WHERE event_id = event_id_param;
    
    -- Algoritmo aprimorado para distribuição aleatória
    FOR i IN 1..num_cards_param LOOP
        IF i = num_cards_param THEN
            -- Último card recebe o valor restante exato
            card_value := remaining_value;
        ELSE
            -- Cards intermediários: gerar valor aleatório respeitando limites
            min_remaining := (num_cards_param - i) * min_value_param;
            max_possible := LEAST(max_value_param, remaining_value - min_remaining);
            max_possible := GREATEST(max_possible, min_value_param);
            
            -- Gerar valor aleatório VERDADEIRO entre min e max_possible
            card_value := min_value_param + floor(random() * (max_possible - min_value_param + 1))::INTEGER;
            
            -- Garantir que não ultrapasse os limites
            card_value := LEAST(card_value, max_possible);
            card_value := GREATEST(card_value, min_value_param);
        END IF;
        
        -- Armazenar valor no array
        values_array := array_append(values_array, card_value);
        total_allocated := total_allocated + card_value;
        remaining_value := remaining_value - card_value;
        
        -- Verificação de segurança
        IF remaining_value < 0 THEN
            remaining_value := 0;
        END IF;
    END LOOP;
    
    -- Ajuste final se a soma não bater exatamente na meta
    adjustment := goal_amount_param - total_allocated;
    IF adjustment != 0 THEN
        -- Ajustar o último card
        values_array[num_cards_param] := values_array[num_cards_param] + adjustment;
        
        -- Verificar se o ajuste mantém o valor dentro dos limites
        IF values_array[num_cards_param] < min_value_param OR values_array[num_cards_param] > max_value_param THEN
            -- Se o último card ficar fora dos limites, redistribuir o ajuste
            values_array[num_cards_param] := values_array[num_cards_param] - adjustment;
            
            -- Encontrar um card que possa absorver o ajuste
            FOR i IN 1..num_cards_param LOOP
                IF adjustment > 0 AND values_array[i] + adjustment <= max_value_param THEN
                    values_array[i] := values_array[i] + adjustment;
                    EXIT;
                ELSIF adjustment < 0 AND values_array[i] + adjustment >= min_value_param THEN
                    values_array[i] := values_array[i] + adjustment;
                    EXIT;
                END IF;
            END LOOP;
        END IF;
    END IF;
    
    -- Inserir cards com valores finais
    FOR i IN 1..num_cards_param LOOP
        INSERT INTO public.cards (event_id, card_number, status, value)
        VALUES (event_id_param, i, 'available', values_array[i]);
    END LOOP;
    
    -- Log para debug
    RAISE NOTICE 'Cards gerados: % cards, valores entre % e %, meta: %, soma real: %', 
        num_cards_param, min_value_param, max_value_param, goal_amount_param, 
        (SELECT SUM(value) FROM cards WHERE event_id = event_id_param);
END;
$function$;