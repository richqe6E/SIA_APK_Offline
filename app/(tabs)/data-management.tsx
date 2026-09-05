import DateTimePicker from '@react-native-community/datetimepicker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import {
  deleteTransactions,
  exportProductsToCSV,
  exportProductsToPDF,
  exportTransactionsToCSV,
  exportTransactionsToPDF,
  importProductsFromCSV,
  shareFile,
} from '@/services/export';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProductStore } from '@/stores/productStore';
import { useRouter } from 'expo-router';

export default function DataManagementScreen() {
  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const { storeName, businessType } = useSettingsStore();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Paste CSV Modal
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pastedCSV, setPastedCSV] = useState('');

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

  const handleImportPastedCSV = async () => {
    if (!pastedCSV.trim()) {
      Alert.alert('Error', 'Teks CSV belum diisi.');
      return;
    }
    setImporting(true);
    try {
      const count = await importProductsFromCSV(db, pastedCSV);
      await useProductStore.getState().loadProducts(db);
      setPasteModalVisible(false);
      setPastedCSV('');
      Alert.alert('Berhasil', `${count} produk berhasil diimpor / diperbarui!`);
    } catch (e: any) {
      Alert.alert('Gagal Import', e?.message || 'Format teks CSV tidak valid.');
    } finally {
      setImporting(false);
    }
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
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconSymbol name="chevron.left" size={18} color={Colors.tint} />
          <ThemedText style={{ color: Colors.tint, fontWeight: '600' }}>Kembali</ThemedText>
        </View>
      </Pressable>

      <ThemedText type="title" style={{ marginBottom: 4 }}>Manajemen Data</ThemedText>
      <ThemedText style={{ fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
        Cadangkan data, ekspor laporan, dan impor produk
      </ThemedText>

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

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Button
              title="📥 Pilih File CSV"
              size="sm"
              style={{ flex: 1, backgroundColor: Colors.tint }}
              onPress={handlePickAndImportCSV}
              disabled={importing}
            />
            <Button
              title="📋 Tempel Teks"
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => setPasteModalVisible(true)}
              disabled={importing}
            />
          </View>
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
      </ScrollView>

      {/* Modal Tempel Teks CSV */}
      <Modal visible={pasteModalVisible} transparent animationType="slide">
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.modalCard} padding={16}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 16, marginBottom: 4 }}>
              Tempel Format CSV
            </ThemedText>
            <ThemedText style={{ fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
              Format baris: Nama,Kategori,HargaJual,HPP,Stok
            </ThemedText>

            <TextInput
              style={styles.csvTextArea}
              placeholder={'cth:\nKopi Susu,Minuman,15000,8000,50\nNasi Goreng,Makanan,20000,12000,30'}
              placeholderTextColor={Colors.disabled}
              multiline
              numberOfLines={6}
              value={pastedCSV}
              onChangeText={setPastedCSV}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Button
                title="Batal"
                variant="secondary"
                size="sm"
                style={{ flex: 1 }}
                onPress={() => setPasteModalVisible(false)}
              />
              <Button
                title="Proses Impor"
                size="sm"
                style={{ flex: 1, backgroundColor: Colors.tint }}
                onPress={handleImportPastedCSV}
              />
            </View>
          </Card>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
  },
  csvTextArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    height: 140,
    textAlignVertical: 'top',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#fafafa',
  },
});