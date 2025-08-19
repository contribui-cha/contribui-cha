-- Fix security vulnerability: Restrict payment updates to authorized systems only
-- Drop the insecure policy that allows anyone to update payments
DROP POLICY IF EXISTS "Anyone can update payments" ON public.payments;

-- Create a new secure policy that only allows service role to update payments
-- This ensures only the backend (Stripe webhooks, checkout functions) can modify payment data
CREATE POLICY "Only system can update payments" ON public.payments
  FOR UPDATE 
  USING (false);

-- Allow event hosts to view payment details but not modify them
-- The existing SELECT policy already handles this correctly