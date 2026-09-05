import * as SQLite from 'expo-sqlite';

export type SQLiteDatabase = SQLite.SQLiteDatabase;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 6;
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
    INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_footer', 'Terima kasih atas kunjungan Anda!');
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

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
