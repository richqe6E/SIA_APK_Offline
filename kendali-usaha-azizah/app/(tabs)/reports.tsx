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

  const onRefresh = () => {
    fetchData(true);
  };

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
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
});
