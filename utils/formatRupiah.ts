/**
 * Utilitas terpusat untuk format input nominal Rupiah dengan pemisah ribuan titik.
 * Digunakan oleh seluruh TextInput nominal di aplikasi (diskon, edit harga, berat, dll).
 *
 * Catatan:
 * - Locale Indonesia (`id-ID`) menghasilkan format ribuan dengan titik, mis. 1000000 -> "1.000.000".
 * - Untuk input, kita hanya izinkan digit (0-9). Karakter lain otomatis diabaikan.
 */

/**
 * Mengambil string input dan mengembalikan string yang sudah diformat dengan titik ribuan.
 * Cocok dipasang di onChangeText TextInput.
 */
export function formatRupiahInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : String(value);
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return '';
  // Hindari overflow ke nilai > MAX_SAFE_INTEGER untuk input praktis (tetap aman sampai ~9 kuadriliun).
  const num = parseInt(digitsOnly, 10);
  if (Number.isNaN(num)) return '';
  return num.toLocaleString('id-ID');
}

/**
 * Konversi string berformat Rupiah (mis. "1.000.000") kembali menjadi number (1000000).
 * Return 0 untuk input kosong / tidak valid.
 */
export function parseRupiahInput(formatted: string | number | null | undefined): number {
  if (formatted === null || formatted === undefined) return 0;
  if (typeof formatted === 'number') return Math.max(0, Math.floor(formatted));
  const digitsOnly = formatted.replace(/\D/g, '');
  if (!digitsOnly) return 0;
  const num = parseInt(digitsOnly, 10);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Format angka (number) menjadi string Rupiah dengan awalan "Rp" + titik ribuan.
 * Contoh: 1500000 -> "Rp 1.500.000".
 */
export function formatRupiahDisplay(value: number | null | undefined, withSymbol: boolean = true): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return withSymbol ? 'Rp 0' : '0';
  }
  const num = Math.floor(value);
  const formatted = num.toLocaleString('id-ID');
  return withSymbol ? `Rp ${formatted}` : formatted;
}
