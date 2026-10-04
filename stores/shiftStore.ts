import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';
import { triggerAutoSync } from '@/services/cloudSync';

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

export const useShiftStore = create<ShiftState>((set, get) => ({
  currentShift: null,
  historyShifts: [],
  isLoading: false,
  todayDrawerDate: null,
  todayDrawerAmount: 100000,
  isDrawerSetToday: false,
  cashierList: [],

  loadShiftData: async (db) => {
    try {
      set({ isLoading: true });
      const today = getTodayDateStr();

      const rows = await db.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM settings WHERE key IN ('daily_drawer_date', 'daily_drawer_amount', 'cashier_employees')`
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
      await db.runAsync(
        "UPDATE cash_shifts SET starting_cash = ?, expected_cash = starting_cash + total_sales_cash WHERE id = ?",
        amount,
        current.id
      );
      set({
        currentShift: { ...current, starting_cash: amount },
      });
    }

    set({
      todayDrawerDate: today,
      todayDrawerAmount: amount,
      isDrawerSetToday: true,
    });
    triggerAutoSync(db);
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
    triggerAutoSync(db);
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
      set({ currentShift: row || null });
      return row || null;
    } catch {
      set({ currentShift: null });
      return null;
    }
  },

  openShift: async (db, cashierName, startingCash) => {
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
    if (startingCash > 0) {
      const today = getTodayDateStr();
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

    set({ currentShift: newShift });
    triggerAutoSync(db);
    return newShift;
  },

  getShiftSummary: async (db, shift) => {
    const row = await db.getFirstAsync<{
      tx_count: number;
      sales_cash: number;
      sales_non_cash: number;
    }>(
      `SELECT
        COUNT(*) as tx_count,
        COALESCE(SUM(CASE WHEN cash_received > 0 THEN cash_received WHEN payment_method = 'tunai' THEN total ELSE 0 END), 0) as sales_cash,
        COALESCE(SUM(CASE WHEN qris_received > 0 THEN qris_received WHEN payment_method = 'qris' THEN total ELSE 0 END), 0) as sales_non_cash
       FROM transactions
       WHERE shift_id = ? OR (shift_id IS NULL AND created_at >= ?)`,
      shift.id,
      shift.opened_at
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

    return {
      startingCash: shift.starting_cash,
      salesCash,
      salesNonCash,
      transactionCount,
      expectedCash,
    };
  },

  closeShift: async (db, shiftId, actualCash, notes = '') => {
    const shift = await db.getFirstAsync<CashShift>(
      `SELECT * FROM cash_shifts WHERE id = ?`,
      shiftId
    );

    if (!shift) {
      throw new Error('Data shift tidak ditemukan');
    }

    const summary = await get().getShiftSummary(db, shift);
    const difference = actualCash - summary.expectedCash;

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

    // Pelepasan modal awal shift saat ditutup agar saldo kas laci kumulatif tidak menggembung
    if (shift.starting_cash > 0) {
      const today = getTodayDateStr();
      await db.runAsync(
        `INSERT INTO cash_ledger (type, category, description, amount, date, account) VALUES (?, ?, ?, ?, ?, ?)`,
        'out',
        'modal_awal',
        `Tutup Shift Kasir #${shift.id} (${shift.cashier_name}) - Pelepasan Modal Awal`,
        shift.starting_cash,
        today,
        'hand'
      );
      try {
        const { useCashStore } = await import('@/stores/cashStore');
        await useCashStore.getState().loadLedger(db);
      } catch {}
    }

    set({ currentShift: null });
    await get().loadHistoryShifts(db);
    triggerAutoSync(db);
    return closedShift;
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
