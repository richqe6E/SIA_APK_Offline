import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { fetchSyncFromCloud, pushSyncToCloud, type StoreSyncPayload } from '@/services/cloudSync';

function formatRupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
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
      // First refresh local stores
      await Promise.all([
        loadLedger(db),
        loadDenominations(db),
        loadDebts(db),
        loadReceivables(db),
        loadActiveShift(db),
      ]);

      // Pull synced snapshot
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

  // Helper values from sync data or fallback to live stores
  const omsetToday = syncData?.todaySummary?.omset ?? 0;
  const txCount = syncData?.todaySummary?.transactionCount ?? 0;
  const avgTx = syncData?.todaySummary?.avgPerTransaction ?? 0;
  const estProfit = syncData?.todaySummary?.estimatedGrossProfit ?? 0;

  const cashHand = syncData?.cashLiquidity?.cashHand ?? cashHandBalance;
  const cashBank = syncData?.cashLiquidity?.cashBank ?? cashBankBalance;
  const totalCash = syncData?.cashLiquidity?.totalCash ?? totalBalance;

  const debtUnpaid = syncData?.debtReceivable?.totalDebtUnpaid ?? totalDebtUnpaid;
  const recUnpaid = syncData?.debtReceivable?.totalReceivableUnpaid ?? totalReceivableUnpaid;

  // Active cashier
  const activeCashier = syncData?.activeShift?.cashierName ?? currentShift?.cashier_name ?? null;

  // Stock alerts
  const outOfStock = syncData?.stockAlerts?.outOfStockCount ?? 0;
  const lowStock = syncData?.stockAlerts?.lowStockCount ?? 0;
  const expiredSoon = syncData?.stockAlerts?.expiredSoonCount ?? 0;

  // Top products
  const topProducts = syncData?.topProducts ?? [];

  // Denominations text
  const denomObj = syncData?.cashLiquidity?.denominations || denominations || {};
  const hasDenom = Object.keys(denomObj).length > 0;
  const denomSorted = Object.entries(denomObj)
    .map(([d, c]) => ({ denom: Number(d), count: Number(c) }))
    .sort((a, b) => b.denom - a.denom);

  return (
    <ThemedView style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.roleBadge}>
              <ThemedText style={styles.roleBadgeText}>👑 Pemantau Usaha (HP)</ThemedText>
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
              <ThemedText style={styles.refreshIcon}>🔄</ThemedText>
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
                ? 'Sedang menyinkronkan...'
                : isCloudConnected
                ? `Terhubung ke Toko (${storePairingCode}) • ${lastSyncTime || 'Baru saja'}`
                : `Menghubungkan (${storePairingCode})...`}
            </ThemedText>
          </View>
          <RealtimeClockBadge />
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.tint} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.tint} />
            <ThemedText style={styles.loadingText}>Memuat data toko dari cloud...</ThemedText>
          </View>
        ) : (
          <>
            {/* Card 1: Penjualan Realtime Hari Ini */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxSales}>
                  <ThemedText style={styles.cardIcon}>💰</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardLabel}>PENJUALAN HARI INI</ThemedText>
                  <ThemedText style={styles.cardHeroNumber}>{formatRupiah(omsetToday)}</ThemedText>
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
                    {formatRupiah(estProfit)}
                  </ThemedText>
                  <ThemedText style={styles.metricLbl}>Est. Laba Kotor</ThemedText>
                </View>
              </View>
            </Card>

            {/* Card 2: Likuiditas Kas Toko (Dual-Pocket) */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxCash}>
                  <ThemedText style={styles.cardIcon}>🏦</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardLabel}>TOTAL LIKUIDITAS KAS</ThemedText>
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
                    <ThemedText style={styles.pocketTitle}>Kas Fisik di Tangan</ThemedText>
                  </View>
                  <ThemedText style={styles.pocketAmount}>{formatRupiah(cashHand)}</ThemedText>
                  {hasDenom && (
                    <View style={styles.denomChipsContainer}>
                      <ThemedText style={styles.denomTitle}>Rincian Pecahan Fisik:</ThemedText>
                      <View style={styles.denomChipRow}>
                        {denomSorted.map((item) => (
                          <View key={item.denom} style={styles.denomChip}>
                            <ThemedText style={styles.denomChipText}>
                              {(item.denom >= 1000 ? item.denom / 1000 + 'k' : item.denom)}: {item.count} lbr
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Saku 2: Kas di Rekening Bank */}
                <View style={[styles.pocketBox, styles.pocketBank]}>
                  <View style={styles.pocketHeader}>
                    <ThemedText style={styles.pocketIcon}>🏛️</ThemedText>
                    <ThemedText style={styles.pocketTitle}>Kas di Rekening Bank</ThemedText>
                  </View>
                  <ThemedText style={styles.pocketAmount}>{formatRupiah(cashBank)}</ThemedText>
                  <ThemedText style={styles.pocketDesc}>
                    Hasil QRIS, Transfer, dan Setoran Fisik
                  </ThemedText>
                </View>
              </View>

              {/* Action Buttons for Mobile Owner */}
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
                  <ThemedText style={styles.actionBtnText}>Buku Kas Lengkap</ThemedText>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Card 3: Utang & Piutang Berjalan */}
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
                  <ThemedText style={styles.debtBoxSub}>Belum dilunasi customer</ThemedText>
                </View>

                {/* Utang Supplier */}
                <View style={[styles.debtBox, styles.debtBoxCol]}>
                  <ThemedText style={styles.debtBoxLabel}>Utang ke Supplier</ThemedText>
                  <ThemedText style={styles.debtAmount}>{formatRupiah(debtUnpaid)}</ThemedText>
                  <ThemedText style={styles.debtBoxSub}>Kewajiban kulakan/stok</ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={styles.manageDebtBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/debt-receivable' as any)}
              >
                <ThemedText style={styles.manageDebtBtnText}>
                  👥 Kelola Utang & Pembayaran Piutang ›
                </ThemedText>
              </TouchableOpacity>
            </Card>

            {/* Card 4: Status Shift & Kasir di Toko */}
            <Card style={styles.card} padding={16}>
              <View style={styles.shiftRow}>
                <View style={styles.shiftIconBox}>
                  <ThemedText style={styles.shiftIcon}>👤</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.shiftLabel}>STATUS KASIR DI TOKO</ThemedText>
                  <ThemedText style={styles.shiftCashierName}>
                    {activeCashier ? `Kasir Bertugas: ${activeCashier}` : 'Belum Ada Shift Kasir Buka'}
                  </ThemedText>
                  {syncData?.activeShift && (
                    <ThemedText style={styles.shiftTime}>
                      Shift ke-{syncData.activeShift.shiftNumber} • Modal Awal:{' '}
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

            {/* Card 5: Peringatan Stok & Expired */}
            {(outOfStock > 0 || lowStock > 0 || expiredSoon > 0) && (
              <Card style={[styles.card, styles.alertCard]} padding={16}>
                <View style={styles.alertHeader}>
                  <ThemedText style={styles.alertIcon}>⚠️</ThemedText>
                  <ThemedText style={styles.alertTitle}>Pemberitahuan Penting Usaha</ThemedText>
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

            {/* Card 6: Top 5 Produk Terlaris Hari Ini */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxTop}>
                  <ThemedText style={styles.cardIcon}>🏆</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardLabel}>PRODUK TERLARIS HARI INI</ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    Performa 5 produk paling laris terjual
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
                          {p.qty} terjual
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
    backgroundColor: '#f3e8ff',
    borderColor: '#d8b4fe',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7e22ce',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
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
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: {
    fontSize: 16,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  syncStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
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
    backgroundColor: '#f59e0b',
  },
  syncText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardIconBoxSales: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconBoxCash: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconBoxDebt: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconBoxTop: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fef9c3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 22,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  cardHeroNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  cardHeroNumberCash: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e40af',
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  metricLbl: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  pocketsRow: {
    gap: 10,
    marginTop: 4,
  },
  pocketBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pocketHand: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  pocketBank: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  pocketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pocketIcon: {
    fontSize: 15,
  },
  pocketTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  pocketAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  pocketDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  denomChipsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
  },
  denomTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  denomChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  denomChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  denomChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  cashActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnSetorBank: {
    backgroundColor: '#2563eb',
  },
  btnBukuKas: {
    backgroundColor: '#0f172a',
  },
  actionBtnIcon: {
    fontSize: 14,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  debtGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  debtBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  recBox: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  debtBoxCol: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  debtBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  recAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1d4ed8',
    marginTop: 4,
  },
  debtAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#c2410c',
    marginTop: 4,
  },
  debtBoxSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  manageDebtBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  manageDebtBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shiftIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shiftIcon: {
    fontSize: 20,
  },
  shiftLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  shiftCashierName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 1,
  },
  shiftTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  shiftStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shiftOpenBadge: {
    backgroundColor: '#dcfce7',
  },
  shiftClosedBadge: {
    backgroundColor: '#f1f5f9',
  },
  shiftStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  alertCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  alertIcon: {
    fontSize: 18,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  alertChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  alertChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipDanger: {
    backgroundColor: '#fee2e2',
  },
  chipWarning: {
    backgroundColor: '#fef3c7',
  },
  chipExpired: {
    backgroundColor: '#ffedd5',
  },
  alertChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350f',
  },
  topProductsList: {
    gap: 10,
    marginTop: 4,
  },
  topProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  topProductName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  topProductSub: {
    fontSize: 11,
    color: '#64748b',
  },
  topProductRevenue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});
