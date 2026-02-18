-- 108_fix_duplicate_push_triggers.sql
-- Goal: Fix duplicate push notifications caused by MULTIPLE triggers on notifications table
--
-- ROOT CAUSE:
-- The notifications table has TWO triggers that BOTH send push notifications:
-- 1. on_notification_insert_send_push (migration 040) → calls send_fcm_push_notification()
-- 2. tr_send_push_on_notification (migration 101)    → calls trigger_push_notification_sync()
--
-- Both call the same Edge Function (send-push-notification),
-- so every notification INSERT triggers TWO push notifications to the same user!
--
-- FIX: Keep only ONE trigger (the newer, more reliable one from migration 101).
-- Drop the older trigger from migration 040.

-- Drop the duplicate/older trigger (migration 040)
DROP TRIGGER IF EXISTS on_notification_insert_send_push ON public.notifications;

-- Drop the Database Webhook trigger (manually created from Supabase Dashboard)
-- This was ALSO sending push notifications, causing yet another duplicate!
DROP TRIGGER IF EXISTS "push-on-notif" ON public.notifications;

-- Keep tr_send_push_on_notification from migration 101 as the single source
-- It uses the hardcoded URL which is more reliable than app.settings

-- Mark the old function as deprecated (don't drop in case something references it)
COMMENT ON FUNCTION public.send_fcm_push_notification() 
IS 'DEPRECATED: Trigger removed in migration 108. Push notifications now handled only by trigger_push_notification_sync() (migration 101).';

-- Verify: After this migration, only ONE trigger should exist on notifications table:
-- SELECT tgname, tgfoid::regproc FROM pg_trigger WHERE tgrelid = 'notifications'::regclass AND tgisinternal = false;
-- Expected: only tr_send_push_on_notification
