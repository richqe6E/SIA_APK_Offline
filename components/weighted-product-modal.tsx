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

interface WeightedProductModalProps {
  visible: boolean;
  onClose: () => void;
  productName: string;
  defaultPricePerKg: number;
  initialWeightGram?: number;
  initialPricePerKg?: number;
  isEditing?: boolean;
  onConfirm: (weightGram: number, pricePerKg: number) => void;
}

export function WeightedProductModal({
  visible,
  onClose,
  productName,
  defaultPricePerKg,
  initialWeightGram,
  initialPricePerKg,
  isEditing = false,
  onConfirm,
}: WeightedProductModalProps) {
  const [weightStr, setWeightStr] = useState('1000');
  const [priceStr, setPriceStr] = useState(formatRupiahInput(defaultPricePerKg));

  useEffect(() => {
    if (visible) {
      setWeightStr(initialWeightGram ? initialWeightGram.toString() : '1000');
      setPriceStr(formatRupiahInput(initialPricePerKg ?? defaultPricePerKg));
    }
  }, [visible, initialWeightGram, initialPricePerKg, defaultPricePerKg]);

  const weightNum = Math.max(0, parseFloat(weightStr) || 0);
  const priceNum = Math.max(0, parseRupiahInput(priceStr));
  const subtotal = Math.max(0, Math.round((weightNum / 1000) * priceNum));
  const kgFormatted = (weightNum / 1000).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });

  const presets = [
    { label: '100g', val: 100 },
    { label: '250g', val: 250 },
    { label: '500g (½ kg)', val: 500 },
    { label: '700g', val: 700 },
    { label: '1.000g (1 kg)', val: 1000 },
    { label: '2.000g (2 kg)', val: 2000 },
  ];

  const handleSave = () => {
    if (weightNum <= 0) return;
    onConfirm(weightNum, priceNum);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.overlay}>
        <Card style={styles.card} padding={22}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <ThemedText style={{ fontSize: 24 }}>⚖️</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.title}>
                {isEditing ? 'Ubah Timbangan Keranjang' : 'Input Timbangan Produk'}
              </ThemedText>
              <ThemedText style={styles.productName} numberOfLines={1}>
                {productName}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Form Input Berat */}
          <View style={styles.inputSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <ThemedText style={styles.label}>
                Berat Barang Timbangan (Gram)
              </ThemedText>
              <ThemedText style={styles.kgBadge}>
                = {kgFormatted} kg
              </ThemedText>
            </View>

            <TextInput
              style={styles.mainInput}
              placeholder="Contoh: 1000 untuk 1 kg, 700 untuk 700g"
              placeholderTextColor={Colors.disabled}
              keyboardType="numeric"
              value={weightStr}
              onChangeText={(t) => setWeightStr(t.replace(/[^0-9.]/g, ''))}
              autoFocus
            />

            {/* Tombol Preset Cepat */}
            <View style={styles.presetRow}>
              {presets.map((p) => (
                <TouchableOpacity
                  key={p.val}
                  style={[
                    styles.presetBtn,
                    weightNum === p.val && styles.presetBtnActive,
                  ]}
                  onPress={() => setWeightStr(p.val.toString())}
                >
                  <ThemedText
                    style={[
                      styles.presetBtnText,
                      weightNum === p.val && styles.presetBtnTextActive,
                    ]}
                  >
                    {p.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Form Input Harga per Kg */}
          <View style={styles.inputSection}>
            <ThemedText style={styles.label}>
              Harga Jual per Kg (Rp)
            </ThemedText>
            <TextInput
              style={styles.priceInput}
              placeholder="Harga per 1.000 gram"
              placeholderTextColor={Colors.disabled}
              keyboardType="numeric"
              value={priceStr}
              onChangeText={(text) => setPriceStr(formatRupiahInput(text))}
            />
          </View>

          {/* Box Kalkulasi Subtotal */}
          <View style={styles.subtotalBox}>
            <View>
              <ThemedText style={{ fontSize: 11, color: '#475569', fontWeight: '700' }}>
                TOTAL SUBTAGIHAN
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                {kgFormatted} kg × Rp {Math.round(priceNum).toLocaleString('id-ID')}
              </ThemedText>
            </View>
            <ThemedText style={styles.subtotalValue}>
              Rp {subtotal.toLocaleString('id-ID')}
            </ThemedText>
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Button
              title="Batal"
              variant="outline"
              style={{ flex: 1 }}
              onPress={onClose}
            />
            <Button
              title={isEditing ? 'Simpan Perubahan' : 'Masukkan Keranjang'}
              style={{ flex: 1.5, backgroundColor: Colors.tintDark }}
              disabled={weightNum <= 0}
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
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
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
  inputSection: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  kgBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
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
    marginTop: 4,
  },
  priceInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 4,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  presetBtnText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  presetBtnTextActive: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  subtotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  subtotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#15803d',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
