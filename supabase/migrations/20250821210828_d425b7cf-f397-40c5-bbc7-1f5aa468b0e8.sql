-- Update the card that should be revealed but is still reserved
UPDATE cards 
SET status = 'revealed', revealed_at = now() 
WHERE id = 184 AND status = 'reserved';