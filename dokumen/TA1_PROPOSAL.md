# PROPOSAL TUGAS AKHIR (TA 1)

**JUDUL:**
RANCANG BANGUN SISTEM PRESENSI DAN MANAJEMEN KARYAWAN BERBASIS LOKASI DAN PENGENALAN WAJAH MENGGUNAKAN TEKNOLOGI PROGRESSIVE WEB APPS (PWA) 
(Studi Kasus: PT CMS Duta Solusi)

---

# BAB I
# PENDAHULUAN

## 1.1 Latar Belakang Masalah

PT CMS Duta Solusi adalah perusahaan yang bergerak di bidang solusi teknologi dan alih daya (*outsourcing*). Dalam operasionalnya, perusahaan ini mempekerjakan banyak karyawan yang bekerja di lapangan (sales dan teknisi) serta karyawan yang bekerja di kantor pusat. Saat ini, mekanisme pencatatan kehadiran karyawan masih menggunakan dua metode yang terpisah. Karyawan kantor menggunakan mesin sidik jari (*fingerprint*), sedangkan karyawan lapangan melaporkan kehadiran melalui grup pesan instan (WhatsApp) dengan mengirimkan lokasi terkini (*Share Location*).

Mekanisme tersebut menimbulkan beberapa permasalahan administratif. Pertama, data kehadiran terpecah di dua media yang berbeda, sehingga staf HRD harus melakukan rekapitulasi manual setiap akhir bulan yang memakan waktu lama dan rentan kesalahan manusia (*human error*). Kedua, validasi kehadiran karyawan lapangan sulit dilakukan secara akurat. Fitur berbagi lokasi pada aplikasi pesan instan mudah dimanipulasi menggunakan aplikasi pihak ketiga (*Fake GPS*), sehingga membuka celah kecurangan.

Kebutuhan akan sistem yang terintegrasi dan akurat menjadi mendesak. Sistem berbasis aplikasi *mobile* dianggap sebagai solusi yang tepat karena hampir seluruh karyawan memiliki telepon pintar. Namun, pengembangan aplikasi *native* (Android/iOS) membutuhkan biaya investasi yang cukup besar dan proses perawatan yang rumit. Sebagai alternatif yang lebih efisien, teknologi *Progressive Web Apps* (PWA) memungkinkan sebuah situs web diakses layaknya aplikasi *mobile*, memiliki kemampuan akses perangkat keras seperti kamera dan GPS, namun dengan biaya pengembangan yang lebih rendah dan kompatibilitas lintas platform.

Untuk menjawab kebutuhan validasi yang ketat, sistem ini tidak hanya akan mengandalkan lokasi (*Geofencing*) menggunakan rumus *Haversine*, tetapi juga menerapkan verifikasi biometrik pengenalan wajah (*Face Recognition*) secara *real-time*. Dengan kombinasi validasi lokasi dan wajah, celah kecurangan dapat diminimalisir. Berdasarkan uraian tersebut, maka diusulkan penelitian dengan judul **"Rancang Bangun Sistem Presensi dan Manajemen Karyawan Berbasis Lokasi dan Pengenalan Wajah Menggunakan Teknologi Progressive Web Apps (PWA)"**.

## 1.2 Rumusan Masalah
Berdasarkan identifikasi masalah yang telah diuraikan, rumusan masalah dalam penelitian ini adalah:
1.  Bagaimana merancang sistem presensi terintegrasi yang mampu memvalidasi kehadiran karyawan kantor dan lapangan dalam satu basis data?
2.  Bagaimana menerapkan algoritma rumus *Haversine* untuk membatasi radius lokasi presensi karyawan sesuai titik kantor?
3.  Bagaimana kinerja penerapan pengenalan wajah berbasis web menggunakan *MediaPipe* untuk verifikasi identitas karyawan?

## 1.3 Batasan Masalah
Agar pembahasan peneliti lebih fokus dan terarah, permasalahan dibatasi pada:
1.  Studi kasus penelitian dilakukan pada lingkungan kerja PT CMS Duta Solusi.
2.  Sistem dibangun berbasis web menggunakan *library* React.js dengan konsep PWA (*Progressive Web Apps*).
3.  Pengenalan wajah difokuskan pada pemindaian titik wajah (*Face Mesh*) untuk verifikasi identitas, bukan identifikasi massal.
4.  Fitur lokasi menggunakan GPS perangkat pengguna dengan validasi radius maksimal 50 meter dari titik koordinat kantor.
5.  Sistem hanya menangani pencatatan presensi, pengajuan cuti, dan laporan kehadiran, tidak sampai pada perhitungan pajak PPh 21 yang kompleks.

## 1.4 Tujuan Penelitian
Tujuan yang ingin dicapai dari penelitian ini adalah:
1.  Menghasilkan sebuah sistem informasi manajemen kehadiran yang dapat diakses melalui perangkat *mobile* tanpa proses instalasi yang rumit.
2.  Mengurangi tingkat kecurangan absensi karyawan lapangan melalui validasi ganda (Lokasi dan Wajah).
3.  Meningkatkan efisiensi waktu staf HRD dalam proses rekapitulasi data kehadiran bulanan.

## 1.5 Manfaat Penelitian
**1.5.1 Bagi Penulis**
Menerapkan ilmu rekayasa perangkat lunak yang telah dipelajari, khususnya terkait pengembangan aplikasi web modern dan integrasi API geolokasi.

**1.5.2 Bagi Instansi (PT CMS Duta Solusi)**
Memberikan solusi teknologi yang dapat langsung diterapkan untuk memodernisasi tata kelola administrasi SDM perusahaan, sehingga meningkatkan kedisiplinan dan transparansi data karyawan.

**1.5.3 Bagi Akademis**
Menjadi referensi bagi penelitian selanjutnya yang ingin mengembangkan sistem biometrik berbasis web atau implementasi PWA pada kasus sistem informasi manajemen.

---

# BAB II
# TINJAUAN PUSTAKA

## 2.1 Penelitian Terkait
*(Bagian ini disediakan untuk merangkum 3-5 jurnal referensi yang relevan. Mahasiswa disarankan mencari jurnal terbaru 5 tahun terakhir tentang Sistem Absensi GPS atau Face Recognition)*.

## 2.2 Landasan Teori

### 2.2.1 Sistem Informasi Manajemen SDM
Sistem Informasi Manajemen Sumber Daya Manusia (SIM-SDM) atau *Human Resource Information System* (HRIS) adalah sistem yang dirancang untuk membantu divisi HR dalam merencanakan, mengelola, dan mengawasi aset SDM perusahaan. Fokus utama sistem ini adalah efisiensi administrasi, mulai dari biodata, kehadiran, hingga penggajian.

### 2.2.2 Progressive Web Apps (PWA)
*Progressive Web Apps* (PWA) adalah metodologi pengembangan web yang memberikan pengalaman pengguna (*user experience*) setara aplikasi *native*. PWA memanfaatkan teknologi web modern seperti *Service Worker* untuk memungkinkan aplikasi bekerja secara *offline*, memuat lebih cepat, dan dapat diinstal ke layar utama perangkat (*Add to Home Screen*) tanpa melalui toko aplikasi.

### 2.2.3 Formula Haversine (Haversine Formula)
Formula Haversine adalah persamaan navigasi penting yang digunakan untuk menghitung jarak lingkaran besar (*great-circle distance*) antara dua titik pada bola (bumi) berdasarkan koordinat lintang (*latitude*) dan bujur (*longitude*). Rumus ini digunakan dalam sistem untuk menentukan apakah posisi karyawan berada di dalam radius toleransi kantor.

### 2.2.4 MediaPipe Face Mesh
MediaPipe Face Mesh adalah solusi pembelajaran mesin (*machine learning*) yang dikembangkan oleh Google untuk mendeteksi arsitektur wajah. Solusi ini mampu memetakan 468 titik 3D pada permukaan wajah manusia secara *real-time*. Keunggulan utama MediaPipe adalah kemampuannya berjalan lancar di perangkat *mobile* (CPU) tanpa memerlukan akselerasi *hardware* grafis yang berat, sehingga cocok untuk implementasi berbasis web.

---

# BAB III
# METODE PENELITIAN

## 3.1 Objek Penelitian
Penelitian ini dilakukan di PT CMS Duta Solusi yang berlokasi di [Alamat Kantor]. Objek utama yang diteliti adalah proses bisnis pencatatan kehadiran dan pengelolaan data karyawan. Data yang digunakan meliputi data simulasi karyawan, koordinat lokasi kantor, dan aturan jam kerja perusahaan.

## 3.2 Metode Pengembangan Sistem
Metode pengembangan perangkat lunak yang digunakan adalah **Prototype**. Metode ini dipilih karena kebutuhan fitur yang spesifik (deteksi wajah dan lokasi) memerlukan uji coba berulang untuk mendapatkan akurasi yang diinginkan. Tahapan metode Prototype meliputi:

1.  **Pengumpulan Kebutuhan (*Communication*)**: Melakukan wawancara dengan manajer HRD untuk memahami masalah absensi manual.
2.  **Perancangan Cepat (*Quick Plan*)**: Membuat sketsa antarmuka dan alur logika validasi lokasi.
3.  **Pemodelan (*Modeling Quick Design*)**: Membangun rancangan basis data dan algoritma verifikasi.
4.  **Konstruksi Prototipe (*Construction of Prototype*)**: Membangun aplikasi versi awal menggunakan React.js dan integrasi sensor.
5.  **Penyerahan dan Umpan Balik (*Deployment & Delivery*)**: Menyerahkan sistem kepada pengguna untuk diuji coba. Jika ditemukan kendala (misal: gagal deteksi saat gelap), sistem akan diperbaiki kembali ke tahap perancangan.

## 3.3 Kerangka Kerja Penelitian
1.  **Studi Literatur**: Mengumpulkan referensi teori tentang PWA dan Biometrik.
2.  **Analisis Sistem**: Mengidentifikasi proses bisnis berjalan dan menetapkan kebutuhan sistem baru.
3.  **Perancangan Sistem**: Mendesain *Unified Modeling Language* (UML) dan skema basis data.
4.  **Implementasi**: Melakukan pengkodean program.
5.  **Pengujian**: Menguji fungsionalitas sistem menggunakan metode *Black Box Testing*.
6.  **Penyusunan Laporan**: Mendokumentasikan seluruh proses dan hasil penelitian dalam bentuk skripsi.

---
*Catatan: Bab selanjutnya (Analisis & Perancangan, Implementasi, Penutup) akan dibahas pada dokumen Laporan Tugas Akhir (TA 2).*
