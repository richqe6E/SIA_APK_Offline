import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickImageFromGallery, capturePhotoFromCamera } from '@/utils/imagePickerHelper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Colors, Shadows } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import {
  useDebtReceivableStore,
  type Customer,
  type Supplier,
  type CustomerReceivable,
  type SupplierDebt,
  type PaymentHistoryItem,
} from '@/stores/debtReceivableStore';
import { useCashStore } from '@/stores/cashStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { formatRupiahInput, parseRupiahInput } from '@/utils/formatRupiah';
import { saveImageLocally } from '@/utils/imageStorage';

type ActiveTab = 'receivable' | 'debt';
type FilterStatus = 'all' | 'unpaid' | 'paid';

export default function DebtReceivableScreen() {
  useLockOrientation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();

  const { currentUserRole } = useSettingsStore();
  const isKasir = currentUserRole === 'kasir';

  const { cashHandBalance, cashBankBalance, loadLedger } = useCashStore();
  const {
    customers,
    suppliers,
    receivables,
    debts,
    totalReceivableUnpaid,
    totalDebtUnpaid,
    loadCustomers,
    loadSuppliers,
    loadReceivables,
    loadDebts,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addReceivable,
    editReceivable,
    deleteReceivable,
    payReceivable,
    getReceivablePayments,
    addDebt,
    editDebt,
    deleteDebt,
    payDebt,
    getDebtPayments,
  } = useDebtReceivableStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('receivable');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddReceivableModal, setShowAddReceivableModal] = useState(false);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Payment Modal
  const [payTarget, setPayTarget] = useState<{
    type: 'receivable' | 'debt';
    id: number;
    title: string;
    targetName: string;
    totalAmount: number;
    remainingAmount: number;
  } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccount, setPayAccount] = useState<'hand' | 'bank'>('hand');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date());
  const [showPayDatePicker, setShowPayDatePicker] = useState(false);
  const [paying, setPaying] = useState(false);

  // History Modal
  const [historyTarget, setHistoryTarget] = useState<{
    title: string;
    targetName: string;
    items: PaymentHistoryItem[];
  } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // F4: Edit Modal untuk piutang/hutang (nominal + jatuh tempo + foto faktur & catatan untuk hutang)
  const [editTarget, setEditTarget] = useState<{
    type: 'receivable' | 'debt';
    id: number;
    targetName: string;
    currentTotal: number;
    currentDueDate: string | null;
    currentInvoiceImage?: string | null;
    currentNotes?: string | null;
  } | null>(null);
  const [editTotalInput, setEditTotalInput] = useState('');
  const [editDueDate, setEditDueDate] = useState(new Date());
  const [editHasDueDate, setEditHasDueDate] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editInvoiceImage, setEditInvoiceImage] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  // Fullscreen Image Modal (Foto Faktur Supplier)
  const [fullscreenImage, setFullscreenImage] = useState<{ uri: string; title: string } | null>(null);

  // Rincian Produk Modal (Piutang Pelanggan)
  const [receivableItemsModal, setReceivableItemsModal] = useState<{
    customerName: string;
    totalAmount: number;
    items: {
      product_name: string;
      quantity: number;
      product_price: number;
      subtotal: number;
      weight_gram?: number;
    }[];
    hasTransaction: boolean;
  } | null>(null);
  const [loadingReceivableItems, setLoadingReceivableItems] = useState(false);

  const { revertAndEditTransaction } = useTransactionStore();

  const handleViewReceivableItems = async (item: CustomerReceivable) => {
    if (!item.transaction_id) {
      setReceivableItemsModal({
        customerName: item.customer_name,
        totalAmount: item.total_amount,
        items: [],
        hasTransaction: false,
      });
      return;
    }
    setLoadingReceivableItems(true);
    try {
      const rows = await db.getAllAsync<{
        product_name: string;
        quantity: number;
        product_price: number;
        subtotal: number;
        weight_gram: number | null;
      }>(
        `SELECT product_name, quantity, product_price, subtotal, weight_gram 
         FROM transaction_items 
         WHERE transaction_id = ?`,
        item.transaction_id
      );
      setReceivableItemsModal({
        customerName: item.customer_name,
        totalAmount: item.total_amount,
        items: rows.map((r) => ({
          product_name: r.product_name,
          quantity: r.quantity,
          product_price: r.product_price,
          subtotal: r.subtotal,
          weight_gram: r.weight_gram ?? undefined,
        })),
        hasTransaction: true,
      });
    } catch (e) {
      console.error('handleViewReceivableItems error:', e);
      Alert.alert('Error', 'Gagal memuat rincian produk piutang');
    } finally {
      setLoadingReceivableItems(false);
    }
  };

  const handleEditReceivable = async (item: CustomerReceivable) => {
    if (item.transaction_id) {
      if (item.paid_amount > 0) {
        Alert.alert(
          'Perhatian',
          `Piutang ini sudah memiliki riwayat cicilan terbayar (Rp ${item.paid_amount.toLocaleString('id-ID')}). Batalkan pembayaran cicilan terlebih dahulu di riwayat sebelum mengedit transaksi ini.`
        );
        return;
      }
      Alert.alert(
        'Edit & Buka di Keranjang Kasir',
        `Transaksi piutang ${item.customer_name} senilai Rp ${item.total_amount.toLocaleString('id-ID')} akan dibatalkan, stok barang otomatis dikembalikan ke freezer, dan seluruh produk akan dimasukkan kembali ke keranjang kasir untuk disesuaikan.\n\nLanjutkan?`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Ya, Buka di Kasir',
            onPress: async () => {
              const res = await revertAndEditTransaction(db, item.transaction_id!);
              if (res.success) {
                reloadAll();
                router.push('/transaksi');
              } else {
                Alert.alert('Gagal', res.message || 'Gagal memulihkan transaksi ke keranjang');
              }
            },
          },
        ]
      );
    } else {
      // Piutang dicatat manual tanpa transaksi kasir
      handleOpenEditModal('receivable', item.id, item.customer_name, item.total_amount, item.due_date);
    }
  };

  const reloadAll = useCallback(() => {
    loadCustomers(db);
    loadSuppliers(db);
    loadReceivables(db);
    loadDebts(db);
    loadLedger(db);
  }, [db, loadCustomers, loadSuppliers, loadReceivables, loadDebts, loadLedger]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  useEffect(() => {
    if (isKasir && activeTab !== 'receivable') {
      setActiveTab('receivable');
    }
  }, [isKasir, activeTab]);

  // Filtered Receivables
  const filteredReceivables = receivables.filter((r) => {
    const matchSearch = searchQuery.trim()
      ? r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customer_phone.includes(searchQuery)
      : true;
    if (!matchSearch) return false;
    if (filterStatus === 'unpaid') return r.status !== 'paid';
    if (filterStatus === 'paid') return r.status === 'paid';
    return true;
  });

  // Filtered Debts
  const filteredDebts = debts.filter((d) => {
    const matchSearch = searchQuery.trim()
      ? d.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.supplier_phone.includes(searchQuery)
      : true;
    if (!matchSearch) return false;
    if (filterStatus === 'unpaid') return d.status !== 'paid';
    if (filterStatus === 'paid') return d.status === 'paid';
    return true;
  });

  const handleOpenPayModal = (
    type: 'receivable' | 'debt',
    id: number,
    targetName: string,
    totalAmount: number,
    remainingAmount: number
  ) => {
    setPayTarget({
      type,
      id,
      title: type === 'receivable' ? 'Pelunasan / Cicilan Piutang Pelanggan' : 'Pembayaran Hutang ke Supplier',
      targetName,
      totalAmount,
      remainingAmount,
    });
    setPayAmount(formatRupiahInput(remainingAmount));
    setPayAccount(type === 'debt' ? 'bank' : 'hand');
    setPayNotes('');
    setPayDate(new Date());
    setShowPayDatePicker(false);
  };

  const handleConfirmPay = async () => {
    if (!payTarget) return;
    const amt = parseRupiahInput(payAmount);
    if (amt <= 0) {
      Alert.alert('Error', 'Nominal pembayaran harus lebih dari 0');
      return;
    }
    if (amt > payTarget.remainingAmount) {
      Alert.alert('Error', `Nominal tidak boleh melebihi sisa tagihan Rp ${payTarget.remainingAmount.toLocaleString('id-ID')}`);
      return;
    }

    setPaying(true);
    const dateStr = payDate.toISOString().split('T')[0];
    let res: { success: boolean; message?: string };
    if (payTarget.type === 'receivable') {
      res = await payReceivable(db, payTarget.id, amt, payNotes, dateStr, payAccount);
    } else {
      res = await payDebt(db, payTarget.id, amt, payNotes, dateStr, payAccount);
    }
    setPaying(false);

    if (res.success) {
      setPayTarget(null);
      Alert.alert('Sukses', 'Pembayaran berhasil dicatat ke Buku Kas');
      reloadAll();
    } else {
      Alert.alert('Gagal', res.message || 'Gagal menyimpan pembayaran');
    }
  };

  const handleViewHistory = async (type: 'receivable' | 'debt', id: number, targetName: string) => {
    setLoadingHistory(true);
    let items: PaymentHistoryItem[] = [];
    if (type === 'receivable') {
      items = await getReceivablePayments(db, id);
    } else {
      items = await getDebtPayments(db, id);
    }
    setLoadingHistory(false);
    setHistoryTarget({
      title: type === 'receivable' ? 'Riwayat Cicilan Pelanggan' : 'Riwayat Pembayaran ke Supplier',
      targetName,
      items,
    });
  };

  // F4: buka modal edit (nominal + jatuh tempo).
  // editHasDueDate=false → set null (hapus jatuh tempo). true → pakai editDueDate.
  const handleOpenEditModal = (
    type: 'receivable' | 'debt',
    id: number,
    targetName: string,
    currentTotal: number,
    currentDueDate: string | null,
    currentInvoiceImage?: string | null,
    currentNotes?: string | null
  ) => {
    setEditTarget({
      type,
      id,
      targetName,
      currentTotal,
      currentDueDate,
      currentInvoiceImage,
      currentNotes,
    });
    setEditTotalInput(currentTotal.toLocaleString('id-ID'));
    if (currentDueDate) {
      setEditHasDueDate(true);
      setEditDueDate(new Date(currentDueDate));
    } else {
      setEditHasDueDate(false);
      setEditDueDate(new Date());
    }
    setShowEditDatePicker(false);
    setEditInvoiceImage(currentInvoiceImage ?? null);
    setEditNotes(currentNotes ?? '');
  };

  const handlePickEditImage = async () => {
    const uri = await pickImageFromGallery();
    if (uri) {
      const savedUri = await saveImageLocally(uri, 'debts');
      setEditInvoiceImage(savedUri);
    }
  };

  const handleTakeEditPhoto = async () => {
    const uri = await capturePhotoFromCamera();
    if (uri) {
      const savedUri = await saveImageLocally(uri, 'debts');
      setEditInvoiceImage(savedUri);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const newTotal = parseInt(editTotalInput.replace(/\./g, ''), 10) || 0;
    if (newTotal <= 0) {
      Alert.alert('Error', 'Nominal harus lebih besar dari 0');
      return;
    }

    const dueDateStr = editHasDueDate
      ? editDueDate.toISOString().split('T')[0]
      : null;

    setSavingEdit(true);
    let res: { success: boolean; message?: string };
    if (editTarget.type === 'receivable') {
      res = await editReceivable(db, editTarget.id, {
        totalAmount: newTotal,
        dueDate: dueDateStr,
      });
    } else {
      res = await editDebt(db, editTarget.id, {
        totalAmount: newTotal,
        dueDate: dueDateStr,
        invoiceImage: editInvoiceImage,
        notes: editNotes.trim() ? editNotes.trim() : null,
      });
    }
    setSavingEdit(false);

    if (res.success) {
      setEditTarget(null);
      Alert.alert('Sukses', 'Data berhasil diperbarui');
      reloadAll();
    } else {
      Alert.alert('Gagal', res.message || 'Gagal memperbarui data');
    }
  };

  const handleDelete = (type: 'receivable' | 'debt', id: number, targetName: string) => {
    const label = type === 'receivable' ? 'piutang' : 'hutang';
    Alert.alert(
      'Hapus ' + label.charAt(0).toUpperCase() + label.slice(1) + '?',
      `Yakin ingin menghapus ${label} atas nama ${targetName}? Tindakan ini tidak dapat dibatalkan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            const res =
              type === 'receivable'
                ? await deleteReceivable(db, id)
                : await deleteDebt(db, id);
            if (res.success) {
              Alert.alert('Terhapus', `${label.charAt(0).toUpperCase() + label.slice(1)} berhasil dihapus.`);
              reloadAll();
            } else {
              Alert.alert('Gagal', res.message || `Gagal menghapus ${label}`);
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + 8, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
      ]}
    >
      {/* Header Terstandardisasi (Poin 3) */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
        >
          <ThemedText style={styles.backBtnText}>‹ Kembali</ThemedText>
        </TouchableOpacity>

        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText type="title" style={{ fontSize: 20 }}>
            {isKasir ? 'Piutang Pelanggan' : 'Hutang & Piutang'}
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
            {isKasir
              ? 'Buku Catatan Kasbon & Pelunasan Piutang Pelanggan'
              : 'Manajemen Kasbon Pelanggan & Hutang Kulakan'}
          </ThemedText>
        </View>
      </View>

      {/* Tabs Switcher (Hanya untuk Pemilik Toko) */}
      {!isKasir && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'receivable' && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab('receivable');
              setSearchQuery('');
            }}
          >
            <ThemedText
              style={[styles.tabButtonText, activeTab === 'receivable' && styles.tabButtonTextActive]}
            >
              👥 Piutang Pelanggan (Kasbon)
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'debt' && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab('debt');
              setSearchQuery('');
            }}
          >
            <ThemedText
              style={[styles.tabButtonText, activeTab === 'debt' && styles.tabButtonTextActive]}
            >
              🏭 Hutang Supplier (Kulakan)
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {/* ───────────────────────────────────────── */}
      {/* TAB 1: PIUTANG PELANGGAN (KASBON)         */}
      {/* ───────────────────────────────────────── */}
      {activeTab === 'receivable' ? (
        <View style={{ flex: 1 }}>
          {/* KPI Card */}
          <View style={styles.kpiRow}>
            <Card padding={14} style={[styles.kpiCard, { borderColor: '#fca5a5', backgroundColor: '#fff1f2' }]}>
              <ThemedText style={{ fontSize: 11, color: '#991b1b', fontWeight: '600' }}>
                Total Piutang Belum Tertagih
              </ThemedText>
              <ThemedText style={{ fontSize: 20, fontWeight: '800', color: '#b91c1c', marginTop: 4 }}>
                Rp {totalReceivableUnpaid.toLocaleString('id-ID')}
              </ThemedText>
              <ThemedText style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>
                * Dana toko yang masih berada di pelanggan
              </ThemedText>
            </Card>

            <Card padding={14} style={[styles.kpiCard, { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }]}>
              <ThemedText style={{ fontSize: 11, color: '#475569', fontWeight: '600' }}>
                Jumlah Data Piutang
              </ThemedText>
              <ThemedText style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginTop: 4 }}>
                {receivables.filter((r) => r.status !== 'paid').length}{' '}
                <ThemedText style={{ fontSize: 12, fontWeight: 'normal', color: Colors.muted }}>
                  dari {receivables.length} transaksi
                </ThemedText>
              </ThemedText>
              <ThemedText style={{ fontSize: 10, color: Colors.muted, marginTop: 2 }}>
                Terdaftar {customers.length} kontak pelanggan
              </ThemedText>
            </Card>
          </View>

          {/* Action Row & Search */}
          <View style={styles.controlRow}>
            <View style={styles.searchBox}>
              <ThemedText style={{ fontSize: 13, color: Colors.muted }}>🔍</ThemedText>
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama pelanggan..."
                placeholderTextColor={Colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={6}>
                  <ThemedText style={{ color: Colors.muted, fontSize: 12 }}>✕</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setShowCustomerModal(true)}
              >
                <ThemedText style={styles.btnSecondaryText}>👥 Data Pelanggan</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => setShowAddReceivableModal(true)}
              >
                <ThemedText style={styles.btnPrimaryText}>+ Catat Piutang</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Status Chips */}
          <View style={styles.filterChipRow}>
            {(['all', 'unpaid', 'paid'] as FilterStatus[]).map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.filterChip, filterStatus === st && styles.filterChipActive]}
                onPress={() => setFilterStatus(st)}
              >
                <ThemedText
                  style={[styles.filterChipText, filterStatus === st && styles.filterChipTextActive]}
                >
                  {st === 'all' ? 'Semua' : st === 'unpaid' ? 'Belum Lunas' : 'Lunas'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* List Receivables */}
          <FlatList
            data={filteredReceivables}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const isPaid = item.status === 'paid';
              return (
                <Card padding={12} style={styles.itemCard}>
                  <View style={styles.itemHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: '#0f172a' }}>
                          {item.customer_name}
                        </ThemedText>
                        <Badge
                          label={isPaid ? 'LUNAS' : item.status === 'partial' ? 'DICICIL' : 'BELUM BAYAR'}
                          variant={isPaid ? 'success' : item.status === 'partial' ? 'warning' : 'error'}
                        />
                      </View>
                      {item.customer_phone ? (
                        <ThemedText style={{ fontSize: 11, color: Colors.muted, marginTop: 1 }}>
                          📞 {item.customer_phone}
                        </ThemedText>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <ThemedText style={{ fontSize: 11, color: Colors.muted }}>Sisa Piutang:</ThemedText>
                      <ThemedText
                        style={{
                          fontSize: 15,
                          fontWeight: '800',
                          color: isPaid ? Colors.success : Colors.danger,
                        }}
                      >
                        Rp {item.remaining_amount.toLocaleString('id-ID')}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.itemDetailRow}>
                    <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                      Total: Rp {item.total_amount.toLocaleString('id-ID')} • Terbayar: Rp {item.paid_amount.toLocaleString('id-ID')}
                    </ThemedText>
                    {item.due_date ? (
                      <ThemedText style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>
                        Jatuh Tempo: {item.due_date}
                      </ThemedText>
                    ) : null}
                  </View>

                  <View style={styles.itemActionRow}>
                    <TouchableOpacity
                      style={[styles.historyBtn, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}
                      onPress={() => handleViewReceivableItems(item)}
                    >
                      <ThemedText style={[styles.historyBtnText, { color: '#15803d' }]}>🔍 Rincian Produk</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.historyBtn}
                      onPress={() => handleViewHistory('receivable', item.id, item.customer_name)}
                    >
                      <ThemedText style={styles.historyBtnText}>📜 Riwayat</ThemedText>
                    </TouchableOpacity>

                    {!isPaid && (
                      <TouchableOpacity
                        style={styles.payBtn}
                        onPress={() =>
                          handleOpenPayModal(
                            'receivable',
                            item.id,
                            item.customer_name,
                            item.total_amount,
                            item.remaining_amount
                          )
                        }
                      >
                        <ThemedText style={styles.payBtnText}>💵 Terima Cicilan</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* F4: Edit & Hapus (khusus pemilik) */}
                  {!isKasir && (
                    <View style={[styles.itemActionRow, { marginTop: 6 }]}>
                      <TouchableOpacity
                        style={[styles.historyBtn, { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]}
                        onPress={() => handleEditReceivable(item)}
                      >
                        <ThemedText style={[styles.historyBtnText, { color: '#1d4ed8' }]}>
                          {item.transaction_id ? '✏️ Edit ke Kasir' : '✏️ Edit'}
                        </ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: '#fef2f2', borderColor: '#ef4444' }]}
                        onPress={() => handleDelete('receivable', item.id, item.customer_name)}
                      >
                        <ThemedText style={[styles.payBtnText, { color: '#b91c1c' }]}>🗑️ Hapus</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="👥"
                title="Tidak Ada Data Piutang"
                subtitle="Catat piutang kasbon pelanggan baru melalui tombol di atas"
              />
            }
          />
        </View>
      ) : (
        /* ───────────────────────────────────────── */
        /* TAB 2: HUTANG SUPPLIER (KULAKAN)          */
        /* ───────────────────────────────────────── */
        <View style={{ flex: 1 }}>
          {/* KPI Card */}
          <View style={styles.kpiRow}>
            <Card padding={14} style={[styles.kpiCard, { borderColor: '#fde68a', backgroundColor: '#fffbeb' }]}>
              <ThemedText style={{ fontSize: 11, color: '#92400e', fontWeight: '600' }}>
                Total Hutang Usaha ke Supplier
              </ThemedText>
              <ThemedText style={{ fontSize: 20, fontWeight: '800', color: '#b45309', marginTop: 4 }}>
                Rp {totalDebtUnpaid.toLocaleString('id-ID')}
              </ThemedText>
              <ThemedText style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>
                * Kewajiban pembayaran stok kulakan yang harus dilunasi
              </ThemedText>
            </Card>

            <Card padding={14} style={[styles.kpiCard, { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }]}>
              <ThemedText style={{ fontSize: 11, color: '#475569', fontWeight: '600' }}>
                Jumlah Tagihan Hutang
              </ThemedText>
              <ThemedText style={{ fontSize: 20, fontWeight: '800', color: '#1e293b', marginTop: 4 }}>
                {debts.filter((d) => d.status !== 'paid').length}{' '}
                <ThemedText style={{ fontSize: 12, fontWeight: 'normal', color: Colors.muted }}>
                  dari {debts.length} faktur
                </ThemedText>
              </ThemedText>
              <ThemedText style={{ fontSize: 10, color: Colors.muted, marginTop: 2 }}>
                Terdaftar {suppliers.length} rekanan supplier
              </ThemedText>
            </Card>
          </View>

          {/* Action Row & Search */}
          <View style={styles.controlRow}>
            <View style={styles.searchBox}>
              <ThemedText style={{ fontSize: 13, color: Colors.muted }}>🔍</ThemedText>
              <TextInput
                style={styles.searchInput}
                placeholder="Cari nama supplier..."
                placeholderTextColor={Colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={6}>
                  <ThemedText style={{ color: Colors.muted, fontSize: 12 }}>✕</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => setShowSupplierModal(true)}
              >
                <ThemedText style={styles.btnSecondaryText}>🏭 Data Supplier</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => setShowAddDebtModal(true)}
              >
                <ThemedText style={styles.btnPrimaryText}>+ Catat Hutang</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Status Chips */}
          <View style={styles.filterChipRow}>
            {(['all', 'unpaid', 'paid'] as FilterStatus[]).map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.filterChip, filterStatus === st && styles.filterChipActive]}
                onPress={() => setFilterStatus(st)}
              >
                <ThemedText
                  style={[styles.filterChipText, filterStatus === st && styles.filterChipTextActive]}
                >
                  {st === 'all' ? 'Semua' : st === 'unpaid' ? 'Belum Lunas' : 'Lunas'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* List Debts */}
          <FlatList
            data={filteredDebts}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const isPaid = item.status === 'paid';
              return (
                <Card padding={12} style={styles.itemCard}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {item.invoice_image ? (
                      <TouchableOpacity
                        onPress={() =>
                          setFullscreenImage({
                            uri: item.invoice_image!,
                            title: `Faktur - ${item.supplier_name}`,
                          })
                        }
                        activeOpacity={0.8}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 8,
                          overflow: 'hidden',
                          backgroundColor: '#f1f5f9',
                          borderWidth: 1.5,
                          borderColor: '#cbd5e1',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Image
                          source={{ uri: item.invoice_image }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                        <View
                          style={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            borderRadius: 4,
                            paddingHorizontal: 3,
                          }}
                        >
                          <ThemedText style={{ fontSize: 9, color: '#fff' }}>🔍</ThemedText>
                        </View>
                      </TouchableOpacity>
                    ) : null}

                    <View style={{ flex: 1 }}>
                      <View style={styles.itemHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: '#0f172a' }}>
                              {item.supplier_name}
                            </ThemedText>
                            <Badge
                              label={isPaid ? 'LUNAS' : item.status === 'partial' ? 'DICICIL' : 'BELUM LUNAS'}
                              variant={isPaid ? 'success' : item.status === 'partial' ? 'warning' : 'error'}
                            />
                          </View>
                          {item.supplier_phone ? (
                            <ThemedText style={{ fontSize: 11, color: Colors.muted, marginTop: 1 }}>
                              📞 {item.supplier_phone}
                            </ThemedText>
                          ) : null}
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <ThemedText style={{ fontSize: 11, color: Colors.muted }}>Sisa Hutang:</ThemedText>
                          <ThemedText
                            style={{
                              fontSize: 15,
                              fontWeight: '800',
                              color: isPaid ? Colors.success : '#d97706',
                            }}
                          >
                            Rp {item.remaining_amount.toLocaleString('id-ID')}
                          </ThemedText>
                        </View>
                      </View>

                      <View style={styles.itemDetailRow}>
                        <ThemedText style={{ fontSize: 11, color: '#64748b' }}>
                          Total Hutang: Rp {item.total_amount.toLocaleString('id-ID')} • Terbayar: Rp {item.paid_amount.toLocaleString('id-ID')}
                        </ThemedText>
                        {item.due_date ? (
                          <ThemedText style={{ fontSize: 11, color: '#b45309', fontWeight: '600' }}>
                            Jatuh Tempo: {item.due_date}
                          </ThemedText>
                        ) : null}
                      </View>

                      {item.notes ? (
                        <ThemedText style={{ fontSize: 10.5, color: '#475569', marginTop: 3, fontStyle: 'italic' }}>
                          📝 {item.notes}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.itemActionRow}>
                    <TouchableOpacity
                      style={styles.historyBtn}
                      onPress={() => handleViewHistory('debt', item.id, item.supplier_name)}
                    >
                      <ThemedText style={styles.historyBtnText}>📜 Riwayat Pembayaran</ThemedText>
                    </TouchableOpacity>

                    {!isPaid && (
                      <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: '#d97706' }]}
                        onPress={() =>
                          handleOpenPayModal(
                            'debt',
                            item.id,
                            item.supplier_name,
                            item.total_amount,
                            item.remaining_amount
                          )
                        }
                      >
                        <ThemedText style={styles.payBtnText}>💵 Bayar Hutang ke Supplier</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* F4: Edit & Hapus (khusus pemilik) */}
                  {!isKasir && (
                    <View style={[styles.itemActionRow, { marginTop: 6 }]}>
                      <TouchableOpacity
                        style={[styles.historyBtn, { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]}
                        onPress={() =>
                          handleOpenEditModal(
                            'debt',
                            item.id,
                            item.supplier_name,
                            item.total_amount,
                            item.due_date,
                            item.invoice_image,
                            item.notes
                          )
                        }
                      >
                        <ThemedText style={[styles.historyBtnText, { color: '#1d4ed8' }]}>✏️ Edit</ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.payBtn, { backgroundColor: '#fef2f2', borderColor: '#ef4444' }]}
                        onPress={() => handleDelete('debt', item.id, item.supplier_name)}
                      >
                        <ThemedText style={[styles.payBtnText, { color: '#b91c1c' }]}>🗑️ Hapus</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon="🏭"
                title="Tidak Ada Data Hutang"
                subtitle="Catat hutang kulakan supplier baru melalui tombol di atas"
              />
            }
          />
        </View>
      )}

      {/* ───────────────────────────────────────── */}
      {/* MODAL BAYAR / CICILAN                     */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={!!payTarget} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card padding={20} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ fontSize: 16 }}>
                {payTarget?.title}
              </ThemedText>
              <Pressable onPress={() => setPayTarget(null)}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            {payTarget ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.payTargetBox}>
                  <ThemedText style={{ fontSize: 12, color: Colors.muted }}>Nama Rekanan:</ThemedText>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 15, color: '#1e293b' }}>
                    {payTarget.targetName}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <ThemedText style={{ fontSize: 12, color: Colors.muted }}>Total Tagihan:</ThemedText>
                    <ThemedText style={{ fontSize: 12, fontWeight: '700' }}>
                      Rp {payTarget.totalAmount.toLocaleString('id-ID')}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                    <ThemedText style={{ fontSize: 12, color: '#991b1b', fontWeight: '700' }}>
                      Sisa Tagihan:
                    </ThemedText>
                    <ThemedText style={{ fontSize: 14, fontWeight: '800', color: Colors.danger }}>
                      Rp {payTarget.remainingAmount.toLocaleString('id-ID')}
                    </ThemedText>
                  </View>
                </View>

                {/* Input Nominal Pembayaran */}
                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText style={styles.label}>Nominal Pembayaran (Rp)</ThemedText>
                    <TouchableOpacity
                      onPress={() => setPayAmount(formatRupiahInput(payTarget.remainingAmount))}
                    >
                      <ThemedText style={{ fontSize: 11, color: Colors.tint, fontWeight: '700' }}>
                        Bayar Lunas Semua
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, { fontSize: 16, fontWeight: '700', color: Colors.tintDark }]}
                    placeholder="cth: 50.000"
                    placeholderTextColor={Colors.disabled}
                    keyboardType="numeric"
                    value={payAmount}
                    onChangeText={(val) => setPayAmount(formatRupiahInput(val))}
                  />
                </View>

                {/* Pilihan Akun Kas / Rekening */}
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>
                    {payTarget.type === 'receivable' ? 'Penerimaan Masuk ke Akun Kas' : 'Sumber Kas Pembayaran'}
                  </ThemedText>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[
                          styles.chipOption,
                          { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
                          payAccount === 'hand' && styles.chipOptionActive,
                        ]}
                        onPress={() => setPayAccount('hand')}
                      >
                        <ThemedText
                          style={[
                            styles.chipOptionText,
                            payAccount === 'hand' && styles.chipOptionTextActive,
                            { fontWeight: '700' },
                          ]}
                        >
                          💵 Kas di Tangan
                        </ThemedText>
                        {payTarget.type === 'debt' && (
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: payAccount === 'hand' ? '#ffffff' : Colors.muted,
                              marginTop: 2,
                            }}
                          >
                            Saldo: Rp {Math.round(cashHandBalance).toLocaleString('id-ID')}
                          </ThemedText>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.chipOption,
                          { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
                          payAccount === 'bank' && styles.chipOptionActive,
                        ]}
                        onPress={() => setPayAccount('bank')}
                      >
                        <ThemedText
                          style={[
                            styles.chipOptionText,
                            payAccount === 'bank' && styles.chipOptionTextActive,
                            { fontWeight: '700' },
                          ]}
                        >
                          🏛️ Kas di Bank
                        </ThemedText>
                        {payTarget.type === 'debt' && (
                          <ThemedText
                            style={{
                              fontSize: 10,
                              color: payAccount === 'bank' ? '#ffffff' : Colors.muted,
                              marginTop: 2,
                            }}
                          >
                            Saldo: Rp {Math.round(cashBankBalance).toLocaleString('id-ID')}
                          </ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Keterangan info atau peringatan defisit */}
                    {payTarget.type === 'debt' &&
                      ((payAccount === 'hand' &&
                        cashHandBalance < (parseFloat(payAmount.replace(/[^0-9]/g, '')) || 0)) ||
                        (payAccount === 'bank' &&
                          cashBankBalance < (parseFloat(payAmount.replace(/[^0-9]/g, '')) || 0))) && (
                        <View
                          style={{
                            backgroundColor: '#fef2f2',
                            padding: 8,
                            borderRadius: 8,
                            marginTop: 6,
                            borderWidth: 1,
                            borderColor: '#fecaca',
                          }}
                        >
                          <ThemedText style={{ fontSize: 11, color: '#b91c1c', fontWeight: '700' }}>
                            ⚠️ Saldo {payAccount === 'hand' ? 'Kas di Tangan' : 'Kas di Bank'} tidak mencukupi!
                          </ThemedText>
                          <ThemedText style={{ fontSize: 10, color: '#7f1d1d', marginTop: 2 }}>
                            Tersedia: Rp{' '}
                            {(payAccount === 'hand' ? cashHandBalance : cashBankBalance).toLocaleString(
                              'id-ID'
                            )}
                            , Dibutuhkan: Rp{' '}
                            {(parseFloat(payAmount.replace(/[^0-9]/g, '')) || 0).toLocaleString('id-ID')}.
                          </ThemedText>
                        </View>
                      )}
                  </View>

                {/* Tanggal Pembayaran */}
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Tanggal Transaksi Kas</ThemedText>
                  <TouchableOpacity
                    style={styles.datePickerBtn}
                    onPress={() => setShowPayDatePicker(true)}
                  >
                    <ThemedText style={{ fontSize: 14 }}>📅</ThemedText>
                    <ThemedText style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }}>
                      {payDate.toISOString().split('T')[0]}
                    </ThemedText>
                  </TouchableOpacity>

                  {showPayDatePicker && (
                    <DateTimePicker
                      value={payDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_, d) => {
                        setShowPayDatePicker(false);
                        if (d) setPayDate(d);
                      }}
                    />
                  )}
                </View>

                {/* Catatan / Keterangan */}
                <View style={styles.inputGroup}>
                  <ThemedText style={styles.label}>Catatan / Keterangan</ThemedText>
                  <TextInput
                    style={styles.input}
                    placeholder="Contoh: Cicilan tahap 1, transfer bank, dll."
                    placeholderTextColor={Colors.disabled}
                    value={payNotes}
                    onChangeText={setPayNotes}
                  />
                </View>

                <View style={styles.modalActions}>
                  <Button
                    title="Batal"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() => setPayTarget(null)}
                  />
                  <Button
                    title={paying ? 'Memproses...' : 'Simpan Pembayaran'}
                    style={{ flex: 1 }}
                    onPress={handleConfirmPay}
                    disabled={paying}
                  />
                </View>
              </ScrollView>
            ) : null}
          </Card>
        </ThemedView>
      </Modal>

      {/* ───────────────────────────────────────── */}
      {/* MODAL RIWAYAT PEMBAYARAN                  */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={!!historyTarget} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card padding={20} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText type="subtitle" style={{ fontSize: 16 }}>
                  {historyTarget?.title}
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: Colors.muted }}>
                  Rekanan: {historyTarget?.targetName}
                </ThemedText>
              </View>
              <Pressable onPress={() => setHistoryTarget(null)}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            {loadingHistory ? (
              <ActivityIndicator size="small" color={Colors.tint} style={{ padding: 20 }} />
            ) : historyTarget && historyTarget.items.length > 0 ? (
              <FlatList
                data={historyTarget.items}
                keyExtractor={(item) => item.id.toString()}
                style={{ maxHeight: 300 }}
                renderItem={({ item, index }) => (
                  <View style={styles.historyRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>
                        Cicilan ke-{historyTarget.items.length - index} • {item.payment_date}
                      </ThemedText>
                      {item.notes ? (
                        <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                          {item.notes}
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={{ fontSize: 14, fontWeight: '800', color: Colors.success }}>
                      +Rp {item.amount.toLocaleString('id-ID')}
                    </ThemedText>
                  </View>
                )}
              />
            ) : (
              <ThemedText style={{ textAlign: 'center', color: Colors.muted, padding: 20, fontSize: 13 }}>
                Belum ada catatan pembayaran cicilan.
              </ThemedText>
            )}

            <Button
              title="Tutup"
              variant="outline"
              style={{ marginTop: 14 }}
              onPress={() => setHistoryTarget(null)}
            />
          </Card>
        </ThemedView>
      </Modal>

      {/* ───────────────────────────────────────── */}
      {/* F4: MODAL EDIT PIUTANG / HUTANG          */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={!!editTarget} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card padding={20} style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle" style={{ fontSize: 16 }}>
                {editTarget?.type === 'receivable' ? '✏️ Edit Piutang' : '✏️ Edit Hutang'}
              </ThemedText>
              <Pressable onPress={() => setEditTarget(null)}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            {editTarget ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.payTargetBox}>
                  <ThemedText style={{ fontSize: 12, color: Colors.muted }}>
                    {editTarget.type === 'receivable' ? 'Pelanggan' : 'Supplier'}
                  </ThemedText>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: '#0f172a' }}>
                    {editTarget.targetName}
                  </ThemedText>
                </View>

                <ThemedText style={styles.label}>
                  Nominal {editTarget.type === 'receivable' ? 'Piutang' : 'Hutang'} (Rp)
                </ThemedText>
                <TextInput
                  value={editTotalInput}
                  onChangeText={(val) => setEditTotalInput(formatRupiahInput(val))}
                  placeholder="0"
                  placeholderTextColor={Colors.placeholder}
                  keyboardType="numeric"
                  style={styles.input}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <ThemedText style={styles.label}>
                    Atur Jatuh Tempo?
                  </ThemedText>
                  <Pressable
                    onPress={() => setEditHasDueDate(!editHasDueDate)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: editHasDueDate ? '#dbeafe' : '#f1f5f9',
                      borderWidth: 1,
                      borderColor: editHasDueDate ? '#3b82f6' : '#cbd5e1',
                    }}
                  >
                    <ThemedText style={{ fontSize: 11, color: editHasDueDate ? '#1d4ed8' : '#64748b', fontWeight: '700' }}>
                      {editHasDueDate ? '✓ Aktif' : 'Tidak'}
                    </ThemedText>
                  </Pressable>
                </View>

                {editHasDueDate && (
                  <TouchableOpacity
                    style={[styles.datePickerBtn, { marginTop: 8 }]}
                    onPress={() => setShowEditDatePicker(true)}
                  >
                    <ThemedText style={{ fontSize: 13, color: '#0f172a' }}>
                      📅 {editDueDate.toISOString().split('T')[0]}
                    </ThemedText>
                  </TouchableOpacity>
                )}

                {showEditDatePicker && (
                  <DateTimePicker
                    value={editDueDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowEditDatePicker(false);
                      if (selectedDate) setEditDueDate(selectedDate);
                    }}
                  />
                )}

                {/* Khusus Hutang Supplier: Catatan & Foto Faktur */}
                {editTarget.type === 'debt' && (
                  <>
                    <View style={{ marginTop: 14 }}>
                      <ThemedText style={styles.label}>Catatan / Nomor Faktur</ThemedText>
                      <TextInput
                        style={styles.input}
                        placeholder="cth: Faktur No. INV-9901 / Sales Mas Budi"
                        placeholderTextColor={Colors.disabled}
                        value={editNotes}
                        onChangeText={setEditNotes}
                      />
                    </View>

                    <View style={{ marginTop: 14 }}>
                      <ThemedText style={styles.label}>Foto Faktur / Nota Pembelian</ThemedText>
                      {editInvoiceImage ? (
                        <View style={{ marginTop: 6 }}>
                          <View
                            style={{
                              height: 150,
                              borderRadius: 8,
                              overflow: 'hidden',
                              backgroundColor: '#f1f5f9',
                              borderWidth: 1.5,
                              borderColor: '#cbd5e1',
                            }}
                          >
                            <Image
                              source={{ uri: editInvoiceImage }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="cover"
                            />
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                              onPress={() =>
                                setFullscreenImage({
                                  uri: editInvoiceImage,
                                  title: `Faktur - ${editTarget.targetName}`,
                                })
                              }
                              style={{
                                flex: 1,
                                backgroundColor: '#eff6ff',
                                paddingVertical: 8,
                                borderRadius: 6,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#bfdbfe',
                              }}
                            >
                              <ThemedText style={{ fontSize: 11, color: '#1d4ed8', fontWeight: '700' }}>
                                🔍 Perbesar Foto
                              </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setEditInvoiceImage(null)}
                              style={{
                                flex: 1,
                                backgroundColor: '#fef2f2',
                                paddingVertical: 8,
                                borderRadius: 6,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#fecaca',
                              }}
                            >
                              <ThemedText style={{ fontSize: 11, color: '#dc2626', fontWeight: '700' }}>
                                ✕ Hapus Foto
                              </ThemedText>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 10,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#cbd5e1',
                              backgroundColor: '#f8fafc',
                              gap: 6,
                            }}
                            onPress={handleTakeEditPhoto}
                          >
                            <ThemedText style={{ fontSize: 14 }}>📷</ThemedText>
                            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                              Ambil Foto
                            </ThemedText>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 10,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: '#cbd5e1',
                              backgroundColor: '#f8fafc',
                              gap: 6,
                            }}
                            onPress={handlePickEditImage}
                          >
                            <ThemedText style={{ fontSize: 14 }}>🖼️</ThemedText>
                            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                              Pilih Galeri
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </>
                )}

                <View style={[styles.modalActions, { marginTop: 18 }]}>
                  <Button
                    title="Batal"
                    variant="outline"
                    onPress={() => setEditTarget(null)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={savingEdit ? 'Menyimpan...' : 'Simpan'}
                    onPress={handleSaveEdit}
                    disabled={savingEdit}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            ) : null}
          </Card>
        </ThemedView>
      </Modal>

      {/* ───────────────────────────────────────── */}
      {/* MODAL CATAT PIUTANG BARU                  */}
      {/* ───────────────────────────────────────── */}
      <AddReceivableModal
        visible={showAddReceivableModal}
        customers={customers}
        onClose={() => setShowAddReceivableModal(false)}
        onSave={async (customerId, total, dueDate, notes) => {
          await addReceivable(db, customerId, total, dueDate);
          setShowAddReceivableModal(false);
          reloadAll();
          Alert.alert('Sukses', 'Data piutang pelanggan berhasil dicatat');
        }}
      />

      {/* ───────────────────────────────────────── */}
      {/* MODAL CATAT HUTANG BARU                   */}
      {/* ───────────────────────────────────────── */}
      <AddDebtModal
        visible={showAddDebtModal}
        suppliers={suppliers}
        onClose={() => setShowAddDebtModal(false)}
        onSave={async (supplierId, total, dueDate, notes, invoiceImage) => {
          await addDebt(db, supplierId, total, dueDate, undefined, invoiceImage, notes);
          setShowAddDebtModal(false);
          reloadAll();
          Alert.alert('Sukses', 'Data hutang supplier berhasil dicatat');
        }}
      />

      {/* ───────────────────────────────────────── */}
      {/* MODAL KELOLA PELANGGAN (CRUD)             */}
      {/* ───────────────────────────────────────── */}
      <CustomerModal
        visible={showCustomerModal}
        customers={customers}
        onClose={() => setShowCustomerModal(false)}
        onAdd={async (name, phone) => {
          await addCustomer(db, name, phone);
        }}
        onUpdate={async (id, name, phone) => {
          await updateCustomer(db, id, name, phone);
        }}
        onDelete={async (id) => {
          return await deleteCustomer(db, id);
        }}
      />

      {/* ───────────────────────────────────────── */}
      {/* MODAL KELOLA SUPPLIER (CRUD)              */}
      {/* ───────────────────────────────────────── */}
      <SupplierModal
        visible={showSupplierModal}
        suppliers={suppliers}
        onClose={() => setShowSupplierModal(false)}
        onAdd={async (name, address, phone) => {
          await addSupplier(db, name, address, phone);
        }}
        onUpdate={async (id, name, address, phone) => {
          await updateSupplier(db, id, name, address, phone);
        }}
        onDelete={async (id) => {
          return await deleteSupplier(db, id);
        }}
      />

      {/* ───────────────────────────────────────── */}
      {/* MODAL RINCIAN PRODUK BON PIUTANG          */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={!!receivableItemsModal} transparent animationType="fade">
        <ThemedView style={styles.modalOverlay}>
          <Card padding={20} style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontSize: 16, color: '#0f172a' }}>
                  🔍 Rincian Produk Bon Piutang
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: Colors.muted, marginTop: 1 }}>
                  Pelanggan: <ThemedText style={{ fontWeight: '700', color: '#0f172a' }}>{receivableItemsModal?.customerName}</ThemedText>
                </ThemedText>
              </View>
              <Pressable onPress={() => setReceivableItemsModal(null)} hitSlop={8}>
                <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
              </Pressable>
            </View>

            {loadingReceivableItems ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.tint} />
                <ThemedText style={{ fontSize: 12, color: Colors.muted, marginTop: 8 }}>Memuat produk...</ThemedText>
              </View>
            ) : !receivableItemsModal?.hasTransaction ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ThemedText style={{ fontSize: 32, marginBottom: 8 }}>📝</ThemedText>
                <ThemedText style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
                  Piutang Dicatat Manual
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: 4, paddingHorizontal: 16 }}>
                  Piutang ini dicatat langsung secara manual (bukan dari nota transaksi kasir), sehingga tidak memiliki daftar item barang spesifik.
                </ThemedText>
                <ThemedText style={{ fontSize: 15, fontWeight: '800', color: '#dc2626', marginTop: 12 }}>
                  Total Tagihan: Rp {receivableItemsModal?.totalAmount.toLocaleString('id-ID')}
                </ThemedText>
              </View>
            ) : receivableItemsModal?.items.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ThemedText style={{ fontSize: 12, color: Colors.muted }}>
                  Tidak ada rincian item produk ditemukan untuk nota ini.
                </ThemedText>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 4, borderBottomWidth: 1, borderColor: '#cbd5e1' }}>
                    <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#475569', flex: 2 }}>Item Produk</ThemedText>
                    <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#475569', flex: 1, textAlign: 'center' }}>Qty</ThemedText>
                    <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#475569', flex: 1.2, textAlign: 'right' }}>Harga</ThemedText>
                    <ThemedText style={{ fontSize: 11, fontWeight: '700', color: '#475569', flex: 1.3, textAlign: 'right' }}>Subtotal</ThemedText>
                  </View>
                  {receivableItemsModal.items.map((it, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: idx === receivableItemsModal.items.length - 1 ? 0 : 1, borderColor: '#f1f5f9' }}>
                      <ThemedText style={{ fontSize: 12, fontWeight: '600', color: '#0f172a', flex: 2 }}>
                        {it.product_name}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 11, color: '#334155', flex: 1, textAlign: 'center' }}>
                        {it.weight_gram ? `${(it.weight_gram / 1000).toFixed(2)} kg` : `${it.quantity}x`}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 11, color: '#64748b', flex: 1.2, textAlign: 'right' }}>
                        {it.product_price.toLocaleString('id-ID')}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#0f172a', flex: 1.3, textAlign: 'right' }}>
                        Rp {it.subtotal.toLocaleString('id-ID')}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>
                    Total Nilai Bon Piutang:
                  </ThemedText>
                  <ThemedText style={{ fontSize: 16, fontWeight: '900', color: '#dc2626' }}>
                    Rp {receivableItemsModal.totalAmount.toLocaleString('id-ID')}
                  </ThemedText>
                </View>
              </ScrollView>
            )}

            <View style={{ marginTop: 14 }}>
              <Button title="Tutup Rincian" variant="outline" onPress={() => setReceivableItemsModal(null)} />
            </View>
          </Card>
        </ThemedView>
      </Modal>

      {/* ───────────────────────────────────────── */}
      {/* MODAL FULLSCREEN FAKTUR / GAMBAR NOTA      */}
      {/* ───────────────────────────────────────── */}
      <Modal visible={!!fullscreenImage} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 540, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <ThemedText style={{ color: '#fff', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {fullscreenImage?.title || 'Faktur Pembelian'}
            </ThemedText>
            <TouchableOpacity
              onPress={() => setFullscreenImage(null)}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
            >
              <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✕ Tutup</ThemedText>
            </TouchableOpacity>
          </View>
          {fullscreenImage?.uri ? (
            <Image
              source={{ uri: fullscreenImage.uri }}
              style={{ width: '100%', height: '80%', borderRadius: 8 }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </ThemedView>
  );
}

// ─────────────────────────────────────────
// MODAL FORM: Catat Piutang Baru
// ─────────────────────────────────────────
function AddReceivableModal({
  visible,
  customers,
  onClose,
  onSave,
}: {
  visible: boolean;
  customers: Customer[];
  onClose: () => void;
  onSave: (customerId: number, total: number, dueDate?: string, notes?: string) => Promise<void>;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [total, setTotal] = useState('');
  const [dueDate, setDueDate] = useState<Date>(new Date(Date.now() + 7 * 86400000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [visible, customers, selectedCustomerId]);

  const handleSubmit = async () => {
    if (!selectedCustomerId) {
      Alert.alert('Perhatian', 'Pilih pelanggan terlebih dahulu!');
      return;
    }
    const totalNum = parseFloat(total.replace(/[^0-9]/g, '')) || 0;
    if (totalNum <= 0) {
      Alert.alert('Error', 'Nominal piutang harus lebih besar dari 0');
      return;
    }

    setSaving(true);
    await onSave(selectedCustomerId, totalNum, dueDate.toISOString().split('T')[0], notes);
    setSaving(false);
    setTotal('');
    setNotes('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.modalOverlay}>
        <Card padding={20} style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle" style={{ fontSize: 16 }}>
              + Catat Piutang Pelanggan (Kasbon)
            </ThemedText>
            <Pressable onPress={onClose}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {customers.length === 0 ? (
              <View style={{ padding: 10, backgroundColor: '#fef2f2', borderRadius: 8, marginBottom: 12 }}>
                <ThemedText style={{ color: '#991b1b', fontSize: 12 }}>
                  Belum ada data pelanggan terdaftar. Tambahkan data pelanggan terlebih dahulu melalui menu "Data Pelanggan".
                </ThemedText>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Pilih Pelanggan</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {customers.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.chipOption,
                        selectedCustomerId === c.id && styles.chipOptionActive,
                      ]}
                      onPress={() => setSelectedCustomerId(c.id)}
                    >
                      <ThemedText
                        style={[
                          styles.chipOptionText,
                          selectedCustomerId === c.id && styles.chipOptionTextActive,
                        ]}
                      >
                        {c.name}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Total Nominal Piutang (Rp)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="cth: 150.000"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                value={total}
                onChangeText={(val) => setTotal(formatRupiahInput(val))}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Tanggal Jatuh Tempo</ThemedText>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <ThemedText style={{ fontSize: 14 }}>📅</ThemedText>
                <ThemedText style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }}>
                  {dueDate.toISOString().split('T')[0]}
                </ThemedText>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setDueDate(d);
                  }}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Keterangan / Transaksi</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="cth: Kasbon sembako / belanja beras"
                placeholderTextColor={Colors.disabled}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            <View style={styles.modalActions}>
              <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={onClose} />
              <Button
                title={saving ? 'Menyimpan...' : 'Simpan Piutang'}
                style={{ flex: 1 }}
                onPress={handleSubmit}
                disabled={saving || customers.length === 0}
              />
            </View>
          </ScrollView>
        </Card>
      </ThemedView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// MODAL FORM: Catat Hutang Baru ke Supplier
// ─────────────────────────────────────────
function AddDebtModal({
  visible,
  suppliers,
  onClose,
  onSave,
}: {
  visible: boolean;
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (supplierId: number, total: number, dueDate?: string, notes?: string, invoiceImage?: string) => Promise<void>;
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [total, setTotal] = useState('');
  const [dueDate, setDueDate] = useState<Date>(new Date(Date.now() + 14 * 86400000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [invoiceImage, setInvoiceImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && suppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(suppliers[0].id);
    }
  }, [visible, suppliers, selectedSupplierId]);

  const handleClose = () => {
    setTotal('');
    setNotes('');
    setInvoiceImage(null);
    onClose();
  };

  const handlePickImage = async () => {
    const uri = await pickImageFromGallery();
    if (uri) {
      const savedUri = await saveImageLocally(uri, 'debts');
      setInvoiceImage(savedUri);
    }
  };

  const handleTakePhoto = async () => {
    const uri = await capturePhotoFromCamera();
    if (uri) {
      const savedUri = await saveImageLocally(uri, 'debts');
      setInvoiceImage(savedUri);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSupplierId) {
      Alert.alert('Perhatian', 'Pilih supplier terlebih dahulu!');
      return;
    }
    const totalNum = parseFloat(total.replace(/[^0-9]/g, '')) || 0;
    if (totalNum <= 0) {
      Alert.alert('Error', 'Nominal hutang harus lebih besar dari 0');
      return;
    }

    setSaving(true);
    await onSave(selectedSupplierId, totalNum, dueDate.toISOString().split('T')[0], notes, invoiceImage || undefined);
    setSaving(false);
    setTotal('');
    setNotes('');
    setInvoiceImage(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.modalOverlay}>
        <Card padding={20} style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle" style={{ fontSize: 16 }}>
              + Catat Hutang Kulakan Supplier
            </ThemedText>
            <Pressable onPress={handleClose}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {suppliers.length === 0 ? (
              <View style={{ padding: 10, backgroundColor: '#fef2f2', borderRadius: 8, marginBottom: 12 }}>
                <ThemedText style={{ color: '#991b1b', fontSize: 12 }}>
                  Belum ada data supplier terdaftar. Tambahkan data supplier terlebih dahulu melalui menu "Data Supplier".
                </ThemedText>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>Pilih Rekanan Supplier</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {suppliers.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.chipOption,
                        selectedSupplierId === s.id && styles.chipOptionActive,
                      ]}
                      onPress={() => setSelectedSupplierId(s.id)}
                    >
                      <ThemedText
                        style={[
                          styles.chipOptionText,
                          selectedSupplierId === s.id && styles.chipOptionTextActive,
                        ]}
                      >
                        {s.name}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Total Nominal Hutang (Rp)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="cth: 500.000"
                placeholderTextColor={Colors.disabled}
                keyboardType="numeric"
                value={total}
                onChangeText={(val) => setTotal(formatRupiahInput(val))}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Tanggal Jatuh Tempo Pembayaran</ThemedText>
              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <ThemedText style={{ fontSize: 14 }}>📅</ThemedText>
                <ThemedText style={{ fontSize: 13, color: '#0f172a', fontWeight: '600' }}>
                  {dueDate.toISOString().split('T')[0]}
                </ThemedText>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setDueDate(d);
                  }}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>No. Faktur / Keterangan Pembelian</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="cth: Faktur INV-2026-001 / Kulakan Rokok & Minuman"
                placeholderTextColor={Colors.disabled}
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            {/* Foto Bukti Faktur / Nota Pembelian */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Foto Bukti Faktur / Nota (Opsional)</ThemedText>
              {invoiceImage ? (
                <View
                  style={{
                    borderRadius: 8,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    backgroundColor: '#f8fafc',
                    marginTop: 4,
                  }}
                >
                  <Image
                    source={{ uri: invoiceImage }}
                    style={{ width: '100%', height: 160 }}
                    resizeMode="cover"
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 8,
                      backgroundColor: '#f1f5f9',
                    }}
                  >
                    <ThemedText style={{ fontSize: 11, color: '#16a34a', fontWeight: '700' }}>
                      ✓ Foto faktur terlampir
                    </ThemedText>
                    <TouchableOpacity
                      onPress={() => setInvoiceImage(null)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        backgroundColor: '#fee2e2',
                        borderRadius: 6,
                      }}
                    >
                      <ThemedText style={{ fontSize: 11, color: '#dc2626', fontWeight: '700' }}>
                        ✕ Hapus Foto
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      backgroundColor: '#f8fafc',
                      gap: 6,
                    }}
                    onPress={handleTakePhoto}
                  >
                    <ThemedText style={{ fontSize: 14 }}>📷</ThemedText>
                    <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                      Ambil Foto
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      backgroundColor: '#f8fafc',
                      gap: 6,
                    }}
                    onPress={handlePickImage}
                  >
                    <ThemedText style={{ fontSize: 14 }}>🖼️</ThemedText>
                    <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                      Pilih Galeri
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={handleClose} />
              <Button
                title={saving ? 'Menyimpan...' : 'Simpan Hutang'}
                style={{ flex: 1 }}
                onPress={handleSubmit}
                disabled={saving || suppliers.length === 0}
              />
            </View>
          </ScrollView>
        </Card>
      </ThemedView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// MODAL CRUD DATA PELANGGAN
// ─────────────────────────────────────────
function CustomerModal({
  visible,
  customers,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}: {
  visible: boolean;
  customers: Customer[];
  onClose: () => void;
  onAdd: (name: string, phone: string) => Promise<void>;
  onUpdate: (id: number, name: string, phone: string) => Promise<void>;
  onDelete: (id: number) => Promise<{ success: boolean; message?: string }>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Nama pelanggan wajib diisi');
      return;
    }
    if (editingId) {
      await onUpdate(editingId, name, phone);
    } else {
      await onAdd(name, phone);
    }
    resetForm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.modalOverlay}>
        <Card padding={20} style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle" style={{ fontSize: 16 }}>
              👥 Kelola Data Pelanggan
            </ThemedText>
            <Pressable onPress={onClose}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
            </Pressable>
          </View>

          {/* Form Tambah / Edit */}
          <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 12 }}>
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 8 }}>
              {editingId ? 'Edit Pelanggan' : '+ Tambah Pelanggan Baru'}
            </ThemedText>
            <TextInput
              style={[styles.input, { marginBottom: 6 }]}
              placeholder="Nama pelanggan..."
              placeholderTextColor={Colors.disabled}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              placeholder="Nomor HP / WhatsApp (opsional)..."
              placeholderTextColor={Colors.disabled}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {editingId ? (
                <Button title="Batal" variant="outline" size="sm" onPress={resetForm} />
              ) : null}
              <Button title={editingId ? 'Simpan' : '+ Tambah'} size="sm" onPress={handleSave} />
            </View>
          </View>

          {/* List Pelanggan */}
          <FlatList
            data={customers}
            keyExtractor={(item) => item.id.toString()}
            style={{ maxHeight: 250 }}
            renderItem={({ item }) => (
              <View style={styles.contactItemRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                    {item.name}
                  </ThemedText>
                  {item.phone ? (
                    <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                      📞 {item.phone}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => {
                      setEditingId(item.id);
                      setName(item.name);
                      setPhone(item.phone || '');
                    }}
                  >
                    <ThemedText style={{ fontSize: 14 }}>✏️</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => {
                      Alert.alert('Hapus Pelanggan', `Hapus pelanggan "${item.name}"?`, [
                        { text: 'Batal', style: 'cancel' },
                        {
                          text: 'Hapus',
                          style: 'destructive',
                          onPress: async () => {
                            const res = await onDelete(item.id);
                            if (!res.success) {
                              Alert.alert('Perhatian', res.message || 'Gagal menghapus');
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <ThemedText style={{ fontSize: 14 }}>🗑️</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <ThemedText style={{ textAlign: 'center', color: Colors.muted, padding: 12, fontSize: 12 }}>
                Belum ada data pelanggan.
              </ThemedText>
            }
          />

          <Button title="Tutup" variant="outline" style={{ marginTop: 12 }} onPress={onClose} />
        </Card>
      </ThemedView>
    </Modal>
  );
}

// ─────────────────────────────────────────
// MODAL CRUD DATA SUPPLIER
// ─────────────────────────────────────────
function SupplierModal({
  visible,
  suppliers,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}: {
  visible: boolean;
  suppliers: Supplier[];
  onClose: () => void;
  onAdd: (name: string, address: string, phone: string) => Promise<void>;
  onUpdate: (id: number, name: string, address: string, phone: string) => Promise<void>;
  onDelete: (id: number) => Promise<{ success: boolean; message?: string }>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setAddress('');
    setPhone('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Nama supplier wajib diisi');
      return;
    }
    if (editingId) {
      await onUpdate(editingId, name, address, phone);
    } else {
      await onAdd(name, address, phone);
    }
    resetForm();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.modalOverlay}>
        <Card padding={20} style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle" style={{ fontSize: 16 }}>
              🏭 Kelola Data Rekanan Supplier
            </ThemedText>
            <Pressable onPress={onClose}>
              <ThemedText style={{ fontSize: 18, color: Colors.muted }}>✕</ThemedText>
            </Pressable>
          </View>

          {/* Form Tambah / Edit */}
          <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 12 }}>
            <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 8 }}>
              {editingId ? 'Edit Supplier' : '+ Tambah Supplier Baru'}
            </ThemedText>
            <TextInput
              style={[styles.input, { marginBottom: 6 }]}
              placeholder="Nama supplier / distributor..."
              placeholderTextColor={Colors.disabled}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, { marginBottom: 6 }]}
              placeholder="Alamat kantor / gudang (opsional)..."
              placeholderTextColor={Colors.disabled}
              value={address}
              onChangeText={setAddress}
            />
            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              placeholder="Nomor HP / Sales PIC..."
              placeholderTextColor={Colors.disabled}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {editingId ? (
                <Button title="Batal" variant="outline" size="sm" onPress={resetForm} />
              ) : null}
              <Button title={editingId ? 'Simpan' : '+ Tambah'} size="sm" onPress={handleSave} />
            </View>
          </View>

          {/* List Supplier */}
          <FlatList
            data={suppliers}
            keyExtractor={(item) => item.id.toString()}
            style={{ maxHeight: 250 }}
            renderItem={({ item }) => (
              <View style={styles.contactItemRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                    {item.name}
                  </ThemedText>
                  {item.address ? (
                    <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                      📍 {item.address}
                    </ThemedText>
                  ) : null}
                  {item.phone ? (
                    <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
                      📞 {item.phone}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => {
                      setEditingId(item.id);
                      setName(item.name);
                      setAddress(item.address || '');
                      setPhone(item.phone || '');
                    }}
                  >
                    <ThemedText style={{ fontSize: 14 }}>✏️</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => {
                      Alert.alert('Hapus Supplier', `Hapus supplier "${item.name}"?`, [
                        { text: 'Batal', style: 'cancel' },
                        {
                          text: 'Hapus',
                          style: 'destructive',
                          onPress: async () => {
                            const res = await onDelete(item.id);
                            if (!res.success) {
                              Alert.alert('Perhatian', res.message || 'Gagal menghapus');
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <ThemedText style={{ fontSize: 14 }}>🗑️</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <ThemedText style={{ textAlign: 'center', color: Colors.muted, padding: 12, fontSize: 12 }}>
                Belum ada data supplier.
              </ThemedText>
            }
          />

          <Button title="Tutup" variant="outline" style={{ marginTop: 12 }} onPress={onClose} />
        </Card>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    ...Shadows.sm,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.tint,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#e2e8f0',
    padding: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
    ...Shadows.sm,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: Colors.tintDark,
    fontWeight: '700',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
  },
  btnPrimary: {
    backgroundColor: Colors.tint,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  btnSecondary: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: Colors.tintDark,
    borderColor: Colors.tintDark,
  },
  filterChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContainer: {
    paddingBottom: 32,
    gap: 8,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
    marginBottom: 8,
  },
  itemActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    alignItems: 'center',
  },
  historyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  historyBtnText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  payBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.tint,
  },
  payBtnText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  payTargetBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
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
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chipOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipOptionActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  chipOptionText: {
    fontSize: 12,
    color: Colors.text,
  },
  chipOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  contactItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconBtn: {
    padding: 6,
  },
});
