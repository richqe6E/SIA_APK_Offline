import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
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

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { syncData, loading, refreshing, fetchData } = useMonitorStore();

  const onRefresh = () => {
    fetchData(true);
  };

  // Data helpers
  const today = syncData?.todaySummary;
  const omsetToday = today?.omset || 0;
  const omsetYesterday = today?.omsetYesterday || 0;
  const txCount = today?.transactionCount || 0;
  const avgTx = today?.avgPerTransaction || 0;
  const netProfitToday = today?.netProfitToday || 0;
  const marginPercent = today?.grossMarginPercent ?? (omsetToday > 0 ? Math.round(((today?.estimatedGrossProfit || 0) / omsetToday) * 100) : 0);
  const peakHour = today?.peakHour && today.peakHour !== '-' ? today.peakHour : null;

  // Cash vs Non-Cash
  const cashTxCount = today?.cashTxCount ?? 0;
  const cashTxTotal = today?.cashTxTotal ?? 0;
  const nonCashTxCount = today?.nonCashTxCount ?? 0;
  const nonCashTxTotal = today?.nonCashTxTotal ?? 0;
  const totalSalesTx = cashTxTotal + nonCashTxTotal;
  const cashRatio = totalSalesTx > 0 ? Math.round((cashTxTotal / totalSalesTx) * 100) : 0;
  const nonCashRatio = totalSalesTx > 0 ? 100 - cashRatio : 0;

  // Cash Liquidity
  const liquidity = syncData?.cashLiquidity;
  const cashHand = liquidity?.cashHand || 0;
  const cashBank = liquidity?.cashBank || 0;
  const totalCash = liquidity?.totalCash || (cashHand + cashBank);
  const denomObj = liquidity?.denominations || {};
  const denomSorted = Object.entries(denomObj)
    .map(([d, c]) => ({ denom: Number(d), count: Number(c) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.denom - a.denom);

  // Active Shift
  const shift = syncData?.activeShift;
  const activeCashier = shift?.cashierName || '';

  // Recent transactions
  const recentTransactions = syncData?.recentTransactions || [];

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
            <ThemedText style={styles.loadingText}>Memuat data toko AGEN SOSIS AZIZAH...</ThemedText>
          </View>
        ) : (
          <>
            {/* 1. KARTU PENJUALAN HARI INI (HERO) */}
            <Card style={styles.heroCard} padding={18}>
              <View style={styles.heroHeader}>
                <View style={styles.heroIconBox}>
                  <ThemedText style={styles.heroIcon}>💰</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.heroLabel}>PENJUALAN HARI INI</ThemedText>
                  <ThemedText style={styles.heroAmount}>{formatRupiah(omsetToday)}</ThemedText>
                </View>
                <View style={styles.yesterdayBox}>
                  <ThemedText style={styles.yesterdayLabel}>Kemarin</ThemedText>
                  <ThemedText style={styles.yesterdayAmount}>{formatRupiah(omsetYesterday)}</ThemedText>
                </View>
              </View>

              {/* 3 Metrik Inti */}
              <View style={styles.metricsRow}>
                <View style={styles.metricCol}>
                  <ThemedText style={styles.metricVal}>{txCount}</ThemedText>
                  <ThemedText style={styles.metricLbl}>Total Transaksi</ThemedText>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCol}>
                  <ThemedText style={styles.metricVal}>{formatRupiah(avgTx)}</ThemedText>
                  <ThemedText style={styles.metricLbl}>Rata-rata/Nota</ThemedText>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricCol}>
                  <ThemedText style={[styles.metricVal, { color: '#16a34a' }]}>
                    {formatRupiah(netProfitToday)}
                  </ThemedText>
                  <ThemedText style={styles.metricLbl}>Est. Laba Bersih</ThemedText>
                </View>
              </View>

              {/* Badges Pintar: Jam Tersibuk & Margin */}
              <View style={styles.smartBadgesRow}>
                <View style={styles.smartBadge}>
                  <ThemedText style={styles.smartBadgeText}>
                    📈 Margin: <ThemedText style={styles.smartBadgeBold}>{marginPercent}%</ThemedText>
                  </ThemedText>
                </View>
                {peakHour ? (
                  <View style={[styles.smartBadge, styles.smartBadgeOrange]}>
                    <ThemedText style={styles.smartBadgeText}>
                      🔥 Jam Sibuk: <ThemedText style={styles.smartBadgeBold}>{peakHour}</ThemedText>
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </Card>

            {/* 2. KARTU SPESIAL: METODE PEMBAYARAN TUNAI VS NON-TUNAI */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxPayment}>
                  <ThemedText style={styles.cardIcon}>💳</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardSectionLabel}>RINCIAN PEMBAYARAN HARI INI</ThemedText>
                  <ThemedText style={styles.cardSectionSub}>
                    Perbandingan uang kas fisik laci vs uang digital rekening
                  </ThemedText>
                </View>
              </View>

              <View style={styles.paymentColumnsRow}>
                {/* Blok Tunai */}
                <View style={[styles.paymentBox, styles.paymentCash]}>
                  <View style={styles.paymentBoxHeader}>
                    <ThemedText style={styles.paymentIcon}>💵</ThemedText>
                    <ThemedText style={styles.paymentTitle}>PEMBAYARAN TUNAI</ThemedText>
                  </View>
                  <ThemedText style={styles.paymentAmount}>{formatRupiah(cashTxTotal)}</ThemedText>
                  <ThemedText style={styles.paymentSub}>
                    {cashTxCount} Transaksi ({cashRatio}%)
                  </ThemedText>
                  <ThemedText style={styles.paymentNote}>Uang masuk laci kasir</ThemedText>
                </View>

                {/* Blok Non-Tunai */}
                <View style={[styles.paymentBox, styles.paymentDigital]}>
                  <View style={styles.paymentBoxHeader}>
                    <ThemedText style={styles.paymentIcon}>📱</ThemedText>
                    <ThemedText style={styles.paymentTitle}>NON-TUNAI (QRIS/TF)</ThemedText>
                  </View>
                  <ThemedText style={styles.paymentAmount}>{formatRupiah(nonCashTxTotal)}</ThemedText>
                  <ThemedText style={styles.paymentSub}>
                    {nonCashTxCount} Transaksi ({nonCashRatio}%)
                  </ThemedText>
                  <ThemedText style={styles.paymentNote}>Masuk langsung ke bank</ThemedText>
                </View>
              </View>

              {/* Progress Bar Visual Rasio */}
              {totalSalesTx > 0 && (
                <View style={styles.ratioBarContainer}>
                  <View style={styles.ratioLabelsRow}>
                    <ThemedText style={styles.ratioLabelLeft}>Tunai {cashRatio}%</ThemedText>
                    <ThemedText style={styles.ratioLabelRight}>Non-Tunai {nonCashRatio}%</ThemedText>
                  </View>
                  <View style={styles.ratioBarTrack}>
                    <View style={[styles.ratioBarFillCash, { width: `${cashRatio}%` }]} />
                    <View style={[styles.ratioBarFillDigital, { width: `${nonCashRatio}%` }]} />
                  </View>
                </View>
              )}
            </Card>

            {/* 3. KARTU POSISI KAS TOKO (DUAL-POCKET) */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxCash}>
                  <ThemedText style={styles.cardIcon}>🏦</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardSectionLabel}>TOTAL LIKUIDITAS KAS TOKO</ThemedText>
                  <ThemedText style={styles.cardTotalCashNumber}>
                    {formatRupiah(totalCash)}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.pocketsRow}>
                {/* Saku 1: Kas Laci */}
                <View style={[styles.pocketItem, styles.pocketLaci]}>
                  <View style={styles.pocketTitleRow}>
                    <ThemedText style={styles.pocketIcon}>💵</ThemedText>
                    <ThemedText style={styles.pocketHeading}>Kas Fisik Laci Toko</ThemedText>
                  </View>
                  <ThemedText style={styles.pocketAmountText}>{formatRupiah(cashHand)}</ThemedText>
                  <ThemedText style={styles.pocketDescText}>Saldo riil di meja kasir</ThemedText>
                </View>

                {/* Saku 2: Kas Bank */}
                <View style={[styles.pocketItem, styles.pocketBank]}>
                  <View style={styles.pocketTitleRow}>
                    <ThemedText style={styles.pocketIcon}>🏛️</ThemedText>
                    <ThemedText style={styles.pocketHeading}>Kas Rekening Bank</ThemedText>
                  </View>
                  <ThemedText style={styles.pocketAmountText}>{formatRupiah(cashBank)}</ThemedText>
                  <ThemedText style={styles.pocketDescText}>QRIS, transfer & setoran</ThemedText>
                </View>
              </View>

              {/* Rincian Lembaran Uang Fisik Kasir jika ada */}
              {denomSorted.length > 0 && (
                <View style={styles.denomBox}>
                  <ThemedText style={styles.denomTitle}>Pecahan Uang Fisik di Laci Kasir:</ThemedText>
                  <View style={styles.denomChipsRow}>
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
            </Card>

            {/* 4. STATUS KASIR DI TOKO */}
            <Card style={styles.card} padding={16}>
              <View style={styles.shiftRow}>
                <View style={styles.shiftIconBox}>
                  <ThemedText style={styles.shiftIcon}>👤</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.shiftSectionLabel}>STATUS KASIR DI TOKO</ThemedText>
                  <ThemedText style={styles.shiftCashierName}>
                    {activeCashier ? `Petugas: ${activeCashier}` : 'Belum Ada Shift Kasir Buka'}
                  </ThemedText>
                  {shift && (
                    <ThemedText style={styles.shiftMeta}>
                      Buka: {shift.openedAt} • Modal Awal: {formatRupiah(shift.initialCash)}
                    </ThemedText>
                  )}
                </View>
                <View
                  style={[
                    styles.shiftBadge,
                    activeCashier ? styles.shiftBadgeOpen : styles.shiftBadgeClosed,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.shiftBadgeText,
                      activeCashier ? styles.shiftTextOpen : styles.shiftTextClosed,
                    ]}
                  >
                    {activeCashier ? 'Shift Aktif' : 'Tutup'}
                  </ThemedText>
                </View>
              </View>
            </Card>

            {/* 5. 10 TRANSAKSI TERAKHIR KASIR */}
            <Card style={styles.card} padding={18}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBoxHistory}>
                  <ThemedText style={styles.cardIcon}>🧾</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cardSectionLabel}>TRANSAKSI PENJUALAN TERKINI</ThemedText>
                  <ThemedText style={styles.cardSectionSub}>
                    Data struk yang baru diinput kasir
                  </ThemedText>
                </View>
              </View>

              {recentTransactions.length === 0 ? (
                <ThemedText style={styles.emptyText}>
                  Belum ada transaksi penjualan hari ini
                </ThemedText>
              ) : (
                <View style={styles.txList}>
                  {recentTransactions.slice(0, 10).map((t) => {
                    const isCash =
                      (t.payment_method || '').toLowerCase() === 'cash' ||
                      (t.payment_method || '').toLowerCase() === 'tunai';
                    const timeOnly = t.created_at ? t.created_at.split(' ')[1] || t.created_at : '';

                    return (
                      <View key={t.id} style={styles.txItem}>
                        <View
                          style={[
                            styles.txMethodBadge,
                            isCash ? styles.txBadgeCash : styles.txBadgeDigital,
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.txMethodText,
                              isCash ? styles.txTextCash : styles.txTextDigital,
                            ]}
                          >
                            {isCash ? 'TUNAI' : 'QRIS/TF'}
                          </ThemedText>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <ThemedText style={styles.txNota}>Nota #{t.id}</ThemedText>
                            <ThemedText style={styles.txKasir}>• {t.cashier_name}</ThemedText>
                          </View>
                          <ThemedText style={styles.txMeta}>
                            {timeOnly} • {t.items_count || 1} produk
                          </ThemedText>
                        </View>

                        <ThemedText style={styles.txAmount}>{formatRupiah(t.total)}</ThemedText>
                      </View>
                    );
                  })}
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
  // Hero Card
  heroCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    fontSize: 22,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  heroAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.tint,
    marginTop: 2,
  },
  yesterdayBox: {
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  yesterdayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  yesterdayAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  smartBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  smartBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  smartBadgeOrange: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  smartBadgeText: {
    fontSize: 11,
    color: '#334155',
  },
  smartBadgeBold: {
    fontWeight: '800',
    color: '#0f172a',
  },

  // Generic Card Header
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
  cardIconBoxPayment: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxCash: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxHistory: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
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

  // Payment Breakdown
  paymentColumnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentBox: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  paymentCash: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  paymentDigital: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  paymentBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  paymentIcon: {
    fontSize: 14,
  },
  paymentTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  paymentSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  paymentNote: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 3,
  },
  ratioBarContainer: {
    marginTop: 14,
    gap: 6,
  },
  ratioLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratioLabelLeft: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
  },
  ratioLabelRight: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  ratioBarTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  ratioBarFillCash: {
    backgroundColor: '#16a34a',
    height: '100%',
  },
  ratioBarFillDigital: {
    backgroundColor: '#2563eb',
    height: '100%',
  },

  // Total Cash
  cardTotalCashNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#16a34a',
    marginTop: 2,
  },
  pocketsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pocketItem: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pocketLaci: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  pocketBank: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  pocketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pocketIcon: {
    fontSize: 14,
  },
  pocketHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  pocketAmountText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  pocketDescText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  denomBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  denomTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  denomChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  denomChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  denomChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  // Shift Row
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shiftIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftIcon: {
    fontSize: 18,
  },
  shiftSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  shiftCashierName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
  },
  shiftMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  shiftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  shiftBadgeOpen: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  shiftBadgeClosed: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  shiftBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  shiftTextOpen: {
    color: '#16a34a',
  },
  shiftTextClosed: {
    color: '#dc2626',
  },

  // Transaction List
  txList: {
    gap: 10,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  txMethodBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  txBadgeCash: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  txBadgeDigital: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  txMethodText: {
    fontSize: 9,
    fontWeight: '800',
  },
  txTextCash: {
    color: '#16a34a',
  },
  txTextDigital: {
    color: '#2563eb',
  },
  txNota: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  txKasir: {
    fontSize: 12,
    color: '#64748b',
  },
  txMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  txAmount: {
    fontSize: 14,
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
