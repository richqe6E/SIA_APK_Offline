import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';

interface BulkQtyModalProps {
  visible: boolean;
  onClose: () => void;
  productName: string;
  productPrice: number;
  currentQty: number;
  maxStock?: number;
  hasStock?: boolean;
  onSaveQty: (newQty: number) => void;
}

export function BulkQtyModal({
  visible,
  onClose,
  productName,
  productPrice,
  currentQty,
  maxStock,
  hasStock,
  onSaveQty,
}: BulkQtyModalProps) {
  const [qtyInput, setQtyInput] = useState(currentQty.toString());

  useEffect(() => {
    if (visible) {
      setQtyInput(currentQty.toString());
    }
  }, [visible, currentQty]);

  const parsedQty = parseInt(qtyInput.replace(/[^0-9]/g, ''), 10) || 0;
  const subtotal = parsedQty * productPrice;

  const handleApply = () => {
    if (parsedQty <= 0) {
      Alert.alert('Perhatian', 'Jumlah produk harus lebih dari 0. Untuk menghapus item, gunakan ikon tempat sampah di keranjang.');
      return;
    }
    if (hasStock && maxStock !== undefined && parsedQty > maxStock) {
      Alert.alert(
        'Stok Tidak Cukup',
        `Stok '${productName}' hanya tersedia ${maxStock} pcs. Tidak dapat memasukkan ${parsedQty} pcs.`
      );
      return;
    }
    onSaveQty(parsedQty);
    onClose();
  };

  const addQty = (amount: number) => {
    const next = parsedQty + amount;
    if (hasStock && maxStock !== undefined && next > maxStock) {
      setQtyInput(maxStock.toString());
    } else {
      setQtyInput(next.toString());
    }
  };

  const setExactQty = (amount: number) => {
    if (hasStock && maxStock !== undefined && amount > maxStock) {
      setQtyInput(maxStock.toString());
    } else {
      setQtyInput(amount.toString());
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ThemedView style={styles.overlay}>
        <Card style={styles.modalCard} padding={20}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                Ubah Jumlah Produk
              </ThemedText>
              <ThemedText numberOfLines={1} style={{ fontSize: 12, color: Colors.muted, marginTop: 2 }}>
                {productName}
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={styles.closeIconBtn}>
              <ThemedText style={{ fontSize: 16, color: Colors.muted }}>✕</ThemedText>
            </Pressable>
          </View>

          {/* Info Harga & Stok */}
          <View style={styles.infoRow}>
            <ThemedText style={{ fontSize: 12, color: '#64748b' }}>
              Harga Satuan: <strong>Rp {productPrice.toLocaleString('id-ID')}</strong>
            </ThemedText>
            {hasStock && maxStock !== undefined && (
              <ThemedText style={{ fontSize: 11, color: maxStock < 5 ? Colors.danger : Colors.tint, fontWeight: '600' }}>
                Stok Tersedia: {maxStock} pcs
              </ThemedText>
            )}
          </View>

          {/* Direct Qty Input */}
          <View style={styles.inputContainer}>
            <Pressable
              style={[styles.stepBtn, parsedQty <= 1 && styles.stepBtnDisabled]}
              onPress={() => parsedQty > 1 && setQtyInput((parsedQty - 1).toString())}
              disabled={parsedQty <= 1}
            >
              <ThemedText style={styles.stepBtnText}>-</ThemedText>
            </Pressable>

            <TextInput
              style={styles.qtyTextInput}
              value={qtyInput}
              onChangeText={setQtyInput}
              keyboardType="number-pad"
              selectTextOnFocus
              textAlign="center"
              maxLength={5}
            />

            <Pressable
              style={styles.stepBtn}
              onPress={() => addQty(1)}
            >
              <ThemedText style={styles.stepBtnText}>+</ThemedText>
            </Pressable>
          </View>

          {/* Quick Add Chips (+5, +10, +25, +50, +100) */}
          <ThemedText style={styles.sectionTitle}>Tambah Cepat (Qty Tambahan):</ThemedText>
          <View style={styles.chipRow}>
            {[5, 10, 25, 50, 100].map((amt) => (
              <Pressable
                key={amt}
                style={styles.quickAddChip}
                onPress={() => addQty(amt)}
              >
                <ThemedText style={styles.quickAddChipText}>+{amt}</ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Direct Set Chips (Pilih Jumlah Pasti) */}
          <ThemedText style={[styles.sectionTitle, { marginTop: 8 }]}>Atau Pilih Jumlah Langsung:</ThemedText>
          <View style={styles.chipRow}>
            {[1, 6, 12, 24, 48].map((amt) => (
              <Pressable
                key={amt}
                style={[styles.presetChip, parsedQty === amt && styles.presetChipActive]}
                onPress={() => setExactQty(amt)}
              >
                <ThemedText
                  style={[
                    styles.presetChipText,
                    parsedQty === amt && styles.presetChipTextActive,
                  ]}
                >
                  {amt} pcs
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Subtotal Calculation Box */}
          <View style={styles.subtotalBox}>
            <ThemedText style={{ fontSize: 12, color: '#475569' }}>Subtotal ({parsedQty} item):</ThemedText>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: Colors.tint }}>
              Rp {subtotal.toLocaleString('id-ID')}
            </ThemedText>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button
              title="Batal"
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={onClose}
            />
            <Button
              title="Terapkan Jumlah"
              size="sm"
              style={{ flex: 1.4 }}
              onPress={handleApply}
            />
          </View>
        </Card>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  closeIconBtn: {
    padding: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 6,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepBtnText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  qtyTextInput: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.tint,
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    backgroundColor: '#faf5ff',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickAddChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  quickAddChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  presetChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  subtotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
