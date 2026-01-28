-- ENABLE PUSH-ONLY REMINDERS
-- User request: "hanya masuk di push notif pwa" (Only show as PWA push notification, hide from in-app list).
-- This migration re-enables the reminders but changes the type to 'push_reminder_clock_in' and 'push_reminder_clock_out'.
-- The frontend is already configured to filter out types starting with 'push_' from the notification list, 
-- but will still trigger the native browser Notification call.

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

    -- A. PENGINGAT MASUK (PUSH ONLY)
    FOR v_user_record IN 
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
                AND n.type = 'push_reminder_clock_in' -- Check for the push type
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'Pengingat Masuk',
            'Halo ' || split_part(v_user_record.full_name, ' ', 1) || ', sebentar lagi jam masuk (' || to_char(v_user_record.start_time, 'HH24:MI') || '). Jangan lupa absen!',
            'push_reminder_clock_in', -- 'push_' prefix hides it from UI list but triggers system notification
            '/dashboard'
        );
    END LOOP;

    -- B. PENGINGAT PULANG (PUSH ONLY)
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
                AND n.type = 'push_reminder_clock_out' -- Check for the push type
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_user_record.user_id,
            'Pengingat Pulang',
            'Sebentar lagi jam pulang (' || to_char(v_user_record.end_time, 'HH24:MI') || '). Pastikan absen pulang ya!',
            'push_reminder_clock_out', -- 'push_' prefix hides it from UI list but triggers system notification
            '/dashboard'
        );
    END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
