import { OnboardingModal } from '@/components/onboarding-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import { useCashStore } from '@/stores/cashStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HARI_INI = 'Hari Ini';

function formatRupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);

  const { storeName, businessType, businessMode, isOnboarded, loadSettings } = useSettingsStore();
  const { currentBalance, loadLedger } = useCashStore();

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

    const today = await db.getFirstAsync<{ total: number; count: number }>(
      "SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM transactions WHERE date(created_at) = date('now','localtime')"
    );
    const yesterday = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(total),0) as total FROM transactions WHERE date(created_at) = date('now','localtime','-1 day')"
    );
    const week = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(total),0) as total FROM transactions WHERE created_at >= datetime('now','localtime','-7 days')"
    );
    const month = await db.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(total),0) as total FROM transactions WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime')"
    );
    const productCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM products'
    );

    const avgResult = await db.getFirstAsync<{ avg: number }>(
      "SELECT COALESCE(ROUND(AVG(total)),0) as avg FROM transactions WHERE date(created_at) = date('now','localtime')"
    );

    const itemsSold = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(ti.quantity),0) as total FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE date(t.created_at) = date('now','localtime')`
    );

    const weekTrend = await db.getAllAsync<{ day: string; total: number }>(
      `SELECT date(created_at) as day, COALESCE(SUM(total),0) as total
       FROM transactions
       WHERE created_at >= datetime('now','localtime','-6 days')
       GROUP BY date(created_at)
       ORDER BY day ASC`
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const fullWeek: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayIdx = d.getDay();
      const found = weekTrend.find((r) => r.day === dateKey);
      fullWeek.push({
        label: dateKey === todayStr ? HARI_INI : DAY_LABELS[dayIdx],
        total: found?.total ?? 0,
      });
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
  const percentChange =
    summary.yesterday > 0
      ? ((summary.today - summary.yesterday) / summary.yesterday) * 100
      : summary.today > 0
        ? 100
        : 0;
  const isUp = percentChange >= 0;

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
      ]}
    >
      {/* Onboarding Wizard jika pertama kali buka */}
      <OnboardingModal visible={!isOnboarded} onComplete={loadSummary} />

      {/* Brand & Campus Collaboration Header */}
      <View style={styles.topHeaderCard}>
        <View style={styles.headerLeft}>
          <ThemedText style={styles.karyaPolnesText}>
            POS Offline Karya Jurusan Akuntansi Polnes
          </ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <View style={styles.brandIconCircle}>
              <ThemedText style={styles.brandIcon}>
                {businessMode === 'retail' ? '🛒' : '☕'}
              </ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="title" style={{ fontSize: 18, color: '#1e1b4b', fontWeight: '800' }} numberOfLines={1}>
                {storeName}
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View
                  style={[
                    styles.modeTag,
                    businessMode === 'kuliner' ? styles.modeTagKuliner : styles.modeTagRetail,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.modeTagText,
                      businessMode === 'kuliner' ? styles.modeTagTextKuliner : styles.modeTagTextRetail,
                    ]}
                  >
                    {businessMode === 'retail' ? 'Mode Retail' : 'Mode Kuliner'}
                  </ThemedText>
                </View>
                <ThemedText style={styles.brandSub}>• {businessType}</ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.logoWrapper}>
          <Image
            source={require('@/assets/images/polnes-logo.png')}
            style={styles.polnesLogo}
            resizeMode="contain"
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Quick Start Cashier Banner */}
          <TouchableOpacity
            style={styles.cashierBanner}
            onPress={() => router.push('/transaksi')}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.bannerTitle}>Buka Layar Kasir</ThemedText>
              <ThemedText style={styles.bannerDesc}>
                Transaksi cepat landscape (Katalog + Keranjang)
              </ThemedText>
            </View>
            <View style={styles.bannerBtn}>
              <ThemedText style={styles.bannerBtnText}>Masuk Kasir ›</ThemedText>
            </View>
          </TouchableOpacity>

          {/* Saldo Kas Riil Card (Akuntansi Polnes) */}
          <Card padding={14} style={styles.cashBalanceCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <ThemedText style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>
                  SALDO KAS FISIK DI TANGAN
                </ThemedText>
                <ThemedText
                  style={{
                    fontSize: 24,
                    fontWeight: '800',
                    color: currentBalance >= 0 ? Colors.tintDark : Colors.danger,
                    marginTop: 2,
                  }}
                >
                  {formatRupiah(currentBalance)}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={styles.openLedgerBtn}
                onPress={() => router.push('/(tabs)/financial-reports')}
              >
                <ThemedText style={styles.openLedgerText}>Buku Kas ›</ThemedText>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Stat cards row */}
          <View style={styles.cardsRow}>
            <Card style={styles.statCard} padding={10}>
              <ThemedText style={styles.statIcon}>{businessMode === 'retail' ? '📦' : '🍽️'}</ThemedText>
              <ThemedText style={styles.statNumber}>{summary.productCount}</ThemedText>
              <ThemedText style={styles.statLabel}>
                {businessMode === 'retail' ? 'Produk' : 'Menu'}
              </ThemedText>
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
          <Card padding={14} style={{ marginBottom: 14, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
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

          {/* Grafik 7 Hari */}
          <Card padding={14} style={{ marginBottom: 14, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
            <ThemedText style={styles.sectionTitle}>Tren Penjualan (7 Hari)</ThemedText>
            <View style={styles.chartRow}>
              {summary.weekTrend.map((d, i) => (
                <View key={i} style={styles.chartCol}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${(d.total / maxTrend) * 100}%`,
                          backgroundColor: d.label === HARI_INI ? Colors.tint : '#e9d5ff',
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={styles.barLabel}>
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
        </ScrollView>
      )}
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
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  karyaPolnesText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.tintDark,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
    height: 100,
    gap: 8,
  },
  chartCol: { flex: 1, alignItems: 'center' },
  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 14,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: { fontSize: 9, color: Colors.placeholder, marginTop: 4 },
});