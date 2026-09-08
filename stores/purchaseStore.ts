import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';
import { useCashStore } from '@/stores/cashStore';
import { useProductStore } from '@/stores/productStore';
import { useDebtReceivableStore } from '@/stores/debtReceivableStore';

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
  payment_type?: string;
  payment_source?: 'toko' | 'bank';
  due_date?: string | null;
  supplier_id?: number | null;
  created_at: string;
}

interface PurchaseState {
  purchases: PurchaseRecord[];
  loading: boolean;
  loadPurchases: (db: SQLiteDatabase) => Promise<void>;
  createPurchase: (
    db: SQLiteDatabase,
    supplierName: string,
    items: PurchaseItemPayload[],
    paymentType?: 'tunai' | 'kredit',
    supplierId?: number | null,
    dueDate?: string | null,
    paymentSource?: 'toko' | 'bank'
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

  createPurchase: async (
    db,
    supplierName,
    items,
    paymentType = 'tunai',
    supplierId = null,
    dueDate = null,
    paymentSource = 'toko'
  ) => {
    if (items.length === 0) {
      return { success: false, message: 'Tidak ada item pembelian yang dipilih!' };
    }

    const totalAmount = items.reduce((acc, item) => acc + item.subtotal, 0);

    // 1. FINANCIAL GUARDRAIL: Jika pembayaran Tunai dengan Kas Toko, validasi saldo kas toko
    if (paymentType === 'tunai' && paymentSource === 'toko') {
      const cashBalance = await useCashStore.getState().getCashBalance(db);
      if (cashBalance < totalAmount) {
        const defisit = totalAmount - cashBalance;
        const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
        return {
          success: false,
          message: `Saldo kas laci toko tidak mencukupi untuk pembayaran tunai!\n\nSaldo Kas Laci: ${fmt(cashBalance)}\nTotal Pembelian: ${fmt(totalAmount)}\nKekurangan: ${fmt(defisit)}\n\nSilakan gunakan opsi Kas Bank, Kredit (Hutang Supplier), atau tambah modal kas terlebih dahulu.`,
        };
      }
    }

    try {
      const invoiceNo = 'KUL-' + Date.now().toString().slice(-6);
      const today = new Date().toISOString().split('T')[0];
      const cleanSupplierName = supplierName.trim() || 'Supplier Umum';

      await db.withExclusiveTransactionAsync(async (txn) => {
        // Tentukan supplier_id yang valid
        let targetSupplierId = supplierId;
        if (!targetSupplierId) {
          const existingSup = await txn.getFirstAsync<{ id: number }>(
            'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?) LIMIT 1',
            cleanSupplierName
          );
          if (existingSup) {
            targetSupplierId = existingSup.id;
          } else {
            const newSupRes = await txn.runAsync(
              'INSERT INTO suppliers (name, address, phone) VALUES (?, ?, ?)',
              cleanSupplierName,
              '',
              ''
            );
            targetSupplierId = newSupRes.lastInsertRowId;
          }
        }

        // Simpan nota pembelian
        const result = await txn.runAsync(
          'INSERT INTO purchases (invoice_no, supplier_name, total_amount, payment_type, supplier_id, due_date, payment_source) VALUES (?, ?, ?, ?, ?, ?, ?)',
          invoiceNo,
          cleanSupplierName,
          totalAmount,
          paymentType,
          targetSupplierId,
          dueDate,
          paymentSource
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

        if (paymentType === 'tunai') {
          // Hanya catat pengeluaran kas di Buku Kas jika menggunakan Kas Toko (Laci Kasir)
          if (paymentSource === 'toko') {
            await txn.runAsync(
              'INSERT INTO cash_ledger (type, category, description, amount, date) VALUES (?, ?, ?, ?, ?)',
              'out',
              'kulakan_stok',
              `Kulakan Stok Nota #${invoiceNo} (${cleanSupplierName})`,
              totalAmount,
              today
            );
          }
        } else {
          // Catat hutang supplier di tabel supplier_debts (tanpa memotong kas toko)
          await txn.runAsync(
            'INSERT INTO supplier_debts (supplier_id, purchase_id, total_amount, paid_amount, status, due_date, created_at) VALUES (?, ?, ?, 0, "unpaid", ?, datetime("now","localtime"))',
            targetSupplierId,
            purchaseId,
            totalAmount,
            dueDate
          );
        }
      });

      // Reload state terkait
      await get().loadPurchases(db);
      await useCashStore.getState().loadLedger(db);
      await useProductStore.getState().loadProducts(db);
      await useDebtReceivableStore.getState().loadDebts(db);
      await useDebtReceivableStore.getState().loadSuppliers(db);

      return { success: true };
    } catch (e: any) {
      console.error('createPurchase error:', e);
      return { success: false, message: e.message || 'Gagal menyimpan transaksi pembelian' };
    }
  },
}));
