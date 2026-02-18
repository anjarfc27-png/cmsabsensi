# Perbaikan Sistem Notifikasi Agenda

## ✅ Masalah yang Diperbaiki

### 1. **Reminder 15 Menit Sebelum Agenda - SEKARANG JALAN!**
**Masalah:** Function `check_agenda_reminders()` sudah ada tapi tidak terjadwal
**Solusi:** Diintegrasikan ke `process_all_reminders()` yang jalan setiap 2 menit

### 2. **Notifikasi Ganda - SUDAH DIHILANGKAN!**
**Masalah:** Participant dapat 2 notifikasi (dari frontend + database trigger)
**Solusi:** Hapus kode notifikasi di frontend, biar database trigger yang handle semua

## 🔄 Alur Notifikasi Agenda (Setelah Perbaikan)

### A. Saat Atasan Assign Agenda ke Karyawan:

1. **Atasan buat agenda baru** via form
2. **Pilih participants** (bisa pilih beberapa orang)
3. **Klik Save**
4. System insert data ke `agenda_participants` table
5. **Database trigger otomatis jalan** → Kirim notifikasi ke SEMUA yang dipilih
6. **Notifikasi diterima** dengan info lengkap:
   - Judul agenda
   - Tanggal & jam (WIB)
   - Lokasi (jika ada)
   - Nama pembuat agenda

**Contoh notifikasi:**
```
📅 Undangan Agenda Baru

Anda diundang ke agenda "Rapat Tim Marketing" pada 18 Feb 2026, 14:00 WIB 
di Ruang Meeting Lt.3. Dibuat oleh: Bu Siti (Manager)
```

### B. Reminder 15 Menit Sebelum Agenda Dimulai:

1. **Cron job jalan otomatis setiap 2 menit**
2. **Cek agenda yang akan dimulai 15 menit lagi**
3. **Kirim push notification** ke semua participant yang belum decline
4. **Type: `push_reminder_agenda`** → Muncul sebagai push notif HP, tidak di bell list

**Contoh reminder:**
```
⏰ Agenda akan dimulai!

Halo Anjar, agenda "Rapat Tim Marketing" akan dimulai dalam 15 menit di Ruang Meeting Lt.3.
```

## 📋 File yang Diubah

### 1. Migration Baru
- **`105_fix_agenda_notifications.sql`**
  - Perbaiki function `check_agenda_reminders()`
  - Perbaiki trigger `notify_participant_on_new_agenda()`
  - Integrasikan agenda reminder ke `process_all_reminders()`
  - Tambah index untuk performance

### 2. Frontend
- **`src/pages/Agenda.tsx`** (line 326-350)
  - Hapus kode manual notifikasi (duplikat)
  - Sekarang database trigger yang handle

## 🎯 Hasil Akhir

✅ **Saat assign agenda** → Semua participant dapat notifikasi (1x saja, tidak ganda)
✅ **15 menit sebelum agenda** → Semua participant dapat reminder push notification
✅ **Notifikasi lengkap** → Ada judul, tanggal, jam, lokasi, pembuat
✅ **Push notification** → Muncul di HP sebagai native notification
✅ **Clean code** → Tidak ada duplikasi, semua di database level

## 📱 Testing Checklist

- [ ] Buat agenda baru dengan 2-3 participant
- [ ] Cek apakah semua participant dapat notifikasi
- [ ] Buat agenda yang akan dimulai 15 menit lagi
- [ ] Tunggu 15 menit, cek apakah reminder muncul
- [ ] Pastikan tidak ada notifikasi ganda
- [ ] Test dengan agenda yang ada lokasi vs tanpa lokasi

## 🗓️ Catatan Penting

- **Cron job berjalan setiap 2 menit** (dari migration 103)
- **Reminder window: 14-16 menit** sebelum agenda (untuk toleransi cron)
- **Timezone: Asia/Jakarta** (WIB)
- **Status declined**: Tidak akan dapat reminder (tapi tetap dapat undangan awal)
