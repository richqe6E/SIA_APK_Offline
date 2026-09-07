import { AdminPinModal } from '@/components/admin-pin-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import { resetEntireDatabase } from '@/services/database';
import {
  deleteTransactions,
  exportProductsToCSV,
  exportProductsToPDF,
  exportTransactionsToCSV,
  exportTransactionsToPDF,
  importProductsFromCSV,
  shareFile,
} from '@/services/export';
import { useProductStore } from '@/stores/productStore';
import { useSettingsStore } from '@/stores/settingsStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DataManagementScreen() {
  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const { storeName, businessType } = useSettingsStore();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Admin PIN Modal for Factory Reset
  const [showAdminPin, setShowAdminPin] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const formatDateInput = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatDateLabel = (d: Date) => {
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // ─────────────────────────────────────────
  // Export & Import Produk
  // ─────────────────────────────────────────
  const handleExportProductsCSV = async () => {
    setExporting(true);
    try {
      const uri = await exportProductsToCSV(db);
      if (!uri) {
        Alert.alert('Data Kosong', 'Belum ada data produk untuk diekspor.');
        return;
      }
      await shareFile(uri, 'text/csv');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal mengekspor produk.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportProductsPDF = async () => {
    setExporting(true);
    try {
      const uri = await exportProductsToPDF(db, storeName, businessType);
      await shareFile(uri, 'application/pdf');
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal mengekspor katalog produk ke PDF.');
    } finally {
      setExporting(false);
    }
  };

  const handlePickAndImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setImporting(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const csvText = await response.text();

      const count = await importProductsFromCSV(db, csvText);
      await useProductStore.getState().loadProducts(db);
      Alert.alert('Berhasil', `${count} produk berhasil diimpor / diperbarui!`);
    } catch (e: any) {
      Alert.alert('Gagal Import', e?.message || 'Pastikan format file CSV sesuai.');
    } finally {
      setImporting(false);
    }
  };

  const executeFactoryReset = async () => {
    setResetting(true);
    try {
      await resetEntireDatabase(db);
      await useProductStore.getState().loadProducts(db);
      Alert.alert(
        'Reset Berhasil',
        'Seluruh data aplikasi (produk, riwayat penjualan, buku kas, hutang & piutang) telah dibersihkan ke kondisi awal.'
      );
    } catch (e: any) {
      Alert.alert('Gagal Reset', e?.message || 'Terjadi kesalahan saat mereset data.');
    } finally {
      setResetting(false);
    }
  };

  const confirmFactoryReset = () => {
    Alert.alert(
      '⚠️ PERINGATAN TERAKHIR',
      'Tindakan ini TIDAK DAPAT DIBATALKAN!\n\nSeluruh produk, riwayat penjualan, catatan kas, pembelian, serta data pelanggan, supplier, hutang dan piutang akan DIHAPUS PERMANEN.\n\nLanjutkan reset pabrik sekarang?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'YA, HAPUS SEMUA DATA',
          style: 'destructive',
          onPress: executeFactoryReset,
        },
      ]
    );
  };

  const handleRequestFactoryReset = () => {
    setShowAdminPin(true);
  };

  // ─────────────────────────────────────────
  // Export Transaksi Penjualan
  // ─────────────────────────────────────────
  const handleExportTransactions = async (format: 'csv' | 'pdf', all: boolean) => {
    setExporting(true);
    try {
      const start = all ? undefined : formatDateInput(startDate);
      const end = all ? undefined : formatDateInput(endDate);

      if (format === 'csv') {
        const fileUri = await exportTransactionsToCSV(db, start, end);
        if (!fileUri) {
          Alert.alert('Tidak ada data', 'Tidak ada transaksi pada periode ini.');
          return;
        }
        await shareFile(fileUri, 'text/csv');
      } else {
        const fileUri = await exportTransactionsToPDF(db, storeName, start, end);
        await shareFile(fileUri, 'application/pdf');
      }
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Export gagal');
    } finally {
      setExporting(false);
    }
  };

  // ─────────────────────────────────────────
  // Hapus Data Transaksi
  // ─────────────────────────────────────────
  const handleDeleteAll = () => {
    Alert.alert(
      'Hapus Semua Transaksi',
      'Yakin ingin menghapus SEMUA riwayat transaksi?\nData yang dihapus tidak dapat dikembalikan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const count = await deleteTransactions(db);
              Alert.alert('Berhasil', `${count} transaksi berhasil dihapus`);
            } catch {
              Alert.alert('Gagal', 'Gagal menghapus transaksi');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteByPeriod = () => {
    Alert.alert(
      'Hapus Transaksi per Periode',
      `Hapus semua transaksi dari ${formatDateLabel(startDate)} hingga ${formatDateLabel(endDate)}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const count = await deleteTransactions(
                db,
                formatDateInput(startDate),
                formatDateInput(endDate)
              );
              Alert.alert('Berhasil', `${count} transaksi berhasil dihapus`);
            } catch {
              Alert.alert('Gagal', 'Gagal menghapus transaksi');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
      <View style={styles.topHeader}>
        <Pressable
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'))}
        >
          <ThemedText style={styles.backBtnText}>‹ Kembali</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>Manajemen Data</ThemedText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* SECTION 1: MANAJEMEN PRODUK */}
        <Card padding={16} style={{ marginBottom: 16, gap: 12 }}>
          <View style={styles.sectionHeader}>
            <ThemedText style={{ fontSize: 20, lineHeight: 24 }}>📦</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>
                Data Produk & Stok
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                Ekspor katalog ke PDF/CSV atau impor data produk massal
              </ThemedText>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="📄 Export PDF"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={handleExportProductsPDF}
              disabled={exporting}
            />
            <Button
              title="📊 Export CSV"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={handleExportProductsCSV}
              disabled={exporting}
            />
          </View>

          <Button
            title={importing ? 'Mengimpor File...' : '📥 Import Produk dari File CSV'}
            size="sm"
            style={{ backgroundColor: Colors.tint, marginTop: 4 }}
            onPress={handlePickAndImportCSV}
            disabled={importing}
          />
          {importing && <ActivityIndicator size="small" color={Colors.tint} style={{ marginTop: 4 }} />}
        </Card>

        {/* SECTION 2: EXPORT PENJUALAN */}
        <Card padding={16} style={{ marginBottom: 16, gap: 12 }}>
          <View style={styles.sectionHeader}>
            <ThemedText style={{ fontSize: 20, lineHeight: 24 }}>📤</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>
                Export Data Penjualan
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                Rekap transaksi dalam format PDF atau CSV
              </ThemedText>
            </View>
          </View>

          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.dateLabel}>Tanggal Mulai</ThemedText>
              <Pressable onPress={() => setShowStartPicker(true)} style={styles.dateInput}>
                <ThemedText style={{ fontSize: 12 }}>{formatDateLabel(startDate)}</ThemedText>
              </Pressable>
            </View>
            <ThemedText style={{ marginTop: 20 }}>–</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.dateLabel}>Tanggal Selesai</ThemedText>
              <Pressable onPress={() => setShowEndPicker(true)} style={styles.dateInput}>
                <ThemedText style={{ fontSize: 12 }}>{formatDateLabel(endDate)}</ThemedText>
              </Pressable>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(_, date) => {
                setShowStartPicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(_, date) => {
                setShowEndPicker(false);
                if (date) setEndDate(date);
              }}
            />
          )}

          <ThemedText style={{ fontSize: 11, fontWeight: '700', color: Colors.placeholder, marginTop: 4 }}>
            PILIH FORMAT EXPORT:
          </ThemedText>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="📄 PDF Periode"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => handleExportTransactions('pdf', false)}
              disabled={exporting}
            />
            <Button
              title="📊 CSV Periode"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => handleExportTransactions('csv', false)}
              disabled={exporting}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="📄 PDF Semua"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => handleExportTransactions('pdf', true)}
              disabled={exporting}
            />
            <Button
              title="📊 CSV Semua"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => handleExportTransactions('csv', true)}
              disabled={exporting}
            />
          </View>
          {exporting && <ActivityIndicator size="small" color={Colors.tint} />}
        </Card>

        {/* SECTION 3: HAPUS TRANSAKSI */}
        <Card padding={16} style={{ gap: 12 }}>
          <View style={styles.sectionHeader}>
            <ThemedText style={{ fontSize: 20, lineHeight: 24 }}>⚠️</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15, color: Colors.danger }}>
                Hapus Data Transaksi
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                Hapus transaksi sesuai tanggal yang dipilih di atas atau semua
              </ThemedText>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="Hapus Periode Ini"
              variant="outline"
              size="sm"
              style={{ flex: 1, borderColor: Colors.danger }}
              onPress={handleDeleteByPeriod}
              disabled={deleting}
            />
            <Button
              title="Hapus Semua"
              size="sm"
              style={{ flex: 1, backgroundColor: Colors.danger }}
              onPress={handleDeleteAll}
              disabled={deleting}
            />
          </View>
          {deleting && <ActivityIndicator size="small" color={Colors.danger} />}
        </Card>

        {/* SECTION 4: RESET TOTAL / PABRIK */}
        <Card padding={16} style={{ marginTop: 16, gap: 12, borderColor: '#ffcdd2', borderWidth: 1 }}>
          <View style={styles.sectionHeader}>
            <ThemedText style={{ fontSize: 20, lineHeight: 24 }}>🚨</ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15, color: Colors.danger }}>
                Reset Seluruh Data Aplikasi (Reset Pabrik)
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                Menghapus semua produk, riwayat transaksi, buku kas, serta data hutang & piutang. Dilindungi PIN Admin.
              </ThemedText>
            </View>
          </View>

          <Button
            title={resetting ? 'Membersihkan Data...' : '⚠️ Hapus Seluruh Data Aplikasi'}
            size="sm"
            style={{ backgroundColor: Colors.danger }}
            onPress={handleRequestFactoryReset}
            disabled={resetting || deleting}
          />
          {resetting && <ActivityIndicator size="small" color={Colors.danger} style={{ marginTop: 4 }} />}
        </Card>
      </ScrollView>

      {/* Modal Verifikasi PIN Admin untuk Reset Pabrik */}
      <AdminPinModal
        visible={showAdminPin}
        onClose={() => setShowAdminPin(false)}
        onSuccess={() => {
          setShowAdminPin(false);
          confirmFactoryReset();
        }}
        title="Otorisasi Reset Pabrik"
        description="Masukkan 6 digit PIN Admin untuk menghapus seluruh data aplikasi."
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.tint,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  backRow: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: 11,
    color: Colors.placeholder,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: Colors.card,
  },
});