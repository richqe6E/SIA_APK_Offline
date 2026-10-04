import * as SQLite from 'expo-sqlite';

export type SQLiteDatabase = SQLite.SQLiteDatabase;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 16;
  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  let currentDbVersion = versionRow?.user_version ?? 0;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_name', 'POS Offline');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('business_type', 'Toko');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('business_mode', 'retail');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pin', '123456');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_view_mode', 'list');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('is_onboarded', '1');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_address', 'Jl. Cipto Mangunkusumo, Samarinda');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_phone', '0812-3456-7890');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('store_phone2', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_footer', 'Terima kasih atas kunjungan Anda!');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('qris_image_path', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('app_orientation', 'portrait');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_enabled', '0');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_name', 'Pajak / PB1');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_type', 'percent');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_rate', '10');
  `);

  if (currentDbVersion >= DATABASE_VERSION) return;

  if (currentDbVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        image_path TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'tunai',
        payment_amount REAL NOT NULL,
        change REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS transaction_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        product_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );
    `);
    currentDbVersion = 1;
  }

  if (currentDbVersion === 1) {
    await db.execAsync(`
      DROP TABLE IF EXISTS products;
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        image_path TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
    currentDbVersion = 2;
  }

  if (currentDbVersion === 2) {
    currentDbVersion = 3;
  }

  if (currentDbVersion === 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
    `);
    currentDbVersion = 4;
  }

  if (currentDbVersion === 4) {
    // Tambah HPP, stok opsional ke produk
    await db.execAsync(`
      ALTER TABLE products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN has_stock INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0;

      -- Tambah cost_price ke transaction_items untuk snapshoting HPP saat transaksi
      ALTER TABLE transaction_items ADD COLUMN cost_price REAL NOT NULL DEFAULT 0;

      -- Tabel beban operasional
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL DEFAULT 'lain-lain',
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date TEXT NOT NULL DEFAULT (date('now','localtime')),
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- Tabel item neraca (aset tetap, kewajiban, modal)
      CREATE TABLE IF NOT EXISTS balance_sheet_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
    currentDbVersion = 5;
  }

  if (currentDbVersion === 5) {
    // Migrasi v6: Buku Kas (cash_ledger), Pembelian Kulakan (purchases & purchase_items),
    // Penyesuaian Stok (stock_adjustments), dan default config Polnes
    await db.execAsync(`
      -- Tabel Buku Kas (Arus Masuk & Keluar: Penerimaan Kas & Pengeluaran Kas/Beban)
      CREATE TABLE IF NOT EXISTS cash_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- 'in' (penerimaan kas) | 'out' (pengeluaran kas/beban)
        category TEXT NOT NULL, -- misal: 'modal_awal', 'setoran_modal', 'pendapatan_lain', 'operasional', 'listrik', 'gaji', 'belanja_bahan', 'kulakan'
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL DEFAULT (date('now','localtime')),
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- Salin pengeluaran yang pernah dicatat di tabel expenses ke cash_ledger
      INSERT INTO cash_ledger (type, category, description, amount, date, created_at)
      SELECT 'out', category, description, amount, expense_date, created_at FROM expenses;

      -- Tabel Pembelian Kulakan Retail
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT NOT NULL,
        supplier_name TEXT NOT NULL DEFAULT 'Umum',
        total_amount REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        cost_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
      );

      -- Tabel Penyesuaian Stok (Stock Opname)
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        system_stock INTEGER NOT NULL,
        physical_stock INTEGER NOT NULL,
        difference INTEGER NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0,
        total_loss REAL NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        adjusted_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );
    `);
    currentDbVersion = 6;
  }

  if (currentDbVersion === 6) {
    // Migrasi v7: Customers, Suppliers, Piutang, Hutang, Payment type pembelian/transaksi, Setting QRIS & Orientasi
    await db.execAsync(`
      -- Tabel Customer
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- Tabel Piutang Customer (Customer Receivables)
      CREATE TABLE IF NOT EXISTS customer_receivables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        transaction_id INTEGER,
        total_amount REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid' | 'partial' | 'paid'
        due_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
      );

      -- Tabel Pembayaran / Pelunasan Piutang Customer
      CREATE TABLE IF NOT EXISTS receivable_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receivable_id INTEGER NOT NULL,
        payment_date TEXT NOT NULL DEFAULT (date('now','localtime')),
        amount REAL NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (receivable_id) REFERENCES customer_receivables(id) ON DELETE CASCADE
      );

      -- Tabel Supplier
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- Tabel Hutang Supplier (Supplier Debts)
      CREATE TABLE IF NOT EXISTS supplier_debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        purchase_id INTEGER,
        total_amount REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid' | 'partial' | 'paid'
        due_date TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
      );

      -- Tabel Pembayaran / Pelunasan Hutang Supplier
      CREATE TABLE IF NOT EXISTS debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        payment_date TEXT NOT NULL DEFAULT (date('now','localtime')),
        amount REAL NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (debt_id) REFERENCES supplier_debts(id) ON DELETE CASCADE
      );

      -- Kolom Tambahan pada purchases: payment_type ('tunai' | 'kredit'), supplier_id
      ALTER TABLE purchases ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'tunai';
      ALTER TABLE purchases ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;

      -- Kolom Tambahan pada transactions: customer_id, is_credit
      ALTER TABLE transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
      ALTER TABLE transactions ADD COLUMN is_credit INTEGER NOT NULL DEFAULT 0;
    `);
    currentDbVersion = 7;
  }

  if (currentDbVersion === 7) {
    // Migrasi v8: Tambah kolom barcode pada products
    await db.execAsync(`
      ALTER TABLE products ADD COLUMN barcode TEXT NOT NULL DEFAULT '';
    `);
    currentDbVersion = 8;
  }

  if (currentDbVersion === 8) {
    // Migrasi v9: Tambah tabel pending_orders (Fitur Tahan / Pending Transaksi)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note TEXT NOT NULL DEFAULT '',
        total_amount REAL NOT NULL,
        items_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
    currentDbVersion = 9;
  }

  if (currentDbVersion === 9) {
    // Migrasi v10: Indeks performa tinggi untuk ribuan produk & transaksi
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
      CREATE INDEX IF NOT EXISTS idx_transaction_items_txid ON transaction_items(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_cash_ledger_date ON cash_ledger(date);
    `);
    currentDbVersion = 10;
  }

  if (currentDbVersion === 10) {
    // Migrasi v11: Multi-barcode, Weighted products (timbangan), Expired date, Termin kredit, Sumber kas pembelian
    await db.execAsync(`
      ALTER TABLE products ADD COLUMN barcodes TEXT NOT NULL DEFAULT '';
      ALTER TABLE products ADD COLUMN is_weighted INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN expired_date TEXT DEFAULT NULL;

      ALTER TABLE purchases ADD COLUMN due_date TEXT DEFAULT NULL;
      ALTER TABLE purchases ADD COLUMN payment_source TEXT NOT NULL DEFAULT 'toko';

      ALTER TABLE transaction_items ADD COLUMN weight_gram INTEGER DEFAULT NULL;
      ALTER TABLE transaction_items ADD COLUMN price_per_kg REAL DEFAULT NULL;
    `);
    currentDbVersion = 11;
  }

  if (currentDbVersion === 11) {
    // Migrasi v12: Tabel cash_shifts (Rekonsiliasi Shift Kasir / Z-Report), Diskon Transaksi
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cash_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashier_name TEXT NOT NULL,
        opened_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        closed_at TEXT DEFAULT NULL,
        starting_cash REAL NOT NULL DEFAULT 0,
        expected_cash REAL NOT NULL DEFAULT 0,
        actual_cash REAL DEFAULT NULL,
        difference REAL DEFAULT NULL,
        total_sales_cash REAL NOT NULL DEFAULT 0,
        total_sales_non_cash REAL NOT NULL DEFAULT 0,
        total_transactions INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open' -- 'open' | 'closed'
      );

      ALTER TABLE transactions ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;
      ALTER TABLE transactions ADD COLUMN subtotal_amount REAL NOT NULL DEFAULT 0;
    `);
    currentDbVersion = 12;
  }

  if (currentDbVersion === 12) {
    // Migrasi v13: Dual-Account Cash (Kas di Tangan vs Kas di Bank)
    await db.execAsync(`
      ALTER TABLE cash_ledger ADD COLUMN account TEXT NOT NULL DEFAULT 'hand';
      ALTER TABLE debt_payments ADD COLUMN payment_source TEXT NOT NULL DEFAULT 'hand';
      ALTER TABLE receivable_payments ADD COLUMN payment_source TEXT NOT NULL DEFAULT 'hand';
    `);
    currentDbVersion = 13;
  }

  if (currentDbVersion === 13) {
    // Migrasi v14: Operator Kasir & Shift ID pada Transaksi
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN cashier_name TEXT NOT NULL DEFAULT 'Kasir';
      ALTER TABLE transactions ADD COLUMN shift_id INTEGER DEFAULT NULL;
    `);
    currentDbVersion = 14;
  }

  if (currentDbVersion === 14) {
    // Migrasi v15: Pajak / Biaya Tambahan (Tax / Surcharge) pada transaksi
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0;
      ALTER TABLE transactions ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0;
      ALTER TABLE transactions ADD COLUMN tax_type TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE transactions ADD COLUMN tax_name TEXT NOT NULL DEFAULT 'Pajak / PB1';
    `);
    currentDbVersion = 15;
  }

  if (currentDbVersion === 15) {
    // Migrasi v16: Split Payment (cash_received + qris_received) & Daily Nota Counter
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN cash_received REAL NOT NULL DEFAULT 0;
      ALTER TABLE transactions ADD COLUMN qris_received REAL NOT NULL DEFAULT 0;
      ALTER TABLE transactions ADD COLUMN daily_seq INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS daily_counters (
        date TEXT PRIMARY KEY,
        last_seq INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
    currentDbVersion = 16;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export async function resetEntireDatabase(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
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
      DELETE FROM daily_counters;
      DELETE FROM sqlite_sequence;
    `);
  });
}

/**
 * Reset data transaksi, buku kas, shift kasir, dan hutang/piutang ke nol (Buku Baru).
 * Mempertahankan 100% data master produk, kategori, kontak pelanggan/supplier, dan pengaturan toko.
 */
export async function resetFinancialAndCashFlowData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM cash_shifts;
      DELETE FROM pending_orders;
      DELETE FROM transaction_items;
      DELETE FROM transactions;
      DELETE FROM cash_ledger;
      DELETE FROM expenses;
      DELETE FROM balance_sheet_items;
      DELETE FROM receivable_payments;
      DELETE FROM customer_receivables;
      DELETE FROM debt_payments;
      DELETE FROM supplier_debts;
      DELETE FROM daily_counters;
      DELETE FROM settings WHERE key IN ('cash_denominations', 'active_shift');
      DELETE FROM sqlite_sequence WHERE name IN (
        'cash_shifts',
        'pending_orders',
        'transaction_items',
        'transactions',
        'cash_ledger',
        'expenses',
        'balance_sheet_items',
        'receivable_payments',
        'customer_receivables',
        'debt_payments',
        'supplier_debts',
        'daily_counters'
      );
    `);
  });
}


