# DOKUMENTASI SISTEM & PRD LENGKAP
# POS Karya Riki Rivaldi (Aplikasi Point of Sale Offline)

*Dokumen ini merupakan catatan riwayat resmi, spesifikasi teknis (PRD), skema database, standar akuntansi, panduan build, dan rekap sesi pengembangan untuk referensi kelanjutan proyek di masa mendatang.*

---

## 1. Identitas & Informasi Rilis Terakhir

* **Nama Aplikasi:** POS Karya Riki Rivaldi (POS AZIZAH)
* **Package Name (Android):** `com.rumahmakan.posoffline`
* **Slug Proyek:** `pos-offline`
* **Versi Rilis:** `1.0.0`
* **Orientasi Layar:** Landscape Locked (Optimal Redmi Pad 2 11" 2.5K & Kompatibel HP)
* **Arsitektur:** Offline-First (SQLite Lokal Murni, tanpa internet)
* **SDK / Framework:** Expo SDK 54 (`~54.0.37`), React Native 0.81.5, React 19, Hermes Engine, New Architecture Enabled
* **State Management:** Zustand 5
* **Akun EAS Cloud:** `rikire` (`rikyrivaldi369@gmail.com`)
* **Project ID EAS:** `97d847aa-a65d-4eb8-9d21-33f936cce00e`
* **Commit Terakhir:** `a1de3d9` (*feat: implementasi setor kas laci ke bank, jam realtime dashboard kasir, serta responsivitas landscape portrait keuangan pengaturan*)
* **Dashboard Build EAS (Build Baru):**
  🔗 [Expo Build Dashboard (Build ID: c376fe26)](https://expo.dev/accounts/rikire/projects/pos-offline/builds/c376fe26-ee29-4f8d-856c-414d1eee738f)
* **Tautan Unduhan Cloud APK Terakhir (Rilis Sebelumnya):**
  🔗 [Download APK Release (Expo EAS)](https://expo.dev/artifacts/eas/tmPpAMITrbMDduPgkKND1PW7oGWaM6sB_-0Z4SeQPq4.apk)

---

## 2. Struktur Proyek & Peta Folder

```text
POS-Offline-main/
├── app/                              # Rute Navigasi (Expo Router)
│   ├── _layout.tsx                   # Root Stack & Animated Splash Screen Provider
│   ├── transaksi.tsx                 # Layar Utama Kasir (Split Panel, Barcode, Pending, Hutang)
│   ├── debt-receivable.tsx           # Sub-Menu Mandiri Hutang Supplier & Piutang Pelanggan
│   ├── (tabs)/                       # Tab Bar Bawah (5 Menu Utama)
│   │   ├── _layout.tsx               # Konfigurasi Tab Bar & Hidden Routes
│   │   ├── index.tsx                 # Dashboard Penjualan & Header Toko
│   │   ├── explore.tsx               # Manajemen Produk, Stok Opname & Beli Stok (Tunai/Kredit)
│   │   ├── history.tsx               # Riwayat Transaksi & Detail Nota
│   │   ├── financial-reports.tsx     # Laba Rugi (SAK EMKM Slip) & Buku Kas (Landscape Split-Panel)
│   │   ├── settings.tsx              # Pengaturan Utama & Akses Sub-Menu
│   │   ├── printer.tsx               # Pengaturan Printer Bluetooth Thermal 58mm
│   │   ├── reports.tsx               # Laporan Grafik & Jam Sibuk
│   │   ├── store-settings.tsx        # Profil Toko, QRIS, Orientasi Layar & PIN Admin
│   │   └── data-management.tsx       # Ekspor/Impor CSV & Reset Pabrik
├── components/                       # Komponen UI & Modal Interaktif
│   ├── animated-splash-screen.tsx    # Animasi Pembuka Aplikasi (Logo Lengkap)
│   ├── barcode-scanner-modal.tsx     # Pemindai Barcode Kamera Belakang (Torch & Zoom)
│   ├── bulk-qty-modal.tsx            # Input Qty Borongan/Grosir Cepat
│   ├── cash-shift-modal.tsx          # Modal Buka & Tutup Shift Kasir (Z-Report)
│   ├── custom-date-picker-modal.tsx  # Modal Pemilih Tanggal Kalender
│   ├── discount-modal.tsx            # Modal Diskon Transaksi (Nominal Rp & Persen %)
│   ├── edit-cart-price-modal.tsx     # Modal Override Harga Satuan di Keranjang
│   ├── product-search-modal.tsx      # Modal Pencarian Cepat Produk Stok & Kulakan
│   ├── qris-display-modal.tsx        # Tampilan Layar Penuh QRIS untuk Pelanggan
│   ├── receipt-preview-modal.tsx     # Pratinjau Kertas Struk 58mm Presisi
│   ├── role-login-modal.tsx          # Modal Login PIN Otorisasi Kasir vs Pemilik
│   ├── weighted-product-modal.tsx    # Modal Timbangan Produk Curah (Gram / Kg)
│   ├── admin-pin-modal.tsx           # Otorisasi Keamanan PIN 6-Digit
│   └── onboarding-modal.tsx          # Wizard Inisialisasi Toko Baru
├── stores/                           # State Management (Zustand)
│   ├── productStore.ts               # CRUD Produk, Kategori, Multi-Barcode & Kadaluarsa
│   ├── transactionStore.ts           # Keranjang, Diskon, Checkout Tunai/QRIS/Hutang, HPP
│   ├── cashStore.ts                  # Buku Kas Fisik & Kategori Mutasi Arus Kas
│   ├── shiftStore.ts                 # Sesi Shift Kasir, Riwayat & Rekonsiliasi Z-Report
│   ├── debtReceivableStore.ts        # Buku CRM Pelanggan/Supplier, Hutang & Kasbon
│   ├── purchaseStore.ts              # Beli Stok (Kas Toko vs Bank & Tempo)
│   ├── printerStore.ts               # Status Koneksi Bluetooth & Target MAC Address
│   └── settingsStore.ts              # Preferensi Toko, Orientasi Layar, Peran & PIN
├── services/                         # Logika Data, Ekspor & Hardware
│   ├── database.ts                   # SQLite Database Engine & Skema Migrasi (v12)
│   ├── backup.ts                     # 1-Click Backup & Restore 18 Tabel SQLite (JSON)
│   ├── export.ts                     # Generator File PDF & CSV (Sharing API)
│   └── print.ts                      # Protokol Raw Thermal ESC/POS (58mm/32 Kolom) & Z-Report
├── assets/images/                    # Aset Logo & Grafis
│   ├── app-logo-p.png                # Logo "P" Biasa (Ikon Launcher & Dashboard)
│   ├── app-logo-full.png             # Logo Lengkap dengan Nama (Animasi Splash)
│   ├── icon.png                      # App Launcher Icon 1024x1024
│   ├── android-icon-foreground.png   # Adaptive Icon Foreground
│   ├── splash-icon.png               # Native Splash Icon
│   └── favicon.png                   # Web Browser Favicon
├── app.json                          # Manifest Expo & Konfigurasi Plugin
├── eas.json                          # Profil Build Android (preview APK & production AAB)
└── PROJECT_DOCUMENTATION.md          # Dokumen Resmi Master Proyek
```

---

## 3. Skema Database SQLite (Versi 12 Terkini)

File: `services/database.ts` (`DATABASE_VERSION = 12`). Database dijalankan secara lokal offline (`pos.db`) dengan indeks performa tinggi untuk ribuan produk dan transaksi.

### A. Tabel Master Produk & Inventaris
```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,  -- Harga modal kulakan barang
  stock INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER,
  sku TEXT,
  barcode TEXT,
  has_stock INTEGER NOT NULL DEFAULT 1, -- 1: Dikelola stoknya, 0: Tanpa stok (jasa/kuliner)
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0
);
```

### B. Tabel Transaksi Penjualan
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,         -- 'tunai' | 'qris' | 'hutang'
  payment_amount REAL NOT NULL,
  change REAL NOT NULL,
  customer_id INTEGER,                  -- Relasi ke tabel customers jika pembayaran hutang/bon
  is_credit INTEGER DEFAULT 0,          -- 1 jika transaksi hutang/bon, 0 jika lunas (tunai/qris)
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,   -- Snapshot harga modal saat transaksi terjadi
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
```

### C. Tabel Pembelian Stok (Kulakan)
```sql
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL,
  supplier_id INTEGER,                  -- Relasi ke tabel suppliers
  supplier_name TEXT NOT NULL,
  total_amount REAL NOT NULL,
  payment_type TEXT DEFAULT 'cash',     -- 'cash' (Tunai) | 'credit' (Kredit)
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  cost_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id)
);
```

### D. Tabel Buku Kas (Single Source of Truth Kas Fisik Laci)
```sql
CREATE TABLE cash_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                  -- 'in' (Penerimaan Kas) | 'out' (Pengeluaran Kas)
  category TEXT NOT NULL,              -- Kategori mutasi kas (kulakan_stok, operasional, dll)
  description TEXT NOT NULL,           -- Uraian mutasi kas
  amount REAL NOT NULL,
  date TEXT NOT NULL,                  -- Tanggal format 'YYYY-MM-DD'
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
```

### E. Tabel CRM, Hutang & Piutang Usaha
```sql
-- Data Master Pelanggan & Supplier
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- Piutang Pelanggan (Kasbon) & Riwayat Cicilan
CREATE TABLE customer_receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  transaction_id INTEGER,
  total_amount REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid' | 'partial' | 'paid'
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE receivable_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receivable_id INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- Hutang Supplier & Riwayat Cicilan
CREATE TABLE supplier_debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  purchase_id INTEGER,
  total_amount REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid' | 'partial' | 'paid'
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE debt_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debt_id INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
```

### F. Tabel Pesanan Pending (Antrean Kasir)
```sql
CREATE TABLE pending_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note TEXT NOT NULL DEFAULT '',         -- Nama pelanggan / catatan antrean
  total_amount REAL NOT NULL,
  items_json TEXT NOT NULL,              -- Serialized JSON keranjang pesanan
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
```

### G. Indeks Database Performa Tinggi (v10)
```sql
-- Indeks pencarian instan untuk katalog kasir & scan barcode ribuan produk
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);

-- Indeks performa pelaporan dan riwayat transaksi skala besar
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transaction_items_txid ON transaction_items(transaction_id);
CREATE INDEX idx_cash_ledger_date ON cash_ledger(date);
```

---

## 4. Standar Perhitungan Keuangan & Integritas Akuntansi

1. **Penjualan Bruto (Revenue):**
   * Formula: `SUM(total)` dari tabel `transactions`.
   * Pembayaran piutang pelanggan di Buku Kas (`category = 'pelunasan_piutang'`) tidak digabung ke omzet penjualan agar tidak terjadi pencatatan ganda (*double-counting*).
2. **Harga Pokok Penjualan (HPP):**
   * Formula: `SUM(ti.quantity * ti.cost_price)` dari `transaction_items`.
   * Menggunakan snapshot harga modal pada saat transaksi terjadi.
3. **Laba Kotor Usaha:**
   * Formula: `Penjualan Bruto - HPP`.
4. **Beban Operasional Usaha (Laba/Rugi SAK EMKM):**
   * Formula: `SUM(amount)` dari `cash_ledger WHERE type = 'out' AND category NOT IN ('kulakan_stok', 'bayar_hutang_supplier')`.
   * Pengeluaran kas untuk kulakan stok dan pembayaran hutang supplier otomatis dikecualikan dari beban operasional, karena persediaan sudah diakui bebannya lewat HPP saat barang terjual.
5. **Laba Bersih:**
   * Formula: `(Laba Kotor - Beban Operasional) + Pendapatan Non-Operasional`.
6. **Saldo Kas Fisik (Laci Kasir):**
   * **Beli Stok Tunai:** Saldo kas fisik berkurang (`-`), stok bertambah (`+`), hutang = 0.
   * **Beli Stok Kredit:** Saldo kas fisik **TETAP**, stok bertambah (`+`), hutang supplier bertambah (`+`).
   * **Jual Tunai:** Saldo kas fisik bertambah (`+`), stok berkurang (`-`), piutang = 0.
   * **Jual QRIS:** Saldo kas fisik **TETAP** (karena uang masuk bank/e-wallet), stok berkurang (`-`).
   * **Jual Hutang (Bon Kasir):** Saldo kas fisik **TETAP**, stok berkurang (`-`), piutang customer bertambah (`+`).

---

## 5. Rekap Fitur Terbaru (Selesai 7 September 2026)

### 1. Pembelian Stok (Tunai vs Kredit & Dropdown Supplier CRM)
* **File:** `stores/purchaseStore.ts`, `app/(tabs)/explore.tsx`
* **Fitur:**
  * Tombol toggle **💵 Tunai** dan **📋 Kredit** pada form Beli Stok.
  * **Pilihan Tunai:** Memeriksa saldo kas toko fisik dan memotong saldo di `cash_ledger` (kategori `kulakan_stok`).
  * **Pilihan Kredit:** Kas toko fisik **tidak berkurang sama sekali**, stok bertambah, dan otomatis tercatat sebagai hutang di tabel `supplier_debts` (status `unpaid`) pada modul Manajemen Supplier / Hutang.
  * **Chip Supplier CRM:** Menampilkan daftar nama supplier yang sudah terdaftar di CRM dalam bentuk deretan chip horizontal yang dapat dipilih dengan sekali sentuh, atau ketik nama supplier baru.

### 2. Penyempurnaan Fitur Pending (Retail Toko Sosis)
* **File:** `app/transaksi.tsx`
* **Fitur:**
  * Mengubah seluruh label **"Tahan"** menjadi **"Pending"** (`⏳ Pending`, modal `Pending Pesanan`, list `Daftar Pesanan Pending`, dan badge).
  * **Nomor Meja Dihilangkan:** Form disesuaikan khusus untuk retail toko agen sosis/sembako.
  * **Pilihan Pelanggan CRM:** Disediakan tombol chip cepat berisi nama-nama pelanggan yang sudah terdaftar di CRM, serta opsi ketik manual nama pelanggan baru.

### 3. Metode Pembayaran Kasir: "Hutang" / Bon Pelanggan
* **File:** `stores/transactionStore.ts`, `app/transaksi.tsx`, `services/print.ts`
* **Fitur:**
  * Menambahkan tombol metode bayar **📋 Hutang (Bon)** pada Step 2 Pembayaran kasir (selain Tunai dan QRIS).
  * Kasir dapat memilih pelanggan dari CRM atau menginput pelanggan baru.
  * **Tanpa Form Jatuh Tempo:** Ditiadakan agar proses kasir cepat dan praktis.
  * **Integritas Kasir:** Transaksi hutang tidak menambah kas fisik laci, namun tetap memotong stok produk dan otomatis mencatat piutang di tabel `customer_receivables`.
  * **Struk Bon:** Cetak printer thermal Bluetooth menyertakan keterangan `Metode: HUTANG / BON` dan penegasan `Status: BELUM LUNAS`.

### 4. Perapian Tampilan Buku Kas Keuangan (Minimalis & Landscape-First)
* **File:** `app/(tabs)/financial-reports.tsx`
* **Fitur:**
  * Mengganti susunan 4 blok vertikal menjadi **Landscape Split-Panel** yang ramping dan bersih:
    * **Panel Kiri:** Saldo Kas Fisik Tersedia dengan indikator kas aktif serta dua kotak metrik ringkas: `📥 Kas Masuk (+)` dan `📤 Kas Keluar (-)`.
    * **Panel Kanan:** Grid tombol aksi ringkas: `+ Kas Masuk` & `- Kas Keluar` serta tombol ekspor `📄 PDF Masuk` & `📄 PDF Keluar`.
    * **Banner Buku Hutang & Piutang:** Banner horizontal minimalis dengan badge jumlah piutang dan hutang yang belum lunas secara live, dan tombol navigasi cepat `Buka ›`.
  * Memberikan ruang vertikal yang lega untuk menggulir riwayat mutasi buku kas dengan nyaman.

### 5. Smart CSV Import & Export Produk (Format Standar & Optimasi Ribuan Produk)
* **File:** `services/export.ts`, `app/(tabs)/data-management.tsx`, `services/database.ts`
* **Fitur:**
  * **Format Kolom Standar Baru:**
    `Barcode, Nama Produk, Kategori, Harga Jual, Harga Modal, Stok, Kelola Stok`
  * **Smart Auto-Detect Delimiter:** Mendukung secara otomatis file CSV dengan pemisah koma (`,`), titik koma (`;` default Microsoft Excel Indonesia/Windows), maupun tab (`\t`).
  * **Smart Header Mapping:** Otomatis mendeteksi nama kolom (nama, harga, modal, stok, barcode, kategori) secara cerdas terlepas dari urutan posisi kolom file CSV sumber.
  * **Pembersihan Angka Rupiah:** Mampu membaca format angka Indonesia dengan titik ribuan (`15.000` menjadi `15000`), desimal koma, dan prefix `Rp`.
  * **Pembersihan BOM Excel:** Menghilangkan karakter Byte Order Mark (`\uFEFF`) agar tidak merusak karakter baris pertama.
  * **Tombol Unduh Template CSV:** Disediakan tombol langsung "Contoh Template CSV" di menu Manajemen Data untuk membagikan/mengunduh file format resmi.
  * **Optimasi Performa Tinggi (Database v10):** Caching kategori dan produk ke memori O(1) selama import massal, serta penambahan indeks SQLite (`idx_products_barcode`, `idx_products_name`, `idx_products_category`, `idx_transactions_created_at`, `idx_transaction_items_txid`, `idx_cash_ledger_date`) sehingga aplikasi tetap responsif 60fps meski memiliki ribuan produk dan transaksi.

---

## 6. Desain UI/UX & Adaptasi Layar (HP vs Tablet/iPad)

Aplikasi dibangun dengan prinsip **Landscape-First & Responsive Proportional Layout**:

1. **Dukungan Tablet Native:**
   * Di `app.json`, `"supportsTablet": true` telah aktif.
2. **Katalog Produk Cerdas:**
   * Menggunakan `useWindowDimensions()`.
   * Layar HP (lebar < 720px): Menampilkan **2 kolom** produk.
   * Layar Tablet Sedang (lebar 720px - 1050px): Menampilkan **3 kolom** produk.
   * Layar Tablet Besar / iPad (lebar >= 1050px): Menampilkan **4 kolom** produk.
3. **Split-Panel Berimbang:**
   * Menggunakan rasio fleksibel (`flex: 1.3` untuk panel produk di kiri, `flex: 0.9` untuk panel keranjang di kanan).
   * Pada tablet, panel keranjang belanja sangat lega dan mampu menampilkan banyak baris belanjaan tanpa terpotong.
4. **Modal Dialog Terpusat:**
   * Seluruh pop-up dialog menggunakan `maxWidth: 600` dan posisi tengah (*centered*), sehingga pada layar tablet atau iPad dialog tidak melebar secara berlebihan, melainkan tetap proporsional dan elegan.

---

---

## 7. Rekap Sesi Pengembangan (8 September 2026) — Optimasi Tablet Redmi Pad 2 & Fitur Profesional

Sesi ini berfokus pada penyempurnaan menyeluruh pengalaman pengguna pada tablet **Redmi Pad 2 (11 inci 2.5K)** dan penambahan 4 fitur enterprise kasir:

### A. Desain & Ergonomi Layar
1. **Tombol Masuk Kasir di Bawah:** Ditempatkan di bagian paling bawah layar dashboard tepat di atas tab navigasi agar mudah dijangkau saat tablet ditaruh di stand kasir.
2. **Layout Grid 2-Kolom Seimbang:** Kolom kiri untuk metrik kas riil dan perbandingan hari ini vs kemarin; kolom kanan untuk status operasional, item terjual, grafik 7 hari, dan peringatan kadaluarsa.
3. **Pemisahan Peran Pengguna (Kasir vs Pemilik):** Sesi login tersimpan selama aplikasi berjalan. Kasir hanya mengakses menu transaksi & katalog; fitur sensitif diproteksi PIN 6-digit.

### B. Produk & Inventaris
4. **Multi-Barcode per Produk:** Mendukung input banyak barcode dengan scan kamera langsung untuk kemasan yang berubah atau variasi batch.
5. **Produk Timbangan Curah (`is_weighted`):** Perhitungan harga berbasis gram/kg dengan modal timbangan interaktif.
6. **Tanggal Kadaluarsa (`expired_date`) & Expired Alert:** Input kalender kadaluarsa di form produk dan widget pemantauan otomatis ($\le 30$ hari) di dashboard.
7. **Pembaruan Stok Cepat:** Mengganti istilah "Stok Opname" menjadi "Pembaruan Stok" dengan modal cari cepat `ProductSearchModal`.
8. **Pembelian Stok Tunai vs Bank & Tempo:** Pemisahan sumber dana pembelian (Kas Toko laci vs Rekening/Pribadi) dan tanggal jatuh tempo cepat (+1, +3, +7, +14 hari).

### C. Transaksi Kasir & Akuntansi
9. **Diskon Transaksi (Nominal Rp & Persen %):** Input diskon pada keranjang kasir dengan preset tombol cepat, rincian subtotal/diskon/total, serta pencetakan pada struk.
10. **Override Harga Keranjang:** Kasir dapat mengetuk harga satuan barang di keranjang untuk mengubah harga tanpa mengubah master data produk.
11. **Presisi Pembukuan Saldo Kas Laci:** Pemisahan mutasi kas bruto vs kembalian sehingga saldo kas riil di laci akurat 100%.
12. **Perapian Form Pembayaran Hutang / Bon:** Desain form hutang bebas dari tombol ganda dan mendukung scrolling proporsional.
13. **Format Struk Thermal 58mm Presisi:** Kertas dikunci 58mm (32 karakter), auto-wrap nama barang panjang, dan hasil cetak fisik persis sama dengan preview pengaturan.

### D. Manajemen Shift & Keamanan Data
14. **Shift Kasir & Laporan Z-Report 58mm:** Buka shift (modal awal), chip status di header, tutup shift dengan rekonsiliasi kas fisik vs sistem, serta cetak struk Z-Report resmi 58mm.
15. **1-Click Full Backup & Restore:** Pencadangan seluruh 18 tabel SQLite ke berkas `.json` bertanggal untuk disimpan ke Google Drive / USB OTG, serta pemulihan atomik aman via `withTransactionAsync`.

---

## 8. Panduan Build Aplikasi (Cloud EAS vs Lokal)

### Kenapa Memakai Expo EAS Cloud?
1. **Waktu Kompilasi Cepat (~14 Menit):** Server Linux Expo telah dikonfigurasi optimal untuk NDK, CMake, dan toolchain React Native New Architecture.
2. **Bebas Error Linker C++ Windows:** Build lokal pada laptop Windows sebelumnya memakan waktu **38 menit 19 detik** dan terhenti pada linker Clang/LLD NDK modul `react-native-screens` (masalah kompatibilitas path panjang dan toolchain Windows).
3. **Hasil Otomatis Tersimpan di Data D:** Setelah build di server selesai, file APK langsung diunduh ke folder proyek laptop.

### Perintah Build & Download ke Data D:
```powershell
# 1. Pastikan perubahan sudah dicommit
git add .
git commit -m "feat: deskripsi pembaruan"

# 2. Jalankan build di Expo Cloud (profil preview menghasilkan file .apk standalone)
npx eas-cli build --platform android --profile preview --non-interactive

# 3. Pantau status build melalui dashboard atau CLI:
npx eas-cli build:view [BUILD_ID]

# 4. Unduh file APK hasil build terbaru:
powershell -Command "Invoke-WebRequest -Uri 'https://expo.dev/artifacts/eas/tmPpAMITrbMDduPgkKND1PW7oGWaM6sB_-0Z4SeQPq4.apk' -OutFile 'D:\PROJEK APLIKASI POS OFFLINE\POS-Offline-source-code\POS-Offline-main\POS-Offline-release.apk'"
```

---

## 9. Panduan Verifikasi Kode

Sebelum memulai perubahan atau melakukan build baru, jalankan selalu:
```powershell
# Uji tipe TypeScript (harus Exit Code 0)
npx tsc --noEmit

# Uji Metro Bundler
npx expo export --platform android
```

---

*Dokumen ini diperbarui secara resmi pada 8 September 2026 sebagai catatan riwayat lengkap dan panduan kesinambungan proyek POS Karya Riki Rivaldi.*
