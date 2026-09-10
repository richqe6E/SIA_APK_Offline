import React, { useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSQLiteContext } from 'expo-sqlite';

interface RoleLoginModalProps {
  visible: boolean;
}

export function RoleLoginModal({ visible }: RoleLoginModalProps) {
  const db = useSQLiteContext();
  const { storeName, loginAsKasir, loginAsPemilik, loadSettings } = useSettingsStore();
  const [pinMode, setPinMode] = useState(false);
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

  const handleOpenPin = () => {
    setErrorMsg('');
    setPin('');
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
      const ok = loginAsPemilik(nextPin);
      if (ok) {
        setPin('');
        setPinMode(false);
      } else {
        setErrorMsg('PIN otorisasi pemilik tidak sesuai.');
        setPin('');
      }
    }
  };

  const displayName = storeName && storeName !== 'POS Offline' ? storeName : 'AGEN SOSIS AZIZAH';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <ThemedView style={styles.overlay}>
        <View style={styles.terminalCard}>
          {/* Top Bar: Action & System Status */}
          <View style={styles.topBar}>
            <View style={styles.sysStatusBadge}>
              <View style={styles.sysStatusDot} />
              <ThemedText style={styles.sysStatusText}>TERMINAL POS AKTIF</ThemedText>
            </View>

            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefresh}
              activeOpacity={0.7}
              disabled={refreshing}
            >
              <ThemedText style={styles.refreshText}>
                {refreshing ? 'Memuat...' : '🔄 Segarkan'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Header Toko */}
          <View style={styles.header}>
            <View style={styles.bannerLogoBox}>
              <Image
                source={require('@/assets/images/app-logo-full.png')}
                style={styles.bannerLogo}
                resizeMode="contain"
              />
            </View>
            <ThemedText style={styles.storeName}>{displayName}</ThemedText>
            <ThemedText style={styles.subBrand}>Sistem Operasional Kasir & Penjualan</ThemedText>
          </View>

          {!pinMode ? (
            /* Mode 1: Pilihan Peran */
            <View style={styles.contentSection}>
              <ThemedText style={styles.sectionHeading}>PILIH PERAN MASUK</ThemedText>

              {/* Kartu 1: Kasir */}
              <TouchableOpacity
                style={styles.roleCard}
                activeOpacity={0.8}
                onPress={handleKasirLogin}
              >
                <View style={styles.roleIconSquare}>
                  <ThemedText style={styles.roleIconSymbol}>🧾</ThemedText>
                </View>

                <View style={styles.roleContent}>
                  <View style={styles.roleTitleRow}>
                    <ThemedText style={styles.roleTitle}>Kasir Penjualan</ThemedText>
                    <View style={styles.tagNeutral}>
                      <ThemedText style={styles.tagNeutralText}>Akses Langsung</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.roleDescription}>
                    Melayani transaksi nota, scan barcode barang, cetak struk, dan buka/tutup shift kasir.
                  </ThemedText>
                </View>

                <View style={styles.chevronBox}>
                  <ThemedText style={styles.chevronSymbol}>›</ThemedText>
                </View>
              </TouchableOpacity>

              {/* Kartu 2: Pemilik Toko */}
              <TouchableOpacity
                style={[styles.roleCard, styles.roleCardOwner]}
                activeOpacity={0.8}
                onPress={handleOpenPin}
              >
                <View style={[styles.roleIconSquare, styles.roleIconSquareOwner]}>
                  <ThemedText style={styles.roleIconSymbol}>🔐</ThemedText>
                </View>

                <View style={styles.roleContent}>
                  <View style={styles.roleTitleRow}>
                    <ThemedText style={styles.roleTitle}>Pemilik Toko</ThemedText>
                    <View style={styles.tagPrimary}>
                      <ThemedText style={styles.tagPrimaryText}>Otorisasi PIN</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.roleDescription}>
                    Akses penuh laporan keuangan (Laba/Rugi), buku kas, utang-piutang, manajemen produk & stok.
                  </ThemedText>
                </View>

                <View style={styles.chevronBox}>
                  <ThemedText style={styles.chevronSymbol}>›</ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            /* Mode 2: Layar Input PIN Pemilik */
            <View style={styles.pinSection}>
              <View style={styles.pinHeader}>
                <ThemedText style={styles.pinTitle}>Otorisasi Pemilik Toko</ThemedText>
                <ThemedText style={styles.pinSubtitle}>
                  Ketik 6 digit PIN Admin untuk membuka hak akses penuh
                </ThemedText>
              </View>

              {/* PIN Indicator Dots */}
              <View style={styles.dotsRow}>
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.dot,
                        isFilled && styles.dotActive,
                      ]}
                    />
                  );
                })}
              </View>

              {errorMsg ? (
                <View style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>⚠️ {errorMsg}</ThemedText>
                </View>
              ) : (
                <View style={styles.errorPlaceholder} />
              )}

              {/* Numpad Keypad */}
              <View style={styles.numpadGrid}>
                {[
                  ['1', '2', '3'],
                  ['4', '5', '6'],
                  ['7', '8', '9'],
                  ['batal', '0', 'backspace'],
                ].map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.numpadRow}>
                    {row.map((val) => {
                      if (val === 'batal') {
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[styles.numKey, styles.numKeyUtility]}
                            activeOpacity={0.7}
                            onPress={() => {
                              setPinMode(false);
                              setPin('');
                              setErrorMsg('');
                            }}
                          >
                            <ThemedText style={styles.numKeyUtilityText}>Batal</ThemedText>
                          </TouchableOpacity>
                        );
                      }

                      if (val === 'backspace') {
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[styles.numKey, styles.numKeyUtility]}
                            activeOpacity={0.7}
                            onPress={() => handleNumpad('backspace')}
                          >
                            <ThemedText style={styles.numKeyBackspace}>⌫</ThemedText>
                          </TouchableOpacity>
                        );
                      }

                      return (
                        <TouchableOpacity
                          key={val}
                          style={styles.numKey}
                          activeOpacity={0.65}
                          onPress={() => handleNumpad(val)}
                        >
                          <ThemedText style={styles.numKeyDigit}>{val}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Footer Card */}
          <View style={styles.cardFooter}>
            <ThemedText style={styles.footerNote}>
              POS Karya Riki Rivaldi • Hak Cipta Terlindungi • Offline-First Database
            </ThemedText>
          </View>
        </View>
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
    padding: 16,
  },
  terminalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sysStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sysStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  sysStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  refreshText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  header: {
    alignItems: 'center',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 18,
  },
  bannerLogoBox: {
    width: 170,
    height: 68,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerLogo: {
    width: '100%',
    height: '100%',
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 36,
    height: 36,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  subBrand: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  contentSection: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  roleCardOwner: {
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  roleIconSquare: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconSquareOwner: {
    backgroundColor: '#f5f3ff',
  },
  roleIconSymbol: {
    fontSize: 20,
  },
  roleContent: {
    flex: 1,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  roleDescription: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 15,
  },
  tagNeutral: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tagNeutralText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  tagPrimary: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  tagPrimaryText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6d28d9',
  },
  chevronBox: {
    paddingLeft: 4,
  },
  chevronSymbol: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '300',
  },
  pinSection: {
    alignItems: 'center',
  },
  pinHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  pinTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  pinSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  dotActive: {
    backgroundColor: '#5b21b6',
    borderColor: '#5b21b6',
  },
  errorContainer: {
    height: 22,
    justifyContent: 'center',
    marginBottom: 6,
  },
  errorPlaceholder: {
    height: 22,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  numpadGrid: {
    width: '100%',
    maxWidth: 300,
    gap: 8,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  numKey: {
    flex: 1,
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numKeyDigit: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  numKeyUtility: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  numKeyUtilityText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  numKeyBackspace: {
    fontSize: 17,
    fontWeight: '800',
    color: '#475569',
  },
  cardFooter: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 9.5,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
