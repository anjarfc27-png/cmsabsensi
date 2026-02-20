-- ====================================================================
-- DIAGNOSE_REMINDER_SYSTEM.SQL
-- Jalankan per section (pisahkan dengan ;) di Supabase SQL Editor
-- untuk menemukan di mana sistem pengingat gagal.
-- ====================================================================

-- ============================================================
-- SECTION 1: Cek waktu server vs Jakarta sekarang
-- ============================================================
SELECT 
    now()                                       AS "UTC sekarang",
    now() AT TIME ZONE 'Asia/Jakarta'           AS "Jakarta sekarang",
    (now() AT TIME ZONE 'Asia/Jakarta')::TIME   AS "Jam Jakarta (TIME)",
    (now() AT TIME ZONE 'Asia/Jakarta')::DATE   AS "Tanggal Jakarta (DATE)";


-- ============================================================
-- SECTION 2: Cek apakah cron job aktif dan kapan terakhir jalan
-- ============================================================
SELECT 
    jobid,
    jobname,
    schedule,
    command,
    active,
    jobid IN (SELECT jobid FROM cron.job_run_details ORDER BY end_time DESC LIMIT 100) AS pernah_jalan
FROM cron.job
WHERE jobname IN ('master_reminder_job', 'check_shift_reminders_job', 'check_all_reminders_job')
ORDER BY jobname;


-- ============================================================
-- SECTION 3: Lihat 10 riwayat terakhir cron job dijalankan
-- ============================================================
SELECT 
    jobid,
    runid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time
FROM cron.job_run_details
WHERE jobid IN (
    SELECT jobid FROM cron.job 
    WHERE jobname = 'master_reminder_job'
)
ORDER BY end_time DESC
LIMIT 10;


-- ============================================================
-- SECTION 4: Cek apakah ada employee_schedules untuk HARI INI
-- ============================================================
SELECT 
    es.id,
    es.date,
    es.is_day_off,
    es.user_id,
    p.full_name,
    s.name AS shift_name,
    s.start_time,
    s.end_time
FROM employee_schedules es
JOIN shifts s ON es.shift_id = s.id
JOIN profiles p ON es.user_id = p.id
WHERE es.date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
ORDER BY s.start_time;


-- ============================================================
-- SECTION 5: Simulasikan query pengingat masuk SEKARANG
-- (Tanpa INSERT, hanya lihat siapa yang seharusnya dapat pengingat)
-- Buffer: 30 menit ke depan agar lebih mudah ditest
-- ============================================================
SELECT 
    es.user_id,
    p.full_name,
    s.name AS shift_name,
    s.start_time                                            AS jam_masuk,
    (now() AT TIME ZONE 'Asia/Jakarta')::TIME               AS jam_sekarang,
    s.start_time - (now() AT TIME ZONE 'Asia/Jakarta')::TIME AS selisih_waktu,
    a.clock_in IS NULL                                      AS belum_clock_in,
    NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.user_id = es.user_id 
        AND (n.type = 'push_reminder_clock_in' OR n.type = 'reminder_clock_in')
        AND n.created_at::date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
    )                                                       AS belum_dapat_notif_hari_ini,
    CASE 
        WHEN s.start_time > (now() AT TIME ZONE 'Asia/Jakarta')::TIME 
         AND s.start_time <= (now() AT TIME ZONE 'Asia/Jakarta')::TIME + INTERVAL '30 minutes'
        THEN '✅ MASUK WINDOW - SEHARUSNYA DAPAT PENGINGAT'
        WHEN s.start_time <= (now() AT TIME ZONE 'Asia/Jakarta')::TIME
        THEN '⏰ Sudah lewat jam masuk'
        ELSE '⏳ Belum waktunya (> 30 menit lagi)'
    END AS status_window
FROM employee_schedules es
JOIN shifts s ON es.shift_id = s.id
JOIN profiles p ON es.user_id = p.id
LEFT JOIN attendances a ON a.user_id = es.user_id 
    AND a.date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
WHERE es.date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
  AND es.is_day_off = false
ORDER BY s.start_time;


-- ============================================================
-- SECTION 6: Cek notifikasi reminder yang sudah terkirim hari ini
-- ============================================================
SELECT 
    n.id,
    n.user_id,
    p.full_name,
    n.type,
    n.title,
    n.created_at AT TIME ZONE 'Asia/Jakarta' AS waktu_kirim_jakarta
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type IN ('push_reminder_clock_in', 'push_reminder_clock_out', 'reminder_clock_in', 'reminder_clock_out')
  AND n.created_at::date = (now() AT TIME ZONE 'Asia/Jakarta')::DATE
ORDER BY n.created_at DESC;


-- ============================================================
-- SECTION 7: TEST MANUAL - Jalankan process_all_reminders() SEKARANG
-- (Ini akan benar-benar insert notifikasi jika ada yang memenuhi syarat)
-- ============================================================
SELECT process_all_reminders();

-- Lalu cek hasilnya:
SELECT 
    n.id,
    p.full_name,
    n.type,
    n.title,
    n.message,
    n.created_at AT TIME ZONE 'Asia/Jakarta' AS waktu
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.type IN ('push_reminder_clock_in', 'push_reminder_clock_out')
  AND n.created_at > now() - INTERVAL '1 minute'
ORDER BY n.created_at DESC;


-- ============================================================
-- SECTION 8: Cek FCM tokens - apakah user punya token terdaftar?
-- ============================================================
SELECT 
    f.user_id,
    p.full_name,
    f.device_type,
    LEFT(f.token, 20) || '...' AS token_preview,
    f.created_at AT TIME ZONE 'Asia/Jakarta' AS terdaftar_pada,
    f.updated_at AT TIME ZONE 'Asia/Jakarta' AS update_terakhir
FROM fcm_tokens f
JOIN profiles p ON f.user_id = p.id
ORDER BY f.updated_at DESC;
