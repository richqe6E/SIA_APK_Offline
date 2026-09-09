import { Storage } from '@/services/storage';

export interface DebtSyncItem {
  id: number;
  supplier_id?: number;
  supplier_name: string;
  supplier_phone?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: string;
  created_at: string;
}

export interface ReceivableSyncItem {
  id: number;
  customer_id?: number;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string | null;
  status: string;
  created_at: string;
}

export interface StoreSyncPayload {
  pairingCode: string;
  storeName: string;
  updatedAt: string;
  todaySummary: {
    omset: number;
    omsetYesterday: number;
    omsetThisMonth: number;
    transactionCount: number;
    avgPerTransaction: number;
    estimatedGrossProfit: number;
    operatingExpenses: number;
    netProfitToday: number;
    itemsSold: number;
    cashTxCount?: number;
    cashTxTotal?: number;
    nonCashTxCount?: number;
    nonCashTxTotal?: number;
    grossMarginPercent?: number;
    peakHour?: string;
  };
  monthlyProfitLoss: {
    periodLabel: string;
    penjualan: number;
    hpp: number;
    labaKotor: number;
    totalBeban: number;
    labaBersih: number;
    bebanBreakdown: { category: string; total: number }[];
  };
  cashLiquidity: {
    cashHand: number;
    cashBank: number;
    totalCash: number;
    denominations: Record<string, number>;
  };
  debtReceivable: {
    totalDebtUnpaid: number;
    totalReceivableUnpaid: number;
  };
  debtsList: DebtSyncItem[];
  receivablesList: ReceivableSyncItem[];
  activeShift: {
    cashierName: string;
    shiftNumber: number;
    openedAt: string;
    initialCash: number;
  } | null;
  stockAlerts: {
    outOfStockCount: number;
    lowStockCount: number;
    expiredSoonCount: number;
  };
  inventoryValuation?: {
    totalStockValue: number;
    totalItems: number;
  };
  dueSoonReceivables?: {
    count: number;
    totalAmount: number;
    items: {
      customer_name: string;
      remaining_amount: number;
      due_date: string;
      days_left: number;
    }[];
  };
  topProducts: {
    id: number;
    name: string;
    qty: number;
    revenue: number;
  }[];
  recentTransactions: {
    id: number;
    total: number;
    payment_method: string;
    cashier_name: string;
    items_count: number;
    created_at: string;
  }[];
  recentLedger: {
    id: number;
    type: string;
    category: string;
    amount: number;
    source: string;
    note: string;
    created_at: string;
  }[];
}

const DEFAULT_SUPABASE_URL = 'https://vhtualqxbtrmnljzmees.supabase.co';
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodHVhbHF4YnRybW5sanptZWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk4NzAsImV4cCI6MjEwNDQ5NTg3MH0.ZCch1NWey4In2xLiwZht0VbFnNrEScITUCKhHe3EdFE';

const CACHE_KEY_PREFIX = 'azizah_store_cache_';

/**
 * Fetch latest snapshot from Cloud Bridge for KENDALI USAHA AZIZAH
 */
export async function fetchStoreSnapshot(
  pairingCode: string
): Promise<{ success: boolean; payload?: StoreSyncPayload; error?: string; isCached?: boolean }> {
  const code = pairingCode.trim().toUpperCase();
  if (!code) {
    return { success: false, error: 'Kode sambung toko tidak boleh kosong.' };
  }

  try {
    const cleanUrl = DEFAULT_SUPABASE_URL.replace(/\/+$/, '');
    const url = `${cleanUrl}/rest/v1/store_sync?pairing_code=eq.${encodeURIComponent(code)}&select=*`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: DEFAULT_SUPABASE_KEY,
        Authorization: `Bearer ${DEFAULT_SUPABASE_KEY}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const raw = rows[0].payload;
        const parsed: StoreSyncPayload = typeof raw === 'string' ? JSON.parse(raw) : raw;
        // Save to offline cache
        await Storage.setItem(`${CACHE_KEY_PREFIX}${code}`, JSON.stringify(parsed));
        return { success: true, payload: parsed, isCached: false };
      } else {
        return {
          success: false,
          error: `Data toko "${code}" tidak ditemukan di server. Pastikan tablet kasir di toko sudah mengaktifkan sambungan cloud.`,
        };
      }
    } else {
      const errText = await response.text();
      return { success: false, error: `Gagal membaca data dari server (${response.status}): ${errText}` };
    }
  } catch (err: any) {
    // Attempt fallback from offline cache
    try {
      const cached = await Storage.getItem(`${CACHE_KEY_PREFIX}${code}`);
      if (cached) {
        const parsed: StoreSyncPayload = JSON.parse(cached);
        return {
          success: true,
          payload: parsed,
          isCached: true,
          error: 'Menampilkan data tersimpan terakhir (HP sedang offline/sinyal lemah).',
        };
      }
    } catch {}

    const isTimeout = err?.name === 'AbortError';
    return {
      success: false,
      error: isTimeout
        ? 'Koneksi ke server timeout (10 detik). Periksa koneksi internet HP Anda.'
        : `Tidak dapat terhubung ke server: ${err?.message || 'Koneksi gagal'}`,
    };
  }
}
