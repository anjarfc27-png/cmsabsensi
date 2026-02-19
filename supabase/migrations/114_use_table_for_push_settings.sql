-- 114_use_table_for_push_settings.sql
-- Goal: Fix permission denied error by using app_settings table instead of database GUC variables.

-- 1. Ensure the trigger function pulls keys from the table
CREATE OR REPLACE FUNCTION public.trigger_push_notification_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_full_url TEXT;
BEGIN
  -- Get configuration from app_settings table (much safer than DB settings)
  SELECT (value->>0)::text INTO v_supabase_url FROM public.app_settings WHERE key = 'supabase_url';
  SELECT (value->>0)::text INTO v_service_key FROM public.app_settings WHERE key = 'service_role_key';
  
  -- Fallbacks
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := 'https://hqyswizxciwkkvqpbzbp.supabase.co'; 
  END IF;

  v_full_url := v_supabase_url || '/functions/v1/send-push-notification';

  IF v_service_key IS NULL OR v_service_key = '' THEN
    -- Log warning if key is missing
    RAISE WARNING 'Push notification skipped: service_role_key not found in app_settings table.';
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

-- 2. Add some descriptions to app_settings if they don't exist
INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('service_role_key', '"replace_this_with_your_actual_key"'::jsonb, 'Service Role Key for Edge Function authentication'),
  ('supabase_url', '"https://hqyswizxciwkkvqpbzbp.supabase.co"'::jsonb, 'Base URL of this Supabase project')
ON CONFLICT (key) DO NOTHING;

-- 3. Re-apply trigger to make sure it's using the latest version
DROP TRIGGER IF EXISTS tr_send_push_on_notification ON public.notifications;
CREATE TRIGGER tr_send_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification_sync();
