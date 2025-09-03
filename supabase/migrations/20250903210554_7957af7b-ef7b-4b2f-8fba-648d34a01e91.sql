-- Add guest message and name columns to payments table
ALTER TABLE public.payments 
ADD COLUMN guest_message TEXT,
ADD COLUMN guest_name TEXT;