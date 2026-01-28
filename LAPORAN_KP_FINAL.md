# LAPORAN AKHIR KERJA PRAKTIK (KP)
# RANCANG BANGUN SISTEM INFORMASI ABSENSI BIOMETRIK BERBASIS PWA DAN HYBRID ARTIFICIAL INTELLIGENCE
## (STUDI KASUS: MIGRASI DARI ABSENSI FINGERPRINT ANALOG KE DIGITAL CLOUD)

**Disusun Oleh:** [Nama Mahasiswa]  
**NIM:** [Nomor Induk Mahasiswa]  
**Jabatan:** Lead Fullstack Engineer (Intern)  
**Tanggal:** 28 Januari 2026  

---

## DAFTAR ISI
1.  **BAB I: PENDAHULUAN & ANALISIS SITUASIONAL**
    *   1.1 Latar Belakang: Keterbatasan Infrastruktur Legacy
    *   1.2 Identifikasi Masalah Kritis
    *   1.3 Solusi Teknis yang Diusulkan
2.  **BAB II: LANDASAN TEORI & ARSITEKTUR TEKNOLOGI**
    *   2.1 Paradigma *Modern Web App* (PWA)
    *   2.2 Arsitektur Backendless (Supabase vs Traditional REST API)
    *   2.3 Client-Side AI: Mengapa MediaPipe?
3.  **BAB III: ANALISIS DAN PERANCANGAN SISTEM**
    *   3.1 Analisis Kebutuhan Fungsional
    *   3.2 Arsitektur Basis Data & Keamanan (RLS)
    *   3.3 Desain Alur Logika (Business Logic)
4.  **BAB IV: IMPLEMENTASI TEKNIS (ENGINEERING DEEP DIVE)**
    *   4.1 Frontend Architecture (React + Vite)
    *   4.2 Strategi *Hybrid AI Engine* & Anti-Spoofing
    *   4.3 Mekanisme Anti-Fraud Geofencing yang Ketat
    *   4.4 Tantangan & Trade-Off Arsitektur
5.  **BAB V: PENGUJIAN DAN ANALISIS HASIL**
    *   5.1 Pengujian Black Box & Validasi User
    *   5.2 Analisis Performa (Lighthouse Score)
6.  **BAB VI: KESIMPULAN & REFLEKSI KRITIS**

---

## BAB I: PENDAHULUAN & ANALISIS SITUASIONAL

### 1.1 Latar Belakang: Keterbatasan Infrastruktur Legacy (Hardware Fingerprint)
Saat ini, perusahaan sepenuhnya bergantung pada mesin absensi sidik jari (*Hardware Fingerprint*) konvensional. Berdasarkan observasi lapangan dan analisis operasional, sistem ini memiliki kelemahan fundamental yang menghambat efisiensi perusahaan modern:

1.  **Sifat Terpusat (Centralized Bottleneck):** Karyawan harus mengantre di satu titik fisik untuk melakukan absensi. Hal ini menciptakan antrean panjang pada jam sibuk (07:55 - 08:05), membuang waktu produktif.
2.  **Keterbatasan Mobilitas:** Mesin fisik tidak dapat mengakomodasi karyawan yang bekerja secara *remote* (WFH), dinas luar kota, atau tim lapangan (Sales/Kurir). Data kehadiran mereka menjadi "Blind Spot" bagi manajemen HR, memaksa rekapitulasi manual yang rentan *human error*.
3.  **Isu Pemeliharaan & Sinkronisasi:** Penarikan data dari mesin ke komputer HR dilakukan secara manual via USB/LAN. Data tidak *real-time*. Kerusakan mesin berarti kehilangan seluruh data kehadiran tanpa *backup* otomatis.
4.  **Inefisiensi Biaya (CAPEX):** Ekspansi kantor cabang baru mewajibkan pembelian perangkat keras baru, kabel, dan instalasi teknisi.

### 1.2 Identifikasi Masalah Kritis
Dari latar belakang di atas, dirumuskan masalah utama:
*"Bagaimana mentransformasi proses absensi fisik menjadi digital yang akurat, real-time, dan hemat biaya tanpa mengorbankan keamanan validasi kehadiran yang selama ini dijamin oleh sidik jari?"*

### 1.3 Solusi Teknis yang Diusulkan: "Duta Mruput Enterprise"
Solusi yang dikembangkan adalah sistem berbasis perangkat lunak (*Software-Based*) dengan pendekatan **Bring Your Own Device (BYOD)**. Karyawan menggunakan perangkat pribadi untuk absensi. Untuk menjawab tantangan keamanan (trust issue), diterapkan **Multi-Factor Authentication (MFA)**:
1.  **Something You Are (Biometrik):** Face Recognition berbasis AI.
2.  **Where You Are (Lokasi):** Geofencing GPS Presisi Tinggi.
3.  **What You Have (Perangkat):** Device Fingerprinting (UUID) untuk mencegah titip absen ("joki").

---

## BAB II: LANDASAN TEORI & ARSITEKTUR TEKNOLOGI

### 2.1 Paradigma Progressive Web App (PWA) vs Native Mobile
Keputusan menggunakan PWA dibanding Native App (Android/iOS) murni didasarkan pada strategi *Time-to-Market* dan kendala administratif:
1.  **Bypass Birokrasi Store:** Pendaftaran akun developer Google Play ($25) dan Apple App Store ($99) membutuhkan verifikasi legalitas (D-U-N-S Number) yang memakan waktu minggu hingga bulan. PWA memungkinkan distribusi instan via URL tanpa menunggu *approval* pihak ketiga.
2.  **Single Codebase:** Menggunakan React/TypeScript memungkinkan satu basis kode berjalan di Web, Android, dan iOS sekaligus. Efisiensi sumber daya tim (intern) 3x lipat dibanding mengembangkan 3 aplikasi terpisah.

### 2.2 Arsitektur Backendless (Supabase) vs Traditional REST API (Laravel/Express)
Dalam proyek ini, saya mengambil keputusan arsitektural radikal: **Tidak membangun Custom REST API**.

**Mengapa tidak menggunakan Laravel/Node.js + VPS?**
Membangun backend tradisional membutuhkan konfigurasi Server (VPS), manajemen OS (Linux), setup Database, dan penulisan *boilerplate code* (Controller, Model, Route) untuk setiap endpoint CRUD. Untuk tim kecil/tunggal, ini adalah *overhead* yang sangat besar. 80% waktu akan habis untuk *setup*, bukan *feature development*.

**Solusi: Backend-as-a-Service (BaaS) dengan Supabase**
Saya menggunakan Supabase yang menyediakan PostgreSQL yang "dibungkus" otomatis dengan API (PostgREST).
*   **Direct-to-DB**: Frontend berkomunikasi langsung dengan Database.
*   **Keamanan (The Critical Part)**: Karena tidak ada API Middleware buatan sendiri, keamanan sepenuhnya bergantung pada **Row Level Security (RLS)** di PostgreSQL. Ini adalah pedang bermata dua: Konfigurasi RLS yang salah akan mengekspos seluruh database, namun jika benar, ini jauh lebih aman karena validasi terjadi di level data terkecil.
*   **Real-time Native**: Supabase menyediakan fitur *Subscribe* ke perubahan data database via WebSocket, memungkinkan dashboard HRD terupdate otomatis saat ada karyawan absen, tanpa perlu *polling* server (hemat bandwidth).

### 2.3 Client-Side AI: Mengapa MediaPipe?
Alih-alih mengirim foto ke server untuk diproses (Server-side Processing), sistem ini menggunakan **Edge AI**.
*   **Privacy-First**: Wajah diproses di HP pengguna menggunakan TensorFlow/MediaPipe WASM. Yang dikirim ke server hanyalah *vektor matematika* (Face Descriptor), bukan foto mentah (kecuali bukti visual).
*   **Cost-Efficiency**: Server tidak dibebani komputasi berat AI. Biaya server menjadi sangat murah karena hanya menyimpan data teks (JSON).

---

## BAB III: ANALISIS DAN PERANCANGAN SISTEM

### 3.1 Analisis Kebutuhan Fungsional
1.  **Core Attendance**: Clock-In/Out dengan validasi Geolocation + Face Match > 0.40 Threshold.
2.  **Anti-Spoofing Level 1**: Deteksi *Liveness* (Kedipan mata/Gerakan) untuk mencegah foto dipalsukan dengan foto lain.
3.  **Adaptive Geofencing**: Sistem menolak absensi jika GPS Accuracy > 50 meter (sinyal buruk dianggap tidak valid).
4.  **Offline-First**: Aplikasi tetap bisa dibuka (via Service Worker) saat offline, meski absensi tetap membutuhkan sinyal untuk sinkronisasi waktu server (mencegah manipulasi jam lokal HP).

### 3.2 Arsitektur Basis Data & Keamanan
Struktur PostgreSQL dirancang sederhana namun ketat:
*   `profiles`: Metadata karyawan + *Vector Embedding* wajah (Float32Array).
*   `attendances`: Log transaksi.
*   **RLS Policy Kritis**:
    *   `profiles`: User hanya bisa UPDATE profilnya sendiri. Admin bisa baca semua.
    *   `attendances`: User hanya bisa INSERT (absen). Tidak bisa UPDATE/DELETE log sejarah (kekekalan data/audit trail).

---

## BAB IV: IMPLEMENTASI TEKNIS (ENGINEERING DEEP DIVE)

### 4.1 Frontend Architecture (React + Vite)
Dibangun di atas ekosistem React 18 menggunakan **Vite** sebagai *build tool* (karena Webpack terlalu lambat). UI Library menggunakan **Shadcn UI** (berbasis Radix Primitives) yang memberikan aksesibilitas (A11y) standar internasional dan kontrol penuh atas styling via Tailwind CSS, berbeda dengan Bootstrap/MUI yang terlalu "opiniated" dan sulit dicustom.

### 4.2 Strategi Hybrid AI Engine (Google MediaPipe)
Implementasi pengenalan wajah menggunakan library `@mediapipe/tasks-vision`.
*   **Proses Deteksi**: Kamera -> Canvas Frame -> Face Landmarker (478 titik wajah).
*   **Ekstraksi Fitur**: Wajah yang terdeteksi diubah menjadi array angka (Embedding).
*   **Pencocokan**: Menggunakan *Cosine Similarity*.
    *   Score 1.0 = Identik Sampurna.
    *   Score > 0.4 = Match (Threshold yang dipilih untuk menyeimbangkan akurasi dan toleransi pencahayaan).
    *   Score < 0.4 = Rejected.

**Analisis Kritis AI**: Library lama `face-api.js` juga disertakan dalam dependensi sebagai cadangan, namun performanya jauh di bawah MediaPipe (WASM). MediaPipe menggunakan GPU Hardware Acceleration di browser, membuat deteksi wajah berjalan 30+ FPS di HP mid-range, sedangkan face-api.js sering *lagging*.

### 4.3 Mekanisme Anti-Fraud Geofencing yang Ketat
Kelemahan terbesar absensi HP adalah "Fake GPS". Sistem memitigasi ini dengan logika berlapis di `useGeolocation.ts`:
1.  **Native Check**: Di Android (via Capacitor), sistem mengecek flag `isMocked` dari OS.
2.  **Heuristik Logic (Web)**:
    *   **Speed Check**: Jika perpindahan koordinat > 50m/detik (mustahil bagi manusia), dianggap Fake GPS.
    *   **Inconsistency Check**: Jika akurasi GPS terlalu sempurna (misal: tepat 1 meter terus menerus), dicurigai sebagai injeksi software.
3.  **Radius Lock**: Tombol absensi secara fisik *disabled* di UI sampai jarak < Radius Kantor.

### 4.4 Trade-Off Arsitektur (Kekurangan Sistem)
Sebagai insinyur perangkat lunak, harus diakui sistem ini memiliki batasan:
1.  **Ketergantungan Internet**: Validasi lokasi dan jam server mewajibkan koneksi internet. Tidak bisa *fully offline* seperti mesin fingerprint.
2.  **Isu Privasi Browser**: Di iOS (iPhone), akses kamera via browser (PWA) seringkali diblokir oleh OS jika website tidak memiliki sertifikat HTTPS yang valid atau user salah menekan "Block Permission". User Friction lebih tinggi dibanding Native App.

---

## BAB V: PENGUJIAN DAN ANALISIS HASIL

### 5.1 Tabel Uji Kebenaran (Truth Table)
Pengujian dilakukan pada Samsung Galaxy A54 (Android) dan iPhone 11 (iOS).

| Skenario Uji | Harapan Sistem | Hasil Aktual | Status |
| :--- | :--- | :--- | :--- |
| **Normal Clock-In** | Sukses, Simpan ke DB | Sukses (Latency ~1.2s) | ✅ PASS |
| **Fake GPS Aktif** | Tombol Terkunci / Error Mock | Terdeteksi di Android, Web Partial | ⚠️ PARTIAL |
| **Wajah Orang Lain** | Ditolak (Score < 0.4) | Ditolak (Score rata-rata 0.15) | ✅ PASS |
| **Foto Wajah (Spoof)** | Ditolak Liveness | Gagal, MediaPipe kadang masih tertipu foto HD | ❌ WEAKNESS |
| **Jarak Jauh (>100m)** | Tombol Terkunci | Terkunci | ✅ PASS |

**Analisis Hasil**: Sistem sangat kuat di validasi lokasi dan identitas dasar, namun deteksi *Liveness* (anti-foto) pada PWA murni masih menjadi tantangan tanpa akses ke sensor *Depth Camera* perangkat keras (IR Camera).

---

## BAB VI: KESIMPULAN & REFLEKSI KRITIS

### 6.1 Kesimpulan
Sistem "Duta Mruput" berhasil membuktikan bahwa teknologi Web Modern (PWA) dan Serverless (Supabase) mampu menggantikan infrastruktur absensi fisik dengan biaya operasional mendekati nol. Migrasi ke Cloud menghilangkan *bottleneck* antrean fisik dan membuka visibilitas data *real-time* bagi manajemen.

### 6.2 Mengapa Tidak Laravel/PHP?
Pemilihan Stack JavaScript (React+Supabase) dibanding PHP (Laravel) terbukti tepat untuk kasus ini karena:
1.  **Developer Experience**: Satu bahasa (TypeScript) untuk Frontend dan Logic Database (Edge Functions), mengurangi *Context Switching*.
2.  **Scalability**: Supabase menangani jutaan request tanpa perlu setup Load Balancer manual (yang diperlukan jika pakai VPS Laravel).
3.  **Real-time**: Fitur *Live Dashboard* HRD yang wajib ada, sangat sulit diimplementasikan di PHP tradisional tanpa service tambahan (Pusher/Redis), namun "gratis" di ekosistem Supabase.

### 6.3 Rekomendasi Pengembangan (Future Work)
Untuk fase selanjutnya, disarankan:
1.  **Geofencing Polygon**: Mengganti radius lingkaran sederhana dengan Polygon map agar lebih akurat menyesuaikan bentuk gedung.
2.  **Native Migration**: Membungkus PWA ini menjadi APK Native sepenuhnya untuk akses API Hardware yang lebih dalam (mencegah Fake GPS 100% dan akses sensor Liveness).
3.  **Integrasi Payroll**: Modul penggajian yang saat ini masih *Mockup* perlu dihubungkan dengan *Payment Gateway* untuk pembayaran gaji otomatis.

---
**Lampiran Dokumen:**
*   Software Requirements Specification (SRS)
*   API Documentation (Auto-generated by Supabase)
*   User Acceptance Test (UAT) Log
