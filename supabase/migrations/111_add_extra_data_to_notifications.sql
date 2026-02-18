-- 111_add_extra_data_to_notifications.sql
-- Goal: Menambahkan kolom extra_data ke tabel notifications untuk menampung metadata tambahan (seperti call_id)

ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.notifications.extra_data IS 'Metadata tambahan untuk notifikasi dalam format JSONB (misal: ID panggilan, tipe data khusus).';
