import DateTimePicker from '@react-native-community/datetimepicker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import {
  deleteTransactions,
  exportTransactionsToCSV,
  shareFile,
} from '@/services/export';
import { useRouter } from 'expo-router';

export default function DataManagementScreen() {
  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleExport = async (all: boolean) => {
    setExporting(true);
    try {
      const start = all ? undefined : formatDateInput(startDate);
      const end = all ? undefined : formatDateInput(endDate);
      const fileUri = await exportTransactionsToCSV(db, start, end);
      if (!fileUri) {
        Alert.alert('Tidak ada data', 'Tidak ada transaksi untuk diexport');
        return;
      }
      await shareFile(fileUri);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message ?? 'Export gagal');
    } finally {
      setExporting(false);
    }
  };

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

      <ThemedText type="title" style={{ marginBottom: 20 }}>Manajemen Data</ThemedText>

      {/* Export section */}
      <Card padding={16} style={{ marginBottom: 16, gap: 12 }}>
        <View style={styles.sectionHeader}>
          <ThemedText style={{ fontSize: 20, lineHeight: 24 }}>{'\u{1F4E4}'}</ThemedText>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>Export Data Penjualan</ThemedText>
        </View>

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.dateLabel}>Tanggal Mulai</ThemedText>
            <Pressable onPress={() => setShowStartPicker(true)} style={styles.dateInput}>
              <ThemedText>{formatDateLabel(startDate)}</ThemedText>
            </Pressable>
          </View>
          <ThemedText style={{ marginTop: 24 }}>{'\u2013'}</ThemedText>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.dateLabel}>Tanggal Selesai</ThemedText>
            <Pressable onPress={() => setShowEndPicker(true)} style={styles.dateInput}>
              <ThemedText>{formatDateLabel(endDate)}</ThemedText>
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

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Export Periode"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => handleExport(false)}
            disabled={exporting}
          />
          <Button
            title="Export Semua"
            variant="outline"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => handleExport(true)}
            disabled={exporting}
          />
        </View>
        {exporting && <ActivityIndicator size="small" color={Colors.tint} />}
      </Card>

      {/* Delete section */}
      <Card padding={16} style={{ gap: 12 }}>
        <View style={styles.sectionHeader}>
          <ThemedText style={{ fontSize: 20, lineHeight: 24 }}>{'\u{26A0}\u{FE0F}'}</ThemedText>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16, color: Colors.danger }}>
            Hapus Data Transaksi
          </ThemedText>
        </View>

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.dateLabel}>Tanggal Mulai</ThemedText>
            <Pressable onPress={() => setShowStartPicker(true)} style={styles.dateInput}>
              <ThemedText>{formatDateLabel(startDate)}</ThemedText>
            </Pressable>
          </View>
          <ThemedText style={{ marginTop: 24 }}>{'\u2013'}</ThemedText>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.dateLabel}>Tanggal Selesai</ThemedText>
            <Pressable onPress={() => setShowEndPicker(true)} style={styles.dateInput}>
              <ThemedText>{formatDateLabel(endDate)}</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Hapus Periode"
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  backRow: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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