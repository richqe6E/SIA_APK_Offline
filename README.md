# POS Offline

Aplikasi kasir (_Point of Sale_) offline berbasis **Expo / React Native** untuk UMKM, toko kecil, dan rumah makan — tanpa perlu koneksi internet.

Dibangun dengan `create-expo-app` (Expo SDK 54, Expo Router 6).

---

## Fitur

| Fitur | Status |
|---|---|
| Manajemen produk — tambah, edit, hapus, gambar dari galeri | ✅ |
| Kategori produk — filter, kelompok, kelola kategori | ✅ |
| Transaksi penjualan — keranjang, subtotal, proses bayar | ✅ |
| Metode pembayaran — Tunai & QRIS statis | ✅ |
| Cetak struk — printer thermal Bluetooth 58mm (ESC/POS) | ✅ |
| Riwayat transaksi — detail pesanan selesai | ✅ |
| Laporan penjualan — rekap harian, mingguan, bulanan | ✅ |
| Pengaturan toko — nama toko & jenis usaha | ✅ |
| Nomor invoice — daily reset (`INV-DDMMYY-001`) | ✅ |
| Export CSV — ekspor transaksi per periode / semua | ✅ |
| Hapus data — hapus riwayat transaksi per periode / semua | ✅ |

---

## Tech Stack

| Teknologi | Keterangan |
|---|---|
| **Expo SDK 54** | Framework React Native |
| **Expo Router 6** | File-based routing |
| **expo-sqlite** | Database lokal (SQLite) dengan migrasi version-based |
| **Zustand** | State management ringan |
| **expo-image-picker** | Ambil gambar produk dari galeri |
| **@react-native-community/datetimepicker** | Date picker untuk filter laporan & export |
| **expo-file-system** | File system untuk export CSV |
| **expo-sharing** | Share file CSV |
| **expo-screen-orientation** | Kunci orientasi layar (landscape transaksi, portrait lainnya) |
| **@vardrz/react-native-bluetooth-escpos-printer** | Cetak struk Bluetooth thermal |
| **expo-symbols / @expo/vector-icons** | Ikon (SF Symbols / MaterialIcons) |

---

## Struktur Proyek

```
pos-offline/
├── app/                        # Halaman & navigasi (Expo Router)
│   ├── _layout.tsx             #   Root layout (Stack navigator)
│   ├── (tabs)/
│   │   ├── _layout.tsx         #   Tab navigator (5 tab + 1 hidden)
│   │   ├── index.tsx           #   Dashboard
│   │   ├── explore.tsx         #   Produk (CRUD + kategori)
│   │   ├── history.tsx         #   Riwayat transaksi
│   │   ├── reports.tsx         #   Laporan penjualan
│   │   ├── settings.tsx        #   Pengaturan (menu list)
│   │   ├── store-settings.tsx  #   Atur Toko
│   │   ├── printer.tsx         #   Printer Bluetooth
│   │   └── data-management.tsx #   Export CSV & hapus data
│   ├── transaksi.tsx           #   Transaksi penjualan (landscape)
│   └── modal.tsx               #   Modal umum
├── stores/                     # Zustand stores
│   ├── productStore.ts         #   Produk
│   ├── categoryStore.ts        #   Kategori
│   ├── transactionStore.ts     #   Transaksi & keranjang
│   ├── printerStore.ts         #   Koneksi printer
│   └── settingsStore.ts        #   Pengaturan toko
├── services/
│   ├── database.ts             # Inisialisasi & migrasi SQLite (v4)
│   ├── print.ts                # Cetak struk ESC/POS
│   └── export.ts               # Export CSV & hapus transaksi
├── components/
│   ├── ui/                     # UI components reusable
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── collapsible.tsx
│   │   ├── empty-state.tsx
│   │   └── icon-symbol.tsx
│   ├── external-link.tsx
│   ├── haptic-tab.tsx
│   ├── hello-wave.tsx
│   ├── parallax-scroll-view.tsx
│   ├── themed-text.tsx
│   └── themed-view.tsx
├── constants/
│   └── theme.ts                # Tema, warna, shadow
├── hooks/                      # Custom hooks
├── types/
│   └── printer.d.ts            # Type declaration printer Bluetooth
└── scripts/
    └── reset-project.js
```

---

## Cara Menjalankan

### Prasyarat

- Node.js >= 18
- Expo CLI (`npm install -g expo-cli`)
- Android Studio atau perangkat Android fisik dengan USB debugging
- Expo Go (opsional, untuk development ringan)

### Install & Jalankan

```bash
cd pos-offline
npm install
npx expo start
```

Setelah server berjalan:
- **`a`** — buka di Android emulator / perangkat USB
- **`w`** — buka di web browser (terbatas)
- **`r`** — reload app

### Build APK

```bash
npx expo run:android
```

---

## Database Migrations

Semua migrasi SQLite dikelola di `services/database.ts` menggunakan pola version-based (`PRAGMA user_version`).

**Versi saat ini: 4**

| Versi | Perubahan |
|---|---|
| 1 | Tabel: `products`, `transactions`, `transaction_items`, `settings` |
| 2 | Drop & recreate `products` (reset data produk) |
| 3 | _(no-op, placeholder)_ |
| 4 | Tambah tabel `categories`, kolom `category_id` di `products` |

**Tabel saat ini:** `products`, `categories`, `transactions`, `transaction_items`, `settings`

### Cetak Struk (ESC/POS)

Printer thermal Bluetooth 58mm — lebar **32 kolom**. Format diatur di `services/print.ts`:
- **HEADER** — `printerAlign(CENTER)`: nama toko, invoice, tanggal
- **BODY** — `printerAlign(LEFT)`: item, total, pembayaran
- **FOOTER** — `printerAlign(CENTER)`: terima kasih

Nama produk dipotong 22 karakter, harga rata kanan.

### Orientasi Layar

- **Landscape** — halaman transaksi (`app/transaksi.tsx`) — split panel produk ↔ keranjang
- **Portrait** — semua halaman lainnya, dikunci via `expo-screen-orientation`

### State Management

Semua state dikelola dengan **Zustand** tanpa persist middleware. Data persisten disimpan di SQLite dan dimuat ulang setiap kali store diinisialisasi.
