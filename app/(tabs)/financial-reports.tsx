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
import {
  useExpenseStore,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type Expense,
} from '@/stores/expenseStore';
import {
  useBalanceSheetStore,
  BALANCE_SHEET_SECTIONS,
  type BalanceSheetSection,
  type BalanceSheetItem,
} from '@/stores/balanceSheetStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  useCashStore,
  CASH_IN_CATEGORIES,
  CASH_OUT_CATEGORIES,
  type CashTransactionType,
} from '@/stores/cashStore';
import { exportFinancialReport, shareFile } from '@/services/export';
import { printLaporanLabaRugi, printLaporanNeraca } from '@/services/print';
import { usePrinterStore } from '@/stores/printerStore';
import { useRouter } from 'expo-router';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
type ActiveTab = 'labarugi' | 'bukukas' | 'neraca' | 'beban';
type FilterMode = 'month' | 'year';

interface LabaRugiData {
  periodeLabel: string;
  penjualanBruto: number;
  hpp: number;
  labaKotor: number;
  totalBeban: number;
  labaOperasional: number;
  bebanByCategory: { category: string; total: number }[];
  jumlahTransaksi: number;
}

interface NeracaData {
  asetLancar: {
    kas: number;
    persediaan: number;
  };
  totalAsetTetap: number;
  totalKewajiban: number;
  totalModal: number;
  labaYangDitahan: number;
  totalAset: number;
  totalKewajibanEkuitas: number;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

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
  const { storeName, businessType, businessMode } = useSettingsStore();
  const { printerTarget } = usePrinterStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('labarugi');

  const tabs: { key: ActiveTab; label: string; icon: string }[] = [
    { key: 'labarugi', label: 'Laba/Rugi', icon: '📊' },
    { key: 'bukukas', label: 'Buku Kas', icon: '📒' },
    { key: 'neraca', label: 'Neraca', icon: '📋' },
    { key: 'beban', label: 'Beban', icon: '💸' },
  ];

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
            onPress={() => setActiveTab(t.key)}
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
          printerTarget={printerTarget}
          router={router}
        />
      )}
      {activeTab === 'bukukas' && <BukuKasTab db={db} />}
      {activeTab === 'neraca' && (
        <NeracaTab
          db={db}
          storeName={storeName}
          businessType={businessType}
          printerTarget={printerTarget}
          router={router}
        />
      )}
      {activeTab === 'beban' && <BebanTab db={db} />}
    </ThemedView>
  );
}

// ─────────────────────────────────────────
// Laba/Rugi Tab
// ─────────────────────────────────────────
function LabaRugiTab({
  db, storeName, businessType, printerTarget, router,
}: {
  db: SQLiteDatabase; storeName: string; businessType: string; printerTarget: string | null; router: any;
}) {
  const now = new Date();
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [data, setData] = useState<LabaRugiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let salesQuery = '';
      let hppQuery = '';
      const params: any[] = [];

      if (filterMode === 'month') {
        const mm = String(selectedMonth).padStart(2, '0');
        const yy = String(selectedYear);
        salesQuery = `WHERE strftime('%m', t.created_at) = '${mm}' AND strftime('%Y', t.created_at) = '${yy}'`;
        hppQuery = `WHERE strftime('%m', t.created_at) = '${mm}' AND strftime('%Y', t.created_at) = '${yy}'`;
      } else {
        salesQuery = `WHERE strftime('%Y', t.created_at) = '${selectedYear}'`;
        hppQuery = `WHERE strftime('%Y', t.created_at) = '${selectedYear}'`;
      }

      // Penjualan bruto
      const salesResult = await db.getFirstAsync<{ total: number; count: number }>(
        `SELECT COALESCE(SUM(t.total), 0) as total, COUNT(*) as count
         FROM transactions t ${salesQuery}`
      );

      // HPP = SUM(qty * cost_price) dari transaction_items
      const hppResult = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(ti.quantity * ti.cost_price), 0) as total
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         ${hppQuery}`
      );

      // Total beban
      let expenseWhere = '';
      if (filterMode === 'month') {
        expenseWhere = `WHERE strftime('%m', expense_date) = '${String(selectedMonth).padStart(2, '0')}' AND strftime('%Y', expense_date) = '${selectedYear}'`;
      } else {
        expenseWhere = `WHERE strftime('%Y', expense_date) = '${selectedYear}'`;
      }

      const expenseResult = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${expenseWhere}`
      );

      const bebanByCategory = await db.getAllAsync<{ category: string; total: number }>(
        `SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses
         ${expenseWhere} GROUP BY category ORDER BY total DESC`
      );

      const penjualanBruto = salesResult?.total ?? 0;
      const hpp = hppResult?.total ?? 0;
      const labaKotor = penjualanBruto - hpp;
      const totalBeban = expenseResult?.total ?? 0;
      const labaOperasional = labaKotor - totalBeban;

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
        bebanByCategory,
        jumlahTransaksi: salesResult?.count ?? 0,
      });
    } catch (e) {
      Alert.alert('Error', 'Gagal memuat data laporan.');
    }
    setLoading(false);
  }, [db, filterMode, selectedMonth, selectedYear]);

  const handleExport = async () => {
    try {
      if (!data) return;
      const uri = await exportFinancialReport(db, {
        type: 'labarugi',
        storeName,
        businessType,
        filterMode,
        month: selectedMonth,
        year: selectedYear,
        data,
      });
      await shareFile(uri, 'text/csv');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Export gagal');
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

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

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
            <ThemedText style={styles.filterSelectLabel}>Tahun</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {years.map((y) => (
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

        <Button title="Tampilkan Laporan" size="sm" onPress={loadData} style={{ marginTop: 8 }} />
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

      {loading && <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 32 }} />}

      {data && !loading && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Header Laporan */}
          <Card style={{ marginBottom: 12 }} padding={14}>
            <ThemedText style={styles.reportTitle}>LAPORAN LABA / RUGI</ThemedText>
            <ThemedText style={styles.reportSubtitle}>{storeName}</ThemedText>
            <ThemedText style={styles.reportPeriode}>Periode: {data.periodeLabel}</ThemedText>
            <ThemedText style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
              SAK EMKM — {data.jumlahTransaksi} transaksi
            </ThemedText>
          </Card>

          {/* Pendapatan */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.sectionTitle}>A. PENDAPATAN</ThemedText>
            <LRRow label="Penjualan Bersih" value={data.penjualanBruto} bold />
            <View style={styles.divider} />
            <LRRow label="Total Pendapatan" value={data.penjualanBruto} bold highlight />
          </Card>

          {/* HPP */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.sectionTitle}>B. HARGA POKOK PENJUALAN (HPP)</ThemedText>
            <LRRow label="Harga Pokok Barang Terjual" value={data.hpp} />
            <View style={styles.divider} />
            <LRRow label="Total HPP" value={data.hpp} bold />
          </Card>

          {/* Laba Kotor */}
          <Card style={[styles.labakotorCard, { marginBottom: 8 }]} padding={14}>
            <LRRow
              label="LABA KOTOR  (A - B)"
              value={data.labaKotor}
              bold
              highlight
              big
            />
            {data.hpp === 0 && (
              <ThemedText style={{ fontSize: 11, color: Colors.warning, marginTop: 4 }}>
                * HPP = 0. Tambahkan Harga Pokok (HPP) pada setiap produk agar akurat.
              </ThemedText>
            )}
          </Card>

          {/* Beban Operasional */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.sectionTitle}>C. BEBAN OPERASIONAL</ThemedText>
            {data.bebanByCategory.length > 0 ? (
              data.bebanByCategory.map((b, i) => {
                const cat = EXPENSE_CATEGORIES.find((c) => c.key === b.category);
                return (
                  <LRRow
                    key={i}
                    label={`${cat?.icon ?? ''} ${cat?.label ?? b.category}`}
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

          {/* Laba Bersih */}
          <Card
            style={[
              styles.labaCard,
              { marginBottom: 16, backgroundColor: data.labaOperasional >= 0 ? Colors.successBg : '#fce4ec' },
            ]}
            padding={14}
          >
            <LRRow
              label="LABA BERSIH  (Laba Kotor - Total Beban)"
              value={data.labaOperasional}
              bold
              big
              highlight
            />
            {data.labaOperasional < 0 && (
              <ThemedText style={{ fontSize: 11, color: Colors.danger, marginTop: 4 }}>
                * Periode ini mengalami RUGI sebesar {fmtRp(Math.abs(data.labaOperasional))}
              </ThemedText>
            )}
          </Card>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Button
              title="\u{1F4E4} Export CSV"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={handleExport}
            />
            <Button
              title="\u{1F5A8} Cetak"
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
          subtitle="Pilih periode dan klik 'Tampilkan Laporan'"
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
// Neraca Tab
// ─────────────────────────────────────────
function NeracaTab({
  db, storeName, businessType, printerTarget, router,
}: {
  db: SQLiteDatabase; storeName: string; businessType: string; printerTarget: string | null; router: any;
}) {
  const { items, loading, loadItems, upsertItem, deleteItem, getItemsBySection, getSectionTotal } =
    useBalanceSheetStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<BalanceSheetItem | null>(null);
  const [formSection, setFormSection] = useState<BalanceSheetSection>('aset_tetap');
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [neracaData, setNeracaData] = useState<NeracaData | null>(null);
  const [showNeraca, setShowNeraca] = useState(false);

  useEffect(() => {
    loadItems(db);
  }, [db, loadItems]);

  const computeNeraca = useCallback(async () => {
    // Kas = total penjualan semua waktu - total HPP - total beban
    const salesResult = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(total), 0) as total FROM transactions'
    );
    const hppResult = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(ti.quantity * ti.cost_price), 0) as total FROM transaction_items ti'
    );
    const expenseResult = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses'
    );
    // Persediaan = stok saat ini × cost_price
    const inventoryResult = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(stock * cost_price), 0) as total FROM products WHERE has_stock = 1'
    );

    const labaYangDitahan = (salesResult?.total ?? 0) - (hppResult?.total ?? 0) - (expenseResult?.total ?? 0);
    const kas = Math.max(0, labaYangDitahan); // estimasi kas minimum
    const persediaan = inventoryResult?.total ?? 0;

    const totalAsetTetap = getSectionTotal('aset_tetap');
    const totalKewajiban = getSectionTotal('kewajiban');
    const totalModal = getSectionTotal('modal');

    const totalAsetLancar = kas + persediaan;
    const totalAset = totalAsetLancar + totalAsetTetap;
    const totalKewajibanEkuitas = totalKewajiban + totalModal + labaYangDitahan;

    setNeracaData({
      asetLancar: { kas, persediaan },
      totalAsetTetap,
      totalKewajiban,
      totalModal,
      labaYangDitahan,
      totalAset,
      totalKewajibanEkuitas,
    });
    setShowNeraca(true);
  }, [db, getSectionTotal]);

  const openAdd = (section: BalanceSheetSection) => {
    setEditingItem(null);
    setFormSection(section);
    setFormName('');
    setFormAmount('');
    setModalVisible(true);
  };

  const openEdit = (item: BalanceSheetItem) => {
    setEditingItem(item);
    setFormSection(item.section);
    setFormName(item.name);
    setFormAmount(item.amount.toString());
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formAmount) {
      Alert.alert('Error', 'Nama dan nominal harus diisi');
      return;
    }
    await upsertItem(db, {
      id: editingItem?.id,
      section: formSection,
      name: formName.trim(),
      amount: parseFloat(formAmount),
    });
    setModalVisible(false);
    setShowNeraca(false);
  };

  const handleDelete = (item: BalanceSheetItem) => {
    Alert.alert('Hapus Item', `Hapus "${item.name}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: async () => {
          await deleteItem(db, item.id);
          setShowNeraca(false);
        },
      },
    ]);
  };

  const handlePrint = async () => {
    if (!printerTarget) {
      Alert.alert('Printer belum terhubung', 'Hubungkan printer di tab Pengaturan terlebih dahulu.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Buka Printer', onPress: () => router.push('/(tabs)/printer') },
      ]);
      return;
    }
    if (!neracaData) return;
    try {
      await printLaporanNeraca({
        storeName, businessType,
        items,
        neracaData,
      });
      Alert.alert('Sukses', 'Neraca berhasil dicetak');
    } catch {
      Alert.alert('Gagal', 'Cetak gagal. Periksa koneksi printer.');
    }
  };

  const handleExport = async () => {
    if (!neracaData) return;
    try {
      const uri = await exportFinancialReport(db, {
        type: 'neraca',
        storeName,
        businessType,
        neracaData,
        items,
      });
      await shareFile(uri, 'text/csv');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Export gagal');
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 32 }} />;
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      <ThemedText style={{ fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
        Input data aset tetap, kewajiban, dan modal untuk membuat neraca.
      </ThemedText>

      {BALANCE_SHEET_SECTIONS.map((section) => {
        const sectionItems = getItemsBySection(section.key);
        const sectionTotal = getSectionTotal(section.key);
        return (
          <Card key={section.key} style={{ marginBottom: 10 }} padding={14}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ThemedText style={{ fontSize: 18, lineHeight: 22 }}>{section.icon}</ThemedText>
                <View>
                  <ThemedText type="defaultSemiBold">{section.label}</ThemedText>
                  <ThemedText style={{ fontSize: 11, color: Colors.muted }}>{section.description}</ThemedText>
                </View>
              </View>
              <Pressable
                style={styles.addItemBtn}
                onPress={() => openAdd(section.key)}
              >
                <ThemedText style={{ color: Colors.tint, fontSize: 13, fontWeight: '600' }}>+ Tambah</ThemedText>
              </Pressable>
            </View>

            {sectionItems.map((item) => (
              <View key={item.id} style={styles.bsItemRow}>
                <ThemedText style={{ flex: 1, fontSize: 13 }}>{item.name}</ThemedText>
                <ThemedText style={{ fontSize: 13, color: Colors.tint }}>{fmtRp(item.amount)}</ThemedText>
                <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
                  <Pressable onPress={() => openEdit(item)} style={styles.bsIconBtn}>
                    <ThemedText style={{ color: Colors.tint, fontSize: 14 }}>{'\u270F'}</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} style={styles.bsIconBtn}>
                    <ThemedText style={{ color: Colors.danger, fontSize: 14 }}>{'\u{1F5D1}'}</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))}

            {sectionItems.length === 0 && (
              <ThemedText style={{ fontSize: 12, color: Colors.muted, marginTop: 4 }}>
                Belum ada item. Tekan + Tambah.
              </ThemedText>
            )}

            <View style={styles.sectionTotalRow}>
              <ThemedText style={styles.sectionTotalLabel}>Total {section.label}</ThemedText>
              <ThemedText style={styles.sectionTotalValue}>{fmtRp(sectionTotal)}</ThemedText>
            </View>
          </Card>
        );
      })}

      <Button
        title="\u{1F4CB} Tampilkan Neraca Lengkap"
        size="sm"
        onPress={computeNeraca}
        style={{ marginBottom: 16 }}
      />

      {showNeraca && neracaData && (
        <>
          {/* Neraca Lengkap */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.reportTitle}>LAPORAN POSISI KEUANGAN</ThemedText>
            <ThemedText style={styles.reportSubtitle}>{storeName}</ThemedText>
            <ThemedText style={styles.reportPeriode}>Per {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</ThemedText>
          </Card>

          {/* Aset */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.sectionTitle}>ASET</ThemedText>
            <ThemedText style={[styles.sectionSubTitle]}>Aset Lancar</ThemedText>
            <LRRow label="   Kas &amp; Setara Kas (Est.)" value={neracaData.asetLancar.kas} indent />
            <LRRow label="   Persediaan Barang" value={neracaData.asetLancar.persediaan} indent />
            <LRRow label="Total Aset Lancar" value={neracaData.asetLancar.kas + neracaData.asetLancar.persediaan} bold />
            <ThemedText style={[styles.sectionSubTitle, { marginTop: 8 }]}>Aset Tetap</ThemedText>
            {getItemsBySection('aset_tetap').map((item) => (
              <LRRow key={item.id} label={`   ${item.name}`} value={item.amount} indent />
            ))}
            <LRRow label="Total Aset Tetap" value={neracaData.totalAsetTetap} bold />
            <View style={styles.divider} />
            <LRRow label="TOTAL ASET" value={neracaData.totalAset} bold big highlight />
          </Card>

          {/* Kewajiban & Ekuitas */}
          <Card style={{ marginBottom: 8 }} padding={14}>
            <ThemedText style={styles.sectionTitle}>KEWAJIBAN &amp; EKUITAS</ThemedText>
            <ThemedText style={styles.sectionSubTitle}>Kewajiban</ThemedText>
            {getItemsBySection('kewajiban').map((item) => (
              <LRRow key={item.id} label={`   ${item.name}`} value={item.amount} indent />
            ))}
            <LRRow label="Total Kewajiban" value={neracaData.totalKewajiban} bold />
            <ThemedText style={[styles.sectionSubTitle, { marginTop: 8 }]}>Ekuitas / Modal</ThemedText>
            {getItemsBySection('modal').map((item) => (
              <LRRow key={item.id} label={`   ${item.name}`} value={item.amount} indent />
            ))}
            <LRRow label="   Laba Ditahan (Est.)" value={neracaData.labaYangDitahan} indent />
            <LRRow label="Total Ekuitas" value={neracaData.totalModal + neracaData.labaYangDitahan} bold />
            <View style={styles.divider} />
            <LRRow label="TOTAL KEWAJIBAN + EKUITAS" value={neracaData.totalKewajibanEkuitas} bold big highlight />
          </Card>

          {/* Selisih check */}
          {Math.abs(neracaData.totalAset - neracaData.totalKewajibanEkuitas) > 1 && (
            <Card style={{ marginBottom: 8, backgroundColor: Colors.warningBg }} padding={12}>
              <ThemedText style={{ fontSize: 12, color: Colors.warning }}>
                ⚠️ Neraca belum seimbang. Selisih: {fmtRp(Math.abs(neracaData.totalAset - neracaData.totalKewajibanEkuitas))}.
                Pastikan semua aset, kewajiban, dan modal sudah diinput dengan benar.
              </ThemedText>
            </Card>
          )}
          {Math.abs(neracaData.totalAset - neracaData.totalKewajibanEkuitas) <= 1 && (
            <Card style={{ marginBottom: 8, backgroundColor: Colors.successBg }} padding={12}>
              <ThemedText style={{ fontSize: 12, color: Colors.success }}>
                ✅ Neraca seimbang! Total Aset = Total Kewajiban + Ekuitas
              </ThemedText>
            </Card>
          )}

          <View style={styles.actionRow}>
            <Button
              title="\u{1F4E4} Export CSV"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={handleExport}
            />
            <Button
              title="\u{1F5A8} Cetak"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={handlePrint}
            />
          </View>
        </>
      )}

      {/* Modal tambah/edit item neraca */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <ThemedView style={styles.monthPickerOverlay}>
          <Card style={styles.bsModalCard} padding={20}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 12 }}>
              {editingItem ? 'Edit Item' : 'Tambah Item'}
            </ThemedText>

            <View style={{ marginBottom: 10 }}>
              <ThemedText style={styles.formLabel}>Kategori</ThemedText>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {BALANCE_SHEET_SECTIONS.map((s) => (
                  <Pressable
                    key={s.key}
                    style={[styles.sectionChip, formSection === s.key && styles.sectionChipActive]}
                    onPress={() => setFormSection(s.key)}
                  >
                    <ThemedText style={[styles.sectionChipText, formSection === s.key && styles.sectionChipTextActive]}>
                      {s.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ marginBottom: 10 }}>
              <ThemedText style={styles.formLabel}>Nama Item</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="cth: Mesin Kasir, Lemari Etalase..."
                placeholderTextColor={Colors.disabled}
                value={formName}
                onChangeText={setFormName}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <ThemedText style={styles.formLabel}>Nilai (Rp)</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="cth: 5000000"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                value={formAmount}
                onChangeText={setFormAmount}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Batal" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
              <Button title="Simpan" size="sm" style={{ flex: 1 }} onPress={handleSave} />
            </View>
          </Card>
        </ThemedView>
      </Modal>
    </ScrollView>
  );
}

// ─────────────────────────────────────────
// Beban Tab (CRUD Beban Operasional)
// ─────────────────────────────────────────
function BebanTab({ db }: { db: any }) {
  const now = new Date();
  const { expenses, loading, loadExpenses, addExpense, updateExpense, deleteExpense } = useExpenseStore();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('lain-lain');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(now.toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadExpenses(db, selectedMonth, selectedYear);
  }, [db, selectedMonth, selectedYear, loadExpenses]);

  const totalBeban = expenses.reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setEditingExpense(null);
    setFormCategory('lain-lain');
    setFormDesc('');
    setFormAmount('');
    setFormDate(new Date(selectedYear, selectedMonth - 1, 1).toISOString().slice(0, 10));
    setModalVisible(true);
  };

  const openEdit = (e: Expense) => {
    setEditingExpense(e);
    setFormCategory(e.category);
    setFormDesc(e.description);
    setFormAmount(e.amount.toString());
    setFormDate(e.expense_date);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formDesc.trim() || !formAmount) {
      Alert.alert('Error', 'Deskripsi dan nominal harus diisi');
      return;
    }
    if (editingExpense) {
      await updateExpense(db, editingExpense.id, {
        category: formCategory,
        description: formDesc.trim(),
        amount: parseFloat(formAmount),
        expense_date: formDate,
      });
    } else {
      await addExpense(db, {
        category: formCategory,
        description: formDesc.trim(),
        amount: parseFloat(formAmount),
        expense_date: formDate,
      });
    }
    setModalVisible(false);
    loadExpenses(db, selectedMonth, selectedYear);
  };

  const handleDelete = (e: Expense) => {
    Alert.alert('Hapus Beban', `Hapus "${e.description}"?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus', style: 'destructive',
        onPress: () => {
          deleteExpense(db, e.id);
        },
      },
    ]);
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <View style={{ flex: 1 }}>
      {/* Filter */}
      <Card style={{ marginBottom: 10 }} padding={12}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          {MONTH_NAMES.slice(0, 6).map((m, i) => (
            <Pressable
              key={i}
              style={[styles.monthChip, selectedMonth === i + 1 && styles.monthChipActive]}
              onPress={() => setSelectedMonth(i + 1)}
            >
              <ThemedText style={[styles.monthChipText, selectedMonth === i + 1 && styles.monthChipTextActive]}>
                {m.slice(0, 3)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {MONTH_NAMES.slice(6).map((m, i) => (
            <Pressable
              key={i + 6}
              style={[styles.monthChip, selectedMonth === i + 7 && styles.monthChipActive]}
              onPress={() => setSelectedMonth(i + 7)}
            >
              <ThemedText style={[styles.monthChipText, selectedMonth === i + 7 && styles.monthChipTextActive]}>
                {m.slice(0, 3)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {years.map((y) => (
            <Pressable
              key={y}
              style={[styles.yearChip, selectedYear === y && styles.yearChipActive]}
              onPress={() => setSelectedYear(y)}
            >
              <ThemedText style={[styles.yearChipText, selectedYear === y && styles.yearChipTextActive]}>{y}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </Card>

      {/* Summary */}
      <Card style={{ marginBottom: 10, backgroundColor: Colors.warningBg }} padding={12}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText style={{ fontSize: 12, color: Colors.warning }}>
            Total Beban {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </ThemedText>
          <ThemedText style={{ fontSize: 15, fontWeight: '700', color: Colors.danger }}>
            {fmtRp(totalBeban)}
          </ThemedText>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button title="+ Tambah Beban" size="sm" onPress={openAdd} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.tint} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 8, paddingBottom: 32 }}
          renderItem={({ item }) => {
            const cat = EXPENSE_CATEGORIES.find((c) => c.key === item.category);
            return (
              <Card padding={12}>
                <View style={styles.expenseItemRow}>
                  <View style={styles.expenseCatIcon}>
                    <ThemedText style={{ fontSize: 20, lineHeight: 24 }}>{cat?.icon ?? '\u{1F4DD}'}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 13 }}>{item.description}</ThemedText>
                    <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                      {cat?.label ?? item.category} • {item.expense_date}
                    </ThemedText>
                  </View>
                  <ThemedText style={{ fontWeight: '700', color: Colors.danger, fontSize: 13 }}>
                    {fmtRp(item.amount)}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
                    <Pressable onPress={() => openEdit(item)} style={styles.bsIconBtn}>
                      <ThemedText style={{ color: Colors.tint, fontSize: 14 }}>{'\u270F'}</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => handleDelete(item)} style={styles.bsIconBtn}>
                      <ThemedText style={{ color: Colors.danger, fontSize: 14 }}>{'\u{1F5D1}'}</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={'\u{1F4B8}'}
              title="Belum ada beban"
              subtitle="Tambah beban operasional untuk bulan ini"
            />
          }
        />
      )}

      {/* Modal tambah/edit beban */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <ThemedView style={styles.monthPickerOverlay}>
          <Card style={styles.bsModalCard} padding={20}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: 12 }}>
              {editingExpense ? 'Edit Beban' : 'Tambah Beban'}
            </ThemedText>

            <View style={{ marginBottom: 10 }}>
              <ThemedText style={styles.formLabel}>Kategori</ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    style={[styles.categoryChipBtn, formCategory === c.key && styles.categoryChipBtnActive]}
                    onPress={() => setFormCategory(c.key)}
                  >
                    <ThemedText style={[styles.categoryChipBtnText, formCategory === c.key && styles.categoryChipBtnTextActive]}>
                      {c.icon} {c.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ marginBottom: 10 }}>
              <ThemedText style={styles.formLabel}>Deskripsi</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="cth: Gaji Karyawan Bulan Juli"
                placeholderTextColor={Colors.disabled}
                value={formDesc}
                onChangeText={setFormDesc}
              />
            </View>

            <View style={{ marginBottom: 10 }}>
              <ThemedText style={styles.formLabel}>Nominal (Rp)</ThemedText>
              <TextInput
                style={styles.formInput}
                placeholder="cth: 2000000"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                value={formAmount}
                onChangeText={setFormAmount}
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <ThemedText style={styles.formLabel}>Tanggal</ThemedText>
              <Pressable style={styles.formInput} onPress={() => setShowDatePicker(true)}>
                <ThemedText>{formDate}</ThemedText>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={new Date(formDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setFormDate(date.toISOString().slice(0, 10));
                  }}
                />
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Batal" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
              <Button title="Simpan" size="sm" style={{ flex: 1 }} onPress={handleSave} />
            </View>
          </Card>
        </ThemedView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
// Buku Kas Tab (Arus Kas Masuk & Keluar)
// ─────────────────────────────────────────
function BukuKasTab({ db }: { db: SQLiteDatabase }) {
  const {
    entries,
    totalCashIn,
    totalCashOut,
    salesCashTotal,
    currentBalance,
    loading,
    loadLedger,
    addEntry,
    deleteEntry,
  } = useCashStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [entryType, setEntryType] = useState<CashTransactionType>('in');
  const [category, setCategory] = useState<string>('setoran_modal');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadLedger(db);
  }, [db, loadLedger]);

  const openModal = (type: CashTransactionType) => {
    setEntryType(type);
    setCategory(type === 'in' ? 'setoran_modal' : 'operasional');
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().slice(0, 10));
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

    try {
      await addEntry(db, entryType, category, description.trim(), numericAmount, date);
      setModalVisible(false);
      Alert.alert(
        'Sukses',
        `${entryType === 'in' ? 'Penerimaan Kas' : 'Pengeluaran Kas/Beban'} berhasil dicatat`
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal menyimpan transaksi kas');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Catatan', 'Apakah Anda yakin ingin menghapus catatan mutasi kas ini?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteEntry(db, id) },
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
        <ThemedText style={{ fontSize: 12, color: '#64748b', fontWeight: '700' }}>
          SALDO KAS FISIK TERSEDIA
        </ThemedText>
        <ThemedText
          style={{
            fontSize: 26,
            fontWeight: '800',
            color: currentBalance >= 0 ? Colors.tintDark : Colors.danger,
            marginTop: 4,
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
            <ThemedText style={{ fontSize: 11, color: '#64748b' }}>Total Kas Masuk (+):</ThemedText>
            <ThemedText
              style={{ fontSize: 14, fontWeight: '700', color: Colors.success, marginTop: 2 }}
            >
              {fmtRp(salesCashTotal + totalCashIn)}
            </ThemedText>
            <ThemedText style={{ fontSize: 9.5, color: Colors.muted }}>
              (Penjualan: {fmtRp(salesCashTotal)} + Lain: {fmtRp(totalCashIn)})
            </ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ fontSize: 11, color: '#64748b' }}>Total Kas Keluar (-):</ThemedText>
            <ThemedText
              style={{ fontSize: 14, fontWeight: '700', color: Colors.danger, marginTop: 2 }}
            >
              {fmtRp(totalCashOut)}
            </ThemedText>
            <ThemedText style={{ fontSize: 9.5, color: Colors.muted }}>
              (Beban Operasional & Kulakan)
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
                      {item.category.replace(/_/g, ' ')} • {item.date}
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
                  <Pressable onPress={() => handleDelete(item.id)} style={{ padding: 6 }}>
                    <ThemedText style={{ color: Colors.muted, fontSize: 14 }}>🗑️</ThemedText>
                  </Pressable>
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

      {/* Modal Input Kas */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <ThemedView style={styles.monthPickerOverlay}>
          <Card style={styles.bsModalCard} padding={20}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 15, marginBottom: 12 }}>
              {entryType === 'in'
                ? 'Catat Penerimaan Kas (Masuk)'
                : 'Catat Pengeluaran Kas/Beban (Keluar)'}
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
                    : 'Contoh: Bayar Token Listrik / Belanja Sayur'
                }
                placeholderTextColor={Colors.disabled}
                value={description}
                onChangeText={setDescription}
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
                onPress={() => setModalVisible(false)}
              />
              <Button title="Simpan Kas" size="sm" style={{ flex: 1 }} onPress={handleSave} />
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
