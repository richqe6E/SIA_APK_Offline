import React, { useState, useEffect } from 'react';
import {
  Modal,
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
import { formatRupiahInput, parseRupiahInput } from '@/utils/formatRupiah';

interface EditCartPriceModalProps {
  visible: boolean;
  onClose: () => void;
  productName: string;
  currentPrice: number;
  quantity: number;
  isWeighted?: boolean;
  weightGram?: number;
  onSavePrice: (newPrice: number) => void;
}

export function EditCartPriceModal({
  visible,
  onClose,
  productName,
  currentPrice,
  quantity,
  isWeighted = false,
  weightGram = 1000,
  onSavePrice,
}: EditCartPriceModalProps) {
  const [priceStr, setPriceStr] = useState('');

  useEffect(() => {
    if (visible) {
      setPriceStr(formatRupiahInput(currentPrice));
    }
  }, [visible, currentPrice]);

  const parsedPrice = parseRupiahInput(priceStr);
  const newSubtotal = isWeighted
    ? Math.round((weightGram / 1000) * parsedPrice)
    : quantity * parsedPrice;

  const handleSave = () => {
    if (parsedPrice < 0) return;
    onSavePrice(parsedPrice);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.overlay}>
        <Card style={styles.card} padding={22}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <ThemedText style={{ fontSize: 22 }}>🏷️</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.title}>Ubah Harga Khusus Keranjang</ThemedText>
              <ThemedText style={styles.productName} numberOfLines={1}>
                {productName}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Info Notice */}
          <View style={styles.noticeBox}>
            <ThemedText style={styles.noticeText}>
              💡 Harga baru ini hanya berlaku khusus transaksi saat ini dan tidak mengubah harga master di katalog produk.
            </ThemedText>
          </View>

          {/* Form Input Harga Baru */}
          <View style={styles.inputSection}>
            <ThemedText style={styles.label}>
              {isWeighted ? 'Harga Jual per Kg Baru (Rp)' : 'Harga Jual Satuan Baru (Rp)'}
            </ThemedText>
            <TextInput
              style={styles.mainInput}
              placeholder="Masukkan harga baru..."
              placeholderTextColor={Colors.disabled}
              keyboardType="numeric"
              value={priceStr}
              onChangeText={(text) => setPriceStr(formatRupiahInput(text))}
              autoFocus
            />
          </View>

          {/* Subtotal Preview */}
          <View style={styles.subtotalBox}>
            <View>
              <ThemedText style={{ fontSize: 11, color: '#475569', fontWeight: '700' }}>
                SUBTOTAL BARU KERANJANG
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                {isWeighted
                  ? `${(weightGram / 1000).toFixed(2)} kg × Rp ${parsedPrice.toLocaleString('id-ID')}`
                  : `${quantity} pcs × Rp ${parsedPrice.toLocaleString('id-ID')}`}
              </ThemedText>
            </View>
            <ThemedText style={styles.subtotalValue}>
              Rp {newSubtotal.toLocaleString('id-ID')}
            </ThemedText>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Button
              title="Batal"
              variant="outline"
              style={{ flex: 1 }}
              onPress={onClose}
            />
            <Button
              title="Terapkan Harga"
              style={{ flex: 1.5, backgroundColor: Colors.tintDark }}
              onPress={handleSave}
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  productName: {
    fontSize: 13,
    color: Colors.tintDark,
    fontWeight: '700',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  noticeBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  noticeText: {
    fontSize: 11,
    color: '#92400e',
    lineHeight: 16,
  },
  inputSection: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  mainInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  subtotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.tintDark,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
