import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

export type CashTransactionType = 'in' | 'out';

export interface CashEntry {
  id: number;
  type: CashTransactionType;
  category: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
}

export const CASH_IN_CATEGORIES = [
  { id: 'modal_awal', label: 'Modal Awal Kasir' },
  { id: 'setoran_modal', label: 'Setoran Tambahan Pemilik' },
  { id: 'pendapatan_jasa', label: 'Pendapatan Jasa / Penitipan' },
  { id: 'pendapatan_lain', label: 'Pendapatan Operasional Lain' },
] as const;

export const CASH_OUT_CATEGORIES_RETAIL = [
  { id: 'kulakan_stok', label: 'Kulakan Stok Barang' },
  { id: 'kemasan_plastik', label: 'Kemasan & Plastik' },
  { id: 'gaji_karyawan', label: 'Gaji Karyawan' },
  { id: 'listrik_air', label: 'Listrik, Air & Internet' },
  { id: 'sewa_tempat', label: 'Sewa Tempat / Kios' },
  { id: 'perawatan', label: 'Perawatan & Servis Alat' },
  { id: 'transportasi', label: 'Transportasi & Logistik' },
  { id: 'lain-lain', label: 'Beban Operasional Lain' },
] as const;

export const CASH_OUT_CATEGORIES_KULINER = [
  { id: 'belanja_bahan', label: 'Belanja Bahan Baku & Bumbu' },
  { id: 'gas_energi', label: 'Gas Elpiji & Bahan Bakar' },
  { id: 'kemasan_plastik', label: 'Kemasan Makanan & Box' },
  { id: 'gaji_karyawan', label: 'Gaji Karyawan' },
  { id: 'listrik_air', label: 'Listrik, Air & Internet' },
  { id: 'sewa_tempat', label: 'Sewa Tempat / Kios' },
  { id: 'perawatan', label: 'Perawatan Alat Dapur' },
  { id: 'transportasi', label: 'Transportasi & Pasar' },
  { id: 'lain-lain', label: 'Beban Operasional Lain' },
] as const;

export const CASH_OUT_CATEGORIES = CASH_OUT_CATEGORIES_RETAIL;

export function getCashOutCategories(mode?: 'retail' | 'kuliner') {
  return mode === 'kuliner' ? CASH_OUT_CATEGORIES_KULINER : CASH_OUT_CATEGORIES_RETAIL;
}

export const CASH_CATEGORY_MAP: Record<string, string> = {
  modal_awal: 'Modal Awal Kasir',
  setoran_modal: 'Setoran Tambahan Pemilik',
  pendapatan_jasa: 'Pendapatan Jasa / Penitipan',
  pendapatan_lain: 'Pendapatan Operasional Lain',
  pelunasan_piutang: 'Pelunasan Piutang Pelanggan',
  retur_supplier: 'Pengembalian Dana Supplier',
  belanja_bahan: 'Belanja Bahan Baku & Bumbu',
  gas_energi: 'Gas Elpiji & Bahan Bakar',
  kulakan_stok: 'Kulakan Stok Barang',
  bayar_hutang_supplier: 'Pembayaran Hutang Supplier',
  listrik_air: 'Listrik, Air & Internet',
  sewa_tempat: 'Sewa Tempat / Kios',
  gaji_karyawan: 'Gaji Karyawan',
  kemasan_plastik: 'Kemasan & Plastik',
  perawatan: 'Perawatan & Servis Alat',
  transportasi: 'Transportasi & Logistik',
  'lain-lain': 'Beban Operasional Lain',
  // Legacy aliases
  gaji: 'Gaji Karyawan',
  sewa: 'Sewa Tempat / Kios',
  listrik: 'Listrik, Air & Internet',
  bahan_baku: 'Belanja Bahan Baku & Bumbu',
};

interface CashState {
  entries: CashEntry[];
  totalCashIn: number;
  totalCashOut: number;
  salesCashGrossIn: number;
  salesCashChangeOut: number;
  salesCashTotal: number;
  currentBalance: number;
  loading: boolean;

  loadLedger: (db: SQLiteDatabase) => Promise<void>;
  addEntry: (
    db: SQLiteDatabase,
    type: CashTransactionType,
    category: string,
    description: string,
    amount: number,
    date?: string
  ) => Promise<void>;
  updateEntry: (
    db: SQLiteDatabase,
    id: number,
    type: CashTransactionType,
    category: string,
    description: string,
    amount: number,
    date?: string
  ) => Promise<void>;
  deleteEntry: (db: SQLiteDatabase, id: number) => Promise<void>;
  getCashBalance: (db: SQLiteDatabase) => Promise<number>;
}

export const useCashStore = create<CashState>((set, get) => ({
  entries: [],
  totalCashIn: 0,
  totalCashOut: 0,
  salesCashGrossIn: 0,
  salesCashChangeOut: 0,
  salesCashTotal: 0,
  currentBalance: 0,
  loading: false,

  loadLedger: async (db) => {
    set({ loading: true });
    try {
      const rows = await db.getAllAsync<CashEntry>(
        'SELECT * FROM cash_ledger ORDER BY date DESC, id DESC'
      );

      // Hitung uang diterima dan uang kembalian dari transaksi penjualan tunai
      const salesRow = await db.getFirstAsync<{ gross_in: number; gross_change: number; total: number }>(
        `SELECT 
           COALESCE(SUM(payment_amount), 0) as gross_in,
           COALESCE(SUM(change), 0) as gross_change,
           COALESCE(SUM(total), 0) as total
         FROM transactions 
         WHERE payment_method = 'tunai'`
      );
      const salesGrossIn = salesRow?.gross_in ?? 0;
      const salesChangeOut = salesRow?.gross_change ?? 0;
      const salesCash = salesRow?.total ?? 0;

      // Hitung manual cash in & out dari buku kas
      let manualIn = 0;
      let manualOut = 0;
      for (const row of rows) {
        if (row.type === 'in') {
          manualIn += row.amount;
        } else {
          manualOut += row.amount;
        }
      }

      const totalIn = manualIn + salesGrossIn;
      const totalOut = manualOut + salesChangeOut;
      const balance = totalIn - totalOut;

      set({
        entries: rows,
        totalCashIn: totalIn,
        totalCashOut: totalOut,
        salesCashGrossIn: salesGrossIn,
        salesCashChangeOut: salesChangeOut,
        salesCashTotal: salesCash,
        currentBalance: balance,
        loading: false,
      });
    } catch (e) {
      console.error('loadLedger error:', e);
      set({ loading: false });
    }
  },

  addEntry: async (db, type, category, description, amount, date) => {
    const today = date || new Date().toISOString().split('T')[0];
    await db.runAsync(
      'INSERT INTO cash_ledger (type, category, description, amount, date) VALUES (?, ?, ?, ?, ?)',
      type,
      category,
      description,
      amount,
      today
    );
    await get().loadLedger(db);
  },

  updateEntry: async (db, id, type, category, description, amount, date) => {
    const today = date || new Date().toISOString().split('T')[0];
    await db.runAsync(
      'UPDATE cash_ledger SET type = ?, category = ?, description = ?, amount = ?, date = ? WHERE id = ?',
      type,
      category,
      description,
      amount,
      today,
      id
    );
    await get().loadLedger(db);
  },

  deleteEntry: async (db, id) => {
    await db.runAsync('DELETE FROM cash_ledger WHERE id = ?', id);
    await get().loadLedger(db);
  },

  getCashBalance: async (db) => {
    const salesRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE payment_method = 'tunai'"
    );
    const salesCash = salesRow?.total ?? 0;

    const inRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE type = 'in'"
    );
    const manualIn = inRow?.total ?? 0;

    const outRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE type = 'out'"
    );
    const manualOut = outRow?.total ?? 0;

    return (salesCash + manualIn) - manualOut;
  },
}));
