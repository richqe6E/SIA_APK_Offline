import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  generatePairingCode,
  pushSyncToCloud,
  fetchSyncFromCloud,
} from '@/services/cloudSync';

interface DevicePairingModalProps {
  visible: boolean;
  onClose: () => void;
}

export function DevicePairingModal({ visible, onClose }: DevicePairingModalProps) {
  const db = useSQLiteContext();
  const {
    storeName,
    currentUserRole,
    storePairingCode,
    isCloudConnected,
    setPairingCode,
    setCloudConnected,
    setCloudSyncStatus,
  } = useSettingsStore();

  const isPemantau = currentUserRole === 'pemantau';

  const [inputCode, setInputCode] = useState(storePairingCode);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGenerateNewCode = () => {
    const newCode = generatePairingCode();
    setPairingCode(newCode);
    setInputCode(newCode);
    setMsg({
      type: 'success',
      text: `Kode baru ${newCode} berhasil dibuat. Masukkan kode ini di HP Pemilik.`,
    });
  };

  const handleConnectPhone = async () => {
    if (!inputCode.trim()) {
      setMsg({ type: 'error', text: 'Masukkan kode pairing perangkat terlebih dahulu.' });
      return;
    }
    setTesting(true);
    setMsg(null);

    const formattedCode = inputCode.trim().toUpperCase();
    setPairingCode(formattedCode);

    const res = await fetchSyncFromCloud(formattedCode, db);
    setTesting(false);

    if (res.success) {
      setCloudConnected(true);
      setMsg({
        type: 'success',
        text: `Berhasil tersambung ke ${res.payload?.storeName || storeName}! Data usaha kini realtime.`,
      });
    } else {
      setMsg({
        type: 'error',
        text: res.error || 'Gagal menyambungkan ke perangkat toko.',
      });
    }
  };

  const handlePushSyncTablet = async () => {
    setTesting(true);
    setMsg(null);

    const res = await pushSyncToCloud(db, storePairingCode);
    setTesting(false);

    if (res.success) {
      setCloudConnected(true);
      setMsg({
        type: 'success',
        text: 'Data toko berhasil diunggah ke cloud bridge! HP Pemilik kini dapat membaca data terbaru.',
      });
    } else {
      setMsg({
        type: 'error',
        text: res.error || 'Gagal mengunggah data sinkronisasi.',
      });
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Putuskan Koneksi Perangkat',
      'Apakah Anda yakin ingin memutuskan sambungan cloud dengan perangkat toko?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Putuskan',
          style: 'destructive',
          onPress: () => {
            setCloudConnected(false);
            setCloudSyncStatus('idle');
            setMsg({ type: 'success', text: 'Perangkat berhasil diputuskan.' });
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ThemedView style={styles.overlay}>
        <Card style={styles.card} padding={24}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <ThemedText style={styles.icon}>🔗</ThemedText>
            </View>
            <ThemedText style={styles.title}>Sambungkan Perangkat</ThemedText>
            <ThemedText style={styles.subtitle}>
              Integrasi Cloud Realtime Tablet Toko & HP Pemilik Usaha
            </ThemedText>
          </View>

          {/* Feedback Message */}
          {msg && (
            <View
              style={[
                styles.msgBox,
                msg.type === 'success' ? styles.msgSuccess : styles.msgError,
              ]}
            >
              <ThemedText
                style={[
                  styles.msgText,
                  msg.type === 'success' ? styles.msgTextSuccess : styles.msgTextError,
                ]}
              >
                {msg.type === 'success' ? '✓ ' : '⚠️ '}
                {msg.text}
              </ThemedText>
            </View>
          )}

          {/* Section A: Tablet View (Pemilik / Kasir) */}
          {!isPemantau ? (
            <View style={styles.body}>
              <View style={styles.qrCodeSimulation}>
                <ThemedText style={styles.qrIcon}>📱 ⇄ 💻</ThemedText>
                <ThemedText style={styles.qrStoreName}>{storeName}</ThemedText>
                <View style={styles.pairingCodeBox}>
                  <ThemedText style={styles.pairingCodeText}>{storePairingCode}</ThemedText>
                </View>
                <ThemedText style={styles.qrHint}>
                  Kode Otorisasi Cloud Perangkat Toko
                </ThemedText>
              </View>

              <View style={styles.statusIndicatorRow}>
                <View
                  style={[
                    styles.dot,
                    isCloudConnected ? styles.dotConnected : styles.dotWaiting,
                  ]}
                />
                <ThemedText style={styles.statusText}>
                  {isCloudConnected
                    ? '🟢 Cloud Bridge Aktif • HP Pemilik Terhubung'
                    : '🟡 Menunggu Sambungan dari HP Pemilik Usaha'}
                </ThemedText>
              </View>

              <ThemedText style={styles.instructionText}>
                1. Buka aplikasi POS AZIZAH di smartphone / HP Pemilik.{'\n'}
                2. Masuk dengan peran <ThemedText style={{ fontWeight: '800' }}>3. Pemantau Usaha</ThemedText>.{'\n'}
                3. Buka Pengaturan &gt; Sambungkan Perangkat lalu masukkan kode <ThemedText style={{ fontWeight: '800' }}>{storePairingCode}</ThemedText>.
              </ThemedText>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnOutline]}
                  onPress={handleGenerateNewCode}
                >
                  <ThemedText style={styles.btnOutlineText}>🎲 Acak Kode Baru</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={handlePushSyncTablet}
                  disabled={testing}
                >
                  {testing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.btnPrimaryText}>☁️ Sinkronkan Sekarang</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Section B: Phone View (Pemantau Usaha) */
            <View style={styles.body}>
              <ThemedText style={styles.inputLabel}>
                Masukkan Kode Pairing dari Tablet Toko:
              </ThemedText>
              <TextInput
                style={styles.input}
                value={inputCode}
                onChangeText={setInputCode}
                placeholder="Contoh: AZ-7789"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                maxLength={10}
              />

              <View style={styles.statusIndicatorRow}>
                <View
                  style={[
                    styles.dot,
                    isCloudConnected ? styles.dotConnected : styles.dotOffline,
                  ]}
                />
                <ThemedText style={styles.statusText}>
                  {isCloudConnected
                    ? `🟢 Terhubung ke Toko (${storePairingCode})`
                    : '🔴 Belum Terhubung'}
                </ThemedText>
              </View>

              <View style={styles.btnRow}>
                {isCloudConnected ? (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnDanger]}
                    onPress={handleDisconnect}
                  >
                    <ThemedText style={styles.btnDangerText}>Putuskan Koneksi</ThemedText>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { flex: 2 }]}
                  onPress={handleConnectPhone}
                  disabled={testing}
                >
                  {testing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.btnPrimaryText}>
                      🔗 Hubungkan ke Toko
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <ThemedText style={styles.closeBtnText}>Tutup</ThemedText>
          </TouchableOpacity>
        </Card>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 3,
  },
  msgBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  msgSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  msgError: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  msgText: {
    fontSize: 11,
    fontWeight: '600',
  },
  msgTextSuccess: {
    color: '#15803d',
  },
  msgTextError: {
    color: '#b91c1c',
  },
  body: {
    gap: 14,
  },
  qrCodeSimulation: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    borderStyle: 'dashed',
    padding: 18,
    alignItems: 'center',
  },
  qrIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  qrStoreName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  pairingCodeBox: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    marginVertical: 10,
  },
  pairingCodeText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#38bdf8',
    letterSpacing: 4,
  },
  qrHint: {
    fontSize: 11,
    color: '#64748b',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotConnected: {
    backgroundColor: '#22c55e',
  },
  dotWaiting: {
    backgroundColor: '#f59e0b',
  },
  dotOffline: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  instructionText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 18,
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  input: {
    height: 50,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: 3,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.tintDark,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  btnOutline: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  btnOutlineText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  btnDanger: {
    backgroundColor: '#fee2e2',
  },
  btnDangerText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
});
