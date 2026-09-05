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
  type CashTransactionType,
  type CashEntry,
} from '@/stores/cashStore';
import { exportLabaRugiToPDF, shareFile } from '@/services/export';
import { printLaporanLabaRugi } from '@/services/print';
import { usePrinterStore } from '@/stores/printerStore';
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
        cashLedgerWhere = `WHERE type = 'out' AND category NOT IN ('kulakan_stok') AND strftime('%m', date) = '${mm}' AND strftime('%Y', date) = '${yy}'`;
        otherIncomeWhere = `WHERE type = 'in' AND category = 'pendapatan_lain' AND strftime('%m', date) = '${mm}' AND strftime('%Y', date) = '${yy}'`;
      } else {
        salesQuery = `WHERE strftime('%Y', t.created_at) = '${selectedYear}'`;
        hppQuery = `WHERE strftime('%Y', t.created_at) = '${selectedYear}'`;
        cashLedgerWhere = `WHERE type = 'out' AND category NOT IN ('kulakan_stok') AND strftime('%Y', date) = '${selectedYear}'`;
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
      {/* Filter Controls */}
      <View style={styles.filterCard}>
        <View style={styles.filterModeRow}>
          {(['month', 'year'] as FilterMode[]).map((m) => (
            <Pressable
              key={m}
              style={[styles.filterModeBtn, filterMode === m && styles.filterModeBtnActive]}
              onPress={() => setFilterMode(m)}
            >
              <ThemedText style={[styles.filterModeBtnText, filterMode === m && styles.filterModeBtnTextActive]}>
                {m === 'month' ? 'Per Bulan' : 'Per Tahun'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.filterRow}>
          {filterMode === 'month' && (
            <Pressable style={styles.filterSelect} onPress={() => setShowMonthPicker(true)}>
              <ThemedText style={styles.filterSelectLabel}>Bulan</ThemedText>
              <ThemedText style={styles.filterSelectValue}>{MONTH_NAMES[selectedMonth - 1]}</ThemedText>
            </Pressable>
          )}
          <View style={styles.filterSelect}>
            <ThemedText style={styles.filterSelectLabel}>Tahun (Pilih atau Tambah Tahun Lain)</ThemedText>
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
              <Pressable
                style={styles.yearChipOther}
                onPress={() => {
                  setCustomYearInput('');
                  setShowYearModal(true);
                }}
              >
                <ThemedText style={styles.yearChipOtherText}>📅 Tahun Lain...</ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </View>

        <Button title="🔄 Muat Ulang Laporan" size="sm" onPress={loadData} style={{ marginTop: 8 }} />
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
          {/* Header Laporan */}
          <Card style={{ marginBottom: 12 }} padding={14}>
            <ThemedText style={styles.reportTitle}>LAPORAN LABA / RUGI</ThemedText>
            <ThemedText style={styles.reportSubtitle}>{storeName}</ThemedText>
            <ThemedText style={styles.reportPeriode}>Periode: {data.periodeLabel}</ThemedText>
            <ThemedText style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
              SAK EMKM — {data.jumlahTransaksi} transaksi penjualan
            </ThemedText>
          </Card>

          {/* Pendapatan */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.sectionTitle}>PENDAPATAN USAHA</ThemedText>
            <LRRow label="Penjualan Bersih" value={data.penjualanBruto} bold />
            <View style={styles.divider} />
            <LRRow label="Total Pendapatan Usaha" value={data.penjualanBruto} bold highlight />
          </Card>

          {/* HPP */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.sectionTitle}>HARGA POKOK PENJUALAN (HPP)</ThemedText>
            <LRRow label="Harga Pokok Barang Terjual" value={data.hpp} />
            <View style={styles.divider} />
            <LRRow label="Total HPP" value={data.hpp} bold />
          </Card>

          {/* Laba Kotor */}
          <Card style={[styles.labakotorCard, { marginBottom: 8 }]} padding={14}>
            <LRRow
              label="LABA KOTOR"
              value={data.labaKotor}
              bold
              highlight
              big
            />
          </Card>

          {/* Beban Operasional */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.sectionTitle}>BEBAN OPERASIONAL (BEBAN USAHA)</ThemedText>
            {data.bebanByCategory.length > 0 ? (
              data.bebanByCategory.map((b, i) => {
                const label = CASH_CATEGORY_MAP[b.category] || b.category.replace(/_/g, ' ');
                const icon = CATEGORY_ICONS[b.category] || '💸';
                return (
                  <LRRow
                    key={i}
                    label={`${icon} ${label}`}
                    value={b.total}
                    indent
                  />
                );
              })
            ) : (
              <ThemedText style={{ fontSize: 12, color: Colors.muted, marginTop: 4 }}>
                Belum ada beban operasional di periode ini.
              </ThemedText>
            )}
            <View style={styles.divider} />
            <LRRow label="Total Beban Operasional" value={data.totalBeban} bold />
          </Card>

          {/* Laba Operasional */}
          <Card style={[styles.labakotorCard, { marginBottom: 8, backgroundColor: '#f8fafc' }]} padding={14}>
            <LRRow
              label="LABA OPERASIONAL"
              value={data.labaOperasional}
              bold
              highlight
            />
          </Card>

          {/* Pendapatan Non-Operasional (jika ada) */}
          {data.pendapatanLain > 0 && (
            <Card style={{ marginBottom: 8 }} padding={14}>
              <ThemedText style={styles.sectionTitle}>PENDAPATAN NON-OPERASIONAL</ThemedText>
              <LRRow label="💵 Pendapatan Lain-lain" value={data.pendapatanLain} />
              <View style={styles.divider} />
              <LRRow label="Total Pendapatan Lain-lain" value={data.pendapatanLain} bold />
            </Card>
          )}

          {/* Laba Bersih */}
          <Card
            style={[
              styles.labaCard,
              { marginBottom: 16, backgroundColor: data.labaBersih >= 0 ? Colors.successBg : '#fce4ec' },
            ]}
            padding={14}
          >
            <LRRow
              label={data.labaBersih >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}
              value={data.labaBersih}
              bold
              big
              highlight
            />
          </Card>

          {/* Action buttons */}
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

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashEntry | null>(null);
  const [entryType, setEntryType] = useState<CashTransactionType>('in');
  const [category, setCategory] = useState<string>('setoran_modal');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadLedger(db);
  }, [db, loadLedger]);

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
    entryType === 'in' ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES;

  return (
    <View style={{ flex: 1 }}>
      {/* Kartu Ringkasan Saldo Kas Fisik */}
      <Card
        padding={16}
        style={{
          marginBottom: 12,
          backgroundColor: '#ffffff',
          borderColor: Colors.tint + '40',
          borderWidth: 1.5,
        }}
      >
        <ThemedText style={{ fontSize: 12, color: '#64748b', fontWeight: '700', letterSpacing: 0.3 }}>
          SALDO KAS FISIK TERSEDIA
        </ThemedText>
        <ThemedText
          style={{
            fontSize: 26,
            lineHeight: 34,
            fontWeight: '800',
            color: currentBalance >= 0 ? Colors.tintDark : Colors.danger,
            marginTop: 8,
            marginBottom: 2,
          }}
        >
          {fmtRp(currentBalance)}
        </ThemedText>
        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderColor: '#f1f5f9',
          }}
        >
          <View style={{ flex: 1 }}>
            <ThemedText style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Total Kas Masuk (+):</ThemedText>
            <ThemedText
              style={{ fontSize: 14, fontWeight: '700', color: Colors.success, marginTop: 2 }}
            >
              {fmtRp(salesCashTotal + totalCashIn)}
            </ThemedText>
            <ThemedText style={{ fontSize: 10, color: Colors.muted, marginTop: 2 }}>
              (Penjualan: {fmtRp(salesCashTotal)})
            </ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Total Kas Keluar (-):</ThemedText>
            <ThemedText
              style={{ fontSize: 14, fontWeight: '700', color: Colors.danger, marginTop: 2 }}
            >
              {fmtRp(totalCashOut)}
            </ThemedText>
            <ThemedText style={{ fontSize: 10, color: Colors.muted, marginTop: 2 }}>
              (Beban & Kulakan)
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* Tombol Aksi Mutasi Kas */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <Pressable
          style={[styles.cashActionBtn, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}
          onPress={() => openModal('in')}
        >
          <ThemedText style={{ fontSize: 16 }}>💰</ThemedText>
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#15803d' }}>
            + Penerimaan Kas
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.cashActionBtn, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
          onPress={() => openModal('out')}
        >
          <ThemedText style={{ fontSize: 16 }}>💸</ThemedText>
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#b91c1c' }}>
            - Pengeluaran Beban
          </ThemedText>
        </Pressable>
      </View>

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
              <ThemedText style={styles.formLabel}>Tanggal (YYYY-MM-DD)</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="YYYY-MM-DD (Contoh: 2026-09-06)"
                placeholderTextColor={Colors.disabled}
                value={date}
                onChangeText={setDate}
              />
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
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterModeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterModeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  filterModeBtnActive: { backgroundColor: Colors.tint, borderColor: Colors.tint },
  filterModeBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  filterModeBtnTextActive: { color: '#fff' },
  filterRow: { gap: 8 },
  filterSelect: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#fafafa',
  },
  filterSelectLabel: { fontSize: 10, color: Colors.muted, marginBottom: 4 },
  filterSelectValue: { fontSize: 13, fontWeight: '600' },
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
});
