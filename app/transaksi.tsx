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
import { useDebtReceivableStore } from '@/stores/debtReceivableStore';
import { printReceipt, formatInvoice } from '@/services/print';
import { useShiftStore } from '@/stores/shiftStore';
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
import { DiscountModal } from '@/components/discount-modal';
import { QrisDisplayModal } from '@/components/qris-display-modal';
import { WeightedProductModal } from '@/components/weighted-product-modal';
import { EditCartPriceModal } from '@/components/edit-cart-price-modal';
import { RealtimeClockBadge } from '@/components/realtime-clock-badge';

export default function TransactionScreen() {
  const router = useRouter();
  useLockOrientation(ScreenOrientation.OrientationLock.LANDSCAPE);

  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { products, loadProducts } = useProductStore();
  const { categories, loadCategories } = useCategoryStore();
  const {
    cart,
    discount,
    setDiscount,
    clearDiscount,
    getDiscountAmount,
    addToCart,
    updateQuantity,
    removeFromCart,
    checkout,
    pendingOrders,
    loadPendingOrders,
    holdCurrentCart,
    resumePendingOrder,
    deletePendingOrder,
  } = useTransactionStore();
  const {
    loadSettings,
    businessMode,
    defaultViewMode,
    setDefaultViewMode,
    qrisImagePath,
    storeName,
    storePhone2,
    currentUserRole,
    taxEnabled,
    taxName,
    taxType,
    taxRate,
  } = useSettingsStore();
  const { currentShift } = useShiftStore();

  const { width } = useWindowDimensions();
  // Responsif tablet landscape: lebar >= 1050 (4 kolom), >= 720 (3 kolom), lainnya 2 kolom
  const gridColumns = width >= 1050 ? 4 : width >= 720 ? 3 : 2;

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [paymentMethod, setPaymentMethod] = useState<'tunai' | 'qris' | 'hutang'>('tunai');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [selectedPendingCustomerId, setSelectedPendingCustomerId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successTotal, setSuccessTotal] = useState(0);
  const [successDailySeq, setSuccessDailySeq] = useState(0);

  // Pajak / Biaya Tambahan Kasir
  const [isTaxActive, setIsTaxActive] = useState(taxEnabled);

  useEffect(() => {
    setIsTaxActive(taxEnabled);
  }, [taxEnabled]);

  const [lastTransaction, setLastTransaction] = useState<{
    items: CartItem[];
    paymentMethod: 'tunai' | 'qris' | 'hutang';
    paymentAmount: number;
    change: number;
    customerName?: string;
    subtotalAmount?: number;
    discountAmount?: number;
    taxAmount?: number;
    taxName?: string;
    taxRate?: number;
    taxType?: 'percent' | 'nominal' | 'none';
    cashierName?: string;
    shiftId?: number | null;
  } | null>(null);

  // Fase 4 Modals: Barcode Scanner, Bulk Qty, QRIS Fullscreen, Diskon
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [bulkQtyTarget, setBulkQtyTarget] = useState<CartItem | null>(null);
  const [showBulkQtyModal, setShowBulkQtyModal] = useState(false);
  const [showQrisCustomerModal, setShowQrisCustomerModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  // Fitur Pending Order / Parkir Transaksi
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdNote, setHoldNote] = useState('');
  const [showPendingListModal, setShowPendingListModal] = useState(false);

  // Modal Timbangan & Edit Harga Keranjang
  const [showWeightedModal, setShowWeightedModal] = useState(false);
  const [weightedTarget, setWeightedTarget] = useState<{
    product: Product;
    initialWeightGram?: number;
    initialPricePerKg?: number;
    isEditing?: boolean;
  } | null>(null);

  const [showEditPriceModal, setShowEditPriceModal] = useState(false);
  const [editPriceTarget, setEditPriceTarget] = useState<{
    productId: number;
    productName: string;
    currentPrice: number;
    quantity: number;
    isWeighted?: boolean;
    weightGram?: number;
  } | null>(null);

  const { customers, loadCustomers, addCustomer } = useDebtReceivableStore();

  useEffect(() => {
    loadProducts(db);
    loadCategories(db);
    loadSettings(db);
    loadPendingOrders(db);
    loadCustomers(db);
  }, [db, loadProducts, loadCategories, loadSettings, loadPendingOrders, loadCustomers]);

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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchCat;

    const tokens = q.split(/\s+/).filter(Boolean);
    let barcodesStr = p.barcode || '';
    if (p.barcodes) {
      try {
        const list: string[] = JSON.parse(p.barcodes);
        if (Array.isArray(list)) barcodesStr += ' ' + list.join(' ');
      } catch {
        barcodesStr += ' ' + p.barcodes;
      }
    }
    const searchTarget = `${p.name} ${barcodesStr}`.toLowerCase();
    const matchSearch = tokens.every((token) => searchTarget.includes(token));
    return matchCat && matchSearch;
  });

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = getDiscountAmount();
  const taxAmount = isTaxActive
    ? taxType === 'percent'
      ? Math.round(((subtotal - discountAmount) * taxRate) / 100)
      : taxRate
    : 0;
  const total = Math.max(0, subtotal - discountAmount + taxAmount);
  const parsedAmount = parseInt(paymentAmount.replace(/\./g, ''), 10) || 0;
  const change = Math.max(0, parsedAmount - total);
  const totalCartPcs = cart.reduce(
    (sum, item) =>
      sum +
      (item.is_weighted === 1
        ? item.weight_gram
          ? Number((item.weight_gram / 1000).toFixed(2))
          : 1
        : item.quantity),
    0
  );

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

    let targetCustomerId = selectedCustomerId;
    let targetCustomerName = '';

    if (paymentMethod === 'hutang') {
      if (!targetCustomerId && quickCustomerName.trim()) {
        targetCustomerId = await addCustomer(db, quickCustomerName.trim());
        targetCustomerName = quickCustomerName.trim();
      } else if (targetCustomerId) {
        const c = customers.find((cust) => cust.id === targetCustomerId);
        targetCustomerName = c ? c.name : 'Pelanggan';
      } else {
        Alert.alert('Pilih Pelanggan', 'Pilih nama pelanggan yang berhutang terlebih dahulu!');
        return;
      }
    }

    const activeCashierName = currentShift?.cashier_name || (currentUserRole === 'pemilik' ? 'Pemilik' : 'Kasir');
    const activeShiftId = currentShift?.id ?? null;

    setSuccessTotal(total);
    setLastTransaction({
      items: [...cart],
      paymentMethod,
      paymentAmount: paymentMethod === 'hutang' ? 0 : (parsedAmount || total),
      change: paymentMethod === 'hutang' ? 0 : change,
      customerName: targetCustomerName,
      subtotalAmount: subtotal,
      discountAmount: discountAmount,
      taxAmount: isTaxActive ? taxAmount : 0,
      taxName: isTaxActive ? taxName : '',
      taxRate: isTaxActive ? taxRate : 0,
      taxType: isTaxActive ? taxType : 'none',
      cashierName: activeCashierName,
      shiftId: activeShiftId,
    });
    const dailySeq = await checkout(
      db,
      paymentMethod,
      paymentMethod === 'hutang' ? 0 : (parsedAmount || total),
      targetCustomerId,
      activeCashierName,
      activeShiftId,
      {
        enabled: isTaxActive,
        name: taxName,
        type: taxType,
        rate: taxRate,
        amount: taxAmount,
      }
    );
    setSuccessDailySeq(dailySeq);
    setPaymentAmount('');
    setQuickCustomerName('');
    setSelectedCustomerId(null);
    setShowSuccess(true);
  };

  const handleSelesaiMenjual = () => {
    router.back();
  };

  const handleDone = () => {
    setStep(1);
    setShowSuccess(false);
    setPaymentAmount('');
    setQuickCustomerName('');
    setSelectedCustomerId(null);
    setLastTransaction(null);
  };

  const handleHoldCart = async () => {
    if (cart.length === 0) return;
    const cust = customers.find((c) => c.id === selectedPendingCustomerId);
    const note = cust
      ? cust.name + (holdNote.trim() ? ` - ${holdNote.trim()}` : '')
      : (holdNote.trim() || 'Pelanggan');
    const success = await holdCurrentCart(db, note);
    if (success) {
      setHoldNote('');
      setSelectedPendingCustomerId(null);
      setShowHoldModal(false);
      Alert.alert('Pesanan Di-pending', 'Pesanan berhasil disimpan di daftar pending / antrean.');
    }
  };

  const handleResumePendingOrder = async (orderId: number) => {
    if (cart.length > 0) {
      Alert.alert(
        'Keranjang Tidak Kosong',
        'Masih ada produk di keranjang saat ini. Apakah ingin menimpa keranjang dengan pesanan ini?',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Timpa Keranjang',
            style: 'destructive',
            onPress: async () => {
              await resumePendingOrder(db, orderId);
              setShowPendingListModal(false);
            },
          },
        ]
      );
      return;
    }
    await resumePendingOrder(db, orderId);
    setShowPendingListModal(false);
  };

  const handleDeletePendingOrder = (orderId: number) => {
    Alert.alert(
      'Hapus Pesanan Tertunda',
      'Apakah Anda yakin ingin membatalkan dan menghapus pesanan tertunda ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await deletePendingOrder(db, orderId);
          },
        },
      ]
    );
  };

  const handleAddToCartWithValidation = (product: Product) => {
    if (product.is_weighted === 1) {
      setWeightedTarget({
        product,
        initialWeightGram: 1000,
        initialPricePerKg: product.price,
        isEditing: false,
      });
      setShowWeightedModal(true);
      return;
    }
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

  const handleOpenEditWeight = (item: CartItem) => {
    const prod = products.find((p) => p.id === item.product_id);
    if (prod) {
      setWeightedTarget({
        product: prod,
        initialWeightGram: item.weight_gram || 1000,
        initialPricePerKg: item.price_per_kg || prod.price,
        isEditing: true,
      });
      setShowWeightedModal(true);
    }
  };

  const handleConfirmWeight = (weightGram: number, pricePerKg: number) => {
    if (weightedTarget) {
      const existing = cart.find((c) => c.product_id === weightedTarget.product.id);
      if (existing) {
        useTransactionStore.getState().updateCartItemWeight(weightedTarget.product.id, weightGram, pricePerKg);
      } else {
        addToCart(weightedTarget.product, { weight_gram: weightGram, price_per_kg: pricePerKg });
      }
    }
    setShowWeightedModal(false);
    setWeightedTarget(null);
  };

  const handleOpenEditPrice = (item: CartItem) => {
    setEditPriceTarget({
      productId: item.product_id,
      productName: item.product_name,
      currentPrice: item.product_price,
      quantity: item.quantity,
      isWeighted: item.is_weighted === 1,
      weightGram: item.weight_gram,
    });
    setShowEditPriceModal(true);
  };

  const handleConfirmEditPrice = (newPrice: number) => {
    if (editPriceTarget) {
      useTransactionStore.getState().updateCartItemPrice(editPriceTarget.productId, newPrice);
    }
    setShowEditPriceModal(false);
    setEditPriceTarget(null);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (q.trim().length > 0 && selectedCategoryId !== null) {
      setSelectedCategoryId(null);
    }
  };

  const handleBarcodeScanned = (code: string) => {
    const trimmed = code.trim();
    if (selectedCategoryId !== null) {
      setSelectedCategoryId(null);
    }
    const matched =
      useProductStore.getState().findProductByBarcode(trimmed) ||
      products.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      handleAddToCartWithValidation(matched);
    } else {
      setSearchQuery(trimmed);
      Alert.alert(
        'Produk Tidak Ditemukan Langsung',
        `Barcode "${code}" tidak cocok persis dan dimasukkan ke pencarian.`
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
          onSearchChange={handleSearchChange}
          viewMode={viewMode}
          onToggleViewMode={handleToggleViewMode}
          businessMode={businessMode}
          filteredProducts={filteredProducts}
          cart={cart}
          subtotal={subtotal}
          discountAmount={discountAmount}
          discount={discount}
          total={total}
          totalCartPcs={totalCartPcs}
          isTaxActive={isTaxActive}
          taxName={taxName}
          taxType={taxType}
          taxRate={taxRate}
          taxAmount={taxAmount}
          onToggleTax={() => setIsTaxActive(!isTaxActive)}
          gridColumns={gridColumns}
          pendingCount={pendingOrders.length}
          onAddToCart={handleAddToCartWithValidation}
          onUpdateQty={(id, qty) => updateQuantity(id, qty)}
          onRemove={(id) => removeFromCart(id)}
          onOpenBarcodeScanner={() => setShowBarcodeScanner(true)}
          onOpenBulkQty={handleOpenBulkQty}
          onOpenHoldModal={() => setShowHoldModal(true)}
          onOpenPendingListModal={() => setShowPendingListModal(true)}
          onOpenEditPrice={handleOpenEditPrice}
          onOpenEditWeight={handleOpenEditWeight}
          onOpenDiscount={() => setShowDiscountModal(true)}
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
          subtotal={subtotal}
          discountAmount={discountAmount}
          total={total}
          totalCartPcs={totalCartPcs}
          isTaxActive={isTaxActive}
          taxName={taxName}
          taxType={taxType}
          taxRate={taxRate}
          taxAmount={taxAmount}
          paymentMethod={paymentMethod}
          paymentAmount={paymentAmount}
          parsedAmount={parsedAmount}
          change={change}
          qrisImagePath={qrisImagePath}
          storeName={storeName}
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelectCustomer={setSelectedCustomerId}
          quickCustomerName={quickCustomerName}
          onChangeQuickCustomerName={setQuickCustomerName}
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

      {/* Modal Pending Pesanan / Pending Order */}
      <Modal
        visible={showHoldModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHoldModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.holdModalCard}>
            <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 4 }}>
              ⏳ Pending Pesanan (Order Ditunda)
            </ThemedText>
            <ThemedText style={{ fontSize: 12, color: Colors.muted, marginBottom: 14 }}>
              Pesanan saat ini akan disimpan sementara ke antrean pending. Kasir dapat melayani pelanggan lain.
            </ThemedText>

            <View style={styles.holdInputBox}>
              <ThemedText style={{ fontSize: 12, fontWeight: '700', marginBottom: 6, color: '#334155' }}>
                Pilih Nama Pelanggan:
              </ThemedText>
              {customers.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 2, marginBottom: 8 }}
                >
                  {customers.map((c) => {
                    const isSelected = selectedPendingCustomerId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipActive,
                        ]}
                        onPress={() => setSelectedPendingCustomerId(isSelected ? null : c.id)}
                      >
                        <ThemedText
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextActive,
                          ]}
                        >
                          👤 {c.name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <ThemedText style={{ fontSize: 11, color: Colors.muted, marginBottom: 4 }}>
                Catatan Tambahan (Opsional):
              </ThemedText>
              <TextInput
                value={holdNote}
                onChangeText={setHoldNote}
                placeholder="Contoh: Diambil sore / titip dulu..."
                placeholderTextColor={Colors.placeholder}
                style={styles.holdTextInput}
              />
            </View>

            <View style={styles.holdSummaryBox}>
              <ThemedText style={{ fontSize: 12, color: Colors.muted }}>
                Total Item: {cart.reduce((s, i) => s + i.quantity, 0)} pcs ({cart.length} item)
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: Colors.tint }}>
                Rp {total.toLocaleString('id-ID')}
              </ThemedText>
            </View>

            <View style={styles.holdModalActions}>
              <TouchableOpacity
                style={styles.holdCancelBtn}
                onPress={() => {
                  setHoldNote('');
                  setSelectedPendingCustomerId(null);
                  setShowHoldModal(false);
                }}
              >
                <ThemedText style={styles.holdCancelBtnText}>Batal</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.holdConfirmBtn}
                onPress={handleHoldCart}
              >
                <ThemedText style={styles.holdConfirmBtnText}>Simpan Pending</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Modal Daftar Pesanan Pending / Pending Orders */}
      <Modal
        visible={showPendingListModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPendingListModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.pendingListCard}>
            <View style={styles.pendingListHeader}>
              <View>
                <ThemedText type="subtitle" style={{ fontSize: 16 }}>
                  📋 Daftar Pesanan Pending ({pendingOrders.length})
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                  Pilih pesanan pending untuk melanjutkan transaksi atau batalkan antrean.
                </ThemedText>
              </View>
              <TouchableOpacity
                style={styles.pendingCloseBtn}
                onPress={() => setShowPendingListModal(false)}
              >
                <ThemedText style={{ fontSize: 16, fontWeight: '700', color: Colors.muted }}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            {pendingOrders.length === 0 ? (
              <View style={styles.pendingEmptyBox}>
                <ThemedText style={{ fontSize: 36, marginBottom: 8 }}>☕</ThemedText>
                <ThemedText style={{ fontSize: 13, color: Colors.muted }}>
                  Tidak ada pesanan yang sedang ditahan.
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360, marginTop: 8 }}>
                {pendingOrders.map((order) => {
                  const itemsSummary = (order.items || [])
                    .map((it) => `${it.quantity}x ${it.product_name}`)
                    .join(', ');
                  const formattedTime = new Date(order.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <View key={order.id} style={styles.pendingOrderItem}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ThemedText type="defaultSemiBold" style={{ fontSize: 13 }}>
                            {order.note}
                          </ThemedText>
                          <View style={styles.pendingTimeBadge}>
                            <ThemedText style={styles.pendingTimeBadgeText}>{formattedTime}</ThemedText>
                          </View>
                        </View>
                        <ThemedText style={styles.pendingItemsText} numberOfLines={2}>
                          {itemsSummary || 'Tidak ada detail item'}
                        </ThemedText>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 13, color: Colors.tint, marginTop: 2 }}>
                          Rp {order.total_amount.toLocaleString('id-ID')}
                        </ThemedText>
                      </View>

                      <View style={styles.pendingItemActions}>
                        <TouchableOpacity
                          style={styles.pendingResumeBtn}
                          onPress={() => handleResumePendingOrder(order.id)}
                        >
                          <ThemedText style={styles.pendingResumeBtnText}>Buka</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.pendingDeleteBtn}
                          onPress={() => handleDeletePendingOrder(order.id)}
                        >
                          <ThemedText style={styles.pendingDeleteBtnText}>✕</ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <Button
                title="Tutup"
                variant="outline"
                size="sm"
                onPress={() => setShowPendingListModal(false)}
              />
            </View>
          </ThemedView>
        </View>
      </Modal>
      {/* Modal Timbangan Produk (Poin 4) */}
      <WeightedProductModal
        visible={showWeightedModal}
        productName={weightedTarget?.product.name || ''}
        defaultPricePerKg={weightedTarget?.initialPricePerKg || weightedTarget?.product.price || 0}
        initialPricePerKg={weightedTarget?.initialPricePerKg}
        initialWeightGram={weightedTarget?.initialWeightGram || 1000}
        isEditing={weightedTarget?.isEditing}
        onClose={() => {
          setShowWeightedModal(false);
          setWeightedTarget(null);
        }}
        onConfirm={handleConfirmWeight}
      />

      {/* Modal Ubah Harga Keranjang (Poin 10) */}
      {editPriceTarget && (
        <EditCartPriceModal
          visible={showEditPriceModal}
          productName={editPriceTarget.productName}
          currentPrice={editPriceTarget.currentPrice}
          quantity={editPriceTarget.quantity}
          isWeighted={editPriceTarget.isWeighted}
          weightGram={editPriceTarget.weightGram}
          onClose={() => {
            setShowEditPriceModal(false);
            setEditPriceTarget(null);
          }}
          onSavePrice={handleConfirmEditPrice}
        />
      )}

      {/* Modal Diskon Transaksi */}
      <DiscountModal
        visible={showDiscountModal}
        subtotal={subtotal}
        currentDiscount={discount}
        onClose={() => setShowDiscountModal(false)}
        onApplyDiscount={(val, type) => setDiscount(val, type)}
        onClearDiscount={clearDiscount}
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
  subtotal,
  discountAmount,
  discount,
  total,
  totalCartPcs,
  isTaxActive,
  taxName,
  taxType,
  taxRate,
  taxAmount,
  onToggleTax,
  gridColumns,
  pendingCount,
  onAddToCart,
  onUpdateQty,
  onRemove,
  onOpenBarcodeScanner,
  onOpenBulkQty,
  onOpenHoldModal,
  onOpenPendingListModal,
  onOpenEditPrice,
  onOpenEditWeight,
  onOpenDiscount,
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
  subtotal: number;
  discountAmount: number;
  discount: { type: 'nominal' | 'percent'; value: number } | null;
  total: number;
  totalCartPcs: number;
  isTaxActive: boolean;
  taxName: string;
  taxType: 'percent' | 'nominal';
  taxRate: number;
  taxAmount: number;
  onToggleTax: () => void;
  gridColumns: number;
  pendingCount: number;
  onAddToCart: (p: Product) => void;
  onUpdateQty: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  onOpenBarcodeScanner: () => void;
  onOpenBulkQty: (item: CartItem) => void;
  onOpenHoldModal: () => void;
  onOpenPendingListModal: () => void;
  onOpenEditPrice: (item: CartItem) => void;
  onOpenEditWeight: (item: CartItem) => void;
  onOpenDiscount: () => void;
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThemedText type="title" style={{ fontSize: 17, fontWeight: '800' }}>Keranjang</ThemedText>
            {pendingCount > 0 && (
              <TouchableOpacity
                style={styles.pendingBadgeHeader}
                onPress={onOpenPendingListModal}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.pendingBadgeHeaderText}>⏳ {pendingCount}</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <RealtimeClockBadge compact />
            {pendingCount > 0 && (
              <TouchableOpacity
                style={styles.pendingListBtn}
                onPress={onOpenPendingListModal}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.pendingListBtnText}>Antrean ({pendingCount})</ThemedText>
              </TouchableOpacity>
            )}
            <Button title="Selesai" variant="outline" size="sm" onPress={onDone} />
          </View>
        </View>

        {/* Sub-bar Informasi Keranjang: Jumlah Jenis Produk & Total Pcs */}
        <View style={styles.cartCountBar}>
          <View style={styles.cartCountBadge}>
            <ThemedText style={styles.cartCountBadgeText}>
              📦 {cart.length} Jenis Produk
            </ThemedText>
          </View>
          <View style={[styles.cartCountBadge, { backgroundColor: '#ede9fe', borderColor: '#ddd6fe' }]}>
            <ThemedText style={[styles.cartCountBadgeText, { color: Colors.tintDark }]}>
              🔢 {totalCartPcs} Total Pcs
            </ThemedText>
          </View>
        </View>

        <FlatList
          data={cart}
          keyExtractor={(item) => item.product_id.toString()}
          contentContainerStyle={styles.cartList}
          renderItem={({ item }) => (
            <Card padding={10} style={{ marginBottom: 6 }}>
              <View style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }} numberOfLines={1}>
                    {item.product_name}
                  </ThemedText>

                  {/* Berat Timbangan (Bila produk timbangan) */}
                  {item.is_weighted === 1 ? (
                    <TouchableOpacity
                      style={styles.cartWeightChip}
                      onPress={() => onOpenEditWeight(item)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={styles.cartWeightChipText}>
                        ⚖️ {item.weight_gram || 0}g ({((item.weight_gram || 0) / 1000).toFixed(2)}kg)
                      </ThemedText>
                      <ThemedText style={styles.cartWeightEditHint}>Ubah Berat</ThemedText>
                    </TouchableOpacity>
                  ) : null}

                  {/* Harga Satuan yang dapat di-override kasir */}
                  <TouchableOpacity
                    style={styles.cartPriceChip}
                    onPress={() => onOpenEditPrice(item)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={styles.cartPriceChipText}>
                      {item.is_weighted === 1
                        ? `@ Rp ${(item.price_per_kg || item.product_price).toLocaleString('id-ID')}/kg`
                        : `Rp ${item.product_price.toLocaleString('id-ID')} x ${item.quantity}`}
                    </ThemedText>
                    <ThemedText style={styles.cartPriceEditHint}>✏️ Ubah Harga</ThemedText>
                  </TouchableOpacity>

                  <ThemedText type="defaultSemiBold" style={{ fontSize: 12, color: Colors.tint }}>
                    Rp {item.subtotal.toLocaleString('id-ID')}
                  </ThemedText>
                </View>

                <View style={styles.cartItemActions}>
                  {item.is_weighted === 1 ? (
                    <TouchableOpacity
                      style={styles.reweightBtn}
                      onPress={() => onOpenEditWeight(item)}
                    >
                      <ThemedText style={styles.reweightBtnText}>⚖️ Timbang</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <>
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
                    </>
                  )}
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
          {(discountAmount > 0 || (isTaxActive && taxAmount > 0)) ? (
            <View style={{ marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ThemedText style={{ fontSize: 11, color: Colors.muted }}>Subtotal</ThemedText>
                <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                  Rp {subtotal.toLocaleString('id-ID')}
                </ThemedText>
              </View>
              {discountAmount > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <TouchableOpacity onPress={onOpenDiscount} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ThemedText style={{ fontSize: 11, color: Colors.danger, fontWeight: '700' }}>
                      🏷️ Diskon ({discount?.type === 'percent' ? `${discount.value}%` : 'Nominal'})
                    </ThemedText>
                    <ThemedText style={{ fontSize: 10, color: Colors.tint }}>✏️</ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={{ fontSize: 11, color: Colors.danger, fontWeight: '700' }}>
                    -Rp {discountAmount.toLocaleString('id-ID')}
                  </ThemedText>
                </View>
              ) : null}
              {isTaxActive && taxAmount > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <TouchableOpacity onPress={onToggleTax} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ThemedText style={{ fontSize: 11, color: Colors.tintDark, fontWeight: '700' }}>
                      🧾 {taxName} ({taxType === 'percent' ? `${taxRate}%` : 'Nominal'})
                    </ThemedText>
                    <ThemedText style={{ fontSize: 10, color: '#16a34a', fontWeight: '800' }}>[Aktif]</ThemedText>
                  </TouchableOpacity>
                  <ThemedText style={{ fontSize: 11, color: Colors.tintDark, fontWeight: '700' }}>
                    +Rp {taxAmount.toLocaleString('id-ID')}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.totalRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 15 }}>Total</ThemedText>
              <TouchableOpacity
                style={[
                  styles.discountTriggerBtn,
                  discountAmount > 0 && styles.discountTriggerBtnActive,
                ]}
                onPress={onOpenDiscount}
                disabled={cart.length === 0}
                activeOpacity={0.7}
              >
                <ThemedText
                  style={[
                    styles.discountTriggerText,
                    discountAmount > 0 && styles.discountTriggerTextActive,
                  ]}
                >
                  {discountAmount > 0 ? '🏷️ Ubah Diskon' : '+ Diskon'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.discountTriggerBtn,
                  isTaxActive && { backgroundColor: '#ede9fe', borderColor: Colors.tint },
                ]}
                onPress={onToggleTax}
                disabled={cart.length === 0}
                activeOpacity={0.7}
              >
                <ThemedText
                  style={[
                    styles.discountTriggerText,
                    isTaxActive && { color: Colors.tintDark, fontWeight: '800' },
                  ]}
                >
                  {isTaxActive ? '🧾 Pajak ON' : '+ Pajak'}
                </ThemedText>
              </TouchableOpacity>
            </View>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 18, color: Colors.success }}>
              Rp {total.toLocaleString('id-ID')}
            </ThemedText>
          </View>
          <View style={styles.footerActionRow}>
            <TouchableOpacity
              style={[styles.holdCartBtn, cart.length === 0 && styles.holdCartBtnDisabled]}
              disabled={cart.length === 0}
              onPress={onOpenHoldModal}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.holdCartBtnText, cart.length === 0 && styles.holdCartBtnTextDisabled]}>
                ⏳ Pending
              </ThemedText>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Button
                title="Lanjut Bayar ›"
                disabled={cart.length === 0}
                onPress={onNext}
              />
            </View>
          </View>
        </View>
      </View>
    </>
  );
}

function Step2View({
  cart,
  subtotal,
  discountAmount,
  total,
  totalCartPcs,
  isTaxActive,
  taxName,
  taxType,
  taxRate,
  taxAmount,
  paymentMethod,
  paymentAmount,
  parsedAmount,
  change,
  qrisImagePath,
  storeName,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  quickCustomerName,
  onChangeQuickCustomerName,
  onChangeMethod,
  onNumpadPress,
  onSetAmount,
  onOpenQrisCustomerModal,
  onBack,
  onConfirm,
}: {
  cart: CartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  totalCartPcs: number;
  isTaxActive: boolean;
  taxName: string;
  taxType: 'percent' | 'nominal';
  taxRate: number;
  taxAmount: number;
  paymentMethod: 'tunai' | 'qris' | 'hutang';
  paymentAmount: string;
  parsedAmount: number;
  change: number;
  qrisImagePath: string;
  storeName: string;
  customers: { id: number; name: string; phone?: string }[];
  selectedCustomerId: number | null;
  onSelectCustomer: (id: number | null) => void;
  quickCustomerName: string;
  onChangeQuickCustomerName: (name: string) => void;
  onChangeMethod: (m: 'tunai' | 'qris' | 'hutang') => void;
  onNumpadPress: (v: string) => void;
  onSetAmount: (v: string) => void;
  onOpenQrisCustomerModal: () => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const canConfirm =
    paymentMethod === 'qris' ||
    (paymentMethod === 'tunai' && parsedAmount >= total && paymentAmount.length > 0) ||
    (paymentMethod === 'hutang' && (selectedCustomerId !== null || quickCustomerName.trim().length > 0));

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
        <View style={styles.step2TopRow}>
          <Pressable onPress={onBack} hitSlop={6}>
            <ThemedText style={{ color: Colors.tint, fontWeight: '700', fontSize: 13 }}>← Kembali</ThemedText>
          </Pressable>
          <RealtimeClockBadge compact />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <ThemedText type="title" style={{ fontSize: 16, fontWeight: '800' }}>
            Ringkasan Pesanan
          </ThemedText>
          <View style={styles.summaryCountBadge}>
            <ThemedText style={styles.summaryCountBadgeText}>
              {cart.length} Jenis • {totalCartPcs} Pcs
            </ThemedText>
          </View>
        </View>

        <FlatList
          data={cart}
          keyExtractor={(item) => item.product_id.toString()}
          renderItem={({ item }) => (
            <View style={styles.summaryItem}>
              <ThemedText style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>
                {item.product_name}
              </ThemedText>
              <View style={styles.summaryQtyBadge}>
                <ThemedText style={styles.summaryQtyBadgeText}>
                  {item.is_weighted === 1 ? `${item.weight_gram}g` : `${item.quantity}x`}
                </ThemedText>
              </View>
              <ThemedText style={{ fontSize: 13.5, fontWeight: '800', color: '#0f172a' }}>
                Rp {item.subtotal.toLocaleString('id-ID')}
              </ThemedText>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        />
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1.5, borderColor: '#e2e8f0', gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <ThemedText style={{ fontSize: 12.5, color: '#64748b' }}>Subtotal</ThemedText>
            <ThemedText style={{ fontSize: 12.5, color: '#334155', fontWeight: '600' }}>
              Rp {subtotal.toLocaleString('id-ID')}
            </ThemedText>
          </View>
          {discountAmount > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText style={{ fontSize: 12.5, color: Colors.danger, fontWeight: '700' }}>Diskon</ThemedText>
              <ThemedText style={{ fontSize: 12.5, color: Colors.danger, fontWeight: '700' }}>
                -Rp {discountAmount.toLocaleString('id-ID')}
              </ThemedText>
            </View>
          ) : null}
          {isTaxActive && taxAmount > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText style={{ fontSize: 12.5, color: Colors.tintDark, fontWeight: '700' }}>
                {taxName} ({taxType === 'percent' ? `${taxRate}%` : 'Nominal'})
              </ThemedText>
              <ThemedText style={{ fontSize: 12.5, color: Colors.tintDark, fontWeight: '700' }}>
                +Rp {taxAmount.toLocaleString('id-ID')}
              </ThemedText>
            </View>
          ) : null}
          <View style={[styles.totalRow, { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderColor: '#e2e8f0' }]}>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 15, color: '#0f172a' }}>Total Tagihan</ThemedText>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 20, color: '#16a34a', fontWeight: '900' }}>
              Rp {total.toLocaleString('id-ID')}
            </ThemedText>
          </View>
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
              📱 QRIS / Transfer
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.paymentBtn,
              paymentMethod === 'hutang' && [styles.paymentBtnActive, { backgroundColor: '#d97706' }],
            ]}
            onPress={() => onChangeMethod('hutang')}
          >
            <ThemedText style={{ fontWeight: '600', color: paymentMethod === 'hutang' ? '#fff' : Colors.text }}>
              📋 Hutang (Bon)
            </ThemedText>
          </Pressable>
        </View>

        {paymentMethod === 'hutang' ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
            showsVerticalScrollIndicator={false}
          >
            <Card padding={10} style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#92400e', marginBottom: 2 }}>
                📋 Transaksi Hutang / Kasbon Pelanggan
              </ThemedText>
              <ThemedText style={{ fontSize: 11, color: '#78350f' }}>
                Pilih nama pelanggan untuk mencatat piutang toko ke pelanggan tersebut.
              </ThemedText>

              <View style={{ marginTop: 8 }}>
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                  Pilih Pelanggan Terdaftar:
                </ThemedText>
                {customers.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
                  >
                    {customers.map((c) => {
                      const isSelected = selectedCustomerId === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          style={[
                            styles.categoryChip,
                            isSelected && { backgroundColor: '#d97706', borderColor: '#b45309' },
                          ]}
                          onPress={() => {
                            onSelectCustomer(isSelected ? null : c.id);
                            onChangeQuickCustomerName('');
                          }}
                        >
                          <ThemedText
                            style={[
                              styles.categoryChipText,
                              isSelected && { color: '#ffffff', fontWeight: '700' },
                            ]}
                          >
                            👤 {c.name} {c.phone ? `(${c.phone})` : ''}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <ThemedText style={{ fontSize: 11, color: Colors.muted, fontStyle: 'italic' }}>
                    Belum ada pelanggan terdaftar di CRM.
                  </ThemedText>
                )}
              </View>

              <View style={{ marginTop: 8 }}>
                <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                  Atau Input Nama Pelanggan Baru:
                </ThemedText>
                <TextInput
                  style={[styles.holdTextInput, { backgroundColor: '#ffffff', height: 38, fontSize: 12 }]}
                  placeholder="Ketik nama pelanggan baru..."
                  placeholderTextColor={Colors.placeholder}
                  value={quickCustomerName}
                  onChangeText={(val) => {
                    onChangeQuickCustomerName(val);
                    if (val.trim()) {
                      onSelectCustomer(null);
                    }
                  }}
                />
              </View>

              <View style={{ marginTop: 8, padding: 6, backgroundColor: '#fef3c7', borderRadius: 6 }}>
                <ThemedText style={{ fontSize: 11, color: '#92400e', fontWeight: '700' }}>
                  Total Tagihan Hutang: Rp {total.toLocaleString('id-ID')}
                </ThemedText>
                <ThemedText style={{ fontSize: 10, color: '#78350f', marginTop: 1 }}>
                  * Kas fisik tidak bertambah. Piutang otomatis tercatat ke Manajemen Pelanggan.
                </ThemedText>
              </View>
            </Card>
          </ScrollView>
        ) : paymentMethod === 'tunai' ? (
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
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 4 }}
            showsVerticalScrollIndicator={false}
          >
            {qrisImagePath ? (
              <Image
                source={{ uri: qrisImagePath }}
                style={styles.qrisThumbnail}
                resizeMode="contain"
              />
            ) : (
              <ThemedText style={{ textAlign: 'center', fontSize: 38, marginBottom: 2 }}>📱</ThemedText>
            )}
            <ThemedText style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15 }}>
              Scan QRIS / Transfer Bank
            </ThemedText>
            <ThemedText style={{ textAlign: 'center', fontSize: 13.5, color: Colors.tint, fontWeight: '800', marginTop: 2 }}>
              Total Tagihan: Rp {total.toLocaleString('id-ID')}
            </ThemedText>

            {/* Informasi Detail Penerimaan Kas QRIS / Transfer */}
            <View style={styles.qrisDetailCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <ThemedText style={{ fontSize: 13 }}>🏛️</ThemedText>
                <ThemedText style={{ fontSize: 11.5, fontWeight: '800', color: '#1e40af' }}>
                  Penerimaan Kas: Kas di Bank (Rekening Toko)
                </ThemedText>
              </View>

              <View style={{ gap: 3.5 }}>
                <ThemedText style={{ fontSize: 10.5, color: '#1e3a8a' }}>
                  • <ThemedText style={{ fontWeight: '700' }}>Metode Pembayaran:</ThemedText> QRIS / Transfer
                </ThemedText>
                <ThemedText style={{ fontSize: 10.5, color: '#1e3a8a' }}>
                  • <ThemedText style={{ fontWeight: '700' }}>Alur Kas Masuk:</ThemedText> Otomatis tercatat ke <ThemedText style={{ fontWeight: '700', color: '#1d4ed8' }}>Kas di Bank</ThemedText>
                </ThemedText>
                <ThemedText style={{ fontSize: 10.5, color: '#64748b' }}>
                  • <ThemedText style={{ fontWeight: '600' }}>Uang Fisik Kasir:</ThemedText> Tidak bertambah (Non-Tunai)
                </ThemedText>
              </View>

              <View style={{ marginTop: 6, paddingTop: 5, borderTopWidth: 1, borderColor: '#bfdbfe' }}>
                <ThemedText style={{ fontSize: 10, color: '#2563eb', fontStyle: 'italic', textAlign: 'center' }}>
                  💡 Pastikan saldo transfer / QRIS sudah masuk ke rekening toko sebelum konfirmasi.
                </ThemedText>
              </View>
            </View>

            <TouchableOpacity
              style={styles.openQrisBtn}
              onPress={onOpenQrisCustomerModal}
            >
              <ThemedText style={styles.openQrisBtnText}>
                🔍 Layar Penuh QRIS / Transfer Pelanggan
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>
        )}

        <Button
          title={
            paymentMethod === 'hutang'
              ? (canConfirm ? `Konfirmasi Hutang (Rp ${total.toLocaleString('id-ID')})` : 'Pilih Pelanggan Terlebih Dahulu')
              : paymentMethod === 'tunai'
              ? 'Konfirmasi Pembayaran'
              : 'Sudah Masuk / Lunas (QRIS/Transfer)'
          }
          disabled={!canConfirm}
          style={paymentMethod === 'hutang' && canConfirm ? { backgroundColor: '#d97706' } : undefined}
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
    paymentMethod: 'tunai' | 'qris' | 'hutang';
    paymentAmount: number;
    change: number;
    customerName?: string;
    subtotalAmount?: number;
    discountAmount?: number;
    taxAmount?: number;
    taxName?: string;
    taxRate?: number;
    taxType?: 'percent' | 'nominal' | 'none';
    cashierName?: string;
    shiftId?: number | null;
  } | null;
  onDone: () => void;
}) {
  const { storeName, storeAddress, storePhone, storePhone2, receiptFooter } = useSettingsStore();
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
        subtotalAmount: lastTransaction.subtotalAmount,
        discountAmount: lastTransaction.discountAmount,
        taxAmount: lastTransaction.taxAmount,
        taxName: lastTransaction.taxName,
        taxRate: lastTransaction.taxRate,
        taxType: lastTransaction.taxType,
        storeName,
        storeAddress,
        storePhone,
        storePhone2,
        receiptFooter,
        cashierName: lastTransaction.cashierName,
        customerName: lastTransaction.customerName,
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
          Metode: {lastTransaction?.paymentMethod === 'tunai' ? 'Tunai (Kas Fisik)' : lastTransaction?.paymentMethod === 'hutang' ? `Hutang (Bon) • ${lastTransaction.customerName || 'Pelanggan'}` : 'QRIS / Transfer (Kas Bank)'} • {formatInvoice(transactionId, new Date().toISOString())} • Kasir: {lastTransaction?.cashierName || 'Kasir'}
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
              {storePhone ? (
                <ThemedText style={styles.receiptStoreMeta}>
                  Telp: {storePhone}{storePhone2 ? ` | WA: ${storePhone2}` : ''}
                </ThemedText>
              ) : null}

              <View style={styles.receiptDashedLine} />

              {/* Info Nota */}
              <View style={styles.receiptRowBetween}>
                <ThemedText style={styles.receiptMetaText}>
                  No: {formatInvoice(transactionId, new Date().toISOString())}
                </ThemedText>
                <ThemedText style={styles.receiptMetaText}>
                  {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
              </View>
              <View style={styles.receiptRowBetween}>
                <ThemedText style={styles.receiptMetaText}>Kasir: {lastTransaction?.cashierName || 'Kasir'}</ThemedText>
                {lastTransaction?.customerName ? (
                  <ThemedText style={styles.receiptMetaText}>Pelanggan: {lastTransaction.customerName}</ThemedText>
                ) : null}
              </View>

              <View style={styles.receiptDashedLine} />

              {/* Daftar Barang Belanja */}
              {lastTransaction?.items.map((item, idx) => (
                <View key={idx} style={{ marginBottom: 6 }}>
                  <ThemedText style={styles.receiptItemTitle}>{item.product_name}</ThemedText>
                  <View style={styles.receiptRowBetween}>
                    {item.is_weighted === 1 ? (
                      <ThemedText style={styles.receiptItemQty}>
                        {item.weight_gram || 0}g @ Rp {(item.price_per_kg || item.product_price).toLocaleString('id-ID')}/kg
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.receiptItemQty}>
                        {item.quantity} x Rp {item.product_price.toLocaleString('id-ID')}
                      </ThemedText>
                    )}
                    <ThemedText style={styles.receiptItemSubtotal}>
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </ThemedText>
                  </View>
                </View>
              ))}

              <View style={styles.receiptDashedLine} />

              {/* Rincian Total Pembayaran */}
              {lastTransaction?.discountAmount && lastTransaction.discountAmount > 0 ? (
                <>
                  <View style={[styles.receiptRowBetween, { marginVertical: 2 }]}>
                    <ThemedText style={styles.receiptMetaText}>Subtotal</ThemedText>
                    <ThemedText style={styles.receiptMetaText}>
                      Rp {(lastTransaction.subtotalAmount ?? total).toLocaleString('id-ID')}
                    </ThemedText>
                  </View>
                  <View style={[styles.receiptRowBetween, { marginVertical: 2 }]}>
                    <ThemedText style={[styles.receiptMetaText, { color: Colors.danger }]}>Diskon</ThemedText>
                    <ThemedText style={[styles.receiptMetaText, { color: Colors.danger }]}>
                      -Rp {lastTransaction.discountAmount.toLocaleString('id-ID')}
                    </ThemedText>
                  </View>
                </>
              ) : null}

              {lastTransaction?.taxAmount && lastTransaction.taxAmount > 0 ? (
                <View style={[styles.receiptRowBetween, { marginVertical: 2 }]}>
                  <ThemedText style={styles.receiptMetaText}>
                    {lastTransaction.taxName || 'Pajak'}{' '}
                    {lastTransaction.taxType === 'percent' ? `(${lastTransaction.taxRate}%)` : ''}
                  </ThemedText>
                  <ThemedText style={styles.receiptMetaText}>
                    +Rp {lastTransaction.taxAmount.toLocaleString('id-ID')}
                  </ThemedText>
                </View>
              ) : null}

              <View style={[styles.receiptRowBetween, { marginVertical: 2 }]}>
                <ThemedText style={styles.receiptTotalLabel}>Total Belanja</ThemedText>
                <ThemedText style={styles.receiptTotalVal}>Rp {total.toLocaleString('id-ID')}</ThemedText>
              </View>
              <View style={[styles.receiptRowBetween, { marginVertical: 2 }]}>
                <ThemedText style={styles.receiptMetaText}>
                  {lastTransaction?.paymentMethod === 'tunai'
                    ? 'Tunai (Diterima)'
                    : lastTransaction?.paymentMethod === 'hutang'
                    ? `Hutang / Bon: ${lastTransaction.customerName || 'Pelanggan'}`
                    : 'QRIS / Transfer'}
                </ThemedText>
                <ThemedText style={styles.receiptMetaText}>
                  Rp {(lastTransaction?.paymentAmount ?? (lastTransaction?.paymentMethod === 'hutang' ? total : 0)).toLocaleString('id-ID')}
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
  const isWeighted = product.is_weighted === 1;
  const isOutOfStock = !isWeighted && isRetail && product.has_stock === 1 && product.stock === 0;
  const isLowStock = !isWeighted && isRetail && product.has_stock === 1 && product.stock > 0 && product.stock <= 5;

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
          <ThemedText style={{ color: Colors.muted, fontSize: 18 }}>
            {isWeighted ? '⚖️' : '🖼️'}
          </ThemedText>
        </View>
      )}
      <ThemedText
        type="defaultSemiBold"
        numberOfLines={2}
        style={{
          textAlign: 'center',
          fontSize: 13.5,
          fontWeight: '700',
          lineHeight: 18,
          color: '#0f172a',
          paddingHorizontal: 2,
        }}
      >
        {product.name}
      </ThemedText>
      <ThemedText style={{ textAlign: 'center', fontSize: 12.5, color: Colors.tint, fontWeight: '800', marginTop: 1 }}>
        Rp {product.price.toLocaleString('id-ID')} {isWeighted ? '/ kg' : ''}
      </ThemedText>

      {isWeighted && (
        <View style={styles.stockBadgeWeighted}>
          <ThemedText style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>⚖️ Timbangan</ThemedText>
        </View>
      )}
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
  const isWeighted = product.is_weighted === 1;
  const isOutOfStock = !isWeighted && isRetail && product.has_stock === 1 && product.stock === 0;
  const isLowStock = !isWeighted && isRetail && product.has_stock === 1 && product.stock > 0 && product.stock <= 5;

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
            Rp {product.price.toLocaleString('id-ID')} {isWeighted ? '/ kg' : ''}
          </ThemedText>
          {isWeighted ? (
            <View style={styles.listStockBadgeWeighted}>
              <ThemedText style={styles.listStockBadgeWeightedText}>⚖️ Timbangan (kg)</ThemedText>
            </View>
          ) : isRetail && product.has_stock === 1 ? (
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
          ) : null}
          {product.category_name && (
            <ThemedText style={styles.listItemCategory}>
              • {product.category_name}
            </ThemedText>
          )}
        </View>
      </View>

      <View style={[styles.listItemAddBtn, isWeighted && { backgroundColor: '#0284c7' }]}>
        <ThemedText style={styles.listItemAddText}>
          {isWeighted ? '⚖️ Timbang' : '+ Tambah'}
        </ThemedText>
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
    flex: 1.25,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  rightPanel: {
    flex: 0.95,
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
  step2TopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

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
  qrisDetailCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    width: '100%',
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
  pendingBadgeHeader: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  pendingBadgeHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  pendingListBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pendingListBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  holdCartBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdCartBtnDisabled: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  holdCartBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
  },
  holdCartBtnTextDisabled: {
    color: '#94a3b8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  holdModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 14,
    padding: 20,
    backgroundColor: '#ffffff',
    ...Shadows.md,
  },
  holdInputBox: {
    marginVertical: 10,
  },
  holdTextInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
  },
  holdSummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  holdModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  holdCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  holdCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  holdConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Colors.tint,
  },
  holdConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  pendingListCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 14,
    padding: 20,
    backgroundColor: '#ffffff',
    ...Shadows.md,
  },
  pendingListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pendingCloseBtn: {
    padding: 4,
  },
  pendingEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  pendingOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  pendingTimeBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pendingTimeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  pendingItemsText: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  pendingItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingResumeBtn: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  pendingResumeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  pendingDeleteBtn: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  pendingDeleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },
  cartWeightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    gap: 4,
    marginVertical: 1,
  },
  cartWeightChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0369a1',
  },
  cartWeightEditHint: {
    fontSize: 9.5,
    color: '#0284c7',
    textDecorationLine: 'underline',
  },
  cartPriceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 1,
  },
  cartPriceChipText: {
    fontSize: 11,
    color: '#334155',
  },
  cartPriceEditHint: {
    fontSize: 9.5,
    color: Colors.tint,
    fontWeight: '600',
  },
  reweightBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reweightBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  stockBadgeWeighted: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#0284c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  listStockBadgeWeighted: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  listStockBadgeWeightedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
  discountTriggerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  discountTriggerBtnActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  discountTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  discountTriggerTextActive: {
    color: '#dc2626',
  },
  cartCountBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  cartCountBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cartCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
  },
  summaryQtyBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'center',
  },
  summaryQtyBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryCountBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  summaryCountBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1d4ed8',
  },
});
