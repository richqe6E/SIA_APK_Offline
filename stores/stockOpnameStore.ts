import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';
import { useProductStore } from '@/stores/productStore';

export interface StockAdjustmentRecord {
  id: number;
  product_id: number;
  product_name: string;
  system_stock: number;
  physical_stock: number;
  difference: number;
  unit_cost: number;
  total_loss: number;
  notes: string;
  adjusted_at: string;
}

interface StockOpnameState {
  history: StockAdjustmentRecord[];
  loading: boolean;
  loadHistory: (db: SQLiteDatabase) => Promise<void>;
  performOpname: (
    db: SQLiteDatabase,
    productId: number,
    physicalStock: number,
    notes?: string
  ) => Promise<{ success: boolean; message?: string }>;
}

export const useStockOpnameStore = create<StockOpnameState>((set, get) => ({
  history: [],
  loading: false,

  loadHistory: async (db) => {
    set({ loading: true });
    try {
      const rows = await db.getAllAsync<StockAdjustmentRecord>(
        'SELECT * FROM stock_adjustments ORDER BY id DESC LIMIT 50'
      );
      set({ history: rows, loading: false });
    } catch (e) {
      console.error('loadOpnameHistory error:', e);
      set({ loading: false });
    }
  },

  performOpname: async (db, productId, physicalStock, notes) => {
    if (physicalStock < 0 || isNaN(physicalStock)) {
      return { success: false, message: 'Jumlah stok fisik riil tidak boleh bernilai negatif (kurang dari 0)!' };
    }

    try {
      const product = await db.getFirstAsync<{ name: string; stock: number; cost_price: number }>(
        'SELECT name, stock, cost_price FROM products WHERE id = ?',
        productId
      );

      if (!product) {
        return { success: false, message: 'Produk tidak ditemukan!' };
      }

      const systemStock = product.stock ?? 0;
      const difference = physicalStock - systemStock;
      const unitCost = product.cost_price ?? 0;
      const totalLoss = difference < 0 ? Math.abs(difference) * unitCost : 0;

      await db.withExclusiveTransactionAsync(async (txn) => {
        // Catat ke riwayat stock opname
        await txn.runAsync(
          'INSERT INTO stock_adjustments (product_id, product_name, system_stock, physical_stock, difference, unit_cost, total_loss, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          productId,
          product.name,
          systemStock,
          physicalStock,
          difference,
          unitCost,
          totalLoss,
          notes?.trim() || ''
        );

        // Update stok fisik produk beserta timestamp
        await txn.runAsync(
          'UPDATE products SET stock = ?, has_stock = 1, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?',
          physicalStock,
          productId
        );
      });

      await get().loadHistory(db);
      await useProductStore.getState().loadProducts(db);

      return { success: true };
    } catch (e: any) {
      console.error('performOpname error:', e);
      return { success: false, message: e.message || 'Gagal menyimpan penyesuaian stok' };
    }
  },
}));
