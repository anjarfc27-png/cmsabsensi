-- 107_fitur_panggilan_suara.sql
-- Goal: Menambahkan infrastruktur untuk fitur VoIP (Voice Call) dalam aplikasi

-- 1. Tabel untuk melacak sesi panggilan
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'rejected')),
    type TEXT NOT NULL DEFAULT 'voice' CHECK (type IN ('voice', 'video')),
    signaling_id TEXT NOT NULL, -- ID unik untuk channel WebRTC
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Aktifkan RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan RLS (Hanya pihak terlibat yang bisa melihat)
CREATE POLICY "Users can view their own calls" 
ON public.calls FOR SELECT 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Penelepon bisa membuat record
CREATE POLICY "Users can initiate calls" 
ON public.calls FOR INSERT 
WITH CHECK (auth.uid() = caller_id);

-- Kedua pihak bisa update status panggilan (misal: mengakhiri atau menerima)
CREATE POLICY "Users can update their own calls" 
ON public.calls FOR UPDATE 
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- 4. Indeks untuk performa
CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_receiver ON public.calls(receiver_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);

-- 5. Tambah notifikasi otomatis untuk panggilan tak terjawab (opsional)
-- Ini berguna jika penerima tidak sedang membuka app
CREATE OR REPLACE FUNCTION public.notify_on_missed_call()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'missed' AND OLD.status = 'ringing' THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            NEW.receiver_id,
            '📞 Panggilan Tak Terjawab',
            'Anda memiliki panggilan suara tak terjawab dari ' || (SELECT full_name FROM profiles WHERE id = NEW.caller_id) || '.',
            'system',
            '/panggilan'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_on_missed_call
    AFTER UPDATE ON public.calls
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_missed_call();

COMMENT ON TABLE public.calls IS 'Menyimpan riwayat dan status sesi panggilan WebRTC antar user.';
