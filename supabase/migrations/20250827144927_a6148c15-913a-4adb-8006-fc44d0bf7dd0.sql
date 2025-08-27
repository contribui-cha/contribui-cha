-- Regenerar cards do evento 17 com valores aleatórios válidos
DO $$
BEGIN
    -- Deletar cards existentes do evento 17
    DELETE FROM public.cards WHERE event_id = 17;
    
    -- Regenerar cards com valores válidos: 80 cards entre R$ 15,00 e R$ 30,00 para meta de R$ 1500,00
    PERFORM public.generate_event_cards_with_values(17, 80, 1500, 3000, 150000);
    
    RAISE NOTICE 'Cards regenerados para evento 17 com sucesso!';
END $$;