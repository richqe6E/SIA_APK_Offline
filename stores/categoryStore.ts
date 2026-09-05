import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

export interface Category {
  id: number;
  name: string;
  created_at: string;
}

interface CategoryState {
  categories: Category[];
  loading: boolean;
  loadCategories: (db: SQLiteDatabase) => Promise<void>;
  addCategory: (db: SQLiteDatabase, name: string) => Promise<void>;
  deleteCategory: (db: SQLiteDatabase, id: number) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loading: false,

  loadCategories: async (db: SQLiteDatabase) => {
    set({ loading: true });
    const categories = await db.getAllAsync<Category>(
      'SELECT * FROM categories ORDER BY name ASC'
    );
    set({ categories, loading: false });
  },

  addCategory: async (db, name) => {
    await db.runAsync('INSERT INTO categories (name) VALUES (?)', name);
    await get().loadCategories(db);
  },

  deleteCategory: async (db, id) => {
    await db.runAsync(
      'UPDATE products SET category_id = NULL WHERE category_id = ?',
      id
    );
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
    await get().loadCategories(db);
  },
}));