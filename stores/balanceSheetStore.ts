import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

// Section neraca: aset_tetap, kewajiban, modal
export type BalanceSheetSection = 'aset_tetap' | 'kewajiban' | 'modal';

export const BALANCE_SHEET_SECTIONS: {
  key: BalanceSheetSection;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    key: 'aset_tetap',
    label: 'Aset Tetap',
    icon: '\u{1F3E2}',
    description: 'Peralatan, kendaraan, bangunan, dll.',
  },
  {
    key: 'kewajiban',
    label: 'Kewajiban / Hutang',
    icon: '\u{1F4B8}',
    description: 'Hutang usaha, hutang bank, dll.',
  },
  {
    key: 'modal',
    label: 'Modal Pemilik',
    icon: '\u{1F4B0}',
    description: 'Modal awal, setoran modal, dll.',
  },
];

export interface BalanceSheetItem {
  id: number;
  section: BalanceSheetSection;
  name: string;
  amount: number;
  sort_order: number;
  updated_at: string;
}

interface BalanceSheetState {
  items: BalanceSheetItem[];
  loading: boolean;
  loadItems: (db: SQLiteDatabase) => Promise<void>;
  upsertItem: (db: SQLiteDatabase, item: {
    id?: number;
    section: BalanceSheetSection;
    name: string;
    amount: number;
  }) => Promise<void>;
  deleteItem: (db: SQLiteDatabase, id: number) => Promise<void>;
  getItemsBySection: (section: BalanceSheetSection) => BalanceSheetItem[];
  getSectionTotal: (section: BalanceSheetSection) => number;
}

export const useBalanceSheetStore = create<BalanceSheetState>((set, get) => ({
  items: [],
  loading: false,

  loadItems: async (db) => {
    set({ loading: true });
    const items = await db.getAllAsync<BalanceSheetItem>(
      'SELECT * FROM balance_sheet_items ORDER BY section ASC, sort_order ASC, id ASC'
    );
    set({ items, loading: false });
  },

  upsertItem: async (db, item) => {
    if (item.id) {
      await db.runAsync(
        `UPDATE balance_sheet_items
         SET name = ?, amount = ?, updated_at = datetime('now','localtime')
         WHERE id = ?`,
        item.name,
        item.amount,
        item.id
      );
    } else {
      // Tentukan sort_order berdasarkan jumlah item yang sudah ada di section
      const countResult = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM balance_sheet_items WHERE section = ?',
        item.section
      );
      const sortOrder = countResult?.count ?? 0;
      await db.runAsync(
        `INSERT INTO balance_sheet_items (section, name, amount, sort_order)
         VALUES (?, ?, ?, ?)`,
        item.section,
        item.name,
        item.amount,
        sortOrder
      );
    }
    await get().loadItems(db);
  },

  deleteItem: async (db, id) => {
    await db.runAsync('DELETE FROM balance_sheet_items WHERE id = ?', id);
    await get().loadItems(db);
  },

  getItemsBySection: (section) => {
    return get().items.filter((item) => item.section === section);
  },

  getSectionTotal: (section) => {
    return get()
      .items.filter((item) => item.section === section)
      .reduce((sum, item) => sum + item.amount, 0);
  },
}));
