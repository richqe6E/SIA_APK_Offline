# Audit Sistem, Logika Akuntansi, dan Optimasi Performa Tablet 4GB — SIA POS Offline (POS AZIZAH v1.0.4)

Dokumen ini berisi hasil simulasi audit menyeluruh terhadap kode sumber repositori [SIA_APK_Offline](https://github.com/richqe6E/SIA_APK_Offline) beserta instruksi eksekusi perbaikan (*patch blueprint*) yang dirancang agar dapat langsung dieksekusi oleh agen pemrograman **Antigravity**.

## 1. Ringkasan Eksekutif & Matriks Temuan Audit

Hasil bedah kode pada seluruh lapisan aplikasi—mulai dari skema SQLite di [services/database.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/database.ts), manajemen state akuntansi di [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts), hingga antarmuka kasir di [app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx)—menemukan **13 celah kritis dan mayor** yang menyebabkan ketidakakuratan laporan keuangan serta risiko *freeze/crash* pada perangkat **Tablet Xiaomi RAM 4GB**.

| ID | Kategori | Komponen / File Target | Temuan Masalah Utama | Dampak Operasional & Akuntansi | Prioritas |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | Logika Stok & POS | [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts) | Pemotongan stok barang timbangan (`is_weighted`) memakai `Math.ceil((weight_gram)/1000)` | Beli 250g atau 500g memotong stok 1 kg penuh (*over-deduction* stok & HPP) | **CRITICAL** |
| **BUG-02** | Rumus Akuntansi (HPP) | [stores/purchaseStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/purchaseStore.ts) | Pembelian stok baru menimpa langsung `cost_price` tanpa rumus *Moving Average* | Nilai persediaan lama & Laba Kotor berubah mendadak saat harga beli supplier naik/turun | **CRITICAL** |
| **BUG-03** | Arus Kas & Laba Rugi | [stores/expenseStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/expenseStore.ts) | Fungsi `addExpense` mencatat ke tabel `expenses` tetapi tidak memotong saldo di `cash_transactions` | Saldo kas di aplikasi *overstated* (lebih besar daripada uang fisik di laci) | **CRITICAL** |
| **BUG-04** | Neraca (SAK EMKM) | [stores/balanceSheetStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/balanceSheetStore.ts) | Neraca hanya membaca input manual `balance_sheet_items` tanpa agregasi akun riil | Persamaan Dasar Akuntansi ($\text{Aset} = \text{Kewajiban} + \text{Ekuitas}$) tidak seimbang otomatis | **CRITICAL** |
| **BUG-05** | Penyesuaian Persediaan | [stores/stockOpnameStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/stockOpnameStore.ts) | Selisih barang hilang/rusak (`totalLoss`) di Stock Opname tidak masuk ke Laporan Laba Rugi | Laba Bersih di [app/(tabs)/reports.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/reports.tsx) semu karena beban susut stok tidak terhitung | **HIGH** |
| **BUG-06** | Retur & Pembatalan | [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts) | `cancelTransaction` mengembalikan stok tetapi tidak membalik mutasi kas/piutang secara utuh | Saldo kas dan piutang pelanggan tetap menggantung meski nota sudah dibatalkan | **HIGH** |
| **BUG-07** | Integritas Database | [services/database.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/database.ts) | Operasi multi-tabel berjalan tanpa `withTransactionAsync` & ada `DROP TABLE` di migrasi v2 | Risiko *data orphan* (stok terpotong tanpa nota) jika tablet *freeze/low memory* di tengah proses | **CRITICAL** |
| **BUG-08** | Kontrol Shift Kasir | [stores/shiftStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/shiftStore.ts) | Transaksi pada shift yang sudah ditutup (*Close Shift*) masih dapat dibatalkan/diedit | Merusak validitas laporan tutup kasir historis (*Z-Report*) | **MEDIUM** |
| **BUG-09** | Performa RAM 4GB | [app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx) | Komponen monolitik 3.773 baris dalam satu file memicu *full re-render* setiap interaksi | *Lag* ketik pencarian, *frame drop*, dan *Out of Memory (OOM) crash* pada Tablet Xiaomi RAM 4GB | **CRITICAL** |
| **BUG-10** | Storage Gambar & Heap | [app/(tabs)/explore.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/explore.tsx) | URI gambar disimpan dari folder *cache* `ImagePicker` & tanpa *resize* dimensi piksel | Gambar hilang saat MIUI/HyperOS membersihkan cache; bitmap resolusi besar menguras RAM 4GB | **CRITICAL** |
| **BUG-11** | Memori List & SQLite | [stores/productStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/productStore.ts) | Load seluruh produk & riwayat tanpa pagination SQL (`LIMIT/OFFSET`) dan konfigurasi `FlatList` | Konsumsi memori JS Heap membengkak seiring bertambahnya produk (>500 SKU) dan ribuan transaksi | **HIGH** |
| **BUG-12** | Bluetooth Thermal | [services/print.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/print.ts) | Re-koneksi Bluetooth memblokir UI tanpa *timeout* & izin Android 12+ (`BLUETOOTH_CONNECT`) kurang | Layar kasir *freeze* 15–30 detik saat printer mati; *force close* di Android 12/13/14 (HyperOS) | **CRITICAL** |
| **BUG-13** | Backup & Restore WAL | [services/backup.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/backup.ts) | Restore menimpa file `.db` saat koneksi WAL aktif tanpa *checkpoint* & penutupan DB | Database *corrupt* atau kembali ke data lama karena tertimpa file `-wal` dan `-shm` di memori | **HIGH** |

## 2. Bedah Celah Logika Sistem & Perhitungan Akuntansi

### BUG-01: Kesalahan Rumus Pemotongan Stok Barang Timbangan (`Math.ceil`)
* **File Target**: [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts) (Baris 427–428)
* **Kode Saat Ini**:
  ```typescript
  const qtyToDeduct = item.is_weighted === 1 ? Math.ceil((item.weight_gram ?? 1000) / 1000) : item.quantity;
  ```
* **Analisis Cacat Logika**:
  Fungsi `Math.ceil` membulatkan angka desimal ke bilangan bulat atas terdekat. Jika pelanggan membeli produk timbangan (misalnya sosis curah atau daging) seberat `250` gram (`0.25` kg), maka `Math.ceil(250 / 1000)` menghasilkan `1`. Akibatnya, 4 kali penjualan @250 gram (total fisik 1 kg) akan memotong stok sebesar **4 kg** di database.
* **Instruksi Perbaikan untuk Antigravity**:
  1. Pastikan kolom `stock` pada tabel `products` dan `quantity` pada `transaction_items` mengizinkan tipe `REAL` (desimal presisi 3 angka di belakang koma) atau simpan stok produk timbangan dalam satuan dasar gram.
  2. Ganti rumus `qtyToDeduct` pada proses checkout dan proses pembatalan transaksi (`cancelTransaction`) menjadi pembagian desimal presisi tanpa `Math.ceil`:
  ```typescript
  const qtyToDeduct = item.is_weighted === 1
    ? Number(((item.weight_gram ?? 1000) / 1000).toFixed(3))
    : item.quantity;
  ```

### BUG-02: Perhitungan HPP (`cost_price`) Saat Kulakan Tidak Menggunakan *Weighted Moving Average*
* **File Target**: [stores/purchaseStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/purchaseStore.ts) (Baris 153–158)
* **Kode Saat Ini**:
  ```sql
  UPDATE products SET stock = stock + ?, cost_price = ?, has_stock = 1 WHERE id = ?
  ```
* **Analisis Cacat Logika**:
  Menimpa `cost_price` langsung dengan harga beli terbaru merusak valuasi persediaan barang yang masih tersisa di rak. Contoh: Toko masih punya 10 pcs stok lama dengan HPP Rp10.000 (nilai persediaan Rp100.000). Saat kulakan 2 pcs baru dengan harga Rp16.000 (nilai beli Rp32.000), total nilai persediaan seharusnya Rp132.000 untuk 12 pcs (HPP rata-rata = **Rp11.000/pcs**). Dengan kode saat ini, ke-12 pcs langsung dinilai Rp16.000/pcs (nilai persediaan melonjak semu menjadi Rp192.000).
* **Instruksi Perbaikan untuk Antigravity**:
  1. Pada `createPurchase` di [stores/purchaseStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/purchaseStore.ts), ambil `stock` dan `cost_price` produk saat ini sebelum melakukan `UPDATE`.
  2. Gunakan rumus *Moving Average* dengan *guardrail* untuk stok negatif:
  ```typescript
  const currentStock = Math.max(0, Number(product.stock) || 0);
  const currentCost = Number(product.cost_price) || 0;
  const incomingQty = Number(item.quantity) || 0;
  const incomingCost = Number(item.costPrice) || 0;

  const totalQty = currentStock + incomingQty;
  const newMovingAvgCost = totalQty > 0
    ? Math.round(((currentStock * currentCost) + (incomingQty * incomingCost)) / totalQty)
    : incomingCost;
  ```

### BUG-03: Pencatatan Beban Operasional (`addExpense`) Tidak Mengurangi Saldo Kas Toko
* **File Target**: [stores/expenseStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/expenseStore.ts) (Baris 81–89) & [stores/cashStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/cashStore.ts)
* **Analisis Cacat Logika**:
  Saat pengguna menginput pengeluaran operasional (listrik, plastik, gaji, bensin) melalui `addExpense`, data hanya masuk ke tabel `expenses`. Tabel `cash_transactions` tidak menerima entri `OUT`, sehingga saldo kas di dashboard kas dan laporan shift tidak berkurang.
* **Instruksi Perbaikan untuk Antigravity**:
  1. Bungkus `addExpense` dan `deleteExpense` di [stores/expenseStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/expenseStore.ts) dalam satu transaksi database dengan pencatatan ke `cash_transactions`.
  2. Tambahkan kolom `reference_id` atau `expense_id` pada `cash_transactions` agar saat beban dihapus atau diedit, mutasi kas terkait ikut disesuaikan secara sinkron.

### BUG-04: Ketidakseimbangan Neraca (`balanceSheetStore.ts`) dan Ketiadaan Konsolidasi Akun Otomatis
* **File Target**: [stores/balanceSheetStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/balanceSheetStore.ts) & [app/(tabs)/reports.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/reports.tsx)
* **Analisis Cacat Logika**:
  Dalam Sistem Informasi Akuntansi berstandar SAK EMKM, Neraca harus mencerminkan posisi keuangan otomatis dari seluruh buku pembantu. Saat ini `balanceSheetStore.ts` hanya menjumlahkan item manual dari tabel `balance_sheet_items`, sehingga transaksi penjualan, pembelian, hutang, piutang, dan stok tidak mengubah Neraca secara otomatis.
* **Instruksi Perbaikan untuk Antigravity**:
  Buat fungsi agregasi `getConsolidatedBalanceSheet(asOfDate)` di [stores/balanceSheetStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/balanceSheetStore.ts) yang menggabungkan:
  1. **Aset Lancar (Otomatis)**:
     * **Saldo Kas & Bank**: Total kas masuk dikurangi kas keluar dari `cash_transactions` hingga `asOfDate`.
     * **Piutang Usaha**: Total sisa piutang pelanggan (`amount - paid_amount`) berstatus belum lunas dari [stores/debtReceivableStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/debtReceivableStore.ts).
     * **Persediaan Barang Dagang**: Hasil query `SELECT COALESCE(SUM(CASE WHEN stock > 0 THEN stock * cost_price ELSE 0 END), 0) FROM products WHERE is_active = 1`.
  2. **Aset Tetap (Manual)**: Akumulasi item aset tetap & penyusutan dari `balance_sheet_items`.
  3. **Kewajiban (Otomatis + Manual)**:
     * **Hutang Usaha / Supplier**: Total sisa hutang pembelian (`amount - paid_amount`) dari `supplier_debts`.
     * **Kewajiban Lainnya**: Dari input kewajiban jangka pendek/panjang di `balance_sheet_items`.
  4. **Ekuitas (Otomatis + Manual)**:
     * **Modal Pemilik**: Dari `balance_sheet_items` kategori `equity`.
     * **Prive (Pengambilan Pribadi)**: Dikurangkan dari Ekuitas.
     * **Laba Ditahan / Laba Bersih Berjalan**: $\text{Penjualan Bersih} - \text{Total HPP} - \text{Beban Operasional} - \text{Beban Selisih Stock Opname}$.

### BUG-05: Selisih Stock Opname Tidak Masuk ke Laporan Laba Rugi
* **File Target**: [stores/stockOpnameStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/stockOpnameStore.ts) (Baris 65) & [app/(tabs)/reports.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/reports.tsx)
* **Analisis Cacat Logika**:
  Variabel `totalLoss` saat `difference < 0` (barang hilang, susut, atau kedaluwarsa) hanya disimpan di tabel `stock_adjustments`, tetapi diabaikan dalam perhitungan Laba Bersih di [app/(tabs)/reports.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/reports.tsx).
* **Instruksi Perbaikan untuk Antigravity**:
  1. Pada query Laporan Laba Rugi di [services/database.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/database.ts) dan [app/(tabs)/reports.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/reports.tsx), tambahkan komponen **Beban Kerugian Selisih Stok (Inventory Shrinkage)** dari `SELECT COALESCE(SUM(total_loss), 0) FROM stock_adjustments WHERE created_at BETWEEN ? AND ?`.
  2. Kurangkan nilai tersebut dari Laba Kotor bersama Beban Operasional untuk menghasilkan Laba Bersih yang akurat.

### BUG-06: Pembatalan Transaksi (`cancelTransaction`) & Filter Status pada Laporan
* **File Target**: [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts), [app/(tabs)/reports.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/reports.tsx), & [app/debt-receivable.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/debt-receivable.tsx)
* **Analisis Cacat Logika**:
  Saat sebuah nota dibatalkan (`CANCELLED` / `VOID`), stok barang dikembalikan tetapi entri arus kas masuk pada `cash_transactions` atau entri piutang pada `customer_receivables` yang terbentuk dari transaksi tersebut tidak ikut dibatalkan secara otomatis. Selain itu, beberapa query rekapitulasi belum memfilter `WHERE status = 'COMPLETED'`.
* **Instruksi Perbaikan untuk Antigravity**:
  1. Di `cancelTransaction` ([stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts)), tambahkan jurnal pembalik (`OUT` dengan keterangan `VOID TRX-...`) pada `cash_transactions` jika transaksi awal adalah tunai/QRIS, atau batalkan record terkait pada `customer_receivables` jika transaksi awal adalah kasbon/piutang.
  2. Audit seluruh query `SUM(...) FROM transactions` di [services/database.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/database.ts) dan [app/(tabs)/reports.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/reports.tsx) agar selalu menyertakan klausa `WHERE status = 'COMPLETED'`.

### BUG-07: Ketiadaan Transaksi Atomik SQLite (`withTransactionAsync`) & Migrasi Destruktif
* **File Target**: [services/database.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/database.ts) (Baris 78) & seluruh file di `stores/`
* **Analisis Cacat Logika**:
  1. Pada [services/database.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/database.ts) baris 78 terdapat perintah `DROP TABLE IF EXISTS products;` pada blok migrasi awal.
  2. Penyimpanan transaksi kasir mengeksekusi belasan perintah `runAsync` secara terpisah (insert header nota, loop insert item, loop potong stok, insert kas). Jika tablet mengalami *freeze* atau baterai habis di tengah loop, sebagian stok sudah terpotong tetapi nota gagal tersimpan.
* **Instruksi Perbaikan untuk Antigravity**:
  1. Bungkus seluruh operasi multi-query di `createTransaction`, `cancelTransaction`, `createPurchase`, `performOpname`, dan `payReceivable`/`payDebt` menggunakan `await db.withTransactionAsync(async () => { ... })`.
  2. Pastikan setiap tabel detail (`transaction_items`, `purchase_items`) memiliki `FOREIGN KEY (...) REFERENCES ...(id) ON DELETE CASCADE`.

### BUG-08: Penguncian Transaksi pada Shift yang Sudah Ditutup (`shiftStore.ts`)
* **File Target**: [stores/shiftStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/shiftStore.ts) & [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts)
* **Analisis Cacat Logika**:
  Transaksi yang dibuat pada shift yang sudah berstatus `CLOSED` masih bisa di-void/dibatalkan langsung dari riwayat transaksi. Hal ini mengubah angka penjualan masa lalu dan membuat rekonsiliasi kas (*expected cash* vs *actual cash*) pada shift yang sudah ditutup menjadi tidak valid.
* **Instruksi Perbaikan untuk Antigravity**:
  Tambahkan pengecekan `shift_id` atau `created_at` sebelum mengizinkan `cancelTransaction`. Jika transaksi berada pada shift yang sudah ditutup, tolak aksi *void* langsung dan arahkan kasir membuat transaksi **Retur Penjualan** pada shift yang sedang aktif saat ini.

## 3. Optimasi Performa, UI/UX, & Stabilitas pada Tablet Xiaomi RAM 4GB

Tablet Xiaomi dengan RAM 4GB (seperti seri Redmi Pad SE / Redmi Pad yang menjalankan MIUI/HyperOS) hanya menyisakan ruang memori bebas sekitar **1,2 GB – 1,6 GB** untuk aplikasi pihak ketiga, serta memiliki manajemen *background killer* dan pembersih *cache* yang sangat agresif. Berikut adalah perbaikan wajib untuk mencegah *freeze*, *lag*, dan *force close*:

### BUG-09: Dekomposisi Komponen Monolitik Layar Kasir (`app/transaksi.tsx` — 3.773 Baris)
* **File Target**: [app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx)
* **Akar Masalah Performa**:
  Seluruh state input pencarian, filter kategori, grid produk, daftar item di keranjang, kalkulator uang tunai, modal diskon, hingga logika cetak struk disatukan dalam satu komponen sepanjang **3.773 baris**. Setiap kali kasir mengetik 1 karakter di kolom pencarian atau mengubah kuantitas 1 barang di keranjang, React melakukan *reconciliation* ulang terhadap seluruh tampilan kasir.
* **Instruksi Refactoring untuk Antigravity**:
  Pecah [app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx) menjadi 4 sub-komponen terisolasi yang dibungkus `React.memo` dan gunakan *atomic selector* Zustand (`useTransactionStore(state => state.items)` alih-alih `const store = useTransactionStore()`):
  1. `components/pos/ProductCatalogGrid.tsx`: Hanya berlangganan (*subscribe*) ke `productStore`, `searchQuery` (dengan *debounce* 250ms), dan `selectedCategory`.
  2. `components/pos/ProductCardItem.tsx`: Dibungkus `React.memo` dengan pembandingan `prev.product.id === next.product.id && prev.product.stock === next.product.stock`.
  3. `components/pos/CartSidebarPanel.tsx`: Hanya berlangganan ke `transactionStore.cartItems` dan fungsi kalkulasi subtotal.
  4. `components/pos/PaymentCheckoutModal.tsx`: Hanya dirender saat `isPaymentModalVisible === true` (lazy mounting) agar tidak membebani memori saat kasir sedang memilih barang.

### BUG-10: Persistensi Gambar Produk Permanen & Downscaling Resolusi untuk Menghemat Heap Memory
* **File Target**: [app/(tabs)/explore.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/explore.tsx)
* **Akar Masalah**:
  1. `ImagePicker.launchImageLibraryAsync` menyimpan foto di direktori cache sementara (`cache/ImagePicker/...`). Saat fitur *Cleaner* bawaan Xiaomi MIUI/HyperOS berjalan otomatis ketika memori penuh, seluruh gambar produk di katalog akan terhapus dan menampilkan ikon *broken image*.
  2. `quality: 0.7` hanya menurunkan kompresi ukuran file JPEG, tetapi dimensi piksel gambar (misalnya 3000x3000 px dari kamera) tetap utuh. Saat 30 gambar produk tampil di layar kasir, Android harus mengalokasikan ratusan megabyte *Bitmap Heap Memory* dan memicu *Out of Memory (OOM) crash*.
* **Instruksi Perbaikan untuk Antigravity**:
  1. Salin setiap gambar yang dipilih dari `ImagePicker` ke direktori permanen `FileSystem.documentDirectory + 'product_images/'` menggunakan `expo-file-system`.
  2. Hapus file gambar lama dari `product_images/` saat produk dihapus atau saat gambar produk diganti agar penyimpanan internal tablet tidak penuh.
  3. Gunakan `expo-image` (dengan `cachePolicy="memory-disk"` dan `allowDownscaling={true}`) atau batasi ukuran tampilan thumbnail menjadi `120x120` piksel:
  ```typescript
  import * as FileSystem from 'expo-file-system';

  async function persistProductImage(tempUri: string, productId: string | number): Promise<string> {
    const dir = `${FileSystem.documentDirectory}product_images/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const ext = tempUri.split('.').pop() || 'jpg';
    const destUri = `${dir}prod_${productId}_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: tempUri, to: destUri });
    return destUri;
  }
  ```

### BUG-11: Optimasi `FlatList` Katalog & Pagination SQL pada Riwayat Transaksi
* **File Target**: [app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx), [app/(tabs)/history.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/history.tsx), & [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts)
* **Akar Masalah**:
  Memuat seluruh riwayat transaksi (`SELECT * FROM transactions`) tanpa batas ke memori akan membuat aplikasi semakin lambat setelah berjalan 1–3 bulan (ribuan transaksi).
* **Instruksi Perbaikan untuk Antigravity**:
  1. Tambahkan parameter pagination `LIMIT 50 OFFSET ?` dan filter rentang tanggal langsung di level query SQLite pada [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts) dan [app/(tabs)/history.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/history.tsx).
  2. Tambahkan konfigurasi wajib untuk perangkat RAM 4GB pada seluruh komponen `FlatList` di [app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx) dan [app/(tabs)/explore.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/explore.tsx):
  ```tsx
  <FlatList
    data={filteredProducts}
    keyExtractor={(item) => String(item.id)}
    removeClippedSubviews={true}
    initialNumToRender={12}
    maxToRenderPerBatch={8}
    windowSize={5}
    updateCellsBatchingPeriod={50}
    // ...
  />
  ```

### BUG-12: Timeout Guard Koneksi Bluetooth Printer & Izin Runtime Android 12+ (MIUI/HyperOS)
* **File Target**: [services/print.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/print.ts), [app/(tabs)/printer.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/printer.tsx), & [app.json](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app.json)
* **Akar Masalah**:
  1. Saat printer Bluetooth thermal dalam keadaan *sleep* atau mati, pemanggilan `BluetoothManager.connect(address)` dari `@vardrz/react-native-bluetooth-escpos-printer` menggantung tanpa batas waktu yang jelas, menyebabkan UI kasir membeku (*freeze*) dan kasir menekan tombol bayar berkali-kali (*double submit* transaksi).
  2. Pada Android 12+ (API 31 ke atas pada Tablet Xiaomi), pemanggilan fungsi scan/connect Bluetooth tanpa meminta izin runtime `BLUETOOTH_SCAN` dan `BLUETOOTH_CONNECT` terlebih dahulu menyebabkan *Native SecurityException Crash*.
* **Instruksi Perbaikan untuk Antigravity**:
  1. Pastikan `android.permissions` di [app.json](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app.json) mencantumkan:
     * `android.permission.BLUETOOTH`
     * `android.permission.BLUETOOTH_ADMIN`
     * `android.permission.BLUETOOTH_SCAN`
     * `android.permission.BLUETOOTH_CONNECT`
     * `android.permission.ACCESS_FINE_LOCATION`
  2. Buat helper `withTimeout` dan `ensureBluetoothPermissions` di [services/print.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/print.ts):
  ```typescript
  import { Platform, PermissionsAndroid } from 'react-native';

  export async function ensureBluetoothPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  export function withBluetoothTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Koneksi printer Bluetooth timeout (5 detik). Pastikan printer menyala.')), ms)
      ),
    ]);
  }
  ```
  3. Pisahkan proses **Simpan Transaksi** dan **Cetak Struk** di [app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx): transaksi harus disimpan dan dikunci (`isSubmitting` *mutex lock*) terlebih dahulu. Jika pencetakan Bluetooth gagal atau *timeout*, transaksi **tidak boleh gagal/terduplikasi**, melainkan tampilkan opsi **"Cetak Ulang Struk"** atau **"Lanjut Tanpa Struk"**.

### BUG-13: Keamanan Backup & Restore SQLite pada Mode WAL (`services/backup.ts`)
* **File Target**: [services/backup.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/backup.ts) & [services/database.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/database.ts)
* **Akar Masalah**:
  Database diinisialisasi dengan `PRAGMA journal_mode = 'wal'`. Dalam mode WAL, perubahan terbaru berada di file `-wal`, bukan di file `.db` utama. Jika pengguna melakukan **Backup**, file `.db` yang disalin bisa kehilangan transaksi terbaru yang belum di-*checkpoint*. Jika pengguna melakukan **Restore** dengan menimpa file `.db` tanpa menghapus file `-wal` dan `-shm` serta tanpa menutup koneksi database aktif, SQLite akan mengalami *database image is malformed (corruption)*.
* **Instruksi Perbaikan untuk Antigravity**:
  1. **Sebelum Backup**: Jalankan `await db.execAsync('PRAGMA wal_checkpoint(FULL);')` agar seluruh transaksi di memori `-wal` ditulis masuk ke file `.db` utama sebelum file disalin.
  2. **Saat Restore**:
     * Tutup koneksi database aktif (`await db.closeAsync()`).
     * Hapus file terkait `pos.db-wal` dan `pos.db-shm` (jika ada) menggunakan `FileSystem.deleteAsync(..., { idempotent: true })`.
     * Salin file backup ke lokasi `pos.db`.
     * Buka kembali koneksi database dan muat ulang seluruh state Zustand (`loadProducts`, `loadTransactions`, `loadCash`, dll.).

## 4. Urutan Eksekusi Bertahap untuk Agen Antigravity

Gunakan urutan pengerjaan berikut saat menyerahkan dokumen ini ke agen Antigravity agar proses modifikasi kode berjalan aman tanpa konflik:

1. **Tahap 1 — Lapisan Database & Backup ([services/database.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/database.ts) & [services/backup.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/backup.ts))**:
   * Amankan skema migrasi, tambahkan indeks SQLite pada `transactions(created_at, status)` dan `products(category_id, is_active)`, serta perbaiki prosedur `PRAGMA wal_checkpoint(FULL)` pada backup/restore (**BUG-07**, **BUG-13**).
2. **Tahap 2 — Lapisan Logika Akuntansi & Store (`stores/*.ts`)**:
   * Perbaiki rumus stok timbangan desimal & *reversal* batal transaksi di [stores/transactionStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/transactionStore.ts) (**BUG-01**, **BUG-06**).
   * Implementasikan rumus *Weighted Moving Average* HPP di [stores/purchaseStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/purchaseStore.ts) (**BUG-02**).
   * Integrasikan pemotongan kas otomatis saat input beban di [stores/expenseStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/expenseStore.ts) (**BUG-03**).
   * Integrasikan Beban Selisih Stock Opname ke Laba Rugi di [stores/stockOpnameStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/stockOpnameStore.ts) dan konsolidasi otomatis Neraca di [stores/balanceSheetStore.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/stores/balanceSheetStore.ts) (**BUG-04**, **BUG-05**, **BUG-08**).
3. **Tahap 3 — Lapisan Performa Tablet RAM 4GB, Gambar, & Bluetooth ([app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx), [app/(tabs)/explore.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/(tabs)/explore.tsx), [services/print.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/print.ts))**:
   * Pindahkan penyimpanan gambar produk dari cache ke `FileSystem.documentDirectory` (**BUG-10**).
   * Tambahkan *timeout guard* 5 detik & izin runtime Bluetooth Android 12+ di [services/print.ts](https://github.com/richqe6E/SIA_APK_Offline/blob/main/services/print.ts) (**BUG-12**).
   * Pecah komponen monolitik [app/transaksi.tsx](https://github.com/richqe6E/SIA_APK_Offline/blob/main/app/transaksi.tsx) menjadi sub-komponen `React.memo` dengan optimasi `FlatList` dan pagination SQLite (**BUG-09**, **BUG-11**).
