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

function formatInvoice(id: number): string {
  const d = new Date();
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yy = d.getFullYear().toString().slice(-2);
  return `INV-${dd}${mm}${yy}-${id.toString().padStart(3, '0')}`;
}

function formatRupiah(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

function formatItemLine(name: string, qty: number): string {
  const label = name.length > 22 ? name.slice(0, 20) + '..' : name;
  const qtyStr = qty.toString() + 'x';
  return label.padEnd(24) + qtyStr.padStart(6);
}

function formatPriceLine(price: number, subtotal: number): string {
  const left = formatRupiah(price);
  const right = formatRupiah(subtotal);
  const gap = W - left.length - right.length;
  return '  ' + left + ' '.repeat(Math.max(1, gap - 2)) + right;
}

function formatTotal(label: string, value: string): string {
  const gap = W - label.length - value.length;
  return label + ' '.repeat(Math.max(1, gap)) + value;
}

function formatLRRow(label: string, value: number, indent: boolean = false): string {
  const prefix = indent ? '  ' : '';
  const valueStr = formatRupiah(value);
  const available = W - prefix.length - valueStr.length;
  const labelTrimmed = label.length > available ? label.slice(0, available - 1) : label;
  return prefix + labelTrimmed.padEnd(available) + valueStr;
}

interface PrintItem {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface PrintParams {
  transactionId: number;
  createdAt: string;
  items: PrintItem[];
  total: number;
  paymentMethod: string;
  paymentAmount: number;
  change: number;
  storeName?: string;
  storeAddress?: string;
}

export async function printReceipt(params: PrintParams): Promise<void> {
  const storeName = params.storeName ?? 'POS Offline';
  const storeAddress = params.storeAddress ?? 'Toko';

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText(storeName + '\n', {});
  await BluetoothEscposPrinter.printText(storeAddress + '\n', {});
  await BluetoothEscposPrinter.printText('\n', {});
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});
  await BluetoothEscposPrinter.printText(formatInvoice(params.transactionId) + '\n', {});
  await BluetoothEscposPrinter.printText(formatDate(params.createdAt) + '\n', {});

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printText(THIN + '\n', {});

  for (const item of params.items) {
    await BluetoothEscposPrinter.printText(formatItemLine(item.product_name, item.quantity) + '\n', {});
    await BluetoothEscposPrinter.printText(formatPriceLine(item.product_price, item.subtotal) + '\n', {});
  }

  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Total', formatRupiah(params.total)) + '\n', {});
  const payLabel = params.paymentMethod === 'tunai' ? 'Tunai' : 'QRIS';
  await BluetoothEscposPrinter.printText(formatTotal(payLabel, formatRupiah(params.paymentAmount)) + '\n', {});
  await BluetoothEscposPrinter.printText(formatTotal('Kembalian', formatRupiah(params.change)) + '\n', {});

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});
  await BluetoothEscposPrinter.printText('Terima Kasih!\n', {});
  await BluetoothEscposPrinter.printText('Silahkan Datang Kembali\n', {});

  await BluetoothEscposPrinter.printAndFeed(4);
  BluetoothEscposPrinter.cutOnePoint();
}

// ─────────────────────────────────────────
// Cetak Laporan Laba/Rugi
// ─────────────────────────────────────────
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  gaji: 'Gaji & Upah',
  sewa: 'Sewa Tempat',
  listrik: 'Listrik & Air',
  transportasi: 'Transportasi',
  bahan_baku: 'Bahan Baku',
  'lain-lain': 'Lain-lain',
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
    const label = EXPENSE_CATEGORY_LABELS[b.category] ?? b.category;
    await BluetoothEscposPrinter.printText(formatLRRow(label, b.total, true) + '\n', {});
  }
  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Total Beban', data.totalBeban) + '\n', {});
  await BluetoothEscposPrinter.printText('\n', {});

  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('LABA BERSIH', data.labaOperasional) + '\n', {});
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});

  await BluetoothEscposPrinter.printAndFeed(4);
  BluetoothEscposPrinter.cutOnePoint();
}

// ─────────────────────────────────────────
// Cetak Laporan Neraca
// ─────────────────────────────────────────
export async function printLaporanNeraca(params: {
  storeName: string;
  businessType: string;
  items: { section: string; name: string; amount: number }[];
  neracaData: {
    asetLancar: { kas: number; persediaan: number };
    totalAsetTetap: number;
    totalKewajiban: number;
    totalModal: number;
    labaYangDitahan: number;
    totalAset: number;
    totalKewajibanEkuitas: number;
  };
}): Promise<void> {
  const { storeName, items, neracaData } = params;
  const today = new Date().toLocaleDateString('id-ID');

  const asetTetapItems = items.filter((i) => i.section === 'aset_tetap');
  const kewajibanItems = items.filter((i) => i.section === 'kewajiban');
  const modalItems = items.filter((i) => i.section === 'modal');

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.printText('LAPORAN POSISI KEUANGAN\n', {});
  await BluetoothEscposPrinter.printText(storeName + '\n', {});
  await BluetoothEscposPrinter.printText('Per ' + today + '\n', {});
  await BluetoothEscposPrinter.printText('SAK EMKM\n', {});
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printText('ASET\n', {});
  await BluetoothEscposPrinter.printText('Aset Lancar:\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Kas (Est.)', neracaData.asetLancar.kas, true) + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Persediaan', neracaData.asetLancar.persediaan, true) + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Total Aset Lancar', neracaData.asetLancar.kas + neracaData.asetLancar.persediaan) + '\n', {});
  await BluetoothEscposPrinter.printText('Aset Tetap:\n', {});
  for (const i of asetTetapItems) {
    await BluetoothEscposPrinter.printText(formatLRRow(i.name, i.amount, true) + '\n', {});
  }
  await BluetoothEscposPrinter.printText(formatLRRow('Total Aset Tetap', neracaData.totalAsetTetap) + '\n', {});
  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('TOTAL ASET', neracaData.totalAset) + '\n', {});
  await BluetoothEscposPrinter.printText('\n', {});

  await BluetoothEscposPrinter.printText('KEWAJIBAN & EKUITAS\n', {});
  await BluetoothEscposPrinter.printText('Kewajiban:\n', {});
  for (const i of kewajibanItems) {
    await BluetoothEscposPrinter.printText(formatLRRow(i.name, i.amount, true) + '\n', {});
  }
  await BluetoothEscposPrinter.printText(formatLRRow('Total Kewajiban', neracaData.totalKewajiban) + '\n', {});
  await BluetoothEscposPrinter.printText('Modal:\n', {});
  for (const i of modalItems) {
    await BluetoothEscposPrinter.printText(formatLRRow(i.name, i.amount, true) + '\n', {});
  }
  await BluetoothEscposPrinter.printText(formatLRRow('Laba Ditahan', neracaData.labaYangDitahan, true) + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('Total Ekuitas', neracaData.totalModal + neracaData.labaYangDitahan) + '\n', {});
  await BluetoothEscposPrinter.printText(THIN + '\n', {});
  await BluetoothEscposPrinter.printText(formatLRRow('TOTAL KWJ+EKUITAS', neracaData.totalKewajibanEkuitas) + '\n', {});
  await BluetoothEscposPrinter.printText(DIVIDER + '\n', {});

  await BluetoothEscposPrinter.printAndFeed(4);
  BluetoothEscposPrinter.cutOnePoint();
}

