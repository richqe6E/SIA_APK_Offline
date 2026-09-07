import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useLockOrientation } from '@/hooks/use-orientation';
import { useProductStore, type Product } from '@/stores/productStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { usePurchaseStore } from '@/stores/purchaseStore';
import { useStockOpnameStore } from '@/stores/stockOpnameStore';
import { useCashStore } from '@/stores/cashStore';
import { useDebtReceivableStore } from '@/stores/debtReceivableStore';
import { Colors } from '@/constants/theme';
import { BarcodeScannerModal } from '@/components/barcode-scanner-modal';

export default function ProductsScreen() {
  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { products, loadProducts, addProduct, updateProduct, deleteProduct } =
    useProductStore();
  const { categories, loadCategories, addCategory, deleteCategory } =
    useCategoryStore();
  const { businessMode, loadSettings } = useSettingsStore();
  const { createPurchase } = usePurchaseStore();
  const { performOpname } = useStockOpnameStore();
  const { currentBalance, loadLedger } = useCashStore();

  const isRetail = businessMode === 'retail';

  // Modal Produk
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [hasStock, setHasStock] = useState(isRetail);
  const [stock, setStock] = useState('');
  const [barcode, setBarcode] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Search & Barcode Scanner
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'filter' | 'form'>('form');

  // Modal Kategori
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Modal Kulakan (Khusus Retail)
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [purchasePaymentType, setPurchasePaymentType] = useState<'tunai' | 'kredit'>('tunai');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseProductId, setPurchaseProductId] = useState<number | null>(null);
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const { suppliers, loadSuppliers } = useDebtReceivableStore();

  // Modal Stock Opname (Khusus Retail)
  const [opnameModalVisible, setOpnameModalVisible] = useState(false);
  const [opnameProductId, setOpnameProductId] = useState<number | null>(null);
  const [opnamePhysicalStock, setOpnamePhysicalStock] = useState('');
  const [opnameNotes, setOpnameNotes] = useState('');
  const [savingOpname, setSavingOpname] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProducts(db);
      loadCategories(db);
      loadSettings(db);
      loadLedger(db);
      loadSuppliers(db);
    }, [db, loadProducts, loadCategories, loadSettings, loadLedger, loadSuppliers])
  );

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const ext = uri.split('.').pop() ?? 'jpg';
        const dir = new Directory(Paths.document, 'products');
        dir.create({ intermediates: true, idempotent: true });
        const file = new File(dir, `${Date.now()}.${ext}`);
        const source = new File(uri);
        source.copy(file);
        setImagePath(file.uri);
      }
    } catch {
      Alert.alert('Perhatian', 'Gagal memuat foto dari galeri.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Izin Kamera', 'Izin kamera diperlukan untuk memotret produk secara langsung.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const ext = uri.split('.').pop() ?? 'jpg';
        const dir = new Directory(Paths.document, 'products');
        dir.create({ intermediates: true, idempotent: true });
        const file = new File(dir, `${Date.now()}.${ext}`);
        const source = new File(uri);
        source.copy(file);
        setImagePath(file.uri);
      }
    } catch {
      Alert.alert('Perhatian', 'Gagal membuka kamera perangkat.');
    }
  };

  const openAdd = () => {
    setEditingProduct(null);
    setName('');
    setPrice('');
    setCostPrice('');
    setHasStock(isRetail);
    setStock(isRetail ? '10' : '');
    setBarcode('');
    setImagePath('');
    setSelectedCategoryId(null);
    setModalVisible(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setPrice(product.price.toString());
    setCostPrice(product.cost_price > 0 ? product.cost_price.toString() : '');
    setHasStock(product.has_stock === 1);
    setStock(product.has_stock === 1 ? product.stock.toString() : '');
    setBarcode(product.barcode || '');
    setImagePath(product.image_path);
    setSelectedCategoryId(product.category_id);
    setModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Error', 'Nama dan harga wajib diisi');
      return;
    }

    const priceNum = parseFloat(price.replace(/[^0-9]/g, ''));
    const costPriceNum = costPrice ? parseFloat(costPrice.replace(/[^0-9]/g, '')) : 0;
    const stockNum = stock ? parseInt(stock.replace(/[^0-9]/g, ''), 10) : 0;

    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('Error', 'Harga tidak valid');
      return;
    }

    try {
      if (editingProduct) {
        await updateProduct(db, editingProduct.id, {
          name: name.trim(),
          price: priceNum,
          cost_price: isRetail ? costPriceNum : 0,
          has_stock: isRetail ? hasStock : false,
          stock: isRetail && hasStock ? stockNum : 0,
          image_path: imagePath,
          category_id: selectedCategoryId,
          barcode: barcode.trim(),
        });
        Alert.alert('Sukses', `${isRetail ? 'Produk' : 'Menu'} berhasil diperbarui`);
      } else {
        await addProduct(db, {
          name: name.trim(),
          price: priceNum,
          cost_price: isRetail ? costPriceNum : 0,
          has_stock: isRetail ? hasStock : false,
          stock: isRetail && hasStock ? stockNum : 0,
          image_path: imagePath,
          category_id: selectedCategoryId,
          barcode: barcode.trim(),
        });
        Alert.alert('Sukses', `${isRetail ? 'Produk' : 'Menu'} berhasil ditambahkan`);
      }
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'Gagal menyimpan data');
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Data', 'Apakah Anda yakin ingin menghapus data ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(db, id);
          } catch {
            Alert.alert('Error', 'Gagal menghapus');
          }
        },
      },
    ]);
  };

  // ─────────────────────────────────────────
  // Handle Kulakan (Pembelian Stok)
  // ─────────────────────────────────────────
  const openKulakanModal = () => {
    loadLedger(db);
    loadSuppliers(db);
    setPurchasePaymentType('tunai');
    setSelectedSupplierId(null);
    setPurchaseSupplier('');
    setPurchaseProductId(products.length > 0 ? products[0].id : null);
    setPurchaseQty('10');
    setPurchaseCost(
      products.length > 0 && products[0].cost_price > 0 ? products[0].cost_price.toString() : ''
    );
    setPurchaseModalVisible(true);
  };

  const handleSavePurchase = async () => {
    if (!purchaseProductId) {
      Alert.alert('Error', 'Pilih produk yang ingin dibeli terlebih dahulu!');
      return;
    }
    const targetProd = products.find((p) => p.id === purchaseProductId);
    if (!targetProd) return;

    const qty = parseInt(purchaseQty, 10) || 0;
    const cost = parseFloat(purchaseCost.replace(/[^0-9]/g, '')) || 0;

    if (qty <= 0 || cost <= 0) {
      Alert.alert('Error', 'Jumlah dan harga beli/modal harus lebih besar dari 0!');
      return;
    }

    setPurchasing(true);
    const result = await createPurchase(
      db,
      purchaseSupplier,
      [
        {
          productId: targetProd.id,
          productName: targetProd.name,
          costPrice: cost,
          quantity: qty,
          subtotal: qty * cost,
        },
      ],
      purchasePaymentType,
      selectedSupplierId
    );
    setPurchasing(false);

    if (result.success) {
      setPurchaseModalVisible(false);
      const isKredit = purchasePaymentType === 'kredit';
      Alert.alert(
        'Pembelian Berhasil',
        `Stok '${targetProd.name}' bertambah +${qty} pcs.\n` +
          (isKredit
            ? `Total Rp ${(qty * cost).toLocaleString('id-ID')} dicatat sebagai HUTANG SUPPLIER (${purchaseSupplier || 'Supplier Umum'}). Kas fisik toko tidak berkurang.`
            : `Total Rp ${(qty * cost).toLocaleString('id-ID')} dicatat ke Buku Kas Keluar.`)
      );
    } else {
      Alert.alert('Pembelian Ditolak', result.message || 'Gagal menyimpan transaksi pembelian');
    }
  };

  // ─────────────────────────────────────────
  // Handle Stock Opname (Penyesuaian Stok)
  // ─────────────────────────────────────────
  const openOpnameModal = () => {
    const stocked = products.filter((p) => p.has_stock === 1);
    if (stocked.length === 0) {
      Alert.alert('Perhatian', 'Belum ada produk dengan pelacakan stok.');
      return;
    }
    setOpnameProductId(stocked[0].id);
    setOpnamePhysicalStock('');
    setOpnameNotes('');
    setOpnameModalVisible(true);
  };

  const handleSaveOpname = async () => {
    if (!opnameProductId) {
      Alert.alert('Error', 'Pilih produk terlebih dahulu!');
      return;
    }
    const targetProd = products.find((p) => p.id === opnameProductId);
    if (!targetProd) return;

    const physical = parseInt(opnamePhysicalStock, 10);
    if (isNaN(physical) || physical < 0) {
      Alert.alert('Error', 'Masukkan jumlah stok fisik yang valid!');
      return;
    }

    setSavingOpname(true);
    const result = await performOpname(db, targetProd.id, physical, opnameNotes);
    setSavingOpname(false);

    if (result.success) {
      setOpnameModalVisible(false);
      const diff = physical - (targetProd.stock ?? 0);
      const diffText = diff === 0 ? 'Cocok (Tidak ada selisih)' : diff > 0 ? `Surplus (+${diff})` : `Kurang (${diff})`;
      Alert.alert('Opname Selesai', `Stok fisik '${targetProd.name}' disesuaikan menjadi ${physical} pcs.\nStatus: ${diffText}`);
    } else {
      Alert.alert('Error', result.message || 'Gagal melakukan opname');
    }
  };

  const selectedOpnameProd = products.find((p) => p.id === opnameProductId);

  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.category_name && p.category_name.toLowerCase().includes(q))
    );
  });

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <ThemedText type="title">
            {isRetail ? 'Katalog Barang Retail' : 'Daftar Menu & Harga'}
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
            {isRetail
              ? 'Kelola stok fisik, pembelian barang & harga modal (HPP)'
              : 'Menu siap saji & harga jual bebas stok'}
          </ThemedText>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Tombol Khusus Mode Retail */}
          {isRetail && (
            <>
              <TouchableOpacity style={styles.retailActionBtn} onPress={openKulakanModal}>
                <ThemedText style={styles.retailActionBtnText}>📦 Beli Stok</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.retailActionBtn, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
                onPress={openOpnameModal}
              >
                <ThemedText style={[styles.retailActionBtnText, { color: '#92400e' }]}>
                  📝 Opname
                </ThemedText>
              </TouchableOpacity>
            </>
          )}

          <Button
            title="Kategori"
            variant="outline"
            size="sm"
            onPress={() => {
              setCatModalVisible(true);
              loadCategories(db);
            }}
          />
          <Button title={isRetail ? '+ Barang' : '+ Menu'} size="sm" onPress={openAdd} />
        </View>
      </View>

      {/* Search & Scan Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <ThemedText style={{ fontSize: 13, color: Colors.muted }}>🔍</ThemedText>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama barang / barcode..."
            placeholderTextColor={Colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <ThemedText style={{ color: Colors.muted, fontSize: 13, paddingHorizontal: 4 }}>✕</ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.scanBarcodeBtn}
          onPress={() => {
            setScannerTarget('filter');
            setScannerVisible(true);
          }}
        >
          <ThemedText style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>📷 Scan</ThemedText>
        </TouchableOpacity>
      </View>

      {/* List Products */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.productItem} padding={12}>
            <View style={styles.productRow}>
              {item.image_path ? (
                <Image source={{ uri: item.image_path }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <ThemedText style={{ color: Colors.muted, fontSize: 14 }}>
                    {isRetail ? '📦' : '☕'}
                  </ThemedText>
                </View>
              )}
              <View style={styles.productInfo}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>
                  {item.name}
                </ThemedText>
                <ThemedText style={{ color: Colors.tint, fontWeight: '700', fontSize: 13 }}>
                  Rp {item.price.toLocaleString('id-ID')}
                </ThemedText>

                {item.barcode ? (
                  <ThemedText style={{ color: '#64748b', fontSize: 11 }}>
                    Barcode: {item.barcode}
                  </ThemedText>
                ) : null}

                {isRetail && item.cost_price > 0 && (
                  <ThemedText style={{ color: Colors.muted, fontSize: 11 }}>
                    Modal (HPP): Rp {item.cost_price.toLocaleString('id-ID')}
                    {item.price > 0 && (
                      <ThemedText style={{ color: Colors.success, fontSize: 11 }}>
                        {' '}(Laba {Math.round(((item.price - item.cost_price) / item.price) * 100)}%)
                      </ThemedText>
                    )}
                  </ThemedText>
                )}

                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {item.category_name && <Badge label={item.category_name} variant="info" />}
                  {isRetail && item.has_stock === 1 && (
                    <Badge
                      label={item.stock <= 0 ? 'Stok Habis' : `Stok: ${item.stock} pcs`}
                      variant={item.stock <= 0 ? 'error' : item.stock <= 5 ? 'warning' : 'success'}
                    />
                  )}
                </View>
              </View>

              <View style={styles.productActions}>
                <Pressable style={styles.iconBtn} onPress={() => openEdit(item)}>
                  <ThemedText style={{ color: Colors.tint, fontSize: 16 }}>✏️</ThemedText>
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
                  <ThemedText style={{ color: Colors.danger, fontSize: 16 }}>🗑️</ThemedText>
                </Pressable>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📦"
            title="Belum ada produk"
            subtitle="Tambah produk baru untuk mulai melayani transaksi kasir"
          />
        }
      />

      {/* ───────────────────────────────────────── */}
      {/* MODAL TAMBAH / EDIT PRODUK                */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.modalContent} padding={24}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <ThemedText type="subtitle">
                  {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
                </ThemedText>
                <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                  <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
                </Pressable>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>
                  Nama Produk
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="cth: Kopi Bubuk 250g"
                  placeholderTextColor={Colors.disabled}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Barcode / SKU */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Barcode / SKU (Opsional)</ThemedText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="cth: 8991234567890"
                    placeholderTextColor={Colors.disabled}
                    value={barcode}
                    onChangeText={setBarcode}
                  />
                  <TouchableOpacity
                    style={styles.scanBtnInline}
                    onPress={() => {
                      setScannerTarget('form');
                      setScannerVisible(true);
                    }}
                  >
                    <ThemedText style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
                      📷 Scan
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Harga Jual (Rp)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="cth: 15000"
                  placeholderTextColor={Colors.disabled}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              {/* Khusus Mode Retail: Input HPP & Stok */}
              {isRetail && (
                <>
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
                </>
              )}

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
                      Semua / Bebas
                    </ThemedText>
                  </Pressable>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[styles.categoryOption, selectedCategoryId === cat.id && styles.categoryOptionActive]}
                      onPress={() => setSelectedCategoryId(cat.id)}
                    >
                      <ThemedText
                        style={[
                          styles.categoryOptionText,
                          selectedCategoryId === cat.id && styles.categoryOptionTextActive,
                        ]}
                      >
                        {cat.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Foto */}
              <View style={styles.imageSection}>
                <ThemedText style={styles.label}>Foto {isRetail ? 'Barang' : 'Menu'}</ThemedText>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: imagePath ? 10 : 0 }}>
                  <Pressable style={[styles.imagePickerBtn, { flex: 1 }]} onPress={pickImage}>
                    <ThemedText style={{ fontSize: 18 }}>🖼️</ThemedText>
                    <ThemedText style={{ color: Colors.placeholder, fontSize: 12, marginTop: 2 }}>
                      {imagePath ? 'Ganti Galeri' : 'Buka Galeri'}
                    </ThemedText>
                  </Pressable>
                  <Pressable style={[styles.imagePickerBtn, { flex: 1 }]} onPress={takePhoto}>
                    <ThemedText style={{ fontSize: 18 }}>📷</ThemedText>
                    <ThemedText style={{ color: Colors.placeholder, fontSize: 12, marginTop: 2 }}>
                      Buka Kamera
                    </ThemedText>
                  </Pressable>
                </View>
                {imagePath ? (
                  <View style={styles.previewWrapper}>
                    <Image source={{ uri: imagePath }} style={styles.preview} />
                    <Pressable
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        backgroundColor: 'rgba(239, 68, 68, 0.9)',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}
                      onPress={() => setImagePath('')}
                    >
                      <ThemedText style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>Hapus</ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Batal"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setModalVisible(false)}
                />
                <Button title="Simpan" style={{ flex: 1 }} onPress={handleSaveProduct} />
              </View>
            </ScrollView>
          </Card>
        </ThemedView>
      </Modal>

      {/* ───────────────────────────────────────── */}
      {/* MODAL KULAKAN PEMBELIAN STOK (KHUSUS RETAIL) */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={purchaseModalVisible} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.modalContent} padding={22}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">📦 Pembelian Stok / Barang</ThemedText>
              <Pressable onPress={() => setPurchaseModalVisible(false)} style={styles.closeBtn}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Pilihan Metode Pembayaran Stok: Tunai vs Kredit */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Metode Pembayaran Pembelian</ThemedText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[
                      styles.paymentTypeToggleBtn,
                      purchasePaymentType === 'tunai' && styles.paymentTypeToggleBtnActive,
                    ]}
                    onPress={() => setPurchasePaymentType('tunai')}
                  >
                    <ThemedText
                      style={[
                        styles.paymentTypeToggleText,
                        purchasePaymentType === 'tunai' && styles.paymentTypeToggleTextActive,
                      ]}
                    >
                      💵 Tunai (Kas Toko)
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.paymentTypeToggleBtn,
                      purchasePaymentType === 'kredit' && { backgroundColor: '#fef3c7', borderColor: '#d97706' },
                    ]}
                    onPress={() => setPurchasePaymentType('kredit')}
                  >
                    <ThemedText
                      style={[
                        styles.paymentTypeToggleText,
                        purchasePaymentType === 'kredit' && { color: '#92400e', fontWeight: '700' },
                      ]}
                    >
                      📋 Kredit (Hutang Supplier)
                    </ThemedText>
                  </Pressable>
                </View>
              </View>

              {/* Info Box Dinamis Sesuai Metode Bayar */}
              {purchasePaymentType === 'tunai' ? (
                <View style={styles.cashInfoBox}>
                  <ThemedText style={{ fontSize: 11, color: '#475569' }}>Saldo Kas Toko Tersedia:</ThemedText>
                  <ThemedText style={{ fontSize: 18, fontWeight: '800', color: Colors.tintDark, marginTop: 2 }}>
                    Rp {currentBalance.toLocaleString('id-ID')}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 10, color: Colors.muted, marginTop: 2 }}>
                    * Pembelian tunai akan memotong saldo kas fisik toko
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.cashInfoBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                  <ThemedText style={{ fontSize: 11, color: '#92400e', fontWeight: '700' }}>
                    📋 Pembelian Tempo / Kredit (Hutang Toko)
                  </ThemedText>
                  <ThemedText style={{ fontSize: 10, color: '#78350f', marginTop: 3 }}>
                    * Saldo kas toko TIDAK akan berkurang. Nilai pembelian akan otomatis dicatat sebagai hutang baru ke Supplier di modul Manajemen Hutang.
                  </ThemedText>
                </View>
              )}

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Pilih Produk yang Dibeli</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {products.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[
                        styles.categoryOption,
                        purchaseProductId === p.id && styles.categoryOptionActive,
                      ]}
                      onPress={() => {
                        setPurchaseProductId(p.id);
                        if (p.cost_price > 0) setPurchaseCost(p.cost_price.toString());
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.categoryOptionText,
                          purchaseProductId === p.id && styles.categoryOptionTextActive,
                        ]}
                      >
                        {p.name} (Stok: {p.stock})
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Pemilihan Nama Supplier */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Supplier / Tempat Belanja</ThemedText>
                {suppliers.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                    <Pressable
                      style={[
                        styles.categoryOption,
                        selectedSupplierId === null && styles.categoryOptionActive,
                      ]}
                      onPress={() => {
                        setSelectedSupplierId(null);
                        setPurchaseSupplier('');
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.categoryOptionText,
                          selectedSupplierId === null && styles.categoryOptionTextActive,
                        ]}
                      >
                        + Supplier Baru / Bebas
                      </ThemedText>
                    </Pressable>
                    {suppliers.map((s) => (
                      <Pressable
                        key={s.id}
                        style={[
                          styles.categoryOption,
                          selectedSupplierId === s.id && styles.categoryOptionActive,
                        ]}
                        onPress={() => {
                          setSelectedSupplierId(s.id);
                          setPurchaseSupplier(s.name);
                        }}
                      >
                        <ThemedText
                          style={[
                            styles.categoryOptionText,
                            selectedSupplierId === s.id && styles.categoryOptionTextActive,
                          ]}
                        >
                          🏢 {s.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  placeholder="Contoh: Toko Grosir Jaya / Pasar Pagi"
                  placeholderTextColor={Colors.disabled}
                  value={purchaseSupplier}
                  onChangeText={(val) => {
                    setPurchaseSupplier(val);
                    const match = suppliers.find((s) => s.name.toLowerCase() === val.trim().toLowerCase());
                    setSelectedSupplierId(match ? match.id : null);
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <ThemedText style={styles.label}>Jumlah (Pcs)</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="cth: 20"
                    placeholderTextColor={Colors.disabled}
                    keyboardType="numeric"
                    value={purchaseQty}
                    onChangeText={setPurchaseQty}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <ThemedText style={styles.label}>Harga Beli / Satuan (Rp)</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="cth: 12000"
                    placeholderTextColor={Colors.disabled}
                    keyboardType="numeric"
                    value={purchaseCost}
                    onChangeText={setPurchaseCost}
                  />
                </View>
              </View>

              {/* Total Kalkulasi */}
              <View style={styles.totalCalcBox}>
                <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#1e293b' }}>
                  Total Pembelian:
                </ThemedText>
                <ThemedText style={{ fontSize: 18, fontWeight: '800', color: Colors.danger }}>
                  Rp {((parseInt(purchaseQty, 10) || 0) * (parseFloat(purchaseCost) || 0)).toLocaleString('id-ID')}
                </ThemedText>
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Batal"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setPurchaseModalVisible(false)}
                />
                <Button
                  title={
                    purchasing
                      ? 'Memproses...'
                      : purchasePaymentType === 'kredit'
                      ? 'Beli & Catat Hutang'
                      : 'Beli & Potong Kas'
                  }
                  style={{
                    flex: 1,
                    backgroundColor: purchasePaymentType === 'kredit' ? '#d97706' : Colors.tint,
                  }}
                  onPress={handleSavePurchase}
                  disabled={purchasing}
                />
              </View>
            </ScrollView>
          </Card>
        </ThemedView>
      </Modal>

      {/* ───────────────────────────────────────── */}
      {/* MODAL STOCK OPNAME (KHUSUS RETAIL)        */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={opnameModalVisible} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.modalContent} padding={22}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">📝 Audit Stock Opname</ThemedText>
              <Pressable onPress={() => setOpnameModalVisible(false)} style={styles.closeBtn}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Pilih Produk yang Di-Audit</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {products
                    .filter((p) => p.has_stock === 1)
                    .map((p) => (
                      <Pressable
                        key={p.id}
                        style={[
                          styles.categoryOption,
                          opnameProductId === p.id && styles.categoryOptionActive,
                        ]}
                        onPress={() => setOpnameProductId(p.id)}
                      >
                        <ThemedText
                          style={[
                            styles.categoryOptionText,
                            opnameProductId === p.id && styles.categoryOptionTextActive,
                          ]}
                        >
                          {p.name} (Stok: {p.stock})
                        </ThemedText>
                      </Pressable>
                    ))}
                </ScrollView>
              </View>

              {selectedOpnameProd && (
                <View style={styles.systemStockBox}>
                  <ThemedText style={{ fontSize: 12, color: '#475569' }}>
                    Stok Tercatat di Sistem Saat Ini:
                  </ThemedText>
                  <ThemedText style={{ fontSize: 18, fontWeight: '800', color: Colors.tintDark, marginTop: 2 }}>
                    {selectedOpnameProd.stock ?? 0} pcs
                  </ThemedText>
                </View>
              )}

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Jumlah Hitungan Fisik di Toko (Pcs)</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Hitung barang fisik di rak/gudang"
                  placeholderTextColor={Colors.disabled}
                  keyboardType="numeric"
                  value={opnamePhysicalStock}
                  onChangeText={setOpnamePhysicalStock}
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Catatan / Keterangan Selisih</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: Rusak kemasan, kedaluwarsa, atau hilang"
                  placeholderTextColor={Colors.disabled}
                  value={opnameNotes}
                  onChangeText={setOpnameNotes}
                />
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Batal"
                  variant="outline"
                  style={{ flex: 1 }}
                  onPress={() => setOpnameModalVisible(false)}
                />
                <Button
                  title={savingOpname ? 'Menyimpan...' : 'Sesuaikan Stok'}
                  style={{ flex: 1 }}
                  onPress={handleSaveOpname}
                  disabled={savingOpname}
                />
              </View>
            </ScrollView>
          </Card>
        </ThemedView>
      </Modal>

      {/* ───────────────────────────────────────── */}
      {/* MODAL KATEGORI                            */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={catModalVisible} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.modalContent} padding={24}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Kelola Kategori</ThemedText>
              <Pressable onPress={() => setCatModalVisible(false)} style={styles.closeBtn}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Nama kategori baru..."
                placeholderTextColor={Colors.disabled}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
              />
              <Button
                title="+ Tambah"
                size="sm"
                onPress={async () => {
                  if (!newCategoryName.trim()) return;
                  await addCategory(db, newCategoryName.trim());
                  setNewCategoryName('');
                }}
              />
            </View>

            <FlatList
              data={categories}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 240 }}
              renderItem={({ item }) => (
                <View style={styles.catItem}>
                  <ThemedText style={{ flex: 1, fontSize: 14 }}>{item.name}</ThemedText>
                  <Pressable
                    onPress={() => {
                      Alert.alert('Hapus Kategori', `Hapus kategori "${item.name}"?`, [
                        { text: 'Batal', style: 'cancel' },
                        { text: 'Hapus', style: 'destructive', onPress: () => deleteCategory(db, item.id) },
                      ]);
                    }}
                  >
                    <ThemedText style={{ color: Colors.danger, fontSize: 16 }}>🗑️</ThemedText>
                  </Pressable>
                </View>
              )}
            />
          </Card>
        </ThemedView>
      </Modal>

      {/* Modal Scanner Barcode */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(code) => {
          if (scannerTarget === 'form') {
            setBarcode(code);
          } else {
            setSearchQuery(code);
          }
        }}
        title={scannerTarget === 'form' ? 'Pindai Barcode Produk' : 'Cari Produk via Barcode'}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  retailActionBtn: {
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retailActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.tintDark,
  },
  searchBarContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 4,
  },
  scanBarcodeBtn: {
    backgroundColor: Colors.tint,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnInline: {
    backgroundColor: Colors.tint,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { gap: 8, paddingBottom: 32 },
  productItem: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: { width: 50, height: 50, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { flex: 1, gap: 2 },
  productActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { padding: 6 },
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
  closeBtn: { padding: 4 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  stockToggleRow: { flexDirection: 'row', gap: 8 },
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
  stockToggleText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  stockToggleTextActive: { color: '#ffffff', fontWeight: '700' },
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
  categoryOptionText: { fontSize: 12, color: Colors.text },
  categoryOptionTextActive: { color: '#ffffff', fontWeight: '700' },
  imageSection: { gap: 6, marginBottom: 16 },
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
  },
  previewWrapper: { alignItems: 'center', marginTop: 8 },
  preview: { width: 100, height: 100, borderRadius: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cashInfoBox: {
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  totalCalcBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  systemStockBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  paymentTypeToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTypeToggleBtnActive: {
    backgroundColor: '#f5f3ff',
    borderColor: Colors.tint,
  },
  paymentTypeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  paymentTypeToggleTextActive: {
    color: Colors.tintDark,
    fontWeight: '700',
  },
});