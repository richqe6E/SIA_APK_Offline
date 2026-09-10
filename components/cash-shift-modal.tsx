import React, { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
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
  const {
    currentShift,
    isDrawerSetToday,
    todayDrawerAmount,
    cashierList,
    loadShiftData,
    saveDailyDrawerAmount,
    switchCashier,
    addCashierEmployee,
    removeCashierEmployee,
    getShiftSummary,
    closeShift,
  } = useShiftStore();
  const { storeName, storeAddress, storePhone } = useSettingsStore();

  // Mode & Form States
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [isEditingDrawer, setIsEditingDrawer] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState('');
  const [newCashierName, setNewCashierName] = useState('');
  const [drawerAmountStr, setDrawerAmountStr] = useState('100000');
  const [actualCashStr, setActualCashStr] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadShiftData(db).then(() => {
        const activeName = useShiftStore.getState().currentShift?.cashier_name || 'Kasir 1';
        setSelectedCashier(activeName);
        setDrawerAmountStr(useShiftStore.getState().todayDrawerAmount.toString());
      });
      setShowCloseShift(false);
      setIsEditingDrawer(false);
      setNewCashierName('');
    }
  }, [visible, db, loadShiftData]);

  // Load summary for closing shift
  useEffect(() => {
    if (visible && currentShift && showCloseShift) {
      setLoading(true);
      getShiftSummary(db, currentShift)
        .then((res) => {
          setSummary(res);
          setActualCashStr(res.expectedCash.toString());
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [visible, currentShift, showCloseShift, db, getShiftSummary]);

  // 1. Handle Buka Shift Pertama Kali Hari Ini
  const handleStartTodayShift = async () => {
    const cash = parseInt(drawerAmountStr.replace(/\D/g, ''), 10) || 0;
    const cashier = selectedCashier.trim() || newCashierName.trim() || 'Kasir 1';

    try {
      setLoading(true);
      await saveDailyDrawerAmount(db, cash);
      await switchCashier(db, cashier);
      Alert.alert(
        'Shift Kasir Dimulai',
        `Modal laci Rp ${cash.toLocaleString('id-ID')} tersimpan.\nPetugas aktif: ${cashier}`
      );
      onSuccess?.();
      onClose();
    } catch (e: any) {
      Alert.alert('Gagal Memulai Shift', e?.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Ganti Kasir Bertugas Cepat (1-Tap)
  const handleSelectCashier = async (name: string) => {
    try {
      setLoading(true);
      await switchCashier(db, name);
      setSelectedCashier(name);
      Alert.alert('Kasir Berganti', `Petugas kasir aktif sekarang: ${name}`);
      onSuccess?.();
      onClose();
    } catch (e: any) {
      Alert.alert('Gagal Ganti Kasir', e?.message || 'Gagal mengubah kasir');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Tambah Kasir Baru
  const handleAddNewCashier = async () => {
    if (!newCashierName.trim()) return;
    const name = newCashierName.trim();
    await addCashierEmployee(db, name);
    setNewCashierName('');
    handleSelectCashier(name);
  };

  // 4. Handle Simpan Perubahan Modal Laci (Edit Modal)
  const handleSaveEditedDrawer = async () => {
    const cash = parseInt(drawerAmountStr.replace(/\D/g, ''), 10) || 0;
    try {
      await saveDailyDrawerAmount(db, cash);
      setIsEditingDrawer(false);
      Alert.alert('Sukses', `Modal kas laci diperbarui menjadi Rp ${cash.toLocaleString('id-ID')}`);
    } catch (e: any) {
      Alert.alert('Gagal', e?.message || 'Gagal menyimpan modal');
    }
  };

  // 5. Handle Tutup Shift & Z-Report
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
          {/* Header Modal */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemedText style={{ fontSize: 18 }}>
                {showCloseShift ? '🔒' : isDrawerSetToday ? '👤' : '🌅'}
              </ThemedText>
              <ThemedText type="subtitle" style={{ fontSize: 16 }}>
                {showCloseShift
                  ? 'Tutup Shift & Z-Report'
                  : isDrawerSetToday
                  ? 'Petugas Kasir & Shift Aktif'
                  : 'Buka Shift & Modal Laci Hari Ini'}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted, fontWeight: '700' }}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.tint} />
              <ThemedText style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                Memproses data shift...
              </ThemedText>
            </View>
          ) : showCloseShift ? (
            /* ========================================================= */
            /* VIEW 3: REKONSILIASI / TUTUP SHIFT (Z-REPORT)              */
            /* ========================================================= */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              <View style={styles.shiftInfoBadge}>
                <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>
                  Petugas Kasir: {currentShift?.cashier_name}
                </ThemedText>
                <ThemedText style={{ fontSize: 10.5, color: '#64748b' }}>
                  Mulai:{' '}
                  {currentShift
                    ? new Date(currentShift.opened_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}{' '}
                  • {currentShift ? new Date(currentShift.opened_at).toLocaleDateString('id-ID') : '-'}
                </ThemedText>
              </View>

              <View style={styles.detailBox}>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Modal Kas Awal</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    Rp {(currentShift?.starting_cash ?? 0).toLocaleString('id-ID')}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Penjualan Tunai (+)</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: Colors.success, fontWeight: '700' }]}>
                    Rp {(summary?.salesCash ?? 0).toLocaleString('id-ID')}
                  </ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Penjualan QRIS / Non-Tunai</ThemedText>
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

              <View style={styles.actionRow}>
                <Button
                  title="‹ Kembali"
                  variant="secondary"
                  size="sm"
                  onPress={() => setShowCloseShift(false)}
                />
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
          ) : !isDrawerSetToday ? (
            /* ========================================================= */
            /* VIEW 1: BUKA SHIFT PERTAMA HARI INI (MODAL AWAL 1X SEHARI)*/
            /* ========================================================= */
            <View style={{ gap: 12 }}>
              <View style={styles.bannerDayNotice}>
                <ThemedText style={{ fontSize: 12, color: '#0369a1', fontWeight: '600' }}>
                  💡 Modal awal diinput 1 kali per hari. Jika berganti kasir nanti, kasir cukup memilih namanya tanpa menghitung ulang kas laci.
                </ThemedText>
              </View>

              {/* Input Modal Awal Kas Laci */}
              <View style={{ gap: 4 }}>
                <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#334155' }}>
                  1. Modal Awal Kas di Laci Hari Ini:
                </ThemedText>
                <View style={styles.inputBox}>
                  <ThemedText style={styles.inputPrefix}>Rp</ThemedText>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    value={
                      drawerAmountStr ? parseInt(drawerAmountStr, 10).toLocaleString('id-ID') : ''
                    }
                    onChangeText={(text) => setDrawerAmountStr(text.replace(/\D/g, ''))}
                    placeholder="0"
                    placeholderTextColor={Colors.placeholder}
                  />
                </View>
              </View>

              {/* Preset Chips Modal */}
              <View style={styles.presetRow}>
                {[50000, 100000, 200000, 500000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.presetChip}
                    onPress={() => setDrawerAmountStr(amt.toString())}
                  >
                    <ThemedText style={styles.presetChipText}>
                      Rp {amt / 1000}rb
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pilih Nama Kasir */}
              <View style={{ gap: 6, marginTop: 4 }}>
                <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#334155' }}>
                  2. Pilih Karyawan Kasir yang Bertugas:
                </ThemedText>
                <View style={styles.cashierChipWrap}>
                  {cashierList.map((name) => {
                    const isSelected = selectedCashier === name;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[styles.cashierChip, isSelected && styles.cashierChipActive]}
                        onPress={() => setSelectedCashier(name)}
                      >
                        <ThemedText
                          style={[
                            styles.cashierChipText,
                            isSelected && styles.cashierChipTextActive,
                          ]}
                        >
                          👤 {name}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Input Kasir Baru jika belum terdaftar */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                  <TextInput
                    style={[styles.singleInput, { flex: 1, height: 36, fontSize: 12 }]}
                    value={newCashierName}
                    onChangeText={(t) => {
                      setNewCashierName(t);
                      setSelectedCashier(t);
                    }}
                    placeholder="+ Ketik nama kasir lain..."
                    placeholderTextColor={Colors.placeholder}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <Button title="Batal" variant="secondary" size="sm" onPress={onClose} />
                <Button
                  title="🚀 Mulai Shift Kasir"
                  size="sm"
                  onPress={handleStartTodayShift}
                />
              </View>
            </View>
          ) : (
            /* ========================================================= */
            /* VIEW 2: GANTI KASIR CEPAT (1-TAP) & KONTROL MODAL LACI    */
            /* ========================================================= */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {/* Active Cashier Banner */}
              <View style={styles.activeCashierCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={styles.activeCashierAvatar}>
                    <ThemedText style={{ fontSize: 20 }}>👤</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontSize: 10.5, color: '#64748b', fontWeight: '600' }}>
                      KASIR BERTUGAS SAAT INI
                    </ThemedText>
                    <ThemedText style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>
                      {currentShift?.cashier_name || 'Belum Ada Shift Aktif'}
                    </ThemedText>
                  </View>
                  <View style={styles.badgeOnline}>
                    <View style={styles.dotOnline} />
                    <ThemedText style={styles.badgeOnlineText}>Aktif</ThemedText>
                  </View>
                </View>
              </View>

              {/* Info Modal Laci Hari Ini + Tombol Edit Modal */}
              <View style={styles.drawerInfoCard}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontSize: 10.5, color: '#475569', fontWeight: '600' }}>
                    Modal Awal Laci Hari Ini
                  </ThemedText>
                  <ThemedText style={{ fontSize: 15, fontWeight: '800', color: '#0284c7', marginTop: 1 }}>
                    Rp {todayDrawerAmount.toLocaleString('id-ID')}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                    (Hanya diisi 1x sehari di awal operasional)
                  </ThemedText>
                </View>

                <TouchableOpacity
                  style={styles.btnEditDrawer}
                  onPress={() => {
                    setDrawerAmountStr(todayDrawerAmount.toString());
                    setIsEditingDrawer(!isEditingDrawer);
                  }}
                >
                  <ThemedText style={styles.btnEditDrawerText}>
                    {isEditingDrawer ? 'Batal' : '✏️ Edit Modal'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {/* Form Inline Edit Modal jika ditekan */}
              {isEditingDrawer && (
                <View style={styles.editDrawerBox}>
                  <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#0369a1' }}>
                    Koreksi Nominal Modal Kas Laci:
                  </ThemedText>
                  <View style={[styles.inputBox, { height: 38, borderColor: '#38bdf8' }]}>
                    <ThemedText style={styles.inputPrefix}>Rp</ThemedText>
                    <TextInput
                      style={[styles.textInput, { fontSize: 14 }]}
                      keyboardType="number-pad"
                      value={
                        drawerAmountStr ? parseInt(drawerAmountStr, 10).toLocaleString('id-ID') : ''
                      }
                      onChangeText={(t) => setDrawerAmountStr(t.replace(/\D/g, ''))}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>
                    <TouchableOpacity
                      style={[styles.btnSmall, { backgroundColor: '#f1f5f9' }]}
                      onPress={() => setIsEditingDrawer(false)}
                    >
                      <ThemedText style={{ fontSize: 11, color: '#475569' }}>Batal</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnSmall, { backgroundColor: Colors.tint }]}
                      onPress={handleSaveEditedDrawer}
                    >
                      <ThemedText style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>
                        Simpan Koreksi
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 1-Tap Cashier Switcher */}
              <View style={{ gap: 6 }}>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#1e293b' }}>
                  Ganti Petugas Kasir (1-Ketuk):
                </ThemedText>
                <ThemedText style={{ fontSize: 10.5, color: '#64748b' }}>
                  Ketuk salah satu nama kasir di bawah untuk langsung mengalihkan transaksi nota:
                </ThemedText>

                <View style={styles.cashierGrid}>
                  {cashierList.map((name) => {
                    const isCurrent = currentShift?.cashier_name === name;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[
                          styles.cashierSwitchBtn,
                          isCurrent && styles.cashierSwitchBtnCurrent,
                        ]}
                        onPress={() => handleSelectCashier(name)}
                        activeOpacity={0.75}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ThemedText style={{ fontSize: 14 }}>
                            {isCurrent ? '✅' : '👤'}
                          </ThemedText>
                          <ThemedText
                            style={[
                              styles.cashierSwitchName,
                              isCurrent && styles.cashierSwitchNameCurrent,
                            ]}
                            numberOfLines={1}
                          >
                            {name}
                          </ThemedText>
                        </View>
                        {isCurrent && (
                          <ThemedText style={{ fontSize: 9.5, fontWeight: '700', color: '#15803d' }}>
                            (Sedang Bertugas)
                          </ThemedText>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Input Tambah Kasir Baru */}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <TextInput
                    style={[styles.singleInput, { flex: 1, height: 38, fontSize: 12 }]}
                    value={newCashierName}
                    onChangeText={setNewCashierName}
                    placeholder="Nama staf kasir baru..."
                    placeholderTextColor={Colors.placeholder}
                  />
                  <TouchableOpacity
                    style={[
                      styles.btnSmall,
                      {
                        backgroundColor: newCashierName.trim() ? Colors.tint : '#cbd5e1',
                        paddingHorizontal: 12,
                      },
                    ]}
                    disabled={!newCashierName.trim()}
                    onPress={handleAddNewCashier}
                  >
                    <ThemedText style={{ fontSize: 11.5, color: '#fff', fontWeight: '700' }}>
                      + Tambah & Pilih
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Separator / Penutup Shift */}
              <View style={styles.footerShiftDivider} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity
                  style={styles.btnCloseShiftTrigger}
                  onPress={() => setShowCloseShift(true)}
                >
                  <ThemedText style={{ fontSize: 12 }}>🔒</ThemedText>
                  <ThemedText style={styles.btnCloseShiftTriggerText}>
                    Tutup Shift / Rekonsiliasi Z-Report
                  </ThemedText>
                </TouchableOpacity>

                <Button title="Selesai" size="sm" onPress={onClose} />
              </View>
            </ScrollView>
          )}
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
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  bannerDayNotice: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    padding: 10,
  },
  activeCashierCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
  },
  activeCashierAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOnline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dotOnline: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  badgeOnlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  drawerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
  },
  btnEditDrawer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  btnEditDrawerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  editDrawerBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  cashierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  cashierSwitchBtn: {
    minWidth: '47%',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cashierSwitchBtnCurrent: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
  },
  cashierSwitchName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  cashierSwitchNameCurrent: {
    color: '#15803d',
  },
  cashierChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cashierChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cashierChipActive: {
    backgroundColor: '#ede9fe',
    borderColor: Colors.tint,
  },
  cashierChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  cashierChipTextActive: {
    color: Colors.tintDark,
    fontWeight: '800',
  },
  footerShiftDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  btnCloseShiftTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  btnCloseShiftTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },
  btnSmall: {
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  shiftInfoBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  detailBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    marginTop: 2,
  },
  detailLabel: {
    fontSize: 11.5,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
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
