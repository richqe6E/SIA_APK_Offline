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
  const storeName = propStoreName || settings.storeName || 'POS Karya Riki Rivaldi';
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
      await BluetoothEscposPrinter.printText(`${storeName.toUpperCase()}\n\r`, {
        align: 'center',
        fonttype: 1,
      });
      if (storeAddress) {
        await BluetoothEscposPrinter.printText(`${storeAddress}\n\r`, { align: 'center' });
      }
      if (storePhone) {
        await BluetoothEscposPrinter.printText(`Telp/WA: ${storePhone}\n\r`, { align: 'center' });
      }
      await BluetoothEscposPrinter.printText('--------------------------------\n\r', {});
      await BluetoothEscposPrinter.printText('CONTOH TRANSAKSI SAMPLE\n\r', {});
      await BluetoothEscposPrinter.printColumn(
        [20, 12],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['2x Kopi Susu Aren', 'Rp 36.000'],
        {}
      );
      await BluetoothEscposPrinter.printColumn(
        [20, 12],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['1x Roti Bakar Cokelat', 'Rp 18.000'],
        {}
      );
      await BluetoothEscposPrinter.printText('--------------------------------\n\r', {});
      await BluetoothEscposPrinter.printColumn(
        [16, 16],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['TOTAL', 'Rp 54.000'],
        { fonttype: 1 }
      );
      await BluetoothEscposPrinter.printColumn(
        [16, 16],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['TUNAI', 'Rp 60.000'],
        {}
      );
      await BluetoothEscposPrinter.printColumn(
        [16, 16],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['KEMBALI', 'Rp 6.000'],
        {}
      );
      await BluetoothEscposPrinter.printText('================================\n\r', {});
      if (receiptFooter) {
        await BluetoothEscposPrinter.printText(`${receiptFooter}\n\r`, { align: 'center' });
      }
      await BluetoothEscposPrinter.printText('POS Karya Riki Rivaldi\n\r', { align: 'center' });
      await BluetoothEscposPrinter.printAndFeed(3);
      BluetoothEscposPrinter.cutOnePoint();
      Alert.alert('Sukses', 'Nota contoh berhasil dicetak ke printer');
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
                <ThemedText style={styles.paperItemName}>2x Kopi Susu Gula Aren</ThemedText>
                <View style={styles.paperRow}>
                  <ThemedText style={styles.paperSubText}>@18.000</ThemedText>
                  <ThemedText style={styles.paperText}>36.000</ThemedText>
                </View>
              </View>

              <View style={styles.paperItem}>
                <ThemedText style={styles.paperItemName}>1x Roti Bakar Cokelat Keju</ThemedText>
                <View style={styles.paperRow}>
                  <ThemedText style={styles.paperSubText}>@18.000</ThemedText>
                  <ThemedText style={styles.paperText}>18.000</ThemedText>
                </View>
              </View>

              <View style={styles.paperItem}>
                <ThemedText style={styles.paperItemName}>1x Air Mineral 600ml</ThemedText>
                <View style={styles.paperRow}>
                  <ThemedText style={styles.paperSubText}>@5.000</ThemedText>
                  <ThemedText style={styles.paperText}>5.000</ThemedText>
                </View>
              </View>

              <ThemedText style={styles.paperDashed}>--------------------------------</ThemedText>

              {/* Totals */}
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperText}>Subtotal</ThemedText>
                <ThemedText style={styles.paperText}>59.000</ThemedText>
              </View>
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperText}>Diskon</ThemedText>
                <ThemedText style={styles.paperText}>0</ThemedText>
              </View>
              <View style={[styles.paperRow, { marginTop: 4 }]}>
                <ThemedText style={styles.paperTotalLabel}>TOTAL</ThemedText>
                <ThemedText style={styles.paperTotalValue}>Rp 59.000</ThemedText>
              </View>
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperText}>Tunai</ThemedText>
                <ThemedText style={styles.paperText}>60.000</ThemedText>
              </View>
              <View style={styles.paperRow}>
                <ThemedText style={styles.paperText}>Kembalian</ThemedText>
                <ThemedText style={styles.paperText}>1.000</ThemedText>
              </View>

              <ThemedText style={styles.paperDashed}>================================</ThemedText>

              {/* Footer Message */}
              {receiptFooter ? (
                <ThemedText style={styles.paperFooterMsg}>{receiptFooter}</ThemedText>
              ) : (
                <ThemedText style={styles.paperFooterMsg}>Terima kasih atas kunjungan Anda!</ThemedText>
              )}

              <ThemedText style={styles.paperBrand}>POS Karya Riki Rivaldi</ThemedText>
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
