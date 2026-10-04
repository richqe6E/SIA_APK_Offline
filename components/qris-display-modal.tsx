import React from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Colors } from '@/constants/theme';

interface QrisDisplayModalProps {
  visible: boolean;
  onClose: () => void;
  qrisImagePath: string;
  storeName: string;
  totalAmount: number;
  onConfirmPayment?: () => void;
}

export function QrisDisplayModal({
  visible,
  onClose,
  qrisImagePath,
  storeName,
  totalAmount,
  onConfirmPayment,
}: QrisDisplayModalProps) {
  const handleRequestClose = () => {
    Alert.alert(
      'Batalkan Tampilan QRIS?',
      'Pastikan pembeli belum mentransfer dana atau pembayaran memang ingin dibatalkan.',
      [
        { text: 'Kembali ke QRIS', style: 'cancel' },
        { text: 'Tutup / Batal', style: 'destructive', onPress: onClose },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <ThemedView style={styles.overlay}>
        <Card style={styles.modalCard} padding={20}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>PEMBAYARAN QRIS / TRANSFER</ThemedText>
            <ThemedText style={styles.storeName}>{storeName.toUpperCase()}</ThemedText>
            <ThemedText style={styles.tagline}>
              Scan QRIS atau Transfer Bank ke Rekening Toko
            </ThemedText>
          </View>

          {/* Amount Badge */}
          <View style={styles.amountBox}>
            <ThemedText style={{ fontSize: 11, color: '#166534', fontWeight: '700' }}>
              TOTAL TAGIHAN:
            </ThemedText>
            <ThemedText style={styles.amountText}>
              Rp {totalAmount.toLocaleString('id-ID')}
            </ThemedText>
          </View>

          {/* Info Penerimaan Kas di Bank */}
          <View style={styles.cashAccountInfoBox}>
            <ThemedText style={{ fontSize: 11, color: '#1e40af', fontWeight: '700' }}>
              🏛️ Penerimaan: Kas di Bank (Rekening Toko)
            </ThemedText>
            <ThemedText style={{ fontSize: 10, color: '#3b82f6', textAlign: 'center', marginTop: 1 }}>
              Otomatis tercatat non-tunai di Buku Kas & tidak menambah uang fisik di laci kasir.
            </ThemedText>
          </View>

          {/* QRIS Image Container */}
          <View style={styles.imageContainer}>
            {qrisImagePath ? (
              <Image
                source={{ uri: qrisImagePath }}
                style={styles.qrisImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.emptyQrisBox}>
                <ThemedText style={{ fontSize: 44, marginBottom: 8 }}>📱</ThemedText>
                <ThemedText type="defaultSemiBold" style={{ textAlign: 'center', fontSize: 13 }}>
                  Gambar QRIS Belum Diunggah
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: Colors.muted, textAlign: 'center', marginTop: 4 }}>
                  Silakan unggah foto QRIS statis toko di menu Pengaturan &gt; Atur Toko &gt; Foto QRIS.
                </ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.instruction}>
            Arahkan kamera aplikasi perbankan atau e-wallet (BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay) untuk memindai kode QRIS atau transfer ke rekening toko.
          </ThemedText>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button
              title="Tutup"
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={handleRequestClose}
            />
            {onConfirmPayment && (
              <Button
                title="✓ QRIS / Transfer Diterima"
                size="sm"
                style={{ flex: 1.3 }}
                onPress={() => {
                  onClose();
                  onConfirmPayment();
                }}
              />
            )}
          </View>
        </Card>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.8,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.tint,
    marginTop: 2,
  },
  tagline: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  amountBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  amountText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#15803d',
    marginTop: 2,
  },
  cashAccountInfoBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  imageContainer: {
    width: 250,
    height: 250,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 6,
  },
  qrisImage: {
    width: '100%',
    height: '100%',
  },
  emptyQrisBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  instruction: {
    fontSize: 10.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 15,
  },
});
