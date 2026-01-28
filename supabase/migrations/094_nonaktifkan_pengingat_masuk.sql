-- DISABLE CLOCK-IN REMINDER (PENGINGAT MASUK)
-- User complained about receiving "Pengingat Masuk" notifications.
-- This migration updates the cron function to remove the clock-in reminder logic
-- while preserving the clock-out reminder (Pengingat Pulang).

CREATE OR REPLACE FUNCTION check_shift_reminders()
RETURNS void AS $$
DECLARE
    v_user_record RECORD;
    v_now_time TIME;
    v_today DATE;
    v_buffer_minutes INTERVAL := '15 minutes';
BEGIN
    -- Force Asia/Jakarta Timezone
    v_now_time := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::time;
    v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date;

    -- A. PENGINGAT MASUK (DISABLED)
    -- Logic removed to stop "Pengingat Masuk" notifications as per user request.

    -- B. PENGINGAT PULANG
    FOR v_user_record IN 
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
                AND n.type = 'reminder_clock_out' 
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'Pengingat Pulang',
            'Sebentar lagi jam pulang (' || to_char(v_user_record.end_time, 'HH24:MI') || '). Pastikan absen pulang ya!',
            'reminder_clock_out',
            '/dashboard'
        );
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
