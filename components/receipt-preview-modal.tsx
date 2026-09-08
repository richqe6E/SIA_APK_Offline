import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';
import { usePrinterStore } from '@/stores/printerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { BluetoothEscposPrinter } from '@vardrz/react-native-bluetooth-escpos-printer';
import { printReceipt } from '@/services/print';

interface ReceiptPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  receiptFooter?: string;
}

export function ReceiptPreviewModal({
  visible,
  onClose,
  storeName: propStoreName,
  storeAddress: propStoreAddress,
  storePhone: propStorePhone,
  receiptFooter: propReceiptFooter,
}: ReceiptPreviewModalProps) {
  const settings = useSettingsStore();
  const storeName = propStoreName || settings.storeName || 'POS AZIZAH';
  const storeAddress = propStoreAddress !== undefined ? propStoreAddress : settings.storeAddress;
  const storePhone = propStorePhone !== undefined ? propStorePhone : settings.storePhone;
  const receiptFooter = propReceiptFooter !== undefined ? propReceiptFooter : settings.receiptFooter;
  const { printerName, connected } = usePrinterStore();

  const handleTestPrint = async () => {
    if (!connected) {
      Alert.alert(
        'Printer Belum Terhubung',
        'Pastikan printer thermal Bluetooth Anda telah terhubung di menu Printer Bluetooth.'
      );
      return;
    }

    try {
      await printReceipt({
        transactionId: 1,
        createdAt: new Date().toISOString(),
        items: [
          {
            product_name: 'Kopi Susu Gula Aren Spesial',
            quantity: 2,
            product_price: 18000,
            subtotal: 36000,
          },
          {
            product_name: 'Telur Ayam Kampung Fresh',
            quantity: 1,
            is_weighted: 1,
            weight_gram: 750,
            price_per_kg: 32000,
            product_price: 24000,
            subtotal: 24000,
          },
          {
            product_name: 'Roti Bakar Cokelat Keju',
            quantity: 1,
            product_price: 18000,
            subtotal: 18000,
          },
        ],
        total: 78000,
        paymentMethod: 'tunai',
        paymentAmount: 80000,
        change: 2000,
        storeName,
        storeAddress,
        storePhone,
        receiptFooter,
      });
      Alert.alert('Sukses', 'Nota contoh berhasil dicetak ke printer thermal 58mm');
    } catch (e: any) {
      Alert.alert('Gagal Cetak', e?.message || 'Periksa koneksi printer thermal');
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <ThemedView style={styles.overlay}>
        <View style={styles.container}>
          <ThemedText type="title" style={{ fontSize: 18, color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>
            Simulasi Nota Thermal 58mm
          </ThemedText>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Thermal Receipt Paper */}
            <View style={styles.paper}>
              {/* Store Header */}
              <ThemedText style={styles.paperStoreName}>{storeName.toUpperCase()}</ThemedText>
              {storeAddress ? (
                <ThemedText style={styles.paperSubText}>{storeAddress}</ThemedText>
              ) : null}
              {storePhone ? (
                <ThemedText style={styles.paperSubText}>Telp: {storePhone}</ThemedText>
              ) : null}

              <ThemedText style={styles.paperDashed}>--------------------------------</ThemedText>

              {/* Meta */}
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperSmall}>{dateStr} {timeStr}</ThemedText>
                <ThemedText style={styles.paperSmall}>Kasir: Kasir Utama</ThemedText>
              </View>
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperSmall}>No: INV-SAMPLE-001</ThemedText>
                <ThemedText style={styles.paperSmall}>Tunai</ThemedText>
              </View>

              <ThemedText style={styles.paperDashed}>--------------------------------</ThemedText>

              {/* Items */}
              <View style={styles.paperItem}>
                <ThemedText style={styles.paperItemName}>Kopi Susu Gula Aren Spesial</ThemedText>
                <View style={styles.paperRow}>
                  <ThemedText style={styles.paperSubText}>  2 x Rp 18.000</ThemedText>
                  <ThemedText style={styles.paperText}>Rp 36.000</ThemedText>
                </View>
              </View>

              <View style={styles.paperItem}>
                <ThemedText style={styles.paperItemName}>Telur Ayam Kampung Fresh</ThemedText>
                <View style={styles.paperRow}>
                  <ThemedText style={styles.paperSubText}>  750g @ Rp 32.000/kg</ThemedText>
                  <ThemedText style={styles.paperText}>Rp 24.000</ThemedText>
                </View>
              </View>

              <View style={styles.paperItem}>
                <ThemedText style={styles.paperItemName}>Roti Bakar Cokelat Keju</ThemedText>
                <View style={styles.paperRow}>
                  <ThemedText style={styles.paperSubText}>  1 x Rp 18.000</ThemedText>
                  <ThemedText style={styles.paperText}>Rp 18.000</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.paperDashed}>--------------------------------</ThemedText>

              {/* Totals */}
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperText}>Subtotal</ThemedText>
                <ThemedText style={styles.paperText}>Rp 78.000</ThemedText>
              </View>
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperText}>Diskon</ThemedText>
                <ThemedText style={styles.paperText}>Rp 0</ThemedText>
              </View>
              <View style={[styles.paperRow, { marginTop: 4 }]}>
                <ThemedText style={styles.paperTotalLabel}>TOTAL</ThemedText>
                <ThemedText style={styles.paperTotalValue}>Rp 78.000</ThemedText>
              </View>
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperText}>Tunai</ThemedText>
                <ThemedText style={styles.paperText}>Rp 80.000</ThemedText>
              </View>
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperText}>Kembalian</ThemedText>
                <ThemedText style={styles.paperText}>Rp 2.000</ThemedText>
              </View>

              <ThemedText style={styles.paperDashed}>================================</ThemedText>

              {/* Footer Message */}
              {receiptFooter ? (
                <ThemedText style={styles.paperFooterMsg}>{receiptFooter}</ThemedText>
              ) : (
                <ThemedText style={styles.paperFooterMsg}>Terima kasih atas kunjungan Anda!</ThemedText>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {connected && (
              <Button
                title={`🖨️ Cetak ke ${printerName || 'Printer'}`}
                size="sm"
                style={{ backgroundColor: Colors.tint, marginBottom: 8 }}
                onPress={handleTestPrint}
              />
            )}
            <Button
              title="Tutup Pratinjau"
              variant="secondary"
              size="sm"
              onPress={onClose}
            />
          </View>
        </View>
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
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '90%',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  paper: {
    width: 290,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  paperStoreName: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000000',
    marginBottom: 4,
  },
  paperSubText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    textAlign: 'center',
    color: '#333333',
    lineHeight: 14,
  },
  paperDashed: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    textAlign: 'center',
    color: '#555555',
    marginVertical: 4,
    letterSpacing: -0.5,
  },
  paperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paperSmall: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9.5,
    color: '#333333',
  },
  paperItem: {
    marginVertical: 2,
  },
  paperItemName: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#000000',
    fontWeight: '500',
  },
  paperText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#000000',
  },
  paperTotalLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
  },
  paperTotalValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    fontWeight: 'bold',
    color: '#000000',
  },
  paperFooterMsg: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    textAlign: 'center',
    color: '#333333',
    marginTop: 4,
    fontStyle: 'italic',
  },
  paperBrand: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 9,
    textAlign: 'center',
    color: '#888888',
    marginTop: 6,
  },
  buttonContainer: {
    marginTop: 12,
    width: '100%',
  },
});
