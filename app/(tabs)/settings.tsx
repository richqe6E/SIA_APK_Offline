import { AdminPinModal } from '@/components/admin-pin-modal';
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
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const { storeName, businessType, storeAddress, storePhone, receiptFooter, loadSettings } = useSettingsStore();

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [receiptPreviewVisible, setReceiptPreviewVisible] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    loadSettings(db);
  }, [db, loadSettings]);

  const menuItems = [
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
      <ThemedText type="title" style={{ marginBottom: 4 }}>Pengaturan</ThemedText>
      <ThemedText style={{ fontSize: 12, color: Colors.muted, marginBottom: 16 }}>
        Konfigurasi sistem POS Mikro terpadu & hardware
      </ThemedText>

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
      </View>

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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
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
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modeBadgeRetail: {
    backgroundColor: '#e0e7ff',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modeBadgeTextRetail: {
    color: '#3730a3',
    fontSize: 10,
    fontWeight: '700',
  },
  modeBadgeKuliner: {
    backgroundColor: '#fef3c7',
  },
  modeBadgeTextKuliner: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '700',
  },
  switchModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.tint,
    borderRadius: 8,
  },
  switchModeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
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
