-- Create function to get payment names from cards table
CREATE OR REPLACE FUNCTION public.get_payment_with_names()
RETURNS TABLE(
  id bigint,
  amount integer,
  guest_email text,
  guest_name text,
  created_at timestamp with time zone,
  paid_at timestamp with time zone,
  status text,
  event_id bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.amount,
    p.guest_email,
    COALESCE(p.guest_name, c.guest_name) as guest_name,
    p.created_at,
    p.paid_at,
    p.status,
    p.event_id
  FROM payments p
  LEFT JOIN cards c ON c.id = p.card_id
$function$;