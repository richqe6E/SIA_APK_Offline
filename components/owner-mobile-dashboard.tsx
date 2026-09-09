import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { RealtimeClockBadge } from '@/components/realtime-clock-badge';
import { BankDepositModal } from '@/components/bank-deposit-modal';

import { useSettingsStore } from '@/stores/settingsStore';
import { useCashStore } from '@/stores/cashStore';
import { useDebtReceivableStore } from '@/stores/debtReceivableStore';
import { useShiftStore } from '@/stores/shiftStore';
import { fetchSyncFromCloud, type StoreSyncPayload } from '@/services/cloudSync';

function formatRupiah(n: number) {
  const sign = n < 0 ? '- ' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

export function OwnerMobileDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const {
    storeName,
    businessType,
    storePairingCode,
    isCloudConnected,
    cloudSyncStatus,
    logoutRole,
  } = useSettingsStore();

  const {
    cashHandBalance,
    cashBankBalance,
    totalBalance,
    denominations,
    loadLedger,
    loadDenominations,
  } = useCashStore();

  const {
    totalDebtUnpaid,
    totalReceivableUnpaid,
    loadDebts,
    loadReceivables,
  } = useDebtReceivableStore();

  const { currentShift, loadActiveShift } = useShiftStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBankDepositModal, setShowBankDepositModal] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncData, setSyncData] = useState<StoreSyncPayload | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      await Promise.all([
        loadLedger(db),
        loadDenominations(db),
        loadDebts(db),
        loadReceivables(db),
        loadActiveShift(db),
      ]);

      const res = await fetchSyncFromCloud(storePairingCode, db);
      if (res.success && res.payload) {
        setSyncData(res.payload);
        const now = new Date();
        setLastSyncTime(
          `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        );
      }
    } catch (e) {
      console.error('OwnerMobileDashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    db,
    storePairingCode,
    loadLedger,
    loadDenominations,
    loadDebts,
    loadReceivables,
    loadActiveShift,
  ]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleLogout = () => {
    Alert.alert(
      'Keluar dari Mode Pemantau',
      'Apakah Anda yakin ingin keluar dari mode pemantau usaha?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: () => logoutRole(),
        },
      ]
    );
  };

  // Sales & profit metrics
  const omsetToday = syncData?.todaySummary?.omset ?? 0;
  const omsetYesterday = syncData?.todaySummary?.omsetYesterday ?? 0;
  const omsetThisMonth = syncData?.todaySummary?.omsetThisMonth ?? 0;
  const txCount = syncData?.todaySummary?.transactionCount ?? 0;
  const avgTx = syncData?.todaySummary?.avgPerTransaction ?? 0;
  const estGrossProfit = syncData?.todaySummary?.estimatedGrossProfit ?? 0;
  const netProfitToday = syncData?.todaySummary?.netProfitToday ?? estGrossProfit;
  const operatingExpToday = syncData?.todaySummary?.operatingExpenses ?? 0;

  // Monthly P&L
  const monthlyPnl = syncData?.monthlyProfitLoss;
  const monthlySales = monthlyPnl?.penjualan ?? omsetThisMonth;
  const monthlyGross = monthlyPnl?.labaKotor ?? 0;
  const monthlyExpenses = monthlyPnl?.totalBeban ?? 0;
  const monthlyNet = monthlyPnl?.labaBersih ?? (monthlyGross - monthlyExpenses);

  // Cash & Liquidity
  const cashHand = syncData?.cashLiquidity?.cashHand ?? cashHandBalance;
  const cashBank = syncData?.cashLiquidity?.cashBank ?? cashBankBalance;
  const totalCash = syncData?.cashLiquidity?.totalCash ?? totalBalance;

  // Debts & Receivables
  const debtUnpaid = syncData?.debtReceivable?.totalDebtUnpaid ?? totalDebtUnpaid;
  const recUnpaid = syncData?.debtReceivable?.totalReceivableUnpaid ?? totalReceivableUnpaid;

  // Active cashier
  const activeCashier = syncData?.activeShift?.cashierName ?? currentShift?.cashier_name ?? null;

  // Stock alerts
  const outOfStock = syncData?.stockAlerts?.outOfStockCount ?? 0;
  const lowStock = syncData?.stockAlerts?.lowStockCount ?? 0;
  const expiredSoon = syncData?.stockAlerts?.expiredSoonCount ?? 0;

  // Lists
  const topProducts = syncData?.topProducts ?? [];
  const recentMutations = syncData?.recentLedger ?? [];
  const debtsList = syncData?.debtsList ?? [];
  const recList = syncData?.receivablesList ?? [];

  // Denominations
  const denomObj = syncData?.cashLiquidity?.denominations || denominations?.counts || {};
  const denomSorted = Object.entries(denomObj)
    .map(([d, c]) => ({ denom: Number(d), count: Number(c) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.denom - a.denom);

  return (
    <ThemedView style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.roleBadge}>
              <ThemedText style={styles.roleBadgeText}>👑 PEMANTAU USAHA (HP)</ThemedText>
            </View>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>
              {storeName}
            </ThemedText>
            <ThemedText style={styles.headerSubtitle}>{businessType}</ThemedText>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.7}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.refreshIcon}>🔄</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.logoutText}>Keluar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Realtime & Connection Status Pill */}
        <View style={styles.statusBar}>
          <View style={styles.syncStatusPill}>
            <View
              style={[
                styles.syncDot,
                isCloudConnected ? styles.syncDotConnected : styles.syncDotOffline,
              ]}
            />
            <ThemedText style={styles.syncText}>
              {cloudSyncStatus === 'syncing'
                ? 'Menyinkronkan data...'
                : isCloudConnected
                ? `Tersambung (${storePairingCode}) • Update: ${lastSyncTime || 'Baru saja'}`
                : `Menghubungkan (${storePairingCode})...`}
            </ThemedText>
          </View>
          <RealtimeClockBadge />
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.tint]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.tint} />
            <ThemedText style={styles.loadingText}>Memuat data toko dari cloud...</ThemedText>
          </View>
        ) : (
          <>
            {/* Card 1: Penjualan Realtime Hari Ini */}
            <Card style={styles.cardHero} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxSales}>
                  <ThemedText style={styles.cardIcon}>💰</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.heroCardLabel}>PENJUALAN HARI INI</ThemedText>
                  <ThemedText style={styles.cardHeroNumber}>{formatRupiah(omsetToday)}</ThemedText>
                </View>
                <View style={styles.yesterdayBox}>
                  <ThemedText style={styles.yesterdayLabel}>Kemarin</ThemedText>
                  <ThemedText style={styles.yesterdayVal}>{formatRupiah(omsetYesterday)}</ThemedText>
                </View>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <ThemedText style={styles.metricVal}>{txCount}</ThemedText>
                  <ThemedText style={styles.metricLbl}>Transaksi</ThemedText>
                </View>
                <View style={styles.metricItem}>
                  <ThemedText style={styles.metricVal}>{formatRupiah(avgTx)}</ThemedText>
                  <ThemedText style={styles.metricLbl}>Rata-rata/Nota</ThemedText>
                </View>
                <View style={styles.metricItem}>
                  <ThemedText style={[styles.metricVal, { color: '#16a34a' }]}>
                    {formatRupiah(netProfitToday)}
                  </ThemedText>
                  <ThemedText style={styles.metricLbl}>Est. Laba Bersih</ThemedText>
                </View>
              </View>
            </Card>

            {/* Card 2: Likuiditas Kas Toko (Dual-Pocket Terpadu) */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxCash}>
                  <ThemedText style={styles.cardIcon}>🏦</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardLabel}>TOTAL LIKUIDITAS KAS TOKO</ThemedText>
                  <ThemedText style={styles.cardHeroNumberCash}>
                    {formatRupiah(totalCash)}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.pocketsRow}>
                {/* Saku 1: Kas Fisik di Tangan */}
                <View style={[styles.pocketBox, styles.pocketHand]}>
                  <View style={styles.pocketHeader}>
                    <ThemedText style={styles.pocketIcon}>💵</ThemedText>
                    <ThemedText style={styles.pocketTitle}>Kas Fisik Laci Toko</ThemedText>
                  </View>
                  <ThemedText style={styles.pocketAmount}>{formatRupiah(cashHand)}</ThemedText>
                  <ThemedText style={styles.pocketDesc}>Uang tunai di kasir</ThemedText>
                </View>

                {/* Saku 2: Kas di Rekening Bank */}
                <View style={[styles.pocketBox, styles.pocketBank]}>
                  <View style={styles.pocketHeader}>
                    <ThemedText style={styles.pocketIcon}>🏛️</ThemedText>
                    <ThemedText style={styles.pocketTitle}>Kas di Rekening Bank</ThemedText>
                  </View>
                  <ThemedText style={styles.pocketAmount}>{formatRupiah(cashBank)}</ThemedText>
                  <ThemedText style={styles.pocketDesc}>QRIS, Transfer & Setoran</ThemedText>
                </View>
              </View>

              {/* Rincian Pecahan Uang Fisik jika ada */}
              {denomSorted.length > 0 && (
                <View style={styles.denomChipsContainer}>
                  <ThemedText style={styles.denomTitle}>Rincian Pecahan Fisik Kasir:</ThemedText>
                  <View style={styles.denomChipRow}>
                    {denomSorted.map((item) => (
                      <View key={item.denom} style={styles.denomChip}>
                        <ThemedText style={styles.denomChipText}>
                          {item.denom >= 1000 ? `${item.denom / 1000}k` : item.denom}: {item.count} lbr
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.cashActionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnSetorBank]}
                  activeOpacity={0.8}
                  onPress={() => setShowBankDepositModal(true)}
                >
                  <ThemedText style={styles.actionBtnIcon}>🏦</ThemedText>
                  <ThemedText style={styles.actionBtnText}>Setor Fisik ke Bank</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnBukuKas]}
                  activeOpacity={0.8}
                  onPress={() => router.push('/financial-reports' as any)}
                >
                  <ThemedText style={styles.actionBtnIcon}>📑</ThemedText>
                  <ThemedText style={styles.actionBtnText}>Laporan Lengkap</ThemedText>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Card 3: Ringkasan Laba / Rugi Bulan Ini (P&L) */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxPnl}>
                  <ThemedText style={styles.cardIcon}>📊</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardLabel}>
                    LABA / RUGI ({monthlyPnl?.periodLabel || 'Bulan Ini'})
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.cardHeroNumberPnl,
                      monthlyNet < 0 ? { color: '#ef4444' } : { color: '#16a34a' },
                    ]}
                  >
                    {formatRupiah(monthlyNet)}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.pnlDetailBtn}
                  onPress={() => router.push('/financial-reports' as any)}
                >
                  <ThemedText style={styles.pnlDetailBtnText}>Rincian ›</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.pnlSummaryGrid}>
                <View style={styles.pnlGridItem}>
                  <ThemedText style={styles.pnlGridLabel}>Omset Bulan Ini</ThemedText>
                  <ThemedText style={styles.pnlGridVal}>{formatRupiah(monthlySales)}</ThemedText>
                </View>
                <View style={styles.pnlGridItem}>
                  <ThemedText style={styles.pnlGridLabel}>Beban Operasional</ThemedText>
                  <ThemedText style={[styles.pnlGridVal, { color: '#ef4444' }]}>
                    {formatRupiah(monthlyExpenses)}
                  </ThemedText>
                </View>
              </View>
            </Card>

            {/* Card 4: Utang & Piutang Berjalan */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxDebt}>
                  <ThemedText style={styles.cardIcon}>⚖️</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardLabel}>STATUS UTANG & PIUTANG</ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    Pantau tagihan pelanggan & kewajiban supplier
                  </ThemedText>
                </View>
              </View>

              <View style={styles.debtGrid}>
                {/* Piutang Pelanggan */}
                <View style={[styles.debtBox, styles.recBox]}>
                  <ThemedText style={styles.debtBoxLabel}>Piutang Pelanggan</ThemedText>
                  <ThemedText style={styles.recAmount}>{formatRupiah(recUnpaid)}</ThemedText>
                  <ThemedText style={styles.debtBoxSub}>Belum lunas di toko</ThemedText>
                </View>

                {/* Utang Supplier */}
                <View style={[styles.debtBox, styles.debtBoxCol]}>
                  <ThemedText style={styles.debtBoxLabel}>Utang ke Supplier</ThemedText>
                  <ThemedText style={styles.debtAmount}>{formatRupiah(debtUnpaid)}</ThemedText>
                  <ThemedText style={styles.debtBoxSub}>Kewajiban kulakan stok</ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={styles.manageDebtBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/debt-receivable' as any)}
              >
                <ThemedText style={styles.manageDebtBtnText}>
                  👥 Kelola Utang & Tagihan Piutang Lengkap ›
                </ThemedText>
              </TouchableOpacity>
            </Card>

            {/* Card 5: Status Shift & Kasir di Toko */}
            <Card style={styles.card} padding={16}>
              <View style={styles.shiftRow}>
                <View style={styles.shiftIconBox}>
                  <ThemedText style={styles.shiftIcon}>👤</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.shiftLabel}>STATUS KASIR DI TOKO</ThemedText>
                  <ThemedText style={styles.shiftCashierName}>
                    {activeCashier ? `Kasir: ${activeCashier}` : 'Belum Ada Shift Kasir Aktif'}
                  </ThemedText>
                  {syncData?.activeShift && (
                    <ThemedText style={styles.shiftTime}>
                      Buka: {syncData.activeShift.openedAt} • Modal Kasir:{' '}
                      {formatRupiah(syncData.activeShift.initialCash)}
                    </ThemedText>
                  )}
                </View>
                <View
                  style={[
                    styles.shiftStatusBadge,
                    activeCashier ? styles.shiftOpenBadge : styles.shiftClosedBadge,
                  ]}
                >
                  <ThemedText style={styles.shiftStatusText}>
                    {activeCashier ? 'Shift Aktif' : 'Tutup'}
                  </ThemedText>
                </View>
              </View>
            </Card>

            {/* Card 6: 5 Mutasi Kas Terakhir */}
            {recentMutations.length > 0 && (
              <Card style={styles.card} padding={16}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardLabel}>MUTASI KAS TERKINI</ThemedText>
                  <TouchableOpacity onPress={() => router.push('/financial-reports' as any)}>
                    <ThemedText style={styles.viewAllText}>Semua ›</ThemedText>
                  </TouchableOpacity>
                </View>
                {recentMutations.slice(0, 5).map((m) => {
                  const isIn = m.type === 'in';
                  return (
                    <View key={m.id} style={styles.mutationRow}>
                      <View
                        style={[
                          styles.mutationBadge,
                          isIn ? styles.badgeIn : styles.badgeOut,
                        ]}
                      >
                        <ThemedText style={styles.mutationBadgeText}>
                          {isIn ? 'MASUK' : 'KELUAR'}
                        </ThemedText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.mutationCatName}>
                          {m.category.replace(/_/g, ' ').toUpperCase()}
                        </ThemedText>
                        <ThemedText style={styles.mutationSubText} numberOfLines={1}>
                          {m.note || (isIn ? 'Kas Masuk' : 'Pengeluaran')}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={[
                          styles.mutationVal,
                          isIn ? { color: '#16a34a' } : { color: '#dc2626' },
                        ]}
                      >
                        {isIn ? '+' : '-'} {formatRupiah(m.amount)}
                      </ThemedText>
                    </View>
                  );
                })}
              </Card>
            )}

            {/* Card 7: Peringatan Stok & Expired */}
            {(outOfStock > 0 || lowStock > 0 || expiredSoon > 0) && (
              <Card style={[styles.card, styles.alertCard]} padding={16}>
                <View style={styles.alertHeader}>
                  <ThemedText style={styles.alertIcon}>⚠️</ThemedText>
                  <ThemedText style={styles.alertTitle}>Peringatan Stok & Kedaluwarsa</ThemedText>
                </View>

                <View style={styles.alertChipsRow}>
                  {outOfStock > 0 && (
                    <View style={[styles.alertChip, styles.chipDanger]}>
                      <ThemedText style={styles.alertChipText}>
                        🚫 {outOfStock} Produk Habis
                      </ThemedText>
                    </View>
                  )}
                  {lowStock > 0 && (
                    <View style={[styles.alertChip, styles.chipWarning]}>
                      <ThemedText style={styles.alertChipText}>
                        📦 {lowStock} Stok Menipis
                      </ThemedText>
                    </View>
                  )}
                  {expiredSoon > 0 && (
                    <View style={[styles.alertChip, styles.chipExpired]}>
                      <ThemedText style={styles.alertChipText}>
                        ⏳ {expiredSoon} Mendekati Expired
                      </ThemedText>
                    </View>
                  )}
                </View>
              </Card>
            )}

            {/* Card 8: Top 5 Produk Terlaris Hari Ini */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxTop}>
                  <ThemedText style={styles.cardIcon}>🏆</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardLabel}>PRODUK TERLARIS HARI INI</ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    5 produk paling diminati pembeli
                  </ThemedText>
                </View>
              </View>

              {topProducts.length === 0 ? (
                <ThemedText style={styles.emptyText}>
                  Belum ada transaksi produk hari ini
                </ThemedText>
              ) : (
                <View style={styles.topProductsList}>
                  {topProducts.map((p, idx) => (
                    <View key={p.id} style={styles.topProductItem}>
                      <View style={styles.rankBadge}>
                        <ThemedText style={styles.rankText}>{idx + 1}</ThemedText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.topProductName} numberOfLines={1}>
                          {p.name}
                        </ThemedText>
                        <ThemedText style={styles.topProductSub}>
                          {p.qty} item terjual
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.topProductRevenue}>
                        {formatRupiah(p.revenue)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Modal Setor Kas Fisik ke Bank */}
      <BankDepositModal
        visible={showBankDepositModal}
        currentBalance={cashHand}
        onClose={() => {
          setShowBankDepositModal(false);
          loadDashboardData();
        }}
        onSuccess={() => {
          setShowBankDepositModal(false);
          loadDashboardData();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  headerBar: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#38bdf822',
    borderColor: '#38bdf8',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 16,
  },
  logoutBtn: {
    backgroundColor: '#dc262622',
    borderColor: '#dc2626',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  syncStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncDotConnected: {
    backgroundColor: '#22c55e',
  },
  syncDotOffline: {
    backgroundColor: '#ef4444',
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  cardHero: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#38bdf855',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardIconBoxSales: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#38bdf822',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxCash: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#16a34a22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxPnl: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#8b5cf622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxDebt: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ea580c22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxTop: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f59e0b22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 18,
  },
  heroCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.5,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  cardHeroNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#f8fafc',
    marginTop: 2,
  },
  cardHeroNumberCash: {
    fontSize: 22,
    fontWeight: '900',
    color: '#38bdf8',
    marginTop: 2,
  },
  cardHeroNumberPnl: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  yesterdayBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#334155',
  },
  yesterdayLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
  },
  yesterdayVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  pnlDetailBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pnlDetailBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  metricsGrid: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
  },
  metricLbl: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  pnlSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  pnlGridItem: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
  },
  pnlGridLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  pnlGridVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 2,
  },
  pocketsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  pocketBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  pocketHand: {
    backgroundColor: '#14532d22',
    borderColor: '#16a34a44',
  },
  pocketBank: {
    backgroundColor: '#0c4a6e22',
    borderColor: '#0284c744',
  },
  pocketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pocketIcon: {
    fontSize: 14,
  },
  pocketTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  pocketAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#f8fafc',
  },
  pocketDesc: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 2,
  },
  denomChipsContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  denomTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
  },
  denomChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  denomChip: {
    backgroundColor: '#1e293b',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  denomChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
  },
  cashActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  btnSetorBank: {
    backgroundColor: '#0284c7',
  },
  btnBukuKas: {
    backgroundColor: '#334155',
  },
  actionBtnIcon: {
    fontSize: 14,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  debtGrid: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 10,
  },
  debtBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  recBox: {
    backgroundColor: '#0c4a6e22',
    borderColor: '#0284c744',
  },
  debtBoxCol: {
    backgroundColor: '#451a0322',
    borderColor: '#ea580c44',
  },
  debtBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  recAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#38bdf8',
    marginTop: 2,
  },
  debtAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#f97316',
    marginTop: 2,
  },
  debtBoxSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  manageDebtBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  manageDebtBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shiftIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftIcon: {
    fontSize: 16,
  },
  shiftLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
  },
  shiftCashierName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
  },
  shiftTime: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  shiftStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  shiftOpenBadge: {
    backgroundColor: '#16a34a22',
  },
  shiftClosedBadge: {
    backgroundColor: '#334155',
  },
  shiftStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4ade80',
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38bdf8',
  },
  mutationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 8,
  },
  mutationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeIn: {
    backgroundColor: '#16a34a22',
  },
  badgeOut: {
    backgroundColor: '#dc262622',
  },
  mutationBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  mutationCatName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  mutationSubText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  mutationVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  alertCard: {
    backgroundColor: '#451a0322',
    borderColor: '#ea580c55',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  alertIcon: {
    fontSize: 16,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fb923c',
  },
  alertChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  alertChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipDanger: {
    backgroundColor: '#dc262633',
  },
  chipWarning: {
    backgroundColor: '#d9770633',
  },
  chipExpired: {
    backgroundColor: '#7c3aed33',
  },
  alertChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f8fafc',
  },
  topProductsList: {
    gap: 8,
    marginTop: 6,
  },
  topProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f59e0b22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f59e0b',
  },
  topProductName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
  },
  topProductSub: {
    fontSize: 10,
    color: '#94a3b8',
  },
  topProductRevenue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38bdf8',
  },
  emptyText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
