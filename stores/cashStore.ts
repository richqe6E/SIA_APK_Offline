import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';
import { withSqliteRetry } from '@/services/database';

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
  counts: Record<number | string, number>;
  total: number;
  updatedAt: string;
}

export interface CashCategoryItem {
  id: string;
  label: string;
  icon: string;
  description: string;
  isProfitLoss: boolean;
}

export const CASH_IN_CATEGORIES: CashCategoryItem[] = [
  // Terkait Laba / Rugi (Operasional)
  { id: 'pendapatan_komisi', label: 'Komisi / Bonus Supplier / Cashback', icon: '🎁', description: 'Bonus supplier, cashback atau reward pembelian', isProfitLoss: true },
  { id: 'pendapatan_jasa', label: 'Pendapatan Jasa / Penitipan', icon: '🤝', description: 'Komisi penitipan barang, fee atau jasa lainnya', isProfitLoss: true },
  { id: 'pendapatan_lain', label: 'Pendapatan Operasional Lain', icon: '💵', description: 'Pemasukan operasional usaha lainnya', isProfitLoss: true },
  // Non-Laba / Rugi (Modal / Pindahan / Kewajiban)
  { id: 'modal_awal', label: 'Modal Awal Kasir / Toko', icon: '🏦', description: 'Pengisian modal laci kasir atau tambahan modal usaha', isProfitLoss: false },
  { id: 'setoran_modal', label: 'Setoran Modal Pemilik', icon: '💰', description: 'Injeksi dana modal segar dari pemilik toko', isProfitLoss: false },
  { id: 'pinjaman_masuk', label: 'Penerimaan Pinjaman / Utang', icon: '📥', description: 'Penerimaan pinjaman modal kerja dari luar/bank', isProfitLoss: false },
  { id: 'tarik_bank', label: 'Tarik Tunai dari Bank', icon: '🏧', description: 'Penarikan saldo rekening bank untuk mengisi kas fisik laci', isProfitLoss: false },
];

export const CASH_OUT_CATEGORIES: CashCategoryItem[] = [
  // Terkait Laba / Rugi (Beban Operasional Toko)
  { id: 'operasional', label: 'Operasional Umum Toko', icon: '🏪', description: 'Biaya operasional harian toko agen', isProfitLoss: true },
  { id: 'gaji_karyawan', label: 'Gaji & Upah Karyawan', icon: '👥', description: 'Gaji bulanan, uang lembur atau upah harian karyawan', isProfitLoss: true },
  { id: 'listrik_air', label: 'Listrik, Air & Internet', icon: '⚡', description: 'Token listrik PLN freezer, tagihan air PDAM, WiFi toko', isProfitLoss: true },
  { id: 'konsumsi_karyawan', label: 'Konsumsi / Makan Karyawan', icon: '🍱', description: 'Uang makan harian, snack atau konsumsi jaga toko', isProfitLoss: true },
  { id: 'retribusi_kebersihan', label: 'Retribusi, Sampah & Keamanan', icon: '🧹', description: 'Iuran kebersihan pasar/lingkungan, keamanan toko', isProfitLoss: true },
  { id: 'sewa_tempat', label: 'Sewa Tempat / Kios / Freezer', icon: '🏬', description: 'Biaya sewa ruko toko, kios dagang atau sewa freezer', isProfitLoss: true },
  { id: 'kemasan_plastik', label: 'Kemasan, Plastik & Kresek', icon: '🛍️', description: 'Belanja kantong kresek, plastik vacuum, label kemasan', isProfitLoss: true },
  { id: 'transportasi', label: 'Transportasi & Logistik', icon: '🛵', description: 'Bensin motor/mobil toko, ongkir kirim barang, parkir', isProfitLoss: true },
  { id: 'perawatan', label: 'Perawatan & Servis Freezer/Alat', icon: '🔧', description: 'Servis kompresor freezer, freon, perbaikan timbangan', isProfitLoss: true },
  { id: 'lain-lain', label: 'Beban Operasional Lainnya', icon: '📦', description: 'Pengeluaran operasional toko lainnya', isProfitLoss: true },
  // Non-Laba / Rugi (Neraca / Modal / Prive / Pindahan)
  { id: 'prive', label: 'Prive / Penarikan Pribadi Pemilik', icon: '👤', description: 'Pengambilan uang toko untuk keperluan pribadi pemilik', isProfitLoss: false },
  { id: 'bayar_pinjaman', label: 'Bayar Cicilan Pinjaman Bank/Utang', icon: '💳', description: 'Pelunasan/angsuran pokok pinjaman modal kerja luar', isProfitLoss: false },
  { id: 'kulakan_stok', label: 'Kulakan Stok Barang Dagang', icon: '🛒', description: 'Pembelian barang dagang tunai (masuk aset persediaan)', isProfitLoss: false },
  { id: 'bayar_hutang_supplier', label: 'Pembayaran Hutang Supplier', icon: '🤝', description: 'Pelunasan nota hutang ke supplier rekanan', isProfitLoss: false },
];

export const CASH_CATEGORY_MAP: Record<string, string> = {
  penjualan_produk: 'Penjualan Produk',
  pelunasan_piutang: 'Pelunasan Piutang Pelanggan',
  modal_awal: 'Modal Awal Kasir / Toko',
  setoran_modal: 'Setoran Modal Pemilik',
  pinjaman_masuk: 'Penerimaan Pinjaman / Utang',
  tarik_bank: 'Tarik Tunai dari Bank',
  pendapatan_komisi: 'Komisi / Bonus Supplier / Cashback',
  pendapatan_jasa: 'Pendapatan Jasa / Penitipan',
  pendapatan_lain: 'Pendapatan Operasional Lain',
  operasional: 'Operasional Umum Toko',
  gaji_karyawan: 'Gaji & Upah Karyawan',
  listrik_air: 'Listrik, Air & Internet',
  konsumsi_karyawan: 'Konsumsi / Makan Karyawan',
  retribusi_kebersihan: 'Retribusi, Sampah & Keamanan',
  sewa_tempat: 'Sewa Tempat / Kios / Freezer',
  kemasan_plastik: 'Kemasan, Plastik & Kresek',
  transportasi: 'Transportasi & Logistik',
  perawatan: 'Perawatan & Servis Freezer/Alat',
  'lain-lain': 'Beban Operasional Lainnya',
  prive: 'Prive / Penarikan Pribadi Pemilik',
  bayar_pinjaman: 'Bayar Cicilan Pinjaman Bank/Utang',
  kulakan_stok: 'Kulakan Stok Barang Dagang',
  bayar_hutang_supplier: 'Pembayaran Hutang Supplier',
  setor_bank: 'Setoran Kas Laci ke Bank',
  selisih_kas: 'Penyesuaian Selisih Kasir',
  // Legacy aliases
  gaji: 'Gaji & Upah Karyawan',
  sewa: 'Sewa Tempat / Kios / Freezer',
  listrik: 'Listrik, Air & Internet',
  lainnya: 'Beban Operasional Lainnya',
  retur_supplier: 'Pengembalian Dana Supplier',
  belanja_bahan: 'Belanja Bahan Baku & Bumbu',
  gas_energi: 'Gas Elpiji & Bahan Bakar',
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
  saveDenominations: (db: SQLiteDatabase, counts: Record<number | string, number>, customTotal?: number) => Promise<void>;
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
    if (get().entries.length === 0) {
      set({ loading: true });
    }
    try {
      const rawRows = await withSqliteRetry(() =>
        db.getAllAsync<any>(
          'SELECT * FROM cash_ledger ORDER BY date DESC, id DESC'
        )
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

      // 1. Transaksi Penjualan Tunai Murni (bukan split payment)
      const salesCashRow = await withSqliteRetry(() =>
        db.getFirstAsync<{ gross_in: number; gross_change: number; total: number }>(
          `SELECT
             COALESCE(SUM(payment_amount), 0) as gross_in,
             COALESCE(SUM(change), 0) as gross_change,
             COALESCE(SUM(total), 0) as total
           FROM transactions
           WHERE payment_method = 'tunai' AND (cash_received = 0 OR qris_received = 0)`
        )
      );
      const salesGrossIn = salesCashRow?.gross_in ?? 0;
      const salesChangeOut = salesCashRow?.gross_change ?? 0;
      const salesCash = salesCashRow?.total ?? 0;

      // 2. Transaksi Penjualan QRIS / Transfer Murni (bukan split payment)
      const salesQrisRow = await withSqliteRetry(() =>
        db.getFirstAsync<{ total: number }>(
          `SELECT COALESCE(SUM(total), 0) as total
           FROM transactions
           WHERE payment_method = 'qris' AND (cash_received = 0 OR qris_received = 0)`
        )
      );
      const salesQris = salesQrisRow?.total ?? 0;

      // 2b. Porsi Tunai & QRIS pada transaksi Split Payment (keduanya > 0)
      const splitRow = await withSqliteRetry(() =>
        db.getFirstAsync<{ split_cash: number; split_qris: number }>(
          `SELECT
             COALESCE(SUM(cash_received), 0) as split_cash,
             COALESCE(SUM(qris_received), 0) as split_qris
           FROM transactions
           WHERE (cash_received > 0 AND qris_received > 0)`
        )
      );
      const splitCashPortion = splitRow?.split_cash ?? 0;
      const splitQrisPortion = splitRow?.split_qris ?? 0;

      // 3. Mutasi Buku Kas Manual (Pisahkan Kas Tangan vs Kas Bank)
      let manualHandIn = 0;
      let manualHandOut = 0;
      let manualBankIn = 0;
      let manualBankOut = 0;
      let bankDeposited = 0;

      // Pre-compute bank-in frequency map untuk rekonsiliasi bersih O(N) tanpa risiko double-entry
      const bankInFreq = new Map<string, number>();
      for (const r of rows) {
        if (r.type === 'in' && r.account === 'bank' && r.category === 'setor_bank') {
          const key = `${r.amount}_${r.date}`;
          bankInFreq.set(key, (bankInFreq.get(key) || 0) + 1);
        }
      }

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
              // Kompatibilitas legacy: jika row setor_bank out tidak memiliki pasangan 'in' bank
              const key = `${row.amount}_${row.date}`;
              const available = bankInFreq.get(key) || 0;
              if (available > 0) {
                bankInFreq.set(key, available - 1);
              } else {
                manualBankIn += row.amount;
              }
            }
          }
        }
      }

      // F2: split cash portion masuk ke tangan, qris portion ke bank
      const totalIn = manualHandIn + manualBankIn + salesGrossIn + salesQris + splitCashPortion + splitQrisPortion;
      const totalOut = manualHandOut + manualBankOut + salesChangeOut;

      const handBalance = (salesGrossIn + manualHandIn + splitCashPortion) - (salesChangeOut + manualHandOut);
      const bankBalance = (salesQris + manualBankIn + splitQrisPortion) - manualBankOut;
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

  saveDenominations: async (db, counts, customTotal) => {
    let total = typeof customTotal === 'number' ? customTotal : 0;
    if (typeof customTotal !== 'number') {
      for (const [denomStr, count] of Object.entries(counts)) {
        if (/^\d+$/.test(denomStr)) {
          const denom = parseInt(denomStr, 10) || 0;
          const cnt = parseInt(count as any, 10) || 0;
          if (denom > 0 && cnt > 0) {
            total += denom * cnt;
          }
        }
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
    if (type === 'out') {
      const currentHand = get().cashHandBalance;
      const currentBank = get().cashBankBalance;
      if (account === 'hand' && amount > currentHand) {
        throw new Error(
          `Saldo Kas Laci tidak mencukupi!\n\nSaldo Tersedia: Rp ${Math.round(currentHand).toLocaleString('id-ID')}\nPengeluaran: Rp ${Math.round(amount).toLocaleString('id-ID')}`
        );
      }
      if (account === 'bank' && amount > currentBank) {
        throw new Error(
          `Saldo Kas Bank tidak mencukupi!\n\nSaldo Tersedia: Rp ${Math.round(currentBank).toLocaleString('id-ID')}\nPengeluaran: Rp ${Math.round(amount).toLocaleString('id-ID')}`
        );
      }
    }

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

    // MODAL-011: Atomic & guardrail — gunakan transaksi eksklusif dan cek saldo laci riil langsung dari DB
    await db.withExclusiveTransactionAsync(async (txn) => {
      // 1. Transaksi Penjualan Tunai Murni (bukan split payment)
      const salesCashRow = await txn.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(total), 0) as total
         FROM transactions
         WHERE payment_method = 'tunai' AND (cash_received = 0 OR qris_received = 0)`
      );
      // 2. Porsi Tunai Split Payment (keduanya > 0)
      const splitRow = await txn.getFirstAsync<{ split_cash: number }>(
        `SELECT COALESCE(SUM(cash_received), 0) as split_cash
         FROM transactions
         WHERE (cash_received > 0 AND qris_received > 0)`
      );
      // 3. Mutasi Kas Masuk & Keluar Fisik Laci ('hand' atau default NULL)
      const ledgerInRow = await txn.getFirstAsync<{ total_in: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total_in FROM cash_ledger WHERE type = 'in' AND (account = 'hand' OR account IS NULL)`
      );
      const ledgerOutRow = await txn.getFirstAsync<{ total_out: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total_out FROM cash_ledger WHERE type = 'out' AND (account = 'hand' OR account IS NULL)`
      );

      const salesCash = salesCashRow?.total ?? 0;
      const splitCash = splitRow?.split_cash ?? 0;
      const ledgerIn = ledgerInRow?.total_in ?? 0;
      const ledgerOut = ledgerOutRow?.total_out ?? 0;
      const currentHandBalance = (salesCash + splitCash + ledgerIn) - ledgerOut;

      if (amount > currentHandBalance) {
        throw new Error(
          `Saldo kas fisik di laci tidak mencukupi!\n\nSaldo Tersedia: Rp ${Math.round(currentHandBalance).toLocaleString('id-ID')}\nNominal Setor: Rp ${Math.round(amount).toLocaleString('id-ID')}`
        );
      }

      await txn.runAsync(
        'INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)',
        'out',
        'setor_bank',
        descOut,
        amount,
        today,
        'hand',
      );
      await txn.runAsync(
        'INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)',
        'in',
        'setor_bank',
        descIn,
        amount,
        today,
        'bank',
      );
    });

    await get().loadLedger(db);
  },

  updateEntry: async (db, id, type, category, description, amount, date, account = 'hand') => {
    if (type === 'out') {
      const currentHand = get().cashHandBalance;
      const currentBank = get().cashBankBalance;
      // Ambil entry lama untuk melihat apakah amount berubah
      const oldEntry = get().entries.find((e) => e.id === id);
      const oldAmount = (oldEntry && oldEntry.type === 'out' && oldEntry.account === account) ? oldEntry.amount : 0;
      const effectiveHand = currentHand + oldAmount;
      const effectiveBank = currentBank + oldAmount;

      if (account === 'hand' && amount > effectiveHand) {
        throw new Error(
          `Saldo Kas Laci tidak mencukupi!\n\nSaldo Tersedia: Rp ${Math.round(effectiveHand).toLocaleString('id-ID')}\nPengeluaran: Rp ${Math.round(amount).toLocaleString('id-ID')}`
        );
      }
      if (account === 'bank' && amount > effectiveBank) {
        throw new Error(
          `Saldo Kas Bank tidak mencukupi!\n\nSaldo Tersedia: Rp ${Math.round(effectiveBank).toLocaleString('id-ID')}\nPengeluaran: Rp ${Math.round(amount).toLocaleString('id-ID')}`
        );
      }
    }

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

    // Sinkronisasi dua arah jika yang diubah adalah modal awal kasir
    if (category === 'modal_awal' && type === 'in') {
      try {
        const { useShiftStore } = await import('@/stores/shiftStore');
        const currentShift = useShiftStore.getState().currentShift;
        if (currentShift) {
          await db.runAsync(
            "UPDATE cash_shifts SET starting_cash = ?, expected_cash = ? + total_sales_cash WHERE id = ?",
            amount,
            amount,
            currentShift.id
          );
          await db.runAsync(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_drawer_amount', ?)",
            String(amount)
          );
          useShiftStore.setState({
            todayDrawerAmount: amount,
            currentShift: {
              ...currentShift,
              starting_cash: amount,
              expected_cash: amount + (currentShift.total_sales_cash || 0),
            },
          });
        }
      } catch {}
    }

    await get().loadLedger(db);
  },

  deleteEntry: async (db, id) => {
    const entry = get().entries.find((e) => e.id === id);
    await db.runAsync('DELETE FROM cash_ledger WHERE id = ?', id);

    if (entry && entry.category === 'modal_awal' && entry.type === 'in') {
      try {
        const { useShiftStore } = await import('@/stores/shiftStore');
        const currentShift = useShiftStore.getState().currentShift;
        if (currentShift) {
          await db.runAsync(
            "UPDATE cash_shifts SET starting_cash = 0, expected_cash = total_sales_cash WHERE id = ?",
            currentShift.id
          );
          await db.runAsync(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_drawer_amount', '0')"
          );
          useShiftStore.setState({
            todayDrawerAmount: 0,
            currentShift: {
              ...currentShift,
              starting_cash: 0,
              expected_cash: currentShift.total_sales_cash || 0,
            },
          });
        }
      } catch {}
    }

    if (entry && entry.category === 'setor_bank') {
      try {
        const pairedType = entry.type === 'in' ? 'out' : 'in';
        const pairedAccount = entry.account === 'bank' ? 'hand' : 'bank';
        const pairedRow = await db.getFirstAsync<{ id: number }>(
          "SELECT id FROM cash_ledger WHERE category = 'setor_bank' AND type = ? AND account = ? AND amount = ? AND date = ? LIMIT 1",
          pairedType,
          pairedAccount,
          entry.amount,
          entry.date
        );
        if (pairedRow) {
          await db.runAsync('DELETE FROM cash_ledger WHERE id = ?', pairedRow.id);
        }
      } catch (err) {
        console.warn('Gagal menghapus pasangan setor_bank:', err);
      }
    }

    await get().loadLedger(db);
  },

  getCashBalance: async (db) => {
    await get().loadLedger(db);
    return get().cashHandBalance;
  },
}));
