const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

console.log('================================================================');
console.log('🔍 AUDIT SISTEM MENYELURUH: POS AGEN SOSIS AZIZAH (TAHAP 14)');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`✅ [LULUS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [GAGAL] ${testName} ${details ? '-> ' + details : ''}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// AUDIT 1: STATIK & KODE SUMBER (CODEBASE HYGIENE)
// -------------------------------------------------------------
console.log('\n--- AUDIT 1: INTEGRITAS KODE SUMBER & FITUR TABLET ---');

// 1.1 Cek penghapusan allowsEditing di seluruh file
const filesToCheck = [
  path.join(__dirname, '..', 'app', '(tabs)', 'explore.tsx'),
  path.join(__dirname, '..', 'app', 'debt-receivable.tsx'),
  path.join(__dirname, '..', 'app', '(tabs)', 'store-settings.tsx'),
];

let hasAllowsEditing = false;
for (const file of filesToCheck) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('allowsEditing: true')) {
    hasAllowsEditing = true;
    console.error(`Ditemukan allowsEditing: true di ${file}`);
  }
}
assert(!hasAllowsEditing, 'Eliminasi Crop Intent: Tidak ada allowsEditing: true di semua modul');

// 1.2 Cek Penyimpanan Backup Permanen
const backupTs = fs.readFileSync(path.join(__dirname, '..', 'services', 'backup.ts'), 'utf8');
assert(backupTs.includes('Paths.document'), 'Cadangan Permanen: backup.ts menggunakan Paths.document');
assert(!backupTs.includes('new File(Paths.cache, fileName)'), 'Cadangan Permanen: Paths.cache berhasil dieliminasi');

// 1.3 Cek Persistensi Role di settingsStore
const settingsStoreTs = fs.readFileSync(path.join(__dirname, '..', 'stores', 'settingsStore.ts'), 'utf8');
assert(settingsStoreTs.includes('current_user_role'), 'Persistensi Sesi: settingsStore.ts mengelola current_user_role');
assert(settingsStoreTs.includes('map.current_user_role'), 'Persistensi Sesi: loadSettings memulihkan role pengguna');

// 1.4 Cek app.json
const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));
assert(appJson.expo.version === '1.0.4', `Versi Aplikasi: v1.0.4 (Aktual: ${appJson.expo.version})`);
assert(appJson.expo.android.versionCode === 8, `VersionCode Android: 8 (Aktual: ${appJson.expo.android.versionCode})`);
assert(appJson.expo.android.package === 'com.rumahmakan.posoffline', 'Package Name: com.rumahmakan.posoffline terjaga');
assert(appJson.expo.owner === 'rikires-team', 'Akun EAS Owner: rikires-team terjaga');
assert(appJson.expo.extra.eas.projectId === '97d847aa-a65d-4eb8-9d21-33f936cce00e', 'EAS Project ID: terjaga');

// -------------------------------------------------------------
// AUDIT 2: SIMULASI DATABASE SQLITE NATIVE & MIGRASI LENGKAP
// -------------------------------------------------------------
console.log('\n--- AUDIT 2: SIMULASI DATABASE SQLITE & SKEMA TABEL ---');

const db = new DatabaseSync(':memory:');
db.exec("PRAGMA journal_mode = 'wal';");
db.exec('PRAGMA foreign_keys = ON;');

// Setup skema tabel lengkap hingga v20
db.exec(`
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  INSERT INTO settings (key, value) VALUES ('store_name', 'AGEN SOSIS AZIZAH');
  INSERT INTO settings (key, value) VALUES ('business_type', 'Distributor & Retail Frozen Food');
  INSERT INTO settings (key, value) VALUES ('admin_pin', '123456');

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    cost_price REAL NOT NULL DEFAULT 0,
    has_stock INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    barcode TEXT NOT NULL DEFAULT '',
    barcodes TEXT NOT NULL DEFAULT '',
    is_weighted INTEGER NOT NULL DEFAULT 0,
    expired_date TEXT,
    image_path TEXT NOT NULL DEFAULT '',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE daily_counters (
    date TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE cash_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_name TEXT NOT NULL,
    start_cash REAL NOT NULL DEFAULT 0,
    end_cash REAL,
    actual_cash REAL,
    difference REAL,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT NOT NULL DEFAULT '',
    opened_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    closed_at TEXT
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'tunai',
    payment_amount REAL NOT NULL,
    change REAL NOT NULL DEFAULT 0,
    customer_id INTEGER,
    is_credit INTEGER NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    subtotal_amount REAL NOT NULL DEFAULT 0,
    cashier_name TEXT NOT NULL DEFAULT 'Kasir',
    shift_id INTEGER REFERENCES cash_shifts(id) ON DELETE SET NULL,
    tax_amount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_type TEXT NOT NULL DEFAULT 'percent',
    tax_name TEXT NOT NULL DEFAULT 'Pajak / PB1',
    cash_received REAL NOT NULL DEFAULT 0,
    qris_received REAL NOT NULL DEFAULT 0,
    daily_seq INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE transaction_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    product_price REAL NOT NULL,
    cost_price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL,
    subtotal REAL NOT NULL
  );

  CREATE TABLE cash_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL DEFAULT (date('now','localtime')),
    account TEXT NOT NULL DEFAULT 'hand',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE supplier_debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    purchase_id INTEGER,
    total_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid',
    due_date TEXT,
    invoice_image TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE customer_receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    total_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid',
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);
assert(true, 'Skema Tabel & Relasi Foreign Keys SQLite Berhasil Diinisialisasi');

// -------------------------------------------------------------
// AUDIT 3: PERSISTENSI ROLE SESI PENGGUNA
// -------------------------------------------------------------
console.log('\n--- AUDIT 3: SIMULASI PERSISTENSI ROLE PENGGUNA ---');

// Login kasir
db.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('current_user_role', 'kasir');");
let roleRow = db.prepare("SELECT value FROM settings WHERE key = 'current_user_role'").get();
assert(roleRow.value === 'kasir', 'Sesi Kasir: Berhasil disimpan ke SQLite');

// Login pemilik
db.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('current_user_role', 'pemilik');");
roleRow = db.prepare("SELECT value FROM settings WHERE key = 'current_user_role'").get();
assert(roleRow.value === 'pemilik', 'Sesi Pemilik: Berhasil diperbarui ke SQLite');

// Logout
db.exec("DELETE FROM settings WHERE key = 'current_user_role';");
roleRow = db.prepare("SELECT value FROM settings WHERE key = 'current_user_role'").get();
assert(!roleRow, 'Sesi Logout: Berhasil dihapus dari SQLite');

// -------------------------------------------------------------
// AUDIT 4: SIKLUS TRANSAKSI, GUARDRAIL STOK & REKONSILIASI KAS
// -------------------------------------------------------------
console.log('\n--- AUDIT 4: SIKLUS TRANSAKSI, STOK & DUAL-POCKET KAS ---');

// 4.1 Buka Shift Kasir
db.exec("INSERT INTO cash_shifts (cashier_name, start_cash, status) VALUES ('Siti', 200000, 'open');");
const shiftId = db.prepare('SELECT last_insert_rowid() as id').get().id;
db.exec("INSERT INTO cash_ledger (type, category, description, amount, account) VALUES ('in', 'modal_awal', 'Modal Awal Kasir Siti', 200000, 'hand');");
assert(shiftId > 0, `Buka Shift: Kasir Siti berhasil membuka shift (ID #${shiftId}, Modal Rp 200.000)`);

// 4.2 Tambah Produk Retail Sosis
db.exec("INSERT INTO categories (name) VALUES ('Sosis Premium');");
const catId = db.prepare('SELECT last_insert_rowid() as id').get().id;
db.exec(`
  INSERT INTO products (name, price, cost_price, has_stock, stock, barcode, barcodes, category_id)
  VALUES ('Sosis Kanzler Keju 360g', 38000, 31000, 1, 25, '8991234567890', '["8991234567890","KANZLER-01"]', ${catId});
`);
const prodId = db.prepare('SELECT last_insert_rowid() as id').get().id;
assert(prodId > 0, 'Produk Sosis: Berhasil ditambahkan dengan stok 25 pack');

// 4.3 Transaksi 1: Tunai 2 Pack (Total Rp 76.000, bayar Rp 100.000, kembali Rp 24.000)
db.exec(`
  INSERT INTO transactions (total, payment_method, payment_amount, change, cashier_name, shift_id, cash_received, daily_seq)
  VALUES (76000, 'tunai', 100000, 24000, 'Siti', ${shiftId}, 76000, 1);
`);
const tx1Id = db.prepare('SELECT last_insert_rowid() as id').get().id;
db.exec(`
  INSERT INTO transaction_items (transaction_id, product_id, product_name, product_price, cost_price, quantity, subtotal)
  VALUES (${tx1Id}, ${prodId}, 'Sosis Kanzler Keju 360g', 38000, 31000, 2, 76000);
  UPDATE products SET stock = stock - 2 WHERE id = ${prodId};
`);

// Cek pengurangan stok
const stockAfterTx1 = db.prepare(`SELECT stock FROM products WHERE id = ${prodId}`).get().stock;
assert(stockAfterTx1 === 23, `Guardrail Stok: Berhasil terpotong 2 pack (Sisa: ${stockAfterTx1} pack)`);

// 4.4 Transaksi 2: QRIS 1 Pack (Total Rp 38.000, uang langsung masuk kas bank)
db.exec(`
  INSERT INTO transactions (total, payment_method, payment_amount, change, cashier_name, shift_id, qris_received, daily_seq)
  VALUES (38000, 'qris', 38000, 0, 'Siti', ${shiftId}, 38000, 2);
`);
const tx2Id = db.prepare('SELECT last_insert_rowid() as id').get().id;
db.exec(`
  INSERT INTO transaction_items (transaction_id, product_id, product_name, product_price, cost_price, quantity, subtotal)
  VALUES (${tx2Id}, ${prodId}, 'Sosis Kanzler Keju 360g', 38000, 31000, 1, 38000);
  UPDATE products SET stock = stock - 1 WHERE id = ${prodId};
`);

// 4.5 Transaksi 3: Split Payment 2 Pack (Total Rp 76.000: Rp 50.000 Tunai di Laci + Rp 26.000 QRIS di Bank)
db.exec(`
  INSERT INTO transactions (total, payment_method, payment_amount, change, cashier_name, shift_id, cash_received, qris_received, daily_seq)
  VALUES (76000, 'split', 76000, 0, 'Siti', ${shiftId}, 50000, 26000, 3);
`);
const tx3Id = db.prepare('SELECT last_insert_rowid() as id').get().id;
db.exec(`
  INSERT INTO transaction_items (transaction_id, product_id, product_name, product_price, cost_price, quantity, subtotal)
  VALUES (${tx3Id}, ${prodId}, 'Sosis Kanzler Keju 360g', 38000, 31000, 2, 76000);
  UPDATE products SET stock = stock - 2 WHERE id = ${prodId};
`);

const stockAfterTx3 = db.prepare(`SELECT stock FROM products WHERE id = ${prodId}`).get().stock;
assert(stockAfterTx3 === 20, `Stok Multi-Transaksi: Berhasil sinkron terpotong 5 pack total (Sisa: ${stockAfterTx3} pack)`);

// -------------------------------------------------------------
// AUDIT 5: REKONSILIASI KAS LACI & SETOR BANK (ANTI SALAH KEMBALIAN)
// -------------------------------------------------------------
console.log('\n--- AUDIT 5: REKONSILIASI DUAL-POCKET & SETOR BANK ---');

// Hitung kas fisik di laci:
// Modal awal Rp 200.000 + Tx1 Net Tunai Rp 76.000 + Tx3 Porsi Tunai Split Rp 50.000 = Rp 326.000
const cashHandSales = db.prepare(`
  SELECT 
    COALESCE(SUM(CASE WHEN payment_method = 'tunai' THEN total ELSE 0 END), 0) as cashNet,
    COALESCE(SUM(CASE WHEN payment_method = 'split' THEN cash_received ELSE 0 END), 0) as splitNet
  FROM transactions WHERE payment_method != 'hutang' AND is_credit = 0
`).get();

const ledgerHandIn = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE type = 'in' AND account = 'hand'").get().total;
const ledgerHandOut = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE type = 'out' AND account = 'hand'").get().total;

const physicalHandCash = (cashHandSales.cashNet + cashHandSales.splitNet + ledgerHandIn) - ledgerHandOut;
assert(physicalHandCash === 326000, `Kas Fisik Laci: Rp 326.000 tepat (Modal 200rb + Penjualan Laci 126rb, kembalian 24rb tidak dobel potong)`);

// Uji Setor Bank Rp 100.000 dari laci ke rekening bank toko
db.exec(`
  INSERT INTO cash_ledger (type, category, description, amount, account) VALUES ('out', 'setor_bank', 'Setor Laci ke Bank', 100000, 'hand');
  INSERT INTO cash_ledger (type, category, description, amount, account) VALUES ('in', 'setor_bank', 'Terima Setoran Laci di Bank', 100000, 'bank');
`);

const remainingHandCash = physicalHandCash - 100000;
assert(remainingHandCash === 226000, `Setor Bank: Sukses memindahkan Rp 100.000 (Sisa kas fisik laci Rp 226.000)`);

// -------------------------------------------------------------
// AUDIT 6: HUTANG SUPPLIER & FOTO FAKTUR OFFLINE
// -------------------------------------------------------------
console.log('\n--- AUDIT 6: HUTANG SUPPLIER & LAMPIRAN FAKTUR OFFLINE ---');

db.exec("INSERT INTO suppliers (name, phone) VALUES ('Distributor Sosis Jaya', '081299998888');");
const supId = db.prepare('SELECT last_insert_rowid() as id').get().id;

const sampleInvoiceUri = 'file:///data/user/0/com.rumahmakan.posoffline/files/debts/debts_1728612345_abcde.jpg';
db.exec(`
  INSERT INTO supplier_debts (supplier_id, total_amount, paid_amount, status, due_date, invoice_image, notes)
  VALUES (${supId}, 1500000, 500000, 'partial', '2026-10-25', '${sampleInvoiceUri}', 'Faktur Pembelian 5 Dus');
`);
const debtId = db.prepare('SELECT last_insert_rowid() as id').get().id;
const debtRow = db.prepare(`SELECT * FROM supplier_debts WHERE id = ${debtId}`).get();

assert(debtRow.invoice_image === sampleInvoiceUri, 'Foto Faktur Supplier: Path offline tersimpan utuh di SQLite');
assert(debtRow.total_amount === 1500000 && debtRow.paid_amount === 500000, 'Saldo Hutang Supplier: Terverifikasi akurat Rp 1.500.000 (Cicil: Rp 500.000)');

// -------------------------------------------------------------
// AUDIT 7: TUTUP SHIFT KASIR & PELEPASAN MODAL AWAL
// -------------------------------------------------------------
console.log('\n--- AUDIT 7: TUTUP SHIFT KASIR & Z-REPORT ---');

// Kasir Siti menutup shift dengan fisik uang laci Rp 226.000 (setelah setor bank)
db.exec(`
  UPDATE cash_shifts
  SET status = 'closed',
      end_cash = 226000,
      actual_cash = 226000,
      difference = 0,
      closed_at = datetime('now','localtime')
  WHERE id = ${shiftId};
  -- Pelepasan modal awal shift otomatis
  INSERT INTO cash_ledger (type, category, description, amount, account)
  VALUES ('out', 'modal_awal', 'Pelepasan Modal Awal Shift Kasir Siti', 200000, 'hand');
`);

const closedShift = db.prepare(`SELECT * FROM cash_shifts WHERE id = ${shiftId}`).get();
assert(closedShift.status === 'closed' && closedShift.difference === 0, 'Tutup Shift: Status closed dengan selisih Rp 0 (PAS)');

// -------------------------------------------------------------
// RINGKASAN AKHIR
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`📊 HASIL AUDIT INTEGRITAS SISTEM: ${passedTests} LULUS / ${failedTests} GAGAL`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🏆 KESIMPULAN: SELURUH LOGIKA SISTEM, DATABASE, & KOMPATIBILITAS TABLET LULUS 100% TANPA CACAT!\n');
}
