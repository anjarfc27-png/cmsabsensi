-- 116_secure_app_settings_sensitive_keys.sql
-- Tujuan: Mengamankan tabel app_settings agar key sensitif tidak bisa dibaca
--         oleh user biasa melalui Supabase API/REST.
--
-- ROOT CAUSE: Migration 077 membuat policy "Everyone can read app settings"
-- yang berarti semua user yang login bisa melakukan SELECT ke SEMUA baris
-- termasuk baris 'service_role_key'. Ini berbahaya.
--
-- SOLUSI: 
-- 1. Pisahkan key "sensitif" dari key "publik" dengan kolom 'is_sensitive'
-- 2. Perbarui policy READ agar:
--    - Key non-sensitif → semua user yang login boleh baca (behavior sebelumnya)
--    - Key sensitif     → HANYA admin (tidak ada user biasa yang perlu ini)
-- 3. Trigger push notif tetap bisa membaca key karena SECURITY DEFINER
--    (berjalan sebagai postgres/owner, bypass RLS)

-- =====================================================================
-- STEP 1: Tambah kolom is_sensitive jika belum ada
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_settings' AND column_name = 'is_sensitive'
    ) THEN
        ALTER TABLE public.app_settings ADD COLUMN is_sensitive BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE '[116] Kolom is_sensitive berhasil ditambahkan ke app_settings.';
    ELSE
        RAISE NOTICE '[116] Kolom is_sensitive sudah ada, skip.';
    END IF;
END $$;

-- =====================================================================
-- STEP 2: Tandai key yang sensitif
-- =====================================================================
UPDATE public.app_settings
  SET is_sensitive = true
  WHERE key IN ('service_role_key', 'firebase_service_account', 'smtp_password', 'api_secret');

-- Key berikut TIDAK sensitif (boleh dibaca semua user)
UPDATE public.app_settings
  SET is_sensitive = false
  WHERE key IN ('supabase_url', 'require_face_verification', 'company_name', 'attendance_radius_meters');

-- =====================================================================
-- STEP 3: Perbarui RLS Policy
-- Hapus policy lama yang terlalu permisif, ganti dengan yang granular
-- =====================================================================

-- Hapus policy lama
DROP POLICY IF EXISTS "Everyone can read app settings"        ON public.app_settings;
DROP POLICY IF EXISTS "Only HR Admin can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings"        ON public.app_settings;

-- Policy baru: User biasa hanya bisa baca data NON-sensitif
CREATE POLICY "Authenticated users can read non-sensitive settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (is_sensitive = false);

-- Policy baru: Admin HR & Super Admin bisa baca SEMUA (termasuk yang sensitif)
CREATE POLICY "Admins can read all settings including sensitive"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin_hr')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- Policy baru: Admin HR & Super Admin bisa write semua settings
CREATE POLICY "Admins can write all settings"
  ON public.app_settings
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin_hr')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin_hr')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- =====================================================================
-- STEP 4: Pastikan service_role_key ada di tabel (untuk trigger push)
-- Trigger SECURITY DEFINER dapat membacanya walau user biasa tidak bisa.
-- Nilai ini HARUS diupdate manual oleh admin melalui Supabase Dashboard
-- atau melalui SQL Editor dengan akun admin.
-- =====================================================================
INSERT INTO public.app_settings (key, value, description, is_sensitive)
VALUES (
    'service_role_key',
    '"REPLACE_WITH_YOUR_SERVICE_ROLE_KEY"'::jsonb,
    'Service Role Key untuk otentikasi Edge Function push notifikasi. RAHASIA - hanya admin yang bisa membaca.',
    true
)
ON CONFLICT (key) DO UPDATE
  SET is_sensitive = true,
      description  = EXCLUDED.description;

-- =====================================================================
-- STEP 5: Perbarui fungsi trigger agar kembali membaca dari tabel
-- (dengan aman — SECURITY DEFINER bypass RLS sehingga bisa baca is_sensitive=true)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trigger_push_notification_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
  v_full_url     TEXT;
BEGIN
  -- AMAN: Fungsi ini adalah SECURITY DEFINER, berjalan sebagai postgres (owner).
  -- Walaupun row 'service_role_key' memiliki is_sensitive=true dan user biasa
  -- tidak bisa membacanya via API, fungsi ini bisa membacanya karena bypass RLS.

  -- Ambil URL base (tidak sensitif)
  SELECT (value->>0)::text INTO v_supabase_url
    FROM public.app_settings WHERE key = 'supabase_url';

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://hqyswizxciwkkvqpbzbp.supabase.co';
  END IF;

  v_full_url := v_supabase_url || '/functions/v1/send-push-notification';

  -- Ambil service role key (sensitif, tapi SECURITY DEFINER bisa membacanya)
  SELECT (value->>0)::text INTO v_service_key
    FROM public.app_settings WHERE key = 'service_role_key';

  -- Jangan lanjutkan jika key belum diisi atau masih placeholder
  IF v_service_key IS NULL
     OR v_service_key = ''
     OR v_service_key = 'REPLACE_WITH_YOUR_SERVICE_ROLE_KEY' THEN
    RAISE WARNING '[push_notif] Push notification dilewati: service_role_key di app_settings belum diisi. Update via Supabase Dashboard > Table Editor > app_settings.';
    RETURN NEW;
  END IF;

  -- Kirim ke Edge Function via pg_net (async, tidak memblokir INSERT)
  PERFORM net.http_post(
    url     := v_full_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'userId', NEW.user_id,
      'title',  NEW.title,
      'body',   NEW.message,
      'data',   jsonb_build_object(
          'type',            NEW.type,
          'link',            NEW.link,
          'notification_id', NEW.id,
          'extra_data',      COALESCE(NEW.extra_data, '{}'::jsonb)
      )
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.trigger_push_notification_sync
  IS 'SECURITY DEFINER: Membaca service_role_key dari app_settings (is_sensitive=true). '
     'User biasa tidak bisa membaca baris ini via API karena RLS. '
     'Trigger ini bisa membacanya karena berjalan sebagai owner (postgres).';

-- Re-apply trigger
DROP TRIGGER IF EXISTS tr_send_push_on_notification ON public.notifications;
CREATE TRIGGER tr_send_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification_sync();

-- =====================================================================
-- STEP 6: Refresh PostgREST cache
-- =====================================================================
NOTIFY pgrst, 'reload config';

-- =====================================================================
-- PETUNJUK FINAL UNTUK ADMIN:
-- Setelah migration ini dijalankan, isi service_role_key via:
-- Supabase Dashboard > Table Editor > app_settings > edit baris 'service_role_key'
-- Atau jalankan SQL berikut (ganti isi key):
--
-- UPDATE public.app_settings
--   SET value = '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."'::jsonb
--   WHERE key = 'service_role_key';
--
-- Key ini bisa ditemukan di: Supabase Dashboard > Settings > API > service_role secret
-- =====================================================================
