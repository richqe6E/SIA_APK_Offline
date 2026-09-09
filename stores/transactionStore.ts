import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';
import { useProductStore } from './productStore';

export interface CartItem {
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  is_weighted?: number;
  weight_gram?: number;
  price_per_kg?: number;
}

export interface Transaction {
  id: number;
  total: number;
  payment_method: string;
  customer_id?: number | null;
  customer_name?: string | null;
  is_credit?: number;
  discount_amount?: number;
  subtotal_amount?: number;
  payment_amount: number;
  change: number;
  cashier_name?: string;
  shift_id?: number | null;
  created_at: string;
}

export interface TransactionDiscount {
  type: 'nominal' | 'percent';
  value: number;
}

export interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  cost_price?: number;
  weight_gram?: number | null;
  price_per_kg?: number | null;
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
  discount: TransactionDiscount | null;
  transactions: Transaction[];
  pendingOrders: PendingOrder[];
  loading: boolean;
  hasMore: boolean;

  setDiscount: (value: number, type: 'nominal' | 'percent') => void;
  clearDiscount: () => void;
  getDiscountAmount: () => number;
  addToCart: (product: any, options?: { weight_gram?: number; price_per_kg?: number } | number) => void;
  addWeightedToCart: (product: any, weightGram: number, pricePerKg: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  updateCartItemPrice: (productId: number, newPrice: number) => void;
  updateCartItemWeight: (productId: number, newWeightGram: number, newPricePerKg?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  setCart: (cart: CartItem[]) => void;
  checkout: (
    db: SQLiteDatabase,
    paymentMethod: string,
    paymentAmount: number,
    customerId?: number | null,
    cashierName?: string,
    shiftId?: number | null
  ) => Promise<number>;
  loadTransactions: (db: SQLiteDatabase, period?: PeriodFilter, page?: number, pageSize?: number) => Promise<void>;
  loadPendingOrders: (db: SQLiteDatabase) => Promise<void>;
  holdCurrentCart: (db: SQLiteDatabase, note: string) => Promise<boolean>;
  resumePendingOrder: (db: SQLiteDatabase, orderId: number) => Promise<boolean>;
  deletePendingOrder: (db: SQLiteDatabase, orderId: number) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  cart: [],
  discount: null,
  transactions: [],
  pendingOrders: [],
  loading: false,
  hasMore: true,

  setDiscount: (value, type) => {
    set({ discount: { value, type } });
  },

  clearDiscount: () => {
    set({ discount: null });
  },

  getDiscountAmount: () => {
    const { cart, discount } = get();
    if (!discount || discount.value <= 0) return 0;
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    if (discount.type === 'percent') {
      const pct = Math.min(100, Math.max(0, discount.value));
      return Math.round((subtotal * pct) / 100);
    }
    return Math.min(subtotal, Math.max(0, discount.value));
  },

  addToCart: (product, options) => {
    const { cart } = get();
    const isWeighted = (product.is_weighted ?? 0) === 1;

    if (isWeighted) {
      const opts = typeof options === 'object' && options !== null ? options : undefined;
      const weightGram = opts?.weight_gram ?? 1000;
      const pricePerKg = opts?.price_per_kg ?? product.price;
      const subtotal = Math.round((weightGram / 1000) * pricePerKg);

      const existing = cart.find((item) => item.product_id === product.id);
      if (existing) {
        set({
          cart: cart.map((item) =>
            item.product_id === product.id
              ? {
                  ...item,
                  weight_gram: weightGram,
                  price_per_kg: pricePerKg,
                  product_price: pricePerKg,
                  quantity: 1,
                  subtotal,
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
              product_price: pricePerKg,
              quantity: 1,
              subtotal,
              is_weighted: 1,
              weight_gram: weightGram,
              price_per_kg: pricePerKg,
            },
          ],
        });
      }
    } else {
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
              is_weighted: 0,
            },
          ],
        });
      }
    }
  },

  updateQuantity: (productId: number, quantity: number) => {
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

  updateCartItemPrice: (productId: number, newPrice: number) => {
    set({
      cart: get().cart.map((item) => {
        if (item.product_id !== productId) return item;
        if (item.is_weighted === 1) {
          const weight = item.weight_gram ?? 1000;
          const subtotal = Math.round((weight / 1000) * newPrice);
          return {
            ...item,
            product_price: newPrice,
            price_per_kg: newPrice,
            subtotal,
          };
        }
        return {
          ...item,
          product_price: newPrice,
          subtotal: item.quantity * newPrice,
        };
      }),
    });
  },

  updateCartItemWeight: (productId: number, newWeightGram: number, newPricePerKg?: number) => {
    set({
      cart: get().cart.map((item) => {
        if (item.product_id !== productId) return item;
        const pricePerKg = newPricePerKg !== undefined ? newPricePerKg : (item.price_per_kg ?? item.product_price);
        const subtotal = Math.round((newWeightGram / 1000) * pricePerKg);
        return {
          ...item,
          weight_gram: newWeightGram,
          price_per_kg: pricePerKg,
          product_price: pricePerKg,
          subtotal,
        };
      }),
    });
  },

  setQuantity: (productId: number, quantity: number) => {
    get().updateQuantity(productId, quantity);
  },

  addWeightedToCart: (product: any, weightGram: number, pricePerKg: number) => {
    get().addToCart(product, { weight_gram: weightGram, price_per_kg: pricePerKg });
  },

  setCart: (cart: CartItem[]) => {
    set({ cart });
  },

  removeFromCart: (productId: number) => {
    set({ cart: get().cart.filter((item) => item.product_id !== productId) });
  },

  clearCart: () => set({ cart: [] }),

  checkout: async (db, paymentMethod, paymentAmount, customerId = null, cashierName = 'Kasir', shiftId = null) => {
    const { cart } = get();
    if (cart.length === 0) return 0;

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = get().getDiscountAmount();
    const total = Math.max(0, subtotal - discountAmount);
    const isCredit = paymentMethod === 'hutang' ? 1 : 0;
    const finalPaymentAmount = isCredit ? 0 : paymentAmount;
    const change = isCredit ? 0 : paymentAmount - total;

    let transactionId = 0;
    await db.withExclusiveTransactionAsync(async (txn) => {
      const result = await txn.runAsync(
        'INSERT INTO transactions (total, payment_method, payment_amount, change, customer_id, is_credit, discount_amount, subtotal_amount, cashier_name, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        total,
        paymentMethod,
        finalPaymentAmount,
        change >= 0 ? change : 0,
        customerId,
        isCredit,
        discountAmount,
        subtotal,
        cashierName,
        shiftId
      );
      transactionId = result.lastInsertRowId as number;

      for (const item of cart) {
        // Ambil cost_price dari tabel products
        const prod = await txn.getFirstAsync<{ cost_price: number; has_stock: number }>(
          'SELECT cost_price, has_stock FROM products WHERE id = ?',
          item.product_id
        );
        const baseCostPrice = prod?.cost_price ?? 0;
        const finalCostPrice = item.is_weighted === 1
          ? Math.round(((item.weight_gram ?? 1000) / 1000) * baseCostPrice)
          : baseCostPrice;

        await txn.runAsync(
          'INSERT INTO transaction_items (transaction_id, product_id, product_name, product_price, quantity, subtotal, cost_price, weight_gram, price_per_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          transactionId,
          item.product_id,
          item.product_name,
          item.product_price,
          item.quantity,
          item.subtotal,
          finalCostPrice,
          item.weight_gram ?? null,
          item.price_per_kg ?? null
        );

        // Pengurangan stok otomatis jika produk mengaktifkan kelola stok
        if (prod?.has_stock === 1) {
          const qtyToDeduct = item.is_weighted === 1
            ? Math.ceil((item.weight_gram ?? 1000) / 1000)
            : item.quantity;
          await txn.runAsync(
            `UPDATE products SET stock = MAX(0, stock - ?), updated_at = datetime('now','localtime') WHERE id = ?`,
            qtyToDeduct,
            item.product_id
          );
        }
      }

      // Jika pembayaran Hutang / Kasbon, catat otomatis ke piutang pelanggan
      if (isCredit && customerId) {
        await txn.runAsync(
          'INSERT INTO customer_receivables (customer_id, transaction_id, total_amount, paid_amount, status) VALUES (?, ?, ?, 0, ?)',
          customerId,
          transactionId,
          total,
          'unpaid'
        );
      }
    });

    // Reset keranjang belanja dan diskon setelah checkout sukses
    set({ cart: [], discount: null });
    await get().loadTransactions(db);
    useProductStore.getState().loadProducts(db);
    const { useCashStore } = await import('@/stores/cashStore');
    await useCashStore.getState().loadLedger(db);
    if (isCredit) {
      const { useDebtReceivableStore } = await import('@/stores/debtReceivableStore');
      await useDebtReceivableStore.getState().loadReceivables(db);
      await useDebtReceivableStore.getState().loadCustomers(db);
    }

    // Hitung nomor urut harian untuk struk (misal: antrean #001 hari ini)
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
        whereClause = "WHERE date(t.created_at) = date('now','localtime')";
        break;
      case 'week':
        whereClause = "WHERE t.created_at >= datetime('now','localtime','-7 days')";
        break;
      case 'month':
        whereClause = "WHERE strftime('%Y-%m', t.created_at) = strftime('%Y-%m', 'now','localtime')";
        break;
    }

    const offset = (page - 1) * pageSize;
    const transactions = await db.getAllAsync<Transaction>(
      `SELECT t.*, c.name as customer_name
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       ${whereClause}
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      pageSize,
      offset
    );

    const countResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions t ${whereClause}`
    );
    const totalCount = countResult?.count ?? 0;
    const hasMore = offset + pageSize < totalCount;

    set((state) => ({
      transactions: page === 1 ? transactions : [...state.transactions, ...transactions],
      loading: false,
      hasMore,
    }));
  },

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
