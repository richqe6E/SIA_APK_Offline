import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settingsStore';

import { useSQLiteContext } from 'expo-sqlite';

interface RoleLoginModalProps {
  visible: boolean;
}

export function RoleLoginModal({ visible }: RoleLoginModalProps) {
  const db = useSQLiteContext();
  const { storeName, loginAsKasir, loginAsPemilik, loginAsPemantau, loadSettings } = useSettingsStore();
  const [pinMode, setPinMode] = useState(false);
  const [targetRole, setTargetRole] = useState<'pemilik' | 'pemantau'>('pemilik');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setErrorMsg('');
      setPin('');
      await loadSettings(db);
    } catch {
      // ignore
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const handleKasirLogin = () => {
    setErrorMsg('');
    setPin('');
    setPinMode(false);
    loginAsKasir();
  };

  const handleOpenPin = (role: 'pemilik' | 'pemantau') => {
    setErrorMsg('');
    setPin('');
    setTargetRole(role);
    setPinMode(true);
  };

  const handleNumpad = (val: string) => {
    setErrorMsg('');
    if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;

    const nextPin = pin + val;
    setPin(nextPin);

    if (nextPin.length === 6) {
      const ok = targetRole === 'pemilik' ? loginAsPemilik(nextPin) : loginAsPemantau(nextPin);
      if (ok) {
        setPin('');
        setPinMode(false);
      } else {
        setErrorMsg('PIN yang Anda masukkan salah.');
        setPin('');
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.overlay}>
        <Card style={styles.card} padding={28}>
          {/* Top Action Bar: Refresh */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefresh}
              activeOpacity={0.7}
              disabled={refreshing}
            >
              <ThemedText style={styles.refreshIcon}>{refreshing ? '⏳' : '🔄'}</ThemedText>
              <ThemedText style={styles.refreshText}>
                {refreshing ? 'Menyegarkan...' : 'Segarkan Halaman'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Header Toko */}
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/app-logo-p.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText style={styles.brandTitle}>POS AZIZAH</ThemedText>
            <ThemedText style={styles.storeName}>{storeName}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {pinMode
                ? 'Masukkan PIN Otorisasi Pemilik Toko'
                : 'Pilih peran untuk melanjutkan akses aplikasi'}
            </ThemedText>
          </View>

          {!pinMode ? (
            <View style={styles.roleContainer}>
              {/* Opsi 1: Kasir */}
              <TouchableOpacity
                style={[styles.roleCard, styles.kasirCard]}
                activeOpacity={0.85}
                onPress={handleKasirLogin}
              >
                <View style={styles.roleIconBoxKasir}>
                  <ThemedText style={styles.roleIcon}>🛒</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText style={styles.roleName}>1. Masuk sebagai Kasir</ThemedText>
                    <View style={styles.badgeFree}>
                      <ThemedText style={styles.badgeFreeText}>Langsung</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.roleDesc}>
                    Mode kasir tablet: transaksi kasir, katalog produk, dan riwayat nota
                  </ThemedText>
                </View>
                <ThemedText style={styles.chevron}>›</ThemedText>
              </TouchableOpacity>

              {/* Opsi 2: Pemilik Toko (Akses Penuh Tablet) */}
              <TouchableOpacity
                style={[styles.roleCard, styles.ownerCard]}
                activeOpacity={0.85}
                onPress={() => handleOpenPin('pemilik')}
              >
                <View style={styles.roleIconBoxOwner}>
                  <ThemedText style={styles.roleIcon}>👑</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ThemedText style={styles.roleName}>2. Masuk Pemilik Toko</ThemedText>
                    <View style={styles.badgePin}>
                      <ThemedText style={styles.badgePinText}>Akses Penuh</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.roleDesc}>
                    Akses lengkap: kasir, buku kas, setor bank, utang piutang, dan pengaturan
                  </ThemedText>
                </View>
                <ThemedText style={styles.chevron}>›</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pinContainer}>
              {/* Indikator PIN 6 Digit */}
              <View style={styles.dotsRow}>
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      pin.length > idx && styles.dotFilled,
                    ]}
                  />
                ))}
              </View>

              {errorMsg ? (
                <ThemedText style={styles.errorText}>⚠️ {errorMsg}</ThemedText>
              ) : (
                <ThemedText style={styles.hintText}>Masukkan 6 digit PIN Admin Anda</ThemedText>
              )}

              {/* Numpad */}
              <View style={styles.numpad}>
                {[
                  ['1', '2', '3'],
                  ['4', '5', '6'],
                  ['7', '8', '9'],
                  ['kembali', '0', 'backspace'],
                ].map((row, rIdx) => (
                  <View key={rIdx} style={styles.numpadRow}>
                    {row.map((val) => {
                      if (val === 'kembali') {
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[styles.numpadKey, styles.keySecondary]}
                            onPress={() => {
                              setPinMode(false);
                              setPin('');
                              setErrorMsg('');
                            }}
                          >
                            <ThemedText style={styles.backKeyText}>← Kembali</ThemedText>
                          </TouchableOpacity>
                        );
                      }
                      if (val === 'backspace') {
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[styles.numpadKey, styles.keySecondary]}
                            onPress={() => handleNumpad('backspace')}
                          >
                            <ThemedText style={styles.backspaceKeyText}>⌫</ThemedText>
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={val}
                          style={styles.numpadKey}
                          activeOpacity={0.7}
                          onPress={() => handleNumpad(val)}
                        >
                          <ThemedText style={styles.numpadText}>{val}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>
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
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderColor: '#e2e8f0',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 52,
    height: 52,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.tintDark,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  storeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  roleContainer: {
    gap: 12,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 14,
  },
  kasirCard: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  ownerCard: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  pemantauCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  roleIconBoxKasir: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconBoxOwner: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3e8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconBoxPemantau: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIcon: {
    fontSize: 24,
  },
  roleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  roleDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  badgeFree: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeFreeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badgePin: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePinText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  badgeHp: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeHpText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  chevron: {
    fontSize: 22,
    color: '#94a3b8',
    fontWeight: '300',
  },
  pinContainer: {
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginVertical: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  dotFilled: {
    backgroundColor: Colors.tintDark,
    borderColor: Colors.tintDark,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  hintText: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 8,
  },
  numpad: {
    width: '100%',
    maxWidth: 320,
    gap: 8,
    marginTop: 6,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  numpadKey: {
    flex: 1,
    height: 52,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  keySecondary: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  numpadText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
  },
  backKeyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  backspaceKeyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  refreshIcon: {
    fontSize: 13,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
});
