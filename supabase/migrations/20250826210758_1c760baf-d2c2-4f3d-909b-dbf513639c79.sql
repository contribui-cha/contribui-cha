-- Add RLS policy for event deletion
CREATE POLICY "Users can delete their own events" 
ON public.events 
FOR DELETE 
USING (auth.uid() = host_id);

-- Create Edge Function for secure account deletion
-- This will be handled via Edge Function to ensure proper cascade deletion