import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { migrateDbIfNeeded, type SQLiteDatabase } from './database';

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
  const daily_counters = await db.getAllAsync('SELECT * FROM daily_counters');

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
  const fileName = `pos_backup_${dateStr}_${timeStr}.json`;

  const backupData = {
    version: 18,
    app: 'POS Offline',
    exported_at: now.toISOString(),
    counts: {
      categories: categories.length,
      products: products.length,
      transactions: transactions.length,
      customers: customers.length,
      suppliers: suppliers.length,
      purchases: purchases.length,
      cash_ledger: cash_ledger.length,
      cash_shifts: cash_shifts.length,
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
      daily_counters,
    },
  };

  // Simpan secara permanen di direktori dokumen internal aplikasi agar tidak terhapus sistem Android
  const file = new File(Paths.document, fileName);
  file.write(JSON.stringify(backupData, null, 2));

  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Simpan Cadangan Database POS',
        UTI: 'public.json',
      });
    } catch (shareError) {
      console.warn('[exportDatabaseBackup] Berbagi dibatalkan atau tidak tersedia, berkas tetap tersimpan di documentDirectory:', shareError);
    }
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

  if (!parsed || !parsed.data) {
    throw new Error('Berkas cadangan tidak dikenali atau format data kosong.');
  }

  const { data } = parsed;

  // Nonaktifkan foreign keys sementara sebelum transaksi restore untuk mencegah
  // error commit jika terdapat relasi lama yang datanya pernah terhapus di aplikasi lama.
  await db.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // 1. Bersihkan seluruh tabel dengan urutan aman
      await txn.execAsync(`
        DELETE FROM transaction_items;
        DELETE FROM receivable_payments;
        DELETE FROM customer_receivables;
        DELETE FROM debt_payments;
        DELETE FROM supplier_debts;
        DELETE FROM purchase_items;
        DELETE FROM purchases;
        DELETE FROM stock_adjustments;
        DELETE FROM transactions;
        DELETE FROM cash_shifts;
        DELETE FROM cash_ledger;
        DELETE FROM expenses;
        DELETE FROM balance_sheet_items;
        DELETE FROM pending_orders;
        DELETE FROM products;
        DELETE FROM categories;
        DELETE FROM customers;
        DELETE FROM suppliers;
        DELETE FROM daily_counters;
        DELETE FROM sqlite_sequence;
      `);

      // 2. Pulihkan Settings
      if (Array.isArray(data.settings)) {
        for (const row of data.settings) {
          if (row.key && row.value !== undefined) {
            await txn.runAsync(
              'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
              row.key,
              String(row.value)
            );
          }
        }
      }

      // 3. Pulihkan Categories
      const validCategoryIds = new Set<number>();
      if (Array.isArray(data.categories)) {
        for (const row of data.categories) {
          await txn.runAsync(
            'INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)',
            row.id,
            row.name,
            row.created_at || new Date().toISOString()
          );
          validCategoryIds.add(row.id);
        }
      }

      // 4. Pulihkan Products
      const validProductIds = new Set<number>();
      if (Array.isArray(data.products)) {
        for (const row of data.products) {
          const categoryId =
            row.category_id && validCategoryIds.has(row.category_id) ? row.category_id : null;
          await txn.runAsync(
            `INSERT INTO products (
              id, name, category_id, price, cost_price, has_stock, stock,
              image_path, barcode, barcodes, is_weighted, expired_date, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row.id,
            row.name,
            categoryId,
            row.price,
            row.cost_price || 0,
            row.has_stock !== undefined ? row.has_stock : 1,
            row.stock !== undefined ? row.stock : 0,
            row.image_path || '',
            row.barcode || '',
            row.barcodes || '',
            row.is_weighted || 0,
            row.expired_date || null,
            row.created_at || new Date().toISOString(),
            row.updated_at || new Date().toISOString()
          );
          validProductIds.add(row.id);
        }
      }

      // 5. Pulihkan Customers
      const validCustomerIds = new Set<number>();
      if (Array.isArray(data.customers)) {
        for (const row of data.customers) {
          await txn.runAsync(
            'INSERT INTO customers (id, name, phone, created_at) VALUES (?, ?, ?, ?)',
            row.id,
            row.name,
            row.phone || '',
            row.created_at || new Date().toISOString()
          );
          validCustomerIds.add(row.id);
        }
      }

      // 6. Pulihkan Suppliers
      const validSupplierIds = new Set<number>();
      if (Array.isArray(data.suppliers)) {
        for (const row of data.suppliers) {
          await txn.runAsync(
            'INSERT INTO suppliers (id, name, address, phone, created_at) VALUES (?, ?, ?, ?, ?)',
            row.id,
            row.name,
            row.address || '',
            row.phone || '',
            row.created_at || new Date().toISOString()
          );
          validSupplierIds.add(row.id);
        }
      }

      // 7. Pulihkan Purchases & Purchase Items
      const validPurchaseIds = new Set<number>();
      if (Array.isArray(data.purchases)) {
        for (const row of data.purchases) {
          const supplierId =
            row.supplier_id && validSupplierIds.has(row.supplier_id) ? row.supplier_id : null;
          await txn.runAsync(
            `INSERT INTO purchases (
              id, supplier_id, supplier_name, invoice_no, total_amount, payment_type, payment_source, due_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row.id,
            supplierId,
            row.supplier_name || 'Umum',
            row.invoice_no || row.invoice_number || '',
            row.total_amount || 0,
            row.payment_type || 'tunai',
            row.payment_source || 'toko',
            row.due_date || null,
            row.created_at || new Date().toISOString()
          );
          validPurchaseIds.add(row.id);
        }
      }

      if (Array.isArray(data.purchase_items)) {
        for (const row of data.purchase_items) {
          if (validPurchaseIds.has(row.purchase_id)) {
            await txn.runAsync(
              `INSERT INTO purchase_items (
                id, purchase_id, product_id, product_name, quantity, cost_price, subtotal
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              row.id,
              row.purchase_id,
              row.product_id,
              row.product_name,
              row.quantity,
              row.cost_price || 0,
              row.subtotal
            );
          }
        }
      }

      // 8. Pulihkan Supplier Debts & Payments
      const validDebtIds = new Set<number>();
      if (Array.isArray(data.supplier_debts)) {
        for (const row of data.supplier_debts) {
          let supplierId = row.supplier_id;
          if (!validSupplierIds.has(supplierId)) {
            await txn.runAsync(
              'INSERT OR IGNORE INTO suppliers (id, name, address, phone) VALUES (?, ?, ?, ?)',
              supplierId,
              `Supplier #${supplierId}`,
              '',
              ''
            );
            validSupplierIds.add(supplierId);
          }
          const purchaseId =
            row.purchase_id && validPurchaseIds.has(row.purchase_id) ? row.purchase_id : null;
          await txn.runAsync(
            `INSERT INTO supplier_debts (
              id, supplier_id, purchase_id, total_amount, paid_amount, status, due_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            row.id,
            supplierId,
            purchaseId,
            row.total_amount,
            row.paid_amount || 0,
            row.status || 'unpaid',
            row.due_date || null,
            row.created_at || new Date().toISOString()
          );
          validDebtIds.add(row.id);
        }
      }

      if (Array.isArray(data.debt_payments)) {
        for (const row of data.debt_payments) {
          if (validDebtIds.has(row.debt_id)) {
            await txn.runAsync(
              `INSERT INTO debt_payments (
                id, debt_id, payment_date, amount, notes, payment_source, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              row.id,
              row.debt_id,
              row.payment_date || new Date().toISOString().slice(0, 10),
              row.amount,
              row.notes || '',
              row.payment_source || 'hand',
              row.created_at || new Date().toISOString()
            );
          }
        }
      }

      // 9. Pulihkan Transactions & Transaction Items
      const validTxIds = new Set<number>();
      if (Array.isArray(data.transactions)) {
        for (const row of data.transactions) {
          const customerId =
            row.customer_id && validCustomerIds.has(row.customer_id) ? row.customer_id : null;
          await txn.runAsync(
            `INSERT INTO transactions (
              id, total, payment_method, payment_amount, change, customer_id, is_credit,
              discount_amount, subtotal_amount, cashier_name, shift_id,
              tax_amount, tax_rate, tax_type, tax_name,
              cash_received, qris_received, daily_seq, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row.id,
            row.total,
            row.payment_method || 'tunai',
            row.payment_amount || 0,
            row.change || 0,
            customerId,
            row.is_credit || 0,
            row.discount_amount || 0,
            row.subtotal_amount || row.total,
            row.cashier_name || 'Kasir',
            row.shift_id || null,
            row.tax_amount || 0,
            row.tax_rate || 0,
            row.tax_type || 'none',
            row.tax_name || 'Pajak / PB1',
            row.cash_received || 0,
            row.qris_received || 0,
            row.daily_seq || 0,
            row.created_at || new Date().toISOString()
          );
          validTxIds.add(row.id);
        }
      }

      if (Array.isArray(data.transaction_items)) {
        for (const row of data.transaction_items) {
          if (validTxIds.has(row.transaction_id)) {
            await txn.runAsync(
              `INSERT INTO transaction_items (
                id, transaction_id, product_id, product_name, product_price, quantity,
                subtotal, cost_price, weight_gram, price_per_kg
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              row.id,
              row.transaction_id,
              row.product_id,
              row.product_name,
              row.product_price,
              row.quantity,
              row.subtotal,
              row.cost_price || 0,
              row.weight_gram || null,
              row.price_per_kg || null
            );
          }
        }
      }

      // 10. Pulihkan Customer Receivables & Payments
      const validReceivableIds = new Set<number>();
      if (Array.isArray(data.customer_receivables)) {
        for (const row of data.customer_receivables) {
          let customerId = row.customer_id;
          if (!validCustomerIds.has(customerId)) {
            await txn.runAsync(
              'INSERT OR IGNORE INTO customers (id, name, phone) VALUES (?, ?, ?)',
              customerId,
              `Pelanggan #${customerId}`,
              ''
            );
            validCustomerIds.add(customerId);
          }
          const transactionId =
            row.transaction_id && validTxIds.has(row.transaction_id) ? row.transaction_id : null;
          await txn.runAsync(
            `INSERT INTO customer_receivables (
              id, customer_id, transaction_id, total_amount, paid_amount, status, due_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            row.id,
            customerId,
            transactionId,
            row.total_amount,
            row.paid_amount || 0,
            row.status || 'unpaid',
            row.due_date || null,
            row.created_at || new Date().toISOString()
          );
          validReceivableIds.add(row.id);
        }
      }

      if (Array.isArray(data.receivable_payments)) {
        for (const row of data.receivable_payments) {
          if (validReceivableIds.has(row.receivable_id)) {
            await txn.runAsync(
              `INSERT INTO receivable_payments (
                id, receivable_id, payment_date, amount, notes, payment_source, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              row.id,
              row.receivable_id,
              row.payment_date || new Date().toISOString().slice(0, 10),
              row.amount,
              row.notes || '',
              row.payment_source || 'hand',
              row.created_at || new Date().toISOString()
            );
          }
        }
      }

      // 11. Pulihkan Cash Shifts
      if (Array.isArray(data.cash_shifts)) {
        for (const row of data.cash_shifts) {
          await txn.runAsync(
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
          await txn.runAsync(
            `INSERT INTO cash_ledger (
              id, type, category, description, amount, date, account, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            row.id,
            row.type,
            row.category,
            row.description || '',
            row.amount,
            row.date || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            row.account || 'hand',
            row.created_at || new Date().toISOString()
          );
        }
      }

      if (Array.isArray(data.expenses)) {
        for (const row of data.expenses) {
          await txn.runAsync(
            `INSERT INTO expenses (
              id, category, description, amount, expense_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            row.id,
            row.category || 'lain-lain',
            row.description || row.notes || '',
            row.amount || 0,
            row.expense_date || row.date || (row.created_at ? row.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            row.created_at || new Date().toISOString()
          );
        }
      }

      // 13. Pulihkan Balance Sheet Items
      if (Array.isArray(data.balance_sheet_items)) {
        for (const row of data.balance_sheet_items) {
          await txn.runAsync(
            `INSERT INTO balance_sheet_items (
              id, section, name, amount, sort_order, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            row.id,
            row.section,
            row.name,
            row.amount || 0,
            row.sort_order || 0,
            row.updated_at || new Date().toISOString()
          );
        }
      }

      // 14. Pulihkan Stock Adjustments
      if (Array.isArray(data.stock_adjustments)) {
        for (const row of data.stock_adjustments) {
          await txn.runAsync(
            `INSERT INTO stock_adjustments (
              id, product_id, product_name, system_stock, physical_stock, difference, unit_cost, total_loss, notes, adjusted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row.id,
            row.product_id,
            row.product_name,
            row.system_stock,
            row.physical_stock,
            row.difference,
            row.unit_cost || 0,
            row.total_loss || 0,
            row.notes || '',
            row.adjusted_at || new Date().toISOString()
          );
        }
      }

      // 15. Sinkronisasi Daily Counters dari data transaksi yang dipulihkan
      if (Array.isArray(data.daily_counters) && data.daily_counters.length > 0) {
        for (const row of data.daily_counters) {
          await txn.runAsync(
            'INSERT OR REPLACE INTO daily_counters (date, last_seq, updated_at) VALUES (?, ?, ?)',
            row.date,
            row.last_seq || 0,
            row.updated_at || new Date().toISOString()
          );
        }
      } else {
        await txn.execAsync(`
          INSERT OR REPLACE INTO daily_counters (date, last_seq, updated_at)
          SELECT
            substr(created_at, 1, 10) as tx_date,
            COALESCE(MAX(daily_seq), COUNT(*)) as max_seq,
            datetime('now', 'localtime')
          FROM transactions
          GROUP BY substr(created_at, 1, 10);
        `);
      }
    });
  } finally {
    // Selalu pastikan foreign keys diaktifkan kembali
    await db.execAsync('PRAGMA foreign_keys = ON;');
    // Jalankan migrasi dan penyesuaian skema/data terbaru untuk memastikan data yang dipulihkan selalu mutakhir
    await migrateDbIfNeeded(db);
  }

  return {
    version: parsed.version || 18,
    app: parsed.app || 'POS Offline',
    exported_at: parsed.exported_at || '',
    counts: {
      categories: data.categories?.length ?? 0,
      products: data.products?.length ?? 0,
      transactions: data.transactions?.length ?? 0,
      customers: data.customers?.length ?? 0,
      suppliers: data.suppliers?.length ?? 0,
      purchases: data.purchases?.length ?? 0,
      cash_ledger: data.cash_ledger?.length ?? 0,
      cash_shifts: data.cash_shifts?.length ?? 0,
      ...(parsed.counts || {}),
    },
  };
}
