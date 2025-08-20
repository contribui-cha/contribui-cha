-- Drop the existing constraint
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_status_check;

-- Add the new constraint allowing 'revealed' instead of 'paid'
ALTER TABLE public.cards ADD CONSTRAINT cards_status_check 
CHECK (status IN ('available', 'reserved', 'revealed'));

-- Update existing cards to 'revealed' where payment is completed
UPDATE public.cards 
SET status = 'revealed', revealed_at = now()
WHERE id IN (
  SELECT c.id 
  FROM cards c
  JOIN payments p ON c.id = p.card_id
  WHERE p.status = 'completed' AND c.status != 'revealed'
);