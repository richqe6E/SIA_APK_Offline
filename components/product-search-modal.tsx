import React, { useState, useMemo } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import type { Product } from '@/stores/productStore';

interface ProductSearchModalProps {
  visible: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  title?: string;
  subtitle?: string;
  hasStockOnly?: boolean;
}

export function ProductSearchModal({
  visible,
  onClose,
  products,
  onSelectProduct,
  title = 'Pilih Produk',
  subtitle = 'Cari berdasarkan nama produk atau scan barcode',
  hasStockOnly = false,
}: ProductSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (hasStockOnly && p.has_stock !== 1) return false;
      if (!q) return true;
      const matchName = p.name.toLowerCase().includes(q);
      const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
      const matchCat = p.category_name ? p.category_name.toLowerCase().includes(q) : false;
      let matchMulti = false;
      if (p.barcodes) {
        try {
          const list: string[] = JSON.parse(p.barcodes);
          matchMulti = list.some((b) => b.toLowerCase().includes(q));
        } catch {
          matchMulti = p.barcodes.toLowerCase().includes(q);
        }
      }
      return matchName || matchBarcode || matchCat || matchMulti;
    });
  }, [products, searchQuery, hasStockOnly]);

  const handleSelect = (p: Product) => {
    onSelectProduct(p);
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.overlay}>
        <Card style={styles.card} padding={20}>
          {/* Header Bar dengan Tombol Kembali di Kiri Atas */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                setSearchQuery('');
                onClose();
              }}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.backBtnText}>← Kembali</ThemedText>
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <ThemedText style={styles.title}>{title}</ThemedText>
              <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
            </View>

            <View style={{ width: 70 }} />
          </View>

          {/* Kolom Pencarian Cepat */}
          <View style={styles.searchBox}>
            <ThemedText style={styles.searchIcon}>🔍</ThemedText>
            <TextInput
              style={styles.searchInput}
              placeholder="Ketik nama produk, kategori, atau barcode..."
              placeholderTextColor={Colors.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={styles.clearBtn}
              >
                <ThemedText style={styles.clearBtnText}>✕</ThemedText>
              </TouchableOpacity>
            )}
          </View>

          <ThemedText style={styles.resultCount}>
            Menampilkan {filteredProducts.length} dari {products.length} produk
          </ThemedText>

          {/* Daftar Produk Berkecepatan Tinggi */}
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id.toString()}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.productRow}
                activeOpacity={0.7}
                onPress={() => handleSelect(item)}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText style={styles.productName}>{item.name}</ThemedText>
                    {item.is_weighted === 1 && (
                      <View style={styles.weightedBadge}>
                        <ThemedText style={styles.weightedBadgeText}>⚖️ Timbangan</ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <ThemedText style={styles.productCat}>
                      📁 {item.category_name || 'Umum'}
                    </ThemedText>
                    {item.barcode ? (
                      <ThemedText style={styles.productBarcode}>
                        🏷️ {item.barcode}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText style={styles.productPrice}>
                    Rp {Math.round(item.price).toLocaleString('id-ID')}
                    {item.is_weighted === 1 ? '/kg' : ''}
                  </ThemedText>
                  <View
                    style={[
                      styles.stockBadge,
                      {
                        backgroundColor:
                          item.has_stock === 0
                            ? '#f1f5f9'
                            : item.stock <= 5
                            ? '#fee2e2'
                            : '#dcfce7',
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.stockBadgeText,
                        {
                          color:
                            item.has_stock === 0
                              ? '#64748b'
                              : item.stock <= 5
                              ? '#b91c1c'
                              : '#15803d',
                        },
                      ]}
                    >
                      {item.has_stock === 0 ? 'Tanpa Stok' : `Stok: ${item.stock}`}
                    </ThemedText>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <ThemedText style={{ fontSize: 32, marginBottom: 8 }}>🔍</ThemedText>
                <ThemedText style={styles.emptyText}>
                  Produk tidak ditemukan untuk &quot;{searchQuery}&quot;
                </ThemedText>
              </View>
            }
          />
        </Card>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 720,
    height: '88%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.tint,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    height: '100%',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  resultCount: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 4,
  },
  list: {
    flex: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  weightedBadge: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  weightedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  productCat: {
    fontSize: 11,
    color: '#64748b',
  },
  productBarcode: {
    fontSize: 11,
    color: '#64748b',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.tintDark,
  },
  stockBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
