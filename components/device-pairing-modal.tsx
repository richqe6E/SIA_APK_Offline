import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
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
    supabaseUrl,
    supabaseAnonKey,
    setPairingCode,
    setCloudConnected,
    setCloudSyncStatus,
    setCloudCredentials,
  } = useSettingsStore();

  const isPemantau = false;

  const [inputCode, setInputCode] = useState(storePairingCode);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [urlInput, setUrlInput] = useState(supabaseUrl || '');
  const [keyInput, setKeyInput] = useState(supabaseAnonKey || '');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState(storePairingCode);

  useEffect(() => {
    if (supabaseUrl) setUrlInput(supabaseUrl);
    if (supabaseAnonKey) setKeyInput(supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    setInputCode(storePairingCode);
    setCustomCodeInput(storePairingCode);
  }, [storePairingCode]);

  const handleGenerateNewCode = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const newCode = generatePairingCode();
      await setPairingCode(newCode, db);
      setInputCode(newCode);
      setCustomCodeInput(newCode);

      // Auto-push directly to Supabase so HP Pemilik can instantly connect
      const res = await pushSyncToCloud(db, newCode);
      setTesting(false);

      if (res.success) {
        setCloudConnected(true);
        setMsg({
          type: 'success',
          text: `Kode baru ${newCode} berhasil dibuat dan langsung terdaftar di server Cloud! Masukkan kode ini di HP Pemilik.`,
        });
      } else {
        setMsg({
          type: 'success',
          text: `Kode baru ${newCode} dibuat di tablet. Tekan "Sinkronkan Sekarang" jika internet sempat terputus.`,
        });
      }
    } catch (err: any) {
      setTesting(false);
      setMsg({
        type: 'error',
        text: 'Gagal membuat kode: ' + (err?.message || 'Kesalahan sistem'),
      });
    }
  };

  const handleSaveCustomCode = async () => {
    const formatted = customCodeInput.trim().toUpperCase();
    if (formatted.length < 3) {
      setMsg({ type: 'error', text: 'Kode sambungan minimal 3 karakter (contoh: AZ-7789).' });
      return;
    }
    setTesting(true);
    setMsg(null);
    try {
      await setPairingCode(formatted, db);
      setInputCode(formatted);
      const res = await pushSyncToCloud(db, formatted);
      setTesting(false);
      setIsEditingCode(false);

      if (res.success) {
        setCloudConnected(true);
        setMsg({
          type: 'success',
          text: `Kode "${formatted}" berhasil disimpan dan didaftarkan ke Cloud! Masukkan kode ini di HP Pemilik.`,
        });
      } else {
        setMsg({
          type: 'error',
          text: `Kode disimpan di tablet, tapi gagal terdaftar ke cloud: ${res.error || 'Periksa koneksi internet'}.`,
        });
      }
    } catch (err: any) {
      setTesting(false);
      setMsg({
        type: 'error',
        text: 'Gagal menyimpan kode: ' + (err?.message || 'Kesalahan sistem'),
      });
    }
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

  const handleSaveCloudConfig = async () => {
    setTesting(true);
    await setCloudCredentials(db, urlInput.trim(), keyInput.trim());
    setTesting(false);
    setMsg({
      type: 'success',
      text: 'Pengaturan server Supabase berhasil disimpan!',
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <ThemedView style={styles.overlay}>
        <Card style={styles.card} padding={24}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
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
                {isEditingCode ? (
                  <View style={styles.customCodeBox}>
                    <ThemedText style={styles.customCodeLabel}>✏️ Masukkan Kode Sambungan Baru:</ThemedText>
                    <TextInput
                      style={styles.customCodeInput}
                      value={customCodeInput}
                      onChangeText={(t) => setCustomCodeInput(t.toUpperCase())}
                      placeholder="Contoh: AZ-7789"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="characters"
                      maxLength={12}
                    />
                    <View style={styles.customCodeBtnRow}>
                      <TouchableOpacity
                        style={[styles.btnSmall, styles.btnOutline]}
                        onPress={() => {
                          setCustomCodeInput(storePairingCode);
                          setIsEditingCode(false);
                        }}
                        disabled={testing}
                      >
                        <ThemedText style={styles.btnOutlineText}>Batal</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnSmall, styles.btnPrimary]}
                        onPress={handleSaveCustomCode}
                        disabled={testing}
                      >
                        {testing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <ThemedText style={styles.btnPrimaryText}>💾 Simpan & Daftarkan</ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.qrCodeSimulation}>
                    <ThemedText style={styles.qrIcon}>📱 ⇄ 💻</ThemedText>
                    <ThemedText style={styles.qrStoreName}>{storeName}</ThemedText>
                    <View style={styles.pairingCodeBox}>
                      <ThemedText style={styles.pairingCodeText}>{storePairingCode}</ThemedText>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setCustomCodeInput(storePairingCode);
                        setIsEditingCode(true);
                      }}
                      style={styles.editCodeLink}
                    >
                      <ThemedText style={styles.editCodeLinkText}>✏️ Ubah Kode Manual</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.qrHint}>
                      Kode Otorisasi Cloud Perangkat Toko
                    </ThemedText>
                  </View>
                )}

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
                  1. Buka aplikasi <ThemedText style={{ fontWeight: '800' }}>KENDALI USAHA AZIZAH</ThemedText> di smartphone / HP Pemilik.{'\n'}
                  2. Masukkan kode sambung <ThemedText style={{ fontWeight: '800' }}>{storePairingCode}</ThemedText> di aplikasi tersebut.{'\n'}
                  3. Laporan omset, rincian pembayaran tunai vs non-tunai, dan keuangan toko langsung tersinkronisasi otomatis.
                </ThemedText>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnOutline]}
                    onPress={handleGenerateNewCode}
                    disabled={testing}
                  >
                    {testing ? (
                      <ActivityIndicator size="small" color={Colors.tint} />
                    ) : (
                      <ThemedText style={styles.btnOutlineText}>🎲 Acak Kode Baru</ThemedText>
                    )}
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

            {/* Section C: Pengaturan Cloud Supabase (Jarak Jauh) */}
            <TouchableOpacity
              style={styles.toggleCloudConfigBtn}
              onPress={() => setShowCloudConfig(!showCloudConfig)}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.toggleCloudConfigText}>
                {showCloudConfig ? '▲ Tutup Server Cloud' : '⚙️ Pengaturan Server Cloud Supabase (Jarak Jauh)'}
              </ThemedText>
            </TouchableOpacity>

            {showCloudConfig && (
              <View style={styles.cloudConfigBox}>
                <ThemedText style={styles.cloudConfigDesc}>
                  Hubungkan database cloud gratis (Supabase) agar tablet toko dan HP pemilik dapat saling bertukar data secara online di mana pun berada.
                </ThemedText>

                <ThemedText style={styles.fieldLabelSmall}>Project URL Supabase:</ThemedText>
                <TextInput
                  style={styles.configInput}
                  value={urlInput}
                  onChangeText={setUrlInput}
                  placeholder="https://xyzproject.supabase.co"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                />

                <ThemedText style={styles.fieldLabelSmall}>Anon Public API Key:</ThemedText>
                <TextInput
                  style={styles.configInput}
                  value={keyInput}
                  onChangeText={setKeyInput}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.btn, styles.btnSaveConfig]}
                  onPress={handleSaveCloudConfig}
                  disabled={testing}
                >
                  <ThemedText style={styles.btnSaveConfigText}>
                    💾 Simpan Kredensial Supabase
                  </ThemedText>
                </TouchableOpacity>

                <View style={styles.sqlHelpBox}>
                  <ThemedText style={styles.sqlHelpTitle}>Perintah SQL Tabel Supabase (SQL Editor):</ThemedText>
                  <ThemedText style={styles.sqlCodeText}>
                    CREATE TABLE IF NOT EXISTS store_sync ({'\n'}
                    {'  '}pairing_code TEXT PRIMARY KEY,{'\n'}
                    {'  '}store_name TEXT,{'\n'}
                    {'  '}payload JSONB,{'\n'}
                    {'  '}updated_at TIMESTAMPTZ DEFAULT now(){'\n'}
                    );
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Close Button */}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <ThemedText style={styles.closeBtnText}>Tutup</ThemedText>
            </TouchableOpacity>
          </ScrollView>
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
  editCodeLink: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
    marginBottom: 8,
  },
  editCodeLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  customCodeBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  customCodeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  customCodeInput: {
    width: '100%',
    height: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 3,
  },
  customCodeBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btnSmall: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  toggleCloudConfigBtn: {
    marginTop: 6,
    paddingVertical: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleCloudConfigText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  cloudConfigBox: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  cloudConfigDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  fieldLabelSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginTop: 4,
  },
  configInput: {
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0f172a',
  },
  btnSaveConfig: {
    backgroundColor: '#0284c7',
    marginTop: 6,
  },
  btnSaveConfigText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sqlHelpBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  sqlHelpTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 4,
  },
  sqlCodeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#e2e8f0',
    lineHeight: 14,
  },
});
