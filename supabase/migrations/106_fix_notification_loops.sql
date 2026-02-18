-- 106_fix_notification_loops.sql
-- Goal: Fix notification looping issues found in audit
-- 1. Cleanup all duplicate cron jobs
-- 2. Add tracking table for agenda reminders
-- 3. Fix duplication logic with proper tracking
-- 4. Add transaction safety

-- ==========================================
-- PART 1: CLEANUP ALL REMINDER CRON JOBS
-- ==========================================

DO $$
DECLARE
    r RECORD;
    job_count INT := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CLEANING UP REMINDER CRON JOBS';
    RAISE NOTICE '========================================';
    
    -- Remove ALL cron jobs related to reminders/shift/agenda
    FOR r IN 
        SELECT jobid, jobname, schedule, command
        FROM cron.job 
        WHERE jobname LIKE '%reminder%' 
           OR jobname LIKE '%shift%'
           OR jobname LIKE '%personal%'
           OR jobname LIKE '%agenda%'
           OR jobname LIKE '%pengingat%'
    LOOP
        job_count := job_count + 1;
        RAISE NOTICE 'Removing job: % (ID: %) - Schedule: %', r.jobname, r.jobid, r.schedule;
        PERFORM cron.unschedule(r.jobid);
    END LOOP;
    
    RAISE NOTICE 'Total jobs removed: %', job_count;
    RAISE NOTICE '========================================';
END $$;

-- ==========================================
-- PART 2: CREATE TRACKING TABLE FOR AGENDA REMINDERS
-- ==========================================

-- This table prevents duplicate agenda reminders
CREATE TABLE IF NOT EXISTS sent_agenda_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    agenda_id UUID NOT NULL REFERENCES agendas(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- 'invitation' or '15min_reminder'
    sent_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Plain DATE column, no timezone issues
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure one reminder per user per agenda per day per type
    UNIQUE(user_id, agenda_id, reminder_type, sent_date)
);

-- Add index for performance lookups
CREATE INDEX IF NOT EXISTS idx_sent_agenda_reminders_lookup 
ON sent_agenda_reminders(user_id, agenda_id, reminder_type, sent_date);

COMMENT ON TABLE sent_agenda_reminders IS 'Tracks sent agenda reminders to prevent duplicates';

-- ==========================================
-- PART 3: IMPROVED AGENDA REMINDER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION check_agenda_reminders()
RETURNS void AS $$
DECLARE
    v_participant_record RECORD;
    v_now_timestamp TIMESTAMPTZ;
    v_target_time_start TIMESTAMPTZ;
    v_target_time_end TIMESTAMPTZ;
    v_today DATE;
BEGIN
    -- TIMEZONE FIX: Use Asia/Jakarta
    v_now_timestamp := now() AT TIME ZONE 'Asia/Jakarta';
    v_today := v_now_timestamp::date;
    
    -- Look for agendas starting in 15 minutes (with 1-minute buffer for cron)
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
            AND ap.status != 'declined'
            -- NEW: Check tracking table instead of message LIKE
            AND NOT EXISTS (
                SELECT 1 FROM sent_agenda_reminders sar
                WHERE sar.user_id = ap.user_id 
                AND sar.agenda_id = a.id
                AND sar.reminder_type = '15min_reminder'
                AND sar.sent_date = v_today
            )
    LOOP
        -- Insert notification
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
        
        -- Mark as sent in tracking table (ignore if duplicate)
        INSERT INTO sent_agenda_reminders (user_id, agenda_id, reminder_type, sent_date)
        VALUES (
            v_participant_record.user_id,
            v_participant_record.agenda_id,
            '15min_reminder',
            v_today
        )
        ON CONFLICT (user_id, agenda_id, reminder_type, sent_date)
        DO NOTHING;
        
    END LOOP;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't crash the cron job
        RAISE WARNING 'Error in check_agenda_reminders: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 4: IMPROVED INVITATION TRIGGER
-- ==========================================

CREATE OR REPLACE FUNCTION notify_participant_on_new_agenda()
RETURNS TRIGGER AS $$
DECLARE
    v_agenda_title TEXT;
    v_agenda_start TIMESTAMPTZ;
    v_agenda_location TEXT;
    v_creator_name TEXT;
    v_today DATE;
BEGIN
    v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;
    
    -- Check if already sent invitation today (prevent duplicates on edit)
    IF EXISTS (
        SELECT 1 FROM sent_agenda_reminders
        WHERE user_id = NEW.user_id
        AND agenda_id = NEW.agenda_id
        AND reminder_type = 'invitation'
        AND sent_date = v_today
    ) THEN
        RETURN NEW; -- Already sent, skip
    END IF;
    
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

    -- Insert notification
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
    
    -- Track that invitation was sent (ignore if duplicate)
    INSERT INTO sent_agenda_reminders (user_id, agenda_id, reminder_type, sent_date)
    VALUES (NEW.user_id, NEW.agenda_id, 'invitation', v_today)
    ON CONFLICT (user_id, agenda_id, reminder_type, sent_date)
    DO NOTHING;

    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the participant insert
        RAISE WARNING 'Error in notify_participant_on_new_agenda: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS tr_notify_participant_new_agenda ON public.agenda_participants;
CREATE TRIGGER tr_notify_participant_new_agenda
AFTER INSERT ON public.agenda_participants
FOR EACH ROW
EXECUTE FUNCTION notify_participant_on_new_agenda();

-- ==========================================
-- PART 5: IMPROVED PERSONAL REMINDER WITH LOCKING
-- ==========================================

-- Update the process_all_reminders function to use row-level locking
-- This prevents duplicate processing if multiple cron jobs somehow run

CREATE OR REPLACE FUNCTION process_all_reminders()
RETURNS void AS $$
DECLARE
    v_now_time TIME;
    v_today DATE;
    v_now_timestamp TIMESTAMPTZ;
    v_buffer_minutes INTERVAL := '10 minutes';
    v_record RECORD;
BEGIN
    -- TIMEZONE FIX
    v_now_time := (now() AT TIME ZONE 'Asia/Jakarta')::TIME;
    v_today := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_now_timestamp := now() AT TIME ZONE 'Asia/Jakarta';

    -- ==========================================
    -- A. PERSONAL REMINDERS (WITH ROW LOCK)
    -- ==========================================
    FOR v_record IN 
        SELECT * FROM personal_reminders
        WHERE 
            remind_at IS NOT NULL
            AND is_notified = false 
            AND is_completed = false
            AND remind_at <= v_now_timestamp
            AND remind_at >= (v_now_timestamp - interval '24 hours')
        FOR UPDATE SKIP LOCKED  -- ← ADDED: Skip if locked by another process
    LOOP
        -- Insert notification
        INSERT INTO notifications (user_id, title, message, type, link, read)
        VALUES (
            v_record.user_id,
            'Pengingat: ' || v_record.title,
            COALESCE(v_record.description, 'Waktunya kegiatan Anda dimulai.'),
            'personal_reminder',
            '/notes',
            false
        );

        -- Mark as notified (within same transaction)
        UPDATE personal_reminders 
        SET is_notified = true 
        WHERE id = v_record.id;
    END LOOP;

    -- ==========================================
    -- B. SHIFT REMINDERS
    -- ==========================================
    
    -- B.1. Clock In Reminder
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
                AND n.type IN ('push_reminder_clock_in', 'reminder_clock_in')
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_record.user_id,
            'Waktunya Check In! ⏰',
            'Halo ' || split_part(v_record.full_name, ' ', 1) || 
            ', jadwal ' || v_record.shift_name || ' Anda mulai pukul ' || 
            to_char(v_record.start_time, 'HH24:MI') || '. Jangan lupa absen ya!',
            'push_reminder_clock_in',
            '/attendance'
        );
    END LOOP;

    -- B.2. Clock Out Reminder
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
                AND n.type IN ('push_reminder_clock_out', 'reminder_clock_out')
                AND n.created_at::date = v_today
            )
    LOOP
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
            v_record.user_id,
            'Sudah Waktunya Pulang? 🏠',
            'Satu hari yang hebat! Jam kerja Anda berakhir pukul ' || 
            to_char(v_record.end_time, 'HH24:MI') || '. Jangan lupa Check Out!',
            'push_reminder_clock_out',
            '/attendance'
        );
    END LOOP;

    -- ==========================================
    -- C. AGENDA REMINDERS
    -- ==========================================
    PERFORM check_agenda_reminders();

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in process_all_reminders: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 6: SCHEDULE SINGLE MASTER CRON JOB
-- ==========================================

-- Use new name to ensure no conflicts
SELECT cron.schedule(
    'master_reminder_job_v2',
    '*/2 * * * *',  -- Every 2 minutes
    'SELECT process_all_reminders()'
);

-- ==========================================
-- PART 7: CLEANUP OLD REMINDER RECORDS
-- ==========================================

-- Optional: Clean up old tracking records (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_reminder_tracking()
RETURNS void AS $$
BEGIN
    DELETE FROM sent_agenda_reminders
    WHERE sent_at < (now() - interval '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup monthly (1st day of month at 2 AM)
SELECT cron.schedule(
    'cleanup_reminder_tracking',
    '0 2 1 * *',
    'SELECT cleanup_old_reminder_tracking()'
);

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Run these to verify the fix worked:

-- 1. Check active cron jobs (should only see master_reminder_job_v2 and cleanup)
-- SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobname;

-- 2. Check for duplicate notifications
-- SELECT user_id, title, DATE(created_at), COUNT(*) as cnt
-- FROM notifications
-- WHERE created_at >= CURRENT_DATE
-- GROUP BY user_id, title, DATE(created_at)
-- HAVING COUNT(*) > 1;

-- 3. Check tracking table
-- SELECT * FROM sent_agenda_reminders ORDER BY sent_at DESC LIMIT 20;
