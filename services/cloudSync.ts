import type { SQLiteDatabase } from './database';
import { useSettingsStore } from '@/stores/settingsStore';

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
  debtsList: {
    id: number;
    supplier_name: string;
    total_amount: number;
    paid_amount: number;
    due_date: string | null;
    status: string;
  }[];
  receivablesList: {
    id: number;
    customer_name: string;
    total_amount: number;
    paid_amount: number;
    due_date: string | null;
    status: string;
  }[];
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

// In-memory persistent mock cloud relay buffer
let cloudBuffer: Record<string, StoreSyncPayload> = {};

/**
 * Generate a 6-digit uppercase alphanumeric pairing code (e.g. AZ-7789)
 */
export function generatePairingCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `AZ-${num}`;
}

/**
 * Compile latest snapshot from SQLite database for cloud synchronization
 */
export async function compileSyncPayload(
  db: SQLiteDatabase,
  pairingCode: string
): Promise<StoreSyncPayload> {
  const settingsStore = useSettingsStore.getState();

  // 1. Today sales & transactions (NO status column, all transactions are valid)
  const txSummary = await db.getFirstAsync<{
    total_omset: number | null;
    tx_count: number | null;
  }>(
    `SELECT 
       COALESCE(SUM(total), 0) as total_omset,
       COUNT(id) as tx_count
     FROM transactions 
     WHERE date(created_at) = date('now','localtime')`
  );

  const omset = txSummary?.total_omset || 0;
  const transactionCount = txSummary?.tx_count || 0;
  const avgPerTransaction = transactionCount > 0 ? Math.round(omset / transactionCount) : 0;

  // Yesterday sales
  const yestSummary = await db.getFirstAsync<{ total_omset: number | null }>(
    `SELECT COALESCE(SUM(total), 0) as total_omset 
     FROM transactions 
     WHERE date(created_at) = date('now','localtime','-1 day')`
  );
  const omsetYesterday = yestSummary?.total_omset || 0;

  // This month sales
  const monthSummary = await db.getFirstAsync<{ total_omset: number | null }>(
    `SELECT COALESCE(SUM(total), 0) as total_omset 
     FROM transactions 
     WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')`
  );
  const omsetThisMonth = monthSummary?.total_omset || 0;

  // 2. Items sold & profit estimation today
  const itemsSummary = await db.getFirstAsync<{
    total_qty: number | null;
    total_cogs: number | null;
  }>(
    `SELECT 
       COALESCE(SUM(ti.quantity), 0) as total_qty,
       COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0) as total_cogs
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     LEFT JOIN products p ON p.id = ti.product_id
     WHERE date(t.created_at) = date('now','localtime')`
  );

  const itemsSold = itemsSummary?.total_qty || 0;
  const cogs = itemsSummary?.total_cogs || 0;
  const estimatedGrossProfit = Math.max(0, omset - cogs);

  // Today Operating Expenses (cash out not including setor_bank)
  const expSummary = await db.getFirstAsync<{ total_exp: number | null }>(
    `SELECT COALESCE(SUM(amount), 0) as total_exp
     FROM cash_ledger
     WHERE type = 'out' AND category != 'setor_bank' AND date(created_at) = date('now','localtime')`
  );
  const operatingExpenses = expSummary?.total_exp || 0;
  const netProfitToday = estimatedGrossProfit - operatingExpenses;

  // 3. Monthly P&L Summary
  const monthlyCogsRow = await db.getFirstAsync<{ m_cogs: number | null }>(
    `SELECT COALESCE(SUM(ti.quantity * COALESCE(p.cost_price, 0)), 0) as m_cogs
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     LEFT JOIN products p ON p.id = ti.product_id
     WHERE strftime('%Y-%m', t.created_at) = strftime('%Y-%m', 'now','localtime')`
  );
  const mHpp = monthlyCogsRow?.m_cogs || 0;
  const mLabaKotor = Math.max(0, omsetThisMonth - mHpp);

  const monthlyExpRow = await db.getFirstAsync<{ m_exp: number | null }>(
    `SELECT COALESCE(SUM(amount), 0) as m_exp
     FROM cash_ledger
     WHERE type = 'out' AND category != 'setor_bank' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')`
  );
  const mTotalBeban = monthlyExpRow?.m_exp || 0;
  const mLabaBersih = mLabaKotor - mTotalBeban;

  const bebanBreakdown = await db.getAllAsync<{ category: string; total: number }>(
    `SELECT category, SUM(amount) as total
     FROM cash_ledger
     WHERE type = 'out' AND category != 'setor_bank' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')
     GROUP BY category
     ORDER BY total DESC
     LIMIT 5`
  );

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const now = new Date();
  const periodLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  // 4. Cash & Bank liquidity
  const cashStore = (await import('@/stores/cashStore')).useCashStore.getState();
  await cashStore.loadLedger(db);

  const cashHand = cashStore.cashHandBalance;
  const cashBank = cashStore.cashBankBalance;
  const totalCash = cashStore.totalBalance;

  // 5. Denominations
  const denomRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'cash_denominations'"
  );
  let denominations: Record<string, number> = {};
  if (denomRow?.value) {
    try {
      const parsed = JSON.parse(denomRow.value);
      denominations = parsed.counts || {};
    } catch {}
  }

  // 6. Debt & Receivables
  const debtRow = await db.getFirstAsync<{ total_unpaid: number | null }>(
    `SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total_unpaid
     FROM supplier_debts
     WHERE status != 'paid'`
  );
  const recRow = await db.getFirstAsync<{ total_unpaid: number | null }>(
    `SELECT COALESCE(SUM(total_amount - paid_amount), 0) as total_unpaid
     FROM customer_receivables
     WHERE status != 'paid'`
  );

  const totalDebtUnpaid = debtRow?.total_unpaid || 0;
  const totalReceivableUnpaid = recRow?.total_unpaid || 0;

  // Detailed debts list
  const debtsList = await db.getAllAsync<{
    id: number;
    supplier_name: string;
    total_amount: number;
    paid_amount: number;
    due_date: string | null;
    status: string;
  }>(
    `SELECT 
       sd.id,
       COALESCE(s.name, 'Supplier Umum') as supplier_name,
       sd.total_amount,
       sd.paid_amount,
       sd.due_date,
       sd.status
     FROM supplier_debts sd
     LEFT JOIN suppliers s ON s.id = sd.supplier_id
     WHERE sd.status != 'paid'
     ORDER BY sd.id DESC
     LIMIT 5`
  );

  // Detailed receivables list
  const receivablesList = await db.getAllAsync<{
    id: number;
    customer_name: string;
    total_amount: number;
    paid_amount: number;
    due_date: string | null;
    status: string;
  }>(
    `SELECT 
       cr.id,
       COALESCE(c.name, 'Pelanggan Bon') as customer_name,
       cr.total_amount,
       cr.paid_amount,
       cr.due_date,
       cr.status
     FROM customer_receivables cr
     LEFT JOIN customers c ON c.id = cr.customer_id
     WHERE cr.status != 'paid'
     ORDER BY cr.id DESC
     LIMIT 5`
  );

  // 7. Active Shift
  const shiftRow = await db.getFirstAsync<{
    cashier_name: string;
    opened_at: string;
    starting_cash: number;
  }>(
    `SELECT cashier_name, opened_at, starting_cash
     FROM cash_shifts
     WHERE status = 'open'
     ORDER BY id DESC LIMIT 1`
  );

  const activeShift = shiftRow
    ? {
        cashierName: shiftRow.cashier_name,
        shiftNumber: 1,
        openedAt: shiftRow.opened_at,
        initialCash: shiftRow.starting_cash,
      }
    : null;

  // 8. Stock alerts & expired
  const outOfStockRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(id) as count FROM products WHERE stock <= 0`
  );
  const lowStockRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(id) as count FROM products WHERE stock > 0 AND stock <= 5`
  );

  const expRows = await db.getAllAsync<{ expired_date: string }>(
    `SELECT expired_date FROM products WHERE expired_date IS NOT NULL AND expired_date != ''`
  );
  const todayMs = new Date().setHours(0, 0, 0, 0);
  let expiredSoonCount = 0;
  for (const exp of expRows) {
    const diffDays = Math.ceil(
      (new Date(exp.expired_date).getTime() - todayMs) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 30) {
      expiredSoonCount++;
    }
  }

  // 9. Top 5 Products today
  const topProducts = await db.getAllAsync<{
    id: number;
    name: string;
    qty: number;
    revenue: number;
  }>(
    `SELECT 
       p.id,
       p.name,
       SUM(ti.quantity) as qty,
       SUM(ti.subtotal) as revenue
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     JOIN products p ON p.id = ti.product_id
     WHERE date(t.created_at) = date('now','localtime')
     GROUP BY p.id, p.name
     ORDER BY qty DESC
     LIMIT 5`
  );

  // 10. Recent Completed Transactions (last 5)
  const recentTransactions = await db.getAllAsync<{
    id: number;
    total: number;
    payment_method: string;
    cashier_name: string;
    items_count: number;
    created_at: string;
  }>(
    `SELECT 
       t.id,
       t.total,
       t.payment_method,
       COALESCE(t.cashier_name, 'Kasir') as cashier_name,
       (SELECT COUNT(id) FROM transaction_items WHERE transaction_id = t.id) as items_count,
       t.created_at
     FROM transactions t
     ORDER BY t.id DESC
     LIMIT 5`
  );

  // 11. Recent cash ledger mutations (last 10)
  const recentLedger = await db.getAllAsync<{
    id: number;
    type: string;
    category: string;
    amount: number;
    source: string;
    note: string;
    created_at: string;
  }>(
    `SELECT 
       id, 
       type, 
       category, 
       amount, 
       account as source, 
       description as note, 
       created_at
     FROM cash_ledger
     ORDER BY id DESC
     LIMIT 10`
  );

  return {
    pairingCode,
    storeName: settingsStore.storeName,
    updatedAt: new Date().toISOString(),
    todaySummary: {
      omset,
      omsetYesterday,
      omsetThisMonth,
      transactionCount,
      avgPerTransaction,
      estimatedGrossProfit,
      operatingExpenses,
      netProfitToday,
      itemsSold,
    },
    monthlyProfitLoss: {
      periodLabel,
      penjualan: omsetThisMonth,
      hpp: mHpp,
      labaKotor: mLabaKotor,
      totalBeban: mTotalBeban,
      labaBersih: mLabaBersih,
      bebanBreakdown,
    },
    cashLiquidity: {
      cashHand,
      cashBank,
      totalCash,
      denominations,
    },
    debtReceivable: {
      totalDebtUnpaid,
      totalReceivableUnpaid,
    },
    debtsList,
    receivablesList,
    activeShift,
    stockAlerts: {
      outOfStockCount: outOfStockRow?.count || 0,
      lowStockCount: lowStockRow?.count || 0,
      expiredSoonCount,
    },
    topProducts,
    recentTransactions,
    recentLedger,
  };
}

/**
 * Upload/publish sync snapshot from Store Tablet to Cloud Bridge (Supabase REST or local relay)
 */
export async function pushSyncToCloud(
  db: SQLiteDatabase,
  pairingCode: string
): Promise<{ success: boolean; payload?: StoreSyncPayload; error?: string }> {
  try {
    useSettingsStore.getState().setCloudSyncStatus('syncing');
    const payload = await compileSyncPayload(db, pairingCode);

    // Save to local cloud bridge buffer
    cloudBuffer[pairingCode] = payload;

    const { supabaseUrl, supabaseAnonKey } = useSettingsStore.getState();

    // If Supabase project credentials are configured, push over HTTPS internet
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
        const response = await fetch(`${cleanUrl}/rest/v1/store_sync`, {
          method: 'POST',
          headers: {
            apikey: supabaseAnonKey.trim(),
            Authorization: `Bearer ${supabaseAnonKey.trim()}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            pairing_code: pairingCode,
            store_name: payload.storeName,
            payload: JSON.stringify(payload),
            updated_at: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn('Supabase push warning:', errText);
        }
      } catch (cloudErr: any) {
        console.warn('Supabase push network error:', cloudErr?.message);
      }
    }

    useSettingsStore.getState().setCloudSyncStatus('synced');
    useSettingsStore.getState().setCloudConnected(true);
    return { success: true, payload };
  } catch (err: any) {
    useSettingsStore.getState().setCloudSyncStatus('error');
    return { success: false, error: err?.message || 'Gagal sinkronisasi data' };
  }
}

/**
 * Automated non-blocking background sync trigger from Store Tablet
 */
export async function triggerAutoSync(db: SQLiteDatabase): Promise<void> {
  try {
    const { currentUserRole, storePairingCode } = useSettingsStore.getState();
    // Only store tablet (kasir/pemilik) pushes data, not remote pemantau phone
    if (currentUserRole === 'pemantau') return;
    if (!storePairingCode) return;

    // Fire non-blocking push
    pushSyncToCloud(db, storePairingCode).catch((err) => {
      console.warn('Background auto-sync failed silently:', err?.message);
    });
  } catch {}
}

/**
 * Pull/fetch latest snapshot from Cloud Bridge for Owner's Phone
 */
export async function fetchSyncFromCloud(
  pairingCode: string,
  localFallbackDb?: SQLiteDatabase
): Promise<{ success: boolean; payload?: StoreSyncPayload; error?: string }> {
  try {
    useSettingsStore.getState().setCloudSyncStatus('syncing');
    const { supabaseUrl, supabaseAnonKey, currentUserRole } = useSettingsStore.getState();

    // If Supabase is configured, pull over internet via HTTPS REST
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const cleanUrl = supabaseUrl.trim().replace(/\/+$/, '');
        const response = await fetch(
          `${cleanUrl}/rest/v1/store_sync?pairing_code=eq.${encodeURIComponent(pairingCode)}&select=*`,
          {
            headers: {
              apikey: supabaseAnonKey.trim(),
              Authorization: `Bearer ${supabaseAnonKey.trim()}`,
            },
          }
        );

        if (response.ok) {
          const rows = await response.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const raw = rows[0].payload;
            const parsedPayload: StoreSyncPayload =
              typeof raw === 'string' ? JSON.parse(raw) : raw;

            cloudBuffer[pairingCode] = parsedPayload;
            useSettingsStore.getState().setCloudSyncStatus('synced');
            useSettingsStore.getState().setCloudConnected(true);
            return { success: true, payload: parsedPayload };
          }
        }
      } catch (cloudErr: any) {
        console.warn('Supabase fetch network error:', cloudErr?.message);
      }
    }

    // Check local memory buffer
    if (cloudBuffer[pairingCode]) {
      const payload = cloudBuffer[pairingCode];
      useSettingsStore.getState().setCloudSyncStatus('synced');
      useSettingsStore.getState().setCloudConnected(true);
      return { success: true, payload };
    }

    // For Remote Phone Pemantau: do NOT fallback to compile empty phone database!
    if (currentUserRole === 'pemantau') {
      useSettingsStore.getState().setCloudSyncStatus('error');
      return {
        success: false,
        error: `Data toko "${pairingCode}" belum ditemukan di server. Pastikan di Tablet Kasir sudah menekan "Sinkronkan Sekarang" atau melakukan transaksi pertama.`,
      };
    }

    // If running on tablet or local single-device testing
    if (localFallbackDb) {
      const payload = await compileSyncPayload(localFallbackDb, pairingCode);
      cloudBuffer[pairingCode] = payload;
      useSettingsStore.getState().setCloudSyncStatus('synced');
      useSettingsStore.getState().setCloudConnected(true);
      return { success: true, payload };
    }

    useSettingsStore.getState().setCloudSyncStatus('error');
    return {
      success: false,
      error: `Kode perangkat "${pairingCode}" belum terhubung atau tablet kasir sedang offline.`,
    };
  } catch (err: any) {
    useSettingsStore.getState().setCloudSyncStatus('error');
    return { success: false, error: err?.message || 'Gagal mengambil data dari server' };
  }
}
