import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';
import { useCashStore } from '@/stores/cashStore';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  address: string;
  phone: string;
  created_at: string;
}

export interface CustomerReceivable {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  transaction_id: number | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'partial' | 'paid';
  due_date: string | null;
  created_at: string;
}

export interface SupplierDebt {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_phone: string;
  purchase_id: number | null;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'partial' | 'paid';
  due_date: string | null;
  created_at: string;
}

export interface PaymentHistoryItem {
  id: number;
  parent_id: number;
  payment_date: string;
  amount: number;
  notes: string;
  created_at: string;
}

interface DebtReceivableState {
  customers: Customer[];
  suppliers: Supplier[];
  receivables: CustomerReceivable[];
  debts: SupplierDebt[];
  totalReceivableUnpaid: number;
  totalDebtUnpaid: number;
  loading: boolean;

  // Customers
  loadCustomers: (db: SQLiteDatabase) => Promise<void>;
  addCustomer: (db: SQLiteDatabase, name: string, phone?: string) => Promise<number>;
  updateCustomer: (db: SQLiteDatabase, id: number, name: string, phone?: string) => Promise<void>;
  deleteCustomer: (db: SQLiteDatabase, id: number) => Promise<{ success: boolean; message?: string }>;

  // Suppliers
  loadSuppliers: (db: SQLiteDatabase) => Promise<void>;
  addSupplier: (db: SQLiteDatabase, name: string, address?: string, phone?: string) => Promise<number>;
  updateSupplier: (db: SQLiteDatabase, id: number, name: string, address?: string, phone?: string) => Promise<void>;
  deleteSupplier: (db: SQLiteDatabase, id: number) => Promise<{ success: boolean; message?: string }>;

  // Receivables (Piutang Customer)
  loadReceivables: (db: SQLiteDatabase) => Promise<void>;
  addReceivable: (
    db: SQLiteDatabase,
    customerId: number,
    totalAmount: number,
    dueDate?: string,
    transactionId?: number
  ) => Promise<void>;
  payReceivable: (
    db: SQLiteDatabase,
    receivableId: number,
    amount: number,
    notes?: string,
    paymentDate?: string,
    paymentSource?: 'hand' | 'bank'
  ) => Promise<{ success: boolean; message?: string }>;
  getReceivablePayments: (db: SQLiteDatabase, receivableId: number) => Promise<PaymentHistoryItem[]>;

  // Debts (Hutang Supplier)
  loadDebts: (db: SQLiteDatabase) => Promise<void>;
  addDebt: (
    db: SQLiteDatabase,
    supplierId: number,
    totalAmount: number,
    dueDate?: string,
    purchaseId?: number
  ) => Promise<void>;
  payDebt: (
    db: SQLiteDatabase,
    debtId: number,
    amount: number,
    notes?: string,
    paymentDate?: string,
    paymentSource?: 'hand' | 'bank'
  ) => Promise<{ success: boolean; message?: string }>;
  getDebtPayments: (db: SQLiteDatabase, debtId: number) => Promise<PaymentHistoryItem[]>;
}

export const useDebtReceivableStore = create<DebtReceivableState>((set, get) => ({
  customers: [],
  suppliers: [],
  receivables: [],
  debts: [],
  totalReceivableUnpaid: 0,
  totalDebtUnpaid: 0,
  loading: false,

  // ─────────────────────────────────────────
  // Customer CRUD
  // ─────────────────────────────────────────
  loadCustomers: async (db) => {
    try {
      const rows = await db.getAllAsync<Customer>(
        'SELECT id, name, phone, created_at FROM customers ORDER BY name ASC'
      );
      set({ customers: rows });
    } catch (e) {
      console.error('loadCustomers error:', e);
    }
  },

  addCustomer: async (db, name, phone = '') => {
    const res = await db.runAsync(
      'INSERT INTO customers (name, phone) VALUES (?, ?)',
      name.trim(),
      phone.trim()
    );
    await get().loadCustomers(db);
    return res.lastInsertRowId;
  },

  updateCustomer: async (db, id, name, phone = '') => {
    await db.runAsync(
      'UPDATE customers SET name = ?, phone = ? WHERE id = ?',
      name.trim(),
      phone.trim(),
      id
    );
    await get().loadCustomers(db);
    await get().loadReceivables(db);
  },

  deleteCustomer: async (db, id) => {
    try {
      // Cek apakah ada piutang aktif yang belum lunas
      const activeReceivable = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM customer_receivables WHERE customer_id = ? AND status != 'paid'",
        id
      );
      if (activeReceivable && activeReceivable.count > 0) {
        return {
          success: false,
          message: 'Pelanggan masih memiliki piutang aktif yang belum lunas.',
        };
      }
      await db.runAsync('DELETE FROM customers WHERE id = ?', id);
      await get().loadCustomers(db);
      await get().loadReceivables(db);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menghapus pelanggan' };
    }
  },

  // ─────────────────────────────────────────
  // Supplier CRUD
  // ─────────────────────────────────────────
  loadSuppliers: async (db) => {
    try {
      const rows = await db.getAllAsync<Supplier>(
        'SELECT id, name, address, phone, created_at FROM suppliers ORDER BY name ASC'
      );
      set({ suppliers: rows });
    } catch (e) {
      console.error('loadSuppliers error:', e);
    }
  },

  addSupplier: async (db, name, address = '', phone = '') => {
    const res = await db.runAsync(
      'INSERT INTO suppliers (name, address, phone) VALUES (?, ?, ?)',
      name.trim(),
      address.trim(),
      phone.trim()
    );
    await get().loadSuppliers(db);
    return res.lastInsertRowId;
  },

  updateSupplier: async (db, id, name, address = '', phone = '') => {
    await db.runAsync(
      'UPDATE suppliers SET name = ?, address = ?, phone = ? WHERE id = ?',
      name.trim(),
      address.trim(),
      phone.trim(),
      id
    );
    await get().loadSuppliers(db);
    await get().loadDebts(db);
  },

  deleteSupplier: async (db, id) => {
    try {
      const activeDebt = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM supplier_debts WHERE supplier_id = ? AND status != 'paid'",
        id
      );
      if (activeDebt && activeDebt.count > 0) {
        return {
          success: false,
          message: 'Supplier masih memiliki catatan hutang yang belum lunas.',
        };
      }
      await db.runAsync('DELETE FROM suppliers WHERE id = ?', id);
      await get().loadSuppliers(db);
      await get().loadDebts(db);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Gagal menghapus supplier' };
    }
  },

  // ─────────────────────────────────────────
  // Piutang Pelanggan (Receivables)
  // ─────────────────────────────────────────
  loadReceivables: async (db) => {
    try {
      const rows = await db.getAllAsync<{
        id: number;
        customer_id: number;
        customer_name: string;
        customer_phone: string;
        transaction_id: number | null;
        total_amount: number;
        paid_amount: number;
        status: string;
        due_date: string | null;
        created_at: string;
      }>(`
        SELECT 
          cr.id,
          cr.customer_id,
          COALESCE(c.name, 'Pelanggan Umum') as customer_name,
          COALESCE(c.phone, '') as customer_phone,
          cr.transaction_id,
          cr.total_amount,
          cr.paid_amount,
          cr.status,
          cr.due_date,
          cr.created_at
        FROM customer_receivables cr
        LEFT JOIN customers c ON cr.customer_id = c.id
        ORDER BY 
          CASE WHEN cr.status = 'paid' THEN 2 ELSE 1 END,
          cr.created_at DESC
      `);

      const mapped: CustomerReceivable[] = rows.map((r) => ({
        ...r,
        status: r.status as 'unpaid' | 'partial' | 'paid',
        remaining_amount: Math.max(0, r.total_amount - r.paid_amount),
      }));

      const totalUnpaid = mapped
        .filter((r) => r.status !== 'paid')
        .reduce((sum, r) => sum + r.remaining_amount, 0);

      set({ receivables: mapped, totalReceivableUnpaid: totalUnpaid });
    } catch (e) {
      console.error('loadReceivables error:', e);
    }
  },

  addReceivable: async (db, customerId, totalAmount, dueDate, transactionId) => {
    await db.runAsync(
      `INSERT INTO customer_receivables (customer_id, transaction_id, total_amount, paid_amount, status, due_date)
       VALUES (?, ?, ?, 0, 'unpaid', ?)`,
      customerId,
      transactionId ?? null,
      totalAmount,
      dueDate ?? null
    );
    await get().loadReceivables(db);
  },

  payReceivable: async (db, receivableId, amount, notes = '', paymentDate, paymentSource = 'hand') => {
    if (amount <= 0) {
      return { success: false, message: 'Nominal pembayaran harus lebih besar dari 0' };
    }

    try {
      const rec = await db.getFirstAsync<{
        id: number;
        customer_id: number;
        customer_name: string;
        total_amount: number;
        paid_amount: number;
      }>(`
        SELECT cr.id, cr.customer_id, c.name as customer_name, cr.total_amount, cr.paid_amount
        FROM customer_receivables cr
        LEFT JOIN customers c ON cr.customer_id = c.id
        WHERE cr.id = ?
      `, receivableId);

      if (!rec) {
        return { success: false, message: 'Catatan piutang tidak ditemukan' };
      }

      const remaining = rec.total_amount - rec.paid_amount;
      if (amount > remaining) {
        return {
          success: false,
          message: `Nominal pembayaran melebihi sisa piutang (Sisa: Rp ${remaining.toLocaleString('id-ID')})`,
        };
      }

      const pDate = paymentDate || new Date().toISOString().split('T')[0];
      const newPaid = rec.paid_amount + amount;
      const newStatus = newPaid >= rec.total_amount ? 'paid' : 'partial';
      const targetAccount = paymentSource === 'bank' ? 'bank' : 'hand';

      await db.withExclusiveTransactionAsync(async (txn) => {
        // 1. Simpan riwayat pembayaran cicilan
        await txn.runAsync(
          'INSERT INTO receivable_payments (receivable_id, payment_date, amount, notes, payment_source) VALUES (?, ?, ?, ?, ?)',
          receivableId,
          pDate,
          amount,
          notes.trim(),
          targetAccount
        );

        // 2. Update status piutang customer
        await txn.runAsync(
          'UPDATE customer_receivables SET paid_amount = ?, status = ? WHERE id = ?',
          newPaid,
          newStatus,
          receivableId
        );

        // 3. Catat Kas Masuk (Penerimaan Kas) ke Buku Kas sesuai akun kas terpilih
        const descSuffix = targetAccount === 'bank' ? 'via Transfer/Bank' : 'via Kas Tunai';
        await txn.runAsync(
          `INSERT INTO cash_ledger (type, category, description, amount, date, account)
           VALUES ('in', 'pelunasan_piutang', ?, ?, ?, ?)`,
          `Pelunasan piutang: ${rec.customer_name || 'Pelanggan'} (${notes ? notes : 'Cicilan'}) - ${descSuffix}`,
          amount,
          pDate,
          targetAccount
        );
      });

      await get().loadReceivables(db);
      await useCashStore.getState().loadLedger(db);
      return { success: true };
    } catch (e: any) {
      console.error('payReceivable error:', e);
      return { success: false, message: e?.message || 'Gagal memproses pembayaran' };
    }
  },

  getReceivablePayments: async (db, receivableId) => {
    try {
      const rows = await db.getAllAsync<{
        id: number;
        receivable_id: number;
        payment_date: string;
        amount: number;
        notes: string;
        created_at: string;
      }>(
        'SELECT id, receivable_id, payment_date, amount, notes, created_at FROM receivable_payments WHERE receivable_id = ? ORDER BY payment_date DESC, id DESC',
        receivableId
      );
      return rows.map((r) => ({
        id: r.id,
        parent_id: r.receivable_id,
        payment_date: r.payment_date,
        amount: r.amount,
        notes: r.notes,
        created_at: r.created_at,
      }));
    } catch (e) {
      console.error('getReceivablePayments error:', e);
      return [];
    }
  },

  // ─────────────────────────────────────────
  // Hutang Supplier (Debts)
  // ─────────────────────────────────────────
  loadDebts: async (db) => {
    try {
      const rows = await db.getAllAsync<{
        id: number;
        supplier_id: number;
        supplier_name: string;
        supplier_phone: string;
        purchase_id: number | null;
        total_amount: number;
        paid_amount: number;
        status: string;
        due_date: string | null;
        created_at: string;
      }>(`
        SELECT 
          sd.id,
          sd.supplier_id,
          COALESCE(s.name, 'Supplier Umum') as supplier_name,
          COALESCE(s.phone, '') as supplier_phone,
          sd.purchase_id,
          sd.total_amount,
          sd.paid_amount,
          sd.status,
          sd.due_date,
          sd.created_at
        FROM supplier_debts sd
        LEFT JOIN suppliers s ON sd.supplier_id = s.id
        ORDER BY 
          CASE WHEN sd.status = 'paid' THEN 2 ELSE 1 END,
          sd.created_at DESC
      `);

      const mapped: SupplierDebt[] = rows.map((r) => ({
        ...r,
        status: r.status as 'unpaid' | 'partial' | 'paid',
        remaining_amount: Math.max(0, r.total_amount - r.paid_amount),
      }));

      const totalUnpaid = mapped
        .filter((d) => d.status !== 'paid')
        .reduce((sum, d) => sum + d.remaining_amount, 0);

      set({ debts: mapped, totalDebtUnpaid: totalUnpaid });
    } catch (e) {
      console.error('loadDebts error:', e);
    }
  },

  addDebt: async (db, supplierId, totalAmount, dueDate, purchaseId) => {
    await db.runAsync(
      `INSERT INTO supplier_debts (supplier_id, purchase_id, total_amount, paid_amount, status, due_date)
       VALUES (?, ?, ?, 0, 'unpaid', ?)`,
      supplierId,
      purchaseId ?? null,
      totalAmount,
      dueDate ?? null
    );
    await get().loadDebts(db);
  },

  payDebt: async (db, debtId, amount, notes = '', paymentDate, paymentSource = 'hand') => {
    if (amount <= 0) {
      return { success: false, message: 'Nominal pembayaran harus lebih besar dari 0' };
    }

    try {
      const debt = await db.getFirstAsync<{
        id: number;
        supplier_id: number;
        supplier_name: string;
        total_amount: number;
        paid_amount: number;
      }>(`
        SELECT sd.id, sd.supplier_id, s.name as supplier_name, sd.total_amount, sd.paid_amount
        FROM supplier_debts sd
        LEFT JOIN suppliers s ON sd.supplier_id = s.id
        WHERE sd.id = ?
      `, debtId);

      if (!debt) {
        return { success: false, message: 'Catatan hutang tidak ditemukan' };
      }

      const remaining = debt.total_amount - debt.paid_amount;
      if (amount > remaining) {
        return {
          success: false,
          message: `Nominal pembayaran melebihi sisa hutang (Sisa: Rp ${remaining.toLocaleString('id-ID')})`,
        };
      }

      const targetAccount = paymentSource === 'bank' ? 'bank' : 'hand';

      // Validasi Saldo Kas (Fisik Toko atau Bank)
      const cashStoreState = useCashStore.getState();
      const availableBalance = targetAccount === 'bank' ? cashStoreState.cashBankBalance : cashStoreState.cashHandBalance;

      if (availableBalance < amount) {
        const defisit = amount - availableBalance;
        const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
        const accountLabel = targetAccount === 'bank' ? 'Kas di Bank (Rekening)' : 'Kas Fisik di Tangan (Laci)';
        return {
          success: false,
          message: `Saldo ${accountLabel} tidak mencukupi untuk bayar hutang!\n\nSaldo Tersedia: ${fmt(availableBalance)}\nNominal Bayar: ${fmt(amount)}\nKekurangan: ${fmt(defisit)}\n\nSilakan pilih akun kas lain atau lakukan penambahan kas terlebih dahulu.`,
        };
      }

      const pDate = paymentDate || new Date().toISOString().split('T')[0];
      const newPaid = debt.paid_amount + amount;
      const newStatus = newPaid >= debt.total_amount ? 'paid' : 'partial';

      await db.withExclusiveTransactionAsync(async (txn) => {
        // 1. Simpan riwayat pembayaran cicilan hutang
        await txn.runAsync(
          'INSERT INTO debt_payments (debt_id, payment_date, amount, notes, payment_source) VALUES (?, ?, ?, ?, ?)',
          debtId,
          pDate,
          amount,
          notes.trim(),
          targetAccount
        );

        // 2. Update status hutang supplier
        await txn.runAsync(
          'UPDATE supplier_debts SET paid_amount = ?, status = ? WHERE id = ?',
          newPaid,
          newStatus,
          debtId
        );

        // 3. Catat Kas Keluar (Pengeluaran Kas) ke Buku Kas sesuai akun kas terpilih
        const descSuffix = targetAccount === 'bank' ? 'via Rekening Bank' : 'via Kas Laci Toko';
        await txn.runAsync(
          `INSERT INTO cash_ledger (type, category, description, amount, date, account)
           VALUES ('out', 'bayar_hutang_supplier', ?, ?, ?, ?)`,
          `Bayar hutang: ${debt.supplier_name || 'Supplier'} (${notes ? notes : 'Cicilan'}) - ${descSuffix}`,
          amount,
          pDate,
          targetAccount
        );
      });

      await get().loadDebts(db);
      await useCashStore.getState().loadLedger(db);
      return { success: true };
    } catch (e: any) {
      console.error('payDebt error:', e);
      return { success: false, message: e?.message || 'Gagal memproses pembayaran hutang' };
    }
  },

  getDebtPayments: async (db, debtId) => {
    try {
      const rows = await db.getAllAsync<{
        id: number;
        debt_id: number;
        payment_date: string;
        amount: number;
        notes: string;
        created_at: string;
      }>(
        'SELECT id, debt_id, payment_date, amount, notes, created_at FROM debt_payments WHERE debt_id = ? ORDER BY payment_date DESC, id DESC',
        debtId
      );
      return rows.map((r) => ({
        id: r.id,
        parent_id: r.debt_id,
        payment_date: r.payment_date,
        amount: r.amount,
        notes: r.notes,
        created_at: r.created_at,
      }));
    } catch (e) {
      console.error('getDebtPayments error:', e);
      return [];
    }
  },
}));
