-- DISABLE CLOCK-IN and CLOCK-OUT REMINDERS
-- User request: "pengingat pulang juga dongg" (Disable clock-out reminder too).
-- This migration updates the cron function to remove BOTH clock-in and clock-out reminder logic.
-- The function will now be effectively empty regarding notifications, but structure remains for future use.

CREATE OR REPLACE FUNCTION check_shift_reminders()
RETURNS void AS $$
DECLARE
    -- Variables kept for potential future re-use or other checks
    v_now_time TIME;
    v_today DATE;
    v_buffer_minutes INTERVAL := '15 minutes';
BEGIN
    -- Force Asia/Jakarta Timezone
    v_now_time := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::time;
    v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date;

    -- A. PENGINGAT MASUK (DISABLED)
    -- Logic removed as per user request.

    -- B. PENGINGAT PULANG (DISABLED)
    -- Logic removed as per user request.

    -- Function currently does nothing but maintaining signature prevents errors in scheduled cron jobs.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
