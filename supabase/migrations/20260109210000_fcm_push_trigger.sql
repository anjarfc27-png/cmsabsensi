-- Migration: Auto-send FCM push notifications when new notification is inserted
-- Created: 2026-01-09

-- Enable HTTP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http;

-- Function to send push notification via Edge Function
CREATE OR REPLACE FUNCTION send_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get Supabase URL and service role key from environment
  -- Note: In production, these should be set via Supabase dashboard
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification';
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);

  -- Call Edge Function asynchronously using pg_net (if available)
  -- For now, we'll use http extension
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'userId', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'data', jsonb_build_object(
        'notificationId', NEW.id,
        'type', NEW.type,
        'link', NEW.link
      )
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_insert_send_push ON notifications;

CREATE TRIGGER on_notification_insert_send_push
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_fcm_push_notification();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION send_fcm_push_notification() IS 'Automatically sends FCM push notification when a new notification is inserted';
