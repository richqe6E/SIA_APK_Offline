import React, { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { HeaderBar } from '@/components/header-bar';
import { Colors } from '@/constants/theme';
import { useMonitorStore } from '@/stores/monitorStore';

function formatRupiah(n: number) {
  const sign = n < 0 ? '- ' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { syncData, loading, refreshing, fetchData } = useMonitorStore();
  const [debtViewType, setDebtViewType] = useState<'receivable' | 'debt'>('receivable');
  type StockThreshold = 'all' | '20' | '30' | '40' | '0';
  const [stockThreshold, setStockThreshold] = useState<StockThreshold>('all');

  const onRefresh = () => {
    fetchData(true);
  };

  // Data tambahan sinkronisasi cloud
  const criticalProducts = syncData?.criticalProducts || [];
  const expiringProducts = syncData?.expiringProducts || [];
  const todayExpenses = syncData?.todayExpenses || [];
  const weeklySalesTrend = syncData?.weeklySalesTrend || [];

  const filteredCriticalProducts = criticalProducts.filter((p) => {
    if (stockThreshold === '0') return p.stock <= 0;
    if (stockThreshold === '20') return p.stock < 20;
    if (stockThreshold === '30') return p.stock < 30;
    if (stockThreshold === '40') return p.stock < 40;
    return true;
  });

  // PnL Data
  const pnl = syncData?.monthlyProfitLoss;
  const periodLabel = pnl?.periodLabel || 'Bulan Ini';
  const monthlySales = pnl?.penjualan || 0;
  const monthlyHpp = pnl?.hpp || 0;
  const monthlyLabaKotor = pnl?.labaKotor || Math.max(0, monthlySales - monthlyHpp);
  const monthlyBeban = pnl?.totalBeban || 0;
  const monthlyNet = pnl?.labaBersih ?? (monthlyLabaKotor - monthlyBeban);
  const netMargin = monthlySales > 0 ? Math.round((monthlyNet / monthlySales) * 100) : 0;
  const bebanList = pnl?.bebanBreakdown || [];

  // Inventory & Stock
  const stockAlerts = syncData?.stockAlerts;
  const outOfStock = stockAlerts?.outOfStockCount || 0;
  const lowStock = stockAlerts?.lowStockCount || 0;
  const expiredSoon = stockAlerts?.expiredSoonCount || 0;
  const valuation = syncData?.inventoryValuation;
  const totalStockValue = valuation?.totalStockValue || 0;
  const totalStockItems = valuation?.totalItems || 0;
  const topProducts = syncData?.topProducts || [];

  // Debt & Receivable
  const debtRec = syncData?.debtReceivable;
  const totalDebt = debtRec?.totalDebtUnpaid || 0;
  const totalReceivable = debtRec?.totalReceivableUnpaid || 0;
  const dueSoon = syncData?.dueSoonReceivables;
  const dueSoonList = dueSoon?.items || [];
  const debtsList = syncData?.debtsList || [];
  const receivablesList = syncData?.receivablesList || [];

  return (
    <ThemedView style={styles.container}>
      <HeaderBar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.tint]}
            tintColor={Colors.tint}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !syncData ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.tint} />
            <ThemedText style={styles.loadingText}>Memuat laporan toko...</ThemedText>
          </View>
        ) : (
          <>
            {/* 1. KARTU LABA / RUGI BULANAN (P&L) */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxPnl}>
                  <ThemedText style={styles.cardIcon}>📊</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardSectionLabel}>
                    LABA / RUGI ({periodLabel.toUpperCase()})
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.heroPnlAmount,
                      monthlyNet < 0 ? styles.textDanger : styles.textSuccess,
                    ]}
                  >
                    {formatRupiah(monthlyNet)}
                  </ThemedText>
                </View>
                <View style={styles.marginPill}>
                  <ThemedText style={styles.marginPillText}>Margin {netMargin}%</ThemedText>
                </View>
              </View>

              {/* Rincian P&L Breakdown */}
              <View style={styles.pnlTable}>
                <View style={styles.pnlRow}>
                  <ThemedText style={styles.pnlLabel}>Penjualan / Omset</ThemedText>
                  <ThemedText style={styles.pnlVal}>{formatRupiah(monthlySales)}</ThemedText>
                </View>
                <View style={styles.pnlRow}>
                  <ThemedText style={styles.pnlLabel}>HPP (Modal Barang Terjual)</ThemedText>
                  <ThemedText style={[styles.pnlVal, { color: '#dc2626' }]}>
                    - {formatRupiah(monthlyHpp)}
                  </ThemedText>
                </View>
                <View style={[styles.pnlRow, styles.pnlRowSubtotal]}>
                  <ThemedText style={styles.pnlSubtotalLabel}>Laba Kotor Penjualan</ThemedText>
                  <ThemedText style={styles.pnlSubtotalVal}>
                    {formatRupiah(monthlyLabaKotor)}
                  </ThemedText>
                </View>
                <View style={styles.pnlRow}>
                  <ThemedText style={styles.pnlLabel}>Total Beban Operasional</ThemedText>
                  <ThemedText style={[styles.pnlVal, { color: '#dc2626' }]}>
                    - {formatRupiah(monthlyBeban)}
                  </ThemedText>
                </View>
                <View style={[styles.pnlRow, styles.pnlRowTotal]}>
                  <ThemedText style={styles.pnlTotalLabel}>Laba Bersih Toko</ThemedText>
                  <ThemedText
                    style={[
                      styles.pnlTotalVal,
                      monthlyNet < 0 ? styles.textDanger : styles.textSuccess,
                    ]}
                  >
                    {formatRupiah(monthlyNet)}
                  </ThemedText>
                </View>
              </View>

              {/* Rincian Beban Operasional */}
              {bebanList.length > 0 && (
                <View style={styles.bebanContainer}>
                  <ThemedText style={styles.subHeading}>Rincian Beban Terbesar:</ThemedText>
                  {bebanList.map((b, idx) => (
                    <View key={idx} style={styles.bebanRow}>
                      <ThemedText style={styles.bebanName}>
                        • {b.category.replace(/_/g, ' ')}
                      </ThemedText>
                      <ThemedText style={styles.bebanAmount}>{formatRupiah(b.total)}</ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* KARTU TREN PENJUALAN 7 HARI TERAKHIR */}
            {weeklySalesTrend.length > 0 && (
              <Card style={styles.card} padding={18}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconBoxPnl, { backgroundColor: '#e0f2fe' }]}>
                    <ThemedText style={styles.cardIcon}>📈</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.cardSectionLabel}>TREN PENJUALAN 7 HARI TERAKHIR</ThemedText>
                    <ThemedText style={styles.cardSectionSub}>
                      Performa omset harian toko seminggu ke belakang
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.trendContainer}>
                  {weeklySalesTrend.map((item, idx) => {
                    const isToday = idx === weeklySalesTrend.length - 1;
                    const maxVal = Math.max(...weeklySalesTrend.map((w) => w.total), 1);
                    const barHeight = Math.max(8, Math.round((item.total / maxVal) * 72));
                    return (
                      <View key={item.date} style={styles.trendBarCol}>
                        <ThemedText style={styles.trendBarVal}>
                          {item.total >= 1000000
                            ? `${(item.total / 1000000).toFixed(1)}jt`
                            : item.total > 0
                            ? `${Math.round(item.total / 1000)}rb`
                            : '0'}
                        </ThemedText>
                        <View style={styles.trendBarTrack}>
                          <View
                            style={[
                              styles.trendBarFill,
                              { height: barHeight },
                              isToday && styles.trendBarFillToday,
                            ]}
                          />
                        </View>
                        <ThemedText
                          style={[
                            styles.trendBarLabel,
                            isToday && styles.trendBarLabelToday,
                          ]}
                          numberOfLines={1}
                        >
                          {item.dayName}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              </Card>
            )}

            {/* 2. KARTU ASET STOK & PERINGATAN KADALUARSA (FREEZER) */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxStock}>
                  <ThemedText style={styles.cardIcon}>📦</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardSectionLabel}>ASET STOK SOSIS & FROZEN FOOD</ThemedText>
                  <ThemedText style={styles.cardSectionSub}>
                    Nilai modal barang yang tersimpan di toko
                  </ThemedText>
                </View>
              </View>

              {/* Total Nilai Stok Mengendap */}
              <View style={styles.stockValuationBox}>
                <View>
                  <ThemedText style={styles.stockValLabel}>Total Nilai Modal di Freezer</ThemedText>
                  <ThemedText style={styles.stockValAmount}>
                    {formatRupiah(totalStockValue)}
                  </ThemedText>
                </View>
                <View style={styles.stockItemsBadge}>
                  <ThemedText style={styles.stockItemsText}>{totalStockItems} Unit</ThemedText>
                </View>
              </View>

              {/* Peringatan Stok & Kadaluarsa */}
              {(outOfStock > 0 || lowStock > 0 || expiredSoon > 0) && (
                <View style={styles.alertsContainer}>
                  <ThemedText style={styles.subHeading}>Perhatian Stok:</ThemedText>
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
                          ⏳ {expiredSoon} Mendekati Expired (≤30 hari)
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Top 5 Produk Terlaris Hari Ini */}
              <View style={styles.topSection}>
                <ThemedText style={styles.subHeading}>5 Produk Sosis Paling Laris Hari Ini:</ThemedText>
                {topProducts.length === 0 ? (
                  <ThemedText style={styles.emptyText}>Belum ada penjualan produk hari ini</ThemedText>
                ) : (
                  <View style={styles.topList}>
                    {topProducts.map((p, idx) => (
                      <View key={p.id} style={styles.topItem}>
                        <View style={styles.rankPill}>
                          <ThemedText style={styles.rankNum}>{idx + 1}</ThemedText>
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.topName} numberOfLines={1}>
                            {p.name}
                          </ThemedText>
                          <ThemedText style={styles.topQty}>{p.qty} item terjual</ThemedText>
                        </View>
                        <ThemedText style={styles.topRevenue}>{formatRupiah(p.revenue)}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Card>

            {/* KARTU PRODUK STOK KRITIS (PERLU RESTOCK) */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBoxStock, { backgroundColor: '#fee2e2' }]}>
                  <ThemedText style={styles.cardIcon}>⚠️</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardSectionLabel}>PRODUK STOK KRITIS (PERLU RESTOCK)</ThemedText>
                  <ThemedText style={styles.cardSectionSub}>
                    {filteredCriticalProducts.length} produk memerlukan kulakan sosis & frozen food
                  </ThemedText>
                </View>
              </View>

              {/* Filter Chips Threshold */}
              <View style={styles.thresholdChipsRow}>
                {(
                  [
                    { key: 'all', label: 'Semua (≤40)' },
                    { key: '20', label: '< 20' },
                    { key: '30', label: '< 30' },
                    { key: '40', label: '< 40' },
                    { key: '0', label: 'Habis (0)' },
                  ] as const
                ).map((chip) => (
                  <TouchableOpacity
                    key={chip.key}
                    style={[
                      styles.thresholdChip,
                      stockThreshold === chip.key && styles.thresholdChipActive,
                    ]}
                    onPress={() => setStockThreshold(chip.key)}
                    activeOpacity={0.8}
                  >
                    <ThemedText
                      style={[
                        styles.thresholdChipText,
                        stockThreshold === chip.key && styles.thresholdChipTextActive,
                      ]}
                    >
                      {chip.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* List Produk Kritis */}
              {filteredCriticalProducts.length === 0 ? (
                <View style={styles.emptyAlertBox}>
                  <ThemedText style={styles.emptyAlertIcon}>✅</ThemedText>
                  <ThemedText style={styles.emptyAlertText}>
                    Semua stok aman! Tidak ada produk dalam kriteria ini.
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.criticalList}>
                  {filteredCriticalProducts.map((p) => {
                    const isOutOfStock = p.stock <= 0;
                    return (
                      <View key={p.id} style={styles.criticalItemRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <ThemedText style={styles.criticalItemName} numberOfLines={1}>
                            {p.name}
                          </ThemedText>
                          <ThemedText style={styles.criticalItemMeta}>
                            {p.category} • Modal: {formatRupiah(p.cost_price)}/{p.unit || 'pcs'}
                          </ThemedText>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <View
                            style={[
                              styles.stockBadge,
                              isOutOfStock ? styles.stockBadgeOut : styles.stockBadgeLow,
                            ]}
                          >
                            <ThemedText
                              style={[
                                styles.stockBadgeText,
                                isOutOfStock ? styles.stockBadgeTextOut : styles.stockBadgeTextLow,
                              ]}
                            >
                              {isOutOfStock ? 'HABIS (0)' : `${p.stock} ${p.unit || 'pcs'}`}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.criticalRestockCost}>
                            Jual: {formatRupiah(p.selling_price)}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            {/* KARTU PRODUK MENDEKATI KADALUARSA (≤30 HARI) */}
            {expiringProducts.length > 0 && (
              <Card style={styles.card} padding={18}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconBoxStock, { backgroundColor: '#fef3c7' }]}>
                    <ThemedText style={styles.cardIcon}>⏳</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.cardSectionLabel}>
                      PRODUK MENDEKATI KADALUARSA (≤30 HARI)
                    </ThemedText>
                    <ThemedText style={styles.cardSectionSub}>
                      {expiringProducts.length} item sosis perlu dipromosikan lebih awal
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.expiringList}>
                  {expiringProducts.map((exp) => (
                    <View key={exp.id} style={styles.expiringItemRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <ThemedText style={styles.expiringName} numberOfLines={1}>
                          {exp.name}
                        </ThemedText>
                        <ThemedText style={styles.expiringMeta}>
                          Exp: {exp.expired_date} • Sisa: {exp.stock} unit
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.daysLeftBadge,
                          exp.days_left <= 7 ? styles.daysLeftBadgeUrgent : styles.daysLeftBadgeWarning,
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.daysLeftText,
                            exp.days_left <= 7 ? styles.daysLeftTextUrgent : styles.daysLeftTextWarning,
                          ]}
                        >
                          {exp.days_left <= 0 ? 'HARI INI' : `${exp.days_left} hari lagi`}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            )}

            {/* 3. KARTU PENGAWASAN UTANG & PIUTANG */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxDebt}>
                  <ThemedText style={styles.cardIcon}>⚖️</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardSectionLabel}>STATUS UTANG & PIUTANG TOKO</ThemedText>
                  <ThemedText style={styles.cardSectionSub}>
                    Kontrol tagihan pelanggan & kewajiban supplier
                  </ThemedText>
                </View>
              </View>

              {/* Grid Utang vs Piutang */}
              <View style={styles.debtGridRow}>
                <View style={[styles.debtCol, styles.recCol]}>
                  <ThemedText style={styles.debtColLabel}>Piutang Pelanggan (Bon)</ThemedText>
                  <ThemedText style={styles.recAmountText}>{formatRupiah(totalReceivable)}</ThemedText>
                  <ThemedText style={styles.debtColNote}>Uang toko masih di luar</ThemedText>
                </View>

                <View style={[styles.debtCol, styles.payCol]}>
                  <ThemedText style={styles.debtColLabel}>Utang ke Supplier</ThemedText>
                  <ThemedText style={styles.debtAmountText}>{formatRupiah(totalDebt)}</ThemedText>
                  <ThemedText style={styles.debtColNote}>Kewajiban kulakan sosis</ThemedText>
                </View>
              </View>

              {/* Peringatan Jatuh Tempo Piutang <= 3 Hari */}
              {dueSoonList.length > 0 && (
                <View style={styles.dueSoonCard}>
                  <View style={styles.dueSoonHeader}>
                    <ThemedText style={styles.dueSoonIcon}>⚠️</ThemedText>
                    <ThemedText style={styles.dueSoonTitle}>
                      {dueSoonList.length} Pelanggan Jatuh Tempo (≤3 Hari):
                    </ThemedText>
                  </View>
                  <View style={styles.dueSoonList}>
                    {dueSoonList.slice(0, 5).map((item, idx) => (
                      <View key={idx} style={styles.dueSoonRow}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.dueCustomerName}>
                            {item.customer_name}
                          </ThemedText>
                          <ThemedText style={styles.dueDaysLeft}>
                            {item.days_left < 0
                              ? `Lewat jatuh tempo ${Math.abs(item.days_left)} hari`
                              : item.days_left === 0
                              ? 'Jatuh tempo HARI INI'
                              : `Jatuh tempo dalam ${item.days_left} hari`}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.dueAmount}>
                          {formatRupiah(item.remaining_amount)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Switch View: Piutang vs Utang */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    debtViewType === 'receivable' && styles.toggleBtnActive,
                  ]}
                  onPress={() => setDebtViewType('receivable')}
                  activeOpacity={0.8}
                >
                  <ThemedText
                    style={[
                      styles.toggleBtnText,
                      debtViewType === 'receivable' && styles.toggleBtnTextActive,
                    ]}
                  >
                    Daftar Piutang ({receivablesList.length})
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    debtViewType === 'debt' && styles.toggleBtnActive,
                  ]}
                  onPress={() => setDebtViewType('debt')}
                  activeOpacity={0.8}
                >
                  <ThemedText
                    style={[
                      styles.toggleBtnText,
                      debtViewType === 'debt' && styles.toggleBtnTextActive,
                    ]}
                  >
                    Daftar Utang ({debtsList.length})
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {/* List Detail */}
              {debtViewType === 'receivable' ? (
                receivablesList.length === 0 ? (
                  <ThemedText style={styles.emptyText}>Tidak ada piutang pelanggan</ThemedText>
                ) : (
                  <View style={styles.debtList}>
                    {receivablesList.slice(0, 10).map((r) => (
                      <View key={r.id} style={styles.debtListItem}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.debtItemName}>{r.customer_name}</ThemedText>
                          <ThemedText style={styles.debtItemSub}>
                            Tempo: {r.due_date || 'Tanpa tempo'}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.debtItemAmount}>
                          {formatRupiah(r.remaining_amount)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                )
              ) : (
                debtsList.length === 0 ? (
                  <ThemedText style={styles.emptyText}>Tidak ada kewajiban utang supplier</ThemedText>
                ) : (
                  <View style={styles.debtList}>
                    {debtsList.slice(0, 10).map((d) => (
                      <View key={d.id} style={styles.debtListItem}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.debtItemName}>{d.supplier_name}</ThemedText>
                          <ThemedText style={styles.debtItemSub}>
                            Tempo: {d.due_date || 'Tanpa tempo'}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.debtItemAmount}>
                          {formatRupiah(d.remaining_amount)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                )
              )}
            </Card>

            {/* KARTU KAS KELUAR / BEBAN OPERASIONAL HARI INI */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBoxDebt, { backgroundColor: '#fef2f2' }]}>
                  <ThemedText style={styles.cardIcon}>💸</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardSectionLabel}>KAS KELUAR OPERASIONAL HARI INI</ThemedText>
                  <ThemedText style={styles.cardSectionSub}>
                    Pengeluaran kas fisik toko yang dicatat kasir
                  </ThemedText>
                </View>
                <ThemedText style={styles.totalExpenseAmount}>
                  {formatRupiah(syncData?.todaySummary?.operatingExpenses || 0)}
                </ThemedText>
              </View>

              {todayExpenses.length === 0 ? (
                <View style={styles.emptyExpenseBox}>
                  <ThemedText style={styles.emptyExpenseText}>
                    Belum ada catatan kas keluar operasional hari ini
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.expenseList}>
                  {todayExpenses.map((ex) => (
                    <View key={ex.id} style={styles.expenseItemRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ThemedText style={styles.expenseCategory}>
                            {ex.category.replace(/_/g, ' ')}
                          </ThemedText>
                          <ThemedText style={styles.expenseTime}>• {ex.time}</ThemedText>
                        </View>
                        <ThemedText style={styles.expenseDesc} numberOfLines={1}>
                          {ex.description}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.expenseAmountText}>
                        - {formatRupiah(ex.amount)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  cardIconBoxPnl: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxStock: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxDebt: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 20,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  cardSectionSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  heroPnlAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  textSuccess: {
    color: '#16a34a',
  },
  textDanger: {
    color: '#dc2626',
  },
  marginPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  marginPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  // PnL Table
  pnlTable: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  pnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pnlLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  pnlVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  pnlRowSubtotal: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  pnlSubtotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  pnlSubtotalVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  pnlRowTotal: {
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#cbd5e1',
  },
  pnlTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  pnlTotalVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  bebanContainer: {
    marginTop: 12,
    gap: 6,
  },
  subHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  bebanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bebanName: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'capitalize',
  },
  bebanAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },

  // Stock Valuation Box
  stockValuationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  stockValLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9a3412',
  },
  stockValAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#7c2d12',
    marginTop: 2,
  },
  stockItemsBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  stockItemsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9a3412',
  },
  alertsContainer: {
    marginTop: 12,
  },
  alertChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  alertChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  chipWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  chipExpired: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  alertChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  topSection: {
    marginTop: 14,
  },
  topList: {
    gap: 8,
  },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rankPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.tint,
  },
  topName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  topQty: {
    fontSize: 11,
    color: '#64748b',
  },
  topRevenue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },

  // Debt & Receivable
  debtGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  debtCol: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  recCol: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  payCol: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  debtColLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  recAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16a34a',
    marginTop: 2,
  },
  debtAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#dc2626',
    marginTop: 2,
  },
  debtColNote: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  dueSoonCard: {
    marginTop: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  dueSoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dueSoonIcon: {
    fontSize: 14,
  },
  dueSoonTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  dueSoonList: {
    gap: 6,
  },
  dueSoonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueCustomerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78350f',
  },
  dueDaysLeft: {
    fontSize: 10,
    color: '#b45309',
  },
  dueAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },

  // Toggle & Detail List
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    marginTop: 14,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#ffffff',
    elevation: 1,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  toggleBtnTextActive: {
    color: Colors.tint,
  },
  debtList: {
    marginTop: 10,
    gap: 8,
  },
  debtListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  debtItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  debtItemSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  debtItemAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // Trend 7 Hari
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  trendBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  trendBarVal: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 4,
  },
  trendBarTrack: {
    width: 22,
    height: 80,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    backgroundColor: '#93c5fd',
    borderRadius: 4,
  },
  trendBarFillToday: {
    backgroundColor: '#2563eb',
  },
  trendBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 6,
  },
  trendBarLabelToday: {
    color: '#2563eb',
    fontWeight: '800',
  },

  // Critical Stock Chips & List
  thresholdChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  thresholdChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  thresholdChipActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  thresholdChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  thresholdChipTextActive: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  criticalList: {
    gap: 8,
  },
  criticalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  criticalItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  criticalItemMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  stockBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  stockBadgeOut: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  stockBadgeLow: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stockBadgeTextOut: {
    color: '#b91c1c',
  },
  stockBadgeTextLow: {
    color: '#c2410c',
  },
  criticalRestockCost: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  emptyAlertBox: {
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    gap: 4,
  },
  emptyAlertIcon: {
    fontSize: 20,
  },
  emptyAlertText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Expiring List
  expiringList: {
    gap: 8,
  },
  expiringItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  expiringName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350f',
  },
  expiringMeta: {
    fontSize: 11,
    color: '#92400e',
    marginTop: 2,
  },
  daysLeftBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  daysLeftBadgeUrgent: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  daysLeftBadgeWarning: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  daysLeftText: {
    fontSize: 10,
    fontWeight: '800',
  },
  daysLeftTextUrgent: {
    color: '#b91c1c',
  },
  daysLeftTextWarning: {
    color: '#92400e',
  },

  // Expense List
  totalExpenseAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#dc2626',
  },
  emptyExpenseBox: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  emptyExpenseText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  expenseList: {
    gap: 8,
  },
  expenseItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  expenseCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'capitalize',
  },
  expenseTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  expenseDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  expenseAmountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
});
