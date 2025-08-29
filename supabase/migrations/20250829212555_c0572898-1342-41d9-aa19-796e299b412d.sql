-- Add transaction fee fields to payments table
ALTER TABLE public.payments 
ADD COLUMN transaction_fee INTEGER DEFAULT 199,
ADD COLUMN total_charged INTEGER;

-- Update existing records to have correct values
UPDATE public.payments 
SET 
  transaction_fee = 199,
  total_charged = amount + 199
WHERE transaction_fee IS NULL;

-- Make transaction_fee not null after updating existing records
ALTER TABLE public.payments 
ALTER COLUMN transaction_fee SET NOT NULL;