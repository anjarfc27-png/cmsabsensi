-- Add Foreign Key to allow joining with profiles
ALTER TABLE public.agenda_participants
ADD CONSTRAINT fk_agenda_participants_profiles
FOREIGN KEY (user_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;
