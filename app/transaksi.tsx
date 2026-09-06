import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Colors, Shadows } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import { useProductStore, type Product } from '@/stores/productStore';
import { useTransactionStore, type CartItem } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { usePrinterStore } from '@/stores/printerStore';
import { useSettingsStore, BusinessMode, ViewMode } from '@/stores/settingsStore';
import { printReceipt } from '@/services/print';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarcodeScannerModal } from '@/components/barcode-scanner-modal';
import { BulkQtyModal } from '@/components/bulk-qty-modal';
import { QrisDisplayModal } from '@/components/qris-display-modal';

export default function TransactionScreen() {
  const router = useRouter();
  useLockOrientation(ScreenOrientation.OrientationLock.LANDSCAPE);

  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { products, loadProducts } = useProductStore();
  const { categories, loadCategories } = useCategoryStore();
  const { cart, addToCart, updateQuantity, removeFromCart, checkout } =
    useTransactionStore();
  const {
    loadSettings,
    businessMode,
    defaultViewMode,
    setDefaultViewMode,
    qrisImagePath,
    storeName,
  } = useSettingsStore();

  const { width } = useWindowDimensions();
  // Responsif tablet landscape: lebar >= 1050 (4 kolom), >= 720 (3 kolom), lainnya 2 kolom
  const gridColumns = width >= 1050 ? 4 : width >= 720 ? 3 : 2;

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [paymentMethod, setPaymentMethod] = useState<'tunai' | 'qris'>('tunai');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTotal, setSuccessTotal] = useState(0);
  const [successDailySeq, setSuccessDailySeq] = useState(0);
  const [lastTransaction, setLastTransaction] = useState<{
    items: CartItem[];
    paymentMethod: 'tunai' | 'qris';
    paymentAmount: number;
    change: number;
  } | null>(null);

  // Fase 4 Modals: Barcode Scanner, Bulk Qty, QRIS Fullscreen
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [bulkQtyTarget, setBulkQtyTarget] = useState<CartItem | null>(null);
  const [showBulkQtyModal, setShowBulkQtyModal] = useState(false);
  const [showQrisCustomerModal, setShowQrisCustomerModal] = useState(false);

  useEffect(() => {
    loadProducts(db);
    loadCategories(db);
    loadSettings(db);
  }, [db, loadProducts, loadCategories, loadSettings]);

  // Set initial view mode based on store settings / business mode
  useEffect(() => {
    if (defaultViewMode) {
      setViewMode(defaultViewMode);
    } else {
      setViewMode(businessMode === 'retail' ? 'list' : 'grid');
    }
  }, [defaultViewMode, businessMode]);

  const handleToggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setDefaultViewMode(db, mode);
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategoryId ? p.category_id === selectedCategoryId : true;
    const matchSearch = searchQuery.trim()
      ? p.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchCat && matchSearch;
  });

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const parsedAmount = parseInt(paymentAmount.replace(/\./g, ''), 10) || 0;
  const change = Math.max(0, parsedAmount - total);

  const handleNumpadPress = (value: string) => {
    if (value === 'backspace') {
      setPaymentAmount((prev) => prev.slice(0, -1));
    } else if (value === 'clear') {
      setPaymentAmount('');
    } else {
      setPaymentAmount((prev) => prev + value);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'tunai' && parsedAmount < total) return;
    setSuccessTotal(total);
    setLastTransaction({
      items: [...cart],
      paymentMethod,
      paymentAmount: parsedAmount || total,
      change,
    });
    const dailySeq = await checkout(db, paymentMethod, parsedAmount || total);
    setSuccessDailySeq(dailySeq);
    setPaymentAmount('');
    setShowSuccess(true);
  };

  const handleSelesaiMenjual = () => {
    router.back();
  };

  const handleDone = () => {
    setStep(1);
    setShowSuccess(false);
    setPaymentAmount('');
    setLastTransaction(null);
  };

  const handleAddToCartWithValidation = (product: Product) => {
    if (businessMode === 'retail' && product.has_stock === 1) {
      const existingInCart = cart.find((item) => item.product_id === product.id);
      const currentQty = existingInCart ? existingInCart.quantity : 0;
      if (currentQty + 1 > product.stock) {
        Alert.alert(
          'Stok Tidak Cukup',
          `Stok '${product.name}' tersisa ${product.stock}. Tidak dapat menambah lagi.`
        );
        return;
      }
    }
    addToCart(product);
  };

  const handleBarcodeScanned = (code: string) => {
    const trimmed = code.trim().toLowerCase();
    const matched = products.find(
      (p) =>
        (p.barcode && p.barcode.trim().toLowerCase() === trimmed) ||
        p.name.toLowerCase() === trimmed
    );
    if (matched) {
      handleAddToCartWithValidation(matched);
    } else {
      Alert.alert(
        'Produk Tidak Ditemukan',
        `Barcode "${code}" tidak ditemukan pada katalog produk.`
      );
    }
  };

  const handleOpenBulkQty = (item: CartItem) => {
    setBulkQtyTarget(item);
    setShowBulkQtyModal(true);
  };

  const handleSaveBulkQty = (newQty: number) => {
    if (bulkQtyTarget) {
      updateQuantity(bulkQtyTarget.product_id, newQty);
      setShowBulkQtyModal(false);
      setBulkQtyTarget(null);
    }
  };

  const targetProductForBulk = bulkQtyTarget
    ? products.find((p) => p.id === bulkQtyTarget.product_id)
    : null;

  return (
    <ThemedView style={[styles.container, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      {step === 1 ? (
        <Step1View
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onChangeCategory={setSelectedCategoryId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          businessMode={businessMode}
          filteredProducts={filteredProducts}
          cart={cart}
          total={total}
          gridColumns={gridColumns}
          onAddToCart={handleAddToCartWithValidation}
          onUpdateQty={(id, qty) => updateQuantity(id, qty)}
          onRemove={(id) => removeFromCart(id)}
          onOpenBarcodeScanner={() => setShowBarcodeScanner(true)}
          onOpenBulkQty={handleOpenBulkQty}
          onNext={() => setStep(2)}
          onDone={handleSelesaiMenjual}
        />
      ) : showSuccess ? (
        <SuccessView
          total={successTotal}
          transactionId={successDailySeq}
          lastTransaction={lastTransaction}
          onDone={handleDone}
        />
      ) : (
        <Step2View
          cart={cart}
          total={total}
          paymentMethod={paymentMethod}
          paymentAmount={paymentAmount}
          parsedAmount={parsedAmount}
          change={change}
          qrisImagePath={qrisImagePath}
          storeName={storeName}
          onChangeMethod={setPaymentMethod}
          onNumpadPress={handleNumpadPress}
          onSetAmount={(v) => setPaymentAmount(v)}
          onOpenQrisCustomerModal={() => setShowQrisCustomerModal(true)}
          onBack={() => setStep(1)}
          onConfirm={handleCheckout}
        />
      )}

      {/* Barcode Scanner Modal (Poin 9) */}
      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScanned={handleBarcodeScanned}
        title="Pindai Barcode Produk Kasir"
      />

      {/* Bulk Quantity Modal (Poin 14) */}
      {bulkQtyTarget && (
        <BulkQtyModal
          visible={showBulkQtyModal}
          onClose={() => {
            setShowBulkQtyModal(false);
            setBulkQtyTarget(null);
          }}
          productName={bulkQtyTarget.product_name}
          productPrice={bulkQtyTarget.product_price}
          currentQty={bulkQtyTarget.quantity}
          maxStock={targetProductForBulk?.has_stock === 1 ? targetProductForBulk.stock : undefined}
          hasStock={targetProductForBulk?.has_stock === 1}
          onSaveQty={handleSaveBulkQty}
        />
      )}

      {/* Fullscreen Customer QRIS Modal (Poin 15) */}
      <QrisDisplayModal
        visible={showQrisCustomerModal}
        onClose={() => setShowQrisCustomerModal(false)}
        qrisImagePath={qrisImagePath}
        storeName={storeName}
        totalAmount={total}
        onConfirmPayment={() => {
          setShowQrisCustomerModal(false);
          handleCheckout();
        }}
      />
    </ThemedView>
  );
}

function Step1View({
  categories,
  selectedCategoryId,
  onChangeCategory,
  searchQuery,
  onSearchChange,
  viewMode,
  onToggleViewMode,
  businessMode,
  filteredProducts,
  cart,
  total,
  gridColumns,
  onAddToCart,
  onUpdateQty,
  onRemove,
  onOpenBarcodeScanner,
  onOpenBulkQty,
  onNext,
  onDone,
}: {
  categories: { id: number; name: string }[];
  selectedCategoryId: number | null;
  onChangeCategory: (id: number | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: ViewMode;
  onToggleViewMode: (mode: ViewMode) => void;
  businessMode: BusinessMode;
  filteredProducts: Product[];
  cart: CartItem[];
  total: number;
  gridColumns: number;
  onAddToCart: (p: Product) => void;
  onUpdateQty: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  onOpenBarcodeScanner: () => void;
  onOpenBulkQty: (item: CartItem) => void;
  onNext: () => void;
  onDone: () => void;
}) {
  return (
    <>
      <View style={styles.leftPanel}>
        {/* Search Bar & Mode Switch Row */}
        <View style={styles.topControlRow}>
          <View style={styles.searchBox}>
            <ThemedText style={styles.searchIcon}>🔍</ThemedText>
            <TextInput
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder={
                businessMode === 'retail'
                  ? 'Cari nama barang / SKU...'
                  : 'Cari menu makanan / minuman...'
              }
              placeholderTextColor={Colors.placeholder}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => onSearchChange('')} style={styles.clearSearchBtn}>
                <ThemedText style={{ color: Colors.muted, fontSize: 13, fontWeight: 'bold' }}>✕</ThemedText>
              </Pressable>
            )}
          </View>

          {/* Tombol Scan Barcode Kasir */}
          <TouchableOpacity
            style={styles.scanBarcodeBtn}
            onPress={onOpenBarcodeScanner}
          >
            <ThemedText style={styles.scanBarcodeBtnText}>📷 Scan</ThemedText>
          </TouchableOpacity>

          {/* Toggle View Mode Button */}
          <Pressable
            style={styles.viewToggleBtn}
            onPress={() => onToggleViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            <ThemedText style={styles.viewToggleText}>
              {viewMode === 'grid' ? '📋 Mode List' : '🖼️ Mode Grid'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Categories Chips */}
        <View style={styles.categoryRow}>
          <Pressable
            style={[styles.categoryChip, selectedCategoryId === null && styles.categoryChipActive]}
            onPress={() => onChangeCategory(null)}
          >
            <ThemedText style={[styles.categoryChipText, selectedCategoryId === null && styles.categoryChipTextActive]}>
              Semua
            </ThemedText>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.categoryChip, selectedCategoryId === cat.id && styles.categoryChipActive]}
              onPress={() => onChangeCategory(cat.id)}
            >
              <ThemedText style={[styles.categoryChipText, selectedCategoryId === cat.id && styles.categoryChipTextActive]}>
                {cat.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Product Catalog (Dynamic List vs Grid) */}
        <FlatList
          key={`${viewMode}-${gridColumns}`} // Re-render properly when switching numColumns
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          numColumns={viewMode === 'grid' ? gridColumns : 1}
          contentContainerStyle={viewMode === 'grid' ? styles.productGrid : styles.productList}
          columnWrapperStyle={viewMode === 'grid' ? { gap: 8 } : undefined}
          renderItem={({ item }) =>
            viewMode === 'grid' ? (
              <ProductCard
                product={item}
                businessMode={businessMode}
                onPress={() => onAddToCart(item)}
              />
            ) : (
              <ProductListItem
                product={item}
                businessMode={businessMode}
                onPress={() => onAddToCart(item)}
              />
            )
          }
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>
              {searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Tidak ada produk'}
            </ThemedText>
          }
        />
      </View>

      {/* Right Panel: Cart */}
      <View style={styles.rightPanel}>
        <View style={styles.rightHeader}>
          <ThemedText type="title" style={{ fontSize: 18 }}>Keranjang</ThemedText>
          <Button title="Selesai Menjual" variant="outline" size="sm" onPress={onDone} />
        </View>

        <FlatList
          data={cart}
          keyExtractor={(item) => item.product_id.toString()}
          contentContainerStyle={styles.cartList}
          renderItem={({ item }) => (
            <Card padding={10} style={{ marginBottom: 6 }}>
              <View style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }}>{item.product_name}</ThemedText>
                  <ThemedText style={{ fontSize: 11 }}>
                    Rp {item.product_price.toLocaleString('id-ID')} x {item.quantity}
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 12, color: Colors.tint }}>
                    Rp {item.subtotal.toLocaleString('id-ID')}
                  </ThemedText>
                </View>
                <View style={styles.cartItemActions}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => onUpdateQty(item.product_id, item.quantity - 1)}
                  >
                    <ThemedText style={{ fontWeight: '700' }}>-</ThemedText>
                  </Pressable>
                  <Pressable
                    style={styles.qtyTouchBadge}
                    onPress={() => onOpenBulkQty(item)}
                    hitSlop={4}
                  >
                    <ThemedText style={styles.qtyTouchText}>
                      {item.quantity}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => onUpdateQty(item.product_id, item.quantity + 1)}
                  >
                    <ThemedText style={{ fontWeight: '700' }}>+</ThemedText>
                  </Pressable>
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => onRemove(item.product_id)}
                  >
                    <ThemedText style={{ fontSize: 14 }}>{'\u{1F5D1}'}</ThemedText>
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>Keranjang masih kosong</ThemedText>
          }
        />

        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Total</ThemedText>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, color: Colors.success }}>
              Rp {total.toLocaleString('id-ID')}
            </ThemedText>
          </View>
          <Button
            title="Lanjutkan ke Pembayaran"
            disabled={cart.length === 0}
            onPress={onNext}
          />
        </View>
      </View>
    </>
  );
}

function Step2View({
  cart,
  total,
  paymentMethod,
  paymentAmount,
  parsedAmount,
  change,
  qrisImagePath,
  storeName,
  onChangeMethod,
  onNumpadPress,
  onSetAmount,
  onOpenQrisCustomerModal,
  onBack,
  onConfirm,
}: {
  cart: CartItem[];
  total: number;
  paymentMethod: 'tunai' | 'qris';
  paymentAmount: string;
  parsedAmount: number;
  change: number;
  qrisImagePath: string;
  storeName: string;
  onChangeMethod: (m: 'tunai' | 'qris') => void;
  onNumpadPress: (v: string) => void;
  onSetAmount: (v: string) => void;
  onOpenQrisCustomerModal: () => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const canConfirm =
    paymentMethod === 'qris' ||
    (paymentMethod === 'tunai' && parsedAmount >= total && paymentAmount.length > 0);

  const formatRupiah = (val: string) => {
    if (!val) return '0';
    const num = parseInt(val, 10);
    return num.toLocaleString('id-ID');
  };

  const quickPresets = React.useMemo(() => {
    const list: { label: string; amount: number }[] = [
      { label: 'Uang Pas', amount: total },
    ];

    if (total <= 0) {
      return [
        { label: 'Uang Pas', amount: 0 },
        { label: 'Rp 20rb', amount: 20000 },
        { label: 'Rp 50rb', amount: 50000 },
        { label: 'Rp 100rb', amount: 100000 },
      ];
    }

    // Pecahan standar rupiah Indonesia
    const standardBills = [10000, 20000, 50000, 100000];

    // Pembulatan ke atas terdekat
    const round10k = Math.ceil(total / 10000) * 10000;
    const next10k = round10k === total ? total + 10000 : round10k;

    const round50k = Math.ceil(total / 50000) * 50000;
    const next50k = round50k === total ? total + 50000 : round50k;

    const round100k = Math.ceil(total / 100000) * 100000;
    const next100k = round100k === total ? total + 100000 : round100k;

    const candidates = [
      ...standardBills,
      next10k,
      next50k,
      next100k,
      next100k + 50000,
      next100k + 100000,
      next100k * 2,
    ];

    // Ambil hanya yang lebih besar dari total dan hilangkan duplikat
    const higherUnique = Array.from(
      new Set(candidates.filter((amt) => amt > total))
    ).sort((a, b) => a - b);

    for (const amt of higherUnique) {
      if (list.length >= 4) break;
      const label = amt >= 1000000
        ? `Rp ${(amt / 1000000).toLocaleString('id-ID')}jt`
        : `Rp ${(amt / 1000).toLocaleString('id-ID')}rb`;
      list.push({ label, amount: amt });
    }

    while (list.length < 4) {
      const lastAmt = list[list.length - 1].amount;
      const step = lastAmt < 100000 ? 50000 : 100000;
      const nextAmt = lastAmt + step;
      const label = nextAmt >= 1000000
        ? `Rp ${(nextAmt / 1000000).toLocaleString('id-ID')}jt`
        : `Rp ${(nextAmt / 1000).toLocaleString('id-ID')}rb`;
      list.push({ label, amount: nextAmt });
    }

    return list;
  }, [total]);

  return (
    <>
      <View style={styles.colSummary}>
        <Pressable onPress={onBack} style={styles.backRow}>
          <ThemedText style={{ color: Colors.tint, fontWeight: '600' }}>← Kembali</ThemedText>
        </Pressable>
        <ThemedText type="title" style={{ fontSize: 16, marginBottom: 8 }}>
          Ringkasan Pesanan
        </ThemedText>
        <FlatList
          data={cart}
          keyExtractor={(item) => item.product_id.toString()}
          renderItem={({ item }) => (
            <View style={styles.summaryItem}>
              <ThemedText style={{ flex: 1, fontSize: 12 }}>{item.product_name}</ThemedText>
              <ThemedText style={{ fontSize: 12, color: Colors.muted }}>x{item.quantity}</ThemedText>
              <ThemedText style={{ fontSize: 12, fontWeight: '600' }}>
                Rp {item.subtotal.toLocaleString('id-ID')}
              </ThemedText>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        />
        <View style={[styles.totalRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: Colors.border }]}>
          <ThemedText type="defaultSemiBold">Total Tagihan</ThemedText>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 18, color: Colors.tint }}>
            Rp {total.toLocaleString('id-ID')}
          </ThemedText>
        </View>
      </View>

      <View style={styles.colPayment}>
        <View style={styles.paymentMethods}>
          <Pressable
            style={[styles.paymentBtn, paymentMethod === 'tunai' && styles.paymentBtnActive]}
            onPress={() => onChangeMethod('tunai')}
          >
            <ThemedText style={{ fontWeight: '600', color: paymentMethod === 'tunai' ? '#fff' : Colors.text }}>
              💵 Tunai
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.paymentBtn, paymentMethod === 'qris' && styles.paymentBtnActive]}
            onPress={() => onChangeMethod('qris')}
          >
            <ThemedText style={{ fontWeight: '600', color: paymentMethod === 'qris' ? '#fff' : Colors.text }}>
              📱 QRIS
            </ThemedText>
          </Pressable>
        </View>

        {paymentMethod === 'tunai' ? (
          <View style={{ gap: 8, flex: 1, justifyContent: 'center' }}>
            <Card padding={12} style={{ backgroundColor: '#faf5ff', borderColor: Colors.tint + '40' }}>
              <ThemedText style={{ fontSize: 11, color: Colors.muted }}>Uang Diterima:</ThemedText>
              <ThemedText style={[styles.amountText, { color: Colors.tint }]}>
                Rp {formatRupiah(paymentAmount)}
              </ThemedText>
            </Card>
            {parsedAmount >= total && paymentAmount.length > 0 && (
              <View style={styles.changeRow}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', color: Colors.success }}>Kembalian:</ThemedText>
                <ThemedText style={{ fontSize: 18, fontWeight: 'bold', color: Colors.success }}>
                  Rp {change.toLocaleString('id-ID')}
                </ThemedText>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {quickPresets.map((preset, idx) => (
                <Pressable
                  key={idx}
                  style={styles.presetBtn}
                  onPress={() => onSetAmount(preset.amount.toString())}
                >
                  <ThemedText style={{ fontSize: 11, fontWeight: '600' }}>
                    {preset.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.qrisInfo}>
            {qrisImagePath ? (
              <Image
                source={{ uri: qrisImagePath }}
                style={styles.qrisThumbnail}
                resizeMode="contain"
              />
            ) : (
              <ThemedText style={{ textAlign: 'center', fontSize: 44, marginBottom: 4 }}>📱</ThemedText>
            )}
            <ThemedText style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15 }}>
              Scan QRIS Toko
            </ThemedText>
            <ThemedText style={{ textAlign: 'center', fontSize: 13, color: Colors.tint, fontWeight: '700', marginTop: 2 }}>
              Rp {total.toLocaleString('id-ID')}
            </ThemedText>

            <TouchableOpacity
              style={styles.openQrisBtn}
              onPress={onOpenQrisCustomerModal}
            >
              <ThemedText style={styles.openQrisBtnText}>
                🔍 Layar Penuh QRIS Pelanggan
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <Button
          title={paymentMethod === 'tunai' ? 'Konfirmasi Pembayaran' : 'Sudah Masuk / Lunas'}
          disabled={!canConfirm}
          onPress={onConfirm}
        />
      </View>

      {paymentMethod === 'tunai' && (
        <View style={styles.colNumpad}>
          <View style={styles.numpad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['000', '0', 'backspace'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.numpadRow}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [styles.numpadKey, pressed && styles.numpadKeyPressed]}
                    onPress={() => onNumpadPress(key)}
                  >
                    <ThemedText style={styles.numpadKeyText}>
                      {key === 'backspace' ? '⌫' : key}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

function SuccessView({
  total,
  transactionId,
  lastTransaction,
  onDone,
}: {
  total: number;
  transactionId: number;
  lastTransaction: {
    items: CartItem[];
    paymentMethod: 'tunai' | 'qris';
    paymentAmount: number;
    change: number;
  } | null;
  onDone: () => void;
}) {
  const { storeName, storeAddress, storePhone, receiptFooter } = useSettingsStore();
  const { printerTarget, printerName } = usePrinterStore();
  const router = useRouter();
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const handlePrint = async () => {
    if (!printerTarget) {
      Alert.alert('Printer belum terhubung', 'Hubungkan printer di menu Printer terlebih dahulu.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Buka Printer', onPress: () => router.push('/(tabs)/printer') },
      ]);
      return;
    }

    if (!lastTransaction) return;

    try {
      await printReceipt({
        transactionId,
        createdAt: new Date().toISOString(),
        items: lastTransaction.items,
        total,
        paymentMethod: lastTransaction.paymentMethod,
        paymentAmount: lastTransaction.paymentAmount,
        change: lastTransaction.change,
        storeName,
        storeAddress,
        storePhone,
        receiptFooter,
      });
      Alert.alert('Sukses', 'Struk berhasil dicetak');
    } catch {
      Alert.alert('Gagal', 'Cetak struk gagal. Periksa koneksi Bluetooth printer.');
    }
  };

  return (
    <View style={styles.successContainer}>
      <Card padding={24} style={{ alignItems: 'center', gap: 6, maxWidth: 520, width: '92%' }}>
        <ThemedText style={{ fontSize: 48, lineHeight: 54 }}>✅</ThemedText>
        <ThemedText type="title" style={{ textAlign: 'center', color: '#1e1b4b', fontSize: 18 }}>
          Transaksi Berhasil!
        </ThemedText>
        <ThemedText style={{ fontSize: 24, lineHeight: 28, fontWeight: 'bold', color: Colors.success }}>
          Rp {total.toLocaleString('id-ID')}
        </ThemedText>
        <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
          Metode: {lastTransaction?.paymentMethod === 'tunai' ? 'Tunai' : 'QRIS'} • Nota #{transactionId}
        </ThemedText>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, width: '100%' }}>
          <View style={{ flex: 1.1 }}>
            <Button
              title="📄 Tampilkan Struk"
              variant="outline"
              size="sm"
              onPress={() => setShowReceiptModal(true)}
            />
          </View>
          <View style={{ flex: 1.1 }}>
            <Button
              title="🖨️ Cetak Struk"
              variant="outline"
              size="sm"
              onPress={handlePrint}
            />
          </View>
          <View style={{ flex: 0.9 }}>
            <Button
              title="✅ Selesai"
              size="sm"
              onPress={onDone}
            />
          </View>
        </View>

        {!printerName && (
          <ThemedText style={{ fontSize: 10.5, color: Colors.placeholder, marginTop: 2 }}>
            Printer belum terhubung. Anda dapat menggunakan tombol &quot;Tampilkan Struk&quot; untuk melihat nota di layar.
          </ThemedText>
        )}
      </Card>

      {/* MODAL STRUK DIGITAL (ON-SCREEN RECEIPT) */}
      <Modal visible={showReceiptModal} transparent animationType="fade">
        <View style={styles.receiptModalOverlay}>
          <View style={styles.receiptPaper}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18 }}>
              {/* Header Toko */}
              <ThemedText style={styles.receiptStoreName}>{storeName}</ThemedText>
              {storeAddress ? <ThemedText style={styles.receiptStoreMeta}>{storeAddress}</ThemedText> : null}
              {storePhone ? <ThemedText style={styles.receiptStoreMeta}>Telp/WA: {storePhone}</ThemedText> : null}

              <View style={styles.receiptDashedLine} />

              {/* Info Nota */}
              <View style={styles.receiptRowBetween}>
                <ThemedText style={styles.receiptMetaText}>Nota: #{transactionId}</ThemedText>
                <ThemedText style={styles.receiptMetaText}>
                  {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
              </View>

              <View style={styles.receiptDashedLine} />

              {/* Daftar Barang Belanja */}
              {lastTransaction?.items.map((item, idx) => (
                <View key={idx} style={{ marginBottom: 6 }}>
                  <ThemedText style={styles.receiptItemTitle}>{item.product_name}</ThemedText>
                  <View style={styles.receiptRowBetween}>
                    <ThemedText style={styles.receiptItemQty}>
                      {item.quantity} x Rp {item.product_price.toLocaleString('id-ID')}
                    </ThemedText>
                    <ThemedText style={styles.receiptItemSubtotal}>
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </ThemedText>
                  </View>
                </View>
              ))}

              <View style={styles.receiptDashedLine} />

              {/* Rincian Total Pembayaran */}
              <View style={[styles.receiptRowBetween, { marginVertical: 2 }]}>
                <ThemedText style={styles.receiptTotalLabel}>Total Belanja</ThemedText>
                <ThemedText style={styles.receiptTotalVal}>Rp {total.toLocaleString('id-ID')}</ThemedText>
              </View>
              <View style={[styles.receiptRowBetween, { marginVertical: 2 }]}>
                <ThemedText style={styles.receiptMetaText}>
                  {lastTransaction?.paymentMethod === 'tunai' ? 'Tunai (Diterima)' : 'QRIS'}
                </ThemedText>
                <ThemedText style={styles.receiptMetaText}>
                  Rp {(lastTransaction?.paymentAmount ?? total).toLocaleString('id-ID')}
                </ThemedText>
              </View>
              {lastTransaction?.paymentMethod === 'tunai' && (
                <View style={[styles.receiptRowBetween, { marginVertical: 2 }]}>
                  <ThemedText style={[styles.receiptMetaText, { fontWeight: '700', color: Colors.success }]}>
                    Kembalian
                  </ThemedText>
                  <ThemedText style={[styles.receiptMetaText, { fontWeight: '700', color: Colors.success }]}>
                    Rp {(lastTransaction?.change ?? 0).toLocaleString('id-ID')}
                  </ThemedText>
                </View>
              )}

              <View style={styles.receiptDashedLine} />

              {/* Footer Ucapan */}
              <ThemedText style={styles.receiptFooterText}>
                {receiptFooter || 'Terima kasih atas kunjungan Anda!'}
              </ThemedText>
            </ScrollView>

            {/* Action Bar di Bawah Struk */}
            <View style={styles.receiptModalActions}>
              <TouchableOpacity
                style={styles.receiptBtnPrint}
                onPress={handlePrint}
              >
                <ThemedText style={{ color: Colors.tint, fontWeight: '700', fontSize: 12 }}>
                  🖨️ Cetak Struk
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.receiptBtnDone}
                onPress={() => {
                  setShowReceiptModal(false);
                  onDone();
                }}
              >
                <ThemedText style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
                  ✅ Selesai & Tutup
                </ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{ paddingVertical: 8, alignItems: 'center' }}
              onPress={() => setShowReceiptModal(false)}
            >
              <ThemedText style={{ color: Colors.muted, fontSize: 11 }}>Tutup Tampilan</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
// GRID CARD VIEW (Ideal for Kuliner / Menu)
// ─────────────────────────────────────────
function ProductCard({
  product,
  businessMode,
  onPress,
}: {
  product: Product;
  businessMode: BusinessMode;
  onPress: () => void;
}) {
  const isRetail = businessMode === 'retail';
  const isOutOfStock = isRetail && product.has_stock === 1 && product.stock === 0;
  const isLowStock = isRetail && product.has_stock === 1 && product.stock > 0 && product.stock <= 5;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productCard,
        pressed && { opacity: 0.85 },
        isOutOfStock && { opacity: 0.65 },
      ]}
      onPress={onPress}
    >
      {product.image_path ? (
        <Image source={{ uri: product.image_path }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <ThemedText style={{ color: Colors.muted, fontSize: 18 }}>🖼️</ThemedText>
        </View>
      )}
      <ThemedText
        type="defaultSemiBold"
        numberOfLines={2}
        style={{ textAlign: 'center', fontSize: 12 }}
      >
        {product.name}
      </ThemedText>
      <ThemedText style={{ textAlign: 'center', fontSize: 12, color: Colors.tint, fontWeight: '700' }}>
        Rp {product.price.toLocaleString('id-ID')}
      </ThemedText>

      {isOutOfStock && (
        <View style={styles.stockBadgeOut}>
          <ThemedText style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>HABIS</ThemedText>
        </View>
      )}
      {isLowStock && (
        <View style={styles.stockBadgeLow}>
          <ThemedText style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
            Sisa {product.stock}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

// ─────────────────────────────────────────
// COMPACT LIST BUTTON VIEW (Ideal for Retail)
// ─────────────────────────────────────────
function ProductListItem({
  product,
  businessMode,
  onPress,
}: {
  product: Product;
  businessMode: BusinessMode;
  onPress: () => void;
}) {
  const isRetail = businessMode === 'retail';
  const isOutOfStock = isRetail && product.has_stock === 1 && product.stock === 0;
  const isLowStock = isRetail && product.has_stock === 1 && product.stock > 0 && product.stock <= 5;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.productListItem,
        pressed && { backgroundColor: '#f3e8ff' },
        isOutOfStock && { opacity: 0.6 },
      ]}
      onPress={onPress}
    >
      <View style={styles.listItemLeft}>
        <ThemedText type="defaultSemiBold" style={styles.listItemTitle} numberOfLines={1}>
          {product.name}
        </ThemedText>
        <View style={styles.listItemMeta}>
          <ThemedText style={styles.listItemPrice}>
            Rp {product.price.toLocaleString('id-ID')}
          </ThemedText>
          {isRetail && product.has_stock === 1 && (
            <View
              style={[
                styles.listStockBadge,
                isOutOfStock && styles.listStockBadgeOut,
                isLowStock && styles.listStockBadgeLow,
              ]}
            >
              <ThemedText style={styles.listStockBadgeText}>
                {isOutOfStock ? 'Habis' : `Stok: ${product.stock}`}
              </ThemedText>
            </View>
          )}
          {product.category_name && (
            <ThemedText style={styles.listItemCategory}>
              • {product.category_name}
            </ThemedText>
          )}
        </View>
      </View>

      <View style={styles.listItemAddBtn}>
        <ThemedText style={styles.listItemAddText}>+ Tambah</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 1.3,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  rightPanel: {
    flex: 0.9,
    padding: 12,
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  rightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  // Top Controls: Search Bar & Toggle View Mode
  topControlRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  viewToggleBtn: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#d8b4fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.tintDark,
  },
  scanBarcodeBtn: {
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBarcodeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  qtyTouchBadge: {
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyTouchText: {
    fontWeight: '700',
    fontSize: 12,
    color: Colors.tintDark,
    textAlign: 'center',
  },

  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  categoryChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  productGrid: { paddingBottom: 16 },
  productCard: {
    flex: 1,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    gap: 4,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  cardImage: { width: 64, height: 64, borderRadius: 8 },
  cardImagePlaceholder: {
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBadgeOut: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.danger,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stockBadgeLow: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.warning,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  // Compact List Button Styles
  productList: { paddingBottom: 16, gap: 6 },
  productListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Shadows.sm,
  },
  listItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  listItemTitle: {
    fontSize: 13,
    color: '#1e293b',
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  listItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.tint,
  },
  listItemCategory: {
    fontSize: 10,
    color: Colors.placeholder,
  },
  listStockBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  listStockBadgeOut: {
    backgroundColor: '#fee2e2',
  },
  listStockBadgeLow: {
    backgroundColor: '#fef3c7',
  },
  listStockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  listItemAddBtn: {
    backgroundColor: Colors.tint,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listItemAddText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  emptyText: { textAlign: 'center', marginTop: 24, color: Colors.muted, fontSize: 13 },
  cartList: { flexGrow: 0 },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cartItemInfo: { flex: 1, gap: 2 },
  cartItemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  removeBtn: {
    padding: 4,
  },
  footer: { marginTop: 12, gap: 10 },

  // Step 2 — 3 columns
  colSummary: { flex: 1, padding: 12 },
  colPayment: {
    flex: 0.9,
    padding: 12,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    justifyContent: 'space-between',
  },
  colNumpad: {
    flex: 0.7,
    padding: 8,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    justifyContent: 'center',
  },

  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backRow: { marginBottom: 12 },

  paymentMethods: { flexDirection: 'row', gap: 8 },
  paymentBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  paymentBtnActive: { backgroundColor: Colors.tint, borderColor: Colors.tint },

  amountText: { fontSize: 26, lineHeight: 32, fontWeight: 'bold', textAlign: 'right' },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: Colors.successBg,
    marginBottom: 8,
  },

  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },

  qrisInfo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  qrisThumbnail: {
    width: 110,
    height: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
    backgroundColor: '#ffffff',
  },
  openQrisBtn: {
    marginTop: 10,
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  openQrisBtnText: {
    color: Colors.tintDark,
    fontWeight: '700',
    fontSize: 12,
  },

  // Numpad
  numpad: { gap: 0 },
  numpadRow: { flexDirection: 'row' },
  numpadKey: {
    flex: 1,
    height: 50,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  numpadKeyPressed: { backgroundColor: '#f1f5f9' },
  numpadKeyText: { fontSize: 20, fontWeight: '600', color: '#1e293b' },

  // Success
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },

  // Digital Receipt Modal
  receiptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  receiptPaper: {
    width: 380,
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  receiptStoreName: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0f172a',
  },
  receiptStoreMeta: {
    fontSize: 11,
    textAlign: 'center',
    color: '#64748b',
    marginTop: 2,
  },
  receiptDashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  receiptRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptMetaText: {
    fontSize: 11,
    color: '#475569',
  },
  receiptItemTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1e293b',
  },
  receiptItemQty: {
    fontSize: 11,
    color: '#64748b',
  },
  receiptItemSubtotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  receiptTotalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.tint,
  },
  receiptFooterText: {
    fontSize: 11,
    textAlign: 'center',
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
  },
  receiptModalActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  receiptBtnPrint: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.tint,
    alignItems: 'center',
    backgroundColor: '#faf5ff',
  },
  receiptBtnDone: {
    flex: 1.2,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.tint,
  },
});
