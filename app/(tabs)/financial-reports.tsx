import DateTimePicker from '@react-native-community/datetimepicker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import type { SQLiteDatabase } from '@/services/database';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useLockOrientation } from '@/hooks/use-orientation';
import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  useCashStore,
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  CASH_CATEGORY_MAP,
  getCashOutCategories,
  type CashTransactionType,
  type CashEntry,
} from '@/stores/cashStore';
import { exportCashLedgerToPDF, exportLabaRugiToPDF, shareFile } from '@/services/export';
import { printLaporanLabaRugi } from '@/services/print';
import { usePrinterStore } from '@/stores/printerStore';
import { useDebtReceivableStore } from '@/stores/debtReceivableStore';
import { useRouter } from 'expo-router';

// ─────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────
type ActiveTab = 'labarugi' | 'bukukas';
type FilterMode = 'month' | 'year';

interface LabaRugiData {
  periodeLabel: string;
  penjualanBruto: number;
  hpp: number;
  labaKotor: number;
  totalBeban: number;
  labaOperasional: number;
  pendapatanLain: number;
  labaBersih: number;
  bebanByCategory: { category: string; total: number }[];
  jumlahTransaksi: number;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const CATEGORY_ICONS: Record<string, string> = {
  gaji_karyawan: '👤',
  sewa_tempat: '🏠',
  listrik_air: '⚡',
  transportasi: '🚗',
  kemasan_plastik: '🛍️',
  perawatan: '🔧',
  belanja_bahan: '📦',
  kulakan_stok: '🛒',
  'lain-lain': '📝',
  gaji: '👤',
  sewa: '🏠',
  listrik: '⚡',
  bahan_baku: '📦',
  pendapatan_lain: '💵',
  modal_awal: '💰',
  setoran_modal: '🏦',
  retur_supplier: '🔄',
};

function fmtRp(n: number) {
  const sign = n < 0 ? '- ' : '';
  return sign + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
}

// ─────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────
export default function FinancialReportsScreen() {
  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { storeName, businessType, businessMode, storeAddress, storePhone } = useSettingsStore();
  const { printerTarget } = usePrinterStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('labarugi');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const tabs: { key: ActiveTab; label: string; icon: string }[] = [
    { key: 'labarugi', label: 'Laba / Rugi', icon: '📊' },
    { key: 'bukukas', label: 'Buku Kas', icon: '📒' },
  ];

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'labarugi') {
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
      <ThemedText type="title" style={{ marginBottom: 4 }}>Laporan Keuangan</ThemedText>
      <ThemedText style={{ fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
        Standar Akuntansi POS Mikro ({businessMode === 'kuliner' ? 'Mode Kuliner' : 'Mode Retail'})
      </ThemedText>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
            onPress={() => handleTabChange(t.key)}
          >
            <ThemedText style={{ fontSize: 13, lineHeight: 17 }}>{t.icon}</ThemedText>
            <ThemedText style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
              {t.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {activeTab === 'labarugi' && (
        <LabaRugiTab
          db={db}
          storeName={storeName}
          businessType={businessType}
          storeAddress={storeAddress}
          storePhone={storePhone}
          printerTarget={printerTarget}
          router={router}
          refreshKey={refreshTrigger}
        />
      )}
      {activeTab === 'bukukas' && (
        <BukuKasTab
          db={db}
          onMutate={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}
    </ThemedView>
  );
}

// ─────────────────────────────────────────
// Laba/Rugi Tab
// ─────────────────────────────────────────
function LabaRugiTab({
  db, storeName, businessType, storeAddress, storePhone, printerTarget, router, refreshKey,
}: {
  db: SQLiteDatabase;
  storeName: string;
  businessType: string;
  storeAddress?: string;
  storePhone?: string;
  printerTarget: string | null;
  router: any;
  refreshKey?: number;
}) {
  const now = new Date();
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [data, setData] = useState<LabaRugiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearModal, setShowYearModal] = useState(false);
  const [customYearInput, setCustomYearInput] = useState('');
  const [availableYears, setAvailableYears] = useState<number[]>(() => {
    const cur = now.getFullYear();
    return [cur + 1, cur, cur - 1, cur - 2, cur - 3, cur - 4];
  });

  const loadAvailableYears = useCallback(async () => {
    try {
      const curYear = new Date().getFullYear();
      const yearSet = new Set<number>();
      for (let y = curYear - 4; y <= curYear + 1; y++) {
        yearSet.add(y);
      }
      const txRows = await db.getAllAsync<{ y: string }>(
        "SELECT DISTINCT strftime('%Y', created_at) as y FROM transactions WHERE created_at IS NOT NULL"
      );
      const clRows = await db.getAllAsync<{ y: string }>(
        "SELECT DISTINCT strftime('%Y', date) as y FROM cash_ledger WHERE date IS NOT NULL"
      );
      for (const r of [...txRows, ...clRows]) {
        const val = parseInt(r.y, 10);
        if (!isNaN(val) && val > 2000 && val < 2100) {
          yearSet.add(val);
        }
      }
      yearSet.add(selectedYear);
      setAvailableYears(Array.from(yearSet).sort((a, b) => b - a));
    } catch (e) {
      console.error('loadAvailableYears error:', e);
    }
  }, [db, selectedYear]);

  useEffect(() => {
    loadAvailableYears();
  }, [loadAvailableYears]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let salesQuery = '';
      let hppQuery = '';
      let cashLedgerWhere = '';
      let otherIncomeWhere = '';

      if (filterMode === 'month') {
        const mm = String(selectedMonth).padStart(2, '0');
        const yy = String(selectedYear);
        salesQuery = `WHERE strftime('%m', t.created_at) = '${mm}' AND strftime('%Y', t.created_at) = '${yy}'`;
        hppQuery = `WHERE strftime('%m', t.created_at) = '${mm}' AND strftime('%Y', t.created_at) = '${yy}'`;
        cashLedgerWhere = `WHERE type = 'out' AND category NOT IN ('kulakan_stok', 'bayar_hutang_supplier') AND strftime('%m', date) = '${mm}' AND strftime('%Y', date) = '${yy}'`;
        otherIncomeWhere = `WHERE type = 'in' AND category = 'pendapatan_lain' AND strftime('%m', date) = '${mm}' AND strftime('%Y', date) = '${yy}'`;
      } else {
        salesQuery = `WHERE strftime('%Y', t.created_at) = '${selectedYear}'`;
        hppQuery = `WHERE strftime('%Y', t.created_at) = '${selectedYear}'`;
        cashLedgerWhere = `WHERE type = 'out' AND category NOT IN ('kulakan_stok', 'bayar_hutang_supplier') AND strftime('%Y', date) = '${selectedYear}'`;
        otherIncomeWhere = `WHERE type = 'in' AND category = 'pendapatan_lain' AND strftime('%Y', date) = '${selectedYear}'`;
      }

      // 1. Penjualan bruto
      const salesResult = await db.getFirstAsync<{ total: number; count: number }>(
        `SELECT COALESCE(SUM(t.total), 0) as total, COUNT(*) as count
         FROM transactions t ${salesQuery}`
      );

      // 2. HPP = SUM(qty * cost_price) dari transaction_items
      const hppResult = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(ti.quantity * ti.cost_price), 0) as total
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         ${hppQuery}`
      );

      // 3. Beban Operasional: Single Source of Truth dari cash_ledger
      const expenseResult = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger ${cashLedgerWhere}`
      );

      const bebanByCategory = await db.getAllAsync<{ category: string; total: number }>(
        `SELECT category, COALESCE(SUM(amount), 0) as total FROM cash_ledger
         ${cashLedgerWhere} GROUP BY category ORDER BY total DESC`
      );

      // 4. Pendapatan Lain-lain dari cash_ledger
      const otherIncomeResult = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_ledger ${otherIncomeWhere}`
      );

      const penjualanBruto = salesResult?.total ?? 0;
      const hpp = hppResult?.total ?? 0;
      const labaKotor = penjualanBruto - hpp;
      const totalBeban = expenseResult?.total ?? 0;
      const labaOperasional = labaKotor - totalBeban;
      const pendapatanLain = otherIncomeResult?.total ?? 0;
      const labaBersih = labaOperasional + pendapatanLain;

      const periodeLabel = filterMode === 'month'
        ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
        : `Tahun ${selectedYear}`;

      setData({
        periodeLabel,
        penjualanBruto,
        hpp,
        labaKotor,
        totalBeban,
        labaOperasional,
        pendapatanLain,
        labaBersih,
        bebanByCategory,
        jumlahTransaksi: salesResult?.count ?? 0,
      });
    } catch (e) {
      console.error('loadData error:', e);
      Alert.alert('Error', 'Gagal memuat data laporan.');
    } finally {
      setLoading(false);
    }
  }, [db, filterMode, selectedMonth, selectedYear]);

  // Otomatis muat data saat filter berubah atau trigger refresh
  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const handleExportPDF = async () => {
    try {
      if (!data) return;
      const uri = await exportLabaRugiToPDF({
        storeName,
        businessType,
        storeAddress,
        storePhone,
        data,
      });
      await shareFile(uri, 'application/pdf');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Export PDF gagal');
    }
  };

  const handlePrint = async () => {
    if (!printerTarget) {
      Alert.alert('Printer belum terhubung', 'Hubungkan printer di tab Pengaturan terlebih dahulu.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Buka Printer', onPress: () => router.push('/(tabs)/printer') },
      ]);
      return;
    }
    if (!data) return;
    try {
      await printLaporanLabaRugi({ storeName, businessType, data });
      Alert.alert('Sukses', 'Laporan berhasil dicetak');
    } catch {
      Alert.alert('Gagal', 'Cetak gagal. Periksa koneksi printer.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Filter Controls Clean & Polished */}
      <View style={styles.filterCard}>
        {/* Row 1: Mode Switch & Refresh Button */}
        <View style={styles.filterHeaderRow}>
          <View style={styles.filterModeRow}>
            {(['month', 'year'] as FilterMode[]).map((m) => (
              <Pressable
                key={m}
                style={[styles.filterModeBtn, filterMode === m && styles.filterModeBtnActive]}
                onPress={() => setFilterMode(m)}
              >
                <ThemedText style={[styles.filterModeBtnText, filterMode === m && styles.filterModeBtnTextActive]}>
                  {m === 'month' ? '📅 Per Bulan' : '📆 Per Tahun'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadData}
            activeOpacity={0.75}
          >
            <ThemedText style={styles.refreshBtnText}>🔄 Muat Ulang</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Row 2: Selectors */}
        <View style={styles.filterSelectorRow}>
          {filterMode === 'month' && (
            <Pressable style={styles.monthSelectBtn} onPress={() => setShowMonthPicker(true)}>
              <ThemedText style={styles.selectorLabel}>Bulan</ThemedText>
              <View style={styles.selectorValueRow}>
                <ThemedText style={styles.selectorValueText}>{MONTH_NAMES[selectedMonth - 1]}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: Colors.tint }}>▾</ThemedText>
              </View>
            </Pressable>
          )}

          <View style={[styles.yearSelectContainer, filterMode === 'year' && { flex: 1 }]}>
            <View style={styles.yearHeaderRow}>
              <ThemedText style={styles.selectorLabel}>Tahun</ThemedText>
              <Pressable
                onPress={() => {
                  setCustomYearInput('');
                  setShowYearModal(true);
                }}
              >
                <ThemedText style={styles.yearOtherLink}>+ Tahun Lain</ThemedText>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
              {availableYears.map((y) => (
                <Pressable
                  key={y}
                  style={[styles.yearChip, selectedYear === y && styles.yearChipActive]}
                  onPress={() => setSelectedYear(y)}
                >
                  <ThemedText style={[styles.yearChipText, selectedYear === y && styles.yearChipTextActive]}>
                    {y}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Month picker for iOS */}
      {showMonthPicker && Platform.OS === 'ios' && (
        <DateTimePicker
          value={new Date(selectedYear, selectedMonth - 1, 1)}
          mode="date"
          display="spinner"
          onChange={(_, date) => {
            setShowMonthPicker(false);
            if (date) {
              setSelectedMonth(date.getMonth() + 1);
              setSelectedYear(date.getFullYear());
            }
          }}
        />
      )}

      {/* Android month selector via modal */}
      {showMonthPicker && Platform.OS === 'android' && (
        <Modal transparent animationType="fade">
          <ThemedView style={styles.monthPickerOverlay}>
            <Card style={styles.monthPickerCard} padding={16}>
              <ThemedText type="defaultSemiBold" style={{ marginBottom: 12 }}>Pilih Bulan</ThemedText>
              <View style={styles.monthGrid}>
                {MONTH_NAMES.map((m, i) => (
                  <Pressable
                    key={i}
                    style={[styles.monthChip, selectedMonth === i + 1 && styles.monthChipActive]}
                    onPress={() => { setSelectedMonth(i + 1); setShowMonthPicker(false); }}
                  >
                    <ThemedText style={[styles.monthChipText, selectedMonth === i + 1 && styles.monthChipTextActive]}>
                      {m.slice(0, 3)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <Button title="Batal" variant="secondary" size="sm" onPress={() => setShowMonthPicker(false)} style={{ marginTop: 8 }} />
            </Card>
          </ThemedView>
        </Modal>
      )}

      {/* Year Selector Modal (Pilih Tahun Bebas) */}
      <Modal visible={showYearModal} transparent animationType="fade">
        <ThemedView style={styles.monthPickerOverlay}>
          <Card style={styles.monthPickerCard} padding={16}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 6 }}>Pilih Tahun Laporan</ThemedText>
            <ThemedText style={{ fontSize: 11, color: Colors.muted, marginBottom: 10 }}>
              Pilih tahun cepat atau ketik tahun yang diinginkan:
            </ThemedText>

            {/* Quick Year Grid */}
            <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
              <View style={styles.monthGrid}>
                {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() + 2 - i).map((yr) => (
                  <Pressable
                    key={yr}
                    style={[styles.monthChip, selectedYear === yr && styles.monthChipActive]}
                    onPress={() => {
                      setSelectedYear(yr);
                      setShowYearModal(false);
                    }}
                  >
                    <ThemedText style={[styles.monthChipText, selectedYear === yr && styles.monthChipTextActive]}>
                      {yr}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={{ marginTop: 12, marginBottom: 12 }}>
              <ThemedText style={styles.formLabel}>Ketik Tahun Bebas (contoh: 2020 atau 2028)</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="YYYY (contoh: 2020)"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                maxLength={4}
                value={customYearInput}
                onChangeText={setCustomYearInput}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title="Batal"
                variant="secondary"
                size="sm"
                style={{ flex: 1 }}
                onPress={() => setShowYearModal(false)}
              />
              <Button
                title="Pilih Tahun"
                size="sm"
                style={{ flex: 1 }}
                onPress={() => {
                  const yr = parseInt(customYearInput, 10);
                  if (yr && yr >= 2000 && yr <= 2099) {
                    setSelectedYear(yr);
                    setShowYearModal(false);
                  } else if (!customYearInput.trim()) {
                    setShowYearModal(false);
                  } else {
                    Alert.alert('Tahun Tidak Valid', 'Masukkan tahun antara 2000 s/d 2099');
                  }
                }}
              />
            </View>
          </Card>
        </ThemedView>
      </Modal>

      {loading && <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 32 }} />}

      {data && !loading && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Executive Summary Card (Ringkasan Eksekutif) */}
          <Card style={styles.execSummaryCard} padding={16}>
            <View style={styles.execHeaderRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.execTitle}>IKHTISAR LABA / RUGI</ThemedText>
                <ThemedText style={styles.execSubtitle}>{storeName} • {data.periodeLabel}</ThemedText>
              </View>
              <View style={[styles.execBadge, { backgroundColor: data.labaBersih >= 0 ? '#dcfce7' : '#fee2e2' }]}>
                <ThemedText style={[styles.execBadgeText, { color: data.labaBersih >= 0 ? '#15803d' : '#b91c1c' }]}>
                  {data.labaBersih >= 0 ? 'UNTUNG' : 'RUGI'}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.execStandardText}>
              Standar Akuntansi SAK EMKM ({data.jumlahTransaksi} transaksi tercatat)
            </ThemedText>

            <View style={styles.execDivider} />

            {/* KPI Rows */}
            <View style={styles.execRow}>
              <ThemedText style={styles.execLabel}>📈 Pendapatan Penjualan Bersih</ThemedText>
              <ThemedText style={styles.execValueBold}>{fmtRp(data.penjualanBruto)}</ThemedText>
            </View>
            <View style={styles.execRow}>
              <ThemedText style={styles.execLabel}>📦 Beban Pokok Penjualan (HPP)</ThemedText>
              <ThemedText style={[styles.execValue, { color: '#64748b' }]}>- {fmtRp(data.hpp)}</ThemedText>
            </View>
            <View style={[styles.execRow, { paddingVertical: 5, backgroundColor: '#f8fafc', borderRadius: 6, paddingHorizontal: 6 }]}>
              <ThemedText style={[styles.execLabel, { fontWeight: '700', color: '#0f172a' }]}>📊 Laba Kotor Usaha</ThemedText>
              <ThemedText style={[styles.execValueBold, { color: data.labaKotor >= 0 ? '#0f172a' : Colors.danger }]}>
                {fmtRp(data.labaKotor)}
              </ThemedText>
            </View>
            <View style={styles.execRow}>
              <ThemedText style={styles.execLabel}>💸 Beban Operasional Usaha</ThemedText>
              <ThemedText style={[styles.execValue, { color: Colors.danger }]}>- {fmtRp(data.totalBeban)}</ThemedText>
            </View>
            {data.pendapatanLain > 0 && (
              <View style={styles.execRow}>
                <ThemedText style={styles.execLabel}>💵 Pendapatan Non-Operasional</ThemedText>
                <ThemedText style={[styles.execValue, { color: Colors.success }]}>+ {fmtRp(data.pendapatanLain)}</ThemedText>
              </View>
            )}

            {/* Net Income Banner */}
            <View style={[styles.execNetBanner, { backgroundColor: data.labaBersih >= 0 ? '#f0fdf4' : '#fef2f2', borderColor: data.labaBersih >= 0 ? '#86efac' : '#fca5a5' }]}>
              <View>
                <ThemedText style={[styles.execNetLabel, { color: data.labaBersih >= 0 ? '#166534' : '#991b1b' }]}>
                  {data.labaBersih >= 0 ? 'LABA BERSIH (NET PROFIT)' : 'RUGI BERSIH (NET LOSS)'}
                </ThemedText>
                {data.penjualanBruto > 0 && (
                  <ThemedText style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                    Margin: {((data.labaBersih / data.penjualanBruto) * 100).toFixed(1)}%
                  </ThemedText>
                )}
              </View>
              <ThemedText style={[styles.execNetValue, { color: data.labaBersih >= 0 ? '#15803d' : '#b91c1c' }]}>
                {fmtRp(data.labaBersih)}
              </ThemedText>
            </View>

            {/* Tombol Buka Lembar Kerja Slip */}
            <Pressable
              style={styles.openSlipBtn}
              onPress={() => setShowSlipModal(true)}
            >
              <ThemedText style={{ fontSize: 15 }}>📑</ThemedText>
              <ThemedText style={styles.openSlipBtnText}>
                Buka Lembar Kerja / Slip Laba Rugi Resmi
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: '#2563eb' }}>›</ThemedText>
            </Pressable>
          </Card>

          {/* Quick Action buttons */}
          <View style={styles.actionRow}>
            <Button
              title="📄 Export PDF"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={handleExportPDF}
            />
            <Button
              title="🖨️ Cetak Thermal"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={handlePrint}
            />
          </View>
        </ScrollView>
      )}

      {/* Modal Lembar Kerja / Slip Laba Rugi Standar SAK EMKM */}
      {data && (
        <Modal
          visible={showSlipModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSlipModal(false)}
        >
          <ThemedView style={styles.slipModalContainer}>
            {/* Top Bar Modal */}
            <View style={styles.slipTopBar}>
              <View>
                <ThemedText style={styles.slipTopBarTitle}>Lembar Kerja Laba Rugi</ThemedText>
                <ThemedText style={styles.slipTopBarSubtitle}>Standar Akuntansi SAK EMKM</ThemedText>
              </View>
              <Pressable
                style={styles.slipCloseBtn}
                onPress={() => setShowSlipModal(false)}
              >
                <ThemedText style={styles.slipCloseBtnText}>✕ Tutup</ThemedText>
              </Pressable>
            </View>

            {/* Kertas Kerja / Slip Content */}
            <ScrollView
              style={{ flex: 1, backgroundColor: '#f1f5f9' }}
              contentContainerStyle={styles.slipPaperContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.slipPaper}>
                {/* Kop Laporan Toko */}
                <View style={styles.slipHeader}>
                  <ThemedText style={styles.slipStoreName}>{storeName.toUpperCase()}</ThemedText>
                  {storeAddress ? (
                    <ThemedText style={styles.slipStoreMeta}>{storeAddress}</ThemedText>
                  ) : null}
                  {storePhone ? (
                    <ThemedText style={styles.slipStoreMeta}>Telp/WA: {storePhone}</ThemedText>
                  ) : null}
                  <View style={styles.slipDoubleLine} />
                  <ThemedText style={styles.slipDocTitle}>LEMBAR KERJA LAPORAN LABA / RUGI</ThemedText>
                  <ThemedText style={styles.slipDocStandard}>
                    Standar SAK EMKM (Entitas Mikro, Kecil, dan Menengah)
                  </ThemedText>
                  <ThemedText style={styles.slipDocPeriode}>
                    Periode: {data.periodeLabel}
                  </ThemedText>
                </View>

                {/* SAK EMKM Table Structure */}
                <View style={styles.slipTable}>
                  {/* I. Pendapatan */}
                  <View style={styles.slipSectionHeader}>
                    <ThemedText style={styles.slipSectionHeaderText}>I. PENDAPATAN USAHA</ThemedText>
                  </View>
                  <View style={styles.slipRow}>
                    <ThemedText style={styles.slipRowLabel}>Penjualan Barang Dagangan (Bruto)</ThemedText>
                    <ThemedText style={styles.slipRowVal}>{fmtRp(data.penjualanBruto)}</ThemedText>
                  </View>
                  <View style={styles.slipRow}>
                    <ThemedText style={styles.slipRowLabel}>Potongan & Retur Penjualan</ThemedText>
                    <ThemedText style={styles.slipRowVal}>Rp 0</ThemedText>
                  </View>
                  <View style={[styles.slipRow, styles.slipSubtotalRow]}>
                    <ThemedText style={styles.slipSubtotalLabel}>Total Pendapatan Usaha Bersih</ThemedText>
                    <ThemedText style={styles.slipSubtotalVal}>{fmtRp(data.penjualanBruto)}</ThemedText>
                  </View>

                  {/* II. HPP */}
                  <View style={styles.slipSectionHeader}>
                    <ThemedText style={styles.slipSectionHeaderText}>II. HARGA POKOK PENJUALAN (HPP)</ThemedText>
                  </View>
                  <View style={styles.slipRow}>
                    <ThemedText style={styles.slipRowLabel}>Beban Pokok Barang Terjual (COGS)</ThemedText>
                    <ThemedText style={styles.slipRowVal}>{fmtRp(data.hpp)}</ThemedText>
                  </View>
                  <View style={[styles.slipRow, styles.slipSubtotalRow]}>
                    <ThemedText style={styles.slipSubtotalLabel}>Total Beban Pokok Penjualan (HPP)</ThemedText>
                    <ThemedText style={styles.slipSubtotalVal}>({fmtRp(data.hpp)})</ThemedText>
                  </View>

                  {/* LABA KOTOR */}
                  <View style={[styles.slipRow, styles.slipHighlightRow]}>
                    <ThemedText style={styles.slipHighlightLabel}>LABA KOTOR USAHA (GROSS PROFIT)</ThemedText>
                    <ThemedText
                      style={[
                        styles.slipHighlightVal,
                        { color: data.labaKotor >= 0 ? '#15803d' : '#b91c1c' },
                      ]}
                    >
                      {fmtRp(data.labaKotor)}
                    </ThemedText>
                  </View>

                  {/* III. Beban Operasional */}
                  <View style={styles.slipSectionHeader}>
                    <ThemedText style={styles.slipSectionHeaderText}>
                      III. BEBAN OPERASIONAL (BEBAN USAHA)
                    </ThemedText>
                  </View>
                  {data.bebanByCategory.length > 0 ? (
                    data.bebanByCategory.map((b, i) => {
                      const label = CASH_CATEGORY_MAP[b.category] || b.category.replace(/_/g, ' ');
                      const icon = CATEGORY_ICONS[b.category] || '💸';
                      return (
                        <View key={i} style={styles.slipRow}>
                          <ThemedText style={styles.slipRowLabel}>
                            {icon} Beban {label}
                          </ThemedText>
                          <ThemedText style={styles.slipRowVal}>{fmtRp(b.total)}</ThemedText>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.slipRow}>
                      <ThemedText style={[styles.slipRowLabel, { fontStyle: 'italic', color: Colors.muted }]}>
                        Belum ada beban operasional tercatat
                      </ThemedText>
                      <ThemedText style={styles.slipRowVal}>Rp 0</ThemedText>
                    </View>
                  )}
                  <View style={[styles.slipRow, styles.slipSubtotalRow]}>
                    <ThemedText style={styles.slipSubtotalLabel}>Total Beban Operasional</ThemedText>
                    <ThemedText style={[styles.slipSubtotalVal, { color: '#b91c1c' }]}>
                      ({fmtRp(data.totalBeban)})
                    </ThemedText>
                  </View>

                  {/* LABA OPERASIONAL */}
                  <View style={[styles.slipRow, styles.slipSubtotalRow, { backgroundColor: '#f8fafc' }]}>
                    <ThemedText style={styles.slipSubtotalLabel}>LABA OPERASIONAL (OPERATING PROFIT)</ThemedText>
                    <ThemedText
                      style={[
                        styles.slipSubtotalVal,
                        { color: data.labaOperasional >= 0 ? '#15803d' : '#b91c1c' },
                      ]}
                    >
                      {fmtRp(data.labaOperasional)}
                    </ThemedText>
                  </View>

                  {/* IV. Pendapatan Non-Operasional */}
                  {data.pendapatanLain > 0 && (
                    <>
                      <View style={styles.slipSectionHeader}>
                        <ThemedText style={styles.slipSectionHeaderText}>
                          IV. PENDAPATAN / BEBAN LAIN-LAIN
                        </ThemedText>
                      </View>
                      <View style={styles.slipRow}>
                        <ThemedText style={styles.slipRowLabel}>💵 Pendapatan Lain-lain (Buku Kas)</ThemedText>
                        <ThemedText style={styles.slipRowVal}>{fmtRp(data.pendapatanLain)}</ThemedText>
                      </View>
                      <View style={[styles.slipRow, styles.slipSubtotalRow]}>
                        <ThemedText style={styles.slipSubtotalLabel}>Total Pendapatan Lain-lain</ThemedText>
                        <ThemedText style={[styles.slipSubtotalVal, { color: '#15803d' }]}>
                          {fmtRp(data.pendapatanLain)}
                        </ThemedText>
                      </View>
                    </>
                  )}

                  {/* V. LABA BERSIH */}
                  <View
                    style={[
                      styles.slipGrandTotalBox,
                      {
                        backgroundColor: data.labaBersih >= 0 ? '#f0fdf4' : '#fef2f2',
                        borderColor: data.labaBersih >= 0 ? '#86efac' : '#fca5a5',
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ThemedText style={styles.slipGrandTotalLabel}>
                        {data.labaBersih >= 0 ? 'LABA BERSIH TAHUN BERJALAN' : 'RUGI BERSIH TAHUN BERJALAN'}
                      </ThemedText>
                      <ThemedText
                        style={[
                          styles.slipGrandTotalVal,
                          { color: data.labaBersih >= 0 ? '#15803d' : '#b91c1c' },
                        ]}
                      >
                        {fmtRp(data.labaBersih)}
                      </ThemedText>
                    </View>
                    {data.penjualanBruto > 0 && (
                      <ThemedText style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        Net Profit Margin: {((data.labaBersih / data.penjualanBruto) * 100).toFixed(1)}% dari Penjualan Bersih
                      </ThemedText>
                    )}
                  </View>
                </View>

                {/* Ringkasan Statistik */}
                <View style={styles.slipStatsBox}>
                  <ThemedText style={{ fontSize: 11, color: '#475569' }}>
                    📊 Rekapitulasi: Tercatat sebanyak <ThemedText type="defaultSemiBold" style={{ color: Colors.tint }}>{data.jumlahTransaksi} transaksi</ThemedText> penjualan pada periode ini.
                  </ThemedText>
                </View>

                {/* Pengesahan / Tanda Tangan */}
                <View style={styles.slipSignRow}>
                  <View style={styles.slipSignCol}>
                    <ThemedText style={styles.slipSignRole}>Disusun Oleh,</ThemedText>
                    <View style={styles.slipSignSpace} />
                    <ThemedText style={styles.slipSignName}>( Bagian Kasir / Keuangan )</ThemedText>
                  </View>
                  <View style={styles.slipSignCol}>
                    <ThemedText style={styles.slipSignRole}>Disetujui Oleh,</ThemedText>
                    <View style={styles.slipSignSpace} />
                    <ThemedText style={styles.slipSignName}>( Pemilik / Pimpinan Usaha )</ThemedText>
                  </View>
                </View>

                {/* Footer Kertas Kerja */}
                <ThemedText style={styles.slipFooterText}>
                  POS AZIZAH • Dicetak otomatis pada {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </ThemedText>
              </View>
            </ScrollView>

            {/* Modal Bottom Action Bar */}
            <View style={styles.slipModalFooter}>
              <Button
                title="📄 Export PDF"
                variant="outline"
                size="sm"
                style={{ flex: 1 }}
                onPress={handleExportPDF}
              />
              <Button
                title="🖨️ Cetak Thermal"
                variant="outline"
                size="sm"
                style={{ flex: 1 }}
                onPress={handlePrint}
              />
              <Button
                title="✕ Tutup"
                variant="secondary"
                size="sm"
                style={{ flex: 0.8 }}
                onPress={() => setShowSlipModal(false)}
              />
            </View>
          </ThemedView>
        </Modal>
      )}

      {!data && !loading && (
        <EmptyState
          icon={'\u{1F4CA}'}
          title="Pilih periode"
          subtitle="Pilih periode dan laporan akan otomatis dimuat"
        />
      )}
    </View>
  );
}

// Helper row component
function LRRow({
  label, value, bold, indent, highlight, big,
}: {
  label: string; value: number; bold?: boolean; indent?: boolean; highlight?: boolean; big?: boolean;
}) {
  const isNeg = value < 0;
  return (
    <View style={[styles.lrRow, indent && { paddingLeft: 12 }]}>
      <ThemedText style={[
        styles.lrLabel,
        bold && { fontWeight: '700' },
        big && { fontSize: 14 },
      ]}>
        {label}
      </ThemedText>
      <ThemedText style={[
        styles.lrValue,
        bold && { fontWeight: '700' },
        big && { fontSize: 14 },
        highlight && { color: isNeg ? Colors.danger : Colors.success },
      ]}>
        {fmtRp(value)}
      </ThemedText>
    </View>
  );
}

// ─────────────────────────────────────────
// Buku Kas Tab (Arus Kas Masuk & Keluar)
// ─────────────────────────────────────────
function BukuKasTab({ db, onMutate }: { db: SQLiteDatabase; onMutate?: () => void }) {
  const router = useRouter();
  const { storeName, storeAddress, storePhone, businessMode } = useSettingsStore();
  const {
    entries,
    totalCashIn,
    totalCashOut,
    salesCashTotal,
    currentBalance,
    loading,
    loadLedger,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useCashStore();

  const { totalReceivableUnpaid, totalDebtUnpaid, loadDebts, loadReceivables } = useDebtReceivableStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);
  const [entryType, setEntryType] = useState<CashTransactionType>('in');
  const [category, setCategory] = useState<string>('setoran_modal');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [exportingCashPdf, setExportingCashPdf] = useState(false);

  const handleExportCashPDF = async (type: 'in' | 'out') => {
    try {
      const hasRecords = entries.some((e) => e.type === type);
      if (!hasRecords) {
        Alert.alert(
          'Tidak Ada Data',
          `Belum ada catatan ${type === 'in' ? 'penerimaan kas' : 'pengeluaran kas'} untuk diexport.`
        );
        return;
      }
      setExportingCashPdf(true);
      const uri = await exportCashLedgerToPDF({
        db,
        type,
        storeName,
        storeAddress,
        storePhone,
      });
      await shareFile(uri, 'application/pdf');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Gagal membuat file PDF buku kas.');
    } finally {
      setExportingCashPdf(false);
    }
  };

  useEffect(() => {
    loadLedger(db);
    loadDebts(db);
    loadReceivables(db);
  }, [db, loadLedger, loadDebts, loadReceivables]);

  const openModal = (type: CashTransactionType) => {
    setEditingEntry(null);
    setEntryType(type);
    setCategory(type === 'in' ? 'setoran_modal' : 'listrik_air');
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().slice(0, 10));
    setModalVisible(true);
  };

  const openEditModal = (entry: CashEntry) => {
    setEditingEntry(entry);
    setEntryType(entry.type);
    setCategory(entry.category);
    setDescription(entry.description);
    setAmount(entry.amount.toString());
    setDate(entry.date);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const numericAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Error', 'Nominal harus lebih besar dari 0');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Deskripsi mutasi kas harus diisi');
      return;
    }
    const cleanDate = date.trim() || new Date().toISOString().slice(0, 10);

    try {
      if (editingEntry) {
        await updateEntry(
          db,
          editingEntry.id,
          entryType,
          category,
          description.trim(),
          numericAmount,
          cleanDate
        );
        setModalVisible(false);
        setEditingEntry(null);
        onMutate?.();
        Alert.alert('Sukses', 'Catatan mutasi kas berhasil diperbarui');
      } else {
        await addEntry(db, entryType, category, description.trim(), numericAmount, cleanDate);
        setModalVisible(false);
        onMutate?.();
        Alert.alert(
          'Sukses',
          `${entryType === 'in' ? 'Penerimaan Kas' : 'Pengeluaran Kas/Beban'} berhasil dicatat`
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal menyimpan transaksi kas');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Catatan', 'Apakah Anda yakin ingin menghapus catatan mutasi kas ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, id);
          onMutate?.();
        },
      },
    ]);
  };

  const categoriesToPick: readonly { id: string; label: string }[] =
    entryType === 'in' ? CASH_IN_CATEGORIES : getCashOutCategories(businessMode);

  return (
    <View style={{ flex: 1 }}>
      {/* Top Header Section: Split Row Minimalis untuk Landscape */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
        {/* Panel Kiri: Saldo Kas Fisik & Arus Kas */}
        <Card
          padding={12}
          style={{
            flex: 1.2,
            backgroundColor: '#ffffff',
            borderColor: Colors.tint + '35',
            borderWidth: 1.5,
            justifyContent: 'space-between',
          }}
        >
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <ThemedText style={{ fontSize: 11, color: '#64748b', fontWeight: '800', letterSpacing: 0.5 }}>
                SALDO KAS FISIK TERSEDIA
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                <ThemedText style={{ fontSize: 9 }}>🟢</ThemedText>
                <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#16a34a' }}>Kas Aktif</ThemedText>
              </View>
            </View>
            <ThemedText
              style={{
                fontSize: 22,
                lineHeight: 28,
                fontWeight: '900',
                color: currentBalance >= 0 ? Colors.tintDark : Colors.danger,
                marginTop: 4,
              }}
            >
              {fmtRp(currentBalance)}
            </ThemedText>
          </View>

          {/* Sub-metrik Kas Masuk & Keluar */}
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderColor: '#f1f5f9',
            }}
          >
            <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: '#dcfce7' }}>
              <ThemedText style={{ fontSize: 10, color: '#16a34a', fontWeight: '700' }}>📥 Kas Masuk (+)</ThemedText>
              <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#15803d', marginTop: 1 }}>
                {fmtRp(salesCashTotal + totalCashIn)}
              </ThemedText>
              <ThemedText style={{ fontSize: 9, color: '#64748b' }}>
                Penjualan: {fmtRp(salesCashTotal)}
              </ThemedText>
            </View>

            <View style={{ flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, padding: 6, borderWidth: 1, borderColor: '#fee2e2' }}>
              <ThemedText style={{ fontSize: 10, color: '#dc2626', fontWeight: '700' }}>📤 Kas Keluar (-)</ThemedText>
              <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#b91c1c', marginTop: 1 }}>
                {fmtRp(totalCashOut)}
              </ThemedText>
              <ThemedText style={{ fontSize: 9, color: '#64748b' }}>
                Beban & Kulakan
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Panel Kanan: Tombol Aksi Mutasi & Cetak PDF */}
        <Card
          padding={12}
          style={{
            flex: 1,
            backgroundColor: '#ffffff',
            borderColor: '#e2e8f0',
            borderWidth: 1.5,
            justifyContent: 'space-between',
          }}
        >
          <ThemedText style={{ fontSize: 11, color: '#64748b', fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 }}>
            AKSI BUKU KAS & EKSPOR
          </ThemedText>

          {/* Tombol Input Mutasi Kas */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
            <Pressable
              style={[styles.cashCompactActionBtn, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}
              onPress={() => openModal('in')}
            >
              <ThemedText style={{ fontSize: 14 }}>💰</ThemedText>
              <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#15803d' }}>
                + Kas Masuk
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.cashCompactActionBtn, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
              onPress={() => openModal('out')}
            >
              <ThemedText style={{ fontSize: 14 }}>💸</ThemedText>
              <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#b91c1c' }}>
                - Kas Keluar
              </ThemedText>
            </Pressable>
          </View>

          {/* Tombol PDF */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              style={[styles.cashCompactExportBtn, { borderColor: '#86efac' }]}
              disabled={exportingCashPdf}
              onPress={() => handleExportCashPDF('in')}
            >
              <ThemedText style={{ fontSize: 11 }}>📄</ThemedText>
              <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#16a34a' }}>
                {exportingCashPdf ? 'Ekspor...' : 'PDF Masuk'}
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.cashCompactExportBtn, { borderColor: '#fca5a5' }]}
              disabled={exportingCashPdf}
              onPress={() => handleExportCashPDF('out')}
            >
              <ThemedText style={{ fontSize: 11 }}>📄</ThemedText>
              <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#dc2626' }}>
                {exportingCashPdf ? 'Ekspor...' : 'PDF Keluar'}
              </ThemedText>
            </Pressable>
          </View>
        </Card>
      </View>

      {/* Banner Minimalis Buku Hutang & Piutang */}
      <Pressable
        style={styles.debtBannerCompact}
        onPress={() => router.push('/debt-receivable' as any)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
            <ThemedText style={{ fontSize: 14 }}>💳</ThemedText>
          </View>
          <View>
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1e1b4b' }}>
              Buku Hutang & Piutang Usaha
            </ThemedText>
            <ThemedText style={{ fontSize: 10, color: '#64748b' }}>
              Kasbon pelanggan, hutang supplier & pelunasan kas
            </ThemedText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {totalReceivableUnpaid > 0 && (
            <View style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#92400e' }}>
                Piutang: {fmtRp(totalReceivableUnpaid)}
              </ThemedText>
            </View>
          )}
          {totalDebtUnpaid > 0 && (
            <View style={{ backgroundColor: '#fee2e2', borderColor: '#fecaca', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
              <ThemedText style={{ fontSize: 10, fontWeight: '700', color: '#991b1b' }}>
                Hutang: {fmtRp(totalDebtUnpaid)}
              </ThemedText>
            </View>
          )}
          <View style={{ backgroundColor: Colors.tint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#ffffff' }}>
              Buka ›
            </ThemedText>
          </View>
        </View>
      </Pressable>

      <ThemedText
        type="defaultSemiBold"
        style={{ fontSize: 14, marginBottom: 8, color: '#334155' }}
      >
        Riwayat Mutasi Buku Kas
      </ThemedText>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 6, paddingBottom: 32 }}
          renderItem={({ item }) => {
            const isCashIn = item.type === 'in';
            const categoryLabel = CASH_CATEGORY_MAP[item.category] || item.category.replace(/_/g, ' ');
            return (
              <Card padding={10} style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isCashIn ? '#dcfce7' : '#fee2e2',
                    }}
                  >
                    <ThemedText style={{ fontSize: 16 }}>{isCashIn ? '📥' : '📤'}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 13, color: '#1e293b' }}>
                      {item.description}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                      {categoryLabel} • {item.date}
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: isCashIn ? Colors.success : Colors.danger,
                    }}
                  >
                    {isCashIn ? '+' : '-'} {fmtRp(item.amount)}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pressable onPress={() => openEditModal(item)} style={styles.actionIconBtn}>
                      <ThemedText style={{ fontSize: 14 }}>✏️</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => handleDelete(item.id)} style={styles.actionIconBtn}>
                      <ThemedText style={{ fontSize: 14 }}>🗑️</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="📒"
              title="Buku Kas Masih Kosong"
              subtitle="Catat penerimaan kas atau pengeluaran beban untuk mengelola arus kas"
            />
          }
        />
      )}

      {/* Modal Input & Edit Kas */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <ThemedView style={styles.monthPickerOverlay}>
          <Card style={styles.bsModalCard} padding={20}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 15, marginBottom: 12 }}>
              {editingEntry
                ? (entryType === 'in' ? 'Edit Penerimaan Kas' : 'Edit Pengeluaran Kas / Beban')
                : (entryType === 'in' ? 'Catat Penerimaan Kas (Masuk)' : 'Catat Pengeluaran Kas/Beban (Keluar)')}
            </ThemedText>

            <View style={{ marginBottom: 10 }}>
              <ThemedText style={styles.formLabel}>Kategori</ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {categoriesToPick.map((c: { id: string; label: string }) => (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.categoryChipBtn,
                      category === c.id && styles.categoryChipBtnActive,
                    ]}
                    onPress={() => setCategory(c.id)}
                  >
                    <ThemedText
                      style={[
                        styles.categoryChipBtnText,
                        category === c.id && styles.categoryChipBtnTextActive,
                      ]}
                    >
                      {c.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ marginBottom: 10 }}>
              <ThemedText style={styles.formLabel}>Keterangan / Uraian</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder={
                  entryType === 'in'
                    ? 'Contoh: Setoran Modal Awal Kasir'
                    : 'Contoh: Bayar Token Listrik / Gaji Karyawan'
                }
                placeholderTextColor={Colors.disabled}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View style={{ marginBottom: 10 }}>
              <ThemedText style={styles.formLabel}>Tanggal Transaksi</ThemedText>
              <Pressable
                style={[
                  styles.formInput,
                  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <ThemedText style={{ fontSize: 13, color: '#1e293b' }}>
                  📅 {date || new Date().toISOString().slice(0, 10)}
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: Colors.tint, fontWeight: '700' }}>
                  Pilih Kalender ›
                </ThemedText>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={date ? new Date(date) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      const yyyy = selectedDate.getFullYear();
                      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const dd = String(selectedDate.getDate()).padStart(2, '0');
                      setDate(`${yyyy}-${mm}-${dd}`);
                    }
                  }}
                />
              )}
            </View>

            <View style={{ marginBottom: 16 }}>
              <ThemedText style={styles.formLabel}>Nominal (Rp)</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="Contoh: 150000"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Batal"
                variant="secondary"
                size="sm"
                style={{ flex: 1 }}
                onPress={() => {
                  setModalVisible(false);
                  setEditingEntry(null);
                }}
              />
              <Button
                title={editingEntry ? 'Simpan Perubahan' : 'Simpan Kas'}
                size="sm"
                style={{ flex: 1 }}
                onPress={handleSave}
              />
            </View>
          </Card>
        </ThemedView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  tabBtnActive: { backgroundColor: Colors.tint, borderColor: Colors.tint },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  tabBtnTextActive: { color: '#fff' },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  filterModeRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  filterModeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterModeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  filterModeBtnTextActive: {
    color: Colors.tintDark,
    fontWeight: '800',
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tint,
  },
  filterSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  monthSelectBtn: {
    flex: 1,
    padding: 9,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  selectorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  selectorValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  yearSelectContainer: {
    flex: 1.2,
    padding: 9,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  yearHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  yearOtherLink: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.tint,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  yearChipActive: { backgroundColor: Colors.tint, borderColor: Colors.tint },
  yearChipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  yearChipTextActive: { color: '#fff' },
  yearChipOther: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.tint,
    backgroundColor: '#f5f3ff',
    borderStyle: 'dashed',
  },
  yearChipOtherText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.tint,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthPickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  monthPickerCard: { width: '80%', maxWidth: 340 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthChip: {
    width: '22%',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.card,
  },
  monthChipActive: { backgroundColor: Colors.tint, borderColor: Colors.tint },
  monthChipText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  monthChipTextActive: { color: '#fff' },
  reportTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  reportSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  reportPeriode: {
    fontSize: 12,
    color: Colors.placeholder,
    textAlign: 'center',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.placeholder,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionSubTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    marginBottom: 4,
    textDecorationLine: 'underline',
  },
  lrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  lrLabel: { flex: 1, fontSize: 12, color: Colors.text },
  lrValue: { fontSize: 12, color: Colors.text, textAlign: 'right' },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
  },
  labakotorCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: Colors.tint + '44',
  },
  labaCard: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  addItemBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.tint,
  },
  bsItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  bsIconBtn: { padding: 4 },
  sectionTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sectionTotalLabel: { fontSize: 12, fontWeight: '700', color: Colors.placeholder },
  sectionTotalValue: { fontSize: 13, fontWeight: '700', color: Colors.tint },
  bsModalCard: { width: '90%', maxWidth: 400 },
  sectionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  sectionChipActive: { backgroundColor: Colors.tint, borderColor: Colors.tint },
  sectionChipText: { fontSize: 11, fontWeight: '600', color: Colors.text },
  sectionChipTextActive: { color: '#fff' },
  formLabel: { fontSize: 11, fontWeight: '600', color: Colors.placeholder, marginBottom: 4 },
  formInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    backgroundColor: '#fafafa',
  },
  expenseItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expenseCatIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  categoryChipBtnActive: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },
  categoryChipBtnText: { fontSize: 11, fontWeight: '500', color: Colors.text },
  categoryChipBtnTextActive: { color: '#fff', fontWeight: '700' },
  cashActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  // Executive Summary Styles
  execSummaryCard: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  execHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  execTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  execSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  execBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  execBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  execStandardText: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 4,
  },
  execDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  execRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  execLabel: {
    fontSize: 12,
    color: '#334155',
  },
  execValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  execValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  execNetBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 12,
  },
  execNetLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  execNetValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  openSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  openSlipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    flex: 1,
    textAlign: 'center',
  },

  // Modal Slip Styles
  slipModalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  slipTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  slipTopBarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  slipTopBarSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  slipCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  slipCloseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  slipPaperContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  slipPaper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  slipHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  slipStoreName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  slipStoreMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  slipDoubleLine: {
    height: 3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#0f172a',
    width: '100%',
    marginVertical: 10,
  },
  slipDocTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  slipDocStandard: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  slipDocPeriode: {
    fontSize: 11,
    color: '#334155',
    marginTop: 4,
    textAlign: 'center',
  },
  slipTable: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
  },
  slipSectionHeader: {
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginTop: 8,
  },
  slipSectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  slipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  slipRowLabel: {
    fontSize: 11,
    color: '#334155',
    flex: 1,
  },
  slipRowVal: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'right',
  },
  slipSubtotalRow: {
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  slipSubtotalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  slipSubtotalVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
  },
  slipHighlightRow: {
    backgroundColor: '#eff6ff',
    borderTopWidth: 1.5,
    borderTopColor: '#93c5fd',
    borderBottomWidth: 1.5,
    borderBottomColor: '#93c5fd',
    marginVertical: 4,
  },
  slipHighlightLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e3a8a',
    flex: 1,
  },
  slipHighlightVal: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  slipGrandTotalBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    marginTop: 12,
    marginBottom: 8,
  },
  slipGrandTotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  slipGrandTotalVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  slipStatsBox: {
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    marginVertical: 12,
  },
  slipSignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  slipSignCol: {
    flex: 1,
    alignItems: 'center',
  },
  slipSignRole: {
    fontSize: 11,
    color: '#64748b',
  },
  slipSignSpace: {
    height: 50,
  },
  slipSignName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  slipFooterText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
  },
  slipModalFooter: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  cashExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  debtBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    marginBottom: 14,
  },
  cashCompactActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  cashCompactExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  debtBannerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    marginBottom: 8,
  },
});
