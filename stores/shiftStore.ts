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

interface ShiftState {
  currentShift: CashShift | null;
  historyShifts: CashShift[];
  isLoading: boolean;
  loadActiveShift: (db: SQLiteDatabase) => Promise<CashShift | null>;
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
    const result = await db.runAsync(
      `INSERT INTO cash_shifts (
        cashier_name, starting_cash, expected_cash, status
      ) VALUES (?, ?, ?, 'open')`,
      cashierName.trim() || 'Kasir',
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
        COALESCE(SUM(CASE WHEN payment_method = 'tunai' THEN total ELSE 0 END), 0) as sales_cash,
        COALESCE(SUM(CASE WHEN payment_method = 'qris' THEN total ELSE 0 END), 0) as sales_non_cash
       FROM transactions
       WHERE created_at >= ?`,
      shift.opened_at
    );

    const salesCash = row?.sales_cash ?? 0;
    const salesNonCash = row?.sales_non_cash ?? 0;
    const transactionCount = row?.tx_count ?? 0;
    const expectedCash = shift.starting_cash + salesCash;

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
