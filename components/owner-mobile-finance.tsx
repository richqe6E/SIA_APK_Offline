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
import { BankDepositModal } from '@/components/bank-deposit-modal';

import { useSettingsStore } from '@/stores/settingsStore';
import { useCashStore } from '@/stores/cashStore';
import { useDebtReceivableStore } from '@/stores/debtReceivableStore';
import { fetchSyncFromCloud, type StoreSyncPayload } from '@/services/cloudSync';

function formatRupiah(n: number) {
  const sign = n < 0 ? '- ' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

type FinanceTab = 'labarugi' | 'bukukas' | 'utangpiutang';

export function OwnerMobileFinance() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const { storeName, businessType, storePairingCode, isCloudConnected } = useSettingsStore();
  const { cashHandBalance, cashBankBalance, totalBalance, denominations, loadLedger } = useCashStore();
  const { totalDebtUnpaid, totalReceivableUnpaid, loadDebts, loadReceivables } = useDebtReceivableStore();

  const [activeTab, setActiveTab] = useState<FinanceTab>('labarugi');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncData, setSyncData] = useState<StoreSyncPayload | null>(null);
  const [showBankDepositModal, setShowBankDepositModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await Promise.all([loadLedger(db), loadDebts(db), loadReceivables(db)]);
      const res = await fetchSyncFromCloud(storePairingCode, db);
      if (res.success && res.payload) {
        setSyncData(res.payload);
      }
    } catch (e) {
      console.error('OwnerMobileFinance load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, storePairingCode, loadLedger, loadDebts, loadReceivables]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Data helpers
  const pnl = syncData?.monthlyProfitLoss;
  const omsetMonth = pnl?.penjualan ?? syncData?.todaySummary?.omsetThisMonth ?? 0;
  const hppMonth = pnl?.hpp ?? 0;
  const grossProfitMonth = pnl?.labaKotor ?? Math.max(0, omsetMonth - hppMonth);
  const expensesMonth = pnl?.totalBeban ?? 0;
  const netProfitMonth = pnl?.labaBersih ?? (grossProfitMonth - expensesMonth);
  const profitMargin = omsetMonth > 0 ? Math.round((netProfitMonth / omsetMonth) * 100) : 0;

  const cashHand = syncData?.cashLiquidity?.cashHand ?? cashHandBalance;
  const cashBank = syncData?.cashLiquidity?.cashBank ?? cashBankBalance;
  const totalCash = syncData?.cashLiquidity?.totalCash ?? totalBalance;

  const debtUnpaid = syncData?.debtReceivable?.totalDebtUnpaid ?? totalDebtUnpaid;
  const recUnpaid = syncData?.debtReceivable?.totalReceivableUnpaid ?? totalReceivableUnpaid;

  const denomObj = syncData?.cashLiquidity?.denominations || denominations?.counts || {};
  const denomSorted = Object.entries(denomObj)
    .map(([d, c]) => ({ denom: Number(d), count: Number(c) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.denom - a.denom);

  const recentMutations = syncData?.recentLedger || [];
  const debtsList = syncData?.debtsList || [];
  const recList = syncData?.receivablesList || [];

  return (
    <ThemedView style={styles.container}>
      {/* Top Mobile Header */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerBadge}>
              <ThemedText style={styles.headerBadgeText}>📱 KEUANGAN PEMILIK (HP)</ThemedText>
            </View>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>
              {storeName}
            </ThemedText>
            <ThemedText style={styles.headerSub}>
              {pnl?.periodLabel ? `Periode Buku: ${pnl.periodLabel}` : 'Laporan Keuangan Toko'}
            </ThemedText>
          </View>

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
        </View>

        {/* Segmented Tab Controls */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'labarugi' && styles.tabBtnActive]}
            onPress={() => setActiveTab('labarugi')}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.tabText, activeTab === 'labarugi' && styles.tabTextActive]}>
              📊 Laba / Rugi
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'bukukas' && styles.tabBtnActive]}
            onPress={() => setActiveTab('bukukas')}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.tabText, activeTab === 'bukukas' && styles.tabTextActive]}>
              📒 Buku Kas
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'utangpiutang' && styles.tabBtnActive]}
            onPress={() => setActiveTab('utangpiutang')}
            activeOpacity={0.8}
          >
            <ThemedText
              style={[styles.tabText, activeTab === 'utangpiutang' && styles.tabTextActive]}
            >
              ⚖️ Utang Piutang
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.tint]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* TAB 1: LABA / RUGI */}
        {activeTab === 'labarugi' && (
          <View style={styles.tabContent}>
            {/* Hero Laba Bersih Card */}
            <Card style={styles.heroPnlCard} padding={20}>
              <View style={styles.pnlHeaderRow}>
                <View>
                  <ThemedText style={styles.pnlCardLabel}>ESTIMASI LABA BERSIH BULAN INI</ThemedText>
                  <ThemedText
                    style={[
                      styles.heroPnlNumber,
                      netProfitMonth < 0 ? { color: '#ef4444' } : { color: '#16a34a' },
                    ]}
                  >
                    {formatRupiah(netProfitMonth)}
                  </ThemedText>
                </View>
                <View style={styles.marginBadge}>
                  <ThemedText style={styles.marginBadgeText}>Margin: {profitMargin}%</ThemedText>
                </View>
              </View>

              <View style={styles.pnlDivider} />

              {/* Rincian P&L Breakdown */}
              <View style={styles.pnlRow}>
                <ThemedText style={styles.pnlRowLabel}>📈 Penjualan / Omset Bruto</ThemedText>
                <ThemedText style={styles.pnlRowVal}>{formatRupiah(omsetMonth)}</ThemedText>
              </View>

              <View style={styles.pnlRow}>
                <ThemedText style={styles.pnlRowLabel}>🛒 HPP (Harga Pokok Penjualan)</ThemedText>
                <ThemedText style={[styles.pnlRowVal, { color: '#dc2626' }]}>
                  - {formatRupiah(hppMonth)}
                </ThemedText>
              </View>

              <View style={[styles.pnlRow, styles.pnlSubtotalRow]}>
                <ThemedText style={styles.pnlSubtotalLabel}>💰 Laba Kotor (Gross Profit)</ThemedText>
                <ThemedText style={styles.pnlSubtotalVal}>{formatRupiah(grossProfitMonth)}</ThemedText>
              </View>

              <View style={styles.pnlRow}>
                <ThemedText style={styles.pnlRowLabel}>⚡ Beban Operasional Usaha</ThemedText>
                <ThemedText style={[styles.pnlRowVal, { color: '#dc2626' }]}>
                  - {formatRupiah(expensesMonth)}
                </ThemedText>
              </View>
            </Card>

            {/* Pos Pengeluaran Operasional Terbesar */}
            {pnl?.bebanBreakdown && pnl.bebanBreakdown.length > 0 && (
              <Card style={styles.card} padding={16}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.sectionTitle}>📑 Rincian Beban Operasional Toko</ThemedText>
                </View>
                {pnl.bebanBreakdown.map((item, idx) => (
                  <View key={idx} style={styles.expenseItemRow}>
                    <View style={styles.expenseDot} />
                    <ThemedText style={styles.expenseCatName}>
                      {item.category.replace(/_/g, ' ').toUpperCase()}
                    </ThemedText>
                    <ThemedText style={styles.expenseAmount}>{formatRupiah(item.total)}</ThemedText>
                  </View>
                ))}
              </Card>
            )}

            {/* Ringkasan Penjualan Hari Ini vs Kemarin */}
            <Card style={styles.card} padding={16}>
              <ThemedText style={styles.sectionTitle}>⏱️ Perbandingan Penjualan Toko</ThemedText>
              <View style={styles.compareGrid}>
                <View style={styles.compareBox}>
                  <ThemedText style={styles.compareLabel}>Hari Ini</ThemedText>
                  <ThemedText style={styles.compareVal}>
                    {formatRupiah(syncData?.todaySummary?.omset ?? 0)}
                  </ThemedText>
                  <ThemedText style={styles.compareSub}>
                    {syncData?.todaySummary?.transactionCount ?? 0} nota
                  </ThemedText>
                </View>
                <View style={styles.compareBox}>
                  <ThemedText style={styles.compareLabel}>Kemarin</ThemedText>
                  <ThemedText style={styles.compareVal}>
                    {formatRupiah(syncData?.todaySummary?.omsetYesterday ?? 0)}
                  </ThemedText>
                  <ThemedText style={styles.compareSub}>Penuh 1 hari</ThemedText>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* TAB 2: BUKU KAS & DUAL-POCKET */}
        {activeTab === 'bukukas' && (
          <View style={styles.tabContent}>
            {/* Total Kas Card */}
            <Card style={styles.totalCashCard} padding={20}>
              <ThemedText style={styles.totalCashLabel}>TOTAL SALDO LIKUIDITAS KAS</ThemedText>
              <ThemedText style={styles.totalCashNumber}>{formatRupiah(totalCash)}</ThemedText>
              <ThemedText style={styles.totalCashSub}>
                Gabungan uang tunai di toko & rekening bank
              </ThemedText>

              <View style={styles.walletCardsRow}>
                {/* Saku 1: Kas Fisik */}
                <View style={[styles.walletBox, styles.walletHand]}>
                  <View style={styles.walletHeader}>
                    <ThemedText style={styles.walletIcon}>💵</ThemedText>
                    <ThemedText style={styles.walletTitle}>Kas Fisik Laci</ThemedText>
                  </View>
                  <ThemedText style={styles.walletAmount}>{formatRupiah(cashHand)}</ThemedText>
                  <ThemedText style={styles.walletDesc}>Uang tunai di kasir</ThemedText>
                </View>

                {/* Saku 2: Kas Bank */}
                <View style={[styles.walletBox, styles.walletBank]}>
                  <View style={styles.walletHeader}>
                    <ThemedText style={styles.walletIcon}>🏛️</ThemedText>
                    <ThemedText style={styles.walletTitle}>Rekening Bank</ThemedText>
                  </View>
                  <ThemedText style={styles.walletAmount}>{formatRupiah(cashBank)}</ThemedText>
                  <ThemedText style={styles.walletDesc}>QRIS & Transfer</ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={styles.setorBankBtn}
                onPress={() => setShowBankDepositModal(true)}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.setorBankBtnText}>
                  🏦 Catat Setoran Fisik Laci ke Bank
                </ThemedText>
              </TouchableOpacity>
            </Card>

            {/* Rincian Lembaran Uang Fisik */}
            {denomSorted.length > 0 && (
              <Card style={styles.card} padding={16}>
                <ThemedText style={styles.sectionTitle}>
                  💰 Rincian Pecahan Uang Fisik di Toko
                </ThemedText>
                <View style={styles.denomGrid}>
                  {denomSorted.map((item) => (
                    <View key={item.denom} style={styles.denomItem}>
                      <ThemedText style={styles.denomNominal}>
                        {item.denom >= 1000 ? `${item.denom / 1000}rb` : item.denom}
                      </ThemedText>
                      <ThemedText style={styles.denomCount}>{item.count} lembar</ThemedText>
                      <ThemedText style={styles.denomSubtotal}>
                        {formatRupiah(item.denom * item.count)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {/* 10 Mutasi Kas Terakhir */}
            <Card style={styles.card} padding={16}>
              <ThemedText style={styles.sectionTitle}>📑 Mutasi Kas Masuk & Keluar Terkini</ThemedText>
              {recentMutations.length === 0 ? (
                <ThemedText style={styles.emptyText}>Belum ada riwayat mutasi kas.</ThemedText>
              ) : (
                recentMutations.map((m) => {
                  const isIn = m.type === 'in';
                  return (
                    <View key={m.id} style={styles.mutationItem}>
                      <View
                        style={[
                          styles.mutationIconBox,
                          isIn ? styles.iconBoxIn : styles.iconBoxOut,
                        ]}
                      >
                        <ThemedText style={styles.mutationIcon}>{isIn ? '↓' : '↑'}</ThemedText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.mutationCategory}>
                          {m.category.replace(/_/g, ' ').toUpperCase()}
                        </ThemedText>
                        <ThemedText style={styles.mutationDesc} numberOfLines={1}>
                          {m.note || (isIn ? 'Kas Masuk' : 'Pengeluaran')}
                        </ThemedText>
                        <ThemedText style={styles.mutationTime}>{m.created_at}</ThemedText>
                      </View>
                      <ThemedText
                        style={[
                          styles.mutationAmount,
                          isIn ? { color: '#16a34a' } : { color: '#dc2626' },
                        ]}
                      >
                        {isIn ? '+' : '-'} {formatRupiah(m.amount)}
                      </ThemedText>
                    </View>
                  );
                })
              )}
            </Card>
          </View>
        )}

        {/* TAB 3: UTANG & PIUTANG */}
        {activeTab === 'utangpiutang' && (
          <View style={styles.tabContent}>
            {/* Overview Comparison Cards */}
            <View style={styles.debtOverviewRow}>
              <Card style={[styles.debtSummaryCard, styles.recSummaryCard]} padding={16}>
                <ThemedText style={styles.debtCardTitle}>PIUTANG PELANGGAN</ThemedText>
                <ThemedText style={styles.recHero}>{formatRupiah(recUnpaid)}</ThemedText>
                <ThemedText style={styles.debtCardSub}>Uang toko di pelanggan</ThemedText>
              </Card>

              <Card style={[styles.debtSummaryCard, styles.debtSupplierCard]} padding={16}>
                <ThemedText style={styles.debtCardTitle}>UTANG KE SUPPLIER</ThemedText>
                <ThemedText style={styles.debtHero}>{formatRupiah(debtUnpaid)}</ThemedText>
                <ThemedText style={styles.debtCardSub}>Kewajiban kulakan stok</ThemedText>
              </Card>
            </View>

            {/* List Piutang Pelanggan */}
            <Card style={styles.card} padding={16}>
              <ThemedText style={styles.sectionTitle}>👥 Tagihan Pelanggan Belum Lunas</ThemedText>
              {recList.length === 0 ? (
                <ThemedText style={styles.emptyText}>Tidak ada piutang pelanggan saat ini.</ThemedText>
              ) : (
                recList.map((item) => (
                  <View key={item.id} style={styles.debtListItem}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.debtEntityName}>{item.customer_name}</ThemedText>
                      <ThemedText style={styles.debtDueDate}>
                        Tempo: {item.due_date ? item.due_date : 'Belum diatur'}
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText style={styles.debtItemTotal}>
                        {formatRupiah(item.total_amount - item.paid_amount)}
                      </ThemedText>
                      <ThemedText style={styles.debtItemStatus}>
                        {item.status === 'partial' ? 'Dicicil' : 'Belum Lunas'}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </Card>

            {/* List Utang Supplier */}
            <Card style={styles.card} padding={16}>
              <ThemedText style={styles.sectionTitle}>🏢 Utang Supplier Belum Lunas</ThemedText>
              {debtsList.length === 0 ? (
                <ThemedText style={styles.emptyText}>Tidak ada utang supplier saat ini.</ThemedText>
              ) : (
                debtsList.map((item) => (
                  <View key={item.id} style={styles.debtListItem}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.debtEntityName}>{item.supplier_name}</ThemedText>
                      <ThemedText style={styles.debtDueDate}>
                        Tempo: {item.due_date ? item.due_date : 'Belum diatur'}
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText style={[styles.debtItemTotal, { color: '#dc2626' }]}>
                        {formatRupiah(item.total_amount - item.paid_amount)}
                      </ThemedText>
                      <ThemedText style={styles.debtItemStatus}>
                        {item.status === 'partial' ? 'Dicicil' : 'Belum Lunas'}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </Card>

            <TouchableOpacity
              style={styles.manageDebtBtn}
              activeOpacity={0.8}
              onPress={() => router.push('/debt-receivable' as any)}
            >
              <ThemedText style={styles.manageDebtBtnText}>
                ⚙️ Buka Menu Kelola Hutang & Piutang Lengkap ›
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal Setor Kas Bank */}
      <BankDepositModal
        visible={showBankDepositModal}
        onClose={() => setShowBankDepositModal(false)}
        currentBalance={cashHand}
        onSuccess={() => {
          loadData();
          Alert.alert('Sukses', 'Setoran kas laci ke rekening bank berhasil dicatat.');
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
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSub: {
    fontSize: 12,
    color: '#94a3b8',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#0284c7',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    padding: 16,
  },
  tabContent: {
    gap: 14,
  },
  heroPnlCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pnlHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pnlCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroPnlNumber: {
    fontSize: 26,
    fontWeight: '900',
  },
  marginBadge: {
    backgroundColor: '#16a34a22',
    borderColor: '#16a34a',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  marginBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4ade80',
  },
  pnlDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  pnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  pnlRowLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  pnlRowVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  pnlSubtotalRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    marginVertical: 4,
  },
  pnlSubtotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38bdf8',
  },
  pnlSubtotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#38bdf8',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 12,
  },
  expenseItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  expenseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
    marginRight: 10,
  },
  expenseCatName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ef4444',
  },
  compareGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  compareBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  compareLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: 4,
  },
  compareVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#f8fafc',
  },
  compareSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  totalCashCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  totalCashLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  totalCashNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#38bdf8',
    marginVertical: 4,
  },
  totalCashSub: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 14,
  },
  walletCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  walletBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  walletHand: {
    backgroundColor: '#14532d22',
    borderColor: '#16a34a55',
  },
  walletBank: {
    backgroundColor: '#0c4a6e22',
    borderColor: '#0284c755',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  walletIcon: {
    fontSize: 16,
  },
  walletTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  walletAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f8fafc',
  },
  walletDesc: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  setorBankBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  setorBankBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  denomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  denomItem: {
    width: '31%',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  denomNominal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
  },
  denomCount: {
    fontSize: 10,
    color: '#94a3b8',
    marginVertical: 2,
  },
  denomSubtotal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f8fafc',
  },
  mutationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 10,
  },
  mutationIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxIn: {
    backgroundColor: '#16a34a22',
  },
  iconBoxOut: {
    backgroundColor: '#dc262622',
  },
  mutationIcon: {
    fontSize: 16,
    fontWeight: '900',
  },
  mutationCategory: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f8fafc',
  },
  mutationDesc: {
    fontSize: 11,
    color: '#94a3b8',
  },
  mutationTime: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 1,
  },
  mutationAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  debtOverviewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  debtSummaryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
  },
  recSummaryCard: {
    backgroundColor: '#0c4a6e22',
    borderColor: '#0284c755',
  },
  debtSupplierCard: {
    backgroundColor: '#451a0322',
    borderColor: '#ea580c55',
  },
  debtCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 4,
  },
  recHero: {
    fontSize: 18,
    fontWeight: '900',
    color: '#38bdf8',
  },
  debtHero: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f97316',
  },
  debtCardSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  debtListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  debtEntityName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  debtDueDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  debtItemTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#38bdf8',
  },
  debtItemStatus: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '700',
  },
  manageDebtBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  manageDebtBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
