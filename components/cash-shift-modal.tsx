import React, { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';
import { useShiftStore, type CashShift, type ShiftSummary } from '@/stores/shiftStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { printZReport } from '@/services/print';
import { useSQLiteContext } from 'expo-sqlite';

interface CashShiftModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CashShiftModal({ visible, onClose, onSuccess }: CashShiftModalProps) {
  const db = useSQLiteContext();
  const { currentShift, openShift, getShiftSummary, closeShift } = useShiftStore();
  const { storeName, storeAddress, storePhone } = useSettingsStore();

  const [cashierName, setCashierName] = useState('Kasir');
  const [startingCashStr, setStartingCashStr] = useState('100000');
  const [actualCashStr, setActualCashStr] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      if (currentShift) {
        setLoading(true);
        getShiftSummary(db, currentShift)
          .then((res) => {
            setSummary(res);
            setActualCashStr(res.expectedCash.toString());
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setStartingCashStr('100000');
        setActualCashStr('');
        setNotes('');
        setSummary(null);
      }
    }
  }, [visible, currentShift, db, getShiftSummary]);

  const handleOpenShift = async () => {
    const startCash = parseInt(startingCashStr.replace(/\D/g, ''), 10) || 0;
    try {
      await openShift(db, cashierName, startCash);
      Alert.alert('Shift Dimulai', `Shift kasir untuk ${cashierName} berhasil dibuka.`);
      onSuccess?.();
      onClose();
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal membuka shift');
    }
  };

  const handleCloseShift = async (shouldPrint: boolean) => {
    if (!currentShift) return;
    const actualCash = parseInt(actualCashStr.replace(/\D/g, ''), 10) || 0;

    Alert.alert(
      'Konfirmasi Tutup Shift',
      'Apakah Anda yakin ingin menutup shift kasir saat ini? Tindakan ini akan mengunci pembukuan shift.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tutup Shift',
          style: 'destructive',
          onPress: async () => {
            try {
              const closed = await closeShift(db, currentShift.id, actualCash, notes);

              if (shouldPrint) {
                try {
                  await printZReport({
                    storeName: storeName || 'POS Offline',
                    storeAddress,
                    storePhone,
                    cashierName: closed.cashier_name,
                    shiftId: closed.id,
                    openedAt: closed.opened_at,
                    closedAt: closed.closed_at || new Date().toISOString(),
                    startingCash: closed.starting_cash,
                    totalSalesCash: closed.total_sales_cash,
                    totalSalesNonCash: closed.total_sales_non_cash,
                    totalTransactions: closed.total_transactions,
                    expectedCash: closed.expected_cash,
                    actualCash: closed.actual_cash || 0,
                    difference: closed.difference || 0,
                    notes: closed.notes,
                  });
                } catch {
                  Alert.alert('Info Cetak', 'Shift ditutup. Gagal mencetak ke printer Bluetooth.');
                }
              }

              Alert.alert('Shift Selesai', 'Shift kasir berhasil ditutup dan direkonsiliasi.');
              onSuccess?.();
              onClose();
            } catch (e: any) {
              Alert.alert('Gagal', e?.message || 'Gagal menutup shift');
            }
          },
        },
      ]
    );
  };

  const actualNum = parseInt(actualCashStr.replace(/\D/g, ''), 10) || 0;
  const expectedNum = summary?.expectedCash ?? 0;
  const difference = actualNum - expectedNum;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ThemedView style={styles.card}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ fontSize: 16 }}>
              {currentShift ? '🔒 Tutup Shift (Z-Report)' : '🔓 Buka Shift Kasir'}
            </ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <ThemedText style={{ fontSize: 16, color: Colors.muted, fontWeight: '700' }}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          {currentShift ? (
            /* MODE TUTUP SHIFT */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              <View style={styles.shiftInfoBadge}>
                <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>
                  Petugas Kasir: {currentShift.cashier_name}
                </ThemedText>
                <ThemedText style={{ fontSize: 10.5, color: '#64748b' }}>
                  Mulai:{' '}
                  {new Date(currentShift.opened_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  • {new Date(currentShift.opened_at).toLocaleDateString('id-ID')}
                </ThemedText>
              </View>

              {/* Rincian Sistem */}
              <View style={styles.detailBox}>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Modal Kas Awal</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    Rp {currentShift.starting_cash.toLocaleString('id-ID')}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Penjualan Tunai (+)</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: Colors.success, fontWeight: '700' }]}>
                    Rp {(summary?.salesCash ?? 0).toLocaleString('id-ID')}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Penjualan QRIS</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    Rp {(summary?.salesNonCash ?? 0).toLocaleString('id-ID')}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Total Transaksi</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {summary?.transactionCount ?? 0} nota
                  </ThemedText>
                </View>
                <View style={[styles.detailRow, styles.detailTotalRow]}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 12.5 }}>
                    Total Kas Laci Sistem
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: Colors.tint }}>
                    Rp {expectedNum.toLocaleString('id-ID')}
                  </ThemedText>
                </View>
              </View>

              {/* Input Kas Fisik Aktual */}
              <View style={{ gap: 4 }}>
                <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#334155' }}>
                  Hitung Uang Fisik di Laci Kasir (Aktual):
                </ThemedText>
                <View style={styles.inputBox}>
                  <ThemedText style={styles.inputPrefix}>Rp</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    value={actualCashStr ? parseInt(actualCashStr, 10).toLocaleString('id-ID') : ''}
                    onChangeText={(text) => setActualCashStr(text.replace(/\D/g, ''))}
                    placeholder="0"
                    placeholderTextColor={Colors.placeholder}
                  />
                </View>
              </View>

              {/* Status Selisih Kas */}
              <View
                style={[
                  styles.diffBadge,
                  difference === 0
                    ? styles.diffPass
                    : difference > 0
                    ? styles.diffOver
                    : styles.diffUnder,
                ]}
              >
                <ThemedText
                  style={[
                    styles.diffText,
                    difference === 0
                      ? styles.diffTextPass
                      : difference > 0
                      ? styles.diffTextOver
                      : styles.diffTextUnder,
                  ]}
                >
                  {difference === 0
                    ? '✓ Saldo Kas PAS (Rp 0)'
                    : difference > 0
                    ? `▲ Kas Lebih: +Rp ${difference.toLocaleString('id-ID')}`
                    : `▼ Kas Kurang: -Rp ${Math.abs(difference).toLocaleString('id-ID')}`}
                </ThemedText>
              </View>

              {/* Catatan Shift */}
              <View style={{ gap: 4 }}>
                <ThemedText style={{ fontSize: 11, color: '#64748b' }}>Catatan Penutupan:</ThemedText>
                <TextInput
                  style={styles.noteInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Keterangan singkat jika ada selisih..."
                  placeholderTextColor={Colors.placeholder}
                />
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <Button title="Batal" variant="secondary" size="sm" onPress={onClose} />
                <Button
                  title="Tutup & Cetak Z-Report"
                  size="sm"
                  style={{ backgroundColor: '#0284c7' }}
                  onPress={() => handleCloseShift(true)}
                />
                <Button
                  title="Tutup Shift"
                  size="sm"
                  onPress={() => handleCloseShift(false)}
                />
              </View>
            </ScrollView>
          ) : (
            /* MODE BUKA SHIFT */
            <View style={{ gap: 12 }}>
              <View style={{ gap: 4 }}>
                <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#334155' }}>
                  Nama Petugas Kasir:
                </ThemedText>
                <TextInput
                  style={styles.singleInput}
                  value={cashierName}
                  onChangeText={setCashierName}
                  placeholder="Nama Kasir..."
                  placeholderTextColor={Colors.placeholder}
                />
              </View>

              <View style={{ gap: 4 }}>
                <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#334155' }}>
                  Modal Kas Awal di Laci:
                </ThemedText>
                <View style={styles.inputBox}>
                  <ThemedText style={styles.inputPrefix}>Rp</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    value={
                      startingCashStr ? parseInt(startingCashStr, 10).toLocaleString('id-ID') : ''
                    }
                    onChangeText={(text) => setStartingCashStr(text.replace(/\D/g, ''))}
                    placeholder="0"
                    placeholderTextColor={Colors.placeholder}
                  />
                </View>
              </View>

              <View style={styles.presetRow}>
                {[50000, 100000, 200000, 500000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.presetChip}
                    onPress={() => setStartingCashStr(amt.toString())}
                  >
                    <ThemedText style={styles.presetChipText}>
                      Rp {amt / 1000}rb
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actionRow}>
                <View style={{ flex: 1 }} />
                <Button title="Batal" variant="secondary" size="sm" onPress={onClose} />
                <Button title="Buka Shift Kasir" size="sm" onPress={handleOpenShift} />
              </View>
            </View>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 14,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftInfoBadge: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 2,
  },
  detailBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11.5,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 11.5,
    color: '#1e293b',
  },
  detailTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    marginTop: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.tint,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    height: 42,
  },
  singleInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: '#1e293b',
  },
  inputPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.tint,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    paddingVertical: 0,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11.5,
    color: '#1e293b',
  },
  diffBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  diffPass: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  diffOver: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  diffUnder: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  diffText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  diffTextPass: {
    color: '#16a34a',
  },
  diffTextOver: {
    color: '#2563eb',
  },
  diffTextUnder: {
    color: '#dc2626',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 6,
  },
});
