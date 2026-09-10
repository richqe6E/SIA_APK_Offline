import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLockOrientation } from '@/hooks/use-orientation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  useTransactionStore,
  type PeriodFilter,
  type Transaction,
} from '@/stores/transactionStore';
import { usePrinterStore } from '@/stores/printerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { printReceipt, formatInvoice } from '@/services/print';
import { Colors } from '@/constants/theme';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();

  const {
    transactions,
    loading,
    hasMore,
    loadTransactions,
    cancelTransaction,
    revertAndEditTransaction,
  } = useTransactionStore();

  const { printerTarget } = usePrinterStore();
  const {
    storeName,
    storeAddress,
    storePhone,
    storePhone2,
    receiptFooter,
    appOrientation,
    setAppOrientation,
  } = useSettingsStore();

  const isTabletOrLandscape = width >= 720 || appOrientation === 'landscape';

  useLockOrientation(
    appOrientation === 'landscape'
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT_UP
  );

  const toggleOrientation = async () => {
    const next = appOrientation === 'landscape' ? 'portrait' : 'landscape';
    await setAppOrientation(db, next);
    try {
      if (next === 'landscape') {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    } catch {
      // ignore
    }
  };

  const [selected, setSelected] = useState<Transaction | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    loadTransactions(db, period, 1);
  }, [db, period, loadTransactions]);

  const selectTransaction = async (t: Transaction) => {
    setSelected(t);
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM transaction_items WHERE transaction_id = ?',
      t.id
    );
    setItems(rows);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadTransactions(db, period, nextPage);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrint = async (t: Transaction) => {
    if (!printerTarget) {
      Alert.alert('Printer belum terhubung', 'Hubungkan printer di tab Printer terlebih dahulu.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Buka Printer', onPress: () => router.push('/(tabs)/printer') },
      ]);
      return;
    }

    try {
      await printReceipt({
        transactionId: t.id,
        createdAt: t.created_at,
        items: items.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          product_price: i.product_price,
          subtotal: i.subtotal,
        })),
        total: t.total,
        paymentMethod: t.payment_method,
        paymentAmount: t.payment_amount,
        change: t.change,
        subtotalAmount: t.subtotal_amount,
        discountAmount: t.discount_amount,
        storeName,
        storeAddress: storeAddress || '',
        storePhone,
        storePhone2,
        receiptFooter,
        cashierName: t.cashier_name || 'Kasir',
        customerName: t.customer_name ?? undefined,
      });
      Alert.alert('Sukses', 'Struk berhasil dicetak');
    } catch {
      Alert.alert('Gagal', 'Cetak struk gagal. Periksa koneksi printer.');
    }
  };

  const handleEditToCart = (t: Transaction) => {
    Alert.alert(
      'Edit & Masukkan ke Keranjang',
      `Transaksi ${formatInvoice(t.id, t.created_at)} akan dibatalkan, stok barang otomatis dikembalikan, dan ${items.length} item akan dimasukkan kembali ke keranjang kasir untuk diperbaiki.\n\nLanjutkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Masukkan ke Keranjang',
          onPress: async () => {
            const res = await revertAndEditTransaction(db, t.id);
            if (res.success) {
              setSelected(null);
              router.push('/transaksi');
            } else {
              Alert.alert('Gagal', res.message || 'Gagal memulihkan transaksi ke keranjang');
            }
          },
        },
      ]
    );
  };

  const handleCancelTransaction = (t: Transaction) => {
    Alert.alert(
      'Batalkan / Retur Transaksi',
      `Transaksi ${formatInvoice(t.id, t.created_at)} senilai Rp ${t.total.toLocaleString('id-ID')} akan dibatalkan dan seluruh stok produk akan dikembalikan ke toko.\n\nYakin ingin membatalkan transaksi ini?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Batalkan Transaksi',
          style: 'destructive',
          onPress: async () => {
            const res = await cancelTransaction(db, t.id);
            if (res.success) {
              setSelected(null);
              Alert.alert('Sukses', 'Transaksi berhasil dibatalkan dan stok produk telah dikembalikan.');
            } else {
              Alert.alert('Gagal', res.message || 'Gagal membatalkan transaksi');
            }
          },
        },
      ]
    );
  };

  const handleDelete = (t: Transaction) => {
    Alert.alert(
      'Hapus Transaksi',
      `Yakin ingin menghapus catatan riwayat transaksi ${formatInvoice(t.id, t.created_at)}? Data yang dihapus tidak dapat dipulihkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await db.withExclusiveTransactionAsync(async (txn) => {
              await txn.runAsync('DELETE FROM transaction_items WHERE transaction_id = ?', t.id);
              await txn.runAsync('DELETE FROM transactions WHERE id = ?', t.id);
            });
            loadTransactions(db, period, page);
            setSelected(null);
          },
        },
      ]
    );
  };

  const periods: { key: PeriodFilter; label: string }[] = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: '7 Hari' },
    { key: 'month', label: '30 Hari' },
    { key: 'all', label: 'Semua' },
  ];

  const renderDetailContent = () => {
    if (!selected) return null;
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {!isTabletOrLandscape && (
          <Pressable onPress={() => setSelected(null)} style={styles.backRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconSymbol name="chevron.left" size={18} color={Colors.tint} />
              <ThemedText style={{ color: Colors.tint, fontWeight: '700', fontSize: 14 }}>
                ‹ Kembali ke Daftar
              </ThemedText>
            </View>
          </Pressable>
        )}

        <Card style={{ marginBottom: 10 }} padding={12}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
              borderBottomWidth: 1,
              borderColor: '#f1f5f9',
              paddingBottom: 8,
            }}
          >
            <View>
              <ThemedText style={{ fontSize: 10.5, color: Colors.muted, fontWeight: '800', letterSpacing: 0.5 }}>
                NO. TRANSAKSI
              </ThemedText>
              <ThemedText type="title" style={{ fontSize: 16 }}>
                {formatInvoice(selected.id, selected.created_at)}
              </ThemedText>
            </View>
            <Badge
              label={selected.payment_method === 'qris' ? 'QRIS / TRANSFER' : selected.payment_method.toUpperCase()}
              variant={selected.payment_method === 'qris' ? 'info' : 'success'}
            />
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={{ color: Colors.placeholder, fontSize: 12 }}>Kasir / Operator</ThemedText>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }}>
              👤 {selected.cashier_name || 'Kasir'}
            </ThemedText>
          </View>
          {selected.customer_name ? (
            <View style={styles.detailRow}>
              <ThemedText style={{ color: Colors.placeholder, fontSize: 12 }}>Pelanggan</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }}>{selected.customer_name}</ThemedText>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <ThemedText style={{ color: Colors.placeholder, fontSize: 12 }}>Waktu Transaksi</ThemedText>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }}>{formatDate(selected.created_at)}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={{ color: Colors.placeholder, fontSize: 12 }}>Metode Pembayaran</ThemedText>
            <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }}>{selected.payment_method.toUpperCase()}</ThemedText>
          </View>
          {selected.payment_amount > 0 && (
            <View style={styles.detailRow}>
              <ThemedText style={{ color: Colors.placeholder, fontSize: 12 }}>Uang Diterima</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }}>
                Rp {selected.payment_amount.toLocaleString('id-ID')}
              </ThemedText>
            </View>
          )}
          {selected.change > 0 && (
            <View style={styles.detailRow}>
              <ThemedText style={{ color: Colors.placeholder, fontSize: 12 }}>Kembalian</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 12 }}>
                Rp {selected.change.toLocaleString('id-ID')}
              </ThemedText>
            </View>
          )}
        </Card>

        {/* Tabel Rincian Barang Belanja */}
        <Card padding={12} style={{ marginBottom: 10 }}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 13, marginBottom: 8, color: '#334155' }}>
            Rincian Barang Belanja ({items.length} Item)
          </ThemedText>
          <View
            style={{
              borderBottomWidth: 1,
              borderColor: '#e2e8f0',
              paddingBottom: 6,
              marginBottom: 6,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <ThemedText style={{ flex: 2.2, fontSize: 10.5, fontWeight: '700', color: '#64748b' }}>PRODUK</ThemedText>
            <ThemedText style={{ flex: 0.8, fontSize: 10.5, fontWeight: '700', color: '#64748b', textAlign: 'center' }}>QTY</ThemedText>
            <ThemedText style={{ flex: 1.2, fontSize: 10.5, fontWeight: '700', color: '#64748b', textAlign: 'right' }}>HARGA</ThemedText>
            <ThemedText style={{ flex: 1.3, fontSize: 10.5, fontWeight: '700', color: '#64748b', textAlign: 'right' }}>SUBTOTAL</ThemedText>
          </View>

          {items.map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderColor: '#f8fafc',
              }}
            >
              <View style={{ flex: 2.2, paddingRight: 6 }}>
                <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }} numberOfLines={2}>
                  {item.product_name}
                </ThemedText>
                {item.weight_gram ? (
                  <ThemedText style={{ fontSize: 9.5, color: Colors.tint, marginTop: 1 }}>
                    ⚖️ {item.weight_gram} gr @ Rp {Math.round(item.price_per_kg || item.product_price).toLocaleString('id-ID')}/kg
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText style={{ flex: 0.8, fontSize: 12, fontWeight: '700', textAlign: 'center', color: '#0f172a' }}>
                {item.quantity}x
              </ThemedText>
              <ThemedText style={{ flex: 1.2, fontSize: 11, textAlign: 'right', color: '#64748b' }}>
                Rp {item.product_price.toLocaleString('id-ID')}
              </ThemedText>
              <ThemedText style={{ flex: 1.3, fontSize: 12, fontWeight: '800', textAlign: 'right', color: '#0f172a' }}>
                Rp {item.subtotal.toLocaleString('id-ID')}
              </ThemedText>
            </View>
          ))}

          {/* Subtotal, Diskon, dan Total */}
          <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#f1f5f9', gap: 4 }}>
            {selected.discount_amount ? selected.discount_amount > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ThemedText style={{ fontSize: 11.5, color: '#dc2626' }}>Diskon Transaksi</ThemedText>
                <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#dc2626' }}>
                  - Rp {selected.discount_amount.toLocaleString('id-ID')}
                </ThemedText>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: '#0f172a' }}>Total Akhir</ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 16, color: Colors.tintDark, fontWeight: '900' }}>
                Rp {selected.total.toLocaleString('id-ID')}
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Panel Tombol Aksi */}
        <Card padding={12} style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', marginBottom: 12 }}>
          <ThemedText style={{ fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.5, marginBottom: 8 }}>
            TINDAKAN TRANSAKSI
          </ThemedText>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1 }]}
              onPress={() => handlePrint(selected)}
              activeOpacity={0.8}
            >
              <ThemedText style={{ fontSize: 14 }}>🖨️</ThemedText>
              <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#15803d' }}>
                Cetak Ulang Struk
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#93c5fd', borderWidth: 1 }]}
              onPress={() => handleEditToCart(selected)}
              activeOpacity={0.8}
            >
              <ThemedText style={{ fontSize: 14 }}>✏️</ThemedText>
              <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#1d4ed8' }}>
                Edit ke Keranjang
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#fffbeb', borderColor: '#fcd34d', borderWidth: 1 }]}
              onPress={() => handleCancelTransaction(selected)}
              activeOpacity={0.8}
            >
              <ThemedText style={{ fontSize: 14 }}>↩️</ThemedText>
              <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#b45309' }}>
                Batalkan / Retur
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1 }]}
              onPress={() => handleDelete(selected)}
              activeOpacity={0.8}
            >
              <ThemedText style={{ fontSize: 14 }}>🗑️</ThemedText>
              <ThemedText style={{ fontSize: 11.5, fontWeight: '700', color: '#b91c1c' }}>
                Hapus Riwayat
              </ThemedText>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    );
  };

  // Jika Portrait dan sedang melihat detail
  if (!isTabletOrLandscape && selected) {
    return (
      <ThemedView style={[styles.container, { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        {renderDetailContent()}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
      {/* Header Top Row dengan Tombol Orientasi Layar */}
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title" style={{ marginBottom: 2 }}>
            Riwayat Transaksi
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
            {isTabletOrLandscape
              ? 'Panel Riwayat Kasir, Cetak Struk, dan Pembatalan / Retur Transaksi'
              : 'Daftar semua penjualan kasir dan pencetakan struk'}
          </ThemedText>
        </View>

        <TouchableOpacity
          style={[
            styles.orientationToggleBtn,
            appOrientation === 'landscape' && styles.orientationToggleBtnActive,
          ]}
          onPress={toggleOrientation}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.orientationToggleIcon}>
            {appOrientation === 'landscape' ? '🔄' : '📱'}
          </ThemedText>
          <ThemedText
            style={[
              styles.orientationToggleText,
              appOrientation === 'landscape' && styles.orientationToggleTextActive,
            ]}
          >
            {appOrientation === 'landscape' ? 'Landscape' : 'Portrait'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {isTabletOrLandscape ? (
        /* ─────────────────────────────────────────────────────────────
           TAMPILAN DUAL-PANE LANDSCAPE: 2 KOLOM SEIMBANG (48% : 52%)
           ───────────────────────────────────────────────────────────── */
        <View style={styles.dualPaneContainer}>
          {/* Kolom Kiri: Daftar Riwayat Transaksi */}
          <View style={styles.leftPane}>
            <View style={styles.filterRow}>
              {periods.map((p) => (
                <Pressable
                  key={p.key}
                  style={[styles.filterBtn, period === p.key && styles.filterBtnActive]}
                  onPress={() => setPeriod(p.key)}
                >
                  <ThemedText
                    style={[styles.filterBtnText, period === p.key && styles.filterBtnTextActive]}
                  >
                    {p.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 32 }}
              renderItem={({ item }) => {
                const isSelected = selected?.id === item.id;
                return (
                  <Pressable onPress={() => selectTransaction(item)}>
                    <Card
                      padding={12}
                      style={[
                        styles.transactionCard,
                        isSelected && styles.transactionCardSelected,
                      ]}
                    >
                      <View style={{ flex: 1, gap: 3 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          <ThemedText
                            type="defaultSemiBold"
                            style={{
                              fontSize: 13,
                              color: isSelected ? Colors.tintDark : Colors.text,
                            }}
                          >
                            {formatInvoice(item.id, item.created_at)}
                          </ThemedText>
                          <Badge
                            label={item.payment_method === 'qris' ? 'QRIS' : item.payment_method.toUpperCase()}
                            variant={item.payment_method === 'qris' ? 'info' : 'success'}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ThemedText style={{ color: Colors.placeholder, fontSize: 11 }}>
                            {formatDate(item.created_at)}
                          </ThemedText>
                          <ThemedText style={{ color: Colors.tint, fontSize: 11, fontWeight: '600' }}>
                            • 👤 {item.cashier_name || 'Kasir'}
                          </ThemedText>
                        </View>

                        {item.customer_name ? (
                          <ThemedText style={{ color: Colors.muted, fontSize: 11 }}>
                            Pelanggan: {item.customer_name}
                          </ThemedText>
                        ) : null}

                        <ThemedText
                          type="defaultSemiBold"
                          style={{
                            fontSize: 13.5,
                            color: isSelected ? Colors.tintDark : '#0f172a',
                            marginTop: 1,
                          }}
                        >
                          Rp {item.total.toLocaleString('id-ID')}
                        </ThemedText>
                      </View>
                      <IconSymbol
                        name="chevron.right"
                        size={18}
                        color={isSelected ? Colors.tint : Colors.muted}
                      />
                    </Card>
                  </Pressable>
                );
              }}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loading ? (
                  <ActivityIndicator size="small" color={Colors.tint} style={{ paddingVertical: 16 }} />
                ) : !hasMore && transactions.length > 0 ? (
                  <ThemedText
                    style={{ textAlign: 'center', color: Colors.muted, paddingVertical: 12, fontSize: 11 }}
                  >
                    Semua transaksi telah dimuat
                  </ThemedText>
                ) : null
              }
              ListEmptyComponent={
                !loading ? (
                  <EmptyState
                    icon="📋"
                    title="Belum ada transaksi"
                    subtitle="Transaksi kasir akan muncul di sini"
                  />
                ) : null
              }
            />
          </View>

          {/* Kolom Kanan: Rincian & Aksi Transaksi Terpilih */}
          <View style={styles.rightPane}>
            {selected ? (
              renderDetailContent()
            ) : (
              <View style={styles.emptyDetailContainer}>
                <ThemedText style={{ fontSize: 44, marginBottom: 12 }}>🧾</ThemedText>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 15, color: '#334155', marginBottom: 4 }}>
                  Pilih Riwayat Transaksi
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: Colors.muted, textAlign: 'center', maxWidth: 280, lineHeight: 18 }}>
                  Sentuh salah satu transaksi pada daftar di sebelah kiri untuk melihat rincian barang, cetak ulang struk, atau melakukan retur / edit transaksi.
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* ─────────────────────────────────────────────────────────────
           TAMPILAN PORTRAIT PENUH: DAFTAR TRANSAKSI
           ───────────────────────────────────────────────────────────── */
        <>
          <View style={styles.filterRow}>
            {periods.map((p) => (
              <Pressable
                key={p.key}
                style={[styles.filterBtn, period === p.key && styles.filterBtnActive]}
                onPress={() => setPeriod(p.key)}
              >
                <ThemedText
                  style={[styles.filterBtnText, period === p.key && styles.filterBtnTextActive]}
                >
                  {p.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => selectTransaction(item)}>
                <Card style={styles.transactionCard} padding={12}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <ThemedText type="defaultSemiBold">{formatInvoice(item.id, item.created_at)}</ThemedText>
                      <Badge
                        label={item.payment_method === 'qris' ? 'QRIS / TRANSFER' : item.payment_method.toUpperCase()}
                        variant={item.payment_method === 'qris' ? 'info' : 'success'}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemedText style={{ color: Colors.placeholder, fontSize: 11.5 }}>
                        {formatDate(item.created_at)}
                      </ThemedText>
                      <ThemedText style={{ color: Colors.tint, fontSize: 11.5, fontWeight: '600' }}>
                        • 👤 {item.cashier_name || 'Kasir'}
                      </ThemedText>
                    </View>
                    {item.customer_name ? (
                      <ThemedText style={{ color: Colors.muted, fontSize: 11 }}>
                        Pelanggan: {item.customer_name}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="defaultSemiBold">
                      Rp {item.total.toLocaleString('id-ID')}
                    </ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={Colors.muted} />
                </Card>
              </Pressable>
            )}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loading ? (
                <ActivityIndicator size="small" color={Colors.tint} style={{ paddingVertical: 16 }} />
              ) : !hasMore && transactions.length > 0 ? (
                <ThemedText style={{ textAlign: 'center', color: Colors.muted, paddingVertical: 12, fontSize: 12 }}>
                  Semua transaksi telah dimuat
                </ThemedText>
              ) : null
            }
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="📋"
                  title="Belum ada transaksi"
                  subtitle="Transaksi kasir akan muncul di sini"
                />
              ) : null
            }
          />
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  orientationToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 4,
  },
  orientationToggleBtnActive: {
    backgroundColor: Colors.tintLight,
    borderColor: Colors.tint,
  },
  orientationToggleIcon: {
    fontSize: 13,
  },
  orientationToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  orientationToggleTextActive: {
    color: Colors.tintDark,
    fontWeight: '800',
  },
  dualPaneContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  leftPane: {
    flex: 1,
  },
  rightPane: {
    flex: 1.15,
  },
  emptyDetailContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    padding: 24,
    marginBottom: 24,
  },
  backRow: { marginBottom: 12 },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  filterBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  filterBtnActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  filterBtnText: {
    fontSize: 11.5,
    color: Colors.text,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  transactionCardSelected: {
    borderColor: Colors.tint,
    borderWidth: 1.5,
    backgroundColor: '#f0fdf4',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
});
