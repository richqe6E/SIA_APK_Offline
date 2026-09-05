import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

export type ExpenseCategory =
  | 'gaji'
  | 'sewa'
  | 'listrik'
  | 'transportasi'
  | 'bahan_baku'
  | 'lain-lain';

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; icon: string }[] = [
  { key: 'gaji', label: 'Gaji & Upah', icon: '\u{1F464}' },
  { key: 'sewa', label: 'Sewa Tempat', icon: '\u{1F3E0}' },
  { key: 'listrik', label: 'Listrik & Air', icon: '\u26A1' },
  { key: 'transportasi', label: 'Transportasi', icon: '\u{1F697}' },
  { key: 'bahan_baku', label: 'Bahan Baku', icon: '\u{1F4E6}' },
  { key: 'lain-lain', label: 'Lain-lain', icon: '\u{1F4DD}' },
];

export interface Expense {
  id: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

interface ExpenseState {
  expenses: Expense[];
  loading: boolean;
  loadExpenses: (db: SQLiteDatabase, month?: number, year?: number) => Promise<void>;
  addExpense: (db: SQLiteDatabase, expense: {
    category: ExpenseCategory;
    description: string;
    amount: number;
    expense_date: string;
  }) => Promise<void>;
  updateExpense: (db: SQLiteDatabase, id: number, expense: {
    category?: ExpenseCategory;
    description?: string;
    amount?: number;
    expense_date?: string;
  }) => Promise<void>;
  deleteExpense: (db: SQLiteDatabase, id: number) => Promise<void>;
  getTotalExpenses: (db: SQLiteDatabase, month: number, year: number) => Promise<number>;
  getTotalExpensesYear: (db: SQLiteDatabase, year: number) => Promise<number>;
  getExpensesByCategory: (db: SQLiteDatabase, month?: number, year?: number) => Promise<{ category: string; total: number }[]>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  loading: false,

  loadExpenses: async (db, month, year) => {
    set({ loading: true });
    let query = 'SELECT * FROM expenses';
    const params: any[] = [];

    if (month !== undefined && year !== undefined) {
      query += " WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?";
      params.push(String(month).padStart(2, '0'), String(year));
    } else if (year !== undefined) {
      query += " WHERE strftime('%Y', expense_date) = ?";
      params.push(String(year));
    }

    query += ' ORDER BY expense_date DESC, id DESC';
    const expenses = await db.getAllAsync<Expense>(query, ...params);
    set({ expenses, loading: false });
  },

  addExpense: async (db, expense) => {
    await db.runAsync(
      'INSERT INTO expenses (category, description, amount, expense_date) VALUES (?, ?, ?, ?)',
      expense.category,
      expense.description,
      expense.amount,
      expense.expense_date
    );
    await get().loadExpenses(db);
  },

  updateExpense: async (db, id, expense) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (expense.category !== undefined) { fields.push('category = ?'); values.push(expense.category); }
    if (expense.description !== undefined) { fields.push('description = ?'); values.push(expense.description); }
    if (expense.amount !== undefined) { fields.push('amount = ?'); values.push(expense.amount); }
    if (expense.expense_date !== undefined) { fields.push('expense_date = ?'); values.push(expense.expense_date); }

    if (fields.length === 0) return;
    values.push(id);

    await db.runAsync(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`, values);
    await get().loadExpenses(db);
  },

  deleteExpense: async (db, id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
    await get().loadExpenses(db);
  },

  getTotalExpenses: async (db, month, year) => {
    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?`,
      String(month).padStart(2, '0'),
      String(year)
    );
    return result?.total ?? 0;
  },

  getTotalExpensesYear: async (db, year) => {
    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses
       WHERE strftime('%Y', expense_date) = ?`,
      String(year)
    );
    return result?.total ?? 0;
  },

  getExpensesByCategory: async (db, month, year) => {
    let query = `SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses`;
    const params: any[] = [];
    if (month !== undefined && year !== undefined) {
      query += ` WHERE strftime('%m', expense_date) = ? AND strftime('%Y', expense_date) = ?`;
      params.push(String(month).padStart(2, '0'), String(year));
    } else if (year !== undefined) {
      query += ` WHERE strftime('%Y', expense_date) = ?`;
      params.push(String(year));
    }
    query += ' GROUP BY category ORDER BY total DESC';
    return await db.getAllAsync<{ category: string; total: number }>(query, ...params);
  },
}));
