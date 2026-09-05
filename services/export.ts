import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from '@/services/database';

interface ExportRow {
  tanggal: string;
  invoice: string;
  produk: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
  total: number;
  metode_bayar: string;
  dibayar: number;
  kembalian: number;
}

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

export async function shareFile(fileUri: string, mimeType: string = 'text/csv'): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing tidak tersedia di perangkat ini');
  }
  await Sharing.shareAsync(fileUri, { mimeType });
}

// ─────────────────────────────────────────
// Laporan Keuangan Export
// ─────────────────────────────────────────

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  gaji: 'Gaji & Upah',
  sewa: 'Sewa Tempat',
  listrik: 'Listrik & Air',
  transportasi: 'Transportasi',
  bahan_baku: 'Bahan Baku',
  'lain-lain': 'Lain-lain',
};

export async function exportFinancialReport(db: SQLiteDatabase, params: any): Promise<string> {
  const { type, storeName, businessType } = params;
  let csvLines: string[] = [];
  let filename = '';

  if (type === 'labarugi') {
    const { data, filterMode, month, year } = params;
    const periode = filterMode === 'month'
      ? `${MONTH_NAMES[month - 1]} ${year}`
      : `Tahun ${year}`;

    filename = `laporan_labarugi_${filterMode === 'month' ? `${String(month).padStart(2,'0')}_${year}` : year}.csv`;

    csvLines = [
      `LAPORAN LABA / RUGI`,
      `Nama Usaha,${escapeCSV(storeName)}`,
      `Jenis Usaha,${escapeCSV(businessType)}`,
      `Periode,${escapeCSV(periode)}`,
      `Standar,SAK EMKM`,
      `Jumlah Transaksi,${data.jumlahTransaksi}`,
      '',
      'KETERANGAN,NILAI (Rp)',
      'A. PENDAPATAN,',
      `Penjualan Bersih,${Math.round(data.penjualanBruto)}`,
      `Total Pendapatan,${Math.round(data.penjualanBruto)}`,
      '',
      'B. HARGA POKOK PENJUALAN,',
      `Harga Pokok Barang Terjual,${Math.round(data.hpp)}`,
      `Total HPP,${Math.round(data.hpp)}`,
      '',
      `LABA KOTOR (A - B),${Math.round(data.labaKotor)}`,
      '',
      'C. BEBAN OPERASIONAL,',
      ...data.bebanByCategory.map((b: any) => {
        const label = EXPENSE_CATEGORY_LABELS[b.category] ?? b.category;
        return `${escapeCSV(label)},${Math.round(b.total)}`;
      }),
      `Total Beban Operasional,${Math.round(data.totalBeban)}`,
      '',
      `LABA BERSIH,${Math.round(data.labaOperasional)}`,
    ];
  } else if (type === 'neraca') {
    const { neracaData, items } = params;
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    filename = `laporan_neraca_${new Date().toISOString().slice(0, 10)}.csv`;

    const asetTetapItems = items.filter((i: any) => i.section === 'aset_tetap');
    const kewajibanItems = items.filter((i: any) => i.section === 'kewajiban');
    const modalItems = items.filter((i: any) => i.section === 'modal');

    csvLines = [
      `LAPORAN POSISI KEUANGAN (NERACA)`,
      `Nama Usaha,${escapeCSV(storeName)}`,
      `Jenis Usaha,${escapeCSV(businessType)}`,
      `Per Tanggal,${escapeCSV(today)}`,
      `Standar,SAK EMKM`,
      '',
      'ASET,NILAI (Rp)',
      'Aset Lancar,',
      `   Kas & Setara Kas (Est.),${Math.round(neracaData.asetLancar.kas)}`,
      `   Persediaan Barang,${Math.round(neracaData.asetLancar.persediaan)}`,
      `Total Aset Lancar,${Math.round(neracaData.asetLancar.kas + neracaData.asetLancar.persediaan)}`,
      '',
      'Aset Tetap,',
      ...asetTetapItems.map((i: any) => `   ${escapeCSV(i.name)},${Math.round(i.amount)}`),
      `Total Aset Tetap,${Math.round(neracaData.totalAsetTetap)}`,
      '',
      `TOTAL ASET,${Math.round(neracaData.totalAset)}`,
      '',
      'KEWAJIBAN & EKUITAS,NILAI (Rp)',
      'Kewajiban,',
      ...kewajibanItems.map((i: any) => `   ${escapeCSV(i.name)},${Math.round(i.amount)}`),
      `Total Kewajiban,${Math.round(neracaData.totalKewajiban)}`,
      '',
      'Ekuitas / Modal,',
      ...modalItems.map((i: any) => `   ${escapeCSV(i.name)},${Math.round(i.amount)}`),
      `   Laba Ditahan (Est.),${Math.round(neracaData.labaYangDitahan)}`,
      `Total Ekuitas,${Math.round(neracaData.totalModal + neracaData.labaYangDitahan)}`,
      '',
      `TOTAL KEWAJIBAN + EKUITAS,${Math.round(neracaData.totalKewajibanEkuitas)}`,
    ];
  }

  const csv = csvLines.join('\n');
  const file = new File(Paths.cache, filename.replace(/[<>:"/\\|?*]/g, '_'));
  file.write(csv);
  return file.uri;
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