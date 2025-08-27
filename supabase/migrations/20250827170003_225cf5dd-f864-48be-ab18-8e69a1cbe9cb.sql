-- Add foreign key constraints with CASCADE DELETE for data cleanup
ALTER TABLE public.cards 
ADD CONSTRAINT cards_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.payments 
ADD CONSTRAINT payments_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.payments 
ADD CONSTRAINT payments_card_id_fkey 
FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;

ALTER TABLE public.messages 
ADD CONSTRAINT messages_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.guests 
ADD CONSTRAINT guests_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;