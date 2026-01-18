-- 1. DROP Tables (Clean Slate)
DROP TABLE IF EXISTS public.agenda_participants CASCADE;
DROP TABLE IF EXISTS public.agendas CASCADE;

-- 2. Create Agendas Table
CREATE TABLE public.agendas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    meeting_link TEXT,
    created_by UUID, -- Kita lepas Foreign Key dulu biar aman dari error user not found
    is_active BOOLEAN DEFAULT true
);

-- 3. Create Participants Table
CREATE TABLE public.agenda_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    agenda_id UUID REFERENCES public.agendas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Kita lepas Foreign Key auth.users dulu biar fleksibel
    status TEXT DEFAULT 'pending'
);

-- 4. Enable RLS
ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_participants ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Policies (Agar tidak ada blocker permission)
-- Agendas
CREATE POLICY "Enable all for authenticated users" ON agendas
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Participants
CREATE POLICY "Enable all for authenticated users" ON agenda_participants
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Grant Access
GRANT ALL ON public.agendas TO authenticated;
GRANT ALL ON public.agenda_participants TO authenticated;
GRANT ALL ON public.agendas TO service_role;
GRANT ALL ON public.agenda_participants TO service_role;
