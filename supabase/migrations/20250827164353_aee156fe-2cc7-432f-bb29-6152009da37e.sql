-- Primeiro, regenerar todos os cards do evento 17 com valores corretos
-- Meta: R$ 3500,00 (350000 centavos)
-- Min: R$ 40,00 (4000 centavos) 
-- Max: R$ 100,00 (10000 centavos)
-- 80 cards

SELECT generate_event_cards_with_values(17, 80, 4000, 10000, 350000);