-- 103_automatic_shift_reminders.sql
-- Goal: Provide AUTOMATIC reminders for Clock In and Clock Out 10 minutes before shift time.
-- This replaces old manual/half-working logic with a clean consolidated function.

-- 1. Redefine the Master Function
CREATE OR REPLACE FUNCTION process_all_reminders()
RETURNS void AS $$
DECLARE
    -- Constants
    v_now_time TIME;
    v_today DATE;
    v_now_timestamp TIMESTAMPTZ;
    v_buffer_minutes INTERVAL := '10 minutes'; -- As requested: 07:00 starts reminder at 06:50
    
    -- Loop Variables
    v_record RECORD;
BEGIN
    -- TIMEZONE FIX: Force using Jakarta Time for all comparison
    v_now_time := (now() AT TIME ZONE 'Asia/Jakarta')::TIME;
    v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_now_timestamp := now() AT TIME ZONE 'Asia/Jakarta';

    -- ==========================================
    -- A. PENGINGAT PRIBADI (PERSONAL NOTES)
    -- ==========================================
    FOR v_record IN 
        SELECT * FROM personal_reminders
        WHERE 
            remind_at IS NOT NULL
            AND is_notified = false 
            AND is_completed = false
            AND remind_at <= v_now_timestamp
            AND remind_at >= (v_now_timestamp - interval '24 hours')
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link, read)
        VALUES (
            v_record.user_id,
            'Pengingat: ' || v_record.title,
            COALESCE(v_record.description, 'Waktunya kegiatan Anda dimulai.'),
            'personal_reminder',
            '/notes',
            false
        );

        UPDATE personal_reminders SET is_notified = true WHERE id = v_record.id;
    END LOOP;

    -- ==========================================
    -- B. PENGINGAT SHIFT (AUTOMATIC)
    -- ==========================================
    
    -- B.1. Automatic Clock In Reminder (10 mins before)
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
            'Waktunya Check In! ⏰',
            'Halo ' || split_part(v_record.full_name, ' ', 1) || ', jadwal ' || v_record.shift_name || ' Anda mulai pukul ' || to_char(v_record.start_time, 'HH24:MI') || '. Jangan lupa absen ya!',
            'push_reminder_clock_in', -- Use push_ to hide from list but trigger system push
            '/attendance'
        );
    END LOOP;

    -- B.2. Automatic Clock Out Reminder (10 mins before end)
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
            'Sudah Waktunya Pulang? 🏠',
            'Satu hari yang hebat! Jam kerja Anda berakhir pukul ' || to_char(v_record.end_time, 'HH24:MI') || '. Jangan lupa Check Out!',
            'push_reminder_clock_out',
            '/attendance'
        );
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Cleanup & Reschedule (Idempotent)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remove all related job names to clean up overlaps
    FOR r IN SELECT jobid FROM cron.job WHERE jobname IN ('master_reminder_job', 'check_shift_reminders_job', 'check_all_reminders_job') LOOP
        PERFORM cron.unschedule(r.jobid);
    END LOOP;
END $$;

-- Schedule the new master job (Runs every 2 minutes)
SELECT cron.schedule(
    'master_reminder_job',
    '*/2 * * * *', 
    'SELECT process_all_reminders()'
);

-- Note: We also keep check_shift_reminders as a dummy or proxy if needed by any other script
CREATE OR REPLACE FUNCTION check_shift_reminders() RETURNS void AS $$
BEGIN
  PERFORM process_all_reminders();
END;
$$ LANGUAGE plpgsql;
