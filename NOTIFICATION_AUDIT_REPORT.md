# 🚨 AUDIT SISTEM NOTIFIKASI - POTENSI LOOPING

## 📊 Executive Summary

**Status:** ⚠️ **DITEMUKAN 3 POTENSI MASALAH SERIUS**

1. ⚠️ **Multiple Cron Jobs** - Berpotensi jalan bersamaan
2. ⚠️ **Agenda Reminder Loop Risk** - Kondisi NOT EXISTS bisa bocor
3. ✅ **Database Triggers** - Aman, tidak rekursif

---

## 🔍 Temuan Detail

### 1. ⚠️ MASALAH SERIUS: Multiple Cron Jobs Aktif

**Masalah:**
Ada **BANYAK** migration yang membuat cron job dengan nama sama atau berbeda:

| Migration | Cron Job Name | Schedule | Function Called |
|-----------|---------------|----------|-----------------|
| 033 | `check_shift_reminders_job` | ? | `check_shift_reminders()` |
| 035 | `check_all_reminders_job` | ? | `check_personal_reminders()` |
| 058 | `check_all_reminders_job` | */5 * * * * | `process_all_reminders()` |
| 059 | `master_reminder_job` | */2 * * * * | `process_all_reminders()` |
| 083 | `master_reminder_job` | ? | `process_all_reminders()` |
| 103 | `master_reminder_job` | */2 * * * * | `process_all_reminders()` |

**Risiko:**
- Jika migration tidak dijalankan berurutan, bisa ada **MULTIPLE JOBS RUNNING**
- Function `process_all_reminders()` dipanggil **2x, 3x, atau lebih** setiap 2 menit
- User dapat **NOTIFIKASI GANDA** atau bahkan **TRIPLE!**

**Contoh Skenario Buruk:**
```
08:00 - Cron Job #1 jalan → Kirim notifikasi shift jam 8:10
08:00 - Cron Job #2 jalan → Kirim notifikasi shift jam 8:10 LAGI!
08:00 - Cron Job #3 jalan → Kirim notifikasi shift jam 8:10 LAGI!!

Result: User dapat 3 notifikasi identik! 😱
```

**Evidence dari Code:**
```sql
-- Migration 103 (line 130-132)
FOR r IN SELECT jobid FROM cron.job 
WHERE jobname IN ('master_reminder_job', 'check_shift_reminders_job', 'check_all_reminders_job') 
LOOP
    PERFORM cron.unschedule(r.jobid);
END LOOP;
```

✅ Ini bagus! Tapi hanya bersihkan 3 nama. Kalau ada job lain dengan nama berbeda?

---

### 2. ⚠️ MASALAH MEDIUM: Agenda Reminder Loop Risk

**Lokasi:** `migration/105_fix_agenda_notifications.sql` (line 43-49)

**Kondisi Pencegahan Duplikasi:**
```sql
AND NOT EXISTS (
    SELECT 1 FROM notifications n 
    WHERE n.user_id = ap.user_id 
    AND n.type = 'push_reminder_agenda' 
    AND n.created_at::date = v_now_timestamp::date
    AND n.message LIKE '%' || a.title || '%'  -- ⚠️ BERBAHAYA!
)
```

**Risiko:**
- Kondisi `LIKE '%title%'` bisa **GAGAL** jika:
  - Title berubah sedikit (typo fix)
  - Title punya karakter spesial
  - Title sangat pendek (misal: "Rapat")
- Jika gagal, reminder akan **TERKIRIM BERULANG** setiap 2 menit!

**Contoh Skenario Buruk:**
```
08:00 - Agenda "Rapat" jam 08:15 → Kirim reminder
08:02 - Cek lagi, title match tapi ada agenda lain "Rapat Pagi" → Kirim LAGI!
08:04 - Kirim LAGI!
...infinite loop sampai jam 08:15
```

**Rekomendasi:**
Gunakan `agenda_id` untuk tracking yang lebih presisi!

---

### 3. ⚠️ MASALAH MEDIUM: Personal Reminder tanpa Flag Protection

**Lokasi:** `migration/105_fix_agenda_notifications.sql` (line 159-179)

**Query:**
```sql
SELECT * FROM personal_reminders
WHERE 
    remind_at IS NOT NULL
    AND is_notified = false 
    AND is_completed = false
    AND remind_at <= v_now_timestamp
    AND remind_at >= (v_now_timestamp - interval '24 hours')
```

**Lalu:**
```sql
UPDATE personal_reminders SET is_notified = true WHERE id = v_record.id;
```

**Risiko:**
- Jika UPDATE gagal (error, rollback, timeout), flag `is_notified` tetap `false`
- Cron job berikutnya akan **mengirim notifikasi LAGI**
- User dapat reminder yang sama **berkali-kali**

**Rekomendasi:**
Gunakan transaction atau row-level lock!

---

### 4. ✅ AMAN: Database Triggers

**Triggers yang Ada:**

1. **`tr_send_push_on_notification`** (migration 101)
   - Trigger: `AFTER INSERT ON notifications`
   - Action: Panggil Edge Function via HTTP
   - ✅ **AMAN** - Tidak insert ke notifications lagi

2. **`on_notification_insert_send_push`** (migration 039)
   - Trigger: `AFTER INSERT ON notifications`
   - Action: Hanya LOG
   - ✅ **AMAN** - Tidak insert ke notifications lagi

3. **`tr_notify_participant_new_agenda`** (migration 105)
   - Trigger: `AFTER INSERT ON agenda_participants`
   - Action: Insert 1x ke notifications
   - ✅ **AMAN** - Tidak insert ke agenda_participants lagi

**Kesimpulan:** Tidak ada recursive trigger! 👍

---

## 🛠️ REKOMENDASI PERBAIKAN

### Priority 1: SEGERA! Cleanup Cron Jobs

```sql
-- Run this ASAP to clean ALL reminder jobs
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remove ALL cron jobs related to reminders
    FOR r IN 
        SELECT jobid, jobname 
        FROM cron.job 
        WHERE jobname LIKE '%reminder%' 
           OR jobname LIKE '%shift%'
           OR jobname LIKE '%personal%'
           OR jobname LIKE '%agenda%'
    LOOP
        RAISE NOTICE 'Removing cron job: % (ID: %)', r.jobname, r.jobid;
        PERFORM cron.unschedule(r.jobid);
    END LOOP;
END $$;

-- Schedule only ONE master job
SELECT cron.schedule(
    'master_reminder_job_v2',  -- New name to avoid conflicts
    '*/2 * * * *', 
    'SELECT process_all_reminders()'
);
```

### Priority 2: Fix Agenda Reminder Duplication

```sql
-- Add tracking table for sent reminders
CREATE TABLE IF NOT EXISTS sent_agenda_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    agenda_id UUID NOT NULL REFERENCES agendas(id),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, agenda_id, sent_at::date)
);

-- Update check_agenda_reminders() to use tracking table
-- Change NOT EXISTS condition from message LIKE to tracking table check
```

### Priority 3: Add Transaction Safety to Personal Reminders

```sql
-- Modify process_all_reminders() to use row-level lock
FOR v_record IN 
    SELECT * FROM personal_reminders
    WHERE ...
    FOR UPDATE SKIP LOCKED  -- ← Add this!
LOOP
    INSERT INTO notifications ...;
    UPDATE personal_reminders SET is_notified = true WHERE id = v_record.id;
END LOOP;
```

---

## 📈 Monitoring Checklist

Untuk mendeteksi jika loop terjadi:

```sql
-- Query 1: Check for duplicate notifications (same user, same message, same day)
SELECT 
    user_id, 
    title, 
    DATE(created_at) as date,
    COUNT(*) as count
FROM notifications
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY user_id, title, DATE(created_at)
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Query 2: Check active cron jobs
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE jobname LIKE '%reminder%'
ORDER BY jobname;

-- Query 3: Check notification rate (should be steady, not increasing)
SELECT 
    DATE(created_at) as date,
    type,
    COUNT(*) as count
FROM notifications
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), type
ORDER BY date DESC, type;
```

---

## ⏰ Timeline Rekomendasi

1. **Sekarang (Urgent):** Jalankan cleanup cron jobs
2. **Hari ini:** Add tracking table untuk agenda reminders
3. **Minggu ini:** Add transaction safety
4. **Ongoing:** Monitor dengan queries di atas

---

## 📝 Checklist Action Items

- [ ] Backup database sebelum cleanup
- [ ] Run query untuk cek active cron jobs saat ini
- [ ] Jalankan cleanup script
- [ ] Verify hanya ada 1 cron job aktif
- [ ] Test notifikasi (tidak ganda)
- [ ] Deploy tracking table untuk agenda
- [ ] Update function dengan FOR UPDATE SKIP LOCKED
- [ ] Setup monitoring weekly
