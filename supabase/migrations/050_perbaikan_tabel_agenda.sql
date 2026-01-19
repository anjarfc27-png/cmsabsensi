-- Create agendas table if not exists
CREATE TABLE IF NOT EXISTS public.agendas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    meeting_link TEXT,
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true
);

-- Create agenda_participants table if not exists
CREATE TABLE IF NOT EXISTS public.agenda_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    agenda_id UUID REFERENCES public.agendas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' -- pending, accepted, declined
);

-- Enable RLS
ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_participants ENABLE ROW LEVEL SECURITY;

-- Agendas Policies
DROP POLICY IF EXISTS "View agendas" ON agendas;
CREATE POLICY "View agendas" ON agendas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage agendas" ON agendas;
CREATE POLICY "Manage agendas" ON agendas FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin_hr', 'manager')
  )
);

-- Agenda Participants Policies
DROP POLICY IF EXISTS "View agenda participants" ON agenda_participants;
CREATE POLICY "View agenda participants" ON agenda_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Manage agenda participants" ON agenda_participants;
CREATE POLICY "Manage agenda participants" ON agenda_participants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin_hr', 'manager')
  )
);

-- Grant Access
GRANT ALL ON public.agendas TO authenticated;
GRANT ALL ON public.agenda_participants TO authenticated;
