import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
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
import { ProductSearchModal } from '@/components/product-search-modal';
import { CustomDatePickerModal } from '@/components/custom-date-picker-modal';

type SortOption =
  | 'oldest'
  | 'newest'
  | 'name_asc'
  | 'name_desc'
  | 'price_desc'
  | 'price_asc'
  | 'stock_asc'
  | 'stock_desc';

interface SortOptionItem {
  id: SortOption;
  label: string;
  icon: string;
  desc: string;
  retailOnly?: boolean;
}

const SORT_OPTIONS: SortOptionItem[] = [
  {
    id: 'oldest',
    label: 'Paling Awal Masuk (Terlama)',
    icon: '🕒',
    desc: 'Menampilkan produk lama yang pertama kali diinput ke aplikasi',
  },
  {
    id: 'newest',
    label: 'Paling Baru Masuk (Terbaru)',
    icon: '✨',
    desc: 'Menampilkan produk yang baru saja ditambahkan belakangan ini',
  },
  {
    id: 'name_asc',
    label: 'Nama Produk (A - Z)',
    icon: '🔤',
    desc: 'Urutan abjad nama produk dari A ke Z',
  },
  {
    id: 'name_desc',
    label: 'Nama Produk (Z - A)',
    icon: '🔤',
    desc: 'Urutan abjad nama produk terbalik dari Z ke A',
  },
  {
    id: 'price_desc',
    label: 'Harga Tertinggi (Termahal)',
    icon: '💰',
    desc: 'Urutan harga jual dari yang paling mahal ke termurah',
  },
  {
    id: 'price_asc',
    label: 'Harga Terendah (Termurah)',
    icon: '🏷️',
    desc: 'Urutan harga jual dari yang paling murah ke termahal',
  },
  {
    id: 'stock_asc',
    label: 'Stok Paling Sedikit (Menipis)',
    icon: '⚠️',
    desc: 'Melihat barang yang stoknya habis atau menipis',
    retailOnly: true,
  },
  {
    id: 'stock_desc',
    label: 'Stok Terbanyak',
    icon: '📦',
    desc: 'Melihat barang dengan jumlah stok fisik terbanyak',
    retailOnly: true,
  },
];

function getExtraBarcodes(product: Product): string[] {
  if (!product.barcodes) return [];
  try {
    const list: string[] = JSON.parse(product.barcodes);
    if (Array.isArray(list)) {
      return list.filter((b) => typeof b === 'string' && b.trim().length > 0 && b.trim() !== product.barcode?.trim());
    }
  } catch {}
  return [];
}

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
  const [barcodesList, setBarcodesList] = useState<string[]>(['', '', '']);
  const [isWeighted, setIsWeighted] = useState(false);
  const [expiredDate, setExpiredDate] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Search & Barcode Scanner
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<string>('form');

  // Filter Kategori & Pengurutan (Sorting)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<number | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('oldest');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Modal Kategori
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Modal Stok Kritis (Retail)
  const [criticalModalVisible, setCriticalModalVisible] = useState(false);
  const [criticalThreshold, setCriticalThreshold] = useState<number>(10);
  const [criticalCategoryFilter, setCriticalCategoryFilter] = useState<number | null>(null);
  const [criticalSearchQuery, setCriticalSearchQuery] = useState('');

  // Modal Kulakan (Khusus Retail)
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [purchasePaymentType, setPurchasePaymentType] = useState<'tunai' | 'kredit'>('tunai');
  const [purchasePaymentSource, setPurchasePaymentSource] = useState<'toko' | 'bank'>('toko');
  const [purchaseDueDate, setPurchaseDueDate] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseProductId, setPurchaseProductId] = useState<number | null>(null);
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const { suppliers, loadSuppliers } = useDebtReceivableStore();

  // Modal Pembaruan Stok (Khusus Retail)
  const [opnameModalVisible, setOpnameModalVisible] = useState(false);
  const [opnameProductId, setOpnameProductId] = useState<number | null>(null);
  const [opnamePhysicalStock, setOpnamePhysicalStock] = useState('');
  const [opnameNotes, setOpnameNotes] = useState('');
  const [savingOpname, setSavingOpname] = useState(false);

  // Modal Pembantu Pencarian Produk & Pemilih Tanggal
  const [productSearchVisible, setProductSearchVisible] = useState(false);
  const [productSearchTarget, setProductSearchTarget] = useState<'purchase' | 'opname' | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'expired' | 'purchaseDue' | null>(null);

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
    setBarcodesList(['', '', '']);
    setIsWeighted(false);
    setExpiredDate('');
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

    const cleanBarcodes = barcodesList.map((b) => b.trim()).filter((b) => b.length > 0);
    const primaryBarcode = cleanBarcodes[0] || barcode.trim();

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
          barcode: primaryBarcode,
          barcodes: cleanBarcodes,
          is_weighted: isWeighted ? 1 : 0,
          expired_date: expiredDate.trim() || null,
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
          barcode: primaryBarcode,
          barcodes: cleanBarcodes,
          is_weighted: isWeighted ? 1 : 0,
          expired_date: expiredDate.trim() || null,
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
  const openKulakanModal = (presetProductId?: number) => {
    loadLedger(db);
    loadSuppliers(db);
    setPurchasePaymentType('tunai');
    setPurchasePaymentSource('toko');
    setPurchaseDueDate('');
    setSelectedSupplierId(null);
    setPurchaseSupplier('');
    const targetProd = presetProductId
      ? products.find((p) => p.id === presetProductId)
      : products.length > 0
      ? products[0]
      : null;
    setPurchaseProductId(targetProd ? targetProd.id : null);
    setPurchaseQty('10');
    setPurchaseCost(
      targetProd && targetProd.cost_price > 0 ? targetProd.cost_price.toString() : ''
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
      selectedSupplierId,
      purchaseDueDate || null,
      purchasePaymentSource
    );
    setPurchasing(false);

    if (result.success) {
      setPurchaseModalVisible(false);
      const isKredit = purchasePaymentType === 'kredit';
      const isBank = purchasePaymentSource === 'bank';
      let infoBayar = '';
      if (isKredit) {
        infoBayar = `Dicatat sebagai HUTANG SUPPLIER (${purchaseSupplier || 'Supplier Umum'})${purchaseDueDate ? `\nJatuh Tempo: ${purchaseDueDate}` : ''}.\nKas fisik toko tidak berkurang.`;
      } else if (isBank) {
        infoBayar = `Dibayar via Rekening Bank/Transfer.\nKas fisik laci kasir tidak berkurang.`;
      } else {
        infoBayar = `Dicatat ke Buku Kas Keluar (memotong laci kasir).`;
      }

      Alert.alert(
        'Pembelian Berhasil',
        `Stok '${targetProd.name}' bertambah +${qty} ${targetProd.is_weighted === 1 ? 'kg' : 'pcs'}.\nTotal: Rp ${(qty * cost).toLocaleString('id-ID')}\n${infoBayar}`
      );
    } else {
      Alert.alert('Pembelian Ditolak', result.message || 'Gagal menyimpan transaksi pembelian');
    }
  };

  // ─────────────────────────────────────────
  // Handle Pembaruan Stok (Stock Opname)
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
      const unitLabel = targetProd.is_weighted === 1 ? 'kg' : 'pcs';
      const diffText = diff === 0 ? 'Cocok (Tidak ada selisih)' : diff > 0 ? `Surplus (+${diff} ${unitLabel})` : `Kurang (${diff} ${unitLabel})`;
      Alert.alert('Pembaruan Stok Selesai', `Stok fisik '${targetProd.name}' disesuaikan menjadi ${physical} ${unitLabel}.\nStatus: ${diffText}`);
    } else {
      Alert.alert('Error', result.message || 'Gagal melakukan pembaruan stok');
    }
  };

  const selectedOpnameProd = products.find((p) => p.id === opnameProductId);

  const currentSortMeta = SORT_OPTIONS.find((s) => s.id === sortOption) || SORT_OPTIONS[0];

  // Jumlah Produk Stok Kritis (< 10)
  const criticalProductsCount = useMemo(() => {
    if (!isRetail) return 0;
    return products.filter((p) => p.has_stock === 1 && (p.stock ?? 0) < 10).length;
  }, [isRetail, products]);

  // Daftar Produk Stok Kritis untuk Modal Peringatan
  const criticalProducts = useMemo(() => {
    if (!isRetail) return [];
    const q = criticalSearchQuery.toLowerCase().trim();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return products
      .filter((p) => {
        // 1. Wajib memiliki tracking stok dan di bawah ambang batas
        if (p.has_stock !== 1 || (p.stock ?? 0) >= criticalThreshold) {
          return false;
        }

        // 2. Filter Kategori
        if (criticalCategoryFilter !== null && p.category_id !== criticalCategoryFilter) {
          return false;
        }

        // 3. Filter Tokenized Search
        if (tokens.length > 0) {
          let extraBarcodesStr = '';
          if (p.barcodes) {
            try {
              const list: string[] = JSON.parse(p.barcodes);
              if (Array.isArray(list)) {
                extraBarcodesStr = list.join(' ');
              }
            } catch {
              extraBarcodesStr = p.barcodes;
            }
          }
          const searchTarget = `${p.name} ${p.category_name || ''} ${p.barcode || ''} ${extraBarcodesStr}`.toLowerCase();
          const matchesAllTokens = tokens.every((token) => searchTarget.includes(token));
          if (!matchesAllTokens) return false;
        }

        return true;
      })
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  }, [isRetail, products, criticalThreshold, criticalCategoryFilter, criticalSearchQuery]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    const result = products.filter((p) => {
      // 1. Filter Kategori
      if (activeCategoryFilter !== null && p.category_id !== activeCategoryFilter) {
        return false;
      }

      // 2. Filter Pencarian Fleksibel (Tokenized Multi-Word: Nama, Kategori, Barcode Utama & Barcode Tambahan)
      if (tokens.length > 0) {
        let extraBarcodesStr = '';
        if (p.barcodes) {
          try {
            const list: string[] = JSON.parse(p.barcodes);
            if (Array.isArray(list)) {
              extraBarcodesStr = list.join(' ');
            }
          } catch {
            extraBarcodesStr = p.barcodes;
          }
        }
        const searchTarget = `${p.name} ${p.category_name || ''} ${p.barcode || ''} ${extraBarcodesStr}`.toLowerCase();
        const matchesAllTokens = tokens.every((token) => searchTarget.includes(token));
        if (!matchesAllTokens) {
          return false;
        }
      }

      return true;
    });

    // 3. Sorting
    return result.sort((a, b) => {
      switch (sortOption) {
        case 'oldest':
          return a.id - b.id;
        case 'newest':
          return b.id - a.id;
        case 'name_asc':
          return a.name.localeCompare(b.name, 'id');
        case 'name_desc':
          return b.name.localeCompare(a.name, 'id');
        case 'price_desc':
          return b.price - a.price;
        case 'price_asc':
          return a.price - b.price;
        case 'stock_asc':
          return (a.stock ?? 0) - (b.stock ?? 0);
        case 'stock_desc':
          return (b.stock ?? 0) - (a.stock ?? 0);
        default:
          return a.id - b.id;
      }
    });
  }, [products, activeCategoryFilter, searchQuery, sortOption]);

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
              <TouchableOpacity
                style={[
                  styles.retailActionBtn,
                  {
                    backgroundColor: criticalProductsCount > 0 ? '#fee2e2' : '#fef2f2',
                    borderColor: criticalProductsCount > 0 ? '#ef4444' : '#fca5a5',
                  },
                ]}
                onPress={() => {
                  setCriticalSearchQuery('');
                  setCriticalCategoryFilter(null);
                  setCriticalModalVisible(true);
                }}
              >
                <ThemedText style={[styles.retailActionBtnText, { color: '#b91c1c' }]}>
                  ⚠️ Stok Kritis {criticalProductsCount > 0 ? `(${criticalProductsCount})` : ''}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retailActionBtn} onPress={() => openKulakanModal()}>
                <ThemedText style={styles.retailActionBtnText}>📦 Beli Stok</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.retailActionBtn, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
                onPress={openOpnameModal}
              >
                <ThemedText style={[styles.retailActionBtnText, { color: '#92400e' }]}>
                  📝 Pembaruan Stok
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
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text.trim().length > 0) {
                setActiveCategoryFilter(null);
              }
            }}
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

      {/* ───────────────────────────────────────── */}
      {/* FILTER KATEGORI & URUTKAN (SORTING)       */}
      {/* ───────────────────────────────────────── */}
      <View style={styles.filterSortSection}>
        {/* Baris Kontrol: Tombol Urutkan & Filter Kategori Horizontal */}
        <View style={styles.filterSortControlsRow}>
          {/* Tombol Pemilih Urutan */}
          <TouchableOpacity
            style={[
              styles.sortTriggerBtn,
              sortOption !== 'oldest' && styles.sortTriggerBtnActive,
            ]}
            onPress={() => setSortModalVisible(true)}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.sortTriggerIcon}>{currentSortMeta.icon}</ThemedText>
            <ThemedText
              style={[
                styles.sortTriggerText,
                sortOption !== 'oldest' && styles.sortTriggerTextActive,
              ]}
              numberOfLines={1}
            >
              {currentSortMeta.label}
            </ThemedText>
            <ThemedText style={styles.sortTriggerChevron}>▾</ThemedText>
          </TouchableOpacity>

          {/* Chips Kategori Horizontal */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipsScroll}
          >
            <TouchableOpacity
              style={[
                styles.categoryFilterChip,
                activeCategoryFilter === null && styles.categoryFilterChipActive,
              ]}
              onPress={() => setActiveCategoryFilter(null)}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[
                  styles.categoryFilterChipText,
                  activeCategoryFilter === null && styles.categoryFilterChipTextActive,
                ]}
              >
                🏷️ Semua ({products.length})
              </ThemedText>
            </TouchableOpacity>

            {categories.map((cat) => {
              const count = products.filter((p) => p.category_id === cat.id).length;
              const isActive = activeCategoryFilter === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryFilterChip,
                    isActive && styles.categoryFilterChipActive,
                  ]}
                  onPress={() => setActiveCategoryFilter(isActive ? null : cat.id)}
                  activeOpacity={0.7}
                >
                  <ThemedText
                    style={[
                      styles.categoryFilterChipText,
                      isActive && styles.categoryFilterChipTextActive,
                    ]}
                  >
                    {cat.name} ({count})
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Status Filter Aktif & Reset Cepat */}
        {(activeCategoryFilter !== null || searchQuery.trim().length > 0 || sortOption !== 'oldest') && (
          <View style={styles.filterActiveBar}>
            <ThemedText style={styles.filterActiveInfoText} numberOfLines={1}>
              Hasil: <ThemedText style={{ fontWeight: '800', color: Colors.tint }}>{filteredProducts.length}</ThemedText> dari {products.length} produk
              {activeCategoryFilter !== null && ` • Kategori: ${categories.find((c) => c.id === activeCategoryFilter)?.name || 'Terpilih'}`}
              {searchQuery.trim().length > 0 && ` • Kata kunci: "${searchQuery}"`}
              {sortOption !== 'oldest' && ` • Urutan: ${currentSortMeta.label}`}
            </ThemedText>
            <TouchableOpacity
              style={styles.resetFilterBtn}
              onPress={() => {
                setActiveCategoryFilter(null);
                setSearchQuery('');
                setSortOption('oldest');
              }}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.resetFilterBtnText}>✕ Reset</ThemedText>
            </TouchableOpacity>
          </View>
        )}
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
                    {item.is_weighted === 1 ? '⚖️' : isRetail ? '📦' : '☕'}
                  </ThemedText>
                </View>
              )}
              <View style={styles.productInfo}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 14 }}>
                  {item.name}
                </ThemedText>
                <ThemedText style={{ color: Colors.tint, fontWeight: '700', fontSize: 13 }}>
                  Rp {item.price.toLocaleString('id-ID')}
                  {item.is_weighted === 1 ? ' / kg' : ''}
                </ThemedText>

                {item.barcode ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <ThemedText style={{ color: '#64748b', fontSize: 11 }}>
                      Barcode: {item.barcode}
                    </ThemedText>
                    {getExtraBarcodes(item).length > 0 && (
                      <View style={styles.multiBarcodeBadge}>
                        <ThemedText style={styles.multiBarcodeBadgeText}>
                          +{getExtraBarcodes(item).length} barcode lain
                        </ThemedText>
                      </View>
                    )}
                  </View>
                ) : getExtraBarcodes(item).length > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <ThemedText style={{ color: '#64748b', fontSize: 11 }}>
                      Barcode: {getExtraBarcodes(item)[0]}
                    </ThemedText>
                    {getExtraBarcodes(item).length > 1 && (
                      <View style={styles.multiBarcodeBadge}>
                        <ThemedText style={styles.multiBarcodeBadgeText}>
                          +{getExtraBarcodes(item).length - 1} barcode lain
                        </ThemedText>
                      </View>
                    )}
                  </View>
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

                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                  {item.category_name && <Badge label={item.category_name} variant="info" />}
                  {item.is_weighted === 1 && (
                    <Badge label="⚖️ Timbangan" variant="info" />
                  )}
                  {item.expired_date && (
                    <Badge label={`Exp: ${item.expired_date}`} variant="warning" />
                  )}
                  {isRetail && item.has_stock === 1 && (
                    <Badge
                      label={
                        item.stock <= 0
                          ? 'Stok Habis'
                          : `Stok: ${item.stock} ${item.is_weighted === 1 ? 'kg' : 'pcs'}`
                      }
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
                        setScannerTarget(`barcode_${idx}`);
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
                  onPress={() => {
                    setDatePickerTarget('expired');
                    setDatePickerVisible(true);
                  }}
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

              {/* Pilihan Sumber Pembayaran jika Tunai */}
              {purchasePaymentType === 'tunai' && (
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Sumber Kas Pembayaran Tunai</ThemedText>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[
                        styles.sourceToggleBtn,
                        purchasePaymentSource === 'toko' && styles.sourceToggleBtnActive,
                      ]}
                      onPress={() => setPurchasePaymentSource('toko')}
                    >
                      <ThemedText
                        style={[
                          styles.sourceToggleText,
                          purchasePaymentSource === 'toko' && styles.sourceToggleTextActive,
                        ]}
                      >
                        🏪 Kas Toko (Laci Kasir)
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.sourceToggleBtn,
                        purchasePaymentSource === 'bank' && styles.sourceToggleBtnActive,
                      ]}
                      onPress={() => setPurchasePaymentSource('bank')}
                    >
                      <ThemedText
                        style={[
                          styles.sourceToggleText,
                          purchasePaymentSource === 'bank' && styles.sourceToggleTextActive,
                        ]}
                      >
                        🏦 Kas Bank (Transfer Rekening)
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Pilihan Jatuh Tempo jika Kredit */}
              {purchasePaymentType === 'kredit' && (
                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <ThemedText style={styles.label}>Jatuh Tempo Pembayaran (Tempo)</ThemedText>
                    {purchaseDueDate ? (
                      <TouchableOpacity onPress={() => setPurchaseDueDate('')}>
                        <ThemedText style={{ fontSize: 11, color: Colors.danger, fontWeight: '700' }}>Reset ✕</ThemedText>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    {[
                      { label: '+1 Hari', days: 1 },
                      { label: '+3 Hari', days: 3 },
                      { label: '+7 Hari', days: 7 },
                      { label: '+14 Hari', days: 14 },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.days}
                        style={styles.dueChipBtn}
                        onPress={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + item.days);
                          setPurchaseDueDate(d.toISOString().split('T')[0]);
                        }}
                      >
                        <ThemedText style={styles.dueChipText}>{item.label}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.dateSelectBtn,
                      purchaseDueDate ? styles.dateSelectBtnActive : null,
                    ]}
                    onPress={() => {
                      setDatePickerTarget('purchaseDue');
                      setDatePickerVisible(true);
                    }}
                  >
                    <ThemedText style={{ fontSize: 16 }}>📅</ThemedText>
                    <ThemedText
                      style={[
                        styles.dateSelectBtnText,
                        purchaseDueDate ? { color: Colors.tintDark, fontWeight: '700' } : null,
                      ]}
                    >
                      {purchaseDueDate ? `Jatuh Tempo: ${purchaseDueDate}` : 'Tentukan Tanggal Jatuh Tempo...'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}

              {/* Info Box Dinamis Sesuai Metode Bayar */}
              {purchasePaymentType === 'tunai' ? (
                purchasePaymentSource === 'toko' ? (
                  <View style={styles.cashInfoBox}>
                    <ThemedText style={{ fontSize: 11, color: '#475569' }}>Saldo Kas Toko Tersedia:</ThemedText>
                    <ThemedText style={{ fontSize: 18, fontWeight: '800', color: Colors.tintDark, marginTop: 2 }}>
                      Rp {currentBalance.toLocaleString('id-ID')}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 10, color: Colors.muted, marginTop: 2 }}>
                      * Pembelian tunai kas toko akan memotong saldo kas fisik di laci kasir
                    </ThemedText>
                  </View>
                ) : (
                  <View style={[styles.cashInfoBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <ThemedText style={{ fontSize: 11, color: '#15803d', fontWeight: '700' }}>
                      🏦 Pembayaran Kas Bank / Rekening
                    </ThemedText>
                    <ThemedText style={{ fontSize: 10, color: '#166534', marginTop: 2 }}>
                      * Saldo kas fisik di laci kasir TIDAK akan berkurang.
                    </ThemedText>
                  </View>
                )
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

              {/* Pemilihan Produk Cepat */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Pilih Produk yang Dibeli</ThemedText>
                {(() => {
                  const targetProd = products.find((p) => p.id === purchaseProductId);
                  return (
                    <TouchableOpacity
                      style={styles.selectProductBtn}
                      onPress={() => {
                        setProductSearchTarget('purchase');
                        setProductSearchVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.selectProductSub}>Produk Terpilih:</ThemedText>
                        <ThemedText style={styles.selectProductTitle} numberOfLines={1}>
                          {targetProd
                            ? `${targetProd.name} (Stok: ${targetProd.stock} ${targetProd.is_weighted === 1 ? 'kg' : 'pcs'})`
                            : 'Ketuk untuk Cari & Pilih Produk...'}
                        </ThemedText>
                      </View>
                      <View style={styles.selectProductBadge}>
                        <ThemedText style={styles.selectProductBadgeText}>Cari 🔍</ThemedText>
                      </View>
                    </TouchableOpacity>
                  );
                })()}
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
      {/* MODAL PEMBARUAN STOK (KHUSUS RETAIL)      */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={opnameModalVisible} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card style={styles.modalContent} padding={22}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">📝 Pembaruan Stok Fisik</ThemedText>
              <Pressable onPress={() => setOpnameModalVisible(false)} style={styles.closeBtn}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Pilih Produk yang Diperbarui</ThemedText>
                <TouchableOpacity
                  style={styles.selectProductBtn}
                  onPress={() => {
                    setProductSearchTarget('opname');
                    setProductSearchVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.selectProductSub}>Produk Terpilih:</ThemedText>
                    <ThemedText style={styles.selectProductTitle} numberOfLines={1}>
                      {selectedOpnameProd
                        ? `${selectedOpnameProd.name} (Stok Sistem: ${selectedOpnameProd.stock} ${selectedOpnameProd.is_weighted === 1 ? 'kg' : 'pcs'})`
                        : 'Ketuk untuk Cari & Pilih Produk...'}
                    </ThemedText>
                  </View>
                  <View style={styles.selectProductBadge}>
                    <ThemedText style={styles.selectProductBadgeText}>Cari 🔍</ThemedText>
                  </View>
                </TouchableOpacity>
              </View>

              {selectedOpnameProd && (
                <View style={styles.systemStockBox}>
                  <ThemedText style={{ fontSize: 12, color: '#475569' }}>
                    Stok Tercatat di Sistem Saat Ini:
                  </ThemedText>
                  <ThemedText style={{ fontSize: 18, fontWeight: '800', color: Colors.tintDark, marginTop: 2 }}>
                    {selectedOpnameProd.stock ?? 0} {selectedOpnameProd.is_weighted === 1 ? 'kg' : 'pcs'}
                  </ThemedText>
                </View>
              )}

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>
                  Jumlah Hitungan Fisik Riil ({selectedOpnameProd?.is_weighted === 1 ? 'Kg' : 'Pcs'})
                </ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder={`Hitung stok fisik di rak/gudang (${selectedOpnameProd?.is_weighted === 1 ? 'kg' : 'pcs'})`}
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
                  title={savingOpname ? 'Menyimpan...' : 'Sesuaikan Stok Fisik'}
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

      {/* ───────────────────────────────────────── */}
      {/* MODAL PILIH URUTAN (SORT MODAL)           */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { maxWidth: 520 }]} padding={20}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText type="subtitle">Urutkan Daftar Produk</ThemedText>
                <ThemedText style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                  Pilih urutan untuk memudahkan mencari produk lama atau baru
                </ThemedText>
              </View>
              <Pressable onPress={() => setSortModalVisible(false)} style={styles.closeBtn}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {SORT_OPTIONS.filter((opt) => !opt.retailOnly || isRetail).map((opt) => {
                  const isSelected = sortOption === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.sortOptionCard,
                        isSelected && styles.sortOptionCardSelected,
                      ]}
                      onPress={() => {
                        setSortOption(opt.id);
                        setSortModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.sortOptionLeft}>
                        <ThemedText style={styles.sortOptionIcon}>{opt.icon}</ThemedText>
                        <View style={{ flex: 1 }}>
                          <ThemedText
                            style={[
                              styles.sortOptionTitle,
                              isSelected && styles.sortOptionTitleSelected,
                            ]}
                          >
                            {opt.label}
                          </ThemedText>
                          <ThemedText style={styles.sortOptionDesc}>
                            {opt.desc}
                          </ThemedText>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.sortOptionRadio,
                          isSelected && styles.sortOptionRadioSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.sortOptionRadioInner} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ marginTop: 16 }}>
              <Button
                title="Tutup"
                variant="outline"
                size="sm"
                onPress={() => setSortModalVisible(false)}
              />
            </View>
          </Card>
        </ThemedView>
      </Modal>

      {/* Modal Stok Kritis & Restock */}
      <Modal
        visible={criticalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCriticalModalVisible(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { maxWidth: 640, maxHeight: '88%' }]} padding={18}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ThemedText style={{ fontSize: 18 }}>⚠️</ThemedText>
                  <ThemedText type="subtitle" style={{ fontSize: 16, fontWeight: '800', color: '#991b1b' }}>
                    Peringatan Stok Kritis
                  </ThemedText>
                </View>
                <ThemedText style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                  Daftar produk dengan jumlah stok di bawah batas aman. Lakukan pembelian stok secara langsung.
                </ThemedText>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setCriticalModalVisible(false)}
              >
                <ThemedText style={{ fontSize: 16, color: Colors.muted }}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Filter Ambang Batas (Thresholds) */}
            <View style={{ marginBottom: 10 }}>
              <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 5 }}>
                Ambang Batas Stok Menipis:
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[5, 10, 20, 30].map((th) => {
                  const isSelected = criticalThreshold === th;
                  return (
                    <TouchableOpacity
                      key={th}
                      style={[
                        styles.thresholdBtn,
                        isSelected && styles.thresholdBtnActive,
                      ]}
                      onPress={() => setCriticalThreshold(th)}
                      activeOpacity={0.7}
                    >
                      <ThemedText
                        style={[
                          styles.thresholdBtnText,
                          isSelected && styles.thresholdBtnTextActive,
                        ]}
                      >
                        {'< '}{th} Pcs
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Pencarian & Scan di Modal Kritis */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <View style={[styles.searchBox, { height: 38, flex: 1 }]}>
                <ThemedText style={{ fontSize: 12, color: Colors.muted }}>🔍</ThemedText>
                <TextInput
                  style={[styles.searchInput, { fontSize: 12 }]}
                  placeholder="Cari produk kritis / barcode..."
                  placeholderTextColor={Colors.placeholder}
                  value={criticalSearchQuery}
                  onChangeText={(text) => {
                    setCriticalSearchQuery(text);
                    if (text.trim().length > 0) {
                      setCriticalCategoryFilter(null);
                    }
                  }}
                />
                {criticalSearchQuery ? (
                  <TouchableOpacity onPress={() => setCriticalSearchQuery('')} hitSlop={8}>
                    <ThemedText style={{ color: Colors.muted, fontSize: 12, paddingHorizontal: 4 }}>✕</ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.scanBarcodeBtn, { height: 38, paddingHorizontal: 10 }]}
                onPress={() => {
                  setScannerTarget('critical_filter');
                  setScannerVisible(true);
                }}
              >
                <ThemedText style={{ color: '#ffffff', fontWeight: '700', fontSize: 11 }}>📷 Scan</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Filter Kategori Horizontal */}
            <View style={{ marginBottom: 10 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  style={[
                    styles.categoryFilterChip,
                    { height: 30, paddingHorizontal: 10 },
                    criticalCategoryFilter === null && styles.categoryFilterChipActive,
                  ]}
                  onPress={() => setCriticalCategoryFilter(null)}
                >
                  <ThemedText
                    style={[
                      styles.categoryFilterChipText,
                      { fontSize: 11 },
                      criticalCategoryFilter === null && styles.categoryFilterChipTextActive,
                    ]}
                  >
                    Semua ({products.filter((p) => p.has_stock === 1 && (p.stock ?? 0) < criticalThreshold).length})
                  </ThemedText>
                </TouchableOpacity>
                {categories.map((cat) => {
                  const catCount = products.filter(
                    (p) => p.has_stock === 1 && p.category_id === cat.id && (p.stock ?? 0) < criticalThreshold
                  ).length;
                  if (catCount === 0) return null;
                  const isActive = criticalCategoryFilter === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryFilterChip,
                        { height: 30, paddingHorizontal: 10 },
                        isActive && styles.categoryFilterChipActive,
                      ]}
                      onPress={() => setCriticalCategoryFilter(isActive ? null : cat.id)}
                    >
                      <ThemedText
                        style={[
                          styles.categoryFilterChipText,
                          { fontSize: 11 },
                          isActive && styles.categoryFilterChipTextActive,
                        ]}
                      >
                        {cat.name} ({catCount})
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Info Hasil */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 }}>
              <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                Ditemukan <ThemedText style={{ fontWeight: '800', color: '#b91c1c' }}>{criticalProducts.length}</ThemedText> produk dengan stok &lt; {criticalThreshold}
              </ThemedText>
            </View>

            {/* Daftar Produk Kritis */}
            {criticalProducts.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: '#ecfdf5',
                    borderWidth: 1.5,
                    borderColor: '#a7f3d0',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}>
                  <Ionicons name="checkmark-circle" size={38} color="#10b981" />
                </View>
                <ThemedText style={{ fontSize: 15, fontWeight: '700', color: '#059669' }}>
                  Stok Dalam Kondisi Aman
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: 4 }}>
                  Tidak ada produk dengan stok fisik di bawah {criticalThreshold} unit pada filter saat ini.
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={criticalProducts}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                renderItem={({ item }) => {
                  const isOutOfStock = (item.stock ?? 0) <= 0;
                  const unit = item.is_weighted === 1 ? 'kg' : 'pcs';
                  return (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 10,
                        backgroundColor: isOutOfStock ? '#fef2f2' : '#fffbeb',
                        borderWidth: 1,
                        borderColor: isOutOfStock ? '#fecaca' : '#fde68a',
                        borderRadius: 10,
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                          {item.name}
                        </ThemedText>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                          {item.category_name ? (
                            <ThemedText style={{ fontSize: 10, color: '#64748b' }}>
                              📁 {item.category_name}
                            </ThemedText>
                          ) : null}
                          {item.barcode ? (
                            <ThemedText style={{ fontSize: 10, color: '#64748b' }}>
                              🏷️ {item.barcode}
                            </ThemedText>
                          ) : null}
                          {item.cost_price > 0 ? (
                            <ThemedText style={{ fontSize: 10, color: '#64748b' }}>
                              Modal: Rp {item.cost_price.toLocaleString('id-ID')}
                            </ThemedText>
                          ) : null}
                        </View>
                      </View>

                      {/* Status Stok Badge */}
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                            backgroundColor: isOutOfStock ? '#dc2626' : '#d97706',
                          }}
                        >
                          <ThemedText style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>
                            {isOutOfStock ? `HABIS (0 ${unit})` : `Sisa ${item.stock} ${unit}`}
                          </ThemedText>
                        </View>

                        {/* Tombol Langsung Beli Stok */}
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#2563eb',
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 6,
                          }}
                          onPress={() => {
                            setCriticalModalVisible(false);
                            openKulakanModal(item.id);
                          }}
                          activeOpacity={0.8}
                        >
                          <ThemedText style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                            📦 Beli Stok
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Footer Modal */}
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
              <Button
                title="Tutup"
                variant="outline"
                size="sm"
                onPress={() => setCriticalModalVisible(false)}
              />
            </View>
          </Card>
        </ThemedView>
      </Modal>

      {/* Modal Scanner Barcode */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(code) => {
          if (scannerTarget === 'filter') {
            setActiveCategoryFilter(null);
            setSearchQuery(code);
          } else if (scannerTarget === 'critical_filter') {
            setCriticalCategoryFilter(null);
            setCriticalSearchQuery(code);
          } else if (scannerTarget.startsWith('barcode_')) {
            const idx = parseInt(scannerTarget.replace('barcode_', ''), 10);
            setBarcodesList((prev) => {
              const next = [...prev];
              next[idx] = code;
              return next;
            });
            if (idx === 0) setBarcode(code);
          } else {
            setBarcode(code);
            setBarcodesList((prev) => {
              const next = [...prev];
              next[0] = code;
              return next;
            });
          }
          setScannerVisible(false);
        }}
        title={
          scannerTarget === 'critical_filter'
            ? 'Cari Produk Kritis via Barcode'
            : scannerTarget === 'filter'
            ? 'Cari Produk via Barcode'
            : 'Pindai Barcode Produk'
        }
      />

      {/* Modal Pencarian Cepat Produk (Pembaruan Stok & Pembelian) */}
      <ProductSearchModal
        visible={productSearchVisible}
        onClose={() => {
          setProductSearchVisible(false);
          setProductSearchTarget(null);
        }}
        products={products}
        hasStockOnly={productSearchTarget === 'opname'}
        title={productSearchTarget === 'opname' ? 'Pilih Produk Pembaruan Stok' : 'Pilih Produk Pembelian Stok'}
        subtitle={productSearchTarget === 'opname' ? 'Pilih produk ber-stok untuk disesuaikan' : 'Pilih produk kulakan dari katalog'}
        onSelectProduct={(p) => {
          if (productSearchTarget === 'purchase') {
            setPurchaseProductId(p.id);
            if (p.cost_price > 0) setPurchaseCost(p.cost_price.toString());
          } else if (productSearchTarget === 'opname') {
            setOpnameProductId(p.id);
          }
          setProductSearchVisible(false);
          setProductSearchTarget(null);
        }}
      />

      {/* Modal Pemilih Tanggal (Expired Date & Due Date) */}
      <CustomDatePickerModal
        visible={datePickerVisible}
        onClose={() => {
          setDatePickerVisible(false);
          setDatePickerTarget(null);
        }}
        title={datePickerTarget === 'expired' ? 'Pilih Tanggal Kedaluwarsa' : 'Pilih Tanggal Jatuh Tempo'}
        initialDate={datePickerTarget === 'expired' ? expiredDate : purchaseDueDate}
        mode={datePickerTarget === 'expired' ? 'expired' : 'due_date'}
        onSelectDate={(dStr) => {
          if (datePickerTarget === 'expired') {
            setExpiredDate(dStr);
          } else if (datePickerTarget === 'purchaseDue') {
            setPurchaseDueDate(dStr);
          }
          setDatePickerVisible(false);
          setDatePickerTarget(null);
        }}
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
  selectProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
  },
  selectProductSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  selectProductTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 2,
  },
  selectProductBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  selectProductBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.tintDark,
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
  removeBarcodeBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  sourceToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  sourceToggleBtnActive: {
    backgroundColor: '#f5f3ff',
    borderColor: Colors.tint,
  },
  sourceToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  sourceToggleTextActive: {
    color: Colors.tintDark,
    fontWeight: '700',
  },
  dueChipBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dueChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },

  // Filter & Sort Bar Styles
  filterSortSection: {
    marginBottom: 10,
    gap: 6,
  },
  filterSortControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
    maxWidth: 220,
  },
  sortTriggerBtnActive: {
    backgroundColor: '#f5f3ff',
    borderColor: Colors.tint,
  },
  sortTriggerIcon: {
    fontSize: 13,
  },
  sortTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    flexShrink: 1,
  },
  sortTriggerTextActive: {
    color: Colors.tintDark,
  },
  sortTriggerChevron: {
    fontSize: 11,
    color: Colors.muted,
  },
  categoryChipsScroll: {
    gap: 6,
    alignItems: 'center',
    paddingVertical: 2,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryFilterChipActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  categoryFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryFilterChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  filterActiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterActiveInfoText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    marginRight: 8,
  },
  resetFilterBtn: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  resetFilterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.tintDark,
  },

  // Multi-Barcode Badge
  multiBarcodeBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  multiBarcodeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.tintDark,
  },

  // Sort Option Modal Styles
  sortOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  sortOptionCardSelected: {
    backgroundColor: '#f5f3ff',
    borderColor: Colors.tint,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  sortOptionIcon: {
    fontSize: 18,
  },
  sortOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  sortOptionTitleSelected: {
    color: Colors.tintDark,
    fontWeight: '800',
  },
  sortOptionDesc: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  sortOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortOptionRadioSelected: {
    borderColor: Colors.tint,
  },
  sortOptionRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.tint,
  },
  thresholdBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  thresholdBtnActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  thresholdBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  thresholdBtnTextActive: {
    color: '#dc2626',
    fontWeight: '800',
  },
});