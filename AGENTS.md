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
* **Akun EAS**: `risgoldofficial23`
* **Profile**: `preview` (Format output berupa **.APK** langsung siap install di Android).
* **Build Kasir Tablet**:
  ```powershell
  # Dijalankan di folder root POS-Offline-main
  eas build -p android --profile preview --non-interactive --no-wait
  ```
* **Build Pemantau Smartphone**:
  ```powershell
  # Dijalankan di folder kendali-usaha-azizah
  cd kendali-usaha-azizah
  eas build -p android --profile preview --non-interactive --no-wait
  ```

