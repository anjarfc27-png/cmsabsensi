# Software Requirements Specification (SRS)
## Project Name: cms absensi - Premium HRIS & Attendance Solution
**Version:** 1.0.0  
**Status:** Industrial Standard Compliant  

---

## 1. Executive Summary
Duta Mruput adalah platform Human Resource Information System (HRIS) modern berbasis Mobile-First yang dirancang untuk mengotomatisasi absensi, manajemen staff, dan penggajian dengan standar keamanan tinggi menggunakan pengenalan wajah (Face Recognition) dan verifikasi lokasi (Geofencing).

---

## 2. System Architecture & Tech Stack
*   **Frontend**: React.js 18 (Vite), TypeScript, Tailwind CSS, Shadcn/UI.
*   **Backend/Database**: Supabase (PostgreSQL) dengan Row Level Security (RLS) tingkat tinggi.
*   **Auth**: Supabase Auth (Email & Password, Metadata handling).
*   **Face AI**: MediaPipe Face Mesh & Iris untuk deteksi wajah dan "Liveness Detection" (Blink detection).
*   **Storage**: Supabase Storage untuk foto absensi dan dokumen lampiran.
*   **Infrastructure**: CI/CD GitHub Actions (untuk build .apk otomatis).

---

## 3. Scope of Features (Functional Requirements)

### 3.1. Core Attendance System
*   **Smart Clock-In/Out**: Verifikasi Multi-Faktor (Lokasi GPS + Face Recognition + Device ID).
*   **Geofencing**: Pembatasan absensi hanya di radius koordinat kantor yang ditentukan.
*   **Anti-Fraud**: Deteksi kedipan mata (Blink Detection) untuk mencegah penggunaan foto statis saat absen.
*   **Work Modes**: Dukungan untuk WFO (Work From Office), WFH (Work From Home), dan Field Work (Dinas Luar).

### 3.2. Role-Based Access Control (RBAC)
*   **Admin HR**: Kendali penuh seluruh karyawan, pengaturan lokasi kantor, manajemen shift, pengumuman, dan payroll perusahaan.
*   **Manager (Unit Head)**:
    *   Melihat absensi, lokasi real-time, dan laporan khusus anggota departemennya.
    *   Otoritas Approval (Cuti, Lembur, Koreksi, Reimbursement) untuk anggota tim.
    *   Manajemen Unit (Update nama/moto departemen).
*   **Employee**: Melakukan absensi, melihat riwayat pribadi, mengajukan permohonan, dan melihat struktur tim internal.

### 3.3. HR Management
*   **Staff Management**: CRUD data karyawan lengkap (NIK, Email, Telepon, Posisi, Departemen).
*   **Organizational Hierarchy**: Visualisasi struktur tim (Struktur Organisasi) per departemen.
*   **Shift & Scheduling**: Pengaturan jadwal kerja fleksibel per individu atau grup.
*   **National Holidays**: Integrasi kalender hari libur nasional untuk otomasi perhitungan hari kerja.

### 3.4. Leave & Request Workflow
*   **Advanced Approvals**: Alur pengajuan Cuti, Lembur, Koreksi Absensi (Lupa Absen), dan Reimbursement.
*   **Real-time Notifications**: Trigger otomatis ke Manager saat ada pengajuan baru, dan notifikasi ke karyawan saat status berubah.

### 3.5. Album & Media (Album Kenangan)
*   **Media Gallery**: Penyimpanan foto dan video kegiatan perusahaan dalam kategori album.
*   **High Definition Support**: Dukungan resolusi asli (HD/4K) tanpa pemotongan kualitas.
*   **Role-Based Media Distribution**:
    *   **Admin HR**: Publikasi media ke seluruh karyawan.
    *   **Manager**: Publikasi media ke anggota departemen atau publik.
    *   **Employee**: Melihat dan mengunduh media original.
*   **Interactive Viewer**: Lightbox premium untuk tampilan visual yang maksimal.

### 3.6. Payroll & Financial
*   **Salary Calculation**: Perhubung gaji berdasarkan data kehadiran, uang makan, dan lembur. (Catatan: Keterlambatan dicatat namun tidak dikenakan denda finansial sesuai kebijakan terbaru).
*   **Digital Salary Slips**: Generate slip gaji PDF/Digital yang dapat diakses karyawan melalui profil.
*   **Financial Reports**: Laporan pengeluaran payroll bulanan untuk manajemen.

### 3.6. Security & Compliance
*   **Device Locking**: Penguncian akun pada satu perangkat fisik (UUID) untuk mencegah absensi titipan.
*   **Row Level Security (RLS)**: Isolasi data di level database (Manager tidak bisa melihat data departemen lain).
*   **Face Encryption**: Penyimpanan deskriptor wajah yang aman.

---

## 4. Non-Functional Requirements
*   **Performance**: Dashboard memuat data dalam < 2 detik (Optimized indexing).
*   **Accessibility**: Responsive Design (Mobile-First) untuk akses mudah via smartphone Android/iOS.
*   **Reliability**: Offline logging (Coming Soon) dan sinkronisasi real-time.
*   **Security**: Implementasi HTTPS, JWT Authentication, dan database triggers untuk integritas data.

---

## 5. Industrial Standardization Points
1.  **Immutability**: Log absensi yang tidak dapat dimanipulasi tanpa jejak audit.
2.  **Scalability**: Struktur database yang mampu menampung ribuan karyawan dengan skema departemen yang dinamis.
3.  **Audit Trail**: Pencatatan setiap perubahan status approval oleh Manager/HR.

---
*Dokumen ini merupakan representasi teknis dari sistem cms absensi per tanggal 21 Januari 2026.*
