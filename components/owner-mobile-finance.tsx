import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
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

  // Tab 3: Utang Piutang Controls
  const [debtSubTab, setDebtSubTab] = useState<'receivable' | 'debt'>('receivable');
  const [debtFilterStatus, setDebtFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [debtSearchQuery, setDebtSearchQuery] = useState('');

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

        {/* TAB 3: UTANG & PIUTANG LENGKAP */}
        {activeTab === 'utangpiutang' && (
          <View style={styles.tabContent}>
            {/* Overview Comparison Cards */}
            <View style={styles.debtOverviewRow}>
              <Card style={[styles.debtSummaryCard, styles.recSummaryCard]} padding={14}>
                <ThemedText style={styles.debtCardTitle}>PIUTANG KASBON</ThemedText>
                <ThemedText style={styles.recHero}>{formatRupiah(recUnpaid)}</ThemedText>
                <ThemedText style={styles.debtCardSub}>Total {recList.length} nota kasbon</ThemedText>
              </Card>

              <Card style={[styles.debtSummaryCard, styles.debtSupplierCard]} padding={14}>
                <ThemedText style={styles.debtCardTitle}>HUTANG SUPPLIER</ThemedText>
                <ThemedText style={styles.debtHero}>{formatRupiah(debtUnpaid)}</ThemedText>
                <ThemedText style={styles.debtCardSub}>Total {debtsList.length} tagihan kulakan</ThemedText>
              </Card>
            </View>

            {/* Sub-Tab Switcher: Kasbon Pelanggan vs Hutang Supplier */}
            <View style={styles.subTabRow}>
              <TouchableOpacity
                style={[styles.subTabBtn, debtSubTab === 'receivable' && styles.subTabBtnActive]}
                onPress={() => setDebtSubTab('receivable')}
                activeOpacity={0.8}
              >
                <ThemedText
                  style={[styles.subTabText, debtSubTab === 'receivable' && styles.subTabTextActive]}
                >
                  👥 Kasbon Pelanggan ({recList.length})
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.subTabBtn, debtSubTab === 'debt' && styles.subTabBtnActive]}
                onPress={() => setDebtSubTab('debt')}
                activeOpacity={0.8}
              >
                <ThemedText
                  style={[styles.subTabText, debtSubTab === 'debt' && styles.subTabTextActive]}
                >
                  🏢 Hutang Supplier ({debtsList.length})
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Search and Status Filters */}
            <View style={styles.filterSection}>
              <View style={styles.searchBox}>
                <ThemedText style={{ fontSize: 14 }}>🔍</ThemedText>
                <TextInput
                  style={styles.searchInput}
                  placeholder={
                    debtSubTab === 'receivable'
                      ? 'Cari nama pelanggan atau nomor HP...'
                      : 'Cari nama supplier atau telepon...'
                  }
                  placeholderTextColor="#94a3b8"
                  value={debtSearchQuery}
                  onChangeText={setDebtSearchQuery}
                />
                {debtSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setDebtSearchQuery('')}>
                    <ThemedText style={{ fontSize: 13, color: '#94a3b8' }}>✕</ThemedText>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.filterPillsRow}>
                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    debtFilterStatus === 'all' && styles.filterPillActive,
                  ]}
                  onPress={() => setDebtFilterStatus('all')}
                >
                  <ThemedText
                    style={[
                      styles.filterPillText,
                      debtFilterStatus === 'all' && styles.filterPillTextActive,
                    ]}
                  >
                    Semua
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    debtFilterStatus === 'unpaid' && styles.filterPillActive,
                  ]}
                  onPress={() => setDebtFilterStatus('unpaid')}
                >
                  <ThemedText
                    style={[
                      styles.filterPillText,
                      debtFilterStatus === 'unpaid' && styles.filterPillTextActive,
                    ]}
                  >
                    Belum Lunas
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterPill,
                    debtFilterStatus === 'paid' && styles.filterPillActive,
                  ]}
                  onPress={() => setDebtFilterStatus('paid')}
                >
                  <ThemedText
                    style={[
                      styles.filterPillText,
                      debtFilterStatus === 'paid' && styles.filterPillTextActive,
                    ]}
                  >
                    Lunas
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Content List: Kasbon Pelanggan */}
            {debtSubTab === 'receivable' && (
              <View style={{ gap: 10 }}>
                {recList.filter((item) => {
                  const matchQuery =
                    item.customer_name?.toLowerCase().includes(debtSearchQuery.toLowerCase()) ||
                    (item.customer_phone && item.customer_phone.includes(debtSearchQuery));
                  if (!matchQuery) return false;
                  if (debtFilterStatus === 'unpaid') return item.status !== 'paid';
                  if (debtFilterStatus === 'paid') return item.status === 'paid';
                  return true;
                }).length === 0 ? (
                  <Card style={styles.emptyCard} padding={24}>
                    <ThemedText style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>
                      🎉
                    </ThemedText>
                    <ThemedText style={styles.emptyCardTitle}>
                      {debtSearchQuery
                        ? 'Tidak ada pelanggan yang sesuai pencarian'
                        : debtFilterStatus === 'unpaid'
                        ? 'Semua kasbon pelanggan telah lunas!'
                        : 'Belum ada catatan kasbon pelanggan'}
                    </ThemedText>
                    <ThemedText style={styles.emptyCardSub}>
                      Data kasbon langsung disinkronkan otomatis dari tablet kasir toko.
                    </ThemedText>
                  </Card>
                ) : (
                  recList
                    .filter((item) => {
                      const matchQuery =
                        item.customer_name?.toLowerCase().includes(debtSearchQuery.toLowerCase()) ||
                        (item.customer_phone && item.customer_phone.includes(debtSearchQuery));
                      if (!matchQuery) return false;
                      if (debtFilterStatus === 'unpaid') return item.status !== 'paid';
                      if (debtFilterStatus === 'paid') return item.status === 'paid';
                      return true;
                    })
                    .map((item) => {
                      const remaining = Math.max(0, item.total_amount - item.paid_amount);
                      const isPaid = item.status === 'paid' || remaining <= 0;
                      const isPartial = item.status === 'partial' && remaining > 0;
                      const percent =
                        item.total_amount > 0
                          ? Math.min(100, Math.round((item.paid_amount / item.total_amount) * 100))
                          : 0;

                      return (
                        <Card key={item.id} style={styles.itemCard} padding={16}>
                          {/* Top Row: Name & Status Badge */}
                          <View style={styles.itemHeaderRow}>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={styles.itemName} numberOfLines={1}>
                                {item.customer_name}
                              </ThemedText>
                              {item.customer_phone ? (
                                <ThemedText style={styles.itemPhone}>
                                  📞 {item.customer_phone}
                                </ThemedText>
                              ) : null}
                            </View>

                            <View
                              style={[
                                styles.statusBadge,
                                isPaid
                                  ? styles.badgeLunas
                                  : isPartial
                                  ? styles.badgePartial
                                  : styles.badgeUnpaid,
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.statusBadgeText,
                                  isPaid
                                    ? styles.textLunas
                                    : isPartial
                                    ? styles.textPartial
                                    : styles.textUnpaid,
                                ]}
                              >
                                {isPaid ? '✓ Lunas' : isPartial ? 'Cicilan' : 'Belum Lunas'}
                              </ThemedText>
                            </View>
                          </View>

                          {/* Progress Bar */}
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressBar,
                                {
                                  width: `${percent}%`,
                                  backgroundColor: isPaid ? '#16a34a' : '#0284c7',
                                },
                              ]}
                            />
                          </View>

                          {/* Financial Details Row */}
                          <View style={styles.itemDetailRow}>
                            <View style={styles.detailCol}>
                              <ThemedText style={styles.detailLbl}>Total Kasbon</ThemedText>
                              <ThemedText style={styles.detailVal}>
                                {formatRupiah(item.total_amount)}
                              </ThemedText>
                            </View>
                            <View style={styles.detailCol}>
                              <ThemedText style={styles.detailLbl}>Sudah Dibayar</ThemedText>
                              <ThemedText style={[styles.detailVal, { color: '#16a34a' }]}>
                                {formatRupiah(item.paid_amount)}
                              </ThemedText>
                            </View>
                            <View style={[styles.detailCol, { alignItems: 'flex-end' }]}>
                              <ThemedText style={styles.detailLbl}>Sisa Tagihan</ThemedText>
                              <ThemedText
                                style={[
                                  styles.detailVal,
                                  { color: isPaid ? '#16a34a' : '#0284c7', fontWeight: '900' },
                                ]}
                              >
                                {formatRupiah(remaining)}
                              </ThemedText>
                            </View>
                          </View>

                          {/* Footer Info: Due Date */}
                          <View style={styles.itemFooterRow}>
                            <ThemedText style={styles.itemFooterText}>
                              📅 Jatuh Tempo: {item.due_date ? item.due_date : 'Tidak Ditentukan'}
                            </ThemedText>
                            <ThemedText style={styles.itemPercentText}>{percent}% Terbayar</ThemedText>
                          </View>
                        </Card>
                      );
                    })
                )}
              </View>
            )}

            {/* Content List: Hutang Supplier */}
            {debtSubTab === 'debt' && (
              <View style={{ gap: 10 }}>
                {debtsList.filter((item) => {
                  const matchQuery =
                    item.supplier_name?.toLowerCase().includes(debtSearchQuery.toLowerCase()) ||
                    (item.supplier_phone && item.supplier_phone.includes(debtSearchQuery));
                  if (!matchQuery) return false;
                  if (debtFilterStatus === 'unpaid') return item.status !== 'paid';
                  if (debtFilterStatus === 'paid') return item.status === 'paid';
                  return true;
                }).length === 0 ? (
                  <Card style={styles.emptyCard} padding={24}>
                    <ThemedText style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>
                      🎉
                    </ThemedText>
                    <ThemedText style={styles.emptyCardTitle}>
                      {debtSearchQuery
                        ? 'Tidak ada supplier yang sesuai pencarian'
                        : debtFilterStatus === 'unpaid'
                        ? 'Semua hutang supplier telah lunas!'
                        : 'Belum ada catatan hutang supplier'}
                    </ThemedText>
                    <ThemedText style={styles.emptyCardSub}>
                      Data hutang langsung disinkronkan otomatis dari tablet kasir toko.
                    </ThemedText>
                  </Card>
                ) : (
                  debtsList
                    .filter((item) => {
                      const matchQuery =
                        item.supplier_name?.toLowerCase().includes(debtSearchQuery.toLowerCase()) ||
                        (item.supplier_phone && item.supplier_phone.includes(debtSearchQuery));
                      if (!matchQuery) return false;
                      if (debtFilterStatus === 'unpaid') return item.status !== 'paid';
                      if (debtFilterStatus === 'paid') return item.status === 'paid';
                      return true;
                    })
                    .map((item) => {
                      const remaining = Math.max(0, item.total_amount - item.paid_amount);
                      const isPaid = item.status === 'paid' || remaining <= 0;
                      const isPartial = item.status === 'partial' && remaining > 0;
                      const percent =
                        item.total_amount > 0
                          ? Math.min(100, Math.round((item.paid_amount / item.total_amount) * 100))
                          : 0;

                      return (
                        <Card key={item.id} style={styles.itemCard} padding={16}>
                          {/* Top Row: Supplier Name & Status Badge */}
                          <View style={styles.itemHeaderRow}>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={styles.itemName} numberOfLines={1}>
                                {item.supplier_name}
                              </ThemedText>
                              {item.supplier_phone ? (
                                <ThemedText style={styles.itemPhone}>
                                  📞 {item.supplier_phone}
                                </ThemedText>
                              ) : null}
                            </View>

                            <View
                              style={[
                                styles.statusBadge,
                                isPaid
                                  ? styles.badgeLunas
                                  : isPartial
                                  ? styles.badgePartial
                                  : styles.badgeUnpaid,
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.statusBadgeText,
                                  isPaid
                                    ? styles.textLunas
                                    : isPartial
                                    ? styles.textPartial
                                    : styles.textUnpaid,
                                ]}
                              >
                                {isPaid ? '✓ Lunas' : isPartial ? 'Dicicil' : 'Belum Lunas'}
                              </ThemedText>
                            </View>
                          </View>

                          {/* Progress Bar */}
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressBar,
                                {
                                  width: `${percent}%`,
                                  backgroundColor: isPaid ? '#16a34a' : '#ea580c',
                                },
                              ]}
                            />
                          </View>

                          {/* Financial Details Row */}
                          <View style={styles.itemDetailRow}>
                            <View style={styles.detailCol}>
                              <ThemedText style={styles.detailLbl}>Total Hutang</ThemedText>
                              <ThemedText style={styles.detailVal}>
                                {formatRupiah(item.total_amount)}
                              </ThemedText>
                            </View>
                            <View style={styles.detailCol}>
                              <ThemedText style={styles.detailLbl}>Sudah Dibayar</ThemedText>
                              <ThemedText style={[styles.detailVal, { color: '#16a34a' }]}>
                                {formatRupiah(item.paid_amount)}
                              </ThemedText>
                            </View>
                            <View style={[styles.detailCol, { alignItems: 'flex-end' }]}>
                              <ThemedText style={styles.detailLbl}>Sisa Hutang</ThemedText>
                              <ThemedText
                                style={[
                                  styles.detailVal,
                                  { color: isPaid ? '#16a34a' : '#ea580c', fontWeight: '900' },
                                ]}
                              >
                                {formatRupiah(remaining)}
                              </ThemedText>
                            </View>
                          </View>

                          {/* Footer Info: Due Date */}
                          <View style={styles.itemFooterRow}>
                            <ThemedText style={styles.itemFooterText}>
                              📅 Jatuh Tempo: {item.due_date ? item.due_date : 'Tidak Ditentukan'}
                            </ThemedText>
                            <ThemedText style={styles.itemPercentText}>{percent}% Terbayar</ThemedText>
                          </View>
                        </Card>
                      );
                    })
                )}
              </View>
            )}

            {/* Sync Status Banner at Bottom */}
            <View style={styles.syncFooterBanner}>
              <ThemedText style={styles.syncFooterText}>
                🟢 Data tersinkronisasi otomatis dari Tablet Kasir Toko ({storePairingCode})
              </ThemedText>
            </View>
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
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
    backgroundColor: '#ede9fe',
    borderColor: '#c4b5fd',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  headerBadgeText: {
    color: '#6d28d9',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748b',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    fontSize: 18,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#5b21b6',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    ...Shadows.sm,
  },
  pnlHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pnlCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroPnlNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
  },
  marginBadge: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  marginBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16a34a',
  },
  pnlDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  pnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  pnlRowLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  pnlRowVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  pnlSubtotalRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    marginVertical: 4,
  },
  pnlSubtotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284c7',
  },
  pnlSubtotalVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0284c7',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Shadows.sm,
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
    color: '#0f172a',
    marginBottom: 12,
  },
  expenseItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    color: '#334155',
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  compareGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  compareBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  compareLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 4,
  },
  compareVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  compareSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  totalCashCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    ...Shadows.sm,
  },
  totalCashLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  totalCashNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0284c7',
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
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  walletBank: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
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
    color: '#475569',
  },
  walletAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  walletDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  setorBankBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  setorBankBtnText: {
    color: '#ffffff',
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
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  denomNominal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  denomCount: {
    fontSize: 10,
    color: '#64748b',
    marginVertical: 2,
  },
  denomSubtotal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  mutationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    backgroundColor: '#dcfce7',
  },
  iconBoxOut: {
    backgroundColor: '#fee2e2',
  },
  mutationIcon: {
    fontSize: 16,
    fontWeight: '900',
  },
  mutationCategory: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  mutationDesc: {
    fontSize: 11,
    color: '#64748b',
  },
  mutationTime: {
    fontSize: 9,
    color: '#94a3b8',
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
    ...Shadows.sm,
  },
  recSummaryCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  debtSupplierCard: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  debtCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 4,
  },
  recHero: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0284c7',
  },
  debtHero: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ea580c',
  },
  debtCardSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabBtnActive: {
    backgroundColor: '#ffffff',
    ...Shadows.sm,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  subTabTextActive: {
    color: '#0f172a',
  },
  filterSection: {
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#ede9fe',
    borderColor: '#c4b5fd',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#6d28d9',
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    ...Shadows.sm,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  itemPhone: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeLunas: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  badgePartial: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
  },
  badgeUnpaid: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textLunas: {
    color: '#16a34a',
  },
  textPartial: {
    color: '#d97706',
  },
  textUnpaid: {
    color: '#dc2626',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailCol: {
    flex: 1,
  },
  detailLbl: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  itemFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemFooterText: {
    fontSize: 10,
    color: '#64748b',
  },
  itemPercentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    ...Shadows.sm,
  },
  emptyCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptyCardSub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  syncFooterBanner: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
  },
  syncFooterText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
});
