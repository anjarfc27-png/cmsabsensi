-- 113_fix_reminders_and_push_system.sql
-- Goal: Fix reminders not working by ensuring pg_cron is active and the push bridge is correctly configured.

-- 1. Ensure extensions are available
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Update the Push Notification Bridge to be more robust
-- We use a function that tries to get the URL dynamically if possible, or falls back to a placeholder.
-- IMPORTANT: User needs to ensure app.settings.service_role_key and app.settings.supabase_url are set
-- or manually update the URL below.

CREATE OR REPLACE FUNCTION public.trigger_push_notification_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_full_url TEXT;
BEGIN
  -- Get configuration from settings
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  -- Fallback if not set (You should set these via: ALTER DATABASE postgres SET "app.settings.supabase_url" = '...';)
  -- Or we use the known project URL if provided.
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    -- Try to extract project ID from current environment or use a default if known
    -- For now, we'll keep the existing one but allow it to be overridden
    v_supabase_url := 'https://hqyswizxciwkkvqpbzbp.supabase.co'; 
  END IF;

  v_full_url := v_supabase_url || '/functions/v1/send-push-notification';

  IF v_service_key IS NULL OR v_service_key = '' THEN
    -- If no key, we can't send. Log it.
    RAISE WARNING 'Push notification skipped: app.settings.service_role_key is not set.';
    RETURN NEW;
  END IF;

  -- Call Edge Function
  PERFORM
    net.http_post(
      url := v_full_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'title', NEW.title,
        'body', NEW.message,
        'data', jsonb_build_object(
            'type', NEW.type,
            'link', NEW.link,
            'notification_id', NEW.id,
            'extra_data', COALESCE(NEW.extra_data, '{}'::jsonb)
        )
      )
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger
DROP TRIGGER IF EXISTS tr_send_push_on_notification ON public.notifications;
CREATE TRIGGER tr_send_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification_sync();

-- 3. Ensure the Reminder Function is optimized and scheduled correctly
CREATE OR REPLACE FUNCTION process_all_reminders()
RETURNS void AS $$
DECLARE
    v_now_time TIME;
    v_today DATE;
    v_now_timestamp TIMESTAMPTZ;
    v_buffer_minutes INTERVAL := '15 minutes'; -- Increased to 15m for better hit rate
    v_record RECORD;
BEGIN
    -- TIMEZONE: Asia/Jakarta
    v_now_time := (now() AT TIME ZONE 'Asia/Jakarta')::TIME;
    v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_now_timestamp := now() AT TIME ZONE 'Asia/Jakarta';

    -- A. PENGINGAT MASUK (Clock In)
    FOR v_record IN 
        SELECT 
            es.user_id, 
            p.full_name,
            s.name as shift_name,
            s.start_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        LEFT JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE 
            es.date = v_today 
            AND es.is_day_off = false 
            AND a.clock_in IS NULL 
            AND s.start_time > v_now_time 
            AND s.start_time <= (v_now_time + v_buffer_minutes)
            AND NOT EXISTS ( 
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND (n.type = 'push_reminder_clock_in' OR n.type = 'reminder_clock_in')
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_record.user_id,
            'Waktunya Absen Masuk! ⏰',
            'Halo ' || split_part(v_record.full_name, ' ', 1) || ', jadwal ' || v_record.shift_name || ' Anda akan mulai pukul ' || to_char(v_record.start_time, 'HH24:MI') || '.',
            'push_reminder_clock_in',
            '/attendance'
        );
    END LOOP;

    -- B. PENGINGAT PULANG (Clock Out)
    FOR v_record IN 
        SELECT 
            es.user_id, 
            p.full_name,
            s.name as shift_name,
            s.end_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE 
            es.date = v_today 
            AND es.is_day_off = false 
            AND a.clock_in IS NOT NULL 
            AND a.clock_out IS NULL 
            AND s.end_time > v_now_time 
            AND s.end_time <= (v_now_time + v_buffer_minutes)
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.user_id = es.user_id 
                AND (n.type = 'push_reminder_clock_out' OR n.type = 'reminder_clock_out')
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_record.user_id,
            'Jangan Lupa Absen Pulang! 🏠',
            'Kerja bagus hari ini! Jadwal Anda berakhir pukul ' || to_char(v_record.end_time, 'HH24:MI') || '. Silakan Check Out.',
            'push_reminder_clock_out',
            '/attendance'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-schedule Cron Job
SELECT cron.unschedule('master_reminder_job') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'master_reminder_job');
SELECT cron.schedule(
    'master_reminder_job',
    '*/2 * * * *', 
    'SELECT process_all_reminders()'
);
