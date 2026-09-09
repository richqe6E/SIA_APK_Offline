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
import { Colors, Shadows } from '@/constants/theme';
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

        {/* Dedicated Realtime Clock Bar - Tidak Bertabrakan */}
        <View style={styles.clockRow}>
          <RealtimeClockBadge compact={false} />
        </View>

        {/* Dedicated Connection Status Pill */}
        <View style={styles.statusBar}>
          <View
            style={[
              styles.syncDot,
              isCloudConnected ? styles.syncDotConnected : styles.syncDotOffline,
            ]}
          />
          <ThemedText style={styles.syncText} numberOfLines={1}>
            {cloudSyncStatus === 'syncing'
              ? 'Menyinkronkan data toko...'
              : isCloudConnected
              ? `Tersambung ke Tablet Toko (${storePairingCode}) • Update: ${lastSyncTime || 'Baru saja'}`
              : `Menghubungkan (${storePairingCode})...`}
          </ThemedText>
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
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
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
    backgroundColor: '#ede9fe',
    borderColor: '#c4b5fd',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6d28d9',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
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
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 16,
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },
  clockRow: {
    width: '100%',
    marginTop: 4,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncDotConnected: {
    backgroundColor: '#16a34a',
  },
  syncDotOffline: {
    backgroundColor: '#dc2626',
  },
  syncText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
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
    color: '#64748b',
  },
  cardHero: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    ...Shadows.sm,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Shadows.sm,
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
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxCash: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxPnl: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxDebt: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxTop: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 18,
  },
  heroCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  cardHeroNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  cardHeroNumberCash: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284c7',
    marginTop: 2,
  },
  cardHeroNumberPnl: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  yesterdayBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  yesterdayLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
  },
  yesterdayVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  pnlDetailBtn: {
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pnlDetailBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6d28d9',
  },
  metricsGrid: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  metricItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricLbl: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  pnlSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  pnlGridItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pnlGridLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  pnlGridVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
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
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  pocketBank: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
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
    color: '#475569',
  },
  pocketAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  pocketDesc: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  denomChipsContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  denomTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  denomChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  denomChip: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  denomChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
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
    backgroundColor: '#475569',
  },
  actionBtnIcon: {
    fontSize: 14,
  },
  actionBtnText: {
    color: '#ffffff',
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
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  debtBoxCol: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  debtBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  recAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0284c7',
    marginTop: 2,
  },
  debtAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ea580c',
    marginTop: 2,
  },
  debtBoxSub: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  manageDebtBtn: {
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  manageDebtBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
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
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  shiftIcon: {
    fontSize: 16,
  },
  shiftLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
  },
  shiftCashierName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
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
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  shiftClosedBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
  },
  shiftStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  mutationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  mutationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeIn: {
    backgroundColor: '#dcfce7',
  },
  badgeOut: {
    backgroundColor: '#fee2e2',
  },
  mutationBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#475569',
  },
  mutationCatName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  mutationSubText: {
    fontSize: 10,
    color: '#64748b',
  },
  mutationVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  alertCard: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
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
    color: '#ea580c',
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
    backgroundColor: '#fee2e2',
  },
  chipWarning: {
    backgroundColor: '#fef3c7',
  },
  chipExpired: {
    backgroundColor: '#ede9fe',
  },
  alertChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
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
    borderBottomColor: '#f1f5f9',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d97706',
  },
  topProductName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  topProductSub: {
    fontSize: 10,
    color: '#64748b',
  },
  topProductRevenue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284c7',
  },
  emptyText: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
