import { BluetoothEscposPrinter } from '@vardrz/react-native-bluetooth-escpos-printer';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const W = 32;
const DIVIDER = '='.repeat(W);
const THIN = '-'.repeat(W);

function center(text: string): string {
  const pad = Math.max(0, W - text.length);
  return ' '.repeat(Math.floor(pad / 2)) + text;
}

function formatDate(date: string): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${day} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hours}:${minutes}`;
}

export function formatInvoice(id: number, date?: Date | string, dailySeq?: number): string {
  const d = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yy = d.getFullYear().toString().slice(-2);
  // F3: pakai dailySeq (reset per hari) jika tersedia, fallback ke id global.
  const seq = dailySeq && dailySeq > 0 ? dailySeq : id;
  return `TRX-${dd}${mm}${yy}-${seq.toString().padStart(3, '0')}`;
}

function formatRupiah(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

function wrapText(text: string, maxLen: number = W): string[] {
  if (text.length <= maxLen) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxLen) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      if (word.length > maxLen) {
        lines.push(word.slice(0, maxLen));
        currentLine = word.slice(maxLen);
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function formatTotal(label: string, value: string): string {
  const gap = W - label.length - value.length;
  return label + ' '.repeat(Math.max(1, gap)) + value;
}

function formatItemDetail(item: PrintItem): string {
  let left = '';
  if (item.is_weighted === 1 || (item.weight_gram && item.weight_gram > 0)) {
    const wGram = item.weight_gram || 0;
    const pKg = item.price_per_kg || item.product_price;
    left = `  ${wGram}g @ ${formatRupiah(pKg)}/kg`;
  } else {
    left = `  ${item.quantity} x ${formatRupiah(item.product_price)}`;
  }
  const right = formatRupiah(item.subtotal);
  const gap = W - left.length - right.length;
  if (gap >= 1) {
    return left + ' '.repeat(gap) + right;
  }
  return left + '\n' + ' '.repeat(Math.max(0, W - right.length)) + right;
}

function formatLRRow(label: string, value: number, indent: boolean = false): string {
  const prefix = indent ? '  ' : '';
  const valueStr = formatRupiah(value);
  const available = W - prefix.length - valueStr.length;
  const labelTrimmed = label.length > available ? label.slice(0, available - 1) : label;
  return prefix + labelTrimmed.padEnd(available) + valueStr;
}

export interface PrintItem {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
  is_weighted?: number;
  weight_gram?: number;
  price_per_kg?: number;
}

export interface PrintParams {
  transactionId: number;
  createdAt: string;
  items: PrintItem[];
  total: number;
  paymentMethod: string;
  paymentAmount: number;
  change: number;
  discountAmount?: number;
  subtotalAmount?: number;
  taxAmount?: number;
  taxName?: string;
  taxRate?: number;
  taxType?: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storePhone2?: string;
  cashierName?: string;
  shiftName?: string;
  customerName?: string;
  receiptFooter?: string;
  dailySeq?: number;
  cashReceived?: number;
  qrisReceived?: number;
}

export async function printReceipt(params: PrintParams): Promise<void> {
  const storeName = params.storeName ?? 'POS Offline';

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText(storeName + '\n', {});
  if (params.storeAddress) {
    await BluetoothEscposPrinter.printText(params.storeAddress + '\n', {});
  }
  if (params.storePhone) {
    if (params.storePhone2 && params.storePhone2.trim()) {
      await BluetoothEscposPrinter.printText(`Telp: ${params.storePhone} | WA: ${params.storePhone2}\n`, {});
    } else {
      await BluetoothEscposPrinter.printText('Telp/WA: ' + params.storePhone + '\n', {});
    }
  }
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});
  await BluetoothEscposPrinter.printText(formatInvoice(params.transactionId, new Date(params.createdAt), params.dailySeq) + '\n', {});
  await BluetoothEscposPrinter.printText(formatDate(params.createdAt) + '\n', {});
  if (params.cashierName) {
    await BluetoothEscposPrinter.printText(`Kasir: ${params.cashierName}\n`, {});
  }
  if (params.customerName) {
    await BluetoothEscposPrinter.printText(`Pelanggan: ${params.customerName}\n`, {});
  }

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printText(THIN + '\n', {});

  for (const item of params.items) {
    const wrappedName = wrapText(item.product_name, W);
    for (const nameLine of wrappedName) {
      await BluetoothEscposPrinter.printText(nameLine + '\n', {});
    }
    await BluetoothEscposPrinter.printText(formatItemDetail(item) + '\n', {});
  }

  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  if (params.discountAmount && params.discountAmount > 0) {
    const subtotalCalc = params.subtotalAmount || (params.total + params.discountAmount - (params.taxAmount || 0));
    await BluetoothEscposPrinter.printText(formatTotal('Subtotal', formatRupiah(subtotalCalc)) + '\n', {});
    await BluetoothEscposPrinter.printText(formatTotal('Diskon', '-' + formatRupiah(params.discountAmount)) + '\n', {});
  }
  if (params.taxAmount && params.taxAmount > 0) {
    const taxLabel = params.taxName || 'Pajak / PB1';
    await BluetoothEscposPrinter.printText(formatTotal(taxLabel, '+' + formatRupiah(params.taxAmount)) + '\n', {});
  }
  await BluetoothEscposPrinter.printText(formatTotal('Total', formatRupiah(params.total)) + '\n', {});
  if (params.paymentMethod === 'hutang') {
    await BluetoothEscposPrinter.printText(formatTotal('Metode', 'HUTANG / BON') + '\n', {});
    await BluetoothEscposPrinter.printText(formatTotal('Status', 'BELUM LUNAS') + '\n', {});
  } else {
    const hasSplit =
      (params.cashReceived && params.cashReceived > 0) ||
      (params.qrisReceived && params.qrisReceived > 0);
    if (hasSplit) {
      if (params.cashReceived && params.cashReceived > 0) {
        await BluetoothEscposPrinter.printText(formatTotal('Tunai', formatRupiah(params.cashReceived)) + '\n', {});
      }
      if (params.qrisReceived && params.qrisReceived > 0) {
        await BluetoothEscposPrinter.printText(formatTotal('QRIS/Transfer', formatRupiah(params.qrisReceived)) + '\n', {});
      }
    } else {
      const payLabel = params.paymentMethod === 'tunai' ? 'Tunai' : 'QRIS/Transfer';
      await BluetoothEscposPrinter.printText(formatTotal(payLabel, formatRupiah(params.paymentAmount)) + '\n', {});
    }
    await BluetoothEscposPrinter.printText(formatTotal('Kembalian', formatRupiah(params.change)) + '\n', {});
  }

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});
  await BluetoothEscposPrinter.printText((params.receiptFooter || 'Terima Kasih Atas Kunjungan Anda!') + '\n', {});

  await BluetoothEscposPrinter.printAndFeed(4);
  BluetoothEscposPrinter.cutOnePoint();
}

export interface PrintZReportParams {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storePhone2?: string;
  cashierName: string;
  shiftId: number;
  openedAt: string;
  closedAt: string;
  startingCash: number;
  totalSalesCash: number;
  totalSalesNonCash: number;
  totalTransactions: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  notes?: string;
}

export async function printZReport(params: PrintZReportParams): Promise<void> {
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText(params.storeName + '\n', {});
  if (params.storeAddress) {
    await BluetoothEscposPrinter.printText(params.storeAddress + '\n', {});
  }
  if (params.storePhone) {
    if (params.storePhone2 && params.storePhone2.trim()) {
      await BluetoothEscposPrinter.printText(`Telp: ${params.storePhone} | WA: ${params.storePhone2}\n`, {});
    } else {
      await BluetoothEscposPrinter.printText('Telp: ' + params.storePhone + '\n', {});
    }
  }
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});
  await BluetoothEscposPrinter.printText('LAPORAN PENUTUPAN SHIFT\n', {});
  await BluetoothEscposPrinter.printText('(Z-REPORT KASIR)\n', {});
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printText(formatTotal('Shift ID', `#${params.shiftId}`) + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Kasir', params.cashierName) + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Buka', formatDate(params.openedAt)) + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Tutup', formatDate(params.closedAt)) + '\n', {});
  await BluetoothEscposPrinter.printText(THIN + '\n', {});

  await BluetoothEscposPrinter.printText(formatTotal('Modal Kas Awal', formatRupiah(params.startingCash)) + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Penjualan Tunai (+)', formatRupiah(params.totalSalesCash)) + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Penjualan QRIS', formatRupiah(params.totalSalesNonCash)) + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Total Transaksi', `${params.totalTransactions} nota`) + '\n', {});
  await BluetoothEscposPrinter.printText(THIN + '\n', {});

  await BluetoothEscposPrinter.printText(formatTotal('Kas Diharapkan', formatRupiah(params.expectedCash)) + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Kas Fisik Dihitung', formatRupiah(params.actualCash)) + '\n', {});

  const diffLabel =
    params.difference === 0
      ? 'PAS (Rp 0)'
      : params.difference > 0
      ? `LEBIH (+${formatRupiah(params.difference)})`
      : `KURANG (${formatRupiah(params.difference)})`;
  await BluetoothEscposPrinter.printText(formatTotal('Selisih Kas', diffLabel) + '\n', {});

  if (params.notes && params.notes.trim()) {
    await BluetoothEscposPrinter.printText(THIN + '\n', {});
    await BluetoothEscposPrinter.printText(`Catatan: ${params.notes.trim()}\n`, {});
  }

  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText('Dicetak Otomatis oleh Sistem\n', {});

  await BluetoothEscposPrinter.printAndFeed(4);
  BluetoothEscposPrinter.cutOnePoint();
}

// ─────────────────────────────────────────
// Cetak Laporan Laba/Rugi
// ─────────────────────────────────────────
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  gaji_karyawan: 'Gaji Karyawan',
  sewa_tempat: 'Sewa Tempat / Kios',
  listrik_air: 'Listrik & Air',
  transportasi: 'Transportasi',
  kemasan_plastik: 'Kemasan & Plastik',
  perawatan: 'Perawatan Alat',
  belanja_bahan: 'Bahan Baku',
  kulakan_stok: 'Stok Barang',
  'lain-lain': 'Lain-lain',
  // Legacy aliases
  gaji: 'Gaji & Upah',
  sewa: 'Sewa Tempat',
  listrik: 'Listrik & Air',
  bahan_baku: 'Bahan Baku',
};

export async function printLaporanLabaRugi(params: {
  storeName: string;
  businessType: string;
  data: {
    periodeLabel: string;
    penjualanBruto: number;
    hpp: number;
    labaKotor: number;
    totalBeban: number;
    labaOperasional: number;
    pendapatanLain?: number;
    labaBersih?: number;
    bebanByCategory: { category: string; total: number }[];
    jumlahTransaksi: number;
  };
}): Promise<void> {
  const { storeName, businessType, data } = params;

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText('LAPORAN LABA / RUGI\n', {});
  await BluetoothEscposPrinter.printText(storeName + '\n', {});
  await BluetoothEscposPrinter.printText('Periode: ' + data.periodeLabel + '\n', {});
  await BluetoothEscposPrinter.printText('SAK EMKM\n', {});
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printText('A. PENDAPATAN\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Penjualan Bersih', data.penjualanBruto) + '\n', {});
  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Total Pendapatan', data.penjualanBruto) + '\n', {});
  await BluetoothEscposPrinter.printText('\n', {});

  await BluetoothEscposPrinter.printText('B. HPP\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('HPP Barang Terjual', data.hpp) + '\n', {});
  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Total HPP', data.hpp) + '\n', {});
  await BluetoothEscposPrinter.printText('\n', {});

  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('LABA KOTOR', data.labaKotor) + '\n', {});
  await BluetoothEscposPrinter.printText('\n', {});

  await BluetoothEscposPrinter.printText('C. BEBAN OPERASIONAL\n', {});
  for (const b of data.bebanByCategory) {
    const label = EXPENSE_CATEGORY_LABELS[b.category] ?? b.category.replace(/_/g, ' ');
    await BluetoothEscposPrinter.printText(formatLRRow(label, b.total, true) + '\n', {});
  }
  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Total Beban', data.totalBeban) + '\n', {});
  await BluetoothEscposPrinter.printText('\n', {});

  if (data.pendapatanLain && data.pendapatanLain > 0) {
    await BluetoothEscposPrinter.printText('D. PENDAPATAN LAIN-LAIN\n', {});
    await BluetoothEscposPrinter.printText(formatLRRow('Pendapatan Lain', data.pendapatanLain) + '\n', {});
    await BluetoothEscposPrinter.printText('\n', {});
  }

  const finalLaba = data.labaBersih !== undefined ? data.labaBersih : data.labaOperasional;
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('LABA BERSIH', finalLaba) + '\n', {});
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});

  await BluetoothEscposPrinter.printAndFeed(4);
  BluetoothEscposPrinter.cutOnePoint();
}

export async function printBankDepositReceipt(params: {
  storeName: string;
  depositAmount: number;
  remainingCash: number;
  bankTarget: string;
  notes?: string;
  cashierName?: string;
  date?: Date;
}): Promise<void> {
  const {
    storeName,
    depositAmount,
    remainingCash,
    bankTarget,
    notes,
    cashierName = 'Kasir',
    date = new Date(),
  } = params;

  const dateStr = date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText(storeName.toUpperCase() + '\n', {});
  await BluetoothEscposPrinter.printText('BUKTI SETORAN KAS LACI\n', {});
  await BluetoothEscposPrinter.printText(`${dateStr} ${timeStr}\n`, {});
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printColumn(
    [14, 18],
    [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
    ['Petugas/Kasir', cashierName],
    {}
  );
  await BluetoothEscposPrinter.printColumn(
    [14, 18],
    [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
    ['Tujuan Setor', bankTarget],
    {}
  );

  if (notes) {
    await BluetoothEscposPrinter.printColumn(
      [14, 18],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['Keterangan', notes],
      {}
    );
  }

  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printColumn(
    [14, 18],
    [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
    ['NOMINAL SETOR', 'Rp ' + depositAmount.toLocaleString('id-ID')],
    {}
  );
  await BluetoothEscposPrinter.printColumn(
    [14, 18],
    [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
    ['Sisa Kas Laci', 'Rp ' + remainingCash.toLocaleString('id-ID')],
    {}
  );
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText('Tanda Tangan Serah Terima:\n\n\n\n', {});
  await BluetoothEscposPrinter.printColumn(
    [16, 16],
    [BluetoothEscposPrinter.ALIGN.CENTER, BluetoothEscposPrinter.ALIGN.CENTER],
    ['( ____________ )', '( ____________ )'],
    {}
  );
  await BluetoothEscposPrinter.printColumn(
    [16, 16],
    [BluetoothEscposPrinter.ALIGN.CENTER, BluetoothEscposPrinter.ALIGN.CENTER],
    ['Penyetor / Kasir', 'Penerima / Owner'],
    {}
  );

  await BluetoothEscposPrinter.printText('\nSimpan bukti ini sebagai arsip mutasi kas.\n', {});
  await BluetoothEscposPrinter.printAndFeed(4);
  BluetoothEscposPrinter.cutOnePoint();
}



