# Laporan Audit Teknis, Rencana Perbaikan, dan Kode Spesifik — SIA POS Offline

Dokumen ini memuat hasil audit menyeluruh terhadap kode sumber dan struktur proyek [richqe6E/SIA\_APK\_Offline](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline), lengkap dengan rencana eksekusi dan kode perbaikan spesifik untuk mengatasi tiga kendala utama pada hasil *build* APK di perangkat tablet Android.

## 1. Ringkasan Eksekutif & Matriks Temuan Audit

Berdasarkan pemeriksaan konfigurasi di [package.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fpackage.json) dan [app.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp.json), aplikasi dibangun di atas [Expo SDK 54](https://www.google.com/search?q=https%3A%2F%2Fexpo.dev%2Fchangelog%2Fsdk-54) (`"expo": "~54.0.37"`), namun masih mencampurkan sejumlah pustaka *native* dari generasi SDK 52/53 serta memiliki celah sinkronisasi antara siklus hidup *Activity* Android, koneksi database SQLite (`pos.db`), dan *state* memori Zustand.

| No | Kendala pada APK Tablet | Akar Masalah Teknis | Berkas Utama yang Terdampak | Tindakan Perbaikan |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Aplikasi sering keluar sendiri (*force close*) saat pertama kali dibuka di tablet | **a.** `<SQLiteProvider>` merender halaman utama sebelum migrasi 20 versi tabel di `migrateDbIfNeeded` tuntas.<br>**b.** Modul *legacy* `@vardrz/react-native-bluetooth-escpos-printer` berbenturan dengan `"newArchEnabled": true` dan memicu `SecurityException` Android 12+ saat diakses tanpa izin *runtime* `BLUETOOTH_CONNECT`. | [app/\_layout.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F_layout.tsx)<br>[services/database.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fdatabase.ts)<br>[services/print.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fprint.ts)<br>[app.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp.json) | Pasang `<Suspense>` dan `useSuspense` pada `SQLiteProvider`, ubah `"newArchEnabled": false`, dan terapkan *lazy-load* berizin pada modul printer Bluetooth. |
| **2** | Data produk, keuangan, dan transaksi menghilang saat digunakan, lalu kembali saat aplikasi di-*restart* | **a.** Blok `catch` di Zustand store mengeksekusi pengosongan *array* (`products: []`) saat terjadi `SQLITE_BUSY` (*database locked*) ketika berpindah tab.<br>**b.** Penggunaan koneksi database ganda di luar `useSQLiteContext()`.<br>**c.** Filter kategori menimpa *array* produk utama di memori. | [stores/productStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FproductStore.ts)<br>[stores/transactionStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FtransactionStore.ts)<br>[stores/cashStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FcashStore.ts)<br>[stores/expenseStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FexpenseStore.ts) | Hapus pengosongan *state* di blok `catch`, tambahkan *helper retry* `withSqliteRetry`, dan pisahkan *state* master produk dari *filter* kategori. |
| **3** | Upload gambar/foto gagal dan memunculkan notifikasi `unregistered ActivityResultLauncher` | **a.** Ketidakcocokan versi antara `"expo": "~54.0.37"` dan [expo-image-picker](https://www.google.com/search?q=https%3A%2F%2Fclassic.yarnpkg.com%2Fen%2Fpackage%2Fexpo-image-picker) `"~16.0.6"` (seharusnya `~17.0.10` untuk SDK 54).<br>**b.** Hilangnya registrasi `ActivityResultLauncher` saat rotasi layar tablet atau transisi dialog izin ([GitHub Issue #19512](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fexpo%2Fexpo%2Fissues%2F19512)).<br>**c.** Penggunaan opsi `legacy: true` dan kegagalan salin URI `content://`. | [package.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fpackage.json)<br>[utils/imagePickerHelper.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Futils%2FimagePickerHelper.ts)<br>[utils/imageStorage.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Futils%2FimageStorage.ts)<br>[app/(tabs)/store-settings.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F%28tabs%29%2Fstore-settings.tsx) | Selaraskan versi paket via `npx expo install --fix`, daftarkan *plugin* di `app.json`, hapus `legacy: true`, dan tambahkan *fallback* otomatis ke `expo-document-picker`. |

## 2. Audit & Solusi Kendala #1: Aplikasi *Force Close* Saat Pertama Kali Dibuka di Tablet

### A. Analisis Teknis
1. **Tabrakan Inisialisasi SQLite (*Startup Race Condition*)**:
   Pada [app/\_layout.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F_layout.tsx), komponen `<SQLite.SQLiteProvider databaseName="pos.db" onInit={migrateDbIfNeeded}>` langsung merender `<Stack>` tanpa menunggu `migrateDbIfNeeded` di [services/database.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fdatabase.ts) menyelesaikan pembuatan tabel dan migrasi hingga versi 20. Di saat yang sama, [components/animated-splash-screen.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fcomponents%2Fanimated-splash-screen.tsx) langsung menyembunyikan *splash screen* dan [app/(tabs)/index.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F%28tabs%29%2Findex.tsx) menembakkan banyak *query* paralel (`loadSettings`, `loadLedger`, `loadShiftData`, `getDailyNotaCount`). Pada pembukaan pertama di tablet, transaksi migrasi bertabrakan dengan *query* pembacaan awal.
2. **Inkompatibilitas Modul Printer Bluetooth & Izin Android 12+**:
   Di [app.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp.json), opsi `"newArchEnabled": true` aktif, sedangkan `@vardrz/react-native-bluetooth-escpos-printer` di [services/print.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fprint.ts) dan [stores/printerStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FprinterStore.ts) menggunakan arsitektur *bridge* lama. Selain itu, pada Android 12 ke atas (API 31+), mengakses adaptor Bluetooth di layer Java tanpa meminta izin *runtime* `BLUETOOTH_CONNECT` dan `BLUETOOTH_SCAN` terlebih dahulu akan langsung menghentikan proses aplikasi (*native crash*).

### B. Kode Perbaikan Spesifik

#### 1. Perbarui Konfigurasi [app.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp.json)
Matikan `newArchEnabled` agar kompatibel dengan modul Bluetooth printer, kunci perilaku orientasi agar *Activity* tidak dibuat ulang di tengah proses pilih gambar, dan daftarkan *config plugins* secara eksplisit:

```json
{
  "expo": {
    "name": "POS AZIZAH",
    "slug": "pos-offline",
    "version": "1.0.6",
    "orientation": "default",
    "icon": "./assets/images/icon.png",
    "scheme": "posoffline",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": false,
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.rumahmakan.posoffline",
      "permissions": [
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-sqlite",
      [
        "expo-image-picker",
        {
          "photosPermission": "Aplikasi membutuhkan akses galeri untuk memilih foto produk, logo usaha, dan QRIS.",
          "cameraPermission": "Aplikasi membutuhkan akses kamera untuk mengambil foto produk dan bukti transaksi."
        }
      ]
    ]
  }
}
```

#### 2. Pasang Gerbang Inisialisasi Database di [app/\_layout.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F_layout.tsx)
Gunakan `Suspense` dan `useSuspense` (atau *error boundary* sederhana) agar tidak ada halaman yang menjalankan *query* sebelum migrasi database di `migrateDbIfNeeded` benar-benar selesai:

```tsx
import React, { Suspense } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SQLite from 'expo-sqlite';
import { migrateDbIfNeeded } from '@/services/database';
import AnimatedSplashScreen from '@/components/animated-splash-screen';

function DatabaseLoadingFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={{ marginTop: 12, fontSize: 14, color: '#475569' }}>
        Menyiapkan basis data lokal...
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Suspense fallback={<DatabaseLoadingFallback />}>
        <SQLite.SQLiteProvider databaseName="pos.db" onInit={migrateDbIfNeeded} useSuspense>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="transaksi" options={{ headerShown: false }} />
              <Stack.Screen name="debt-receivable" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
          </SafeAreaView>
          <AnimatedSplashScreen />
          <StatusBar style="dark" />
        </SQLite.SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
```

#### 3. Lindungi Modul Printer Bluetooth di [services/print.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fprint.ts) dan [stores/printerStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FprinterStore.ts)
Jangan menginisialisasi modul Bluetooth secara langsung saat *startup* tanpa memeriksa izin *runtime* Android 12+:

```ts
import { PermissionsAndroid, Platform } from 'react-native';

export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Android 12+ (API 31+) membutuhkan izin runtime BLUETOOTH_SCAN & BLUETOOTH_CONNECT
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

  const fineLocation = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return fineLocation === PermissionsAndroid.RESULTS.GRANTED;
}

export function getBluetoothModulesSafe() {
  try {
    // Lazy require agar tidak memicu crash native saat startup aplikasi
    return require('@vardrz/react-native-bluetooth-escpos-printer');
  } catch (err) {
    console.warn('Modul printer Bluetooth tidak tersedia:', err);
    return null;
  }
}
```

## 3. Audit & Solusi Kendala #2: Data Menghilang Saat Aplikasi Digunakan Lalu Kembali Saat *Restart*

### A. Analisis Teknis
1. **Pengosongan State Memori pada Blok `catch`**:
   Pada [stores/productStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FproductStore.ts), [stores/transactionStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FtransactionStore.ts), [stores/cashStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FcashStore.ts), dan [stores/expenseStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FexpenseStore.ts), kegagalan *query* sementara ditangani dengan mereset *state* menjadi *array* kosong (`set({ products: [], loading: false })`). Ketika kasir berpindah tab atau baru saja menyelesaikan transaksi di [app/transaksi.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2Ftransaksi.tsx), beberapa *hook* `useFocusEffect` memanggil banyak pembacaan SQLite sekaligus. Jika SQLite masih mengunci file WAL sesaat (`SQLITE_BUSY`), *query* masuk ke `catch` dan menghapus seluruh daftar produk/transaksi/keuangan dari layar.
2. **Koneksi SQLite Ganda di Luar Context**:
   Membuka koneksi terpisah dengan `openDatabaseSync('pos.db')` di luar `useSQLiteContext()` (seperti pada [stores/balanceSheetStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FbalanceSheetStore.ts) atau [services/backup.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fbackup.ts)) membuat dua koneksi berbeda saling mengunci file `pos.db`. Saat aplikasi ditutup dan dibuka ulang, semua *lock* terlepas sehingga data terbaca kembali.

### B. Kode Perbaikan Spesifik

#### 1. Tambahkan Helper *Retry* dan *Single-Flight Lock* di [services/database.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fdatabase.ts)
Tambahkan fungsi pembungkus `withSqliteRetry` di [services/database.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fdatabase.ts) agar setiap *query* yang berbenturan dengan transaksi lain otomatis mencoba ulang setelah jeda singkat tanpa melempar *error* ke UI:

```ts
import type { SQLiteDatabase } from 'expo-sqlite';

let migrationPromise: Promise<void> | null = null;

export async function withSqliteRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delayMs = 150
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const msg = String(error?.message || '').toLowerCase();
      const isBusy = msg.includes('locked') || msg.includes('busy');
      if (!isBusy || attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  if (migrationPromise) {
    return migrationPromise;
  }
  migrationPromise = (async () => {
    await db.execAsync(`
      PRAGMA busy_timeout = 10000;
      PRAGMA journal_mode = 'WAL';
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
    `);
    // Lanjutkan logika migrasi user_version hingga versi 20 seperti yang sudah ada...
  })();

  try {
    await migrationPromise;
  } finally {
    migrationPromise = null;
  }
}
```

#### 2. Perbaiki Pengelolaan State di [stores/productStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FproductStore.ts)
Jangan pernah menimpa `products: []` di dalam blok `catch`, dan gunakan `withSqliteRetry`:

```ts
import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import { withSqliteRetry } from '@/services/database';

// Di dalam definisi store useProductStore:
loadProducts: async (db: SQLiteDatabase, categoryId?: number | null) => {
  set({ loading: true });
  try {
    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    const params: (number | string)[] = [];

    if (categoryId !== undefined && categoryId !== null) {
      query += ` WHERE p.category_id = ?`;
      params.push(categoryId);
    }
    query += ` ORDER BY p.name ASC`;

    const rows = await withSqliteRetry(() => db.getAllAsync<Product>(query, params));
    set({ products: rows ?? [], loading: false });
  } catch (error) {
    console.warn('loadProducts gagal sementara, mempertahankan data di memori:', error);
    // PENTING: Jangan mengosongkan products: [] agar data di UI tidak hilang!
    set({ loading: false });
  }
},
```

#### 3. Terapkan Pola yang Sama di [stores/transactionStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FtransactionStore.ts), [stores/cashStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FcashStore.ts), [stores/expenseStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FexpenseStore.ts), dan [stores/balanceSheetStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FbalanceSheetStore.ts)
* Pada semua fungsi `loadTransactions`, `loadCashMutations`, `loadExpenses`, dan `loadBalanceSheet`, bungkus pemanggilan `db.getAllAsync` / `db.getFirstAsync` dengan `withSqliteRetry(...)`.
* Pada setiap blok `catch (error)`, **hapus** baris yang mengatur ulang *array* data menjadi `[]` atau mereset nilai saldo menjadi `0`; cukup ubah status `loading: false` sehingga nilai terakhir yang valid tetap tampil di layar.
* Pada [stores/balanceSheetStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FbalanceSheetStore.ts) dan [services/backup.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fbackup.ts), pastikan parameter `db: SQLiteDatabase` diteruskan dari komponen pemanggil yang menggunakan `const db = useSQLiteContext()`, bukan memanggil `SQLite.openDatabaseSync('pos.db')` secara terpisah.

## 4. Audit & Solusi Kendala #3: Upload Gambar Gagal (`unregistered ActivityResultLauncher`)

### A. Analisis Teknis Berdasarkan Tangkapan Layar Tablet
Pesan notifikasi yang muncul pada tablet Anda saat memilih logo usaha/QRIS/foto produk adalah:
* **Pesan Error**: `ExponentImagePicker.launchImageLibraryAsync` ditolak dengan `java.lang.IllegalStateException` karena sistem mencoba menjalankan `ActivityResultLauncher` yang belum terdaftar pada kontrak `ImageLibraryContract` ([GitHub Issue #19512](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fexpo%2Fexpo%2Fissues%2F19512), [GitHub Issue #19477](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Fexpo%2Fexpo%2Fissues%2F19477)).
* **Penyebab 1 (Ketidakcocokan Versi SDK 54 vs SDK 52)**: Di [package.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fpackage.json), proyek memakai `"expo": "~54.0.37"`, tetapi [expo-image-picker](https://www.google.com/search?q=https%3A%2F%2Fclassic.yarnpkg.com%2Fen%2Fpackage%2Fexpo-image-picker) masih versi `"~16.0.6"` (untuk SDK 52), sedangkan Expo SDK 54 mewajibkan `expo-image-picker` versi `~17.0.10` / `~17.0.11` ([Reddit r/reactnative](https://www.google.com/search?q=https%3A%2F%2Fwww.reddit.com%2Fr%2Freactnative%2Fcomments%2F1pvqnjs%2Fis_expoimagepicker_not_compatible_with_expo_sdk_54%2F)). Perbedaan versi ini merusak pengikatan siklus hidup `ActivityResultLauncher` di Android.
* **Penyebab 2 (Pemanggilan Langsung & Siklus Hidup Activity)**: Di [app/(tabs)/store-settings.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F%28tabs%29%2Fstore-settings.tsx), tombol unggah logo dan QRIS memanggil `ImagePicker.launchImageLibraryAsync` secara langsung. Saat dialog izin muncul atau orientasi tablet berubah, *Activity* kehilangan referensi *launcher* ([StackOverflow](https://www.google.com/search?q=https%3A%2F%2Fstackoverflow.com%2Fquestions%2F77571716%2Fmy-expo-camera-doesnt-work-because-of-a-bug-with-image-picker-and-permissions)).

### B. Kode Perbaikan Spesifik

#### 1. Ganti Isi [utils/imagePickerHelper.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Futils%2FimagePickerHelper.ts) dengan Fallback Otomatis `expo-document-picker`
Karena proyek Anda sudah memiliki `expo-document-picker` (`~14.0.8`) di [package.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fpackage.json), kita dapat menghapus opsi `legacy: true` dan menambahkan *fallback* otomatis ke `DocumentPicker.getDocumentAsync` apabila `ActivityResultLauncher` pada tablet mengalami kegagalan registrasi:

```ts
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

async function fallbackPickImageWithDocumentPicker(): Promise<string | null> {
  try {
    const docResult = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!docResult.canceled && docResult.assets && docResult.assets.length > 0) {
      return docResult.assets[0].uri;
    }
    return null;
  } catch (docError: any) {
    console.warn('Fallback DocumentPicker gagal:', docError);
    Alert.alert(
      'Perhatian Galeri',
      'Gagal membuka pemilih gambar perangkat. Silakan coba kembali.'
    );
    return null;
  }
}

export async function pickImageFromGallery(): Promise<string | null> {
  try {
    // Periksa izin terlebih dahulu tanpa memicu dialog ulang jika sudah diberikan
    const currentPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!currentPerm.granted) {
      const reqPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!reqPerm.granted) {
        // Jika izin media ditolak di Android, gunakan DocumentPicker sistem yang tidak butuh izin storage
        return await fallbackPickImageWithDocumentPicker();
      }
      // Beri jeda singkat agar MainActivity selesai resume setelah dialog izin tertutup
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error: any) {
    console.warn('ImagePicker gagal, mengalihkan ke DocumentPicker:', error?.message);
    // Jika muncul IllegalStateException (unregistered ActivityResultLauncher),
    // otomatis buka pemilih file gambar sistem tanpa menampilkan error ke pengguna!
    return await fallbackPickImageWithDocumentPicker();
  }
}

export async function takePhotoWithCamera(): Promise<string | null> {
  try {
    const currentPerm = await ImagePicker.getCameraPermissionsAsync();
    if (!currentPerm.granted) {
      const reqPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!reqPerm.granted) {
        Alert.alert(
          'Izin Kamera Diperlukan',
          'Silakan aktifkan izin kamera di pengaturan perangkat Anda.'
        );
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error: any) {
    console.warn('Gagal membuka kamera, mengalihkan ke pemilih gambar:', error?.message);
    Alert.alert(
      'Kamera Tidak Tersedia',
      'Kamera tidak dapat dibuka saat ini. Silakan pilih foto dari berkas perangkat.'
    );
    return await fallbackPickImageWithDocumentPicker();
  }
}
```

#### 2. Perbaiki Penyimpanan Gambar Lokal di [utils/imageStorage.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Futils%2FimageStorage.ts)
Pastikan fungsi penyimpanan menangani URI dari `ImagePicker` maupun `DocumentPicker` dengan aman:

```ts
import * as FileSystem from 'expo-file-system/legacy';

export type ImageFolder = 'products' | 'qris' | 'logo' | 'debts';

export async function saveImageLocally(
  sourceUri: string,
  folder: ImageFolder
): Promise<string> {
  if (!sourceUri) return '';

  try {
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      return sourceUri;
    }

    // Jika gambar sudah berada di dalam documentDirectory aplikasi, tidak perlu disalin ulang
    if (sourceUri.startsWith(baseDir)) {
      return sourceUri;
    }

    const targetDir = `${baseDir}${folder}/`;
    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    const rawExt = sourceUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const validExt = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
    const fileName = `${folder}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${validExt}`;
    const destinationUri = `${targetDir}${fileName}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.warn('Gagal menyalin gambar ke direktori dokumen lokal:', error);
    return sourceUri;
  }
}
```

#### 3. Gunakan `pickImageFromGallery()` Secara Konsisten di [app/(tabs)/store-settings.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F%28tabs%29%2Fstore-settings.tsx)
Pada [app/(tabs)/store-settings.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F%28tabs%29%2Fstore-settings.tsx), pastikan fungsi untuk memilih **Logo Usaha** dan **Foto QRIS** tidak memanggil `ImagePicker.launchImageLibraryAsync` secara langsung, melainkan memanggil helper `pickImageFromGallery()` dan `saveImageLocally()`:

```ts
import { pickImageFromGallery } from '@/utils/imagePickerHelper';
import { saveImageLocally } from '@/utils/imageStorage';

// Handler untuk memilih Logo Usaha di app/(tabs)/store-settings.tsx
const handlePickStoreLogo = async () => {
  const pickedUri = await pickImageFromGallery();
  if (!pickedUri) return;

  const savedUri = await saveImageLocally(pickedUri, 'logo');
  setLogoUri(savedUri);
};

// Handler untuk memilih Foto QRIS di app/(tabs)/store-settings.tsx
const handlePickQrisImage = async () => {
  const pickedUri = await pickImageFromGallery();
  if (!pickedUri) return;

  const savedUri = await saveImageLocally(pickedUri, 'qris');
  setQrisUri(savedUri);
};
```

## 5. Urutan Langkah Eksekusi & Build Ulang APK

Ikuti urutan langkah berikut di komputer pengembangan Anda sebelum melakukan *build* ulang APK untuk tablet:

1. **Sinkronkan Versi Paket Expo SDK 54**:
   Jalankan perintah berikut di direktori utama proyek untuk menyelaraskan `expo-image-picker` (ke `~17.0.x`), `expo-sqlite`, `expo-router`, dan paket *native* lainnya:
   ```bash
   npx expo install --fix
   npx expo-doctor
   ```
2. **Terapkan Perubahan Kode**:
   * Perbarui [app.json](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp.json) (`"newArchEnabled": false` dan daftar `"plugins"`).
   * Perbarui [app/\_layout.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F_layout.tsx) (tambahkan `<Suspense>` dan `useSuspense` pada `<SQLite.SQLiteProvider>`).
   * Perbarui [services/database.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fservices%2Fdatabase.ts) (tambahkan `withSqliteRetry` dan *guard* migrasi).
   * Perbarui [stores/productStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FproductStore.ts), [stores/transactionStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FtransactionStore.ts), [stores/cashStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FcashStore.ts), dan [stores/expenseStore.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fstores%2FexpenseStore.ts) (hapus pengosongan *state* di blok `catch`).
   * Perbarui [utils/imagePickerHelper.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Futils%2FimagePickerHelper.ts), [utils/imageStorage.ts](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Futils%2FimageStorage.ts), dan [app/(tabs)/store-settings.tsx](https://www.google.com/search?q=https%3A%2F%2Fgithub.com%2Frichqe6E%2FSIA_APK_Offline%2Fblob%2Fmain%2Fapp%2F%28tabs%29%2Fstore-settings.tsx).
3. **Bersihkan Cache & Build Ulang Native Android**:
   Karena perubahan ini menyentuh modul *native* (`expo-image-picker`, `expo-sqlite`, dan `newArchEnabled`), Anda **wajib** melakukan *build* ulang penuh (bukan sekadar *reload* JS):
   ```bash
   # Jika menggunakan EAS Build di cloud:
   eas build -p android --profile preview --clear-cache

   # Atau jika melakukan build lokal dengan Android Studio / Gradle:
   npx expo prebuild --clean
   npx expo run:android --variant release
   ```
4. **Instalasi Bersih di Tablet**:
   Sebelum menginstal APK baru di tablet, lakukan *backup* data jika diperlukan atau *uninstall* APK lama yang masih membawa konfigurasi `ActivityResultLauncher` versi SDK 52, lalu instal APK hasil *build* baru.
