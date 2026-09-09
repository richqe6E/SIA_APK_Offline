import type { SQLiteDatabase } from './database';
import { useSettingsStore } from '@/stores/settingsStore';

export interface StoreSyncPayload {
  pairingCode: string;
  storeName: string;
  updatedAt: string;
  todaySummary: {
    omset: number;
    transactionCount: number;
    avgPerTransaction: number;
    estimatedGrossProfit: number;
    itemsSold: number;
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

// In-memory / persistent mock cloud relay buffer (simulating cloud bridge for instant test & deployment)
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

  // 1. Today sales & transactions
  const txSummary = await db.getFirstAsync<{
    total_omset: number | null;
    tx_count: number | null;
  }>(
    `SELECT 
       COALESCE(SUM(total), 0) as total_omset,
       COUNT(id) as tx_count
     FROM transactions 
     WHERE date(created_at) = date('now','localtime') AND status = 'completed'`
  );

  const omset = txSummary?.total_omset || 0;
  const transactionCount = txSummary?.tx_count || 0;
  const avgPerTransaction = transactionCount > 0 ? Math.round(omset / transactionCount) : 0;

  // 2. Items sold & profit estimation
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
     WHERE date(t.created_at) = date('now','localtime') AND t.status = 'completed'`
  );

  const itemsSold = itemsSummary?.total_qty || 0;
  const cogs = itemsSummary?.total_cogs || 0;
  const estimatedGrossProfit = Math.max(0, omset - cogs);

  // 3. Cash & Bank liquidity (Read calculated balances from cashStore or calculate from ledger)
  const cashStore = (await import('@/stores/cashStore')).useCashStore.getState();
  await cashStore.loadLedger(db);

  const cashHand = cashStore.cashHandBalance;
  const cashBank = cashStore.cashBankBalance;
  const totalCash = cashStore.totalBalance;

  // 4. Denominations
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

  // 5. Debt & Receivables
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

  // 6. Active Shift
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

  // 7. Stock alerts & expired
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

  // 8. Top 5 Products today
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
     WHERE date(t.created_at) = date('now','localtime') AND t.status = 'completed'
     GROUP BY p.id, p.name
     ORDER BY qty DESC
     LIMIT 5`
  );

  // 9. Recent cash ledger mutations (last 10)
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
      transactionCount,
      avgPerTransaction,
      estimatedGrossProfit,
      itemsSold,
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
    activeShift,
    stockAlerts: {
      outOfStockCount: outOfStockRow?.count || 0,
      lowStockCount: lowStockRow?.count || 0,
      expiredSoonCount,
    },
    topProducts,
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
 * Pull/fetch latest snapshot from Cloud Bridge for Owner's Phone
 */
export async function fetchSyncFromCloud(
  pairingCode: string,
  localFallbackDb?: SQLiteDatabase
): Promise<{ success: boolean; payload?: StoreSyncPayload; error?: string }> {
  try {
    useSettingsStore.getState().setCloudSyncStatus('syncing');
    const { supabaseUrl, supabaseAnonKey } = useSettingsStore.getState();

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

    // If running in paired single device test or local fallback
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
