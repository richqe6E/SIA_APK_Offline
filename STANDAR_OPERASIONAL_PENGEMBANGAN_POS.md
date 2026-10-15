# STANDAR OPERASIONAL PROSEDUR (SOP) & REKAYASA PERANGKAT LUNAK
## SISTEM POS RITEL & DISTRIBUTOR "AGEN SOSIS AZIZAH"
### Dokumen Induk Standar Rekayasa Agency Mobile & Retail Systems

---

## DAFTAR ISI
1. [Prinsip Inti & Filosofi Rekayasa Agency](#1-prinsip-inti--filosofi-rekayasa-agency)
2. [Alur Prompting & Kontrol Komunikasi (Prompting Protocol)](#2-alur-prompting--kontrol-komunikasi)
3. [Alur PRD & Manajemen Ruang Lingkup (Scope Management)](#3-alur-prd--manajemen-ruang-lingkup)
4. [Alur Audit & Validasi Baseline Sistem](#4-alur-audit--validasi-baseline-sistem)
5. [Alur Akuntansi & Integritas Rumus Keuangan (SAK EMKM)](#5-alur-akuntansi--integritas-rumus-keuangan)
6. [Alur Desain UI/UX & Ergonomi Terminal POS](#6-alur-desain-uiux--ergonomi-terminal-pos)
7. [Alur Pengembangan & Perubahan Kode (Change Control)](#7-alur-pengembangan--perubahan-kode)
8. [Alur Debugging & Perbaikan Masalah (Root Cause Protocol)](#8-alur-debugging--perbaikan-masalah)
9. [Alur Simulasi & Uji Stres Operasional (Stress Testing)](#9-alur-simulasi--uji-stres-operasional)
10. [Alur Pengecekan Sistem, Periferal & Hardware](#10-alur-pengecekan-sistem-periferal--hardware)
11. [Alur Implementasi, Build & Keamanan Rilis (Release Gate)](#11-alur-implementasi-build--keamanan-rilis)
12. [Kriteria Kelulusan Akhir (Definition of Done)](#12-kriteria-kelulusan-akhir)

---

## 1. PRINSIP INTI & FILOSOFI REKAYASA AGENCY
1. **Source of Truth Adalah Kebutuhan Nyata Toko**:
   Aplikasi digunakan langsung di meja kasir agen frozen food dengan ritme cepat, tangan basah/dingin, dan pembeli antre. Segala fitur harus berorientasi pada kecepatan, ketahanan, dan keakuratan uang fisik toko.
2. **Zero Hallucination, Zero Guesswork**:
   Tidak boleh ada asumsi tanpa verifikasi data SQLite riil. Jika angka tidak seimbang, cari akar masalah di baris kueri SQL dan mutasi buku kas.
3. **Preservasi 100% Stabilitas Eksisting**:
   Dilarang keras merombak arsitektur, mendesain ulang antarmuka tanpa permintaan, atau mengubah skema database yang dapat merusak data operasional kasir.
4. **Offline First & Zero Dependency ke Internet**:
   Tablet kasir harus dapat melakukan penjualan, cetak nota, tutup shift, dan laporan keuangan tanpa koneksi internet sama sekali.

---

## 2. ALUR PROMPTING & KONTROL KOMUNIKASI
* **Fase Identifikasi Permintaan**:
  * Klasifikasikan permintaan menjadi:
    * `Tipe A (Sederhana)`: Pertanyaan, penjelasan analitik, atau audit kueri $\rightarrow$ Langsung eksekusi & laporkan.
    * `Tipe B (Modifikasi Kode)`: Perbaikan bug atau penyesuaian fungsi $\rightarrow$ Analisis akar masalah $\rightarrow$ Tulis kode minimal $\rightarrow$ Verifikasi TypeScript $\rightarrow$ Laporkan.
    * `Tipe C (Rilis / Build)`: Pembuatan paket APK / EAS Build $\rightarrow$ **Wajib Menunggu Persetujuan Eksplisit Pengguna** sebelum mengeksekusi perintah CLI build.
* **Protokol Larangan Eksekusi Build Otomatis**:
  > **ATURAN MUTLAK**: Jangan pernah menjalankan perintah build APK latar belakang tanpa izin eksplisit *"Silakan build"* atau *"Build sekarang"* dari pemilik proyek.

---

## 3. ALUR PRD & MANAJEMEN RUANG LINGKUP
Setiap penambahan atau modifikasi fitur wajib melalui filter 5 Pertanyaan PRD:
1. *Apakah fitur ini berdampak pada laci uang kasir atau stok freezer?*
2. *Apakah alur kasir menjadi lebih lambat dari 3 detik per transaksi?*
3. *Apakah fitur ini menambah beban memori pada tablet RAM 4 GB?*
4. *Apakah skema database SQLite memerlukan migrasi tabel baru?*
5. *Apakah ada potensi double-entry atau ketidakcocokan laporan laba rugi?*
Jika ada risiko pada salah satu poin di atas, buat mitigasi isolasi sebelum menulis kode.

---

## 4. ALUR AUDIT & VALIDASI BASELINE SISTEM
Sebelum menyentuh baris kode:
1. **Audit Skema Database**: Pastikan PRAGMA WAL aktif (`PRAGMA journal_mode = 'wal'`) dan Foreign Keys aktif (`PRAGMA foreign_keys = ON`).
2. **Audit Indeks Kueri**: Pastikan tabel besar (`transactions`, `transaction_items`, `cash_ledger`) memiliki indeks B-Tree pada kolom filter waktu (`created_at`, `date`, `shift_id`).
3. **Audit Concurrency & Mutex**: Pastikan tombol aksi checkout memiliki state guardrail (`isCheckingOut`) untuk mencegah duplikasi data.
4. **Audit Kompilasi Static**: Jalankan `npx tsc --noEmit` untuk memastikan baseline codebase bersih 0 error.

---

## 5. ALUR AKUNTANSI & INTEGRITAS RUMUS KEUANGAN
Sistem menganut standar pelaporan **SAK EMKM** dan rekonsiliasi kas riil:
1. **Pemisahan Dual-Pocket (Kas Laci vs Kas Bank)**:
   $$\text{Kas Laci (hand)} = \text{Modal Awal} + \text{Penjualan Bersih Tunai} + \text{Kas Masuk Fisik Lain} - \text{Kas Keluar Laci}$$
   $$\text{Kas Bank (bank)} = \text{Saldo Awal Bank} + \text{Penjualan QRIS} + \text{Setoran Tunai ke Bank} + \text{Transfer Masuk} - \text{Beban Bank}$$
2. **Isolasi Mutasi Non-Operasional**:
   * Modal awal kasir dan setoran modal pemilik **BUKAN Omzet Penjualan**.
   * Setoran kas dari laci ke bank **TIDAK Boleh Mengubah Laba Rugi** (hanya perpindahan saku kas).
3. **Penanganan Piutang & Penjualan Tempo**:
   * Omzet diakui saat nota tempo dibuat.
   * Pelunasan/cicilan piutang **TIDAK Boleh Digandakan Sebagai Omzet Baru** (hanya diakui sebagai konversi piutang menjadi kas tunai/bank).
4. **Koreksi Kembalian Tunai Kasir**:
   * Kas Masuk Penjualan Tunai dihitung dari nilai bersih (`total`), bukan nominal uang yang diserahkan pembeli (`payment_amount`). Uang kembalian yang dikembalikan pembeli tidak boleh dihitung sebagai kas masuk toko.

---

## 6. ALUR DESAIN UI/UX & ERGONOMI TERMINAL POS
1. **Prinsip Anti-AI Slop**:
   * Hindari gradasi neon berlebihan, efek glow melayang tanpa makna, dan teks pengantar/indikator lampu yang tidak fungsional.
   * Pertahankan tema industrial netral (Slate `#0f172a`, latar `#f8fafc`, kartu `#ffffff`, border `#e2e8f0`).
2. **Ergonomi Kasir Tablet**:
   * Target sentuh tombol (*touch target*) minimal $48 \times 48\text{ dp}$ agar kasir tidak salah pencet.
   * Kontras teks tajam (rasio kontras $\ge 4.5:1$) agar terbaca jelas di bawah lampu neon toko.
   * Respon haptic getar instan saat barcode berhasil dibaca atau tombol bayar ditekan.
3. **Dual-Pane Landscape / Flexible Portrait**:
   * Sisi kiri: Katalog produk & pencarian cepat.
   * Sisi kanan: Keranjang belanja, rincian diskon, dan tombol checkout instan.

---

## 7. ALUR PENGEMBANGAN & PERUBAHAN KODE
1. **Prinsip Perubahan Minimal (Minimal Change)**:
   Ubah hanya file yang langsung terkait dengan masalah. Jangan pernah merefaktor file lain yang sudah berfungsi normal.
2. **Kompatibilitas Komponen Asli**:
   Gunakan komponen UI dan dependensi bawaan yang sudah terpasang. Jangan menambah dependensi npm eksternal kecuali mutlak diperlukan.
3. **Penyimpanan Berkas Gambar**:
   Semua file foto (produk, QRIS, logo toko) wajib disimpan di direktori internal aplikasi (`FileSystem.documentDirectory`) menggunakan mekanisme fallback agar tidak pernah gagal membuka URI `content://` Android.

---

## 8. ALUR DEBUGGING & PERBAIKAN MASALAH
Protokol Diagnosa 5 Langkah:
1. **Identifikasi Gejala**: Tangkap pesan error exact atau perilaku anomali yang dialami pengguna.
2. **Lacak Lokasi Baris**: Temukan file dan baris spesifik yang memicu error (gunakan ripgrep / view file).
3. **Diagnosa Akar Masalah**: Tentukan apakah masalah disebabkan oleh izin sistem OS, inkompatibilitas skema berkas, atau logika SQL.
4. **Terapkan Perbaikan Terisolasi**: Tulis solusi yang menargetkan akar masalah tanpa efek samping ke fitur lain.
5. **Verifikasi Statis & Dinamis**: Uji ulang dengan kompilasi TypeScript dan simulasi fungsional.

---

## 9. ALUR SIMULASI & UJI STRES OPERASIONAL
Setiap perubahan besar pada mesin kasir atau buku kas wajib lulus uji simulasi:
1. **Simulasi Transaksi Multimoda**:
   * Penjualan Tunai murni dengan kembalian besar.
   * Penjualan QRIS / Non-tunai.
   * Penjualan Split Payment (sebagian Tunai + sebagian QRIS).
   * Penjualan Tempo / Kasbon pelanggan.
2. **Simulasi Mutasi Operasional**:
   * Pembelian stok kulakan tunai vs transfer bank.
   * Pembayaran hutang supplier via transfer bank.
   * Pelunasan piutang pelanggan via tunai vs transfer bank.
   * Mutasi setor kas laci ke bank.
3. **Simulasi Tutup Shift (Z-Report)**:
   * Cocokkan uang fisik di laci dengan `expectedCash` sistem.
   * Pastikan selisih kas fisik tercatat rapi tanpa distorsi saldo.

---

## 10. ALUR PENGECEKAN SISTEM, PERIFERAL & HARDWARE
1. **Printer Thermal Bluetooth (ESC/POS 58mm)**:
   * Panjang kertas nota wajib memiliki umpan `printAndFeed(7)` + `cutOnePoint()` agar teks tidak terpotong pisau *tear bar*.
   * Logo usaha dicetak di bagian paling atas dengan lebar proporsional 240 dot rata tengah.
2. **Pemindai Barcode Kamera (`expo-camera`)**:
   * Izin kamera `android.permission.CAMERA` terdaftar di `app.json` dan diminta saat runtime.
   * Default kamera belakang aktif dengan reticle pemindaian instan.
3. **Penyimpanan Galeri Foto (`expo-image-picker`)**:
   * Izin media `READ_MEDIA_IMAGES` dan `READ_EXTERNAL_STORAGE` aktif di `app.json`.
   * Mendukung konversi gambar ke Base64 (untuk printer) dan file lokal permanen (untuk tampilan UI).

---

## 11. ALUR IMPLEMENTASI, BUILD & KEAMANAN RILIS
1. **Kredensial Keystore Digital Mutlak Dipertahankan**:
   * `owner`: `rikire`
   * `projectId`: `97d847aa-a65d-4eb8-9d21-33f936cce00e`
   * Keystore: `Build Credentials w2ACOjmW8I (default)`
   * *Tujuan*: Menjamin update APK dapat ditimpa langsung di HP/tablet kasir tanpa menghapus database SQLite lokal yang berisi data riil toko.
2. **Izin Pengguna Sebelum Build**:
   * Tampilkan ringkasan kesiapan kode dan mintalah izin pengguna.
   * Hanya jalankan EAS CLI jika pengguna telah memberi aba-aba rilis.

---

## 12. KRITERIA KELULUSAN AKHIR (DEFINITION OF DONE)
Sebuah tugas atau pembaruan dinyatakan **SELESAI 100%** jika dan hanya jika memenuhi seluruh parameter berikut:
* [x] Logika bisnis dan rumus akuntansi terbukti 100% akurat.
* [x] Tidak ada regresi atau kerusakan pada fitur yang sudah ada sebelumnya.
* [x] Kompilasi TypeScript lulus 100% (`tsc --noEmit` exit code 0).
* [x] Tampilan UI konsisten dengan tema industrial asli tanpa sentuhan AI slop.
* [x] Periferal (printer, kamera, galeri, database lokal) teruji kompatibel di tablet Android.
* [x] Dokumentasi proyek (`PROJECT_DOCUMENTATION.md` dan `AGENTS.md`) diperbarui.
* [x] Disetujui oleh pemilik proyek.
