import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  title?: string;
}

export function BarcodeScannerModal({
  visible,
  onClose,
  onScanned,
  title = 'Pindai Barcode / QR Code',
}: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  // Default KAMERA BELAKANG sesuai Poin 9
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setFacing('back'); // Selalu reset ke kamera belakang default
      setTorch(false);
      setZoom(0);
    }
  }, [visible]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || !data) return;
    setScanned(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    onScanned(data.trim());
    setTimeout(() => {
      onClose();
    }, 350);
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const toggleZoom = () => {
    setZoom((prev) => (prev === 0 ? 0.25 : prev === 0.25 ? 0.5 : 0));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Header Bar */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.topTitle}>{title}</ThemedText>
            <ThemedText style={styles.topSubtitle}>
              Kamera Aktif: {facing === 'back' ? 'Kamera Belakang (Default)' : 'Kamera Depan'}
            </ThemedText>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <ThemedText style={styles.closeBtnText}>✕ Tutup</ThemedText>
          </Pressable>
        </View>

        {/* Camera Surface / Permission Check */}
        {!permission ? (
          <View style={styles.permissionBox}>
            <ThemedText style={styles.permissionText}>Memeriksa izin kamera...</ThemedText>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <ThemedText style={{ fontSize: 40, marginBottom: 8 }}>📷</ThemedText>
            <ThemedText style={styles.permissionTitle}>Akses Kamera Diperlukan</ThemedText>
            <ThemedText style={styles.permissionText}>
              Aplikasi memerlukan izin kamera untuk memindai barcode / QR code barang dan nota.
            </ThemedText>
            <Pressable style={styles.grantBtn} onPress={requestPermission}>
              <ThemedText style={styles.grantBtnText}>Izinkan Akses Kamera</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing={facing}
              enableTorch={torch}
              zoom={zoom}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'upc_a',
                  'upc_e',
                  'code93',
                  'itf14',
                  'codabar',
                ],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />

            {/* Target Reticle / Finder Frame */}
            <View style={styles.finderContainer}>
              <View style={styles.reticle}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <View style={styles.laserLine} />
              </View>
              <ThemedText style={styles.hintText}>
                Arahkan kotak ke Barcode / QR Code barang
              </ThemedText>
            </View>

            {/* Controls Bar (Camera Switcher & Torch) */}
            <View style={styles.controlsBar}>
              {/* Pemilih Kamera Belakang / Depan (Poin 9) */}
              <Pressable style={styles.controlBtn} onPress={toggleFacing}>
                <ThemedText style={styles.controlBtnIcon}>🔄</ThemedText>
                <ThemedText style={styles.controlBtnText}>
                  {facing === 'back' ? 'Ganti ke Depan' : 'Ganti ke Belakang'}
                </ThemedText>
              </Pressable>

              {/* Senter / Flashlight */}
              <Pressable
                style={[styles.controlBtn, torch && styles.controlBtnActive]}
                onPress={() => setTorch((t) => !t)}
              >
                <ThemedText style={styles.controlBtnIcon}>🔦</ThemedText>
                <ThemedText style={styles.controlBtnText}>
                  {torch ? 'Senter Nyala' : 'Senter Mati'}
                </ThemedText>
              </Pressable>

              {/* Zoom Level */}
              <Pressable style={styles.controlBtn} onPress={toggleZoom}>
                <ThemedText style={styles.controlBtnIcon}>🔍</ThemedText>
                <ThemedText style={styles.controlBtnText}>
                  Zoom: {zoom === 0 ? '1x' : zoom === 0.25 ? '1.5x' : '2x'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingBottom: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    zIndex: 10,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  topSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  permissionText: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 16,
  },
  grantBtn: {
    backgroundColor: Colors.tint,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  grantBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 260,
    height: 180,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#38bdf8',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 6 },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  hintText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  controlsBar: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    width: '100%',
  },
  controlBtn: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  controlBtnActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  controlBtnIcon: {
    fontSize: 16,
  },
  controlBtnText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '700',
  },
});
