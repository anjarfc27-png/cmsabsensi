-- 115_push_notif_security_audit_fixes.sql
-- Tujuan: Menerapkan semua perbaikan dari hasil audit sistem push notifikasi (2026-02-20)
-- Temuan yang diperbaiki:
--   1. [KRITIS]   Key sensitif di app_settings → ditangani oleh migration 116 dengan kolom is_sensitive + RLS granular
--   2. [SEDANG]   Tambahkan super_admin ke role check di publish_announcement
--   3. [SEDANG]   Pastikan hanya 1 cron job reminder yang aktif (hapus check_shift_reminders_job jika masih ada)
--   4. [MINOR]    Ubah type panggilan masuk menjadi 'push_incoming_call' agar konsisten
--   5. [INFO]     Tambahkan index untuk memperkuat performa query
--
-- CATATAN: FIX 1 (keamanan app_settings) sepenuhnya dikerjakan di migration 116.
--          ALTER DATABASE tidak tersedia di Supabase managed environment.
--          Solusi: kolom is_sensitive + RLS policy granular.

-- =====================================================================
-- FIX 1 (delegated to 116): update label supabase_url saja di sini
-- =====================================================================
UPDATE public.app_settings
  SET description = 'Base URL proyek Supabase ini. Tidak sensitif.'
  WHERE key = 'supabase_url';

-- =====================================================================
-- FIX 2: Fungsi trigger sudah diperbarui di migration 116 (SECURITY DEFINER
-- membaca service_role_key dari app_settings dengan is_sensitive=true, bypass RLS).
-- Tidak ada perubahan tambahan di sini.
-- =====================================================================

-- =====================================================================
-- FIX 3: Perbaiki publish_announcement agar super_admin juga bisa publish
-- Bug: role check lama tidak menyertakan 'super_admin'
-- =====================================================================
CREATE OR REPLACE FUNCTION public.publish_announcement(
    p_title            TEXT,
    p_content          TEXT,
    p_created_by       UUID,
    p_send_notification BOOLEAN DEFAULT true,
    p_expires_at       TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_announcement_id UUID;
BEGIN
    -- Auth check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;

    -- FIX: Tambahkan 'super_admin' ke daftar role yang boleh publish
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('admin_hr', 'manager', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    -- 1. Insert Announcement
    INSERT INTO public.announcements (title, content, created_by, is_active, created_at, expires_at)
    VALUES (p_title, p_content, p_created_by, true, NOW(), p_expires_at)
    RETURNING id INTO v_announcement_id;

    -- 2. Bulk Insert Notifications untuk semua user aktif (jika diminta)
    IF p_send_notification THEN
        INSERT INTO public.notifications (user_id, title, message, type, read, created_at)
        SELECT
            id,
            p_title,
            p_content,
            'info',
            false,
            NOW()
        FROM public.profiles
        WHERE is_active = true;
    END IF;

    RETURN v_announcement_id;
END;
$$;

-- =====================================================================
-- FIX 4: Pastikan hanya 1 cron job reminder aktif.
-- Hapus 'check_shift_reminders_job' jika masih ada (duplikat dari era lama).
-- Yang aktif seharusnya hanya 'master_reminder_job'.
-- =====================================================================
DO $$
BEGIN
    -- Hapus job lama jika masih ada (aman: tidak error jika tidak ada)
    PERFORM cron.unschedule('check_shift_reminders_job')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check_shift_reminders_job');

    PERFORM cron.unschedule('check_all_reminders_job')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'check_all_reminders_job');
EXCEPTION WHEN OTHERS THEN
    -- Abaikan error jika pg_cron tidak tersedia atau job tidak ditemukan
    RAISE WARNING '[push_notif_fix] Tidak dapat unschedule cron lama: %', SQLERRM;
END $$;

-- Pastikan master_reminder_job terdaftar (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'master_reminder_job') THEN
        PERFORM cron.schedule(
            'master_reminder_job',
            '*/2 * * * *',
            'SELECT process_all_reminders()'
        );
        RAISE NOTICE '[push_notif_fix] master_reminder_job berhasil didaftarkan.';
    ELSE
        RAISE NOTICE '[push_notif_fix] master_reminder_job sudah ada, tidak perlu daftar ulang.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[push_notif_fix] Tidak dapat schedule cron: %', SQLERRM;
END $$;

-- =====================================================================
-- FIX 5: Perbarui trigger panggilan masuk agar menggunakan
-- type 'push_incoming_call' (tersaring dari in-app list, konsisten dengan
-- konvensi push_ prefix yang sudah ada di sistem)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_call_push()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_name TEXT;
BEGIN
    -- Hanya proses jika status 'ringing'
    IF NEW.status = 'ringing' THEN
        -- Ambil nama penelepon
        SELECT full_name INTO v_caller_name FROM public.profiles WHERE id = NEW.caller_id;

        -- FIX: Gunakan type 'push_incoming_call' agar:
        --   1. Tidak muncul di in-app notification list (push_ prefix)
        --   2. Tetap memicu push notifikasi FCM via trigger
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            extra_data
        )
        VALUES (
            NEW.receiver_id,
            '📞 Panggilan Masuk',
            'Telepon dari ' || COALESCE(v_caller_name, 'Seseorang'),
            'push_incoming_call',  -- FIX: was 'system', now uses push_ prefix convention
            jsonb_build_object(
                'call_id',     NEW.id,
                'signaling_id', NEW.signaling_id,
                'type',        'incoming_call'
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger panggilan
DROP TRIGGER IF EXISTS tr_on_new_call_push ON public.calls;
CREATE TRIGGER tr_on_new_call_push
    AFTER INSERT ON public.calls
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_new_call_push();

COMMENT ON FUNCTION public.notify_on_new_call_push
  IS 'Mengirim push notification FCM saat ada panggilan masuk. Menggunakan type push_incoming_call (tidak tampil di in-app list).';

-- =====================================================================
-- INDEX TAMBAHAN: Meningkatkan performa query filter push_ types
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_type_prefix
  ON public.notifications (type, user_id, created_at DESC)
  WHERE type NOT LIKE 'push_%';

-- =====================================================================
-- AUDIT COMMENT
-- =====================================================================
COMMENT ON FUNCTION public.trigger_push_notification_sync
  IS 'SECURITY DEFINER: Mengirim push notification via Edge Function saat INSERT ke notifications. '
     'Membaca service_role_key dari app_settings (protected by is_sensitive=true + RLS di migration 116). '
     'Trigger ini dapat membacanya karena bypass RLS sebagai function owner.';
