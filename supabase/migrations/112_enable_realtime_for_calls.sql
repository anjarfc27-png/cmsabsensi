-- 112_enable_realtime_for_calls.sql
-- Goal: Mengaktifkan Supabase Realtime agar aplikasi bisa mendeteksi panggilan masuk secara instan saat aplikasi terbuka.

-- Tambahkan tabel calls ke publikasi realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- Pastikan tabel profiles juga ada di publikasi untuk profil penelepon
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END $$;
