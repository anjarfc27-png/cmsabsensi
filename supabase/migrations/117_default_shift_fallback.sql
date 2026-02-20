-- 117_default_shift_fallback.sql
-- Tujuan: Menambahkan konsep "Shift Default" agar pengingat otomatis bisa
--         bekerja tanpa perlu mengisi employee_schedules setiap bulan.
--
-- Logika:
--   1. Jika user SUDAH punya employee_schedules → pakai jadwal itu (tidak diubah)
--   2. Jika user BELUM punya jadwal hari ini → fallback ke shift default
--   3. Jika shift default tidak ada → sistem tidak kirim reminder (warning saja)
--   4. Weekend (Sabtu/Minggu) otomatis di-skip untuk fallback

-- =====================================================================
-- STEP 1: Tambah kolom is_default ke tabel shifts
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shifts' AND column_name = 'is_default'
    ) THEN
        ALTER TABLE public.shifts ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE '[117] Kolom is_default berhasil ditambahkan ke shifts.';
    ELSE
        RAISE NOTICE '[117] Kolom is_default sudah ada, skip.';
    END IF;
END $$;

-- Pastikan hanya ada 1 shift default (constraint unik parsial)
-- Jika sudah ada constraint ini, skip
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shifts_only_one_default'
    ) THEN
        CREATE UNIQUE INDEX shifts_only_one_default
            ON public.shifts (is_default)
            WHERE is_default = true;
        RAISE NOTICE '[117] Unique constraint untuk shift default berhasil dibuat.';
    ELSE
        RAISE NOTICE '[117] Unique constraint sudah ada, skip.';
    END IF;
END $$;

COMMENT ON COLUMN public.shifts.is_default
  IS 'Jika true, shift ini digunakan sebagai fallback untuk semua karyawan yang tidak memiliki jadwal eksplisit hari ini. Hanya 1 shift yang boleh menjadi default.';

-- =====================================================================
-- STEP 2: Perbarui process_all_reminders() dengan logika fallback
-- =====================================================================
CREATE OR REPLACE FUNCTION process_all_reminders()
RETURNS void AS $$
DECLARE
    v_now_time      TIME;
    v_today         DATE;
    v_now_timestamp TIMESTAMPTZ;
    v_buffer        INTERVAL := '15 minutes';
    v_dow           INT;        -- Day of week (0=Sun, 6=Sat)
    v_record        RECORD;
    v_default_shift RECORD;    -- Shift default jika ada
BEGIN
    -- Timezone: Asia/Jakarta
    v_now_time      := (now() AT TIME ZONE 'Asia/Jakarta')::TIME;
    v_today         := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_now_timestamp := now() AT TIME ZONE 'Asia/Jakarta';
    v_dow           := EXTRACT(DOW FROM v_today); -- 0=Minggu, 6=Sabtu

    -- ================================================================
    -- A. PENGINGAT PRIBADI (Personal Notes)
    -- ================================================================
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

    -- ================================================================
    -- B. PENGINGAT SHIFT — DARI employee_schedules (JADWAL EKSPLISIT)
    -- User yang sudah di-assign shift spesifik → tidak terpengaruh shift default
    -- ================================================================

    -- B.1. Clock In reminder dari jadwal eksplisit
    FOR v_record IN
        SELECT
            es.user_id,
            p.full_name,
            s.name  AS shift_name,
            s.start_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        LEFT JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE
            es.date       = v_today
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
            'push_reminder_clock_in',
            '/attendance'
        );
    END LOOP;

    -- B.2. Clock Out reminder dari jadwal eksplisit
    FOR v_record IN
        SELECT
            es.user_id,
            p.full_name,
            s.name  AS shift_name,
            s.end_time
        FROM employee_schedules es
        JOIN shifts s ON es.shift_id = s.id
        JOIN profiles p ON es.user_id = p.id
        JOIN attendances a ON a.user_id = es.user_id AND a.date = v_today
        WHERE
            es.date       = v_today
            AND es.is_day_off = false
            AND a.clock_in  IS NOT NULL
            AND a.clock_out IS NULL
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
            'push_reminder_clock_out',
            '/attendance'
        );
    END LOOP;

    -- ================================================================
    -- C. PENGINGAT SHIFT — DARI SHIFT DEFAULT (FALLBACK)
    -- Hanya untuk user yang TIDAK memiliki employee_schedules hari ini.
    -- Skip jika hari libur (Sabtu=6, Minggu=0).
    -- ================================================================

    -- Ambil shift default
    SELECT * INTO v_default_shift FROM shifts WHERE is_default = true LIMIT 1;

    -- Hanya proses jika:
    --   1. Ada shift default yang dikonfigurasi
    --   2. Bukan hari weekend (bisa dimodifikasi jika perlu)
    IF v_default_shift.id IS NOT NULL AND v_dow NOT IN (0, 6) THEN

        -- C.1. Clock In reminder dari shift default
        IF v_default_shift.start_time > v_now_time
           AND v_default_shift.start_time <= (v_now_time + v_buffer) THEN

            FOR v_record IN
                SELECT p.id AS user_id, p.full_name
                FROM profiles p
                WHERE p.is_active = true
                  -- User BELUM punya jadwal eksplisit hari ini
                  AND NOT EXISTS (
                      SELECT 1 FROM employee_schedules es
                      WHERE es.user_id = p.id AND es.date = v_today
                  )
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
                    ', jam kerja dimulai pukul ' ||
                    to_char(v_default_shift.start_time, 'HH24:MI') || '. Jangan lupa absen ya!',
                    'push_reminder_clock_in',
                    '/attendance'
                );
            END LOOP;

        END IF;

        -- C.2. Clock Out reminder dari shift default
        IF v_default_shift.end_time > v_now_time
           AND v_default_shift.end_time <= (v_now_time + v_buffer) THEN

            FOR v_record IN
                SELECT p.id AS user_id, p.full_name
                FROM profiles p
                WHERE p.is_active = true
                  -- User BELUM punya jadwal eksplisit hari ini
                  AND NOT EXISTS (
                      SELECT 1 FROM employee_schedules es
                      WHERE es.user_id = p.id AND es.date = v_today
                  )
                  -- Sudah clock in tapi belum clock out
                  AND EXISTS (
                      SELECT 1 FROM attendances a
                      WHERE a.user_id = p.id AND a.date = v_today
                        AND a.clock_in IS NOT NULL AND a.clock_out IS NULL
                  )
                  -- Belum dapat pengingat hari ini
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
                    to_char(v_default_shift.end_time, 'HH24:MI') || '. Silakan Check Out.',
                    'push_reminder_clock_out',
                    '/attendance'
                );
            END LOOP;

        END IF;

    ELSIF v_default_shift.id IS NULL THEN
        -- Info saja di log, bukan error fatal
        RAISE NOTICE '[reminder] Tidak ada shift default. Set shift default di halaman Manajemen Shift.';
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.process_all_reminders
  IS 'Mengirim pengingat absen untuk semua karyawan aktif. '
     'Priority: (1) Jadwal eksplisit di employee_schedules, (2) Shift default (fallback untuk yang belum dijadwalkan). '
     'Weekend otomatis di-skip untuk fallback.';

-- Pastikan cron job masih jalan
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'master_reminder_job' AND active = true) THEN
        PERFORM cron.schedule('master_reminder_job', '*/2 * * * *', 'SELECT process_all_reminders()');
        RAISE NOTICE '[117] master_reminder_job dijadwalkan ulang.';
    ELSE
        RAISE NOTICE '[117] master_reminder_job sudah aktif, tidak perlu dijadwal ulang.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[117] Tidak dapat cek/schedule cron: %', SQLERRM;
END $$;
