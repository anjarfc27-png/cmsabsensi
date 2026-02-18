-- 107_fix_announcement_double_notification.sql
-- Goal: Fix double notification when publishing announcements
--
-- ROOT CAUSE:
-- When admin publishes an announcement via publish_announcement() RPC:
-- 1. publish_announcement() inserts notifications for ALL active users (migration 064)
-- 2. The INSERT into announcements table ALSO fires trigger tr_on_announcement_created (migration 037)
--    which inserts notifications for ALL active users AGAIN
-- Result: Every user gets 2x notifications = DOUBLE PUSH!
--
-- FIX: Remove the trigger since publish_announcement() already handles notifications.
-- The trigger is redundant.

-- Drop the redundant trigger
DROP TRIGGER IF EXISTS tr_on_announcement_created ON public.announcements;

-- Keep the function but add a comment that it's deprecated
-- (We don't drop the function in case other code references it)
COMMENT ON FUNCTION public.notify_all_users_on_announcement() 
IS 'DEPRECATED: No longer triggered. Notifications are handled by publish_announcement() RPC. Trigger removed in migration 107 to fix double notification bug.';
