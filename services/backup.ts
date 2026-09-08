import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from './database';

export interface BackupMetadata {
  version: number;
  app: string;
  exported_at: string;
  counts: Record<string, number>;
}

export async function exportDatabaseBackup(db: SQLiteDatabase): Promise<string> {
  const settings = await db.getAllAsync('SELECT * FROM settings');
  const categories = await db.getAllAsync('SELECT * FROM categories');
  const products = await db.getAllAsync('SELECT * FROM products');
  const customers = await db.getAllAsync('SELECT * FROM customers');
  const suppliers = await db.getAllAsync('SELECT * FROM suppliers');
  const purchases = await db.getAllAsync('SELECT * FROM purchases');
  const purchase_items = await db.getAllAsync('SELECT * FROM purchase_items');
  const supplier_debts = await db.getAllAsync('SELECT * FROM supplier_debts');
  const debt_payments = await db.getAllAsync('SELECT * FROM debt_payments');
  const customer_receivables = await db.getAllAsync('SELECT * FROM customer_receivables');
  const receivable_payments = await db.getAllAsync('SELECT * FROM receivable_payments');
  const stock_adjustments = await db.getAllAsync('SELECT * FROM stock_adjustments');
  const transactions = await db.getAllAsync('SELECT * FROM transactions');
  const transaction_items = await db.getAllAsync('SELECT * FROM transaction_items');
  const cash_ledger = await db.getAllAsync('SELECT * FROM cash_ledger');
  const expenses = await db.getAllAsync('SELECT * FROM expenses');
  const balance_sheet_items = await db.getAllAsync('SELECT * FROM balance_sheet_items');
  const cash_shifts = await db.getAllAsync('SELECT * FROM cash_shifts');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  const fileName = `pos_backup_${dateStr}_${timeStr}.json`;

  const backupData = {
    version: 12,
    app: 'POS Offline',
    exported_at: now.toISOString(),
    counts: {
      categories: categories.length,
      products: products.length,
      transactions: transactions.length,
      customers: customers.length,
      suppliers: suppliers.length,
      purchases: purchases.length,
    },
    data: {
      settings,
      categories,
      products,
      customers,
      suppliers,
      purchases,
      purchase_items,
      supplier_debts,
      debt_payments,
      customer_receivables,
      receivable_payments,
      stock_adjustments,
      transactions,
      transaction_items,
      cash_ledger,
      expenses,
      balance_sheet_items,
      cash_shifts,
    },
  };

  const file = new File(Paths.cache, fileName);
  file.write(JSON.stringify(backupData, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Simpan Cadangan Database POS',
      UTI: 'public.json',
    });
  }

  return file.uri;
}

export async function restoreDatabaseBackup(
  db: SQLiteDatabase,
  fileUri: string
): Promise<BackupMetadata> {
  const response = await fetch(fileUri);
  const content = await response.text();

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Format berkas tidak valid. Pastikan memilih berkas JSON cadangan POS.');
  }

  if (!parsed || parsed.app !== 'POS Offline' || !parsed.data) {
    throw new Error('Berkas cadangan tidak dikenali atau rusak.');
  }

  const { data } = parsed;

  await db.withTransactionAsync(async () => {
    // 1. Bersihkan seluruh tabel
    await db.execAsync(`
      DELETE FROM cash_shifts;
      DELETE FROM pending_orders;
      DELETE FROM transaction_items;
      DELETE FROM transactions;
      DELETE FROM cash_ledger;
      DELETE FROM expenses;
      DELETE FROM balance_sheet_items;
      DELETE FROM purchase_items;
      DELETE FROM purchases;
      DELETE FROM stock_adjustments;
      DELETE FROM receivable_payments;
      DELETE FROM customer_receivables;
      DELETE FROM debt_payments;
      DELETE FROM supplier_debts;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM customers;
      DELETE FROM suppliers;
      DELETE FROM sqlite_sequence;
    `);

    // 2. Pulihkan Settings
    if (Array.isArray(data.settings)) {
      for (const row of data.settings) {
        if (row.key && row.value !== undefined) {
          await db.runAsync(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            row.key,
            String(row.value)
          );
        }
      }
    }

    // 3. Pulihkan Categories
    if (Array.isArray(data.categories)) {
      for (const row of data.categories) {
        await db.runAsync(
          'INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)',
          row.id,
          row.name,
          row.created_at || new Date().toISOString()
        );
      }
    }

    // 4. Pulihkan Products
    if (Array.isArray(data.products)) {
      for (const row of data.products) {
        await db.runAsync(
          `INSERT INTO products (
            id, name, category_id, price, cost_price, has_stock, stock, min_stock,
            image_path, barcode, barcodes, is_weighted, expired_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.name,
          row.category_id,
          row.price,
          row.cost_price || 0,
          row.has_stock !== undefined ? row.has_stock : 1,
          row.stock !== undefined ? row.stock : 0,
          row.min_stock !== undefined ? row.min_stock : 5,
          row.image_path || '',
          row.barcode || '',
          row.barcodes || '',
          row.is_weighted || 0,
          row.expired_date || null,
          row.created_at || new Date().toISOString(),
          row.updated_at || new Date().toISOString()
        );
      }
    }

    // 5. Pulihkan Customers
    if (Array.isArray(data.customers)) {
      for (const row of data.customers) {
        await db.runAsync(
          'INSERT INTO customers (id, name, address, phone, created_at) VALUES (?, ?, ?, ?, ?)',
          row.id,
          row.name,
          row.address || '',
          row.phone || '',
          row.created_at || new Date().toISOString()
        );
      }
    }

    // 6. Pulihkan Suppliers
    if (Array.isArray(data.suppliers)) {
      for (const row of data.suppliers) {
        await db.runAsync(
          'INSERT INTO suppliers (id, name, address, phone, created_at) VALUES (?, ?, ?, ?, ?)',
          row.id,
          row.name,
          row.address || '',
          row.phone || '',
          row.created_at || new Date().toISOString()
        );
      }
    }

    // 7. Pulihkan Purchases & Purchase Items
    if (Array.isArray(data.purchases)) {
      for (const row of data.purchases) {
        await db.runAsync(
          `INSERT INTO purchases (
            id, supplier_id, invoice_number, total_amount, payment_type, payment_source, due_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.supplier_id || null,
          row.invoice_number || '',
          row.total_amount || 0,
          row.payment_type || 'tunai',
          row.payment_source || 'toko',
          row.due_date || null,
          row.created_at || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(data.purchase_items)) {
      for (const row of data.purchase_items) {
        await db.runAsync(
          `INSERT INTO purchase_items (
            id, purchase_id, product_id, product_name, quantity, cost_price, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.purchase_id,
          row.product_id,
          row.product_name,
          row.quantity,
          row.cost_price,
          row.subtotal
        );
      }
    }

    // 8. Pulihkan Supplier Debts & Payments
    if (Array.isArray(data.supplier_debts)) {
      for (const row of data.supplier_debts) {
        await db.runAsync(
          `INSERT INTO supplier_debts (
            id, supplier_id, purchase_id, total_amount, paid_amount, status, due_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.supplier_id,
          row.purchase_id || null,
          row.total_amount,
          row.paid_amount || 0,
          row.status || 'unpaid',
          row.due_date || null,
          row.created_at || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(data.debt_payments)) {
      for (const row of data.debt_payments) {
        await db.runAsync(
          `INSERT INTO debt_payments (
            id, debt_id, payment_date, amount, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          row.id,
          row.debt_id,
          row.payment_date || new Date().toISOString().slice(0, 10),
          row.amount,
          row.notes || '',
          row.created_at || new Date().toISOString()
        );
      }
    }

    // 9. Pulihkan Customer Receivables & Payments
    if (Array.isArray(data.customer_receivables)) {
      for (const row of data.customer_receivables) {
        await db.runAsync(
          `INSERT INTO customer_receivables (
            id, customer_id, transaction_id, total_amount, paid_amount, status, due_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.customer_id,
          row.transaction_id || null,
          row.total_amount,
          row.paid_amount || 0,
          row.status || 'unpaid',
          row.due_date || null,
          row.created_at || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(data.receivable_payments)) {
      for (const row of data.receivable_payments) {
        await db.runAsync(
          `INSERT INTO receivable_payments (
            id, receivable_id, payment_date, amount, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          row.id,
          row.receivable_id,
          row.payment_date || new Date().toISOString().slice(0, 10),
          row.amount,
          row.notes || '',
          row.created_at || new Date().toISOString()
        );
      }
    }

    // 10. Pulihkan Transactions & Transaction Items
    if (Array.isArray(data.transactions)) {
      for (const row of data.transactions) {
        await db.runAsync(
          `INSERT INTO transactions (
            id, total, payment_method, payment_amount, change, customer_id, is_credit,
            discount_amount, subtotal_amount, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.total,
          row.payment_method || 'tunai',
          row.payment_amount || 0,
          row.change || 0,
          row.customer_id || null,
          row.is_credit || 0,
          row.discount_amount || 0,
          row.subtotal_amount || row.total,
          row.created_at || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(data.transaction_items)) {
      for (const row of data.transaction_items) {
        await db.runAsync(
          `INSERT INTO transaction_items (
            id, transaction_id, product_id, product_name, product_price, quantity,
            subtotal, weight_gram, price_per_kg
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.transaction_id,
          row.product_id,
          row.product_name,
          row.product_price,
          row.quantity,
          row.subtotal,
          row.weight_gram || null,
          row.price_per_kg || null
        );
      }
    }

    // 11. Pulihkan Cash Shifts
    if (Array.isArray(data.cash_shifts)) {
      for (const row of data.cash_shifts) {
        await db.runAsync(
          `INSERT INTO cash_shifts (
            id, cashier_name, opened_at, closed_at, starting_cash, expected_cash,
            actual_cash, difference, total_sales_cash, total_sales_non_cash,
            total_transactions, notes, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.cashier_name,
          row.opened_at,
          row.closed_at || null,
          row.starting_cash || 0,
          row.expected_cash || 0,
          row.actual_cash !== undefined ? row.actual_cash : null,
          row.difference !== undefined ? row.difference : null,
          row.total_sales_cash || 0,
          row.total_sales_non_cash || 0,
          row.total_transactions || 0,
          row.notes || '',
          row.status || 'closed'
        );
      }
    }

    // 12. Pulihkan Cash Ledger & Expenses
    if (Array.isArray(data.cash_ledger)) {
      for (const row of data.cash_ledger) {
        await db.runAsync(
          `INSERT INTO cash_ledger (
            id, date, type, category, amount, description, ref_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.date,
          row.type,
          row.category,
          row.amount,
          row.description || '',
          row.ref_id || null,
          row.created_at || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(data.expenses)) {
      for (const row of data.expenses) {
        await db.runAsync(
          `INSERT INTO expenses (
            id, date, category, amount, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          row.id,
          row.date,
          row.category,
          row.amount,
          row.notes || '',
          row.created_at || new Date().toISOString()
        );
      }
    }
  });

  return {
    version: parsed.version || 12,
    app: parsed.app,
    exported_at: parsed.exported_at || '',
    counts: parsed.counts || {},
  };
}
