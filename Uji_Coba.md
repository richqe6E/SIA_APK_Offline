# SKENARIO UJI COBA OPERASIONAL SISTEM POS (15 TRANSAKSI LENGKAP)
## Aplikasi POS Agen Sosis Azizah (POS Karya Riki Rivaldi)

Dokumen ini disusun sebagai panduan pengujian manual interaktif langkah-demi-langkah bagi pemilik toko dan kasir untuk memverifikasi keakuratan operasional, alur kas, buku hutang/piutang, hingga laporan laba rugi SAK EMKM pada aplikasi **POS AZIZAH**.

Semua produk, harga jual, harga modal (HPP), supplier, dan pelanggan yang digunakan dalam simulasi ini diambil langsung dari **data riil database toko**.

---

## 📋 DAFTAR PRODUK & ENTITAS YANG DIGUNAKAN

### A. Data Produk Riil Toko
| No | Nama Produk | Harga Jual | Harga Modal (HPP) | Kategori / Satuan |
|:--:|:---|:---:|:---:|:---:|
| 1 | **Sosis champ ayam 500** | Rp 30.000 | Rp 26.675 | Sosis / Pcs |
| 2 | **Naget Kanzler Spicy 450 gr** | Rp 50.000 | Rp 40.600 | Nugget / Pcs |
| 3 | **Chikuwa Cedea Pack 500 gr** | Rp 31.500 | Rp 28.661 | Cedea / Pcs |
| 4 | **Sosis asimo 1 kg** | Rp 45.000 | Rp 37.730 | Sosis / Pcs |
| 5 | **Dumpling keju cedea 500 gr** | Rp 32.000 | Rp 28.661 | Cedea / Pcs |
| 6 | **Bakpao Karakter** | Rp 20.000 | Rp 15.500 | Frozen / Pcs |
| 7 | **Bakso Champ Ayam** | Rp 30.000 | Rp 26.424 | Bakso / Pcs |
| 8 | **Sosis Yona Breakfast 450 gr** | Rp 33.000 | Rp 28.500 | Sosis / Pcs |
| 9 | **Ayam giling 500gr** | Rp 40.000 | Rp 34.000 | Daging / Pcs |
| 10 | **Bakso Ikan & cumi cedea** | Rp 30.000 | Rp 27.244 | Cedea / Pcs |

### B. Mitra Usaha & Kontak
* **Pelanggan Toko**: `OM BURGEM`, `CAFE RATU`
* **Supplier Grosir**: `CV NINDY FROZEN`

---

## 🚀 PERSIAPAN AWAL (OPSIONAL: RESET BUKU BARU)

Jika Anda ingin melakukan pengujian dari angka nol bersih:
1. Masuk ke tab **Pengaturan** -> **Manajemen Data** (Gunakan PIN Pemilik).
2. Tekan tombol **Reset Transaksi & Buka Buku Baru** (Data produk dan stok tetap aman).
3. Setelah selesai, semua saldo kas, buku kas, dan transaksi akan kembali ke Rp 0.

---

## 🔢 LANGKAH-DEMI-LANGKAH 15 TRANSAKSI SIMULASI

---

### Transaksi 1: Modal Awal Rekening Bank Toko (Penerimaan Kas Pemilik)
* **Tujuan**: Mengisi saldo awal rekening bank toko agar kas bank likuid untuk pembayaran kulakan/supplier.
* **Layar**: Tab **Keuangan** (Role Pemilik) -> Sub-tab **Buku Kas**.
* **Langkah Operasional**:
  1. Tekan tombol hijau **+ Kas Masuk**.
  2. Pilih Akun: **🏦 Rekening Bank**.
  3. Kategori: **Setoran Tambahan Pemilik** (`setoran_modal`).
  4. Masukkan Nominal: `1.000.000`.
  5. Keterangan: `Saldo Awal Rekening Operasional Bank Toko`.
  6. Tekan **Simpan Penerimaan**.
* **Dampak Akuntansi**:
  * Kas Rekening Bank: **+Rp 1.000.000** (Saldo Bank: Rp 1.000.000).
  * Kas Fisik Laci: Tetap Rp 0.

---

### Transaksi 2: Buka Shift Kasir & Modal Awal Kas Laci
* **Tujuan**: Kasir membuka laci kasir pagi hari dengan uang kembalian.
* **Layar**: Layar **Transaksi Kasir** (atau saat pertama membuka kasir).
* **Langkah Operasional**:
  1. Pada pop-up Buka Shift Kasir (atau tombol Buka Shift di header), masukkan:
  2. Nama Kasir: `Kasir Pagi`.
  3. Modal Awal Laci: `200.000`.
  4. Tekan **Buka Shift Sekarang**.
* **Dampak Akuntansi**:
  * Kas Fisik Laci (`hand`): **+Rp 200.000** (Saldo Laci: Rp 200.000).
  * Mutasi otomatis tercatat pada buku kas dengan kategori `modal_awal`.

---

### Transaksi 3: Penjualan Tunai Lunas (Pelanggan Umum)
* **Tujuan**: Menguji penjualan tunai murni dengan uang pecahan besar dan uang kembalian.
* **Layar**: Layar **Transaksi Kasir**.
* **Langkah Operasional**:
  1. Pilih produk: **Sosis champ ayam 500** sebanyak **2 pcs**.
  2. Total Belanja: **Rp 60.000** (2 x Rp 30.000).
  3. Tekan tombol hijau **Bayar / Checkout**.
  4. Pilih Metode: **Tunai**.
  5. Masukkan Uang Diterima: `100.000` (Kembalian tertera: Rp 40.000).
  6. Tekan **Konfirmasi Bayar**.
* **Dampak Akuntansi**:
  * Omzet Penjualan Bruto: **+Rp 60.000** | HPP: **Rp 53.350** (2 x Rp 26.675).
  * Uang Masuk Kas Laci: **+Rp 60.000** (Saldo Laci: Rp 260.000).
  * Stok *Sosis champ ayam 500*: Berkurang 2 pcs.

---

### Transaksi 4: Penjualan Non-Tunai QRIS (Pelanggan Umum)
* **Tujuan**: Menguji aliran penjualan non-tunai langsung ke kas bank.
* **Layar**: Layar **Transaksi Kasir**.
* **Langkah Operasional**:
  1. Pilih produk: **Naget Kanzler Spicy 450 gr** sebanyak **1 pcs**.
  2. Total Belanja: **Rp 50.000**.
  3. Tekan **Bayar / Checkout**.
  4. Pilih Metode: **QRIS / Transfer**.
  5. Tekan **Konfirmasi Bayar**.
* **Dampak Akuntansi**:
  * Omzet Penjualan Bruto: **+Rp 50.000** | HPP: **Rp 40.600**.
  * Kas Rekening Bank: **+Rp 50.000** (Saldo Bank: Rp 1.050.000).
  * Kas Fisik Laci: Tetap Rp 260.000 (tidak ada uang fisik bertambah).
  * Stok *Naget Kanzler Spicy 450 gr*: Berkurang 1 pcs.

---

### Transaksi 5: Penjualan Diskon Tunai (Pelanggan: OM BURGEM)
* **Tujuan**: Menguji fitur diskon transaksi dan penyajian potongan penjualan SAK EMKM.
* **Layar**: Layar **Transaksi Kasir**.
* **Langkah Operasional**:
  1. Pilih Pelanggan: **OM BURGEM**.
  2. Pilih produk: **Chikuwa Cedea Pack 500 gr** sebanyak **3 pcs** (Subtotal: Rp 94.500).
  3. Tekan tombol **Diskon**, masukkan potongan nominal: `4.500` (Total menjadi pas: **Rp 90.000**).
  4. Tekan **Bayar / Checkout**.
  5. Pilih Metode: **Tunai**, bayar pas `90.000`.
  6. Tekan **Konfirmasi Bayar**.
* **Dampak Akuntansi**:
  * Penjualan Bruto: **Rp 94.500** | Diskon: **Rp 4.500** | Penjualan Bersih: **Rp 90.000**.
  * HPP: **Rp 85.983** (3 x Rp 28.661).
  * Kas Fisik Laci: **+Rp 90.000** (Saldo Laci: Rp 350.000).
  * Stok *Chikuwa Cedea Pack 500 gr*: Berkurang 3 pcs.

---

### Transaksi 6: Penjualan Tempo / Piutang (Pelanggan: CAFE RATU)
* **Tujuan**: Menguji penjualan tempo tanpa DP yang masuk ke Buku Piutang Pelanggan.
* **Layar**: Layar **Transaksi Kasir**.
* **Langkah Operasional**:
  1. Pilih Pelanggan: **CAFE RATU**.
  2. Pilih produk: **Sosis asimo 1 kg** sebanyak **2 pcs** (Total: **Rp 90.000**).
  3. Tekan tombol opsi pembayaran / pilih metode: **Tempo / Piutang (Hutang Pelanggan)**.
  4. Isi Uang Muka (DP): `0` (Sisa tagihan tempo: Rp 90.000).
  5. Tentukan Jatuh Tempo: `+7 Hari`.
  6. Tekan **Simpan Transaksi Tempo**.
* **Dampak Akuntansi**:
  * Penjualan Bruto / Omzet: **+Rp 90.000** | HPP: **Rp 75.460** (2 x Rp 37.730).
  * Kas Laci & Bank: **Rp 0** (Belum ada uang tunai diterima).
  * Buku Piutang Pelanggan (CAFE RATU): **+Rp 90.000**.
  * Stok *Sosis asimo 1 kg*: Berkurang 2 pcs.

---

### Transaksi 7: Penjualan Split Payment (Tunai + QRIS)
* **Tujuan**: Menguji pemisahan otomatis uang laci vs rekening pada pembayaran gabungan.
* **Layar**: Layar **Transaksi Kasir**.
* **Langkah Operasional**:
  1. Pilih produk: **Dumpling keju cedea 500 gr** sebanyak **2 pcs** (Total: **Rp 64.000**).
  2. Tekan **Bayar / Checkout** -> Pilih Metode: **Split (Tunai + QRIS)**.
  3. Masukkan Porsi Tunai: `34.000`.
  4. Masukkan Porsi QRIS: `30.000`.
  5. Tekan **Konfirmasi Bayar**.
* **Dampak Akuntansi**:
  * Penjualan Bruto: **+Rp 64.000** | HPP: **Rp 57.322** (2 x Rp 28.661).
  * Kas Fisik Laci: **+Rp 34.000** (Saldo Laci: Rp 384.000).
  * Kas Rekening Bank: **+Rp 30.000** (Saldo Bank: Rp 1.080.000).
  * Stok *Dumpling keju cedea 500 gr*: Berkurang 2 pcs.

---

### Transaksi 8: Pengeluaran Beban Perlengkapan Toko (Kas Laci)
* **Tujuan**: Mencatat biaya operasional rutin dari laci kasir.
* **Layar**: Tab **Keuangan** -> Sub-tab **Buku Kas**.
* **Langkah Operasional**:
  1. Tekan tombol merah **- Kas Keluar**.
  2. Pilih Akun: **💵 Kas di Tangan (Laci)**.
  3. Kategori: **Kemasan & Plastik** (`kemasan_plastik`).
  4. Nominal: `25.000`.
  5. Keterangan: `Beli Plastik Kresek Tebal & Lakban Freezer`.
  6. Tekan **Simpan Pengeluaran**.
* **Dampak Akuntansi**:
  * Kas Fisik Laci: **-Rp 25.000** (Saldo Laci: Rp 359.000).
  * Beban Operasional: **+Rp 25.000**.

---

### Transaksi 9: Kulakan Stok Barang Tunai Kas Toko
* **Tujuan**: Menambah stok produk melalui pembelian kulakan tunai dari uang laci.
* **Layar**: Tab **Produk / Stok** (`explore.tsx`).
* **Langkah Operasional**:
  1. Tekan tombol **📦 Beli Stok** di pojok kanan atas.
  2. Pilih Jenis Pembayaran: **Tunai**.
  3. Pilih Sumber Kas: **🏪 Kas Toko (Laci Kasir)**.
  4. Pilih Produk: **Bakpao Karakter**.
  5. Masukkan Jumlah Beli: `5` pcs.
  6. Harga Beli Satuan: `15.500` (Total Pembelian: **Rp 77.500**).
  7. Tekan **Simpan Pembelian Stok**.
* **Dampak Akuntansi**:
  * Kas Fisik Laci: **-Rp 77.500** (Saldo Laci: Rp 281.500).
  * Stok *Bakpao Karakter*: Bertambah +5 pcs.
  * Valuasi Aset Stok Freezer: Bertambah +Rp 77.500.

---

### Transaksi 10: Kulakan Stok Barang Transfer Rekening Bank
* **Tujuan**: Kulakan stok dalam jumlah lebih besar menggunakan transfer bank.
* **Layar**: Tab **Produk / Stok** (`explore.tsx`).
* **Langkah Operasional**:
  1. Tekan tombol **📦 Beli Stok**.
  2. Pilih Jenis Pembayaran: **Tunai**.
  3. Pilih Sumber Kas: **🏦 Kas Bank (Transfer Rekening)**.
  4. Pilih Produk: **Bakso Champ Ayam**.
  5. Masukkan Jumlah Beli: `10` pcs.
  6. Harga Beli Satuan: `26.424` (Total Pembelian: **Rp 264.240**).
  7. Tekan **Simpan Pembelian Stok**.
* **Dampak Akuntansi**:
  * Kas Rekening Bank: **-Rp 264.240** (Saldo Bank: Rp 815.760).
  * Kas Fisik Laci: Tetap Rp 281.500 (uang fisik kasir tidak terganggu).
  * Stok *Bakso Champ Ayam*: Bertambah +10 pcs.

---

### Transaksi 11: Catat Pembelian Tempo / Utang Supplier Baru
* **Tujuan**: Menerima kiriman barang distributor secara kredit/tempo dari supplier grosir.
* **Layar**: Tab **Produk / Stok** (`explore.tsx`) atau Menu **Hutang Supplier**.
* **Langkah Operasional**:
  1. Tekan tombol **📦 Beli Stok**.
  2. Pilih Jenis Pembayaran: **📋 Kredit (Hutang Supplier)**.
  3. Pilih Supplier: **CV NINDY FROZEN**.
  4. Pilih Produk: **Sosis Yona Breakfast 450 gr**.
  5. Masukkan Jumlah Beli: `20` pcs.
  6. Harga Beli Satuan: `28.500` (Total Tagihan: **Rp 570.000**).
  7. Tentukan Jatuh Tempo: `+14 Hari`.
  8. Tekan **Simpan Pembelian Stok**.
* **Dampak Akuntansi**:
  * Kas Toko & Bank: **Rp 0** (Tidak ada pengeluaran kas).
  * Buku Hutang Toko (ke CV NINDY FROZEN): **+Rp 570.000**.
  * Stok *Sosis Yona Breakfast 450 gr*: Bertambah +20 pcs.

---

### Transaksi 12: Penerimaan Cicilan Piutang Pelanggan (Kas Laci)
* **Tujuan**: Pelanggan (CAFE RATU) mencicil nota tempo secara tunai ke laci kasir.
* **Layar**: Menu **Buku Hutang & Piutang** (`debt-receivable.tsx`) -> Tab **Piutang Pelanggan**.
* **Langkah Operasional**:
  1. Cari nama **CAFE RATU** (Total tagihan: Rp 90.000).
  2. Tekan tombol **Bayar / Cicil**.
  3. Masukkan Nominal Bayar: `50.000`.
  4. Pilih Akun Masuk: **💵 Kas di Tangan (Laci)**.
  5. Keterangan: `Cicilan pertama nota tempo sosis asimo`.
  6. Tekan **Konfirmasi Pembayaran**.
* **Dampak Akuntansi**:
  * Kas Fisik Laci: **+Rp 50.000** (Saldo Laci: Rp 331.500).
  * Sisa Piutang CAFE RATU: Berkurang menjadi **Rp 40.000** (Rp 90.000 - Rp 50.000).
  * Laba Rugi: Tidak menambah omzet baru (mencegah double-counting omzet).

---

### Transaksi 13: Pembayaran Cicilan Utang Supplier (Transfer Bank)
* **Tujuan**: Membayar cicilan tagihan distributor via transfer bank resmi toko.
* **Layar**: Menu **Buku Hutang & Piutang** (`debt-receivable.tsx`) -> Tab **Hutang Supplier**.
* **Langkah Operasional**:
  1. Cari nama **CV NINDY FROZEN** (Total tagihan: Rp 570.000).
  2. Tekan tombol **Bayar Hutang**.
  3. Masukkan Nominal Bayar: `300.000`.
  4. Rekening Sumber: **🏦 Kas Bank (Transfer)**.
  5. Keterangan: `Transfer cicilan termin 1 via BCA/Mandiri`.
  6. Tekan **Konfirmasi Pembayaran**.
* **Dampak Akuntansi**:
  * Kas Rekening Bank: **-Rp 300.000** (Saldo Bank: Rp 515.760).
  * Kas Fisik Laci: Tetap aman Rp 331.500.
  * Sisa Hutang Toko ke CV NINDY FROZEN: Berkurang menjadi **Rp 270.000** (Rp 570.000 - Rp 300.000).

---

### Transaksi 14: Penjualan Multi-Item Tunai Siang Hari
* **Tujuan**: Penjualan paket olahan daging dan bakso ikan lunas tunai.
* **Layar**: Layar **Transaksi Kasir**.
* **Langkah Operasional**:
  1. Pilih produk 1: **Ayam giling 500gr** (1 pcs @ Rp 40.000).
  2. Pilih produk 2: **Bakso Ikan & cumi cedea** (1 pcs @ Rp 30.000).
  3. Total Belanja: **Rp 70.000**.
  4. Tekan **Bayar / Checkout** -> Pilih **Tunai**.
  5. Masukkan Uang: `70.000` (Uang pas).
  6. Tekan **Konfirmasi Bayar**.
* **Dampak Akuntansi**:
  * Penjualan Bruto: **+Rp 70.000** | HPP: **Rp 61.244** (Rp 34.000 + Rp 27.244).
  * Kas Fisik Laci: **+Rp 70.000** (Saldo Laci: Rp 401.500).
  * Stok *Ayam giling 500gr* (-1) dan *Bakso Ikan & cumi cedea* (-1).

---

### Transaksi 15: Setor Kas Laci ke Rekening Bank Toko
* **Tujuan**: Menyetor kelebihan uang fisik laci kasir ke rekening bank toko untuk menguji alur transfer antar-kantong kas internal.
* **Layar**: Tab **Keuangan** -> Sub-tab **Buku Kas**.
* **Langkah Operasional**:
  1. Tekan tombol biru **🏦 Setor Bank** (atau link "Setor Kas ke Bank ›").
  2. Masukkan Nominal Setoran: `200.000`.
  3. Pilih Bank Tujuan: `BCA / Mandiri / BRI`.
  4. Keterangan: `Setoran uang tunai kasir ke rekening toko`.
  5. Tekan **Konfirmasi Setor Bank**.
* **Dampak Akuntansi**:
  * Kas Fisik Laci: **-Rp 200.000** (Saldo Laci: Rp 201.500).
  * Kas Rekening Bank: **+Rp 200.000** (Saldo Bank: Rp 715.760).
  * Total Likuiditas Toko: Tetap utuh Rp 917.260 (mutasi antar-kantong internal).

---

## 📊 MATRIKS REKAPITULASI 15 TRANSAKSI

| No | Jenis Transaksi | Keterangan / Item | Akun / Metode | Nominal | HPP | Kas Laci | Kas Bank | Piutang | Hutang |
|:--:|:---|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Kas Masuk | Saldo Awal Rekening Bank | Bank | Rp 1.000.000 | - | - | +1.000.000 | - | - |
| 2 | Shift Kasir | Modal Awal Shift Laci | Laci | Rp 200.000 | - | +200.000 | - | - | - |
| 3 | Penjualan | 2 Sosis Champ Ayam 500 | Tunai | Rp 60.000 | Rp 53.350 | +60.000 | - | - | - |
| 4 | Penjualan | 1 Naget Kanzler Spicy | QRIS | Rp 50.000 | Rp 40.600 | - | +50.000 | - | - |
| 5 | Penjualan | 3 Chikuwa Cedea (Diskon Rp 4.500) | Tunai | Rp 90.000 | Rp 85.983 | +90.000 | - | - | - |
| 6 | Penjualan | 2 Sosis Asimo 1 kg (Tempo) | Tempo | Rp 90.000 | Rp 75.460 | - | - | +90.000 | - |
| 7 | Penjualan | 2 Dumpling Keju (Split) | Tunai+QRIS | Rp 64.000 | Rp 57.322 | +34.000 | +30.000 | - | - |
| 8 | Kas Keluar | Beban Plastik & Lakban | Laci | Rp 25.000 | - | -25.000 | - | - | - |
| 9 | Beli Stok | 5 Bakpao Karakter | Laci | Rp 77.500 | - | -77.500 | - | - | - |
| 10 | Beli Stok | 10 Bakso Champ Ayam | Bank | Rp 264.240 | - | - | -264.240 | - | - |
| 11 | Beli Stok | 20 Sosis Yona (Tempo CV Nindy) | Tempo | Rp 570.000 | - | - | - | - | +570.000 |
| 12 | Cicilan Piutang | CAFE RATU bayar cicilan | Laci | Rp 50.000 | - | +50.000 | - | -50.000 | - |
| 13 | Cicilan Hutang | Bayar CV Nindy Frozen | Bank | Rp 300.000 | - | - | -300.000 | - | -300.000 |
| 14 | Penjualan | 1 Ayam Giling + 1 Bakso Cedea | Tunai | Rp 70.000 | Rp 61.244 | +70.000 | - | - | - |
| 15 | Setor Kas | Laci disetor ke Bank | Laci -> Bank | Rp 200.000 | - | -200.000 | +200.000 | - | - |

---

## 🎯 KUNCI VERIFIKASI & HASIL AKHIR LAPORAN APLIKASI

Setelah menyelesaikan seluruh 15 langkah transaksi di atas, Anda dapat membuka menu-menu laporan berikut untuk memeriksa keakuratan angka matematis sistem:

### 1. Layar Dasbor Utama (`app/(tabs)/index.tsx`)
* **Total Omset Penjualan Hari Ini**: **Rp 424.000**
* **Total Transaksi Penjualan**: **6 Nota Penjualan** (Tx 3, 4, 5, 6, 7, 14).
* **Rasio Kas Masuk Penjualan**:
  * Porsi Tunai: **Rp 254.000** (Tx 3: 60k + Tx 5: 90k + Tx 7: 34k + Tx 14: 70k).
  * Porsi Non-Tunai (QRIS): **Rp 80.000** (Tx 4: 50k + Tx 7: 30k).
  * Porsi Tempo: **Rp 90.000** (Tx 6).

---

### 2. Menu Laporan Keuangan - Slip Laba Rugi SAK EMKM (`app/(tabs)/financial-reports.tsx`)
Buka Tab **Keuangan** -> Pilih Sub-tab **Laba & Rugi**:

$$\begin{aligned}
\text{Penjualan Bruto} &= \text{Rp } 428.500 \\
\text{Potongan Penjualan (Diskon)} &= (\text{Rp } 4.500) \\
\hline
\mathbf{\text{Penjualan Bersih (Omzet)}} &= \mathbf{\text{Rp } 424.000} \\
\text{Beban Pokok Penjualan (HPP)} &= (\text{Rp } 373.959) \\
\hline
\mathbf{\text{Laba Kotor}} &= \mathbf{\text{Rp } 50.041} \quad (\text{Margin Kotor: } 11,80\%) \\
\text{Beban Operasional Usaha} &= (\text{Rp } 25.000) \quad (\text{Plastik: 25k}) \\
\text{Pendapatan Lain-lain} &= \text{Rp } 0 \\
\hline
\mathbf{\text{Laba Bersih Toko}} &= \mathbf{\text{Rp } 25.041}
\end{aligned}$$

> **Catatan Validitas SAK EMKM**:
> * Modal awal kasir (Rp 200.000) dan setoran modal pemilik (Rp 1.000.000) **tidak dimasukkan sebagai omzet** pendapatan toko.
> * Pelunasan piutang (Rp 50.000) **tidak digandakan sebagai omzet baru** karena penjualan sudah diakui di awal saat transaksi tempo dibuat.

---

### 3. Buku Kas & Rekonsiliasi Dual-Pocket (`app/(tabs)/financial-reports.tsx`)
Buka Tab **Keuangan** -> Pilih Sub-tab **Buku Kas**:

* **Saldo Kas Fisik Laci (`hand`)**: **Rp 201.500**
  * *Rincian Uang di Laci*: Modal awal shift (200.000) + Penjualan tunai (254.000) + Pelunasan piutang tunai (50.000) - Beban plastik (25.000) - Beli stok tunai (77.500) - Setor bank (200.000) = **Rp 201.500**.
* **Saldo Kas Rekening Bank (`bank`)**: **Rp 715.760**
  * *Rincian Rekening Bank*: Saldo awal (1.000.000) + QRIS penjualan (80.000) + Setor tunai dari laci (200.000) - Beli stok transfer (264.240) - Bayar utang supplier (300.000) = **Rp 715.760**.
* **Total Saldo Likuid Toko (Laci + Bank)**: **Rp 917.260**

---

### 4. Menu Buku Hutang & Piutang Usaha (`app/debt-receivable.tsx`)
* **Buku Piutang Pelanggan**:
  * Pelanggan **CAFE RATU**:
    * Tagihan Awal: Rp 90.000
    * Pembayaran Cicilan: Rp 50.000
    * **Sisa Piutang: Rp 40.000** (Belum Lunas)
* **Buku Hutang Supplier**:
  * Supplier **CV NINDY FROZEN**:
    * Pembelian Tempo: Rp 570.000 (20 Sosis Yona Breakfast)
    * Pembayaran Transfer: Rp 300.000
    * **Sisa Hutang Toko: Rp 270.000** (Belum Jatuh Tempo)

---

### 5. Tab "Laporan Lainnya" (`components/laporan-lainnya-tab.tsx`)
Buka Tab **Keuangan** -> Pilih Sub-tab ke-3: **Laporan Lainnya**:

1. **Rekap Pengeluaran Kas per Kategori**:
   * Kemasan & Plastik: **Rp 25.000** (100%)
   * Total Pengeluaran Operasional: **Rp 25.000**
2. **Rekap Pemasukan Kas per Kategori**:
   * Penjualan Produk: **Rp 424.000** (89,45%)
   * Pelunasan Piutang Pelanggan: **Rp 50.000** (10,55%)
3. **Stok Menipis / Habis (Diurutkan dari Penjualan Terlaris)**:
   * Menampilkan produk-produk dengan volume penjualan teratas pada hari pengujian:
     * **Chikuwa Cedea Pack 500 gr**: Terjual **3 pcs**.
     * **Sosis champ ayam 500**: Terjual **2 pcs**.
     * **Sosis asimo 1 kg**: Terjual **2 pcs**.
     * **Dumpling keju cedea 500 gr**: Terjual **2 pcs**.
     * **Naget Kanzler Spicy 450 gr**: Terjual **1 pcs**.
     * **Ayam giling 500gr**: Terjual **1 pcs**.
     * **Bakso Ikan & cumi cedea**: Terjual **1 pcs**.

---

### 6. Pengujian Tutup Shift Kasir (Z-Report)
* **Layar**: Header Kasir -> Tombol **Tutup Shift Kasir**.
* **Langkah**:
  1. Masukkan uang fisik riil yang ada di laci: `201.500`.
  2. Sistem akan menampilkan:
     * Kas Diharapkan Sistem: **Rp 201.500**
     * Kas Fisik Dihitung: **Rp 201.500**
     * **Selisih: Rp 0 (PAS / SEIMBANG)**
  3. Tekan **Tutup Shift Sekarang**.
* **Efek Otomatis (Self-Balancing SAK EMKM)**:
  * Modal awal kasir Rp 200.000 otomatis dilepas dari laci (`type: 'out'`, `category: 'modal_awal'`).
  * Saldo kas laci toko setelah shift ditutup berubah menjadi **Rp 1.500** (keuntungan tunai bersih laci hari itu: 254.000 omzet tunai + 50.000 piutang - 25.000 beban - 77.500 beli stok - 200.000 setor bank).
  * Rekonsiliasi kas toko tetap 100% seimbang dan siap untuk pembukaan shift kasir hari berikutnya.

---

*File ini dibuat secara otomatis sebagai standar audit dan pengujian operasional POS Agen Sosis Azizah.*
