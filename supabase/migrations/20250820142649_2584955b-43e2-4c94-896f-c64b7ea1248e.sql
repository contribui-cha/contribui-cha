-- Create guests table for managing event invitees
CREATE TABLE public.guests (
  id bigint NOT NULL DEFAULT nextval('guests_id_seq'::regclass) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  event_id bigint REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create sequence for guests
CREATE SEQUENCE public.guests_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Enable Row Level Security
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- Create policies for guests table
CREATE POLICY "Users can view their own guests" 
ON public.guests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own guests" 
ON public.guests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own guests" 
ON public.guests 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own guests" 
ON public.guests 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_guests_updated_at
BEFORE UPDATE ON public.guests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();