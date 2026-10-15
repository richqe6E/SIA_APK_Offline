# Arsitektur Aplikasi "POS AZIZAH" (Point of Sale Full Offline)

Proyek ini adalah **Aplikasi Kasir Tablet & Smartphone Mandiri 100% Full Offline**:

---

## 1. Identitas & Spesifikasi Aplikasi Kasir
* **Nama Aplikasi**: **POS AZIZAH**
* **Package Android**: `com.rumahmakan.posoffline`
* **Slug Expo**: `pos-offline` (Akun EAS: `rikire`)
* **Project ID EAS**: `97d847aa-a65d-4eb8-9d21-33f936cce00e` (`@rikires-team/pos-offline`)
* **Target Hardware**: Tablet Kasir Toko & Smartphone Android (Dioptimalkan untuk Xiaomi MIUI/HyperOS RAM 4GB)
* **Orientasi**: Fleksibel (Mendukung Landscape dan Portrait sesuai preferensi toko)
* **Database Utama**: SQLite Lokal (`expo-sqlite`) dengan `PRAGMA journal_mode = 'wal'` dan `PRAGMA busy_timeout = 5000` — **100% Berfungsi Penuh Secara Offline Tanpa Internet / Cloud Backend**.
* **State Management**: Zustand 5
* **Peran Pengguna (Role)**:
  1. `kasir`: Melayani penjualan, scan barcode kamera & scanner USB/Bluetooth, kelola keranjang belanja, cetak struk thermal 58mm.
  2. `pemilik`: Otorisasi PIN 6-digit untuk laporan laba/rugi SAK EMKM, buku kas dual-pocket, stok opname, modal laci, kulakan stok, dan pengaturan toko.
* **Fitur Utama**:
  - Transaksi Kasir (Katalog frozen food, barcode scanner, multi-satuan grosir/eceran, diskon persentase/rupiah, pending transaksi, split payment tunai & QRIS).
  - Produk Timbangan Curah (`is_weighted: 1`) dengan pemotongan stok gramatur desimal presisi (0.25 kg, 0.5 kg, 0.75 kg).
  - Harga Pokok Penjualan (HPP) Rata-rata Bergerak (*Weighted Moving Average*) saat kulakan masuk.
  - Cetak Struk Printer Thermal Bluetooth (ESC/POS 58mm) dengan logo usaha dan timeout guard 7 detik.
  - Manajemen Kas Dual-Pocket (Kas Fisik di Tangan/Laci vs Rekening Bank), buka/tutup shift kasir, dan bukti setoran bank.
  - Piutang Pelanggan (Bon) & Hutang Supplier lengkap dengan foto faktur offline.
* **Layar Login & Antarmuka**: Terminal POS industrial bersih, elegan, berorientasi taktil, dan bebas dari kesan AI slop.
* **Karakter Data**: Sepenuhnya mandiri (*standalone single device*). Tidak ada sinkronisasi Supabase/Firebase/backend cloud untuk menjamin kecepatan maksimal, privasi 100%, dan ketiadaan latensi sinyal.

---

## 4. Karakter & Prinsip Desain (Anti-AI Slop)
* **Filosofi Tampilan**: Terminal POS Industrial & Eksekutif yang Tak Lekang Waktu (*Clean, tactile, high-contrast, professional*).
* **Palet Warna**:
  - Background: Neutral Slate/Zinc `#f8fafc` & `#ffffff` (Cards).
  - Border: Presisi `#e2e8f0` / `#cbd5e1`.
  - Teks: Slate gelap `#0f172a` (Header) & `#64748b` (Subtext).
  - Aksen Aksi: Emerald `#10b981` (Positif / Tunai), Indigo/Blue `#3b82f6` (Non-Tunai / Info), Amber `#f59e0b` (Peringatan), Rose `#ef4444` (Bahaya / Jatuh Tempo).
* **Hindari**: Warna gradasi neon pastel berlebihan, ikon dekoratif tak fungsional, dan kartu yang melayang tanpa hierarki yang jelas.

---

## 5. Prosedur Build & Deployment (Expo EAS)
* **Akun EAS Aktif Terverifikasi**: `rikire` (`rikyrivaldi369@gmail.com`)
* **Project ID EAS**: `97d847aa-a65d-4eb8-9d21-33f936cce00e` (`@rikire/pos-offline`)
* **Keystore Digital**: `Build Credentials w2ACOjmW8I (default)` (Wajib dipertahankan agar update APK tidak menghapus data SQLite lokal pengguna).
* **Build Terkini (Tahap 15: Perbaikan Audit Agen Argon, Presisi Stok Timbangan Desimal, HPP Weighted Moving Average, Anti-Crash SQLite Tablet Xiaomi & Robust Camera/Gallery Picker, v1.0.5 / Code 9)**:
  - **Build ID**: `3629d8cb-a3f7-4980-afc8-03bd6f836d27`
  - **Status**: FINISHED (Sukses)
  - **Direct APK URL**: https://expo.dev/artifacts/eas/lTgaW9RfwLZywe1NmDpP5Xme0Z3NuQ-cfHyuI0ewVxQ.apk
  - **Live URL**: https://expo.dev/accounts/rikires-team/projects/pos-offline/builds/3629d8cb-a3f7-4980-afc8-03bd6f836d27
* **Build Sebelumnya**:
  - **Tahap 14**: `c45d19a5-d22b-4d5f-94d3-eeb6d29bce93` (v1.0.4 / Code 8)
  - **Tahap 13**: `851403dc-0450-4219-975c-d2e6f51caa94` (v1.0.3 / Code 7)
  - **Tahap 12**: `9a44d59d-d7bb-4589-80b2-f7a67cb2ad12` (v1.0.2 / Code 6)
  - **Tahap 11.1**: `7e7bad55-8106-4788-be69-20fadb327721`
  - **Tahap 11 Awal**: `9ef45eb4-9871-415d-baeb-6ba971ecfed3`
  - **Tahap 10**: `4de4363b-41c0-4fd8-8074-fc9a19f092d9`
* **Perintah Build Latar Belakang (Non-Interactive)**:
  ```powershell
  $env:Path = "C:\Program Files\nodejs;" + $env:Path
  Remove-Item Env:\EXPO_TOKEN -ErrorAction SilentlyContinue
  $env:EAS_NO_VCS = "1"
  npx.cmd eas-cli build -p android --profile preview --non-interactive --no-wait
  ```

---

## 6. Riwayat Audit & Engineering (System Integrity Framework)

### Tahap 1: Aplikasi Kasir Utama, Concurrency & Anti Double-Entry
1. **SQLite PRAGMA Enforcement (`services/database.ts`)**: `PRAGMA journal_mode = 'wal'` dan `PRAGMA foreign_keys = ON` dijalankan pada setiap koneksi awal.
2. **Indeks B-Tree Migrasi v17**: 11 indeks performa tinggi ditambahkan (`idx_transactions_created_at`, `idx_transactions_pm_split`, `idx_transaction_items_txid`, dll).
3. **Mutex Anti Double-Entry Checkout (`stores/transactionStore.ts`)**: State `isCheckingOut` dan UI lock `isSubmitting` mengunci checkout sehingga klik cepat kasir tidak memicu nota ganda.
4. **Atomic Sequential Nota (`daily_counters`)**: Menggantikan race condition `COUNT(*) + 1` dengan atomic increment terisolasi.
5. **O(1) In-Memory Barcode Index (`stores/productStore.ts`)**: Hash map `barcodeProductMap` memungkinkan scan barcode instan tanpa scan linear.

### Tahap 2: Laporan Keuangan SAK EMKM & Normalisasi Saldo Kas
1. **Migrasi v18 (`services/database.ts`)**: Indeks `expenses(expense_date)`, `cash_shifts(status, opened_at)`, dan balancing modal awal shift historis.
2. **Self-Balancing Shift Kasir (`stores/shiftStore.ts`)**: Pelepasan modal awal otomatis saat tutup shift (`type: 'out'`, `category: 'modal_awal'`), mencegah saldo kas laci menggembung fiktif.
3. **Penyajian Laporan SAK EMKM (`app/(tabs)/financial-reports.tsx`)**:
   - Penjualan Bruto dihitung dari harga kotor produk.
   - Potongan Penjualan / Diskon disajikan transparan sebagai pengurang omzet bruto.
   - Pajak PB1 diisolasi sebagai titipan kewajiban (bukan laba toko).
   - Seluruh filter tanggal menggunakan rentang tanggal berindeks (`>= ? AND < ?`), menghilangkan delay 3–5 detik.
4. **Cetak Thermal & PDF SAK EMKM (`services/print.ts` & `services/export.ts`)**: Format cetak terstandardisasi SAK EMKM.

### Tahap 3: Riwayat Transaksi, Retur/Batal Nota & Skalabilitas Cloud Sync
1. **Kueri Riwayat Berindeks & Virtualisasi (`history.tsx`)**: FlatList windowing (`initialNumToRender={12}`, `windowSize={5}`) menjaga konsumsi RAM < 100 MB.
2. **Sentralisasi Pembatalan & Retur Nota**: Mengembalikan stok otomatis, memvalidasi cicilan piutang aktif (`paid_amount > 0`), dan menyinkronkan buku kas secara atomik.
3. **Optimasi Background Cloud Sync (`services/cloudSync.ts`)**: 18 kueri full-table scan digantikan rentang berindeks dan kueri tren 7 hari dikonsolidasi menjadi 1 kueri agregat.
### Tahap 4: Full Offline, Restore Legacy, Category Parity, Quick Edit & Laporan Lainnya
1. **Mode Full Offline 100%**: Menonaktifkan sinkronisasi background cloud (`services/cloudSync.ts`) dan membersihkan interval network sync agar aplikasi berjalan ultra-cepat, stabil, dan independen dari sinyal internet.
2. **Restore Database POS Lama**: Mengatasi ketidakcocokan skema dan kolom SQL pada `services/backup.ts`, divalidasi sukses memulihkan backup riil (`pos_backup_20261004_1914.json`: 1.083 produk, 3.398 transaksi, 8.556 item transaksi, 334 entri kas) tanpa pelanggaran FK.
3. **Kesetaraan Kategori Kas Masuk/Keluar**: Kasir kini memiliki akses kategori transaksi yang sama dengan pemilik toko (termasuk bayar hutang supplier dll) dan catatan kas kasir menampilkan pembayaran supplier.
4. **Quick Edit Produk (Long-Press 3 Detik di Kasir)**: Fitur tekan lama 3 detik (`delayLongPress={3000}`) pada kartu produk di layar kasir untuk mengedit cepat nama, barcode, kategori, stok, harga jual, dan harga modal tanpa meninggalkan alur transaksi.
5. **Tab "Laporan Lainnya" di Laporan Keuangan**: Menyajikan 3 modul analitik untuk Kasir dan Pemilik:
   - Produk stok sedikit/habis diurutkan dari volume terlaris (`ORDER BY total_sold DESC, stock ASC`).
   - Rekap pengeluaran kas per kategori + popup rincian transaksi.
   - Rekap pemasukan kas per kategori (penjualan kasir berlabel jelas "Penjualan Produk") + popup rincian nota transaksi.

### Tahap 5: Audit Integritas Alur Keuangan & SAK EMKM, Rekonsiliasi Kas & Simulasi 1000 Transaksi
1. **Default Pembayaran Hutang Supplier ke Kas Bank (`debt-receivable.tsx` & `debtReceivableStore.ts`)**: Mengalihkan default sumber pembayaran hutang supplier dari `'hand'` ke `'bank'` sesuai praktik transfer perbankan grosir/distributor.
2. **Migrasi Database v19 (`services/database.ts`)**:
   - Menormalkan 23 entri historis pembayaran hutang supplier (Rp 20.563.807) dari akun `'hand'` ke akun `'bank'`, memulihkan uang fisik kas laci toko yang terdistorsi.
   - Menambahkan indeks komposit performa tinggi `idx_cash_ledger_type_cat_acc` pada `cash_ledger(type, category, account)`.
   - Otomatis dijalankan saat runtime aplikasi dan pasca pemulihan data JSON lama (`services/backup.ts`).
3. **Pencegahan Double Counting Setoran Bank (`stores/cashStore.ts`)**: Rekonsiliasi setoran bank menggunakan multiset frequency map `bankInFreq` sehingga tidak ada risiko salah hitung ganda jika ada mutasi dengan nominal identik pada detik yang sama.
4. **Isolasi Mutasi Non-Operasional dari Laba Rugi (`financial-reports.tsx` & `components/laporan-lainnya-tab.tsx`)**:
   - Kas Masuk di Laporan Keuangan mengecualikan `setor_bank` dan `modal_awal`.
   - Modul "Laporan Lainnya" mengecualikan nota tempo non-tunai dari `salesRow` untuk mencegah pelipatgandaan omzet saat piutang dilunasi bertahap, serta mendukung split payment (`cash_received` & `qris_received`).
5. **Pencatatan Selisih Fisik Tutup Shift Kasir (`stores/shiftStore.ts`)**: Selisih uang fisik kasir (`difference`) dicatat atomik ke `cash_ledger` sebagai kategori `selisih_kas` sehingga saldo laci di sistem sinkron 100% dengan fisik uang laci saat shift ditutup.
6. **Simulasi Stres 1.000 Transaksi**: Pengujian otomatis 1.000 transaksi acak komprehensif (penjualan tunai, QRIS, piutang tempo, split payment, bayar utang supplier via bank, pelunasan piutang ke laci, setor bank, operasional, dan selisih shift) menunjukkan akurasi rekonsiliasi kas dan laba rugi 100% matematis sempurna.

### Tahap 6: Koreksi Kas Kembalian Shift, Perpanjangan Margin Cetak Nota 7 Baris, Fitur Logo Usaha di Struk Thermal 58mm & Re-audit Sistem
1. **Koreksi Kembalian Tunai Kasir (`shiftStore.ts` & `transactionStore.ts`)**: Menggunakan nilai nominal bersih transaksi (`total`) untuk penjualan tunai, sehingga uang kembalian tidak lagi menggelembungkan Kas Masuk Penjualan Tunai maupun Kas Diharapkan Sistem laci saat tutup shift.
2. **Pilihan Akun Kas Pelunasan Piutang (`debt-receivable.tsx` & `debtReceivableStore.ts`)**: Kasir/pemilik dapat memilih akun pencatatan uang masuk pelunasan piutang ke 💵 Kas di Tangan (`hand`) atau 🏛️ Kas di Bank (`bank`).
3. **Umpan Kertas Cetak Ekstra (`services/print.ts`)**: Menaikkan perintah umpan kertas menjadi `printAndFeed(7)` + `cutOnePoint()` pada semua format cetak (struk kasir, Z-Report, slip laba rugi, bukti setor bank).
4. **Upload & Cetak Logo Usaha di Struk Thermal 58mm**: Mendukung logo usaha di struk thermal 240 dot rata tengah dan perbaikan izin kamera/galeri di `app.json`.

### Tahap 7: Perbaikan Sinkronisasi Riwayat Transaksi saat Reset Data & Audit Final Standar SOP
1. **Penyegaran Layar Riwayat (`useFocusEffect` di `history.tsx`)**: Daftar transaksi selalu dimuat ulang saat tab Riwayat dibuka kembali.
2. **Validasi & Auto-Cleanup Detail Transaksi (`history.tsx`)**: Memvalidasi eksistensi transaksi di SQLite secara real-time. Jika transaksi telah dihapus atau database direset, tampilan detail riwayat lama otomatis tertutup seketika tanpa meninggalkan artefak/detail hantu di layar.
3. **Sinkronisasi In-Memory Reset & Restore (`data-management.tsx`)**: Mengosongkan state `transactions` saat Buka Buku Baru dan Reset Pabrik.
4. **Dokumen Uji Coba 15 Transaksi (`Uji_Coba.md`)**: Penyesuaian simulasi menjadi 15 transaksi lengkap dengan rekonsiliasi dual-pocket dan laba rugi SAK EMKM yang 100% akurat.
5. **Kompilasi TypeScript**: 0 error (`tsc --noEmit`).

### Tahap 8: Audit Menyeluruh Modal Awal Kasir Shift, Sinkronisasi Dua Arah Buku Kas & Pembersihan Reset Buku Baru
1. **Sinkronisasi Dua Arah Modal Shift & Buku Kas (`shiftStore.ts` & `cashStore.ts`)**: Koreksi modal laci via "Edit Modal" kini atomik mengupdate `settings`, `cash_shifts`, dan `cash_ledger` (`modal_awal`), serta menyegarkan saldo kas laci secara realtime via `loadLedger(db)`. Sebaliknya, pengeditan entri modal di Buku Kas otomatis menyinkronkan modal shift aktif.
2. **Kondisi Form Buka Shift Kasir (`components/cash-shift-modal.tsx`)**: Form Buka Shift kini berbasis kondisi `!currentShift`. Setiap kali kasir membuka shift baru, kasir selalu disajikan form input nominal modal awal dan nama kasir secara bebas tanpa terkunci ke data historis.
3. **Parameter Eksplisit Buka Shift (`components/cash-shift-modal.tsx`)**: `handleStartTodayShift` mengirimkan parameter nominal `cash` eksplisit ke `openShift(db, cashier, cash)`, mengeliminasi stale state dan race condition.
4. **Pembersihan Bersih saat Reset Buku Baru (`services/database.ts`, `data-management.tsx`, `shiftStore.ts`)**: `daily_drawer_date` dan `daily_drawer_amount` kini ikut dihapus saat Buka Buku Baru / Reset Pabrik, dan `resetShiftStore()` mengosongkan state in-memory sehingga toko benar-benar memulai dari nol.
5. **Verifikasi Statis & Dinamis**: Kompilasi TypeScript 100% lulus (`tsc --noEmit` exit code 0) dan lolos simulasi stres logika rekonsiliasi kas.

### Tahap 9: Audit Komprehensif Seluruh Celah Logika, Transaksi & Laporan Keuangan Pra-Build
1. **Rollback Counter Nota pada Revert Transaksi (`stores/transactionStore.ts`)**: Penambahan sinkronisasi `daily_counters.last_seq` pada `revertAndEditTransaction` jika transaksi yang diedit adalah transaksi terakhir hari ini, mencegah loncatnya nomor urut nota saat kasir mengedit nota terakhir.
2. **Refresh Shift Kasir Aktif pada Layar Transaksi (`app/transaksi.tsx`)**: Memanggil `loadActiveShift(db)` pada `useEffect` saat layar transaksi dimuat, menjamin transaksi selalu diatribusikan ke ID shift dan operator kasir aktif yang tepat.
3. **Pemberantasan Entri Yatim Setor Bank (`stores/cashStore.ts`)**: Pada `deleteEntry`, jika entri `setor_bank` dihapus di Buku Kas, pasangan transaksinya di akun bank/laci otomatis ikut terhapus secara atomik, menjaga saldo dual-pocket tetap 100% seimbang.
4. **Penyelarasan Filter Detail Kas Masuk Penjualan (`components/laporan-lainnya-tab.tsx`)**: Popup rincian penjualan produk kini mengecualikan transaksi tempo (`payment_method != 'hutang' AND is_credit = 0`), menyelaraskan 100% nilai kartu rekap dengan daftar nota transaksi.
5. **Normalisasi Evaluasi Split Shift & Rentang Tanggal Bulanan (`stores/shiftStore.ts` & `components/laporan-lainnya-tab.tsx`)**: Prioritas evaluasi split payment pada kueri shift dan penyelarasan rentang bulan penuh (`start of month` s.d. `start of month, +1 month`).
6. **Verifikasi Stres Komprehensif**: 11 skenario pengujian transaksi, shift, kas dual-pocket, pelunasan piutang, dan SAK EMKM lulus 100% tanpa error, serta kompilasi TypeScript 0 error (`tsc --noEmit`).

### Tahap 10: Perbaikan Menyeluruh 4 Bug Lapangan, Guardrail Stok Multi-Titik, Integritas Z-Report & Eliminasi Kilatan Riwayat
1. **Guardrail Stok Multi-Titik (`app/transaksi.tsx` & `stores/transactionStore.ts`)**:
   - Menambahkan fungsi `handleUpdateQtyWithValidation` pada tombol `+` di keranjang dan modal `BulkQtyModal` di `transaksi.tsx`, memblokir penambahan kuantitas barang melebihi sisa stok fisik di freezer saat `has_stock === 1`.
   - Menambahkan guardrail di `updateQuantity` pada `transactionStore.ts` yang membatasi nilai kuantitas maksimum setara stok produk.
2. **Integritas Tutup Shift Kasir & Z-Report (`stores/shiftStore.ts` & `components/cash-shift-modal.tsx`)**:
   - Memasukkan mekanisme otomatisasi tautan transaksi yatim (`shift_id IS NULL AND date(created_at) = date(?)`) ke ID shift aktif pada `loadActiveShift` dan `getShiftSummary`, menjamin seluruh nota hari ini terhitung dan tidak pernah bernilai 0 di Z-Report.
   - Mengunci `closeShift` dengan validasi `status === 'open'` untuk mengeliminasi risiko double-tap / duplikasi entri buku kas.
   - Menghitung `expected_cash` secara realtime dari kueri penjualan aktif saat modal laci diedit di tengah shift.
   - Menambahkan indikator pemuatan rekonsiliasi kasir pada popup tutup shift untuk mengeliminasi kilatan data 0 nota prematur.
3. **Eliminasi Kilatan & Optimasi Layar Riwayat (`app/(tabs)/history.tsx`)**:
   - Menghapus dependency `selected` dari `useFocusEffect`, menghentikan loop reload yang sebelumnya menutup paksa tampilan detail nota di mode portrait (gejala kilatan sekejap).
   - Menambahkan status `loadingItems` dan penguncian `isFetchingMoreRef` saat pagination scroll, menjadikan navigasi riwayat ringan dan bebas lag.
4. **Optimasi Pemuatan Laporan Lainnya (`components/laporan-lainnya-tab.tsx`)**:
   - Menetapkan inisialisasi awal `loading = true` saat komponen dimount, mencegah tampilan state kosong sebelum query selesai.
   - Mengganti kueri `substr(created_at, 1, 10)` dengan kueri rentang tanggal berindeks B-Tree (`>= ? AND < ?`), mempercepat respon kueri agregat dari ribuan transaksi.
5. **Proteksi Anti Double-Entry & Akselerasi Tablet Spek Rendah (RAM 4GB)**:
   - Menambahkan mutex atomik single-flight `checkoutMutex` di level Zustand dan ref lock sinkron `isSubmittingRef` di level UI checkout, memblokir klik ganda instan saat tablet mengalami stutter/lag.
   - Menambahkan guardrail stok level store pada `addToCart` dan `updateQuantity` sehingga scan barcode cepat atau klik berulang tidak dapat melampaui sisa stok fisik.
   - Memproteksi proses buka shift (`openShiftMutex`), tutup shift (`closeShiftMutex`), pelunasan piutang (`payReceivableMutex`), dan bayar hutang supplier (`payDebtMutex`) dengan mutex terisolasi.
### Tahap 11: Modul Foto Faktur Hutang Supplier, Kategori Kas Terstruktur & Jatuh Tempo Piutang Kasir
1. **Foto & Preview Faktur Pembelian (Utang Supplier)**:
   - Skema SQLite Migrasi v20 (`services/database.ts`): Menambahkan kolom `invoice_image TEXT` dan `notes TEXT` pada tabel `supplier_debts` via `ALTER TABLE` non-destruktif.
   - Manajemen Penyimpanan Gambar (`utils/imageStorage.ts`): Menyimpan file gambar kamera/galeri secara offline ke folder `FileSystem.documentDirectory + 'debts/'` dengan format `.jpg`. Database SQLite hanya menyimpan path lokal string URI, menjaga ukuran database tetap ringan dan query secepat kilat.
   - Antarmuka Kartu Hutang (`app/debt-receivable.tsx`): Menampilkan thumbnail foto 52x52 rounded di kartu hutang supplier. Ketika diklik, membuka Modal Fullscreen Viewer resolusi tinggi dengan latar gelap, header informasi faktur, dan tombol tutup.
   - Form Catat Hutang (`AddDebtModal`): Dilengkapi opsi kamera langsung (`Ambil Foto`) dan galeri (`Pilih Galeri`), preview tinggi 160px sebelum disimpan, dan tombol hapus foto jika salah pilih.
2. **Kategori Kas Masuk & Kas Keluar Terstruktur (Laba/Rugi vs Non-Laba/Rugi)**:
   - Metadata Kategori (`stores/cashStore.ts`): Menambahkan kategori baru: Prive (`prive`), Bayar Pinjaman (`bayar_pinjaman`), Konsumsi Karyawan (`konsumsi_karyawan`), Retribusi/Kebersihan (`retribusi_kebersihan`), Komisi Supplier (`pendapatan_komisi`), Pinjaman Masuk (`pinjaman_masuk`), dan Tarik Bank (`tarik_bank`), masing-masing dilengkapi flag `isProfitLoss`, ikon emoji, dan deskripsi tujuan.
   - Segmented Control 2 Tab di Buku Kas (`app/(tabs)/financial-reports.tsx`): Mengganti selector chips acak dengan 2 tab tegas (`📊 Terkait Laba/Rugi` vs `💼 Non-Laba/Rugi (Prive/Modal)`) yang membawahi list tombol vertikal scrollable berikon dan berpenjelasan detail.
   - Format Angka & Tanggal Transaksi: Input nominal terstandarisasi pemisah titik ribuan (`formatRupiahInput`), serta dilengkapi pemilih tanggal transaksi fleksibel via kalender `DateTimePicker`.
   - Isolasi SAK EMKM & Cloud Sync: Beban non-operasional (`prive` dan `bayar_pinjaman`) diisolasi dari kueri Laba/Rugi SAK EMKM (`category NOT IN ('kulakan_stok', 'bayar_hutang_supplier', 'setor_bank', 'modal_awal', 'prive', 'bayar_pinjaman')`), sehingga penarikan pribadi pemilik tidak mendistorsi kinerja laba bersih toko.
3. **Transaksi Kasir Hutang & Manajemen Bon Piutang Customer**:
   - Jatuh Tempo Cepat Kasir (`stores/transactionStore.ts` & `app/transaksi.tsx`): Menambahkan pilihan jatuh tempo instan (`+3 Hari`, `+7 Hari`, `+14 Hari`, dan kalender custom) pada Step 2 checkout metode hutang kasir, disimpan otomatis ke `customer_receivables(due_date)`.
   - Rincian Produk Bon Piutang (`app/debt-receivable.tsx`): Tombol `🔍 Rincian Produk` menampilkan modal rincian nota transaksi (`transaction_items`: nama barang, kuantitas/berat, harga satuan, dan subtotal).
   - Edit Nota Kasir dari Piutang: Tombol `✏️ Edit` pada piutang kasir terintegrasi atomik ke `revertAndEditTransaction` (mengembalikan stok fisik, membatalkan piutang lama, dan memasukkan produk kembali ke keranjang kasir untuk penyesuaian belanja).
4. **Verifikasi Statis & Dinamis**: Kompilasi TypeScript 100% lulus (`tsc --noEmit` exit code 0) dan simulasi transaksi terisolasi via native `node:sqlite` lulus 100%.

### Tahap 12: Audit & Perbaikan Setor Bank Laci & Rekonsiliasi Tutup Shift Kasir
1. **Penyelarasan Kueri Setor Bank (`stores/cashStore.ts`)**:
   - Memperbaiki kueri pengaman saldo fisik di `depositToBank`, mengeliminasi pemotongan ganda uang kembalian pelanggan (`sales_change`), duplikasi porsi split payment, dan penanganan aman kolom akun (`account = 'hand' OR account IS NULL`).
   - Saldo kas fisik tersedia yang dihitung `depositToBank` kini 100% identik dengan Dasbor dan Buku Kas (`loadLedger`), meloloskan setoran bank secara akurat.
2. **Rekonsiliasi Transparan Tutup Shift Kasir (`stores/shiftStore.ts` & `components/cash-shift-modal.tsx`)**:
   - Menambahkan kalkulasi `cumulativeHandBalance` pada `ShiftSummary` sehingga kasir dapat membedakan dengan jelas antara **Target Kas Sesi Shift Ini** dan **Total Kas Toko di Laci (Kumulatif)**.
   - Memperbaiki tautan transaksi yatim (`UPDATE transactions SET shift_id = ? WHERE shift_id IS NULL AND (date(created_at) = date(?) OR created_at >= ?)`), menjamin seluruh nota kasir tertaut sempurna bahkan jika shift melintasi tengah malam.
   - Mengunci `closeShift` agar input uang fisik yang cocok dengan saldo kas toko kumulatif tidak memicu pencatatan ganda entri fiktif `selisih_kas`.
3. **Verifikasi Statis & Dinamis**: Kompilasi TypeScript 100% lulus (`tsc --noEmit` exit code 0) dan lolos simulasi siklus penuh end-to-end tanpa error.

### Tahap 13: Sistem Barcode Canggih Auto-Add ke Keranjang & Auto-Clear Textbox Pencarian
1. **Fungsi Pencarian Barcode Murni (`stores/productStore.ts`)**:
   - Menambahkan fungsi `findProductByExactBarcode(code)` yang menggunakan hash map $O(1)$ `barcodeProductMap` dan fallback case-insensitive yang **hanya dan mutlak** mencocokkan kolom `barcode` dan multi-barcode `barcodes`.
   - Menghilangkan pencocokan nama produk (`p.name`) dari lookup barcode, menjamin tidak ada auto-add yang tidak sengaja terpicu saat kasir mencari nama produk.
2. **Logika Input Canggih Transaksi Kasir (`app/transaksi.tsx`)**:
   - Menambahkan fungsi `tryAutoAddBarcode` yang mengevaluasi input scanner/teks secara instan.
   - Jika barcode terdaftar cocok: produk langsung otomatis masuk ke keranjang (`handleAddToCartWithValidation`), dan textbox pencarian seketika dikosongkan (`setSearchQuery('')`), memungkinkan pemindaian beruntun tanpa menyentuh layar ataupun menghapus teks.
   - Jika kasir mencari dengan nama produk (teks bebas): sistem mempertahankan alur pencarian normal (teks tetap tersimpan di textbox, daftar produk terfilter, dan kasir tetap harus mengklik produk secara manual).
   - Mendukung penanganan akhiran scanner hardware (`\r\n`), keyboard wedge tanpa enter, dan tombol `onSubmitEditing`.
3. **Verifikasi Statis & 10 Skenario Simulasi Otomatis**:
   - Kompilasi TypeScript 100% lulus (`tsc --noEmit` exit code 0).
   - Pengujian otomatis 10 skenario komprehensif (`test_barcode_simulation.js`: barcode utama, multi-barcode, barcode alfanumerik, scanner hardware dengan enter, trailing enter, scan berturut-turut, pencarian nama produk, enter nama produk, guardrail stok habis, dan produk timbangan) lulus 100% tanpa celah bug.

### Tahap 14: Optimasi Kompatibilitas Penuh Tablet, Eliminasi Crash Crop Kamera/Galeri, Cadangan Database Permanen & Anti-Logout Sesi
1. **Eliminasi Crash Crop Intent Kamera & Galeri di Tablet**:
   - Menghapus opsi `allowsEditing: true` pada `explore.tsx` (produk), `debt-receivable.tsx` (faktur hutang), dan `store-settings.tsx` (QRIS & logo usaha) yang sebelumnya memicu `ActivityNotFoundException` karena ketiadaan aplikasi pemotong bawaan di tablet.
   - Menggantinya dengan pemuatan gambar langsung beresolusi teroptimasi (`quality: 0.7 - 0.75`), mencegah lonjakan memori OOM pada tablet RAM 2GB-4GB.
   - Menangani izin Android 13+ secara toleran (Photo Picker tanpa izin runtime) sehingga tidak memunculkan pop-up error palsu "Gagal memuat foto / Periksa izin".
2. **Cadangan Database Permanen Anti-Terhapus (`services/backup.ts` & `app/(tabs)/data-management.tsx`)**:
   - Mengalihkan penulisan berkas cadangan JSON dari `Paths.cache` (folder sementara yang otomatis dihapus Android saat izin diubah) ke `Paths.document` (folder dokumen permanen aplikasi).
   - Berkas cadangan kini aman 100% dari pembersihan sistem, tetap dapat dibagikan via `Sharing.shareAsync` ke Google Drive/Flashdisk OTG.
3. **Persistensi Sesi Pengguna Anti-Logout (`stores/settingsStore.ts` & `components/role-login-modal.tsx`)**:
   - Menyimpan `current_user_role` ('kasir' | 'pemilik') secara atomik ke tabel `settings` di SQLite lokal saat login dan menghapusnya saat logout manual.
   - Jika sistem Android tablet me-restart aplikasi akibat Low Memory Killer saat kamera dibuka di background, sesi pengguna langsung dipulihkan secara otomatis tanpa melempar pengguna ke modal login PIN awal.
4. **Kejelasan Subtitle Laporan Keuangan Sesuai Peran (`app/(tabs)/financial-reports.tsx`)**:
   - Menambahkan petunjuk jelas pada akun kasir bahwa tab Laba/Rugi disembunyikan demi keamanan toko dan memerlukan login PIN Pemilik Toko.
5. **Verifikasi Statis & Dinamis**:
   - Kompilasi TypeScript 100% lulus (`tsc --noEmit` exit code 0).
   - Pengujian 12 skenario kompatibilitas tablet & permanensi sistem lulus 100%.

---

## 7. Aturan Mutlak Pengembangan Selanjutnya (Core Rules)
1. **TIDAK MENGUBAH FITUR DAN DESAIN APAPUN**: Seluruh tampilan UI, layout dual-pane, tombol, warna, modal popup, dan alur operasional aplikasi kasir harus dipertahankan 100% identik.
2. **DOMAIN USAHA**: Toko bergerak murni di bidang **RETAIL / DISTRIBUTOR SOSIS & FROZEN FOOD ("AGEN SOSIS AZIZAH")**. Semua terminologi operasional kasir, katalog, dan freezer harus berakar pada ritel barang dagang beku.
3. **PRESERVASI KREDENSIAL KEYSTORE**: Jangan pernah mengganti `owner` atau `projectId` di `app.json` ke project baru, agar file APK yang dihasilkan selalu kompatibel sebagai update langsung di HP kasir tanpa menghilangkan database SQLite lokal.


