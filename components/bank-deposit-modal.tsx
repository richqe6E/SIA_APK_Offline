import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useSQLiteContext } from 'expo-sqlite';
import { useCashStore } from '@/stores/cashStore';
import { usePrinterStore } from '@/stores/printerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { printBankDepositReceipt } from '@/services/print';

const POPULAR_BANKS = [
  'BCA',
  'BRI',
  'Mandiri',
  'BNI',
  'BSI',
  'Rekening Pemilik',
  'Serah Tunai Owner',
];

interface BankDepositModalProps {
  visible: boolean;
  currentBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function BankDepositModal({
  visible,
  currentBalance,
  onClose,
  onSuccess,
}: BankDepositModalProps) {
  const db = useSQLiteContext();
  const { depositToBank } = useCashStore();
  const { printerTarget } = usePrinterStore();
  const { storeName, currentUserRole } = useSettingsStore();

  const [amount, setAmount] = useState('');
  const [selectedBank, setSelectedBank] = useState('BCA');
  const [customBank, setCustomBank] = useState('');
  const [notes, setNotes] = useState('');
  const [autoPrint, setAutoPrint] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const safeBalance = Math.max(0, currentBalance);

  const formatNumber = (numStr: string) => {
    const clean = numStr.replace(/[^0-9]/g, '');
    if (!clean) return '';
    return parseInt(clean, 10).toLocaleString('id-ID');
  };

  const parseNumber = (formattedStr: string) => {
    return parseInt(formattedStr.replace(/[^0-9]/g, ''), 10) || 0;
  };

  const handleSetDepositAll = () => {
    if (safeBalance <= 0) {
      Alert.alert('Kas Kosong', 'Saldo kas fisik tersedia saat ini Rp 0');
      return;
    }
    setAmount(safeBalance.toLocaleString('id-ID'));
  };

  const handleSetKeepChange = (keepAmount: number) => {
    if (safeBalance <= keepAmount) {
      Alert.alert(
        'Saldo Kurang',
        `Saldo kas saat ini (Rp ${safeBalance.toLocaleString('id-ID')}) tidak mencukupi untuk disisakan Rp ${keepAmount.toLocaleString('id-ID')}`
      );
      return;
    }
    const depositAmount = safeBalance - keepAmount;
    setAmount(depositAmount.toLocaleString('id-ID'));
  };

  const handleSubmit = async () => {
    const numAmount = parseNumber(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Perhatian', 'Masukkan nominal uang kas yang akan disetor ke bank.');
      return;
    }

    if (numAmount > currentBalance) {
      Alert.alert(
        'Nominal Melebihi Saldo Kas Laci',
        `Anda memasukkan Rp ${numAmount.toLocaleString('id-ID')}, sedangkan saldo kas fisik di laci saat ini hanya Rp ${currentBalance.toLocaleString('id-ID')}.\n\nSistem mencegah saldo kas minus.`
      );
      return;
    }

    const targetBank = selectedBank === 'Lainnya' ? (customBank.trim() || 'Bank Lain') : selectedBank;

    try {
      setSubmitting(true);
      await depositToBank(db, numAmount, targetBank, notes.trim());

      // Cetak tanda terima jika dipilih dan printer terhubung
      if (autoPrint && printerTarget) {
        try {
          await printBankDepositReceipt({
            storeName,
            depositAmount: numAmount,
            remainingCash: currentBalance - numAmount,
            bankTarget: targetBank,
            notes: notes.trim(),
            cashierName: currentUserRole === 'kasir' ? 'Kasir' : 'Pemilik Toko',
            date: new Date(),
          });
        } catch (printErr) {
          console.warn('Gagal cetak tanda terima setor bank:', printErr);
        }
      }

      setAmount('');
      setNotes('');
      setCustomBank('');
      setSubmitting(false);
      onSuccess();
      onClose();

      Alert.alert(
        'Setoran Berhasil Dicatat',
        `Uang kas sebesar Rp ${numAmount.toLocaleString('id-ID')} telah dipindahkan ke ${targetBank}.\n\nSaldo kas fisik di laci telah diperbarui secara akurat dan laba usaha Anda tetap utuh.`
      );
    } catch (err: any) {
      setSubmitting(false);
      Alert.alert('Gagal', err?.message || 'Terjadi kesalahan saat mencatat setoran bank');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ThemedView style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ThemedText style={{ fontSize: 18 }}>🏦</ThemedText>
                <ThemedText type="subtitle" style={{ fontSize: 16 }}>
                  Setor Kas Laci ke Bank
                </ThemedText>
              </View>
              <ThemedText style={styles.subHeader}>
                Pindahkan uang kas fisik di laci ke rekening bank atau serahkan ke pemilik
              </ThemedText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#64748b' }}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {/* Info Saldo Laci Saat Ini */}
            <Card padding={12} style={styles.balanceInfoCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <ThemedText style={{ fontSize: 10.5, color: '#64748b', fontWeight: '700' }}>
                    SALDO KAS FISIK DI LACI SAAT INI
                  </ThemedText>
                  <ThemedText style={{ fontSize: 20, fontWeight: '800', color: currentBalance >= 0 ? Colors.tintDark : Colors.danger, marginTop: 2 }}>
                    Rp {currentBalance.toLocaleString('id-ID')}
                  </ThemedText>
                </View>
                <View style={styles.safetyBadge}>
                  <ThemedText style={{ fontSize: 10, color: '#0369a1', fontWeight: '700' }}>
                    🔒 Tidak Mengurangi Laba
                  </ThemedText>
                </View>
              </View>
            </Card>

            {/* Input Nominal Setoran */}
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Nominal Setoran ke Bank (Rp) *</ThemedText>
              <View style={styles.inputWrapper}>
                <ThemedText style={styles.currencyPrefix}>Rp</ThemedText>
                <TextInput
                  value={amount}
                  onChangeText={(val) => setAmount(formatNumber(val))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.placeholder}
                  style={styles.amountInput}
                  autoFocus
                />
                {amount.length > 0 && (
                  <TouchableOpacity onPress={() => setAmount('')} style={styles.clearBtn}>
                    <ThemedText style={{ fontSize: 12, color: '#94a3b8' }}>✕</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Tombol Pintas / Preset Cepat */}
            <View style={styles.presetSection}>
              <ThemedText style={styles.presetTitle}>Pilihan Cepat:</ThemedText>
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={[styles.presetChip, styles.presetChipPrimary]}
                  onPress={handleSetDepositAll}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.presetChipPrimaryText}>
                    ⚡ Setor Semua (Rp {safeBalance.toLocaleString('id-ID')})
                  </ThemedText>
                </TouchableOpacity>

                {safeBalance > 100000 && (
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleSetKeepChange(100000)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={styles.presetChipText}>
                      Sisakan Rp 100.000 di Laci
                    </ThemedText>
                  </TouchableOpacity>
                )}

                {safeBalance > 200000 && (
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleSetKeepChange(200000)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={styles.presetChipText}>
                      Sisakan Rp 200.000 di Laci
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Pilihan Bank Tujuan */}
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Tujuan Setoran / Bank *</ThemedText>
              <View style={styles.bankChipsWrap}>
                {POPULAR_BANKS.map((b) => (
                  <Pressable
                    key={b}
                    style={[
                      styles.bankChip,
                      selectedBank === b && styles.bankChipActive,
                    ]}
                    onPress={() => setSelectedBank(b)}
                  >
                    <ThemedText
                      style={[
                        styles.bankChipText,
                        selectedBank === b && styles.bankChipTextActive,
                      ]}
                    >
                      {b}
                    </ThemedText>
                  </Pressable>
                ))}
                <Pressable
                  style={[
                    styles.bankChip,
                    selectedBank === 'Lainnya' && styles.bankChipActive,
                  ]}
                  onPress={() => setSelectedBank('Lainnya')}
                >
                  <ThemedText
                    style={[
                      styles.bankChipText,
                      selectedBank === 'Lainnya' && styles.bankChipTextActive,
                    ]}
                  >
                    + Lainnya
                  </ThemedText>
                </Pressable>
              </View>

              {selectedBank === 'Lainnya' && (
                <TextInput
                  value={customBank}
                  onChangeText={setCustomBank}
                  placeholder="Tulis nama bank / rekening tujuan..."
                  placeholderTextColor={Colors.placeholder}
                  style={[styles.textInput, { marginTop: 6 }]}
                />
              )}
            </View>

            {/* Keterangan / Referensi */}
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Catatan / Keterangan (Opsional)</ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Contoh: Disetor via CRM / Titip Owner / No. Slip 123..."
                placeholderTextColor={Colors.placeholder}
                style={styles.textInput}
              />
            </View>

            {/* Opsi Cetak Thermal jika printer ada */}
            {printerTarget && (
              <TouchableOpacity
                style={styles.printToggleRow}
                onPress={() => setAutoPrint(!autoPrint)}
                activeOpacity={0.8}
              >
                <ThemedText style={{ fontSize: 16 }}>{autoPrint ? '☑️' : '🔲'}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: '#334155', flex: 1 }}>
                  Cetak tanda terima serah terima setoran ke printer thermal
                </ThemedText>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title="Batal"
              variant="outline"
              size="sm"
              style={{ flex: 0.8 }}
              onPress={onClose}
              disabled={submitting}
            />
            <Button
              title={submitting ? 'Menyimpan...' : '🏦 Konfirmasi Setor Bank'}
              variant="primary"
              size="sm"
              style={{ flex: 1.5 }}
              onPress={handleSubmit}
              disabled={submitting}
            />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  subHeader: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceInfoCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
    marginBottom: 14,
  },
  safetyBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.tint,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    height: 46,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.tintDark,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  presetSection: {
    marginBottom: 14,
  },
  presetTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipPrimary: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  presetChipPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  bankChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bankChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bankChipActive: {
    backgroundColor: '#ede9fe',
    borderColor: '#a78bfa',
  },
  bankChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  bankChipTextActive: {
    color: '#6d28d9',
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  printToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});
