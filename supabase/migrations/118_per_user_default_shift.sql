-- 118_per_user_default_shift.sql
-- Tujuan: Menambahkan "shift default per-user" di profiles.
--         Karyawan dengan shift tetap (misal Driver) cukup di-set sekali,
--         tidak perlu isi employee_schedules setiap bulan.
--
-- Prioritas logika process_all_reminders():
--   1. employee_schedules hari ini (override manual admin)
--   2. profiles.default_shift_id (shift permanen per-user)
--   3. shifts.is_default = true (fallback perusahaan)

-- =====================================================================
-- STEP 1: Tambah kolom default_shift_id ke profiles
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'default_shift_id'
    ) THEN
        ALTER TABLE public.profiles
            ADD COLUMN default_shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;
        RAISE NOTICE '[118] Kolom default_shift_id berhasil ditambahkan ke profiles.';
    ELSE
        RAISE NOTICE '[118] Kolom default_shift_id sudah ada, skip.';
    END IF;
END $$;

COMMENT ON COLUMN public.profiles.default_shift_id
  IS 'Shift default permanen untuk user ini. Dipakai oleh pengingat otomatis jika tidak ada employee_schedules. '
     'Contoh: Driver diset ke "Shift Driver" → reminder otomatis sesuai jam driver selamanya.';

CREATE INDEX IF NOT EXISTS idx_profiles_default_shift
    ON public.profiles (default_shift_id)
    WHERE default_shift_id IS NOT NULL;

-- =====================================================================
-- STEP 2: Perbarui process_all_reminders() dengan 3-level priority
-- =====================================================================
CREATE OR REPLACE FUNCTION process_all_reminders()
RETURNS void AS $$
DECLARE
    v_now_time      TIME;
    v_today         DATE;
    v_now_timestamp TIMESTAMPTZ;
    v_buffer        INTERVAL := '15 minutes';
    v_dow           INT;
    v_record        RECORD;
    v_company_shift RECORD;
BEGIN
    v_now_time      := (now() AT TIME ZONE 'Asia/Jakarta')::TIME;
    v_today         := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_now_timestamp := now() AT TIME ZONE 'Asia/Jakarta';
    v_dow           := EXTRACT(DOW FROM v_today); -- 0=Minggu, 6=Sabtu

    -- ================================================================
    -- A. PENGINGAT PRIBADI (Personal Notes) — tidak berubah
    -- ================================================================
    FOR v_record IN
        SELECT * FROM personal_reminders
        WHERE remind_at IS NOT NULL
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
            'personal_reminder', '/notes', false
        );
        UPDATE personal_reminders SET is_notified = true WHERE id = v_record.id;
    END LOOP;

    -- ================================================================
    -- B. PENGINGAT SHIFT — PRIORITAS 1: employee_schedules (manual)
    -- User yang sudah di-assign shift spesifik oleh admin hari ini.
    -- ================================================================

    -- B.1 Clock In dari jadwal manual
    FOR v_record IN
        SELECT es.user_id, p.full_name, s.name AS shift_name, s.start_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        LEFT JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE es.date = v_today
          AND es.is_day_off = false
          AND a.clock_in IS NULL
          AND s.start_time >  v_now_time
          AND s.start_time <= (v_now_time + v_buffer)
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
            'Waktunya Absen Masuk! ⏰',
            'Halo ' || split_part(v_record.full_name, ' ', 1) ||
            ', jadwal ' || v_record.shift_name ||
            ' Anda mulai pukul ' || to_char(v_record.start_time, 'HH24:MI') || '.',
            'push_reminder_clock_in', '/attendance'
        );
    END LOOP;

    -- B.2 Clock Out dari jadwal manual
    FOR v_record IN
        SELECT es.user_id, p.full_name, s.name AS shift_name, s.end_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE es.date = v_today
          AND es.is_day_off = false
          AND a.clock_in IS NOT NULL AND a.clock_out IS NULL
          AND s.end_time >  v_now_time
          AND s.end_time <= (v_now_time + v_buffer)
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
            'Jangan Lupa Absen Pulang! 🏠',
            'Kerja bagus hari ini! Jadwal Anda berakhir pukul ' ||
            to_char(v_record.end_time, 'HH24:MI') || '. Silakan Check Out.',
            'push_reminder_clock_out', '/attendance'
        );
    END LOOP;

    -- ================================================================
    -- C. PENGINGAT SHIFT — PRIORITAS 2: default_shift_id per-user
    --    Hanya untuk user yang:
    --    - TIDAK punya employee_schedules hari ini
    --    - Memiliki default_shift_id di profiles
    --    - Bukan hari weekend (Sabtu/Minggu)
    -- ================================================================
    IF v_dow NOT IN (0, 6) THEN

        -- C.1 Clock In dari shift personal
        FOR v_record IN
            SELECT
                p.id AS user_id,
                p.full_name,
                s.name  AS shift_name,
                s.start_time
            FROM profiles p
            JOIN shifts s ON p.default_shift_id = s.id
            WHERE p.is_active = true
              AND p.default_shift_id IS NOT NULL
              -- Belum punya jadwal eksplisit hari ini (PRIORITAS 1 sudah handle itu)
              AND NOT EXISTS (
                  SELECT 1 FROM employee_schedules es
                  WHERE es.user_id = p.id AND es.date = v_today
              )
              AND s.start_time >  v_now_time
              AND s.start_time <= (v_now_time + v_buffer)
              -- Belum clock in
              AND NOT EXISTS (
                  SELECT 1 FROM attendances a
                  WHERE a.user_id = p.id AND a.date = v_today AND a.clock_in IS NOT NULL
              )
              -- Belum dapat pengingat hari ini
              AND NOT EXISTS (
                  SELECT 1 FROM notifications n
                  WHERE n.user_id = p.id
                    AND n.type IN ('push_reminder_clock_in', 'reminder_clock_in')
                    AND n.created_at::date = v_today
              )
        LOOP
            INSERT INTO notifications (user_id, title, message, type, link)
            VALUES (
                v_record.user_id,
                'Waktunya Absen Masuk! ⏰',
                'Halo ' || split_part(v_record.full_name, ' ', 1) ||
                ', jam kerja ' || v_record.shift_name ||
                ' dimulai pukul ' || to_char(v_record.start_time, 'HH24:MI') || '.',
                'push_reminder_clock_in', '/attendance'
            );
        END LOOP;

        -- C.2 Clock Out dari shift personal
        FOR v_record IN
            SELECT
                p.id AS user_id,
                p.full_name,
                s.name  AS shift_name,
                s.end_time
            FROM profiles p
            JOIN shifts s ON p.default_shift_id = s.id
            WHERE p.is_active = true
              AND p.default_shift_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM employee_schedules es
                  WHERE es.user_id = p.id AND es.date = v_today
              )
              AND s.end_time >  v_now_time
              AND s.end_time <= (v_now_time + v_buffer)
              AND EXISTS (
                  SELECT 1 FROM attendances a
                  WHERE a.user_id = p.id AND a.date = v_today
                    AND a.clock_in IS NOT NULL AND a.clock_out IS NULL
              )
              AND NOT EXISTS (
                  SELECT 1 FROM notifications n
                  WHERE n.user_id = p.id
                    AND n.type IN ('push_reminder_clock_out', 'reminder_clock_out')
                    AND n.created_at::date = v_today
              )
        LOOP
            INSERT INTO notifications (user_id, title, message, type, link)
            VALUES (
                v_record.user_id,
                'Jangan Lupa Absen Pulang! 🏠',
                'Kerja bagus hari ini! Jam ' || v_record.shift_name ||
                ' berakhir pukul ' || to_char(v_record.end_time, 'HH24:MI') || '. Silakan Check Out.',
                'push_reminder_clock_out', '/attendance'
            );
        END LOOP;

    END IF; -- end weekend check for priority 2

    -- ================================================================
    -- D. PENGINGAT SHIFT — PRIORITAS 3: shift default perusahaan
    --    Hanya untuk user yang:
    --    - TIDAK punya employee_schedules hari ini
    --    - TIDAK punya default_shift_id di profil
    --    - Bukan hari weekend
    -- ================================================================
    SELECT * INTO v_company_shift FROM shifts WHERE is_default = true LIMIT 1;

    IF v_company_shift.id IS NOT NULL AND v_dow NOT IN (0, 6) THEN

        -- D.1 Clock In dari shift perusahaan
        IF v_company_shift.start_time > v_now_time
           AND v_company_shift.start_time <= (v_now_time + v_buffer) THEN
            FOR v_record IN
                SELECT p.id AS user_id, p.full_name
                FROM profiles p
                WHERE p.is_active = true
                  AND p.default_shift_id IS NULL     -- Tidak punya shift personal
                  AND NOT EXISTS (
                      SELECT 1 FROM employee_schedules es
                      WHERE es.user_id = p.id AND es.date = v_today
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM attendances a
                      WHERE a.user_id = p.id AND a.date = v_today AND a.clock_in IS NOT NULL
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM notifications n
                      WHERE n.user_id = p.id
                        AND n.type IN ('push_reminder_clock_in', 'reminder_clock_in')
                        AND n.created_at::date = v_today
                  )
            LOOP
                INSERT INTO notifications (user_id, title, message, type, link)
                VALUES (
                    v_record.user_id,
                    'Waktunya Absen Masuk! ⏰',
                    'Halo ' || split_part(v_record.full_name, ' ', 1) ||
                    ', jam kerja dimulai pukul ' ||
                    to_char(v_company_shift.start_time, 'HH24:MI') || '. Jangan lupa absen ya!',
                    'push_reminder_clock_in', '/attendance'
                );
            END LOOP;
        END IF;

        -- D.2 Clock Out dari shift perusahaan
        IF v_company_shift.end_time > v_now_time
           AND v_company_shift.end_time <= (v_now_time + v_buffer) THEN
            FOR v_record IN
                SELECT p.id AS user_id, p.full_name
                FROM profiles p
                WHERE p.is_active = true
                  AND p.default_shift_id IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM employee_schedules es
                      WHERE es.user_id = p.id AND es.date = v_today
                  )
                  AND EXISTS (
                      SELECT 1 FROM attendances a
                      WHERE a.user_id = p.id AND a.date = v_today
                        AND a.clock_in IS NOT NULL AND a.clock_out IS NULL
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM notifications n
                      WHERE n.user_id = p.id
                        AND n.type IN ('push_reminder_clock_out', 'reminder_clock_out')
                        AND n.created_at::date = v_today
                  )
            LOOP
                INSERT INTO notifications (user_id, title, message, type, link)
                VALUES (
                    v_record.user_id,
                    'Jangan Lupa Absen Pulang! 🏠',
                    'Kerja bagus hari ini! Jam kerja berakhir pukul ' ||
                    to_char(v_company_shift.end_time, 'HH24:MI') || '. Silakan Check Out.',
                    'push_reminder_clock_out', '/attendance'
                );
            END LOOP;
        END IF;

    ELSIF v_company_shift.id IS NULL THEN
        RAISE NOTICE '[reminder] Tidak ada shift default perusahaan. Set via halaman Manajemen Shift.';
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.process_all_reminders
  IS '3-level priority reminder system: '
     '(1) employee_schedules hari ini → jadwal manual admin, '
     '(2) profiles.default_shift_id → shift permanen per-user (misal Driver), '
     '(3) shifts.is_default=true → fallback perusahaan. '
     'Weekend (Sabtu/Minggu) otomatis di-skip untuk level 2 & 3.';
