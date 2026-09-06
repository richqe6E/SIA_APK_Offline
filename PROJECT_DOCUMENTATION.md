# DOKUMENTASI SISTEM & PRD FINAL
# POS Karya Riki Rivaldi (Aplikasi Point of Sale Offline)

*Dokumen ini merupakan catatan riwayat resmi, spesifikasi teknis (PRD), skema database, dan panduan pemeliharaan untuk pengembangan atau perombakan sistem di masa mendatang.*

---

## 1. Identitas & Informasi Rilis Terakhir

* **Nama Aplikasi:** POS Karya Riki Rivaldi
* **Package Name (Android):** `com.rumahmakan.posoffline`
* **Slug Proyek:** `pos-offline`
* **Versi Rilis:** `1.0.0`
* **Arsitektur:** Offline-First (SQLite Lokal)
* **SDK / Framework:** Expo SDK 54 (`~54.0.37`), React Native 0.81.5, React 19, Hermes Engine
* **State Management:** Zustand 5
* **Akun EAS Cloud:** `rikire` (`rikyrivaldi369@gmail.com`)
* **Project ID EAS:** `97d847aa-a65d-4eb8-9d21-33f936cce00e`
* **Commit Terakhir:** `6316bc1` (*feat: implement Fase 1-5, split logos, animated splash, and accounting integrity*)
* **File APK Terakhir (Siap Install):**
  🔗 [Download APK Release (Expo EAS)](https://expo.dev/artifacts/eas/2jGnyNbw5Ffb5Jg2xOO1RjIpzBtQhh6eqMfZs5A5gU0.apk)
* **Dashboard Build:**
  🔗 [Expo Build Dashboard](https://expo.dev/accounts/rikire/projects/pos-offline/builds/b36d337f-7211-41e4-9be5-928409ffbf67)

---

## 2. Struktur Proyek & Peta Folder

```text
POS-Offline-main/
├── app/                              # Rute Navigasi (Expo Router)
│   ├── _layout.tsx                   # Root Stack & Animated Splash Screen Provider
│   ├── transaksi.tsx                 # Layar Utama Kasir (Split Panel Landscape/Portrait)
│   ├── debt-receivable.tsx           # Sub-Menu Mandiri Hutang Supplier & Piutang Pelanggan
│   ├── (tabs)/                       # Tab Bar Bawah (5 Menu Utama)
│   │   ├── _layout.tsx               # Konfigurasi Tab Bar & Hidden Routes
│   │   ├── index.tsx                 # Dashboard Penjualan & Header Toko
│   │   ├── explore.tsx               # Manajemen Produk & Stok Opname (has_stock = 1)
│   │   ├── history.tsx               # Riwayat Transaksi & Detail Nota
│   │   ├── financial-reports.tsx     # Laba Rugi (SAK EMKM Slip) & Buku Kas (Cash Ledger)
│   │   ├── settings.tsx              # Pengaturan Utama & Akses Sub-Menu
│   │   ├── printer.tsx               # Pengaturan Printer Bluetooth Thermal 58mm
│   │   ├── reports.tsx               # Laporan Grafik & Jam Sibuk
│   │   ├── store-settings.tsx        # Profil Toko, QRIS, Orientasi Layar & PIN Admin
│   │   └── data-management.tsx       # Ekspor/Impor CSV & Reset Pabrik
├── components/                       # Komponen UI & Modal Interaktif
│   ├── animated-splash-screen.tsx    # Animasi Pembuka Aplikasi (Logo Lengkap)
│   ├── barcode-scanner-modal.tsx     # Pemindai Barcode Kamera Belakang (Torch & Zoom)
│   ├── bulk-qty-modal.tsx            # Input Qty Borongan/Grosir Cepat
│   ├── qris-display-modal.tsx        # Tampilan Layar Penuh QRIS untuk Pelanggan
│   ├── receipt-preview-modal.tsx     # Pratinjau Kertas Struk 58mm (Tanpa Ikon Mata)
│   ├── admin-pin-modal.tsx           # Otorisasi Keamanan PIN 6-Digit
│   └── onboarding-modal.tsx          # Wizard Inisialisasi Toko Baru
├── stores/                           # State Management (Zustand)
│   ├── productStore.ts               # CRUD Produk, Kategori & Stok Opname
│   ├── transactionStore.ts           # Keranjang, Checkout, Snapshot HPP & Pengurangan Stok
│   ├── cashStore.ts                  # Buku Kas Fisik & Kategori Mutasi Arus Kas
│   ├── debtReceivableStore.ts        # Buku CRM Pelanggan/Supplier, Hutang & Kasbon
│   ├── purchaseStore.ts              # Kulakan Stok Barang & Validasi Saldo Kas
│   ├── printerStore.ts               # Status Koneksi Bluetooth & Target MAC Address
│   └── settingsStore.ts              # Preferensi Toko, Orientasi Layar & PIN
├── services/                         # Logika Data, Ekspor & Hardware
│   ├── database.ts                   # SQLite Database Engine & Skema Migrasi (v7)
│   ├── export.ts                     # Generator File PDF & CSV (Sharing API)
│   └── print.ts                      # Protokol Raw Thermal ESC/POS (58mm/32 Kolom)
├── assets/images/                    # Aset Logo & Grafis
│   ├── app-logo-p.png                # Logo "P" Biasa (Ikon Launcher & Dashboard)
│   ├── app-logo-full.png             # Logo Lengkap dengan Nama (Animasi Splash)
│   ├── icon.png                      # App Launcher Icon 1024x1024
│   ├── android-icon-foreground.png   # Adaptive Icon Foreground
│   ├── splash-icon.png               # Native Splash Icon
│   └── favicon.png                   # Web Browser Favicon
├── app.json                          # Manifest Expo & Konfigurasi Plugin
└── eas.json                          # Profil Build Android (preview APK & production AAB)
```

---

## 3. Skema Database SQLite (Versi 7 Terkini)

File: `services/database.ts` (`DATABASE_VERSION = 7`). Database dijalankan secara lokal tanpa memerlukan internet (`pos.db`).

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
  payment_method TEXT NOT NULL,         -- 'tunai' | 'qris' | 'transfer'
  payment_amount REAL NOT NULL,
  change REAL NOT NULL,
  customer_id INTEGER,
  is_credit INTEGER DEFAULT 0,
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
  supplier_id INTEGER,
  supplier_name TEXT NOT NULL,
  total_amount REAL NOT NULL,
  payment_type TEXT DEFAULT 'cash',
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

### D. Tabel Buku Kas (Single Source of Truth Kas Fisik)
```sql
CREATE TABLE cash_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                  -- 'in' (Penerimaan Kas) | 'out' (Pengeluaran Kas)
  category TEXT NOT NULL,              -- Kategori mutasi kas
  description TEXT NOT NULL,           -- Uraian mutasi
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

---

## 4. Standar Perhitungan Keuangan (SAK EMKM)

Sistem mengadopsi akuntansi kas murni dan laba rugi berbasis SAK EMKM agar perhitungan tidak mengalami kerancuan atau pencatatan ganda:

1. **Penjualan Bruto (Revenue):**
   * Formula: `SUM(total)` dari tabel `transactions`.
   * Pembayaran piutang pelanggan di Buku Kas (`category = 'pelunasan_piutang'`) **tidak digabungkan ke penjualan bruto** untuk mencegah omzet tercatat dua kali.
2. **Harga Pokok Penjualan (HPP):**
   * Formula: `SUM(ti.quantity * ti.cost_price)` dari `transaction_items`.
   * Menggunakan snapshot `cost_price` pada saat transaksi terjadi.
3. **Laba Kotor Usaha:**
   * Formula: `Penjualan Bruto - HPP`.
4. **Beban Operasional Usaha:**
   * Formula: `SUM(amount)` dari `cash_ledger WHERE type = 'out' AND category NOT IN ('kulakan_stok', 'bayar_hutang_supplier')`.
   * **Aturan Pencegahan Double-Counting:** Pengeluaran kas untuk kulakan stok barang dan pembayaran hutang supplier otomatis dikecualikan dari beban operasional Laba Rugi, karena persediaan diakui bebannya lewat HPP saat barang terjual.
5. **Pendapatan Non-Operasional:**
   * Formula: `SUM(amount)` dari `cash_ledger WHERE type = 'in' AND category = 'pendapatan_lain'`.
   * Setoran modal pemilik (`setoran_modal`) dan pelunasan piutang tidak dimasukkan ke laba rugi karena bukan pendapatan usaha.
6. **Laba Bersih:**
   * Formula: `(Laba Kotor - Beban Operasional) + Pendapatan Non-Operasional`.
7. **Saldo Kas Fisik (Cash Drawer Toko):**
   * Formula: `(Penjualan Tunai + Kas Masuk Manual) - Kas Keluar Manual`.
   * Penjualan QRIS otomatis tidak menambah kas fisik laci (karena masuk ke bank/e-wallet).
8. **Financial Guardrails:**
   * Toko dilarang melakukan pembelian stok (`purchaseStore.ts`) atau membayar hutang supplier (`debtReceivableStore.ts`) melebihi saldo kas fisik yang ada di laci kasir.

---

## 5. Rangkuman Fitur yang Telah Diselesaikan

### A. Tampilan & Branding
* **Animasi Pembuka (Animated Splash):** Memuat logo lengkap bertuliskan **"POS Karya Riki Rivaldi"** dengan animasi fade-in dan spring scale lembut saat aplikasi dibuka.
* **Ikon Aplikasi:** Menggunakan logo huruf **P** dengan panah ke atas untuk launcher HP dan kartu header Dashboard.
* **Standardisasi Baris Atas (Top Header):** Seluruh sub-halaman (`printer.tsx`, `reports.tsx`, `debt-receivable.tsx`, `store-settings.tsx`, `data-management.tsx`) seragam memiliki tombol `← Keluar` di kiri atas dan judul di kanan atas.
* **Preview Desain Struk (58mm):** Tanpa menggunakan ikon mata (`👁️`), hanya teks bersih `"Preview Desain Struk (58mm)"` di 3 titik menu.

### B. Transaksi & Kasir
* **Layout Split Panel Landscape:** Katalog di sisi kiri (3-4 kolom adaptif) dan ringkasan pesanan/pembayaran di sisi kanan.
* **Pemindai Barcode Kamera Belakang:** Menggunakan kamera belakang dengan tombol on/off flash dan zoom.
* **Input Qty Borongan/Grosir:** Modal khusus untuk mengganti quantity item dalam jumlah besar secara instan.
* **QRIS Layar Penuh:** Membuka tampilan QRIS toko berukuran besar agar mudah di-scan oleh pelanggan dari meja kasir.
* **Pengurangan Stok Otomatis:** Menggunakan `MAX(0, stock - qty)` sehingga transaksi tidak terblokir jika stok mencapai 0.

### C. Laporan & Keuangan
* **Kertas Kerja Laba Rugi Resmi (Slip SAK EMKM):** Modal kertas formal dengan format standar akuntansi, rincian beban operasional, volume transaksi, dan kolom tanda tangan pengesahan kasir & pemilik.
* **Ekspor PDF & CSV:** Menyediakan ekspor dokumen resmi berstandar cetak untuk Laba Rugi, Buku Kas Masuk/Keluar, Riwayat Transaksi, dan Katalog Produk.
* **Stok Opname Tertarget:** Hanya memuat produk yang ber-stok (`has_stock = 1`).
* **Date Picker Kalender:** Pemilihan tanggal mutasi kas dan rentang laporan menggunakan dialog kalender interaktif native.

### D. Sub-Menu Hutang & Piutang Usaha
* Terletak di sub-menu Pengaturan (tidak mengotori tab bar bawah).
* Mengelola kasbon pelanggan (piutang) dan hutang supplier.
* Mendukung pelunasan bertahap (cicilan) atau lunas, pencatatan tanggal dengan kalender, serta riwayat log pembayaran yang otomatis tercatat ke Buku Kas.

### E. Keamanan & Utilitas
* **PIN Admin 6-Digit:** Melindungi akses pengaturan toko dan Reset Pabrik (*Factory Reset*).
* **Kunci Orientasi Layar:** Dapat dikunci ke Portrait (HP) atau Landscape (Tablet) melalui Atur Toko.

---

## 6. Panduan Pengujian & Build Ulang di Masa Depan

### A. Menjalankan Mode Pengembangan (Local Dev)
```powershell
# Jalankan Expo Metro Bundler
npx expo start

# Jalankan di emulator / perangkat fisik Android
npx expo run:android
```

### B. Verifikasi Integritas Kode (Kompilasi)
Sebelum melakukan build, selalu jalankan dua perintah verifikasi ini untuk memastikan tidak ada error sintaks atau bundling:
```powershell
# 1. Uji Tipe TypeScript (Harus Exit Code 0)
npx tsc --noEmit

# 2. Uji Bundling Metro Android (Harus selesai 100% tanpa error)
npx expo export --platform android
```

### C. Membuat File APK Baru via EAS Cloud
Pastikan perubahan sudah di-commit ke Git, lalu jalankan:
```powershell
# Commit perubahan
git add .
git commit -m "Deskripsi pembaruan"

# Build APK Release Standalone (profil preview menghasilkan file .apk)
eas build --platform android --profile preview --non-interactive
```

### D. Menambah Kolom / Tabel Database Baru (Migrasi SQLite)
Jika di masa depan ingin menambah tabel atau kolom baru:
1. Buka `services/database.ts`.
2. Naikkan konstanta `DATABASE_VERSION` (misal dari `7` menjadi `8`).
3. Tambahkan blok logika alter table / create table baru pada fungsi `migrateDbIfNeeded`:
```typescript
if (currentVersion < 8) {
  await db.execAsync(`
    -- Tulis query SQL penambahan tabel/kolom di sini
  `);
}
```

---

*Dokumen ini dibuat secara otomatis sebagai rangkuman pengerjaan proyek POS Karya Riki Rivaldi.*
