import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

export type CashTransactionType = 'in' | 'out';

export type CashAccount = 'hand' | 'bank';

export interface CashEntry {
  id: number;
  type: CashTransactionType;
  category: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
  account: CashAccount;
}

export interface CashDenominationData {
  counts: Record<number, number>;
  total: number;
  updatedAt: string;
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
  setor_bank: 'Setoran Kas Laci ke Bank',
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
  salesQrisTotal: number;
  totalBankDeposited: number;
  currentBalance: number;     // Saldo Kas Fisik Laci (hand)
  cashHandBalance: number;    // Saldo Kas Fisik Laci (hand)
  cashBankBalance: number;    // Saldo Kas di Bank / Rekening (bank)
  totalBalance: number;       // Total Likuiditas Toko (hand + bank)
  denominations: CashDenominationData | null;
  loading: boolean;

  loadLedger: (db: SQLiteDatabase) => Promise<void>;
  loadDenominations: (db: SQLiteDatabase) => Promise<void>;
  saveDenominations: (db: SQLiteDatabase, counts: Record<number, number>) => Promise<void>;
  clearDenominations: (db: SQLiteDatabase) => Promise<void>;
  addEntry: (
    db: SQLiteDatabase,
    type: CashTransactionType,
    category: string,
    description: string,
    amount: number,
    date?: string,
    account?: CashAccount
  ) => Promise<void>;
  depositToBank: (
    db: SQLiteDatabase,
    amount: number,
    bankName: string,
    notes?: string,
    date?: string
  ) => Promise<void>;
  updateEntry: (
    db: SQLiteDatabase,
    id: number,
    type: CashTransactionType,
    category: string,
    description: string,
    amount: number,
    date?: string,
    account?: CashAccount
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
  salesQrisTotal: 0,
  totalBankDeposited: 0,
  currentBalance: 0,
  cashHandBalance: 0,
  cashBankBalance: 0,
  totalBalance: 0,
  denominations: null,
  loading: false,

  loadLedger: async (db) => {
    set({ loading: true });
    try {
      const rawRows = await db.getAllAsync<any>(
        'SELECT * FROM cash_ledger ORDER BY date DESC, id DESC'
      );

      const rows: CashEntry[] = rawRows.map((r) => ({
        id: r.id,
        type: r.type,
        category: r.category,
        description: r.description,
        amount: r.amount,
        date: r.date,
        created_at: r.created_at,
        account: r.account === 'bank' ? 'bank' : 'hand',
      }));

      // 1. Transaksi Penjualan Tunai (Kas di Tangan)
      const salesCashRow = await db.getFirstAsync<{ gross_in: number; gross_change: number; total: number }>(
        `SELECT 
           COALESCE(SUM(payment_amount), 0) as gross_in,
           COALESCE(SUM(change), 0) as gross_change,
           COALESCE(SUM(total), 0) as total
         FROM transactions 
         WHERE payment_method = 'tunai'`
      );
      const salesGrossIn = salesCashRow?.gross_in ?? 0;
      const salesChangeOut = salesCashRow?.gross_change ?? 0;
      const salesCash = salesCashRow?.total ?? 0;

      // 2. Transaksi Penjualan QRIS / Transfer (Kas di Bank)
      const salesQrisRow = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(total), 0) as total
         FROM transactions 
         WHERE payment_method = 'qris'`
      );
      const salesQris = salesQrisRow?.total ?? 0;

      // 3. Mutasi Buku Kas Manual (Pisahkan Kas Tangan vs Kas Bank)
      let manualHandIn = 0;
      let manualHandOut = 0;
      let manualBankIn = 0;
      let manualBankOut = 0;
      let bankDeposited = 0;

      for (const row of rows) {
        if (row.type === 'in') {
          if (row.account === 'bank') {
            manualBankIn += row.amount;
          } else {
            manualHandIn += row.amount;
          }
        } else {
          if (row.account === 'bank') {
            manualBankOut += row.amount;
          } else {
            manualHandOut += row.amount;
            if (row.category === 'setor_bank') {
              bankDeposited += row.amount;
              // Kompatibilitas legacy: jika row setor_bank tidak memiliki pasangan 'in' bank
              const hasBankInPair = rows.some(
                (other) => other.type === 'in' && other.account === 'bank' && other.category === 'setor_bank' && other.amount === row.amount && other.date === row.date
              );
              if (!hasBankInPair) {
                manualBankIn += row.amount;
              }
            }
          }
        }
      }

      const totalIn = manualHandIn + manualBankIn + salesGrossIn + salesQris;
      const totalOut = manualHandOut + manualBankOut + salesChangeOut;

      const handBalance = (salesGrossIn + manualHandIn) - (salesChangeOut + manualHandOut);
      const bankBalance = (salesQris + manualBankIn) - manualBankOut;
      const totalBalance = handBalance + bankBalance;

      set({
        entries: rows,
        totalCashIn: totalIn,
        totalCashOut: totalOut,
        salesCashGrossIn: salesGrossIn,
        salesCashChangeOut: salesChangeOut,
        salesCashTotal: salesCash,
        salesQrisTotal: salesQris,
        totalBankDeposited: bankDeposited,
        currentBalance: handBalance,
        cashHandBalance: handBalance,
        cashBankBalance: bankBalance,
        totalBalance: totalBalance,
        loading: false,
      });

      // Muat juga pecahan uang
      await get().loadDenominations(db);
    } catch (e) {
      console.error('loadLedger error:', e);
      set({ loading: false });
    }
  },

  loadDenominations: async (db) => {
    try {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'cash_denominations'"
      );
      if (row?.value) {
        const parsed: CashDenominationData = JSON.parse(row.value);
        set({ denominations: parsed });
      } else {
        set({ denominations: null });
      }
    } catch {
      set({ denominations: null });
    }
  },

  saveDenominations: async (db, counts) => {
    let total = 0;
    for (const [denomStr, count] of Object.entries(counts)) {
      const denom = parseInt(denomStr, 10) || 0;
      const cnt = parseInt(count as any, 10) || 0;
      if (denom > 0 && cnt > 0) {
        total += denom * cnt;
      }
    }
    const data: CashDenominationData = {
      counts,
      total,
      updatedAt: new Date().toLocaleString('id-ID'),
    };
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('cash_denominations', ?)",
      JSON.stringify(data)
    );
    set({ denominations: data });
  },

  clearDenominations: async (db) => {
    await db.runAsync("DELETE FROM settings WHERE key = 'cash_denominations'");
    set({ denominations: null });
  },

  addEntry: async (db, type, category, description, amount, date, account = 'hand') => {
    const today = date || new Date().toISOString().split('T')[0];
    await db.runAsync(
      'INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)',
      type,
      category,
      description,
      amount,
      today,
      account
    );
    await get().loadLedger(db);
  },

  depositToBank: async (db, amount, bankName, notes, date) => {
    const cleanBank = bankName.trim() || 'Bank';
    const cleanNotes = notes?.trim() ? ` - ${notes.trim()}` : '';
    const descOut = `Setoran Kas Laci ke ${cleanBank}${cleanNotes}`;
    const descIn = `Penerimaan Setoran Kas Laci (${cleanBank})${cleanNotes}`;
    const today = date || new Date().toISOString().split('T')[0];

    // 1. Kurangi Kas Tangan (Laci)
    await db.runAsync(
      'INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)',
      'out',
      'setor_bank',
      descOut,
      amount,
      today,
      'hand'
    );

    // 2. Tambah Kas Bank (Rekening)
    await db.runAsync(
      'INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)',
      'in',
      'setor_bank',
      descIn,
      amount,
      today,
      'bank'
    );

    await get().loadLedger(db);
  },

  updateEntry: async (db, id, type, category, description, amount, date, account = 'hand') => {
    const today = date || new Date().toISOString().split('T')[0];
    await db.runAsync(
      'UPDATE cash_ledger SET type = ?, category = ?, description = ?, amount = ?, date = ?, account = ? WHERE id = ?',
      type,
      category,
      description,
      amount,
      today,
      account,
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
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE type = 'in' AND (account = 'hand' OR account IS NULL)"
    );
    const manualIn = inRow?.total ?? 0;

    const outRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE type = 'out' AND (account = 'hand' OR account IS NULL)"
    );
    const manualOut = outRow?.total ?? 0;

    return (salesCash + manualIn) - manualOut;
  },
}));
