import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';
import { useProductStore } from './productStore';

export interface CartItem {
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

export interface Transaction {
  id: number;
  total: number;
  payment_method: string;
  payment_amount: number;
  change: number;
  created_at: string;
}

export interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

export interface PendingOrder {
  id: number;
  note: string;
  total_amount: number;
  items_json: string;
  items?: CartItem[];
  created_at: string;
}

export type PeriodFilter = 'today' | 'week' | 'month' | 'all';

interface TransactionState {
  cart: CartItem[];
  transactions: Transaction[];
  pendingOrders: PendingOrder[];
  loading: boolean;
  hasMore: boolean;
  addToCart: (product: { id: number; name: string; price: number }) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  setCart: (cart: CartItem[]) => void;
  checkout: (
    db: SQLiteDatabase,
    paymentMethod: string,
    paymentAmount: number,
    customerId?: number | null
  ) => Promise<number>;
  loadTransactions: (db: SQLiteDatabase, period?: PeriodFilter, page?: number, pageSize?: number) => Promise<void>;
  loadPendingOrders: (db: SQLiteDatabase) => Promise<void>;
  holdCurrentCart: (db: SQLiteDatabase, note: string) => Promise<boolean>;
  resumePendingOrder: (db: SQLiteDatabase, orderId: number) => Promise<boolean>;
  deletePendingOrder: (db: SQLiteDatabase, orderId: number) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  cart: [],
  transactions: [],
  pendingOrders: [],
  loading: false,
  hasMore: true,

  addToCart: (product) => {
    const { cart } = get();
    const existing = cart.find((item) => item.product_id === product.id);

    if (existing) {
      set({
        cart: cart.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.product_price,
              }
            : item
        ),
      });
    } else {
      set({
        cart: [
          ...cart,
          {
            product_id: product.id,
            product_name: product.name,
            product_price: product.price,
            quantity: 1,
            subtotal: product.price,
          },
        ],
      });
    }
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set({
      cart: get().cart.map((item) =>
        item.product_id === productId
          ? { ...item, quantity, subtotal: quantity * item.product_price }
          : item
      ),
    });
  },

  removeFromCart: (productId) => {
    set({ cart: get().cart.filter((item) => item.product_id !== productId) });
  },

  clearCart: () => set({ cart: [] }),

  checkout: async (db, paymentMethod, paymentAmount, customerId = null) => {
    const { cart } = get();
    if (cart.length === 0) return 0;

    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const isCredit = paymentMethod === 'hutang' ? 1 : 0;
    const finalPaymentAmount = isCredit ? 0 : paymentAmount;
    const change = isCredit ? 0 : paymentAmount - total;

    let transactionId = 0;
    await db.withExclusiveTransactionAsync(async (txn) => {
      const result = await txn.runAsync(
        'INSERT INTO transactions (total, payment_method, payment_amount, change, customer_id, is_credit) VALUES (?, ?, ?, ?, ?, ?)',
        total,
        paymentMethod,
        finalPaymentAmount,
        change >= 0 ? change : 0,
        customerId,
        isCredit
      );
      transactionId = result.lastInsertRowId as number;

      for (const item of cart) {
        // Ambil cost_price dari tabel products
        const prod = await txn.getFirstAsync<{ cost_price: number; has_stock: number }>(
          'SELECT cost_price, has_stock FROM products WHERE id = ?',
          item.product_id
        );
        const costPrice = prod?.cost_price ?? 0;

        await txn.runAsync(
          'INSERT INTO transaction_items (transaction_id, product_id, product_name, product_price, quantity, subtotal, cost_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
          transactionId,
          item.product_id,
          item.product_name,
          item.product_price,
          item.quantity,
          item.subtotal,
          costPrice
        );

        // Kurangi stok hanya untuk produk ber-stok
        // Menggunakan MAX(0,...) agar tidak negatif dan tidak memblokir transaksi
        if (prod?.has_stock === 1) {
          await txn.runAsync(
            `UPDATE products SET stock = MAX(0, stock - ?), updated_at = datetime('now','localtime') WHERE id = ?`,
            item.quantity,
            item.product_id
          );
        }
      }

      // Catat piutang pelanggan jika transaksi hutang
      if (isCredit && customerId) {
        await txn.runAsync(
          'INSERT INTO customer_receivables (customer_id, transaction_id, total_amount, paid_amount, status, due_date, created_at) VALUES (?, ?, ?, 0, "unpaid", NULL, datetime("now","localtime"))',
          customerId,
          transactionId,
          total
        );
      }
    });

    set({ cart: [] });
    await get().loadTransactions(db);
    useProductStore.getState().loadProducts(db);
    if (isCredit) {
      const { useDebtReceivableStore } = await import('@/stores/debtReceivableStore');
      await useDebtReceivableStore.getState().loadReceivables(db);
      await useDebtReceivableStore.getState().loadCustomers(db);
    }

    const countResult = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM transactions WHERE date(created_at) = date('now','localtime')"
    );
    return countResult?.count ?? 0;
  },


  loadTransactions: async (db, period = 'all', page = 1, pageSize = 50) => {
    set({ loading: true });

    let whereClause = '';
    switch (period) {
      case 'today':
        whereClause = "WHERE date(created_at) = date('now','localtime')";
        break;
      case 'week':
        whereClause = "WHERE created_at >= datetime('now','localtime','-7 days')";
        break;
      case 'month':
        whereClause = "WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')";
        break;
    }

    const offset = (page - 1) * pageSize;
    const transactions = await db.getAllAsync<Transaction>(
      `SELECT * FROM transactions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      pageSize,
      offset
    );

    const countResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions ${whereClause}`
    );
    const totalCount = countResult?.count ?? 0;
    const hasMore = offset + pageSize < totalCount;

    set((state) => ({
      transactions: page === 1 ? transactions : [...state.transactions, ...transactions],
      loading: false,
      hasMore,
    }));
  },

  setCart: (cart) => set({ cart }),

  loadPendingOrders: async (db) => {
    try {
      const rows = await db.getAllAsync<PendingOrder>(
        'SELECT * FROM pending_orders ORDER BY id DESC'
      );
      const parsed = rows.map((r) => {
        let items: CartItem[] = [];
        try {
          items = JSON.parse(r.items_json || '[]');
        } catch {
          items = [];
        }
        return {
          ...r,
          items,
        };
      });
      set({ pendingOrders: parsed });
    } catch (e) {
      console.error('loadPendingOrders error:', e);
    }
  },

  holdCurrentCart: async (db, note) => {
    const { cart } = get();
    if (cart.length === 0) return false;
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const cleanNote = note.trim() || `Pesanan #${Date.now().toString().slice(-4)}`;
    const itemsJson = JSON.stringify(cart);

    await db.runAsync(
      'INSERT INTO pending_orders (note, total_amount, items_json) VALUES (?, ?, ?)',
      cleanNote,
      total,
      itemsJson
    );
    set({ cart: [] });
    await get().loadPendingOrders(db);
    return true;
  },

  resumePendingOrder: async (db, orderId) => {
    const row = await db.getFirstAsync<PendingOrder>(
      'SELECT * FROM pending_orders WHERE id = ?',
      orderId
    );
    if (!row) return false;

    let items: CartItem[] = [];
    try {
      items = JSON.parse(row.items_json || '[]');
    } catch {
      items = [];
    }

    set({ cart: items });
    await db.runAsync('DELETE FROM pending_orders WHERE id = ?', orderId);
    await get().loadPendingOrders(db);
    return true;
  },

  deletePendingOrder: async (db, orderId) => {
    await db.runAsync('DELETE FROM pending_orders WHERE id = ?', orderId);
    await get().loadPendingOrders(db);
  },
}));
