import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import type { SQLiteDatabase } from '@/services/database';
import { CASH_CATEGORY_MAP } from '@/stores/cashStore';

interface LowStockProduct {
  id: number;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  min_stock: number;
  barcode: string;
  category_name: string | null;
  total_sold: number;
}

interface CategorySummary {
  category: string;
  label: string;
  icon: string;
  total_amount: number;
  tx_count: number;
  is_sales?: boolean;
  extra_info?: string;
}

interface DetailTransaction {
  id: number;
  date: string;
  amount: number;
  description: string;
  account?: string;
  created_at?: string;
  daily_seq?: number;
  payment_method?: string;
  cashier_name?: string;
}

type PeriodFilter = 'today' | 'month' | 'all';
type SectionType = 'stok' | 'kaskeluar' | 'kasmasuk';

const CATEGORY_ICONS: Record<string, string> = {
  penjualan_produk: '🛒',
  modal_awal: '💼',
  setoran_modal: '🏦',
  pendapatan_komisi: '🎁',
  pendapatan_jasa: '🤝',
  pendapatan_lain: '✨',
  pelunasan_piutang: '📥',
  pinjaman_masuk: '📥',
  tarik_bank: '🏧',
  retur_supplier: '🔄',
  kulakan_stok: '📦',
  bayar_hutang_supplier: '💳',
  belanja_bahan: '🥩',
  gas_energi: '🔥',
  operasional: '🏪',
  gaji_karyawan: '👥',
  listrik_air: '⚡',
  konsumsi_karyawan: '🍱',
  retribusi_kebersihan: '🧹',
  sewa_tempat: '🏪',
  kemasan_plastik: '🛍️',
  transportasi: '🚚',
  perawatan: '🔧',
  'lain-lain': '📝',
  prive: '👤',
  bayar_pinjaman: '💳',
  setor_bank: '🏛️',
  selisih_kas: '⚖️',
};

function fmtRp(val: number): string {
  return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
}

export function LaporanLainnyaTab({
  db,
  isKasir,
  refreshKey,
  isTabletOrLandscape,
}: {
  db: SQLiteDatabase;
  isKasir: boolean;
  refreshKey?: number;
  isTabletOrLandscape?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<SectionType>('stok');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');

  const [loading, setLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [cashOutCategories, setCashOutCategories] = useState<CategorySummary[]>([]);
  const [cashInCategories, setCashInCategories] = useState<CategorySummary[]>([]);

  // Detail Modal State
  const [selectedDetail, setSelectedDetail] = useState<{
    type: 'in' | 'out' | 'sales';
    category: string;
    label: string;
    total: number;
    count: number;
  } | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<DetailTransaction[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ─────────────────────────────────────────
  // 1. Load Data Stok Menipis / Habis (Urut Terlaris)
  // ─────────────────────────────────────────
  const loadLowStockData = useCallback(async () => {
    try {
      const rows = await db.getAllAsync<LowStockProduct>(`
        SELECT
          p.id,
          p.name,
          p.price,
          p.cost_price,
          p.stock,
          5 as min_stock,
          p.barcode,
          c.name as category_name,
          COALESCE(SUM(ti.quantity), 0) as total_sold
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN transaction_items ti ON p.id = ti.product_id
        WHERE p.has_stock = 1 AND p.stock <= 5
        GROUP BY p.id
        ORDER BY total_sold DESC, p.stock ASC
      `);
      setLowStockProducts(rows);
    } catch (e) {
      console.error('Error loadLowStockData:', e);
    }
  }, [db]);

  // ─────────────────────────────────────────
  // 2. Load Data Kas Keluar & Kas Masuk per Kategori
  // ─────────────────────────────────────────
  const loadCashData = useCallback(async () => {
    try {
      let clDateClause = '';
      let txDateClause = '';

      if (periodFilter === 'today') {
        clDateClause = "AND date = date('now','localtime')";
        txDateClause = "AND created_at >= date('now','localtime') AND created_at < date('now','localtime','+1 day')";
      } else if (periodFilter === 'month') {
        clDateClause = "AND date >= date('now','localtime','start of month') AND date < date('now','localtime','start of month','+1 month')";
        txDateClause = "AND created_at >= date('now','localtime','start of month') AND created_at < date('now','localtime','start of month','+1 month')";
      }

      // 2A. Kas Keluar per Kategori (Kecualikan pelepasan modal awal shift)
      const outRows = await db.getAllAsync<{ category: string; total_amount: number; tx_count: number }>(`
        SELECT
          category,
          SUM(amount) as total_amount,
          COUNT(*) as tx_count
        FROM cash_ledger
        WHERE type = 'out' AND category != 'modal_awal' ${clDateClause}
        GROUP BY category
        ORDER BY total_amount DESC
      `);

      const formattedOut: CategorySummary[] = outRows.map((r) => ({
        category: r.category,
        label: CASH_CATEGORY_MAP[r.category] || r.category.replace(/_/g, ' '),
        icon: CATEGORY_ICONS[r.category] || '💸',
        total_amount: r.total_amount || 0,
        tx_count: r.tx_count || 0,
      }));
      setCashOutCategories(formattedOut);

      // 2B. Kas Masuk per Kategori
      // Ambil transaksi penjualan kasir (Penjualan Produk Kas Langsung: Tunai, QRIS, Split; mengecualikan tempo)
      const salesRow = await db.getFirstAsync<{
        tx_count: number;
        total_sales: number;
        total_tunai: number;
        total_qris: number;
      }>(`
        SELECT
          COUNT(*) as tx_count,
          COALESCE(SUM(total), 0) as total_sales,
          COALESCE(SUM(CASE
            WHEN payment_method = 'split' THEN cash_received
            WHEN payment_method = 'tunai' THEN total
            ELSE 0 END), 0) as total_tunai,
          COALESCE(SUM(CASE
            WHEN payment_method = 'split' THEN qris_received
            WHEN payment_method = 'qris' THEN total
            ELSE 0 END), 0) as total_qris
        FROM transactions
        WHERE (payment_method != 'hutang' AND is_credit = 0) ${txDateClause}
      `);

      const formattedIn: CategorySummary[] = [];

      // Masukkan Penjualan Produk sebagai kategori utama kas masuk
      if (salesRow && salesRow.total_sales > 0) {
        formattedIn.push({
          category: 'penjualan_produk',
          label: 'Penjualan Produk',
          icon: '🛒',
          total_amount: salesRow.total_sales,
          tx_count: salesRow.tx_count,
          is_sales: true,
          extra_info: `Tunai: ${fmtRp(salesRow.total_tunai)} • QRIS: ${fmtRp(salesRow.total_qris)}`,
        });
      }

      // Ambil mutasi penerimaan kas lainnya dari cash_ledger (Kecualikan setor_bank dan modal_awal untuk mencegah double counting)
      const inRows = await db.getAllAsync<{ category: string; total_amount: number; tx_count: number }>(`
        SELECT
          category,
          SUM(amount) as total_amount,
          COUNT(*) as tx_count
        FROM cash_ledger
        WHERE type = 'in' AND category NOT IN ('setor_bank', 'modal_awal') ${clDateClause}
        GROUP BY category
        ORDER BY total_amount DESC
      `);

      for (const r of inRows) {
        formattedIn.push({
          category: r.category,
          label: CASH_CATEGORY_MAP[r.category] || r.category.replace(/_/g, ' '),
          icon: CATEGORY_ICONS[r.category] || '💰',
          total_amount: r.total_amount || 0,
          tx_count: r.tx_count || 0,
        });
      }

      setCashInCategories(formattedIn);
    } catch (e) {
      console.error('Error loadCashData:', e);
    }
  }, [db, periodFilter]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadLowStockData(), loadCashData()]);
    } finally {
      setLoading(false);
    }
  }, [loadLowStockData, loadCashData]);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshKey]);

  // ─────────────────────────────────────────
  // 3. Load Rincian Transaksi saat Kategori Ditekan
  // ─────────────────────────────────────────
  const handleOpenCategoryDetail = async (item: CategorySummary, type: 'in' | 'out') => {
    setSelectedDetail({
      type: item.is_sales ? 'sales' : type,
      category: item.category,
      label: item.label,
      total: item.total_amount,
      count: item.tx_count,
    });
    setLoadingDetail(true);

    try {
      let clDateClause = '';
      let txDateClause = '';
      if (periodFilter === 'today') {
        clDateClause = "AND date = date('now','localtime')";
        txDateClause = "AND created_at >= date('now','localtime') AND created_at < date('now','localtime','+1 day')";
      } else if (periodFilter === 'month') {
        clDateClause = "AND date >= date('now','localtime','start of month') AND date < date('now','localtime','start of month','+1 month')";
        txDateClause = "AND created_at >= date('now','localtime','start of month') AND created_at < date('now','localtime','start of month','+1 month')";
      }

      if (item.is_sales) {
        // Ambil rincian transaksi nota kasir (khusus kas langsung: tunai, qris, split; mengecualikan kasbon)
        const rows = await db.getAllAsync<any>(`
          SELECT
            id,
            daily_seq,
            total as amount,
            created_at as date,
            created_at,
            payment_method,
            cashier_name,
            ('Nota #' || COALESCE(daily_seq, id) || ' (' || payment_method || ')') as description
          FROM transactions
          WHERE (payment_method != 'hutang' AND is_credit = 0) ${txDateClause}
          ORDER BY created_at DESC
          LIMIT 100
        `);
        setDetailTransactions(rows);
      } else {
        // Ambil rincian mutasi dari cash_ledger
        const rows = await db.getAllAsync<any>(`
          SELECT
            id,
            date,
            amount,
            description,
            account,
            created_at
          FROM cash_ledger
          WHERE type = ? AND category = ? ${clDateClause}
          ORDER BY date DESC, id DESC
        `, type, item.category);
        setDetailTransactions(rows);
      }
    } catch (e) {
      console.error('Error load detail transactions:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const totalCashOut = useMemo(() => {
    return cashOutCategories.reduce((sum, c) => sum + c.total_amount, 0);
  }, [cashOutCategories]);

  const totalCashIn = useMemo(() => {
    return cashInCategories.reduce((sum, c) => sum + c.total_amount, 0);
  }, [cashInCategories]);

  return (
    <View style={styles.container}>
      {/* 1. Bar Navigasi 3 Bagian Laporan Lainnya */}
      <View style={styles.sectionTabRow}>
        <TouchableOpacity
          style={[styles.sectionTabBtn, activeSection === 'stok' && styles.sectionTabBtnActive]}
          onPress={() => setActiveSection('stok')}
          activeOpacity={0.8}
        >
          <ThemedText style={{ fontSize: 13 }}>⚠️</ThemedText>
          <ThemedText style={[styles.sectionTabText, activeSection === 'stok' && styles.sectionTabTextActive]}>
            Stok Menipis & Habis ({lowStockProducts.length})
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionTabBtn, activeSection === 'kaskeluar' && styles.sectionTabBtnActive]}
          onPress={() => setActiveSection('kaskeluar')}
          activeOpacity={0.8}
        >
          <ThemedText style={{ fontSize: 13 }}>💸</ThemedText>
          <ThemedText style={[styles.sectionTabText, activeSection === 'kaskeluar' && styles.sectionTabTextActive]}>
            Kas Keluar per Kategori
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionTabBtn, activeSection === 'kasmasuk' && styles.sectionTabBtnActive]}
          onPress={() => setActiveSection('kasmasuk')}
          activeOpacity={0.8}
        >
          <ThemedText style={{ fontSize: 13 }}>📥</ThemedText>
          <ThemedText style={[styles.sectionTabText, activeSection === 'kasmasuk' && styles.sectionTabTextActive]}>
            Kas Masuk per Kategori
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* 2. Filter Periode Cepat (Khusus Kas Keluar & Kas Masuk) */}
      {activeSection !== 'stok' && (
        <View style={styles.periodFilterRow}>
          <TouchableOpacity
            style={[styles.periodChip, periodFilter === 'today' && styles.periodChipActive]}
            onPress={() => setPeriodFilter('today')}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.periodChipText, periodFilter === 'today' && styles.periodChipTextActive]}>
              📅 Hari Ini
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodChip, periodFilter === 'month' && styles.periodChipActive]}
            onPress={() => setPeriodFilter('month')}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.periodChipText, periodFilter === 'month' && styles.periodChipTextActive]}>
              📆 Bulan Ini
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodChip, periodFilter === 'all' && styles.periodChipActive]}
            onPress={() => setPeriodFilter('all')}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.periodChipText, periodFilter === 'all' && styles.periodChipTextActive]}>
              ♾️ Semua Waktu
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.tint} />
          <ThemedText style={styles.loadingText}>Memuat data laporan lainnya...</ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
          {/* ─────────────────────────────────────────
              BAGIAN 1: STOK MENIPIS & HABIS (URUT TERLARIS)
             ───────────────────────────────────────── */}
          {activeSection === 'stok' && (
            <View>
              <Card padding={12} style={styles.infoBanner}>
                <ThemedText style={styles.infoBannerTitle}>
                  🔥 PRIORITAS RESTOCK BERDASARKAN PENJUALAN TERLARIS
                </ThemedText>
                <ThemedText style={styles.infoBannerSubtitle}>
                  Produk dengan stok sedikit (≤ 5) atau habis yang memiliki angka penjualan paling tinggi disajikan di urutan teratas agar toko segera melakukan kulakan.
                </ThemedText>
              </Card>

              {lowStockProducts.length === 0 ? (
                <Card padding={24} style={styles.emptyCard}>
                  <ThemedText style={{ fontSize: 32, textAlign: 'center', marginBottom: 6 }}>✅</ThemedText>
                  <ThemedText style={styles.emptyTitle}>Semua Stok Aman & Tercukupi</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>Tidak ada produk yang stoknya habis atau berada di bawah batas minimum saat ini.</ThemedText>
                </Card>
              ) : (
                <View style={{ gap: 8, paddingBottom: 32 }}>
                  {lowStockProducts.map((p, idx) => {
                    const isOut = p.stock === 0;
                    return (
                      <Card key={p.id} padding={12} style={[styles.productItemCard, isOut && styles.productItemCardOut]}>
                        <View style={styles.productCardHeader}>
                          <View style={styles.rankBadge}>
                            <ThemedText style={styles.rankBadgeText}>#{idx + 1} TERLARIS</ThemedText>
                          </View>
                          <View style={styles.soldBadge}>
                            <ThemedText style={styles.soldBadgeText}>🔥 Terjual {p.total_sold} pcs</ThemedText>
                          </View>
                          <View style={[styles.stockStatusBadge, isOut ? styles.stockStatusBadgeOut : styles.stockStatusBadgeLow]}>
                            <ThemedText style={[styles.stockStatusBadgeText, isOut && { color: '#ffffff' }]}>
                              {isOut ? 'HABIS (0)' : `Sisa ${p.stock} pcs`}
                            </ThemedText>
                          </View>
                        </View>

                        <ThemedText type="defaultSemiBold" style={styles.productName} numberOfLines={2}>
                          {p.name}
                        </ThemedText>

                        <View style={styles.productMetaRow}>
                          <ThemedText style={styles.productPriceText}>
                            Jual: {fmtRp(p.price)}
                          </ThemedText>
                          {p.cost_price > 0 && (
                            <ThemedText style={styles.productCostText}>
                              • HPP: {fmtRp(p.cost_price)}
                            </ThemedText>
                          )}
                          {p.category_name && (
                            <ThemedText style={styles.productCatText}>
                              • {p.category_name}
                            </ThemedText>
                          )}
                          {p.barcode ? (
                            <ThemedText style={styles.productSkuText}>
                              • SKU: {p.barcode}
                            </ThemedText>
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ─────────────────────────────────────────
              BAGIAN 2: TOTAL KAS KELUAR PER KATEGORI
             ───────────────────────────────────────── */}
          {activeSection === 'kaskeluar' && (
            <View>
              <Card padding={14} style={styles.summaryTotalCardOut}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <ThemedText style={styles.summaryTotalLabel}>TOTAL KAS KELUAR</ThemedText>
                    <ThemedText style={styles.summaryTotalSub}>
                      {periodFilter === 'today' ? 'Hari Ini' : periodFilter === 'month' ? 'Bulan Ini' : 'Seluruh Waktu'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.summaryTotalValOut}>{fmtRp(totalCashOut)}</ThemedText>
                </View>
              </Card>

              <ThemedText style={styles.sectionHeaderTitle}>
                Rincian Berdasarkan Kategori Kas Keluar (Tekan untuk lihat transaksi):
              </ThemedText>

              {cashOutCategories.length === 0 ? (
                <Card padding={24} style={styles.emptyCard}>
                  <ThemedText style={{ fontSize: 32, textAlign: 'center', marginBottom: 6 }}>📭</ThemedText>
                  <ThemedText style={styles.emptyTitle}>Belum Ada Kas Keluar</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>Tidak ada pengeluaran kas atau beban pada periode ini.</ThemedText>
                </Card>
              ) : (
                <View style={{ gap: 8, paddingBottom: 32 }}>
                  {cashOutCategories.map((c) => (
                    <TouchableOpacity
                      key={c.category}
                      activeOpacity={0.7}
                      onPress={() => handleOpenCategoryDetail(c, 'out')}
                    >
                      <Card padding={12} style={styles.categoryCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                            <View style={[styles.categoryIconCircle, { backgroundColor: '#fee2e2' }]}>
                              <ThemedText style={{ fontSize: 16 }}>{c.icon}</ThemedText>
                            </View>
                            <View style={{ flex: 1 }}>
                              <ThemedText type="defaultSemiBold" style={{ fontSize: 13, color: '#1e293b' }}>
                                {c.label}
                              </ThemedText>
                              <ThemedText style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
                                {c.tx_count} kali transaksi pengeluaran
                              </ThemedText>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#b91c1c' }}>
                              - {fmtRp(c.total_amount)}
                            </ThemedText>
                            <ThemedText style={{ fontSize: 10, color: Colors.tint, fontWeight: '700', marginTop: 2 }}>
                              Lihat Rincian ›
                            </ThemedText>
                          </View>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ─────────────────────────────────────────
              BAGIAN 3: TOTAL KAS MASUK PER KATEGORI
             ───────────────────────────────────────── */}
          {activeSection === 'kasmasuk' && (
            <View>
              <Card padding={14} style={styles.summaryTotalCardIn}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <ThemedText style={styles.summaryTotalLabel}>TOTAL KAS MASUK</ThemedText>
                    <ThemedText style={styles.summaryTotalSub}>
                      {periodFilter === 'today' ? 'Hari Ini' : periodFilter === 'month' ? 'Bulan Ini' : 'Seluruh Waktu'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.summaryTotalValIn}>{fmtRp(totalCashIn)}</ThemedText>
                </View>
              </Card>

              <ThemedText style={styles.sectionHeaderTitle}>
                Rincian Berdasarkan Kategori Kas Masuk (Tekan untuk lihat transaksi):
              </ThemedText>

              {cashInCategories.length === 0 ? (
                <Card padding={24} style={styles.emptyCard}>
                  <ThemedText style={{ fontSize: 32, textAlign: 'center', marginBottom: 6 }}>📭</ThemedText>
                  <ThemedText style={styles.emptyTitle}>Belum Ada Kas Masuk</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>Tidak ada transaksi penjualan atau penerimaan kas pada periode ini.</ThemedText>
                </Card>
              ) : (
                <View style={{ gap: 8, paddingBottom: 32 }}>
                  {cashInCategories.map((c) => (
                    <TouchableOpacity
                      key={c.category}
                      activeOpacity={0.7}
                      onPress={() => handleOpenCategoryDetail(c, 'in')}
                    >
                      <Card padding={12} style={[styles.categoryCard, c.is_sales && styles.categoryCardSales]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                            <View style={[styles.categoryIconCircle, { backgroundColor: c.is_sales ? '#dbeafe' : '#dcfce7' }]}>
                              <ThemedText style={{ fontSize: 16 }}>{c.icon}</ThemedText>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <ThemedText type="defaultSemiBold" style={{ fontSize: 13, color: '#1e293b' }}>
                                  {c.label}
                                </ThemedText>
                                {c.is_sales && (
                                  <View style={styles.primaryBadge}>
                                    <ThemedText style={styles.primaryBadgeText}>UTAMA</ThemedText>
                                  </View>
                                )}
                              </View>
                              <ThemedText style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
                                {c.tx_count} transaksi penerimaan
                              </ThemedText>
                              {c.extra_info ? (
                                <ThemedText style={{ fontSize: 9.5, color: '#0369a1', marginTop: 2, fontWeight: '600' }}>
                                  {c.extra_info}
                                </ThemedText>
                              ) : null}
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <ThemedText style={{ fontSize: 14, fontWeight: '800', color: '#15803d' }}>
                              + {fmtRp(c.total_amount)}
                            </ThemedText>
                            <ThemedText style={{ fontSize: 10, color: Colors.tint, fontWeight: '700', marginTop: 2 }}>
                              Lihat Rincian ›
                            </ThemedText>
                          </View>
                        </View>
                      </Card>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ─────────────────────────────────────────
          MODAL DETAIL TRANSAKSI KATEGORI
         ───────────────────────────────────────── */}
      <Modal
        visible={selectedDetail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDetail(null)}
      >
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.detailModalCard} padding={16}>
            {/* Header Modal Detail */}
            <View style={styles.detailHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <ThemedText style={{ fontSize: 11, fontWeight: '800', color: Colors.tint, letterSpacing: 0.5 }}>
                    RINCIAN TRANSAKSI
                  </ThemedText>
                  <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                    <ThemedText style={{ fontSize: 10, color: '#475569', fontWeight: '700' }}>
                      {selectedDetail?.count} Transaksi
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="title" style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>
                  {selectedDetail?.label}
                </ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: '900', color: selectedDetail?.type === 'out' ? '#b91c1c' : '#15803d', marginTop: 2 }}>
                  Total: {fmtRp(selectedDetail?.total || 0)}
                </ThemedText>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedDetail(null)}
                style={styles.detailCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ThemedText style={styles.detailCloseBtnText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            {/* List Transaksi */}
            {loadingDetail ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.tint} />
                <ThemedText style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                  Memuat rincian transaksi...
                </ThemedText>
              </View>
            ) : detailTransactions.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ThemedText style={{ fontSize: 12, color: '#64748b' }}>
                  Tidak ada catatan transaksi ditemukan.
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={detailTransactions}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
                style={{ maxHeight: 420 }}
                renderItem={({ item }) => (
                  <View style={styles.txRowCard}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <ThemedText type="defaultSemiBold" style={{ fontSize: 12, color: '#0f172a' }}>
                        {item.description || selectedDetail?.label}
                      </ThemedText>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <ThemedText style={{ fontSize: 10, color: '#64748b' }}>
                          📅 {item.date ? item.date.slice(0, 16) : item.created_at?.slice(0, 16)}
                        </ThemedText>
                        {item.account && (
                          <View style={[styles.accountBadge, item.account === 'bank' && styles.accountBadgeBank]}>
                            <ThemedText style={[styles.accountBadgeText, item.account === 'bank' && styles.accountBadgeTextBank]}>
                              {item.account === 'bank' ? '🏛️ Bank' : '💵 Laci'}
                            </ThemedText>
                          </View>
                        )}
                        {item.cashier_name && (
                          <ThemedText style={{ fontSize: 9.5, color: '#94a3b8' }}>
                            Kasir: {item.cashier_name}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                    <ThemedText
                      style={{
                        fontSize: 12.5,
                        fontWeight: '800',
                        color: selectedDetail?.type === 'out' ? '#b91c1c' : '#15803d',
                      }}
                    >
                      {selectedDetail?.type === 'out' ? '- ' : '+ '} {fmtRp(item.amount)}
                    </ThemedText>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.closeDetailModalBtn}
              onPress={() => setSelectedDetail(null)}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.closeDetailModalBtnText}>Tutup Rincian</ThemedText>
            </TouchableOpacity>
          </Card>
        </ThemedView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },
  sectionTabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  sectionTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  sectionTabBtnActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tintDark,
  },
  sectionTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  sectionTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  periodFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  periodChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  periodChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  periodChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  periodChipTextActive: {
    color: '#1d4ed8',
    fontWeight: '800',
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 11.5,
    color: '#64748b',
  },
  contentScroll: {
    flex: 1,
  },
  infoBanner: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    marginBottom: 10,
  },
  infoBannerTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoBannerSubtitle: {
    fontSize: 10,
    color: '#92400e',
    lineHeight: 14,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 3,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  productItemCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1.2,
  },
  productItemCardOut: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  rankBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rankBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#334155',
  },
  soldBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  soldBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#c2410c',
  },
  stockStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  stockStatusBadgeLow: {
    backgroundColor: '#fef3c7',
  },
  stockStatusBadgeOut: {
    backgroundColor: '#dc2626',
  },
  stockStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400e',
  },
  productName: {
    fontSize: 13.5,
    color: '#0f172a',
    lineHeight: 18,
    marginBottom: 2,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  productPriceText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.tint,
  },
  productCostText: {
    fontSize: 10.5,
    color: '#64748b',
  },
  productCatText: {
    fontSize: 10.5,
    color: '#64748b',
  },
  productSkuText: {
    fontSize: 10.5,
    color: '#94a3b8',
  },
  summaryTotalCardOut: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1.5,
    marginBottom: 10,
  },
  summaryTotalCardIn: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1.5,
    marginBottom: 10,
  },
  summaryTotalLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  summaryTotalSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  summaryTotalValOut: {
    fontSize: 18,
    fontWeight: '900',
    color: '#be123c',
  },
  summaryTotalValIn: {
    fontSize: 18,
    fontWeight: '900',
    color: '#15803d',
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1.2,
  },
  categoryCardSales: {
    borderColor: '#93c5fd',
    backgroundColor: '#f8fafc',
  },
  categoryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  primaryBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  detailModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 6,
  },
  detailCloseBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  detailCloseBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 'bold',
  },
  txRowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  accountBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  accountBadgeBank: {
    backgroundColor: '#e0f2fe',
  },
  accountBadgeText: {
    fontSize: 8.5,
    color: '#475569',
    fontWeight: '700',
  },
  accountBadgeTextBank: {
    color: '#0369a1',
  },
  closeDetailModalBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  closeDetailModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
});
