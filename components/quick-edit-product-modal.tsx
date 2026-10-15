import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';
import type { Product } from '@/stores/productStore';
import { BarcodeScannerModal } from '@/components/barcode-scanner-modal';
import { CustomDatePickerModal } from '@/components/custom-date-picker-modal';

interface QuickEditProductModalProps {
  visible: boolean;
  product: Product | null;
  categories: { id: number; name: string }[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    price: number;
    cost_price: number;
    has_stock: boolean;
    stock: number;
    barcode: string;
    barcodes: string[];
    is_weighted: number;
    expired_date: string | null;
    category_id: number | null;
  }) => Promise<void>;
}

export function QuickEditProductModal({
  visible,
  product,
  categories,
  onClose,
  onSave,
}: QuickEditProductModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [hasStock, setHasStock] = useState(true);
  const [stock, setStock] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [barcodesList, setBarcodesList] = useState<string[]>(['', '', '']);
  const [isWeighted, setIsWeighted] = useState(false);
  const [expiredDate, setExpiredDate] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerTargetIndex, setScannerTargetIndex] = useState<number>(0);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setPrice(product.price ? product.price.toString() : '');
      setCostPrice(product.cost_price > 0 ? product.cost_price.toString() : '');
      setHasStock(product.has_stock === 1);
      setStock(product.has_stock === 1 ? (product.stock ?? 0).toString() : '');
      setBarcode(product.barcode || '');

      let bList: string[] = [];
      if (product.barcodes) {
        try {
          const parsed = JSON.parse(product.barcodes);
          if (Array.isArray(parsed)) bList = parsed;
        } catch {
          bList = product.barcodes.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      if (product.barcode && !bList.includes(product.barcode)) {
        bList = [product.barcode, ...bList];
      }
      while (bList.length < 3) {
        bList.push('');
      }
      setBarcodesList(bList);
      setIsWeighted(product.is_weighted === 1);
      setExpiredDate(product.expired_date || '');
      setSelectedCategoryId(product.category_id || null);
    }
  }, [product]);

  if (!product) return null;

  const handleBarcodeScanned = (scannedCode: string) => {
    setBarcodesList((prev) => {
      const next = [...prev];
      next[scannerTargetIndex] = scannedCode;
      return next;
    });
    if (scannerTargetIndex === 0) {
      setBarcode(scannedCode);
    }
    setScannerVisible(false);
  };

  const handleSave = async () => {
    const cleanName = name.trim();
    if (!cleanName || !price.trim()) {
      Alert.alert('Error', 'Nama dan harga wajib diisi');
      return;
    }

    const priceNum = parseFloat(price.replace(/[^0-9]/g, ''));
    const costPriceNum = costPrice ? parseFloat(costPrice.replace(/[^0-9]/g, '')) : 0;
    const stockNum = stock ? parseInt(stock.replace(/[^0-9-]/g, ''), 10) : 0;

    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Error', 'Harga tidak valid');
      return;
    }

    const cleanBarcodes = barcodesList.map((b) => b.trim()).filter((b) => b.length > 0);
    const primaryBarcode = cleanBarcodes[0] || barcode.trim();

    setSaving(true);
    try {
      await onSave({
        name: cleanName,
        price: priceNum,
        cost_price: costPriceNum,
        has_stock: hasStock,
        stock: hasStock ? stockNum : 0,
        barcode: primaryBarcode,
        barcodes: cleanBarcodes,
        is_weighted: isWeighted ? 1 : 0,
        expired_date: expiredDate.trim() || null,
        category_id: selectedCategoryId,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Gagal menyimpan perubahan produk');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ThemedView style={styles.modalOverlay}>
        <Card style={styles.modalContent} padding={24}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Edit Produk</ThemedText>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            {/* Nama Produk */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Nama Produk</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="cth: Kopi Bubuk 250g"
                placeholderTextColor={Colors.disabled}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Multi-Barcode / SKU */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <ThemedText style={styles.label}>Barcode / SKU Produk</ThemedText>
                <TouchableOpacity
                  onPress={() => setBarcodesList((prev) => [...prev, ''])}
                  style={styles.addBarcodeSmallBtn}
                >
                  <ThemedText style={styles.addBarcodeSmallText}>+ Tambah Barcode</ThemedText>
                </TouchableOpacity>
              </View>
              <ThemedText style={{ fontSize: 11, color: Colors.muted, marginBottom: 8 }}>
                Mendukung multi-barcode (misal kemasan lama & baru). Semua barcode dapat discan di kasir.
              </ThemedText>

              {barcodesList.map((codeVal, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <ThemedText style={{ fontSize: 11, color: '#64748b', fontWeight: '700', width: 22 }}>
                    #{idx + 1}
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={`Barcode ke-${idx + 1} (cth: 899...)`}
                    placeholderTextColor={Colors.disabled}
                    value={codeVal}
                    onChangeText={(val) => {
                      setBarcodesList((prev) => {
                        const next = [...prev];
                        next[idx] = val;
                        return next;
                      });
                      if (idx === 0) setBarcode(val);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.scanBtnInline}
                    onPress={() => {
                      setScannerTargetIndex(idx);
                      setScannerVisible(true);
                    }}
                  >
                    <ThemedText style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
                      📷 Scan
                    </ThemedText>
                  </TouchableOpacity>
                  {idx >= 3 && (
                    <TouchableOpacity
                      style={styles.removeBarcodeBtn}
                      onPress={() => {
                        setBarcodesList((prev) => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      <ThemedText style={{ color: Colors.danger, fontSize: 13, fontWeight: '700' }}>✕</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Opsi Tipe Produk: Biasa vs Timbangan */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Jenis Satuan Produk</ThemedText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={[
                    styles.stockToggleBtn,
                    !isWeighted && styles.stockToggleBtnActive,
                  ]}
                  onPress={() => setIsWeighted(false)}
                >
                  <ThemedText
                    style={[
                      styles.stockToggleText,
                      !isWeighted && styles.stockToggleTextActive,
                    ]}
                  >
                    📦 Satuan Biasa (Pcs)
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.stockToggleBtn,
                    isWeighted && { backgroundColor: '#e0e7ff', borderColor: '#4f46e5' },
                  ]}
                  onPress={() => setIsWeighted(true)}
                >
                  <ThemedText
                    style={[
                      styles.stockToggleText,
                      isWeighted && { color: '#3730a3', fontWeight: '800' },
                    ]}
                  >
                    ⚖️ Produk Timbangan (Gram / Kg)
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Harga Jual */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>
                {isWeighted ? 'Harga Jual per Kg (Rp/kg)' : 'Harga Jual Satuan (Rp)'}
              </ThemedText>
              <TextInput
                style={styles.input}
                placeholder={isWeighted ? 'cth: 40000 (Harga per 1000 gram)' : 'cth: 15000'}
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>

            {/* Tanggal Kedaluwarsa (Expired Date) Opsional */}
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <ThemedText style={styles.label}>Tanggal Kedaluwarsa / Expired (Opsional)</ThemedText>
                {expiredDate ? (
                  <TouchableOpacity onPress={() => setExpiredDate('')}>
                    <ThemedText style={{ fontSize: 11, color: Colors.danger, fontWeight: '700' }}>
                      Hapus Tanggal ✕
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={[
                  styles.dateSelectBtn,
                  expiredDate ? styles.dateSelectBtnActive : null,
                ]}
                onPress={() => setDatePickerVisible(true)}
              >
                <ThemedText style={{ fontSize: 16 }}>📅</ThemedText>
                <ThemedText
                  style={[
                    styles.dateSelectBtnText,
                    expiredDate ? { color: Colors.tintDark, fontWeight: '700' } : null,
                  ]}
                >
                  {expiredDate ? `Kedaluwarsa: ${expiredDate}` : 'Pilih Tanggal Kedaluwarsa Produk...'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Harga Modal / Beli (HPP) */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Harga Modal / Beli (HPP) (Rp)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="cth: 10000 (untuk hitung laba riil)"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                value={costPrice}
                onChangeText={setCostPrice}
              />
            </View>

            {/* Kelola Stok Fisik */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Kelola Stok Fisik</ThemedText>
              <View style={styles.stockToggleRow}>
                <Pressable
                  style={[styles.stockToggleBtn, hasStock && styles.stockToggleBtnActive]}
                  onPress={() => setHasStock(true)}
                >
                  <ThemedText
                    style={[
                      styles.stockToggleText,
                      hasStock && styles.stockToggleTextActive,
                    ]}
                  >
                    Memiliki Stok
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.stockToggleBtn, !hasStock && styles.stockToggleBtnActive]}
                  onPress={() => {
                    setHasStock(false);
                    setStock('');
                  }}
                >
                  <ThemedText
                    style={[
                      styles.stockToggleText,
                      !hasStock && styles.stockToggleTextActive,
                    ]}
                  >
                    Tanpa Stok
                  </ThemedText>
                </Pressable>
              </View>

              {hasStock && (
                <View style={{ marginTop: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Jumlah stok fisik saat ini (cth: 50)"
                    placeholderTextColor={Colors.disabled}
                    keyboardType="numeric"
                    value={stock}
                    onChangeText={setStock}
                  />
                </View>
              )}
            </View>

            {/* Kategori */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Kategori</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Pressable
                  style={[styles.categoryOption, selectedCategoryId === null && styles.categoryOptionActive]}
                  onPress={() => setSelectedCategoryId(null)}
                >
                  <ThemedText
                    style={[
                      styles.categoryOptionText,
                      selectedCategoryId === null && styles.categoryOptionTextActive,
                    ]}
                  >
                    Semua
                  </ThemedText>
                </Pressable>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.categoryOption, selectedCategoryId === c.id && styles.categoryOptionActive]}
                    onPress={() => setSelectedCategoryId(c.id)}
                  >
                    <ThemedText
                      style={[
                        styles.categoryOptionText,
                        selectedCategoryId === c.id && styles.categoryOptionTextActive,
                      ]}
                    >
                      {c.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <Button
                title="Batal"
                variant="outline"
                onPress={onClose}
                disabled={saving}
                style={{ flex: 1 }}
              />
              <Button
                title={saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                onPress={handleSave}
                disabled={saving}
                style={{ flex: 1, backgroundColor: Colors.tint }}
              />
            </View>
          </ScrollView>
        </Card>
      </ThemedView>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarcodeScanned}
      />

      {/* Date Picker Modal */}
      <CustomDatePickerModal
        visible={datePickerVisible}
        initialDate={expiredDate || new Date().toISOString().slice(0, 10)}
        onClose={() => setDatePickerVisible(false)}
        onSelectDate={(selectedDate) => {
          setExpiredDate(selectedDate);
          setDatePickerVisible(false);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  addBarcodeSmallBtn: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addBarcodeSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tintDark,
  },
  scanBtnInline: {
    backgroundColor: Colors.tint,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBarcodeBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  stockToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stockToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  stockToggleBtnActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  stockToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  stockToggleTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  dateSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  dateSelectBtnActive: {
    backgroundColor: '#f5f3ff',
    borderColor: '#c4b5fd',
  },
  dateSelectBtnText: {
    fontSize: 13,
    color: '#64748b',
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryOptionActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  categoryOptionText: {
    fontSize: 12,
    color: Colors.text,
  },
  categoryOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
});
