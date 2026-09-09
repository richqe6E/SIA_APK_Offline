import React, { useEffect, useState } from 'react';
import {
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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';

interface DenominationDef {
  value: number;
  label: string;
  type: 'kertas' | 'koin';
  color: string;
  badgeBg: string;
}

const DENOMINATIONS: DenominationDef[] = [
  // Uang Kertas
  { value: 100000, label: 'Rp 100.000', type: 'kertas', color: '#be123c', badgeBg: '#ffe4e6' },
  { value: 50000, label: 'Rp 50.000', type: 'kertas', color: '#1d4ed8', badgeBg: '#dbeafe' },
  { value: 20000, label: 'Rp 20.000', type: 'kertas', color: '#047857', badgeBg: '#d1fae5' },
  { value: 10000, label: 'Rp 10.000', type: 'kertas', color: '#6d28d9', badgeBg: '#ede9fe' },
  { value: 5000, label: 'Rp 5.000', type: 'kertas', color: '#b45309', badgeBg: '#fef3c7' },
  { value: 2000, label: 'Rp 2.000', type: 'kertas', color: '#0f766e', badgeBg: '#ccfbf1' },
  { value: 1000, label: 'Rp 1.000', type: 'kertas', color: '#475569', badgeBg: '#f1f5f9' },
  // Uang Logam (Koin)
  { value: 1000, label: 'Rp 1.000 (Koin)', type: 'koin', color: '#a16207', badgeBg: '#fef9c3' },
  { value: 500, label: 'Rp 500', type: 'koin', color: '#475569', badgeBg: '#f1f5f9' },
  { value: 200, label: 'Rp 200', type: 'koin', color: '#475569', badgeBg: '#f1f5f9' },
  { value: 100, label: 'Rp 100', type: 'koin', color: '#475569', badgeBg: '#f1f5f9' },
];

function formatRupiah(n: number) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

interface CashDenominationModalProps {
  visible: boolean;
  onClose: () => void;
  currentHandBalance: number;
  initialCounts?: Record<number, number> | null;
  onSave: (counts: Record<number, number>) => Promise<void>;
}

export function CashDenominationModal({
  visible,
  onClose,
  currentHandBalance,
  initialCounts,
  onSave,
}: CashDenominationModalProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Inisialisasi hitungan dari data tersimpan atau kosong
  useEffect(() => {
    if (visible) {
      const initial: Record<string, number> = {};
      DENOMINATIONS.forEach((d, idx) => {
        const key = `${d.value}_${d.type}_${idx}`;
        const prevCount = initialCounts ? initialCounts[d.value] || 0 : 0;
        initial[key] = prevCount;
      });

      // Jika initialCounts berupa Record<number, number>, petakan sesuai kunci
      if (initialCounts) {
        DENOMINATIONS.forEach((d, idx) => {
          const key = `${d.value}_${d.type}_${idx}`;
          // Jika ada hitungan khusus per kunci atau per nilai
          const countVal = (initialCounts as any)[key] ?? (initialCounts as any)[d.value] ?? 0;
          initial[key] = countVal;
        });
      }
      setCounts(initial);
    }
  }, [visible, initialCounts]);

  const updateCount = (key: string, delta: number) => {
    setCounts((prev) => {
      const current = prev[key] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [key]: next };
    });
  };

  const setCountDirect = (key: string, text: string) => {
    const clean = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
    setCounts((prev) => ({ ...prev, [key]: clean }));
  };

  const resetAll = () => {
    const empty: Record<string, number> = {};
    DENOMINATIONS.forEach((d, idx) => {
      empty[`${d.value}_${d.type}_${idx}`] = 0;
    });
    setCounts(empty);
  };

  // Hitung total fisik yang dihitung
  let totalCalculated = 0;
  let totalSheets = 0;
  DENOMINATIONS.forEach((d, idx) => {
    const key = `${d.value}_${d.type}_${idx}`;
    const count = counts[key] || 0;
    totalCalculated += d.value * count;
    totalSheets += count;
  });

  const diff = totalCalculated - currentHandBalance;
  const isMatch = diff === 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Simpan format terstruktur { [denom]: count }
      const toSave: Record<number, number> = {};
      DENOMINATIONS.forEach((d, idx) => {
        const key = `${d.value}_${d.type}_${idx}`;
        const count = counts[key] || 0;
        if (toSave[d.value] !== undefined) {
          toSave[d.value] += count;
        } else {
          toSave[d.value] = count;
        }
      });
      await onSave(toSave);
      onClose();
    } catch {
      // error handled
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.modalOverlay}>
        <Card style={styles.modalCard} padding={20}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="subtitle" style={{ fontSize: 16 }}>
                💵 Rincian Pecahan Kas Fisik
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                Hitung uang kertas & logam untuk mencocokkan fisik di laci kasir
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
            </Pressable>
          </View>

          {/* Banner Komparasi Realtime (Total Fisik vs Saldo Sistem) */}
          <View style={styles.comparisonBanner}>
            <View style={styles.comparisonCol}>
              <ThemedText style={styles.comparisonLabel}>Fisik Dihitung</ThemedText>
              <ThemedText style={styles.comparisonVal}>{formatRupiah(totalCalculated)}</ThemedText>
              <ThemedText style={styles.comparisonSub}>{totalSheets} lembar/keping</ThemedText>
            </View>

            <View style={styles.comparisonDivider} />

            <View style={styles.comparisonCol}>
              <ThemedText style={styles.comparisonLabel}>Kas Sistem di Tangan</ThemedText>
              <ThemedText style={[styles.comparisonVal, { color: Colors.tintDark }]}>
                {formatRupiah(currentHandBalance)}
              </ThemedText>
              <ThemedText style={styles.comparisonSub}>Buku Kas Laci</ThemedText>
            </View>

            <View style={styles.comparisonDivider} />

            <View style={styles.comparisonCol}>
              <ThemedText style={styles.comparisonLabel}>Status Rekonsiliasi</ThemedText>
              <View
                style={[
                  styles.statusBadge,
                  isMatch ? styles.statusMatch : diff > 0 ? styles.statusSurplus : styles.statusDeficit,
                ]}
              >
                <ThemedText
                  style={[
                    styles.statusBadgeText,
                    isMatch
                      ? styles.statusMatchText
                      : diff > 0
                      ? styles.statusSurplusText
                      : styles.statusDeficitText,
                  ]}
                >
                  {isMatch
                    ? '✓ Cocok (Rp 0)'
                    : diff > 0
                    ? `+ Surplus ${formatRupiah(diff)}`
                    : `- Kurang ${formatRupiah(Math.abs(diff))}`}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Daftar Pecahan Uang */}
          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {/* Bagian Uang Kertas */}
            <ThemedText style={styles.sectionHeader}>💵 Uang Kertas</ThemedText>
            {DENOMINATIONS.filter((d) => d.type === 'kertas').map((denom, idx) => {
              const key = `${denom.value}_${denom.type}_${idx}`;
              const count = counts[key] || 0;
              const subtotal = denom.value * count;
              return (
                <View key={key} style={styles.denomRow}>
                  {/* Badge Pecahan */}
                  <View style={[styles.denomBadge, { backgroundColor: denom.badgeBg }]}>
                    <ThemedText style={[styles.denomBadgeText, { color: denom.color }]}>
                      {denom.label}
                    </ThemedText>
                  </View>

                  {/* Input Lembar */}
                  <View style={styles.controlsWrapper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => updateCount(key, -1)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.stepBtnText}>−</ThemedText>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.countInput}
                      keyboardType="numeric"
                      value={count > 0 ? count.toString() : ''}
                      placeholder="0"
                      placeholderTextColor={Colors.disabled}
                      onChangeText={(t) => setCountDirect(key, t)}
                    />

                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => updateCount(key, 1)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.stepBtnText}>+</ThemedText>
                    </TouchableOpacity>

                    {/* Tombol Cepat +5 */}
                    <TouchableOpacity
                      style={styles.quickStepBtn}
                      onPress={() => updateCount(key, 5)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.quickStepBtnText}>+5</ThemedText>
                    </TouchableOpacity>
                  </View>

                  {/* Subtotal */}
                  <View style={styles.subtotalWrapper}>
                    <ThemedText
                      style={[
                        styles.subtotalText,
                        count > 0 && { color: Colors.tintDark, fontWeight: '800' },
                      ]}
                    >
                      {formatRupiah(subtotal)}
                    </ThemedText>
                  </View>
                </View>
              );
            })}

            {/* Bagian Uang Logam (Koin) */}
            <ThemedText style={[styles.sectionHeader, { marginTop: 14 }]}>
              🪙 Uang Logam (Koin)
            </ThemedText>
            {DENOMINATIONS.filter((d) => d.type === 'koin').map((denom, idx) => {
              const actualIdx = idx + 7;
              const key = `${denom.value}_${denom.type}_${actualIdx}`;
              const count = counts[key] || 0;
              const subtotal = denom.value * count;
              return (
                <View key={key} style={styles.denomRow}>
                  {/* Badge Pecahan */}
                  <View style={[styles.denomBadge, { backgroundColor: denom.badgeBg }]}>
                    <ThemedText style={[styles.denomBadgeText, { color: denom.color }]}>
                      {denom.label}
                    </ThemedText>
                  </View>

                  {/* Input Keping */}
                  <View style={styles.controlsWrapper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => updateCount(key, -1)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.stepBtnText}>−</ThemedText>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.countInput}
                      keyboardType="numeric"
                      value={count > 0 ? count.toString() : ''}
                      placeholder="0"
                      placeholderTextColor={Colors.disabled}
                      onChangeText={(t) => setCountDirect(key, t)}
                    />

                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => updateCount(key, 1)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.stepBtnText}>+</ThemedText>
                    </TouchableOpacity>

                    {/* Tombol Cepat +5 */}
                    <TouchableOpacity
                      style={styles.quickStepBtn}
                      onPress={() => updateCount(key, 5)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.quickStepBtnText}>+5</ThemedText>
                    </TouchableOpacity>
                  </View>

                  {/* Subtotal */}
                  <View style={styles.subtotalWrapper}>
                    <ThemedText
                      style={[
                        styles.subtotalText,
                        count > 0 && { color: Colors.tintDark, fontWeight: '800' },
                      ]}
                    >
                      {formatRupiah(subtotal)}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={resetAll} activeOpacity={0.7}>
              <ThemedText style={styles.resetBtnText}>🔄 Kosongkan</ThemedText>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Batal" variant="outline" size="sm" onPress={onClose} />
              <Button
                title={saving ? 'Menyimpan...' : 'Simpan Pecahan'}
                size="sm"
                disabled={saving}
                onPress={handleSave}
              />
            </View>
          </View>
        </Card>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: {
    padding: 4,
  },
  comparisonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 10,
    marginVertical: 12,
  },
  comparisonCol: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#e2e8f0',
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  comparisonVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 1,
  },
  comparisonSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  statusMatch: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  statusSurplus: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  statusDeficit: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusMatchText: {
    color: '#15803d',
  },
  statusSurplusText: {
    color: '#1d4ed8',
  },
  statusDeficitText: {
    color: '#b91c1c',
  },
  scrollList: {
    maxHeight: 360,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  denomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    gap: 8,
  },
  denomBadge: {
    width: 110,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  denomBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  controlsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  quickStepBtn: {
    paddingHorizontal: 6,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStepBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tintDark,
  },
  countInput: {
    width: 44,
    height: 28,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 0,
  },
  subtotalWrapper: {
    width: 95,
    alignItems: 'flex-end',
  },
  subtotalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
});
