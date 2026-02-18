-- 105_fix_agenda_notifications.sql
-- Goal: Fix agenda notification system
-- 1. Add cron job for agenda reminders (15 mins before)
-- 2. Ensure database trigger handles all notifications (avoid duplication)
-- 3. Integrate with existing notification system

-- ==========================================
-- PART 1: Improve Agenda Reminder Function
-- ==========================================

CREATE OR REPLACE FUNCTION check_agenda_reminders()
RETURNS void AS $$
DECLARE
    v_participant_record RECORD;
    v_now_timestamp TIMESTAMPTZ;
    v_target_time_start TIMESTAMPTZ;
    v_target_time_end TIMESTAMPTZ;
BEGIN
    -- TIMEZONE FIX: Use Asia/Jakarta
    v_now_timestamp := now() AT TIME ZONE 'Asia/Jakarta';
    
    -- Look for agendas starting in 15 minutes (with 1-minute buffer for cron)
    -- If cron runs every 2 minutes, this catches agendas starting between 14-16 minutes from now
    v_target_time_start := v_now_timestamp + interval '14 minutes';
    v_target_time_end := v_now_timestamp + interval '16 minutes';

    FOR v_participant_record IN
        SELECT 
            ap.user_id,
            a.id as agenda_id,
            a.title,
            a.start_time,
            a.location,
            p.full_name
        FROM agenda_participants ap
        JOIN agendas a ON ap.agenda_id = a.id
        JOIN profiles p ON ap.user_id = p.id
        WHERE 
            a.start_time >= v_target_time_start
            AND a.start_time <= v_target_time_end
            AND ap.status != 'declined' -- Don't remind if declined
            -- Prevent duplicate reminders for same agenda today
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.user_id = ap.user_id 
                AND n.type = 'push_reminder_agenda' 
                AND n.created_at::date = v_now_timestamp::date
                AND n.message LIKE '%' || a.title || '%'
            )
    LOOP
        -- Use push_reminder_ type to trigger push notification but hide from bell list
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_participant_record.user_id,
            '⏰ Agenda akan dimulai!',
            'Halo ' || split_part(v_participant_record.full_name, ' ', 1) || 
            ', agenda "' || v_participant_record.title || '" akan dimulai dalam 15 menit' ||
            CASE 
                WHEN v_participant_record.location IS NOT NULL AND v_participant_record.location != '' 
                THEN ' di ' || v_participant_record.location 
                ELSE '' 
            END || '.',
            'push_reminder_agenda',
            '/agenda'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 2: Improve Notification Trigger for New Agenda Assignment
-- ==========================================

CREATE OR REPLACE FUNCTION notify_participant_on_new_agenda()
RETURNS TRIGGER AS $$
DECLARE
    v_agenda_title TEXT;
    v_agenda_start TIMESTAMPTZ;
    v_agenda_location TEXT;
    v_creator_name TEXT;
BEGIN
    -- Get agenda details
    SELECT 
        a.title, 
        a.start_time,
        a.location,
        p.full_name
    INTO 
        v_agenda_title, 
        v_agenda_start,
        v_agenda_location,
        v_creator_name
    FROM public.agendas a
    LEFT JOIN public.profiles p ON a.created_by = p.id
    WHERE a.id = NEW.agenda_id;

    -- Insert notification with rich information
    INSERT INTO public.notifications (user_id, title, message, type, link, read)
    VALUES (
        NEW.user_id,
        '📅 Undangan Agenda Baru',
        'Anda diundang ke agenda "' || v_agenda_title || '" pada ' || 
        to_char(v_agenda_start AT TIME ZONE 'Asia/Jakarta', 'DD Mon YYYY, HH24:MI') || ' WIB' ||
        CASE 
            WHEN v_agenda_location IS NOT NULL AND v_agenda_location != '' 
            THEN ' di ' || v_agenda_location 
            ELSE '' 
        END ||
        CASE 
            WHEN v_creator_name IS NOT NULL 
            THEN '. Dibuat oleh: ' || v_creator_name 
            ELSE '' 
        END || '.',
        'agenda_invite',
        '/agenda',
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS tr_notify_participant_new_agenda ON public.agenda_participants;

CREATE TRIGGER tr_notify_participant_new_agenda
AFTER INSERT ON public.agenda_participants
FOR EACH ROW
EXECUTE FUNCTION notify_participant_on_new_agenda();

-- ==========================================
-- PART 3: Add Agenda Reminders to Cron Job
-- ==========================================

-- Add agenda reminder check to existing master_reminder_job
-- Since we already have a cron job running every 2 minutes (from migration 103),
-- we'll modify the process_all_reminders function to include agenda reminders

CREATE OR REPLACE FUNCTION process_all_reminders()
RETURNS void AS $$
DECLARE
    -- Constants
    v_now_time TIME;
    v_today DATE;
    v_now_timestamp TIMESTAMPTZ;
    v_buffer_minutes INTERVAL := '10 minutes';
    
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
            'push_reminder_clock_in',
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

    -- ==========================================
    -- C. PENGINGAT AGENDA (15 menit sebelumnya)
    -- ==========================================
    
    -- Call the dedicated agenda reminder function
    PERFORM check_agenda_reminders();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 4: Create Index for Performance
-- ==========================================

-- Index to speed up agenda reminder queries
CREATE INDEX IF NOT EXISTS idx_agendas_start_time ON agendas(start_time);
CREATE INDEX IF NOT EXISTS idx_agenda_participants_user_agenda ON agenda_participants(user_id, agenda_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_created ON notifications(user_id, type, created_at);

-- ==========================================
-- NOTES
-- ==========================================
-- 1. Database trigger handles notifications when participants are added
-- 2. Frontend code in Agenda.tsx can REMOVE notification insert (line 329-348) to avoid duplication
-- 3. Agenda reminders now run automatically every 2 minutes via master_reminder_job
-- 4. All notifications use 'push_reminder_' prefix for agenda to trigger push but hide from bell
