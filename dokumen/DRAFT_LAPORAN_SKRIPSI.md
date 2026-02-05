# LAPORAN PENGEMBANGAN APLIKASI
# CMS ABSENSI & HRIS ENTERPRISE ("DUTA MRUPUT")

## KATA PENGANTAR
*(Berisi ucapan syukur dan terima kasih kepada pihak yang membantu)*

---

## BAB 1: PENDAHULUAN

### 1.1 Latar Belakang
- Jelaskan masalah awal: Pencatatan absensi yang mungkin masih manual/kurang akurat, atau kebutuhan sistem yang terintegrasi di perusahaan.
- Jelaskan solusi: Mengembangkan sistem absensi berbasis web & mobile (PWA) yang modern dengan validasi biometrik (Wajah) dan lokasi (GPS) untuk meminimalisir kecurangan.
- Tekankan bahwa aplikasi ini dibangun **dari nol (from scratch)** untuk memastikan kustomisasi penuh sesuai kebutuhan operasional.

### 1.2 Rumusan Masalah
1. Bagaimana membangun sistem absensi yang aman dari manipulasi lokasi dan identitas?
2. Bagaimana mengintegrasikan sistem absensi dengan penggajian (payroll) secara otomatis?
3. Bagaimana menyajikan performa aplikasi yang cepat meski memuat fitur berat (AI Face Recognition)?

### 1.3 Tujuan Pengembangan
1. Menghasilkan aplikasi absensi real-time dengan validasi ganda (Wajah & Lokasi).
2. Tuntaskan masalah perhitungan gaji manual dengan fitur Payroll otomatis.
3. Menyediakan dashboard monitoring karyawan untuk HR/Manager.

### 1.4 Batasan Masalah
- Fokus platform: Web Based & PWA (Bisa diinstall di HP Android/iOS).
- Teknologi: React TS, Supabase, MediaPipe.

---

## BAB 2: LANDASAN TEORI & TEKNOLOGI

### 2.1 Stack Teknologi (Tech Stack)
Jelaskan alasan pemilihan teknologi ini:
- **Frontend:** React + TypeScript + Vite (Cepat, modern, type-safe).
- **UI Framework:** Tailwind CSS + Shadcn/UI (Estetik, konsisten, responsif).
- **Backend & Database:** Supabase (PostgreSQL) (Realtime, aman, scalable).
- **AI & Biometrik:** Google MediaPipe & Face-api.js (Deteksi wajah sisi klien yang cepat tanpa membebani server).
- **Peta:** Leaflet (Open source maps).
- **Build Tool:** Vite (Optimasi bundle size).

---

## BAB 3: ANALISIS DAN PERANCANGAN SISTEM

### 3.1 Analisis Kebutuhan Pengguna (User Requirement)
- **Role Karyawan:** Bisa absen masuk/pulang, lihat slip gaji, ajukan cuti/izin.
- **Role Admin/HR:** Kelola data karyawan, setujui cuti, generate payroll, monitoring lokasi tim.
- **Role Manager:** Approval berjenjang (opsional).

### 3.2 Perancangan Database (Schema)
Jelaskan tabel-tabel inti yang dibuat di Supabase (sebutkan relasinya secara singkat):
- `profiles`: Data karyawan (termasuk foto wajah, jabatan).
- `attendance_logs`: Riwayat absen (jam, koordinat, foto).
- `payroll_periods` & `payroll_details`: Data penggajian.
- `leaves`: Data pengajuan cuti.

### 3.3 Alur Proses Utama (Flowchart)
*(Anda bisa deskripsikan alurnya)*
1. **Flow Absensi:** Buka App -> Validasi Radius Lokasi -> Deteksi Wajah (Liveness) -> Capture -> Simpan ke DB.
2. **Flow Payroll:** Admin pilih periode -> Sistem hitung hadir/lembur -> Generate Slip Gaji.

---

## BAB 4: IMPLEMENTASI DAN PEMBAHASAN
*(Ini inti "build from scratch" Anda)*

### 4.1 Implementasi Antarmuka (UI/UX)
Tampilkan screenshot hasil kerja Anda:
- **Halaman Login:** Desain clean, support PWA.
- **Dashboard:** Widget ringkasan kehadiran hari ini.
- **Halaman Absensi:** Tampilan kamera + peta.
- **Laporan/Tabel:** Fitur export Excel/PDF yang sudah dibuat.

### 4.2 Fitur Unggulan & Tantangan Teknis
Ceritakan "kemenangan" teknis Anda di sini:
1. **Integrasi AI Wajah:** Menggunakan MediaPipe untuk deteksi titik wajah akurat di browser.
2. **Optimasi Performa:**
   - Tantangan: Ukuran library AI dan Excel sangat besar mengakibatkan loading lama.
   - Solusi: Melakukan **Code Splitting & Chunking** pada `vite.config.ts`. Memisahkan vendor (AI, Maps, Excel) dari kode utama (`index.js`), sehingga aplikasi tetap ringan.
3. **Geo-Fencing:** Logika untuk membatasi radius absen hanya di kantor (menggunakan `Haversine formula` atau library geolokasi).

### 4.3 Pengujian (Testing)
- **Fungsional:** Coba absen di luar radius -> Gagal (Sukses).
- **Build Production:** Menjalankan `npm run build` berhasil dengan manajemen chunk yang baik.

### 4.4 Analisis Kritis Arsitektur Sistem
Pada bagian ini, dilakukan evaluasi kritis dan objektif terhadap keputusan arsitektur yang diambil. Tidak ada sistem yang sempurna; pemilihan teknologi selalu berbicara tentang *trade-off* (pertukaran untung-rugi).

#### 4.4.1 Backend: Mengapa Supabase (BaaS) dan Bukan Backend Konvensional (Laravel/Node.js)?
Dalam pengembangan konvensional, kita biasanya membangun API Server sendiri (Middleware) menggunakan Laravel atau Express.js untuk menjembatani Database dan Frontend. Namun, sistem ini memilih **Supabase** (Backend-as-a-Service).

*   **Analisis Keputusan:**
    *   **Kecepatan vs Kontrol:** Menggunakan Supabase memangkas waktu pengembangan backend hingga 60%. Kita tidak perlu menulis kode CRUD (*Create, Read, Update, Delete*) repetitif karena Supabase menyediakan API otomatis via *postgREST*. Namun, trade-off-nya adalah **kurangnya kontrol logika prosedural** yang rumit. Jika menggunakan Laravel, kita bisa membuat logic kompleks di Controller; di Supabase, kita harus memindahkannya ke Database Function (PL/pgSQL) atau Edge Functions yang debugging-nya lebih sulit.
    *   **Isu Keamanan (Logic Leak):** Karena frontend mengakses database "secara langsung" menggunakan client library, logika bisnis cenderung terekspos di sisi klien. Keamanan sistem ini **sangat bergantung pada RLS (Row Level Security)**. Jika konfigurasi RLS salah sedikit saja di level database, data seluruh perusahaan bisa bocor. Ini berbeda dengan Laravel, di mana logic tertutup rapat di server.
    *   **Vendor Lock-in:** Sistem ini sangat bergantung pada ekosistem Supabase. Migrasi keluar dari Supabase akan sangat menyakitkan karena harus menulis ulang seluruh layer autentikasi dan API.

#### 4.4.2 Frontend: Beban Komputasi di Sisi Klien (React SPA)
Aplikasi ini dikembangkan sebagai Single Page Application (SPA) dengan React. Berbeda dengan pendekatan server-side rendering (SSR) atau PHP konvensional, beban rendering halaman terjadi di browser pengguna.

*   **Penyalahgunaan Client Resource:**
    *   Fitur deteksi wajah menggunakan **MediaPipe** dan **Face-api.js** berjalan sepenuhnya di browser/perangkat pengguna. Ini adalah keputusan berisiko. Untuk HP *flagship*, ini sangat cepat. Namun, untuk HP *low-end* (RAM < 3GB), proses ini bisa menyebabkan *lag* signifikan atau bahkan *crash* browser.
    *   Berbeda jika kita menggunakan API Face Recognition di server (Python/Flask backend), beban HP pengguna ringan, tetapi server kita yang akan jebol biayanya (biaya GPU server mahal). Ini adalah keputusan ekonomi: membebankan performa ke device user untuk menghemat biaya server.
    *   Selain itu, bundle size aplikasi JavaScript cenderung membengkak seiring bertambahnya fitur. Walaupun sudah dioptimasi dengan Vite, inisialisasi awal aplikasi tetap memakan waktu lebih lama dibanding aplikasi server-rendered sederhana.

#### 4.4.3 Mobile: Hybrid (Capacitor) vs Native (Kotlin/Swift)
Aplikasi mobile dihasilkan melalui Capacitor (Webview wrapper). Secara kasarnya, ini adalah "website yang dibungkus aplikasi".

*   **Kritik Kualitas UX:**
    *   Meski pengembangan lebih cepat (satu kode untuk Web, Android, iOS), performanya **tidak akan pernah bisa menyamai aplikasi Native murni**. Transisi antar halaman, respon sentuhan, dan akses hardware (kamera/GPS) memiliki delay milidetik yang terasa kurang "snappy" dibandingkan aplikasi native Kotlin atau Swift.
    *   Masalah kompatibilitas hardware sering terjadi. Modul kamera webview kadang berperilaku berbeda di Samsung, Xiaomi, dan Oppo karena manajemen memori webview yang berbeda-beda tiap vendor Android.

#### 4.4.4 Kenapa "Modern Stack" Dipilih? (Justifikasi Kritis)
Kenapa sistem tidak menggunakan Laravel yang sudah matang dan stabil?

1.  **Reaktivitas (Realtime):** Sistem absensi membutuhkan data realtime (misal: HR melihat siapa yang absen detik ini). Supabase memiliki fitur *Realtime Subscription* bawaan. Di Laravel, kita harus setup Websocket server terpisah (Pusher/Reverb) yang menambah kompleksitas maintenance server.
2.  **Serverless Scalability:** Aplikasi ini di-hosting secara serverless. Jika tiba-tiba ada 1000 karyawan absen bersamaan di jam 8 pagi, arsitektur ini lebih tahan banting (scalable) karena Supabase menghandle load balancing database, dan frontend dilayani via CDN static. Infrastruktur VPS tunggal (Laravel tradisional) rentan *down* saat traffic spike kecuali dikonfigurasi dengan Load Balancer yang mahal.
3.  **State Management:** React sangat unggul dalam menangani state kompleks (seperti data formulir bertingkat, peta interaktif, dan kamera aktif bersamaan) dibandingkan jQuery atau Vanilla JS yang biasa dipakai di Laravel Blade.

**Kesimpulan Teknis:**
Arsitektur ini mengorbankan **kesederhanaan backend** dan **performa perangkat low-end** demi mendapatkan **kecepatan pengembangan**, **skalabilitas serverless**, dan **interaktivitas tinggi**. Ini adalah solusi modern yang efisien biaya (cost-efficient) namun menuntut kedisiplinan tinggi dalam manajemen security database (RLS) dan optimalisasi kode frontend.

---

## BAB 5: PENUTUP

### 5.1 Kesimpulan
- Aplikasi berhasil dibangun dari nol dan mencakup seluruh siklus bisnis HR (Absen sampai Gaji).
- Penggunaan teknologi modern (Vite + Supabase) membuat pengembangan efisien dan performa tinggi.
- Implementasi AI di sisi client berhasil mengurangi beban server.

### 5.2 Saran
- Pengembangan fitur Mobile Native (React Native/Flutter) kedepannya.
- Integrasi notifikasi via WhatsApp Gateway.

---

## LAMPIRAN
- Struktur Folder Project.
- Script SQL / Schema Database penting.
