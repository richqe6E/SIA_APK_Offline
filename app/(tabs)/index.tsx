import { CashShiftModal } from '@/components/cash-shift-modal';
import { CashDenominationModal } from '@/components/cash-denomination-modal';
import { OnboardingModal } from '@/components/onboarding-modal';
import { RealtimeClockBadge } from '@/components/realtime-clock-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import { useCashStore } from '@/stores/cashStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useShiftStore } from '@/stores/shiftStore';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HARI_INI = 'Hari Ini';

function formatRupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function formatShortRupiah(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'jt';
  if (n >= 1000) return Math.round(n / 1000) + 'rb';
  return n > 0 ? n.toString() : '';
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const { storeName, businessType, businessMode, isOnboarded, loadSettings, appOrientation, setAppOrientation, currentUserRole, logoutRole } = useSettingsStore();
  const {
    currentBalance,
    cashHandBalance,
    cashBankBalance,
    totalBalance,
    denominations,
    loadDenominations,
    saveDenominations,
    loadLedger,
  } = useCashStore();
  const { currentShift, loadShiftData } = useShiftStore();

  const [shiftModalVisible, setShiftModalVisible] = useState(false);
  const [denominationModalVisible, setDenominationModalVisible] = useState(false);
  const [expiredAlerts, setExpiredAlerts] = useState<
    { id: number; name: string; sku: string; expired_date: string; stock: number; diffDays: number }[]
  >([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<
    { id: number; name: string; barcode: string; stock: number; category_name?: string }[]
  >([]);
  const [todayCashMetrics, setTodayCashMetrics] = useState({
    cashInTunai: 0,
    cashInNonTunai: 0,
    cashOut: 0,
  });

  useLockOrientation(
    appOrientation === 'landscape'
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT_UP
  );

  const toggleOrientation = async () => {
    const next = appOrientation === 'landscape' ? 'portrait' : 'landscape';
    await setAppOrientation(db, next);
    try {
      if (next === 'landscape') {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    } catch {
      // ignore
    }
  };

  const [summary, setSummary] = useState({
    today: 0,
    todayCount: 0,
    yesterday: 0,
    week: 0,
    month: 0,
    productCount: 0,
    avgPerTransaction: 0,
    itemsSoldToday: 0,
    weekTrend: [] as { label: string; total: number }[],
  });
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    await loadSettings(db);
    await loadLedger(db);
    await loadDenominations(db);
    await loadShiftData(db);

    const expRows = await db.getAllAsync<{ id: number; name: string; barcode: string; expired_date: string; stock: number }>(
      "SELECT id, name, barcode, expired_date, stock FROM products WHERE expired_date IS NOT NULL AND expired_date != ''"
    );
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const alerts = expRows
      .map((p) => {
        const expMs = new Date(p.expired_date).getTime();
        const diffDays = Math.ceil((expMs - todayMs) / (1000 * 60 * 60 * 24));
        return {
          id: p.id,
          name: p.name,
          sku: p.barcode || '-',
          expired_date: p.expired_date,
          stock: p.stock,
          diffDays,
        };
      })
      .filter((p) => p.diffDays <= 30)
      .sort((a, b) => a.diffDays - b.diffDays);
    setExpiredAlerts(alerts);

    // Query produk dengan stok menipis (<20 pcs)
    const lowRows = await db.getAllAsync<{ id: number; name: string; barcode: string; stock: number; category_name?: string }>(
      `SELECT p.id, p.name, p.barcode, p.stock, COALESCE(c.name, 'Umum') as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.has_stock = 1 AND p.stock < 20
       ORDER BY p.stock ASC`
    );
    setLowStockAlerts(lowRows);

    // Query transaksi hari ini berdasarkan metode pembayaran
    const todayTx = await db.getAllAsync<{ payment_method: string; total: number }>(
      "SELECT payment_method, COALESCE(SUM(total), 0) as total FROM transactions WHERE date(created_at) = date('now','localtime') GROUP BY payment_method"
    );
    let txTunai = 0;
    let txNonTunai = 0;
    for (const r of todayTx) {
      if (r.payment_method === 'tunai') txTunai = r.total;
      else if (r.payment_method === 'qris') txNonTunai = r.total;
    }

    // Query mutasi buku kas hari ini
    const todayLedger = await db.getAllAsync<{ type: string; account: string; category: string; total: number }>(
      "SELECT type, account, category, COALESCE(SUM(amount), 0) as total FROM cash_ledger WHERE date(created_at) = date('now','localtime') GROUP BY type, account, category"
    );
    let ledgerInHand = 0;
    let ledgerInBank = 0;
    let ledgerOut = 0;
    for (const l of todayLedger) {
      if (l.type === 'in') {
        if (l.account === 'bank') ledgerInBank += l.total;
        else ledgerInHand += l.total;
      } else if (l.type === 'out' && l.category !== 'setor_bank') {
        ledgerOut += l.total;
      }
    }

    setTodayCashMetrics({
      cashInTunai: txTunai + ledgerInHand,
      cashInNonTunai: txNonTunai + ledgerInBank,
      cashOut: ledgerOut,
    });

    const today = await db.getFirstAsync<{ total: number; count: number }>(
      "SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count FROM transactions WHERE date(created_at) = date('now','localtime')"
    );
    const yesterday = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE date(created_at) = date('now','localtime','-1 day')"
    );
    const week = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE created_at >= datetime('now','localtime','-7 days')"
    );
    const month = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(total), 0) as total FROM transactions WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')"
    );
    const productCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM products'
    );
    const avgResult = await db.getFirstAsync<{ avg: number }>(
      'SELECT COALESCE(AVG(total), 0) as avg FROM transactions'
    );
    const itemsSold = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(ti.quantity), 0) as total FROM transaction_items ti JOIN transactions t ON ti.transaction_id = t.id WHERE date(t.created_at) = date('now','localtime')"
    );

    const weekRows = await db.getAllAsync<{ day: string; total: number }>(
      `SELECT date(created_at) as day, COALESCE(SUM(total), 0) as total
       FROM transactions
       WHERE created_at >= datetime('now','localtime','-6 days')
       GROUP BY date(created_at)
       ORDER BY day ASC`
    );

    const weekMap = new Map(weekRows.map((r) => [r.day, r.total]));
    const fullWeek: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = i === 0 ? HARI_INI : DAY_LABELS[d.getDay()];
      fullWeek.push({ label: dayLabel, total: weekMap.get(dateStr) ?? 0 });
    }

    setSummary({
      today: today?.total ?? 0,
      todayCount: today?.count ?? 0,
      yesterday: yesterday?.total ?? 0,
      week: week?.total ?? 0,
      month: month?.total ?? 0,
      productCount: productCount?.count ?? 0,
      avgPerTransaction: avgResult?.avg ?? 0,
      itemsSoldToday: itemsSold?.total ?? 0,
      weekTrend: fullWeek,
    });
    setLoading(false);
  }, [db, loadSettings, loadLedger]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  const maxTrend = Math.max(...summary.weekTrend.map((d) => d.total), 1);
  const bestTrendDay = useMemo(() => {
    if (!summary.weekTrend || summary.weekTrend.length === 0) return null;
    return summary.weekTrend.reduce((max, cur) => (cur.total > max.total ? cur : max), summary.weekTrend[0]);
  }, [summary.weekTrend]);
  const dailyAverage = Math.round(summary.week / 7);
  const percentChange =
    summary.yesterday > 0
      ? ((summary.today - summary.yesterday) / summary.yesterday) * 100
      : summary.today > 0
        ? 100
        : 0;
  const isUp = percentChange >= 0;
  const { width } = useWindowDimensions();
  const isTabletOrLandscape = width >= 720 || appOrientation === 'landscape';

  const DENOMINATIONS_LIST = [
    { value: 100000, label: '100rb' },
    { value: 50000, label: '50rb' },
    { value: 20000, label: '20rb' },
    { value: 10000, label: '10rb' },
    { value: 5000, label: '5rb' },
    { value: 2000, label: '2rb' },
    { value: 1000, label: '1rb' },
    { value: 500, label: '500' },
    { value: 200, label: '200' },
    { value: 100, label: '100' },
  ];

  const counts = denominations?.counts || {};
  const physicalTotal = denominations?.total ?? 0;
  const activeDenominations = DENOMINATIONS_LIST.filter((d) => (counts[d.value] || 0) > 0);
  const denominationDiff = physicalTotal - cashHandBalance;
  const isDenominationCounted = denominations !== null && Object.keys(counts).length > 0;
  const isDenominationMatched = isDenominationCounted && Math.abs(denominationDiff) < 1;

  const renderDualCashCard = (isLandscape: boolean) => (
    <Card padding={isLandscape ? 16 : 14} style={styles.cashBalanceCard}>
      {/* Saku 1: Saldo Kas Fisik di Tangan (Laci Kasir) */}
      <View style={styles.cashPocketContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <ThemedText style={{ fontSize: 11, color: '#334155', fontWeight: '800' }}>
                💵 SALDO KAS FISIK DI TANGAN
              </ThemedText>
              {isDenominationMatched ? (
                <View style={[styles.denomBadge, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
                  <ThemedText style={{ fontSize: 9.5, color: '#16a34a', fontWeight: '800' }}>✓ Fisik Sesuai</ThemedText>
                </View>
              ) : isDenominationCounted ? (
                <View style={[styles.denomBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                  <ThemedText style={{ fontSize: 9.5, color: '#b45309', fontWeight: '800' }}>
                    ⚠️ Selisih {denominationDiff > 0 ? '+' : ''}{formatRupiah(denominationDiff)}
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.denomBadge, { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' }]}>
                  <ThemedText style={{ fontSize: 9.5, color: '#64748b', fontWeight: '600' }}>Belum Dihitung</ThemedText>
                </View>
              )}
            </View>
            <ThemedText
              style={{
                fontSize: isLandscape ? 24 : 22,
                fontWeight: '900',
                color: cashHandBalance >= 0 ? Colors.tintDark : Colors.danger,
                marginTop: 2,
              }}
            >
              {formatRupiah(cashHandBalance)}
            </ThemedText>
          </View>

          {/* Tombol Input / Edit Pecahan Uang (Bisa diakses Kasir & Pemilik) */}
          <TouchableOpacity
            style={styles.denomActionBtn}
            onPress={() => setDenominationModalVisible(true)}
            activeOpacity={0.8}
          >
            <ThemedText style={{ fontSize: 11 }}>💵</ThemedText>
            <ThemedText style={styles.denomActionText}>
              {isDenominationCounted ? 'Edit Pecahan' : 'Hitung Pecahan'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Deretan Chips Pecahan Uang Fisik */}
        {activeDenominations.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <ThemedText style={{ fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 4 }}>
              Rincian Pecahan di Laci (Total: {formatRupiah(physicalTotal)}):
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5, paddingVertical: 2 }}>
              {activeDenominations.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={styles.denomChip}
                  onPress={() => setDenominationModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.denomChipText}>
                    {d.label} <ThemedText style={{ fontWeight: '800', color: Colors.tintDark }}>×{counts[d.value]}</ThemedText>
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Metrik Kas Hari Ini: Kas Masuk Tunai, Non-Tunai, Kas Keluar */}
      <View style={styles.cashMetricsRow}>
        {/* Kas Masuk Tunai */}
        <View style={[styles.cashMetricCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <ThemedText style={{ fontSize: 10, color: '#16a34a', fontWeight: '800' }}>
            📥 Kas Masuk Tunai
          </ThemedText>
          <ThemedText style={{ fontSize: 14, fontWeight: '900', color: '#15803d', marginTop: 2 }} numberOfLines={1}>
            {formatRupiah(todayCashMetrics.cashInTunai)}
          </ThemedText>
          <ThemedText style={{ fontSize: 8.5, color: '#16a34a', marginTop: 1 }}>
            Penjualan fisik & masuk
          </ThemedText>
        </View>

        {/* Kas Masuk Non-Tunai */}
        <View style={[styles.cashMetricCard, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]}>
          <ThemedText style={{ fontSize: 10, color: '#0369a1', fontWeight: '800' }}>
            📱 Non-Tunai (QRIS)
          </ThemedText>
          <ThemedText style={{ fontSize: 14, fontWeight: '900', color: '#0284c7', marginTop: 2 }} numberOfLines={1}>
            {formatRupiah(todayCashMetrics.cashInNonTunai)}
          </ThemedText>
          <ThemedText style={{ fontSize: 8.5, color: '#0284c7', marginTop: 1 }}>
            QRIS & transfer bank
          </ThemedText>
        </View>

        {/* Kas Keluar */}
        <View style={[styles.cashMetricCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
          <ThemedText style={{ fontSize: 10, color: '#dc2626', fontWeight: '800' }}>
            📤 Kas Keluar
          </ThemedText>
          <ThemedText style={{ fontSize: 14, fontWeight: '900', color: '#b91c1c', marginTop: 2 }} numberOfLines={1}>
            {formatRupiah(todayCashMetrics.cashOut)}
          </ThemedText>
          <ThemedText style={{ fontSize: 8.5, color: '#dc2626', marginTop: 1 }}>
            Beban operasional
          </ThemedText>
        </View>
      </View>

      {/* Footer: Tombol Navigasi ke Buku Kas */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderColor: '#f1f5f9' }}>
        <TouchableOpacity
          style={styles.openLedgerBtn}
          onPress={() => router.push('/(tabs)/financial-reports')}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.openLedgerText}>
            {currentUserRole === 'kasir' ? 'Input Kas Masuk / Keluar ›' : 'Buku Kas & Mutasi ›'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderLowStockCard = (isLandscape: boolean) => (
    <Card padding={14} style={[styles.lowStockCard, !isLandscape && { marginBottom: 12 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ThemedText style={{ fontSize: 16 }}>⚠️</ThemedText>
          <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#1e293b' }}>
            Peringatan Stok Menipis (&lt;20)
          </ThemedText>
        </View>
        <View
          style={[
            styles.expiredBadge,
            { backgroundColor: lowStockAlerts.length > 0 ? '#fef3c7' : '#dcfce7' },
          ]}
        >
          <ThemedText
            style={[
              styles.expiredBadgeText,
              { color: lowStockAlerts.length > 0 ? '#b45309' : '#15803d' },
            ]}
          >
            {lowStockAlerts.length > 0 ? `${lowStockAlerts.length} Perlu Restock` : 'Stok Aman'}
          </ThemedText>
        </View>
      </View>

      {lowStockAlerts.length === 0 ? (
        <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
          Semua produk memiliki stok yang cukup (tidak ada produk dengan stok di bawah 20).
        </ThemedText>
      ) : (
        <View style={{ gap: 6 }}>
          {lowStockAlerts.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.expiredItemRow}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <ThemedText style={styles.expiredItemName} numberOfLines={1}>
                  {item.name}
                </ThemedText>
                <ThemedText style={styles.expiredItemMeta}>
                  Barcode: {item.barcode || '-'}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.diffTag,
                  { backgroundColor: item.stock <= 5 ? '#fee2e2' : '#fef3c7' },
                ]}
              >
                <ThemedText
                  style={[
                    styles.diffTagText,
                    { color: item.stock <= 5 ? '#dc2626' : '#b45309', fontWeight: '800' },
                  ]}
                >
                  Sisa {item.stock} pcs
                </ThemedText>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
            {lowStockAlerts.length > 3 ? (
              <ThemedText style={{ fontSize: 10, color: '#94a3b8' }}>
                +{lowStockAlerts.length - 3} produk menipis lainnya
              </ThemedText>
            ) : <View />}
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Colors.tintDark }}>
                Beli Stok ›
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
      ]}
    >
      {/* Onboarding Wizard jika pertama kali buka */}
      <OnboardingModal visible={!isOnboarded} onComplete={loadSummary} />

      {/* Brand & Store Header Card */}
      <View style={[styles.topHeaderCard, !isTabletOrLandscape && styles.topHeaderCardPortrait]}>
        <View style={styles.headerLeft}>
          <ThemedText style={styles.karyaPolnesText}>
            POS Karya Riki Rivaldi
          </ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <View style={styles.storeLogoBox}>
              <Image
                source={require('@/assets/images/app-logo-p.png')}
                style={styles.storeLogo}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="title" style={{ fontSize: 17, color: '#1e1b4b', fontWeight: '800' }} numberOfLines={1}>
                {storeName}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <ThemedText style={styles.brandSub}>{businessType || 'Toko Retail'}</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {isTabletOrLandscape ? (
          <>
            {/* Jam, Tanggal Realtime & Kasir Bertugas (Landscape: Format Berdampingan) */}
            <View style={{ marginHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <RealtimeClockBadge />

              {/* Tombol Kasir Bertugas Tepat di Samping Tanggal */}
              <TouchableOpacity
                style={[
                  styles.shiftBadgeBtn,
                  currentShift ? styles.shiftBadgeActive : styles.shiftBadgeInactive,
                ]}
                onPress={() => setShiftModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.shiftDot, currentShift ? styles.shiftDotActive : styles.shiftDotInactive]} />
                <View>
                  <ThemedText style={styles.shiftBadgeRole}>Kasir Bertugas</ThemedText>
                  <ThemedText style={styles.shiftBadgeAction} numberOfLines={1}>
                    {currentShift ? `👤 ${currentShift.cashier_name}` : 'Pilih Kasir ›'}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </View>

            {/* Action Header: Role Switcher & Orientation */}
            <View style={styles.headerRightActions}>
              {/* Tombol Peran Kasir / Pemilik */}
              <TouchableOpacity
                style={styles.roleBadgeBtn}
                onPress={logoutRole}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.roleBadgeIcon}>
                  {currentUserRole === 'pemilik' ? '👑' : '🛒'}
                </ThemedText>
                <View>
                  <ThemedText style={styles.roleBadgeRole}>
                    {currentUserRole === 'pemilik' ? 'Pemilik' : 'Kasir'}
                  </ThemedText>
                  <ThemedText style={styles.roleBadgeAction}>Ganti ›</ThemedText>
                </View>
              </TouchableOpacity>

              {/* Tombol Cepat Orientasi Layar (Portrait / Landscape) */}
              <TouchableOpacity
                style={[
                  styles.orientationToggleBtn,
                  appOrientation === 'landscape' && styles.orientationToggleBtnActive,
                ]}
                onPress={toggleOrientation}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.orientationToggleIcon}>
                  {appOrientation === 'landscape' ? '🔄' : '📱'}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.orientationToggleText,
                    appOrientation === 'landscape' && styles.orientationToggleTextActive,
                  ]}
                >
                  {appOrientation === 'landscape' ? 'Landscape' : 'Portrait'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* Mode Portrait: Baris kedua memuat jam compact & aksi */
          <View style={styles.headerBottomRowPortrait}>
            <RealtimeClockBadge compact />
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={[
                  styles.shiftBadgeBtn,
                  currentShift ? styles.shiftBadgeActive : styles.shiftBadgeInactive,
                ]}
                onPress={() => setShiftModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.shiftDot, currentShift ? styles.shiftDotActive : styles.shiftDotInactive]} />
                <View>
                  <ThemedText style={styles.shiftBadgeRole}>Kasir Bertugas</ThemedText>
                  <ThemedText style={styles.shiftBadgeAction} numberOfLines={1}>
                    {currentShift ? `👤 ${currentShift.cashier_name}` : 'Pilih Kasir ›'}
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.roleBadgeBtn}
                onPress={logoutRole}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.roleBadgeIcon}>
                  {currentUserRole === 'pemilik' ? '👑' : '🛒'}
                </ThemedText>
                <View>
                  <ThemedText style={styles.roleBadgeRole}>
                    {currentUserRole === 'pemilik' ? 'Pemilik' : 'Kasir'}
                  </ThemedText>
                  <ThemedText style={styles.roleBadgeAction}>Ganti ›</ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.orientationToggleBtn}
                onPress={toggleOrientation}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.orientationToggleIcon}>📱</ThemedText>
                <ThemedText style={styles.orientationToggleText}>Portrait</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 60 }} />
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {isTabletOrLandscape ? (
              /* TAMPILAN TABLET LANDSCAPE (REDMI PAD 2): 2 KOLOM SEIMBANG */
              <View style={styles.landscapeGrid}>
                {/* Kolom Kiri: Kas & Rekap Penjualan */}
                <View style={styles.landscapeCol}>
                  {/* Saldo Kas Dual-Pocket Card (Kas Fisik & Kas Bank) */}
                  {renderDualCashCard(true)}

                  {/* Perbandingan Hari Ini vs Kemarin */}
                  <Card padding={16} style={styles.compCard}>
                    <View style={styles.compHeader}>
                      <View>
                        <ThemedText style={{ fontSize: 11, color: Colors.placeholder, fontWeight: '600' }}>
                          Penjualan Hari Ini
                        </ThemedText>
                        <ThemedText style={{ fontSize: 24, fontWeight: '800', marginTop: 2, color: '#1e293b' }}>
                          {formatRupiah(summary.today)}
                        </ThemedText>
                      </View>
                      <View style={[styles.badge, { backgroundColor: isUp ? '#dcfce7' : '#fee2e2' }]}>
                        <ThemedText
                          style={{
                            fontSize: 12,
                            color: isUp ? '#15803d' : '#b91c1c',
                            fontWeight: '800',
                          }}
                        >
                          {isUp ? '▲' : '▼'} {Math.abs(percentChange).toFixed(1)}%
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.compSub}>
                      <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                        Kemarin: {formatRupiah(summary.yesterday)}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                        Rata-rata: {formatRupiah(summary.avgPerTransaction)}/trx
                      </ThemedText>
                    </View>
                  </Card>

                  {/* Ringkasan 7 Hari & Bulan Ini */}
                  <View style={styles.cardsRow}>
                    <Card style={{ flex: 1, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }} padding={12}>
                      <ThemedText style={{ fontSize: 10, color: Colors.placeholder, fontWeight: '600' }}>7 Hari Terakhir</ThemedText>
                      <ThemedText style={{ fontSize: 16, fontWeight: '800', marginTop: 3, color: Colors.tintDark }}>
                        {formatRupiah(summary.week)}
                      </ThemedText>
                    </Card>
                    <Card style={{ flex: 1, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }} padding={12}>
                      <ThemedText style={{ fontSize: 10, color: Colors.placeholder, fontWeight: '600' }}>Bulan Ini</ThemedText>
                      <ThemedText style={{ fontSize: 16, fontWeight: '800', marginTop: 3, color: Colors.tintDark }}>
                        {formatRupiah(summary.month)}
                      </ThemedText>
                    </Card>
                  </View>

                  {/* Widget Peringatan Stok Menipis (Landscape) */}
                  {renderLowStockCard(true)}

                  {/* Widget Peringatan Kadaluarsa (Landscape) */}
                  <Card padding={14} style={styles.expiredCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText style={{ fontSize: 16 }}>⏳</ThemedText>
                        <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#1e293b' }}>
                          Peringatan Kadaluarsa
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.expiredBadge,
                          { backgroundColor: expiredAlerts.length > 0 ? '#fee2e2' : '#dcfce7' },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.expiredBadgeText,
                            { color: expiredAlerts.length > 0 ? '#b91c1c' : '#15803d' },
                          ]}
                        >
                          {expiredAlerts.length > 0 ? `${expiredAlerts.length} Perlu Cek` : 'Stok Aman'}
                        </ThemedText>
                      </View>
                    </View>

                    {expiredAlerts.length === 0 ? (
                      <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                        Semua produk dalam batas tanggal aman (tidak ada mendekati kadaluarsa dalam 30 hari).
                      </ThemedText>
                    ) : (
                      <View style={{ gap: 6 }}>
                        {expiredAlerts.slice(0, 3).map((item) => {
                          const isExpired = item.diffDays < 0;
                          const isToday = item.diffDays === 0;
                          return (
                            <View key={item.id} style={styles.expiredItemRow}>
                              <View style={{ flex: 1, paddingRight: 6 }}>
                                <ThemedText style={styles.expiredItemName} numberOfLines={1}>
                                  {item.name}
                                </ThemedText>
                                <ThemedText style={styles.expiredItemMeta}>
                                  Stok: {item.stock} • Tgl: {item.expired_date}
                                </ThemedText>
                              </View>
                              <View
                                style={[
                                  styles.diffTag,
                                  { backgroundColor: isExpired || isToday ? '#fee2e2' : '#fef3c7' },
                                ]}
                              >
                                <ThemedText
                                  style={[
                                    styles.diffTagText,
                                    { color: isExpired || isToday ? '#dc2626' : '#d97706' },
                                  ]}
                                >
                                  {isExpired
                                    ? `Lewat ${Math.abs(item.diffDays)} hari`
                                    : isToday
                                    ? 'Hari Ini!'
                                    : `Sisa ${item.diffDays} hari`}
                                </ThemedText>
                              </View>
                            </View>
                          );
                        })}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                          {expiredAlerts.length > 3 ? (
                            <ThemedText style={{ fontSize: 10, color: '#94a3b8' }}>
                              +{expiredAlerts.length - 3} produk lainnya
                            </ThemedText>
                          ) : <View />}
                          <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Colors.tintDark }}>
                              Kelola Stok ›
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </Card>
                </View>

                {/* Kolom Kanan: Stat Cards & Grafik Tren */}
                <View style={styles.landscapeCol}>
                  {/* Stat cards row */}
                  <View style={styles.cardsRow}>
                    <Card style={styles.statCard} padding={12}>
                      <ThemedText style={styles.statIcon}>📦</ThemedText>
                      <ThemedText style={styles.statNumber}>{summary.productCount}</ThemedText>
                      <ThemedText style={styles.statLabel}>Total Produk</ThemedText>
                    </Card>
                    <Card style={styles.statCard} padding={12}>
                      <ThemedText style={styles.statIcon}>🧾</ThemedText>
                      <ThemedText style={styles.statNumber}>{summary.todayCount}</ThemedText>
                      <ThemedText style={styles.statLabel}>Trx Hari Ini</ThemedText>
                    </Card>
                    <Card style={styles.statCard} padding={12}>
                      <ThemedText style={styles.statIcon}>📈</ThemedText>
                      <ThemedText style={styles.statNumber}>{summary.itemsSoldToday}</ThemedText>
                      <ThemedText style={styles.statLabel}>Item Terjual</ThemedText>
                    </Card>
                  </View>

                  {/* Grafik 7 Hari (Landscape) */}
                  <Card padding={16} style={{ flex: 1, backgroundColor: '#ffffff', borderColor: '#e2e8f0', justifyContent: 'space-between' }}>
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View>
                          <ThemedText style={styles.sectionTitle}>Tren Penjualan (7 Hari Terakhir)</ThemedText>
                          <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                            Grafik omzet harian toko secara realtime
                          </ThemedText>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <ThemedText style={{ fontSize: 10, color: '#64748b', fontWeight: '600' }}>Total 7 Hari</ThemedText>
                          <ThemedText style={{ fontSize: 15, fontWeight: '800', color: Colors.tintDark }}>
                            {formatRupiah(summary.week)}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.chartRow}>
                        {summary.weekTrend.map((d, i) => (
                          <View key={i} style={styles.chartCol}>
                            {d.total > 0 && (
                              <ThemedText style={styles.barAmount} numberOfLines={1}>
                                {formatShortRupiah(d.total)}
                              </ThemedText>
                            )}
                            <View style={styles.barWrapper}>
                              <View
                                style={[
                                  styles.bar,
                                  {
                                    height: `${Math.max(8, (d.total / maxTrend) * 100)}%`,
                                    backgroundColor: d.label === HARI_INI ? Colors.tintDark : '#94a3b8',
                                  },
                                ]}
                              />
                            </View>
                            <ThemedText style={[styles.barLabel, d.label === HARI_INI && { fontWeight: '800', color: Colors.tintDark }]}>
                              {d.label === HARI_INI ? 'Hari Ini' : d.label}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Ringkasan Analisis Mingguan (Mengisi Ruang Bawah Kartu) */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                      <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <ThemedText style={{ fontSize: 9.5, color: '#64748b', fontWeight: '600' }}>Puncak Omzet</ThemedText>
                        <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#0f172a', marginTop: 2 }} numberOfLines={1}>
                          {bestTrendDay && bestTrendDay.total > 0 ? `${bestTrendDay.label === HARI_INI ? 'Hari Ini' : bestTrendDay.label} (${formatShortRupiah(bestTrendDay.total)})` : '-'}
                        </ThemedText>
                      </View>
                      <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                        <ThemedText style={{ fontSize: 9.5, color: '#64748b', fontWeight: '600' }}>Rata-rata Harian</ThemedText>
                        <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#0f172a', marginTop: 2 }} numberOfLines={1}>
                          {formatRupiah(dailyAverage)}
                        </ThemedText>
                      </View>
                      <View style={{ flex: 1, backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' }}>
                        <ThemedText style={{ fontSize: 9.5, color: '#15803d', fontWeight: '700' }}>Omzet Minggu Ini</ThemedText>
                        <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#166534', marginTop: 2 }} numberOfLines={1}>
                          {formatRupiah(summary.week)}
                        </ThemedText>
                      </View>
                    </View>
                  </Card>
                </View>
              </View>
            ) : (
              /* TAMPILAN PORTRAIT / HP */
              <>
                {/* Saldo Kas Dual-Pocket Card (Kas Fisik & Kas Bank) */}
                {renderDualCashCard(false)}

                {/* Stat cards row */}
                <View style={styles.cardsRow}>
                  <Card style={styles.statCard} padding={10}>
                    <ThemedText style={styles.statIcon}>📦</ThemedText>
                    <ThemedText style={styles.statNumber}>{summary.productCount}</ThemedText>
                    <ThemedText style={styles.statLabel}>Produk</ThemedText>
                  </Card>
                  <Card style={styles.statCard} padding={10}>
                    <ThemedText style={styles.statIcon}>🧾</ThemedText>
                    <ThemedText style={styles.statNumber}>{summary.todayCount}</ThemedText>
                    <ThemedText style={styles.statLabel}>Transaksi</ThemedText>
                  </Card>
                  <Card style={styles.statCard} padding={10}>
                    <ThemedText style={styles.statIcon}>📈</ThemedText>
                    <ThemedText style={styles.statNumber}>{summary.itemsSoldToday}</ThemedText>
                    <ThemedText style={styles.statLabel}>Item Terjual</ThemedText>
                  </Card>
                </View>

                {/* Perbandingan Hari Ini vs Kemarin */}
                <Card padding={14} style={{ marginBottom: 12, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                  <View style={styles.compHeader}>
                    <View>
                      <ThemedText style={{ fontSize: 11, color: Colors.placeholder }}>
                        Penjualan Hari Ini
                      </ThemedText>
                      <ThemedText style={{ fontSize: 22, fontWeight: 'bold', marginTop: 2, color: '#1e293b' }}>
                        {formatRupiah(summary.today)}
                      </ThemedText>
                    </View>
                    <View style={[styles.badge, { backgroundColor: isUp ? '#dcfce7' : '#fee2e2' }]}>
                      <ThemedText
                        style={{
                          fontSize: 12,
                          color: isUp ? '#15803d' : '#b91c1c',
                          fontWeight: '700',
                        }}
                      >
                        {isUp ? '▲' : '▼'} {Math.abs(percentChange).toFixed(1)}%
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.compSub}>
                    <ThemedText style={{ fontSize: 11, color: Colors.placeholder }}>
                      Kemarin: {formatRupiah(summary.yesterday)}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, color: Colors.placeholder }}>
                      Rata-rata: {formatRupiah(summary.avgPerTransaction)}/trx
                    </ThemedText>
                  </View>
                </Card>

                {/* Grafik 7 Hari (Portrait) */}
                <Card padding={14} style={{ marginBottom: 12, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <ThemedText style={styles.sectionTitle}>Tren Penjualan (7 Hari)</ThemedText>
                    <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                      Total: {formatRupiah(summary.week)}
                    </ThemedText>
                  </View>
                  <View style={styles.chartRow}>
                    {summary.weekTrend.map((d, i) => (
                      <View key={i} style={styles.chartCol}>
                        {d.total > 0 && (
                          <ThemedText style={styles.barAmount} numberOfLines={1}>
                            {formatShortRupiah(d.total)}
                          </ThemedText>
                        )}
                        <View style={styles.barWrapper}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: `${Math.max(8, (d.total / maxTrend) * 100)}%`,
                                backgroundColor: d.label === HARI_INI ? Colors.tint : '#cbd5e1',
                              },
                            ]}
                          />
                        </View>
                        <ThemedText style={[styles.barLabel, d.label === HARI_INI && { fontWeight: '800', color: Colors.tintDark }]}>
                          {d.label === HARI_INI ? 'Hari Ini' : d.label}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </Card>

                {/* Ringkasan angka */}
                <View style={styles.cardsRow}>
                  <Card style={{ flex: 1, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }} padding={12}>
                    <ThemedText style={{ fontSize: 10, color: Colors.placeholder }}>7 Hari Terakhir</ThemedText>
                    <ThemedText style={{ fontSize: 15, fontWeight: 'bold', marginTop: 2, color: Colors.tintDark }}>
                      {formatRupiah(summary.week)}
                    </ThemedText>
                  </Card>
                  <Card style={{ flex: 1, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }} padding={12}>
                    <ThemedText style={{ fontSize: 10, color: Colors.placeholder }}>Bulan Ini</ThemedText>
                    <ThemedText style={{ fontSize: 15, fontWeight: 'bold', marginTop: 2, color: Colors.tintDark }}>
                      {formatRupiah(summary.month)}
                    </ThemedText>
                  </Card>
                </View>

                {/* Widget Peringatan Stok Menipis (Portrait) */}
                {renderLowStockCard(false)}

                {/* Widget Peringatan Kadaluarsa (Portrait) */}
                <Card padding={14} style={[styles.expiredCard, { marginBottom: 12 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemedText style={{ fontSize: 16 }}>⏳</ThemedText>
                      <ThemedText style={{ fontSize: 13, fontWeight: '800', color: '#1e293b' }}>
                        Peringatan Kadaluarsa
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.expiredBadge,
                        { backgroundColor: expiredAlerts.length > 0 ? '#fee2e2' : '#dcfce7' },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.expiredBadgeText,
                          { color: expiredAlerts.length > 0 ? '#b91c1c' : '#15803d' },
                        ]}
                      >
                        {expiredAlerts.length > 0 ? `${expiredAlerts.length} Perlu Cek` : 'Stok Aman'}
                      </ThemedText>
                    </View>
                  </View>

                  {expiredAlerts.length === 0 ? (
                    <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                      Semua produk dalam batas tanggal aman (tidak ada mendekati kadaluarsa dalam 30 hari).
                    </ThemedText>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {expiredAlerts.slice(0, 3).map((item) => {
                        const isExpired = item.diffDays < 0;
                        const isToday = item.diffDays === 0;
                        return (
                          <View key={item.id} style={styles.expiredItemRow}>
                            <View style={{ flex: 1, paddingRight: 6 }}>
                              <ThemedText style={styles.expiredItemName} numberOfLines={1}>
                                {item.name}
                              </ThemedText>
                              <ThemedText style={styles.expiredItemMeta}>
                                Stok: {item.stock} • Tgl: {item.expired_date}
                              </ThemedText>
                            </View>
                            <View
                              style={[
                                styles.diffTag,
                                { backgroundColor: isExpired || isToday ? '#fee2e2' : '#fef3c7' },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.diffTagText,
                                  { color: isExpired || isToday ? '#dc2626' : '#d97706' },
                                ]}
                              >
                                {isExpired
                                  ? `Lewat ${Math.abs(item.diffDays)} hari`
                                  : isToday
                                  ? 'Hari Ini!'
                                  : `Sisa ${item.diffDays} hari`}
                              </ThemedText>
                            </View>
                          </View>
                        );
                      })}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                        {expiredAlerts.length > 3 ? (
                          <ThemedText style={{ fontSize: 10, color: '#94a3b8' }}>
                            +{expiredAlerts.length - 3} produk lainnya
                          </ThemedText>
                        ) : <View />}
                        <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Colors.tintDark }}>
                            Kelola Stok ›
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </Card>
              </>
            )}
          </ScrollView>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TOMBOL MASUK KASIR PALING BAWAH (TEPAT DI ATAS NAVIGASI MENU) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <View style={styles.bottomCashierContainer}>
            <TouchableOpacity
              style={styles.cashierBottomBtn}
              onPress={() => router.push('/transaksi')}
              activeOpacity={0.88}
            >
              <View style={styles.cashierBottomIconBox}>
                <ThemedText style={{ fontSize: 22 }}>⚡</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.cashierBottomTitle}>Buka Layar Kasir</ThemedText>
                <ThemedText style={styles.cashierBottomSub}>
                  Mulai transaksi kasir baru sekarang • {summary.todayCount} transaksi hari ini
                </ThemedText>
              </View>
              <View style={styles.cashierEnterTag}>
                <ThemedText style={styles.cashierEnterTagText}>Masuk Kasir ›</ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Cash Shift Modal */}
      <CashShiftModal
        visible={shiftModalVisible}
        onClose={() => {
          setShiftModalVisible(false);
          loadSummary();
        }}
      />

      {/* Cash Denomination Modal (Hitung Pecahan Uang Kas Fisik) */}
      <CashDenominationModal
        visible={denominationModalVisible}
        onClose={() => setDenominationModalVisible(false)}
        currentHandBalance={cashHandBalance}
        initialCounts={denominations?.counts}
        onSave={async (newCounts) => {
          await saveDenominations(db, newCounts);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  topHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  topHeaderCardPortrait: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  headerBottomRowPortrait: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  karyaPolnesText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.tintDark,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  storeLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  storeLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  orientationToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orientationToggleBtnActive: {
    backgroundColor: '#f5f3ff',
    borderColor: '#c4b5fd',
  },
  orientationToggleIcon: {
    fontSize: 14,
  },
  orientationToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  orientationToggleTextActive: {
    color: Colors.tintDark,
  },
  cashierBannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoWrapper: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  polnesLogo: {
    width: '100%',
    height: '100%',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  brandIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: { fontSize: 24 },
  brandSub: { fontSize: 11, color: Colors.placeholder },
  modeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  modeTagRetail: {
    backgroundColor: '#e0e7ff',
  },
  modeTagText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  modeTagTextRetail: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#3730a3',
  },
  modeTagKuliner: {
    backgroundColor: '#fef3c7',
  },
  modeTagTextKuliner: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#92400e',
  },
  cashierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.tint,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: Colors.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  bannerDesc: {
    color: '#e9d5ff',
    fontSize: 11,
    marginTop: 2,
  },
  bannerBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bannerBtnText: {
    color: Colors.tintDark,
    fontSize: 11,
    fontWeight: '700',
  },
  cashBalanceCard: {
    backgroundColor: '#ffffff',
    borderColor: Colors.tint + '40',
    borderWidth: 1.5,
    marginBottom: 12,
  },
  openLedgerBtn: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openLedgerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tintDark,
  },
  cashPocketContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 6,
  },
  denomBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  denomActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  denomActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tintDark,
  },
  denomChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  denomChipText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  bankQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  bankQuickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  cardsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  statIcon: { fontSize: 20 },
  statNumber: { fontSize: 18, fontWeight: 'bold', marginVertical: 2, color: '#1e293b' },
  statLabel: { fontSize: 11, color: Colors.placeholder },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  compSub: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, color: '#1e293b' },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    gap: 8,
    paddingTop: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6,
  },
  chartCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barAmount: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  bar: {
    width: 24,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 6,
  },
  barLabel: { fontSize: 10, color: '#64748b', marginTop: 6, fontWeight: '600' },
  cashMetricsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  cashMetricCard: {
    flex: 1,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
  },
  lowStockCard: {
    backgroundColor: '#ffffff',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 12,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  roleBadgeIcon: { fontSize: 14 },
  roleBadgeRole: { fontSize: 11, fontWeight: '800', color: '#1e293b' },
  roleBadgeAction: { fontSize: 9, color: '#64748b' },
  landscapeGrid: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
  },
  landscapeCol: {
    flex: 1,
    gap: 12,
  },
  cashBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cashSubItem: { flex: 1 },
  cashSubLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
  cashSubVal: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginTop: 2 },
  cashSubDivider: { width: 1, height: 24, backgroundColor: '#e2e8f0', marginHorizontal: 8 },
  compCard: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
  bottomCashierContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  cashierBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: Colors.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    gap: 12,
  },
  cashierBottomIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashierBottomTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  cashierBottomSub: {
    color: '#e9d5ff',
    fontSize: 11,
    marginTop: 2,
  },
  cashierEnterTag: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cashierEnterTagText: {
    color: Colors.tintDark,
    fontSize: 12,
    fontWeight: '800',
  },
  shiftBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  shiftBadgeActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  shiftBadgeInactive: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  shiftDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  shiftDotActive: {
    backgroundColor: '#10b981',
  },
  shiftDotInactive: {
    backgroundColor: '#f59e0b',
  },
  shiftBadgeRole: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },
  shiftBadgeAction: {
    fontSize: 9.5,
    color: '#64748b',
  },
  expiredCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  expiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  expiredBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  expiredItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  expiredItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  expiredItemMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  diffTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  diffTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
});