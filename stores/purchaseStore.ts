import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';
import { useCashStore } from '@/stores/cashStore';
import { useProductStore } from '@/stores/productStore';

export interface PurchaseItemPayload {
  productId: number;
  productName: string;
  costPrice: number;
  quantity: number;
  subtotal: number;
}

export interface PurchaseRecord {
  id: number;
  invoice_no: string;
  supplier_name: string;
  total_amount: number;
  created_at: string;
}

interface PurchaseState {
  purchases: PurchaseRecord[];
  loading: boolean;
  loadPurchases: (db: SQLiteDatabase) => Promise<void>;
  createPurchase: (
    db: SQLiteDatabase,
    supplierName: string,
    items: PurchaseItemPayload[]
  ) => Promise<{ success: boolean; message?: string }>;
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  purchases: [],
  loading: false,

  loadPurchases: async (db) => {
    set({ loading: true });
    try {
      const rows = await db.getAllAsync<PurchaseRecord>(
        'SELECT * FROM purchases ORDER BY id DESC'
      );
      set({ purchases: rows, loading: false });
    } catch (e) {
      console.error('loadPurchases error:', e);
      set({ loading: false });
    }
  },

  createPurchase: async (db, supplierName, items) => {
    if (items.length === 0) {
      return { success: false, message: 'Tidak ada item pembelian yang dipilih!' };
    }

    const totalAmount = items.reduce((acc, item) => acc + item.subtotal, 0);

    // 1. FINANCIAL GUARDRAIL: Validasi Saldo Kas Riil
    const cashBalance = await useCashStore.getState().getCashBalance(db);
    if (cashBalance < totalAmount) {
      const defisit = totalAmount - cashBalance;
      const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
      return {
        success: false,
        message: `Saldo kas toko tidak mencukupi!\n\nSaldo Kas Tersedia: ${fmt(cashBalance)}\nTotal Pembelian: ${fmt(totalAmount)}\nKekurangan: ${fmt(defisit)}\n\nSilakan lakukan penambahan modal di Penerimaan Kas terlebih dahulu.`,
      };
    }

    try {
      const invoiceNo = 'KUL-' + Date.now().toString().slice(-6);
      const today = new Date().toISOString().split('T')[0];

      await db.withExclusiveTransactionAsync(async (txn) => {
        // Simpan nota pembelian
        const result = await txn.runAsync(
          'INSERT INTO purchases (invoice_no, supplier_name, total_amount) VALUES (?, ?, ?)',
          invoiceNo,
          supplierName.trim() || 'Supplier Umum',
          totalAmount
        );
        const purchaseId = result.lastInsertRowId;

        // Simpan item pembelian & update stok produk
        for (const item of items) {
          await txn.runAsync(
            'INSERT INTO purchase_items (purchase_id, product_id, product_name, cost_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
            purchaseId,
            item.productId,
            item.productName,
            item.costPrice,
            item.quantity,
            item.subtotal
          );

          // Update stok & harga beli di tabel produk
          await txn.runAsync(
            'UPDATE products SET stock = stock + ?, cost_price = ?, has_stock = 1 WHERE id = ?',
            item.quantity,
            item.costPrice,
            item.productId
          );
        }

        // Catat pengeluaran kas otomatis di Buku Kas
        await txn.runAsync(
          'INSERT INTO cash_ledger (type, category, description, amount, date) VALUES (?, ?, ?, ?, ?)',
          'out',
          'kulakan_stok',
          `Kulakan Stok Nota #${invoiceNo} (${supplierName || 'Supplier Umum'})`,
          totalAmount,
          today
        );
      });

      // Reload state terkait
      await get().loadPurchases(db);
      await useCashStore.getState().loadLedger(db);
      await useProductStore.getState().loadProducts(db);

      return { success: true };
    } catch (e: any) {
      console.error('createPurchase error:', e);
      return { success: false, message: e.message || 'Gagal menyimpan transaksi pembelian' };
    }
  },
}));
