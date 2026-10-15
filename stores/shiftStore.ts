import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

export interface CashShift {
  id: number;
  cashier_name: string;
  opened_at: string;
  closed_at?: string | null;
  starting_cash: number;
  expected_cash: number;
  actual_cash?: number | null;
  difference?: number | null;
  total_sales_cash: number;
  total_sales_non_cash: number;
  total_transactions: number;
  notes?: string;
  status: 'open' | 'closed';
}

export interface ShiftSummary {
  startingCash: number;
  salesCash: number;
  salesNonCash: number;
  transactionCount: number;
  expectedCash: number;
  cumulativeHandBalance?: number;
}

function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface ShiftState {
  currentShift: CashShift | null;
  historyShifts: CashShift[];
  isLoading: boolean;
  todayDrawerDate: string | null;
  todayDrawerAmount: number;
  isDrawerSetToday: boolean;
  cashierList: string[];
  resetShiftStore: () => void;
  loadActiveShift: (db: SQLiteDatabase) => Promise<CashShift | null>;
  loadShiftData: (db: SQLiteDatabase) => Promise<void>;
  saveDailyDrawerAmount: (db: SQLiteDatabase, amount: number) => Promise<void>;
  switchCashier: (db: SQLiteDatabase, cashierName: string) => Promise<void>;
  addCashierEmployee: (db: SQLiteDatabase, name: string) => Promise<void>;
  removeCashierEmployee: (db: SQLiteDatabase, name: string) => Promise<void>;
  openShift: (db: SQLiteDatabase, cashierName: string, startingCash: number) => Promise<CashShift>;
  getShiftSummary: (db: SQLiteDatabase, shift: CashShift) => Promise<ShiftSummary>;
  closeShift: (
    db: SQLiteDatabase,
    shiftId: number,
    actualCash: number,
    notes?: string
  ) => Promise<CashShift>;
  loadHistoryShifts: (db: SQLiteDatabase) => Promise<void>;
}

let openShiftMutex = false;
let closeShiftMutex = false;

export const useShiftStore = create<ShiftState>((set, get) => ({
  currentShift: null,
  historyShifts: [],
  isLoading: false,
  todayDrawerDate: null,
  todayDrawerAmount: 100000,
  isDrawerSetToday: false,
  cashierList: [],

  resetShiftStore: () => {
    set({
      currentShift: null,
      todayDrawerDate: '',
      todayDrawerAmount: 0,
      isDrawerSetToday: false,
      historyShifts: [],
    });
  },

  loadShiftData: async (db) => {
    try {
      set({ isLoading: true });
      const today = getTodayDateStr();

      const rows = await db.getAllAsync<{ key: string; value: string }>(
        "SELECT key, value FROM settings WHERE key IN ('daily_drawer_date', 'daily_drawer_amount', 'cashier_employees')"
      );
      const map = new Map(rows.map((r) => [r.key, r.value]));

      const savedDate = map.get('daily_drawer_date') || '';
      const savedAmount = Number(map.get('daily_drawer_amount')) || 0;
      const isSet = savedDate === today && savedAmount > 0;

      let cashiers: string[] = [];
      const rawCashiers = map.get('cashier_employees');
      if (rawCashiers) {
        try {
          const parsed = JSON.parse(rawCashiers);
          if (Array.isArray(parsed)) {
            cashiers = parsed;
          }
        } catch {}
      }

      const activeShift = await get().loadActiveShift(db);

      set({
        todayDrawerDate: savedDate,
        todayDrawerAmount: savedAmount > 0 ? savedAmount : 100000,
        isDrawerSetToday: isSet,
        cashierList: cashiers,
        currentShift: activeShift,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  saveDailyDrawerAmount: async (db, amount) => {
    const today = getTodayDateStr();
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_drawer_date', ?)",
      today
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_drawer_amount', ?)",
      String(amount)
    );

    const current = get().currentShift;
    if (current) {
      const salesRow = await db.getFirstAsync<{ sales_cash: number }>(
        `SELECT COALESCE(SUM(CASE 
          WHEN payment_method = 'split' OR (cash_received > 0 AND qris_received > 0) THEN cash_received 
          WHEN payment_method = 'tunai' THEN total 
          ELSE 0 
        END), 0) as sales_cash
        FROM transactions WHERE shift_id = ?`,
        current.id
      );
      const activeSalesCash = salesRow?.sales_cash || 0;

      await db.runAsync(
        "UPDATE cash_shifts SET starting_cash = ?, expected_cash = ? + ? WHERE id = ?",
        amount,
        amount,
        activeSalesCash,
        current.id
      );

      // Sinkronkan ke cash_ledger kategori modal_awal agar uang fisik laci di buku kas ikut terupdate
      const existingLedger = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM cash_ledger WHERE type = 'in' AND category = 'modal_awal' AND description LIKE ? LIMIT 1`,
        `%Shift #${current.id}%`
      );

      if (existingLedger) {
        await db.runAsync(
          "UPDATE cash_ledger SET amount = ? WHERE id = ?",
          amount,
          existingLedger.id
        );
      } else if (amount > 0) {
        await db.runAsync(
          `INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)`,
          'in',
          'modal_awal',
          `Modal Awal Kasir Shift #${current.id} (${current.cashier_name})`,
          amount,
          today,
          'hand'
        );
      }

      try {
        const { useCashStore } = await import('@/stores/cashStore');
        await useCashStore.getState().loadLedger(db);
      } catch {}

      set({
        currentShift: {
          ...current,
          starting_cash: amount,
          expected_cash: amount + activeSalesCash,
        },
      });
    }

    set({
      todayDrawerDate: today,
      todayDrawerAmount: amount,
      isDrawerSetToday: true,
    });
  },

  switchCashier: async (db, cashierName) => {
    const trimmed = cashierName.trim() || 'Kasir';
    const list = get().cashierList;
    if (!list.includes(trimmed)) {
      const updated = [...list, trimmed];
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('cashier_employees', ?)",
        JSON.stringify(updated)
      );
      set({ cashierList: updated });
    }

    const active = get().currentShift;
    if (active) {
      await db.runAsync(
        "UPDATE cash_shifts SET cashier_name = ? WHERE id = ?",
        trimmed,
        active.id
      );
      set({
        currentShift: { ...active, cashier_name: trimmed },
      });
    } else {
      await get().openShift(db, trimmed, get().todayDrawerAmount);
    }
  },

  addCashierEmployee: async (db, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const list = get().cashierList;
    if (list.includes(trimmed)) return;
    const updated = [...list, trimmed];
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('cashier_employees', ?)",
      JSON.stringify(updated)
    );
    set({ cashierList: updated });
  },

  removeCashierEmployee: async (db, name) => {
    const list = get().cashierList.filter((item) => item !== name);
    const updated = list;
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('cashier_employees', ?)",
      JSON.stringify(updated)
    );
    set({ cashierList: updated });
  },

  loadActiveShift: async (db) => {
    try {
      const row = await db.getFirstAsync<CashShift>(
        `SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1`
      );
      if (row) {
        await db.runAsync(
          `UPDATE transactions SET shift_id = ? WHERE shift_id IS NULL AND (date(created_at) = date(?) OR created_at >= ?)`,
          row.id,
          row.opened_at,
          row.opened_at
        );
      }
      set({ currentShift: row || null });
      return row || null;
    } catch {
      set({ currentShift: null });
      return null;
    }
  },

  openShift: async (db, cashierName, startingCash) => {
    if (openShiftMutex) {
      const active = get().currentShift;
      if (active) return active;
    }
    openShiftMutex = true;
    try {
      const existingOpen = await db.getFirstAsync<CashShift>(
        `SELECT * FROM cash_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1`
      );
      if (existingOpen) {
        set({ currentShift: existingOpen });
        return existingOpen;
      }

      const cleanName = cashierName.trim() || 'Kasir';
      const result = await db.runAsync(
        `INSERT INTO cash_shifts (
          cashier_name, starting_cash, expected_cash, status
        ) VALUES (?, ?, ?, 'open')`,
        cleanName,
        startingCash,
        startingCash
      );

      const newShift = await db.getFirstAsync<CashShift>(
        `SELECT * FROM cash_shifts WHERE id = ?`,
        result.lastInsertRowId
      );

      if (!newShift) {
        throw new Error('Gagal membuka shift kasir');
      }

      // Integrasikan modal awal ke cash_ledger agar masuk ke saldo laci fisik kasir
      const today = getTodayDateStr();
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_drawer_date', ?)",
        today
      );
      await db.runAsync(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('daily_drawer_amount', ?)",
        String(startingCash)
      );

      if (startingCash > 0) {
        await db.runAsync(
          `INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)`,
          'in',
          'modal_awal',
          `Modal Awal Kasir Shift #${newShift.id} (${cleanName})`,
          startingCash,
          today,
          'hand'
        );
        try {
          const { useCashStore } = await import('@/stores/cashStore');
          await useCashStore.getState().loadLedger(db);
        } catch {}
      }

      set({
        currentShift: newShift,
        todayDrawerDate: today,
        todayDrawerAmount: startingCash,
        isDrawerSetToday: true,
      });
      return newShift;
    } finally {
      openShiftMutex = false;
    }
  },

  getShiftSummary: async (db, shift) => {
    // Pastikan transaksi yang tercatat selama shift aktif tanpa shift_id teratribusi ke shift ini
    await db.runAsync(
      `UPDATE transactions SET shift_id = ? WHERE shift_id IS NULL AND (date(created_at) = date(?) OR created_at >= ?)`,
      shift.id,
      shift.opened_at,
      shift.opened_at
    );

    const row = await db.getFirstAsync<{
      tx_count: number;
      sales_cash: number;
      sales_non_cash: number;
    }>(
      `SELECT
        COUNT(*) as tx_count,
        COALESCE(SUM(CASE 
          WHEN payment_method = 'split' OR (cash_received > 0 AND qris_received > 0) THEN cash_received 
          WHEN payment_method = 'tunai' THEN total 
          ELSE 0 
        END), 0) as sales_cash,
        COALESCE(SUM(CASE 
          WHEN payment_method = 'split' OR (cash_received > 0 AND qris_received > 0) THEN qris_received 
          WHEN payment_method = 'qris' THEN total 
          ELSE 0 
        END), 0) as sales_non_cash
       FROM transactions
       WHERE shift_id = ?`,
      shift.id
    );

    // Hitung pemasukan kas fisik non-penjualan (misal: cicilan piutang pelanggan atau penerimaan kas lain)
    const inRow = await db.getFirstAsync<{ total_in: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total_in
       FROM cash_ledger
       WHERE type = 'in' AND category != 'modal_awal' AND (account = 'hand' OR account IS NULL) AND created_at >= ?`,
      shift.opened_at
    );

    // Hitung pengeluaran kas fisik selama shift berjalan
    const expRow = await db.getFirstAsync<{ total_out: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total_out
       FROM cash_ledger
       WHERE type = 'out' AND (account = 'hand' OR account IS NULL) AND created_at >= ?`,
      shift.opened_at
    );

    const salesCash = row?.sales_cash ?? 0;
    const salesNonCash = row?.sales_non_cash ?? 0;
    const transactionCount = row?.tx_count ?? 0;
    const otherCashIn = inRow?.total_in ?? 0;
    const cashOut = expRow?.total_out ?? 0;
    const expectedCash = Math.max(0, shift.starting_cash + salesCash + otherCashIn - cashOut);

    // Hitung total kas fisik laci toko kumulatif (all-time) untuk transparansi rekonsiliasi kasir
    const totSalesRow = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE payment_method = 'tunai' AND (cash_received = 0 OR qris_received = 0)`
    );
    const totSplitRow = await db.getFirstAsync<{ split_cash: number }>(
      `SELECT COALESCE(SUM(cash_received), 0) as split_cash FROM transactions WHERE (cash_received > 0 AND qris_received > 0)`
    );
    const totInRow = await db.getFirstAsync<{ total_in: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total_in FROM cash_ledger WHERE type = 'in' AND (account = 'hand' OR account IS NULL)`
    );
    const totOutRow = await db.getFirstAsync<{ total_out: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total_out FROM cash_ledger WHERE type = 'out' AND (account = 'hand' OR account IS NULL)`
    );
    const cumulativeHandBalance = ((totSalesRow?.total ?? 0) + (totSplitRow?.split_cash ?? 0) + (totInRow?.total_in ?? 0)) - (totOutRow?.total_out ?? 0);

    return {
      startingCash: shift.starting_cash,
      salesCash,
      salesNonCash,
      transactionCount,
      expectedCash,
      cumulativeHandBalance,
    };
  },

  closeShift: async (db, shiftId, actualCash, notes = '') => {
    if (closeShiftMutex) {
      throw new Error('Proses tutup shift sedang berjalan.');
    }
    closeShiftMutex = true;
    try {
      const shift = await db.getFirstAsync<CashShift>(
        `SELECT * FROM cash_shifts WHERE id = ?`,
        shiftId
      );

      if (!shift) {
        throw new Error('Data shift tidak ditemukan');
      }

      if (shift.status !== 'open') {
        throw new Error('Shift ini sudah ditutup sebelumnya.');
      }

    const summary = await get().getShiftSummary(db, shift);
    const difference = actualCash - summary.expectedCash;
    const cumulative = summary.cumulativeHandBalance ?? summary.expectedCash;
    // Jika kasir menginput nominal yang cocok dengan saldo kas laci toko kumulatif,
    // maka kelebihan tersebut adalah sisa kas toko sebelumnya (sudah ada di buku kas),
    // bukan kas lebih riil baru, sehingga dicegah dari pencatatan dobel di cash_ledger.
    const isMatchingCumulative = Math.abs(actualCash - cumulative) < 1;
    const ledgerDiff = isMatchingCumulative ? 0 : difference;

    await db.runAsync(
      `UPDATE cash_shifts SET
        closed_at = datetime('now','localtime'),
        expected_cash = ?,
        actual_cash = ?,
        difference = ?,
        total_sales_cash = ?,
        total_sales_non_cash = ?,
        total_transactions = ?,
        notes = ?,
        status = 'closed'
       WHERE id = ?`,
      summary.expectedCash,
      actualCash,
      difference,
      summary.salesCash,
      summary.salesNonCash,
      summary.transactionCount,
      notes.trim(),
      shiftId
    );

    const closedShift = await db.getFirstAsync<CashShift>(
      `SELECT * FROM cash_shifts WHERE id = ?`,
      shiftId
    );

    if (!closedShift) {
      throw new Error('Gagal memproses penutupan shift');
    }

    const today = getTodayDateStr();

    // 1. Integrasi Selisih Fisik Kasir Tutup Shift ke cash_ledger agar saldo kas laci sinkron dengan uang fisik riil
    if (ledgerDiff !== 0) {
      const isShortage = ledgerDiff < 0;
      const absDiff = Math.abs(ledgerDiff);
      const diffType = isShortage ? 'out' : 'in';
      const descLabel = isShortage
        ? `Tutup Shift Kasir #${shift.id} (${shift.cashier_name}) - Penyesuaian Kas Tekor/Kurang`
        : `Tutup Shift Kasir #${shift.id} (${shift.cashier_name}) - Penyesuaian Kas Lebih`;

      await db.runAsync(
        `INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)`,
        diffType,
        'selisih_kas',
        descLabel,
        absDiff,
        today,
        'hand'
      );
    }

    // 2. Pelepasan modal awal shift saat ditutup agar saldo kas laci kumulatif tidak menggembung
    if (shift.starting_cash > 0) {
      await db.runAsync(
        `INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)`,
        'out',
        'modal_awal',
        `Tutup Shift Kasir #${shift.id} (${shift.cashier_name}) - Pelepasan Modal Awal`,
        shift.starting_cash,
        today,
        'hand'
      );
    }

    try {
      const { useCashStore } = await import('@/stores/cashStore');
      await useCashStore.getState().loadLedger(db);
    } catch {}

      set({ currentShift: null });
      await get().loadHistoryShifts(db);
      return closedShift;
    } finally {
      closeShiftMutex = false;
    }
  },

  loadHistoryShifts: async (db) => {
    try {
      const rows = await db.getAllAsync<CashShift>(
        `SELECT * FROM cash_shifts WHERE status = 'closed' ORDER BY id DESC LIMIT 20`
      );
      set({ historyShifts: rows });
    } catch {
      set({ historyShifts: [] });
    }
  },
}));
