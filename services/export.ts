import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import type { SQLiteDatabase } from '@/services/database';

function escapeCSV(val: string | number): string {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatInvoice(id: number): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `INV-${dd}${mm}${yy}-${String(id).padStart(3, '0')}`;
}

export async function shareFile(fileUri: string, mimeType: string = 'text/csv'): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Fitur berbagi tidak tersedia di perangkat ini');
  }
  await Sharing.shareAsync(fileUri, { mimeType });
}

export async function exportTransactionsToCSV(
  db: SQLiteDatabase,
  startDate?: string,
  endDate?: string
): Promise<string> {
  let whereClause = '';
  const params: any[] = [];

  if (startDate && endDate) {
    whereClause = 'WHERE date(t.created_at) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const rows = await db.getAllAsync<any>(
    `SELECT t.id, t.total, t.payment_method, t.payment_amount, t.change, t.created_at,
            ti.product_name, ti.product_price, ti.quantity, ti.subtotal
     FROM transactions t
     JOIN transaction_items ti ON ti.transaction_id = t.id
     ${whereClause}
     ORDER BY t.created_at DESC`,
    ...params
  );

  if (rows.length === 0) return '';

  const headers = [
    'Tanggal', 'Invoice', 'Produk', 'Qty',
    'Harga Satuan', 'Subtotal', 'Total Transaksi',
    'Metode Bayar', 'Dibayar', 'Kembalian',
  ];

  const csvLines: string[] = [headers.join(',')];
  let currentTransactionId = 0;
  let rowTotal = 0;
  let rowPayMethod = '';
  let rowPayAmount = 0;
  let rowChange = 0;
  let rowDate = '';

  for (const r of rows) {
    if (r.id !== currentTransactionId) {
      currentTransactionId = r.id;
      rowTotal = r.total;
      rowPayMethod = r.payment_method === 'tunai' ? 'Tunai' : 'QRIS';
      rowPayAmount = r.payment_amount;
      rowChange = r.change;
      rowDate = formatDate(new Date(r.created_at));
    }

    const line = [
      escapeCSV(rowDate),
      escapeCSV(formatInvoice(r.id)),
      escapeCSV(r.product_name),
      escapeCSV(r.quantity),
      escapeCSV(r.product_price),
      escapeCSV(r.subtotal),
      escapeCSV(rowTotal),
      escapeCSV(rowPayMethod),
      escapeCSV(rowPayAmount),
      escapeCSV(rowChange),
    ];
    csvLines.push(line.join(','));
  }

  const csv = csvLines.join('\n');
  const filename = `penjualan_${startDate ?? 'semua'}_${endDate ?? ''}.csv`.replace(/[<>:"/\\|?*]/g, '_');
  const file = new File(Paths.cache, filename);
  file.write(csv);
  return file.uri;
}

export async function exportProductsToCSV(db: SQLiteDatabase): Promise<string> {
  const rows = await db.getAllAsync<any>(
    `SELECT p.id, p.name, COALESCE(c.name, 'Umum') as category_name, p.price, p.cost_price, p.stock, p.has_stock 
     FROM products p 
     LEFT JOIN categories c ON p.category_id = c.id 
     ORDER BY p.name ASC`
  );
  if (rows.length === 0) return '';
  const headers = ['ID', 'Nama Produk', 'Kategori', 'Harga Jual', 'HPP Modal', 'Stok', 'Kelola Stok'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      r.id,
      escapeCSV(r.name),
      escapeCSV(r.category_name || 'Umum'),
      r.price,
      r.cost_price,
      r.stock,
      r.has_stock ? 'Ya' : 'Tidak',
    ].join(','));
  }
  const filename = `produk_${new Date().toISOString().slice(0, 10)}.csv`;
  const file = new File(Paths.cache, filename);
  file.write(lines.join('\n'));
  return file.uri;
}

export async function importProductsFromCSV(db: SQLiteDatabase, csvContent: string): Promise<number> {
  const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) throw new Error('File CSV kosong');

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  let count = 0;
  const startIndex = lines[0].toLowerCase().includes('nama') || lines[0].toLowerCase().includes('name') ? 1 : 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (let i = startIndex; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length < 2) continue;

      let name = '';
      let categoryName = 'Umum';
      let price = 0;
      let cost_price = 0;
      let stock = 0;
      let has_stock = 1;

      if (isNaN(Number(cols[0])) && cols.length >= 2) {
        name = cols[0];
        categoryName = cols[1] || 'Umum';
        price = parseFloat(cols[2]?.replace(/[^0-9.]/g, '') || '0') || 0;
        cost_price = parseFloat(cols[3]?.replace(/[^0-9.]/g, '') || '0') || 0;
        stock = parseInt(cols[4]?.replace(/[^0-9-]/g, '') || '0', 10) || 0;
        has_stock = cols[5]?.toLowerCase() === 'tidak' ? 0 : 1;
      } else if (cols.length >= 4) {
        name = cols[1];
        categoryName = cols[2] || 'Umum';
        price = parseFloat(cols[3]?.replace(/[^0-9.]/g, '') || '0') || 0;
        cost_price = parseFloat(cols[4]?.replace(/[^0-9.]/g, '') || '0') || 0;
        stock = parseInt(cols[5]?.replace(/[^0-9-]/g, '') || '0', 10) || 0;
        has_stock = cols[6]?.toLowerCase() === 'tidak' ? 0 : 1;
      }

      if (!name) continue;

      // Cari atau buat kategori di tabel categories
      let categoryId: number | null = null;
      if (categoryName && categoryName.trim()) {
        const catRow = await txn.getFirstAsync<{ id: number }>(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)',
          categoryName.trim()
        );
        if (catRow) {
          categoryId = catRow.id;
        } else {
          const res = await txn.runAsync(
            'INSERT INTO categories (name) VALUES (?)',
            categoryName.trim()
          );
          categoryId = res.lastInsertRowId as number;
        }
      }

      const existing = await txn.getFirstAsync<{ id: number }>(
        'SELECT id FROM products WHERE LOWER(name) = LOWER(?)',
        name
      );

      if (existing) {
        await txn.runAsync(
          'UPDATE products SET category_id = ?, price = ?, cost_price = ?, stock = ?, has_stock = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?',
          categoryId, price, cost_price, stock, has_stock, existing.id
        );
      } else {
        await txn.runAsync(
          'INSERT INTO products (name, category_id, price, cost_price, stock, has_stock) VALUES (?, ?, ?, ?, ?, ?)',
          name, categoryId, price, cost_price, stock, has_stock
        );
      }
      count++;
    }
  });

  return count;
}

export async function exportProductsToPDF(
  db: SQLiteDatabase,
  storeName: string,
  businessType: string
): Promise<string> {
  const rows = await db.getAllAsync<any>(
    `SELECT p.name, COALESCE(c.name, 'Umum') as category_name, p.price, p.cost_price, p.stock, p.has_stock 
     FROM products p 
     LEFT JOIN categories c ON p.category_id = c.id 
     ORDER BY category_name ASC, p.name ASC`
  );
  const nowStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const tableRows = rows.map((p, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${p.name}</strong></td>
      <td>${p.category_name || 'Umum'}</td>
      <td style="text-align: right;">Rp ${Math.round(p.price).toLocaleString('id-ID')}</td>
      <td style="text-align: right;">Rp ${Math.round(p.cost_price).toLocaleString('id-ID')}</td>
      <td style="text-align: center;">${p.has_stock ? p.stock : '∞'}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; margin: 0; }
        .header { text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { margin: 0; font-size: 20px; color: #1e1b4b; }
        .header p { margin: 3px 0 0 0; font-size: 12px; color: #64748b; }
        .badge { display: inline-block; background: #f3e8ff; color: #7c3aed; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 6px; font-weight: bold; text-align: left; }
        td { border: 1px solid #e2e8f0; padding: 6px; }
        tr:nth-child(even) { background-color: #fdfdfd; }
        .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${storeName}</h1>
        <p>${businessType} • DAFTAR PRODUK & STOK</p>
        <span class="badge">Tanggal: ${nowStr} • Total: ${rows.length} Produk</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">No</th>
            <th>Nama Produk</th>
            <th style="width: 80px;">Kategori</th>
            <th style="width: 90px; text-align: right;">Harga Jual</th>
            <th style="width: 90px; text-align: right;">Harga Pokok</th>
            <th style="width: 50px; text-align: center;">Stok</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="footer">
        Dicetak dari POS Karya Riki Rivaldi
      </div>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function exportTransactionsToPDF(
  db: SQLiteDatabase,
  storeName: string,
  startDate?: string,
  endDate?: string
): Promise<string> {
  let whereClause = '';
  const params: any[] = [];
  if (startDate && endDate) {
    whereClause = 'WHERE date(t.created_at) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const rows = await db.getAllAsync<any>(
    `SELECT t.id, t.total, t.payment_method, t.created_at,
            COUNT(ti.id) as item_count
     FROM transactions t
     LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
     ${whereClause}
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    ...params
  );

  const totalOmset = rows.reduce((sum, r) => sum + r.total, 0);

  const tableRows = rows.map((t, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td>INV-${String(t.id).padStart(4, '0')}</td>
      <td>${new Date(t.created_at).toLocaleDateString('id-ID')}</td>
      <td style="text-transform: capitalize;">${t.payment_method}</td>
      <td style="text-align: center;">${t.item_count} item</td>
      <td style="text-align: right;">Rp ${Math.round(t.total).toLocaleString('id-ID')}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; margin: 0; }
        .header { text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { margin: 0; font-size: 20px; color: #1e1b4b; }
        .header p { margin: 3px 0 0 0; font-size: 12px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
        th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 6px; font-weight: bold; text-align: left; }
        td { border: 1px solid #e2e8f0; padding: 6px; }
        .total-card { background: #f3e8ff; padding: 10px; border-radius: 8px; margin-top: 12px; text-align: right; font-weight: bold; font-size: 13px; color: #6b21a8; }
        .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${storeName}</h1>
        <p>REKAP TRANSAKSI PENJUALAN</p>
        <p>${startDate && endDate ? `Periode: ${startDate} s/d ${endDate}` : 'Semua Transaksi'}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">No</th>
            <th>Invoice</th>
            <th>Tanggal</th>
            <th>Metode</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="total-card">
        Total Omset (${rows.length} Transaksi): Rp ${Math.round(totalOmset).toLocaleString('id-ID')}
      </div>
      <div class="footer">
        POS Karya Riki Rivaldi
      </div>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  gaji_karyawan: 'Gaji Karyawan',
  sewa_tempat: 'Sewa Tempat / Kios',
  listrik_air: 'Listrik, Air & Internet',
  transportasi: 'Transportasi & Logistik',
  kemasan_plastik: 'Kemasan & Plastik',
  perawatan: 'Perawatan & Servis Alat',
  belanja_bahan: 'Bahan Baku (Kuliner)',
  kulakan_stok: 'Pembelian Stok Barang',
  'lain-lain': 'Beban Lain-lain',
  // Legacy aliases
  gaji: 'Gaji & Upah',
  sewa: 'Sewa Tempat',
  listrik: 'Listrik & Air',
  bahan_baku: 'Bahan Baku',
};

export async function exportLabaRugiToPDF(params: {
  storeName: string;
  businessType: string;
  storeAddress?: string;
  storePhone?: string;
  data: any;
}): Promise<string> {
  const { storeName, storeAddress, storePhone, data } = params;
  const nowStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const fmt = (n: number) => {
    const s = n < 0 ? '- ' : '';
    return s + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
  };

  const bebanRows = data.bebanByCategory?.map((b: any) => `
    <tr>
      <td style="padding-left: 20px;">${EXPENSE_CATEGORY_LABELS[b.category] || b.category.replace(/_/g, ' ')}</td>
      <td style="text-align: right;">${fmt(b.total)}</td>
    </tr>
  `).join('') || '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; padding: 28px; margin: 0; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
        .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; color: #0f172a; }
        .header h2 { margin: 4px 0; font-size: 15px; color: #334155; }
        .header p { margin: 2px 0; font-size: 11px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
        th { background-color: #f1f5f9; padding: 8px 10px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: left; }
        td { padding: 6px 10px; }
        .section-header td { font-weight: bold; background: #f8fafc; padding-top: 10px; }
        .total-row td { font-weight: bold; border-top: 1px dashed #cbd5e1; border-bottom: 1px solid #0f172a; }
        .laba-bersih { background-color: ${data.labaOperasional >= 0 ? '#f0fdf4' : '#fef2f2'}; }
        .laba-bersih td { font-size: 13px; font-weight: bold; color: ${data.labaOperasional >= 0 ? '#15803d' : '#b91c1c'}; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 10px; }
        .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${storeName}</h1>
        ${storeAddress ? `<p>${storeAddress}</p>` : ''}
        ${storePhone ? `<p>Telp / WA: ${storePhone}</p>` : ''}
        <h2>LAPORAN LABA / RUGI</h2>
        <p>Periode: <strong>${data.periodeLabel}</strong> • Standar SAK EMKM</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>KETERANGAN</th>
            <th style="width: 140px; text-align: right;">NILAI</th>
          </tr>
        </thead>
        <tbody>
          <tr class="section-header">
            <td colspan="2">PENDAPATAN USAHA</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">Penjualan Bersih (${data.jumlahTransaksi} transaksi)</td>
            <td style="text-align: right;">${fmt(data.penjualanBruto)}</td>
          </tr>
          <tr class="total-row">
            <td>Total Pendapatan</td>
            <td style="text-align: right;">${fmt(data.penjualanBruto)}</td>
          </tr>

          <tr class="section-header">
            <td colspan="2">HARGA POKOK PENJUALAN (HPP)</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">Harga Pokok Barang Terjual</td>
            <td style="text-align: right;">${fmt(data.hpp)}</td>
          </tr>
          <tr class="total-row">
            <td>Total HPP</td>
            <td style="text-align: right;">${fmt(data.hpp)}</td>
          </tr>

          <tr style="background: #f8fafc;">
            <td style="font-weight: bold; padding: 8px 10px;">LABA KOTOR</td>
            <td style="text-align: right; font-weight: bold; padding: 8px 10px;">${fmt(data.labaKotor)}</td>
          </tr>

          <tr class="section-header">
            <td colspan="2">BEBAN OPERASIONAL</td>
          </tr>
          ${bebanRows || '<tr><td style="padding-left: 20px; color: #94a3b8;">Tidak ada beban</td><td style="text-align: right;">Rp 0</td></tr>'}
          <tr class="total-row">
            <td>Total Beban Operasional</td>
            <td style="text-align: right;">${fmt(data.totalBeban)}</td>
          </tr>

          ${(data.pendapatanLain && data.pendapatanLain > 0) ? `
          <tr class="section-header">
            <td colspan="2">PENDAPATAN LAIN-LAIN (NON-OPERASIONAL)</td>
          </tr>
          <tr>
            <td style="padding-left: 20px;">Pendapatan Lain-lain</td>
            <td style="text-align: right;">${fmt(data.pendapatanLain)}</td>
          </tr>
          <tr class="total-row">
            <td>Total Pendapatan Lain-lain</td>
            <td style="text-align: right;">${fmt(data.pendapatanLain)}</td>
          </tr>
          ` : ''}

          <tr class="laba-bersih">
            <td>${(data.labaBersih !== undefined ? data.labaBersih : data.labaOperasional) >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}</td>
            <td style="text-align: right;">${fmt(data.labaBersih !== undefined ? data.labaBersih : data.labaOperasional)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        Laporan Keuangan • POS Karya Riki Rivaldi<br/>
        Dicetak pada: ${nowStr}
      </div>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function exportCashLedgerToPDF(params: {
  db: SQLiteDatabase;
  type: 'in' | 'out';
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  startDate?: string;
  endDate?: string;
}): Promise<string> {
  const { db, type, storeName, storeAddress, storePhone, startDate, endDate } = params;
  let whereClause = 'WHERE type = ?';
  const queryParams: any[] = [type];

  if (startDate && endDate) {
    whereClause += ' AND date(date) BETWEEN ? AND ?';
    queryParams.push(startDate, endDate);
  }

  const rows = await db.getAllAsync<{
    id: number;
    type: string;
    category: string;
    description: string;
    amount: number;
    date: string;
    created_at: string;
  }>(
    `SELECT id, type, category, description, amount, date, created_at
     FROM cash_ledger
     ${whereClause}
     ORDER BY date DESC, id DESC`,
    ...queryParams
  );

  const total = rows.reduce((acc, r) => acc + (r.amount || 0), 0);
  const isCashIn = type === 'in';
  const reportTitle = isCashIn ? 'LAPORAN PENERIMAAN KAS' : 'LAPORAN PENGELUARAN KAS & BEBAN';

  const fmt = (n: number) => 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
  const nowStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const tableRows = rows.map((r, i) => `
    <tr>
      <td style="text-align: center;">${i + 1}</td>
      <td>${r.date}</td>
      <td><strong>${r.category.replace(/_/g, ' ').toUpperCase()}</strong></td>
      <td>${r.description}</td>
      <td style="text-align: right; color: ${isCashIn ? '#15803d' : '#b91c1c'}; font-weight: 600;">
        ${fmt(r.amount)}
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 16px;">Belum ada catatan mutasi kas pada periode ini.</td></tr>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; padding: 28px; margin: 0; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
        .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; color: #0f172a; }
        .header h2 { margin: 4px 0; font-size: 15px; color: ${isCashIn ? '#15803d' : '#b91c1c'}; }
        .header p { margin: 2px 0; font-size: 11px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
        th { background-color: #f1f5f9; padding: 8px 10px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
        .total-row td { font-size: 13px; font-weight: bold; background-color: ${isCashIn ? '#f0fdf4' : '#fef2f2'}; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 10px; }
        .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${storeName}</h1>
        ${storeAddress ? `<p>${storeAddress}</p>` : ''}
        ${storePhone ? `<p>Telp / WA: ${storePhone}</p>` : ''}
        <h2>${reportTitle}</h2>
        <p>Periode: <strong>${startDate && endDate ? `${startDate} s/d ${endDate}` : 'Semua Riwayat'}</strong> • Standar SAK EMKM</p>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">NO</th>
            <th style="width: 85px;">TANGGAL</th>
            <th style="width: 140px;">KATEGORI</th>
            <th>KETERANGAN</th>
            <th style="width: 120px; text-align: right;">NOMINAL</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="total-row">
            <td colspan="4" style="text-align: right;">TOTAL ${isCashIn ? 'PENERIMAAN KAS' : 'PENGELUARAN KAS'}:</td>
            <td style="text-align: right; color: ${isCashIn ? '#15803d' : '#b91c1c'};">${fmt(total)}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        Laporan Keuangan • POS Karya Riki Rivaldi<br/>
        Dicetak pada: ${nowStr}
      </div>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function deleteTransactions(
  db: SQLiteDatabase,
  startDate?: string,
  endDate?: string
): Promise<number> {
  let whereClause = '';
  const params: any[] = [];

  if (startDate && endDate) {
    whereClause = 'WHERE date(created_at) BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  const countResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
    ...params
  );

  const count = countResult?.count ?? 0;
  if (count === 0) return 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    if (startDate && endDate) {
      const txnRows = await txn.getAllAsync<{ id: number }>(
        `SELECT id FROM transactions ${whereClause}`,
        ...params
      );
      for (const t of txnRows) {
        await txn.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', t.id);
        await txn.runAsync('DELETE FROM transactions WHERE id = ?', t.id);
      }
    } else {
      await txn.runAsync('DELETE FROM transaction_items');
      await txn.runAsync('DELETE FROM transactions');
    }
  });

  return count;
}