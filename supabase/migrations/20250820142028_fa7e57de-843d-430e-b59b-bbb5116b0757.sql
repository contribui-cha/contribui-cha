-- Add check if user already revealed a card to prevent multiple reveals
CREATE OR REPLACE FUNCTION check_user_card_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has a revealed card for this event
  IF NEW.status = 'revealed' AND (
    SELECT COUNT(*) 
    FROM cards 
    WHERE event_id = NEW.event_id 
    AND guest_email = NEW.guest_email 
    AND status = 'revealed'
    AND id != NEW.id
  ) > 0 THEN
    RAISE EXCEPTION 'Usuário já revelou um card para este evento';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to enforce one card per user
CREATE TRIGGER enforce_one_card_per_user
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION check_user_card_limit();