# Ekosistem Aplikasi "AGEN SOSIS AZIZAH"

Proyek ini terdiri dari **2 Aplikasi Mandiri** yang saling terintegrasi melalui Cloud Sync Supabase:

---

## 1. Aplikasi Kasir Tablet Utama (`POS-Offline-main`)
* **Folder**: Root workspace (`d:/PROJEK APLIKASI POS OFFLINE/POS-Offline-source-code/POS-Offline-main`)
* **Nama Aplikasi**: **POS AZIZAH**
* **Package Android**: `com.rumahmakan.posoffline`
* **Slug Expo**: `pos-offline` (Akun EAS: `risgoldofficial23`)
* **Target Hardware**: Tablet Kasir Toko
* **Orientasi**: Fleksibel (Mendukung Landscape dan Portrait sesuai pengaturan)
* **Database Utama**: SQLite Lokal (`expo-sqlite`) — 100% Berfungsi Offline
* **State Management**: Zustand
* **Peran Pengguna (Role)**:
  1. `kasir`: Akses cepat melayani penjualan, scan barcode, keranjang, cetak struk thermal.
  2. `pemilik`: Otorisasi PIN untuk laporan laba/rugi, stok opname, modal laci, dan pengaturan toko.
* **Fitur Utama**:
  - Transaksi Kasir (Katalog sosis & frozen food, barcode scanner, multi-satuan grosir/eceran, diskon).
  - Cetak Struk Printer Thermal Bluetooth (ESC/POS).
  - Manajemen Stok & Freezer (Batch kadaluarsa, opname stok, peringatan restock).
  - Kas Laci & Rekening Bank (Dual-pocket, buka/tutup shift, setoran bank).
  - Piutang Pelanggan & Utang Supplier.
* **Layar Login**: Terminal POS industrial bersih, elegan, taktil, dan bebas dari kesan AI slop.
* **Tugas Cloud Sync**: Mengirim ringkasan transaksi (`cashTxTotal`, `nonCashTxTotal`, shift, stok, valuasi freezer) ke Supabase di latar belakang secara otomatis.

---

## 2. Aplikasi Pemantau Smartphone Pemilik (`kendali-usaha-azizah`)
* **Folder**: `kendali-usaha-azizah` ([kendali-usaha-azizah](file:///d:/PROJEK%20APLIKASI%20POS%20OFFLINE/POS-Offline-source-code/POS-Offline-main/kendali-usaha-azizah))
* **Nama Aplikasi**: **KENDALI USAHA AZIZAH**
* **Nama Usaha**: **AGEN SOSIS AZIZAH**
* **Package Android**: `com.azizah.kendaliusaha`
* **Slug Expo**: `kendali-usaha-azizah` (Akun EAS: `risgoldofficial23`)
* **Target Hardware**: Smartphone Pribadi Pemilik Toko
* **Orientasi**: Portrait (Terkunci)
* **Sifat Aplikasi**: 100% *Read-Only* (Pengawasan murni, tanpa risiko kasir/pemilik salah pencet data transaksi di HP).
* **Struktur 3 Tab Navigasi Bawah**:
  1. **📊 Dasbor**: Omset hari ini, 💵 Kas Masuk Tunai vs 📱 Non-Tunai (QRIS), Kas Laci & Bank, Status Shift Kasir, Jam Paling Ramai, Margin Laba Kotor, dan 10 Transaksi Terkini.
  2. **📑 Laporan**: Laba/Rugi Bulanan, Valuasi Modal Stok di Freezer, Peringatan Stok & Kadaluarsa, Top 5 Produk Terlaris, serta Peringatan Piutang Jatuh Tempo $\le 3$ Hari.
  3. **⚙️ Pengaturan**: Status sambungan cloud toko, kode pairing aktif (`AZ-7789`), pilihan auto-refresh data, dan info aplikasi.

---

## 3. Infrastruktur Cloud & Sinkronisasi
* **Cloud Platform**: Supabase (Tabel sinkronisasi toko offline)
* **Kode Pairing Standar**: `AZ-7789`
* **Alur Data**:
  - Tablet Kasir (`POS-Offline-main`) bertindak sebagai **Sumber Data Tunggal (Single Source of Truth)**.
  - Setiap ada transaksi, buka shift, atau update kas, kasir secara otomatis mengompilasi payload dan memperbarui Supabase.
  - Smartphone Pemantau (`kendali-usaha-azizah`) membaca data dari Supabase secara berkala (interval 30 detik / 1 menit / manual refresh).

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
* **Profile**: `preview` (Format output berupa **.APK** langsung siap install di Android).
* **Build Terkini (Tahap Audit Selesai)**:
  - **Build ID**: `0cb2fde6-8240-447b-bebc-23c3618a3439`
  - **Live URL**: https://expo.dev/accounts/rikire/projects/pos-offline/builds/0cb2fde6-8240-447b-bebc-23c3618a3439
* **Perintah Build Latar Belakang (Non-Interactive)**:
  ```powershell
  $env:Path = "C:\Program Files\nodejs;" + $env:Path
  $env:EXPO_TOKEN = "<EXPO_TOKEN>"
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
4. **Pencarian Cepat Katalog & Kulakan (`product-search-modal.tsx` & `explore.tsx`)**: Barcode map caching mencegah ribuan `JSON.parse` saat mengetik pencarian barang.

---

## 7. Aturan Mutlak Pengembangan Selanjutnya (Core Rules)
1. **TIDAK MENGUBAH FITUR DAN DESAIN APAPUN**: Seluruh tampilan UI, layout dual-pane, tombol, warna, modal popup, dan alur operasional aplikasi kasir harus dipertahankan 100% identik.
2. **DOMAIN USAHA**: Toko bergerak murni di bidang **RETAIL / DISTRIBUTOR SOSIS & FROZEN FOOD ("AGEN SOSIS AZIZAH")**. Semua terminologi operasional kasir, katalog, dan freezer harus berakar pada ritel barang dagang beku.
3. **PRESERVASI KREDENSIAL KEYSTORE**: Jangan pernah mengganti `owner` atau `projectId` di `app.json` ke project baru, agar file APK yang dihasilkan selalu kompatibel sebagai update langsung di HP kasir tanpa menghilangkan database SQLite lokal.


