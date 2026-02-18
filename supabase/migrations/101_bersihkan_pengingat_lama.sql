-- 104_cleanup_old_reminders.sql
-- Goal: Remove old attendance reminders that clutter the notification bell.
-- The user requested to "hapus yang lama" (delete the old ones) because they appeared in the lonceng (bell).

-- 1. Delete existing attendance reminders from the notifications table
-- This cleans up the history so the user only sees relevant non-reminder notifications.
DELETE FROM notifications 
WHERE type IN ('reminder_clock_in', 'reminder_clock_out');

-- 2. Ensure any other legacy reminders (non-push prefixed) are also removed if they exist
DELETE FROM notifications 
WHERE (type = 'clock_in_reminder' OR type = 'clock_out_reminder');

-- Note: We do NOT delete 'push_reminder_...' because those are the new automated ones 
-- and they already don't show up in the lonceng by design.

-- Add index to improve notification filtering performance if not already exists
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_id, type);
