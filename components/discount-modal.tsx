import React, { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';
import type { TransactionDiscount } from '@/stores/transactionStore';
import { formatRupiahInput, parseRupiahInput } from '@/utils/formatRupiah';

interface DiscountModalProps {
  visible: boolean;
  subtotal: number;
  currentDiscount: TransactionDiscount | null;
  onClose: () => void;
  onApplyDiscount: (value: number, type: 'nominal' | 'percent') => void;
  onClearDiscount: () => void;
}

export function DiscountModal({
  visible,
  subtotal,
  currentDiscount,
  onClose,
  onApplyDiscount,
  onClearDiscount,
}: DiscountModalProps) {
  const [discountType, setDiscountType] = useState<'nominal' | 'percent'>('nominal');
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (visible) {
      if (currentDiscount) {
        setDiscountType(currentDiscount.type);
        setInputValue(
          currentDiscount.type === 'percent'
            ? currentDiscount.value.toString()
            : formatRupiahInput(currentDiscount.value),
        );
      } else {
        setDiscountType('nominal');
        setInputValue('');
      }
    }
  }, [visible, currentDiscount]);

  const numValue = parseRupiahInput(inputValue);
  const calculatedDiscount =
    discountType === 'percent'
      ? Math.round((subtotal * Math.min(100, numValue)) / 100)
      : Math.min(subtotal, numValue);

  const percentPresets = [5, 10, 15, 20, 50];
  const nominalPresets = [2000, 5000, 10000, 20000, 50000];

  const handleApply = () => {
    if (discountType === 'percent' && numValue > 100) {
      Alert.alert('Diskon Melebihi Batas', 'Diskon persentase tidak boleh lebih dari 100%.');
      return;
    }
    if (discountType === 'nominal' && numValue > subtotal) {
      Alert.alert(
        'Diskon Melebihi Subtotal',
        `Diskon nominal (Rp ${numValue.toLocaleString('id-ID')}) tidak boleh lebih besar dari total belanja (Rp ${subtotal.toLocaleString('id-ID')}).`
      );
      return;
    }
    if (numValue <= 0) {
      onClearDiscount();
    } else {
      onApplyDiscount(numValue, discountType);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ThemedView style={styles.card}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ fontSize: 16 }}>
              🏷️ Diskon Transaksi
            </ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <ThemedText style={{ fontSize: 16, color: Colors.muted, fontWeight: '700' }}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Type Switcher Tab */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, discountType === 'nominal' && styles.tabBtnActive]}
              onPress={() => setDiscountType('nominal')}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[styles.tabBtnText, discountType === 'nominal' && styles.tabBtnTextActive]}
              >
                Nominal (Rp)
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, discountType === 'percent' && styles.tabBtnActive]}
              onPress={() => setDiscountType('percent')}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[styles.tabBtnText, discountType === 'percent' && styles.tabBtnTextActive]}
              >
                Persen (%)
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Quick Presets */}
          <View style={styles.presetRow}>
            {discountType === 'percent'
              ? percentPresets.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.presetChip, numValue === p && styles.presetChipActive]}
                    onPress={() => setInputValue(p.toString())}
                  >
                    <ThemedText
                      style={[styles.presetChipText, numValue === p && styles.presetChipTextActive]}
                    >
                      {p}%
                    </ThemedText>
                  </TouchableOpacity>
                ))
              : nominalPresets.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.presetChip, numValue === n && styles.presetChipActive]}
                    onPress={() => setInputValue(formatRupiahInput(n))}
                  >
                    <ThemedText
                      style={[styles.presetChipText, numValue === n && styles.presetChipTextActive]}
                    >
                      {n >= 1000 ? `${n / 1000}rb` : n}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
          </View>

          {/* Value Input */}
          <View style={styles.inputBox}>
            <ThemedText style={styles.inputPrefix}>
              {discountType === 'nominal' ? 'Rp' : '%'}
            </ThemedText>
            <TextInput
              style={styles.textInput}
              keyboardType="number-pad"
              value={inputValue}
              onChangeText={(text) => {
                if (discountType === 'nominal') {
                  setInputValue(formatRupiahInput(text));
                } else {
                  setInputValue(text.replace(/\D/g, ''));
                }
              }}
              placeholder={discountType === 'nominal' ? '0' : '0 - 100'}
              placeholderTextColor={Colors.placeholder}
              autoFocus
            />
          </View>

          {/* Calculation Summary */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.summaryLabel}>Subtotal</ThemedText>
              <ThemedText style={styles.summaryValue}>
                Rp {subtotal.toLocaleString('id-ID')}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: Colors.tint }]}>
                Potongan Diskon
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { color: Colors.tint, fontWeight: '700' }]}>
                - Rp {calculatedDiscount.toLocaleString('id-ID')}
              </ThemedText>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 13 }}>
                Total Akhir
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15, color: Colors.tint }}>
                Rp {Math.max(0, subtotal - calculatedDiscount).toLocaleString('id-ID')}
              </ThemedText>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {currentDiscount && (
              <Button
                title="Hapus Diskon"
                variant="outline"
                size="sm"
                onPress={() => {
                  onClearDiscount();
                  onClose();
                }}
              />
            )}
            <View style={{ flex: 1 }} />
            <Button title="Batal" variant="secondary" size="sm" onPress={onClose} />
            <Button title="Terapkan" size="sm" onPress={handleApply} />
          </View>
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
    maxWidth: 420,
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: Colors.tint,
    fontWeight: '700',
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
  presetChipActive: {
    backgroundColor: '#f3e8ff',
    borderColor: Colors.tint,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: Colors.tint,
    fontWeight: '700',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.tint,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    height: 44,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.tint,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    paddingVertical: 0,
  },
  summaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11.5,
    color: '#64748b',
  },
  summaryValue: {
    fontSize: 11.5,
    color: '#1e293b',
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
});
