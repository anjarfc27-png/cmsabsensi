-- 1. Aktifkan ekstensi pg_net (untuk kirim sinyal HTTP dari database)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Fungsi Pemicu Push Notification
CREATE OR REPLACE FUNCTION public.trigger_push_notification_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_service_role_key TEXT; -- Kita akan ambil dari rahasia sistem
BEGIN
  -- MEMANGGIL EDGE FUNCTION 'send-push-notification'
  -- Kita kirim data notifikasi ke fungsi push yang sudah kita buat sebelumnya
  PERFORM
    net.http_post(
      url := 'https://hqyswizxciwkkvqpbzbp.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'title', NEW.title,
        'body', NEW.message,
        'data', jsonb_build_object(
          'type', NEW.type,
          'link', NEW.link,
          'notification_id', NEW.id
        )
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Pasang Trigger di Tabel Notifications
-- Setiap kali ada data masuk ke tabel notifications, langsung panggil fungsi di atas
DROP TRIGGER IF EXISTS tr_send_push_on_notification ON public.notifications;
CREATE TRIGGER tr_send_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification_sync();

-- Tambahkan komentar
COMMENT ON FUNCTION public.trigger_push_notification_sync() IS 'Mengirim push notification otomatis via Edge Function saat ada notifikasi masuk ke database.';
