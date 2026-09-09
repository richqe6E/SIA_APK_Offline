import { AdminPinModal } from '@/components/admin-pin-modal';
import { DevicePairingModal } from '@/components/device-pairing-modal';
import { ReceiptPreviewModal } from '@/components/receipt-preview-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { Colors } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import { useSettingsStore } from '@/stores/settingsStore';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const {
    storeName,
    businessType,
    storeAddress,
    storePhone,
    receiptFooter,
    loadSettings,
    appOrientation,
    setAppOrientation,
    currentUserRole,
    logoutRole,
    storePairingCode,
    isCloudConnected,
  } = useSettingsStore();

  const { width } = useWindowDimensions();
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

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);
  const [pairingModalVisible, setPairingModalVisible] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    loadSettings(db);
  }, [db, loadSettings]);

  const menuItems: {
    label: string;
    icon: string;
    desc: string;
    route: any;
    requiresPin: boolean;
  }[] = [
    {
      label: 'Sambungkan Perangkat (Cloud Sync)',
      icon: '🔗',
      desc: isCloudConnected
        ? `🟢 Terhubung (${storePairingCode}) • Ketuk untuk opsi sync`
        : 'Hubungkan tablet toko & smartphone pemilik usaha',
      route: null,
      requiresPin: false,
    },
    {
      label: 'Atur Toko',
      icon: '🏪',
      desc: 'Nama toko, alamat, telepon, nota, orientasi & PIN Admin',
      route: '/(tabs)/store-settings' as const,
      requiresPin: true,
    },
    {
      label: 'Hutang & Piutang',
      icon: '💳',
      desc: 'Kelola kasbon pelanggan, hutang supplier & pelunasan kas',
      route: '/debt-receivable' as const,
      requiresPin: false,
    },
    {
      label: 'Printer Bluetooth',
      icon: '🖨️',
      desc: 'Hubungkan printer thermal 58mm (ESC/POS)',
      route: '/(tabs)/printer' as const,
      requiresPin: false,
    },
    {
      label: 'Laporan Penjualan',
      icon: '📊',
      desc: 'Grafik transaksi, produk terlaris & jam sibuk',
      route: '/(tabs)/reports' as const,
      requiresPin: false,
    },
    {
      label: 'Manajemen Data & Backup',
      icon: '💾',
      desc: 'Ekspor transaksi ke CSV & kelola basis data',
      route: '/(tabs)/data-management' as const,
      requiresPin: true,
    },
  ];

  const handleMenuPress = (item: (typeof menuItems)[0]) => {
    if (!item.route) {
      setPairingModalVisible(true);
      return;
    }
    if (item.requiresPin) {
      setPendingRoute(item.route);
      setPinModalVisible(true);
    } else {
      router.push(item.route as any);
    }
  };

  const handlePinSuccess = () => {
    setPinModalVisible(false);
    if (pendingRoute) {
      router.push(pendingRoute as any);
      setPendingRoute(null);
    }
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
      ]}
    >
      {/* Header Top Row dengan Tombol Cepat Orientasi Layar */}
      <View style={styles.headerTopRow}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title" style={{ marginBottom: 2 }}>Pengaturan</ThemedText>
          <ThemedText style={{ fontSize: 11, color: Colors.muted }}>
            Konfigurasi sistem POS Mikro terpadu & hardware
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {isTabletOrLandscape ? (
          /* Mode Landscape: 2 Kolom Responsif */
          <View style={styles.landscapeGrid}>
            {/* Kolom Kiri: Profil Toko & Status Hardware / Preview */}
            <View style={styles.landscapeLeftCol}>
              <Card padding={16} style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <View style={styles.statusIconCircle}>
                    <ThemedText style={{ fontSize: 24 }}>🏪</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 16, color: '#1e1b4b' }}>
                      {storeName}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 12, color: Colors.muted, marginTop: 2 }}>
                      {businessType || 'Toko Retail'}
                    </ThemedText>
                  </View>
                </View>

                {storeAddress ? (
                  <View style={styles.storeDetailRow}>
                    <ThemedText style={styles.storeDetailLabel}>📍 Alamat:</ThemedText>
                    <ThemedText style={styles.storeDetailVal} numberOfLines={2}>
                      {storeAddress}
                    </ThemedText>
                  </View>
                ) : null}

                {storePhone ? (
                  <View style={styles.storeDetailRow}>
                    <ThemedText style={styles.storeDetailLabel}>📞 Telepon:</ThemedText>
                    <ThemedText style={styles.storeDetailVal}>
                      {storePhone}
                    </ThemedText>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.previewBtn}
                  onPress={() => setReceiptPreviewVisible(true)}
                >
                  <ThemedText style={styles.previewBtnText}>Preview Desain Struk (58mm)</ThemedText>
                </TouchableOpacity>
              </Card>

              {/* Quick Info Box */}
              <Card padding={14} style={styles.quickInfoCard}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 13, color: '#1e293b' }}>
                  ℹ️ Panduan Layar POS
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 16 }}>
                  Mode aktif:{' '}
                  <ThemedText style={{ fontWeight: '700', color: Colors.tintDark }}>
                    {appOrientation === 'landscape' ? 'Landscape (Kasir Tablet)' : 'Portrait (Handheld HP)'}
                  </ThemedText>
                  . Anda dapat berganti orientasi kapan saja melalui tombol di sudut kanan atas.
                </ThemedText>
              </Card>
            </View>

            {/* Kolom Kanan: Menu List */}
            <View style={styles.landscapeRightCol}>
              <View style={{ gap: 10 }}>
                {menuItems.map((item) => (
                  <Pressable key={item.label} onPress={() => handleMenuPress(item)}>
                    <Card padding={16} style={styles.menuItem}>
                      <View style={styles.menuIconCircle}>
                        <ThemedText style={{ fontSize: 22 }}>{item.icon}</ThemedText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: '#1e293b' }}>
                          {item.label}
                          {item.requiresPin && (
                            <ThemedText style={{ fontSize: 11, color: Colors.tint, fontWeight: '700' }}>
                              {' '}[Admin PIN]
                            </ThemedText>
                          )}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 11, color: Colors.placeholder, marginTop: 2 }}>
                          {item.desc}
                        </ThemedText>
                      </View>
                      <ThemedText style={{ fontSize: 20, color: Colors.muted }}>›</ThemedText>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : (
          /* Mode Portrait: 1 Kolom Vertikal Stack */
          <View>
            {/* Status Toko Card */}
            <Card padding={16} style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusIconCircle}>
                  <ThemedText style={{ fontSize: 24 }}>🏪</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 16, color: '#1e1b4b' }}>
                    {storeName}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, color: Colors.muted, marginTop: 2 }}>
                    {businessType || 'Toko Retail'}
                  </ThemedText>
                </View>
              </View>

              <TouchableOpacity
                style={styles.previewBtn}
                onPress={() => setReceiptPreviewVisible(true)}
              >
                <ThemedText style={styles.previewBtnText}>Preview Desain Struk (58mm)</ThemedText>
              </TouchableOpacity>
            </Card>

            {/* Menu List */}
            <View style={{ gap: 10, marginTop: 14 }}>
              {menuItems.map((item) => (
                <Pressable key={item.label} onPress={() => handleMenuPress(item)}>
                  <Card padding={16} style={styles.menuItem}>
                    <View style={styles.menuIconCircle}>
                      <ThemedText style={{ fontSize: 22 }}>{item.icon}</ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold" style={{ fontSize: 14, color: '#1e293b' }}>
                        {item.label}
                        {item.requiresPin && (
                          <ThemedText style={{ fontSize: 11, color: Colors.tint, fontWeight: '700' }}>
                            {' '}[Admin PIN]
                          </ThemedText>
                        )}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 11, color: Colors.placeholder, marginTop: 2 }}>
                        {item.desc}
                      </ThemedText>
                    </View>
                    <ThemedText style={{ fontSize: 20, color: Colors.muted }}>›</ThemedText>
                  </Card>
                </Pressable>
              ))}

              {/* Tombol Ganti Peran / Keluar Akun */}
              <TouchableOpacity
                style={{
                  marginTop: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  backgroundColor: '#fee2e2',
                  borderWidth: 1,
                  borderColor: '#fecaca',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert(
                    'Keluar Peran / Ganti Akun',
                    `Saat ini Anda masuk sebagai ${
                      currentUserRole === 'pemilik'
                        ? 'Pemilik Toko'
                        : 'Kasir'
                    }. Apakah ingin keluar dan memilih peran lain?`,
                    [
                      { text: 'Batal', style: 'cancel' },
                      {
                        text: 'Keluar Peran',
                        style: 'destructive',
                        onPress: () => logoutRole(),
                      },
                    ]
                  );
                }}
              >
                <ThemedText style={{ fontSize: 16 }}>🚪</ThemedText>
                <ThemedText style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>
                  Ganti Peran / Keluar Akun ({currentUserRole === 'pemilik' ? 'Pemilik Toko' : 'Kasir'})
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Admin PIN Verification Modal */}
      <AdminPinModal
        visible={pinModalVisible}
        onClose={() => {
          setPinModalVisible(false);
          setPendingRoute(null);
        }}
        onSuccess={handlePinSuccess}
      />

      {/* Thermal Receipt Preview Modal */}
      <ReceiptPreviewModal
        visible={receiptPreviewVisible}
        onClose={() => setReceiptPreviewVisible(false)}
        storeName={storeName}
        storeAddress={storeAddress}
        storePhone={storePhone}
        receiptFooter={receiptFooter}
      />

      {/* Device Cloud Pairing Modal */}
      <DevicePairingModal
        visible={pairingModalVisible}
        onClose={() => setPairingModalVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  orientationToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orientationToggleBtnActive: {
    backgroundColor: '#f5f3ff',
    borderColor: '#c4b5fd',
  },
  orientationToggleIcon: {
    fontSize: 14,
  },
  orientationToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  orientationToggleTextActive: {
    color: Colors.tintDark,
  },
  landscapeGrid: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  landscapeLeftCol: {
    flex: 1,
    gap: 12,
  },
  landscapeRightCol: {
    flex: 1.4,
  },
  quickInfoCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
  },
  storeDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  storeDetailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.muted,
  },
  storeDetailVal: {
    flex: 1,
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: Colors.tint + '33',
    borderRadius: 16,
  },
  previewBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.tint,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
