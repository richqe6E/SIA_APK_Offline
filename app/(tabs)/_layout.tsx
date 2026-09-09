import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settingsStore';
import { RoleLoginModal } from '@/components/role-login-modal';
import { useSQLiteContext } from 'expo-sqlite';

export default function TabLayout() {
  const db = useSQLiteContext();
  const { currentUserRole, isOnboarded, loadSettings } = useSettingsStore();

  useEffect(() => {
    loadSettings(db);
  }, [db, loadSettings]);

  const isKasir = currentUserRole === 'kasir';
  const isPemantau = currentUserRole === 'pemantau';

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: { height: 60, paddingBottom: 8 },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: isPemantau ? 'Pantau Toko' : 'Dashboard',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Produk',
            href: isPemantau ? null : undefined,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="shippingbox.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Riwayat',
            href: isPemantau ? null : undefined,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="clock.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="financial-reports"
          options={{
            title: 'Keuangan',
            href: isKasir ? null : undefined,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="chart.bar.doc.horizontal.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Pengaturan',
            href: isKasir ? null : undefined,
            tabBarIcon: ({ color }) => (
              <IconSymbol size={28} name="gearshape.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen name="reports" options={{ href: null }} />
        <Tabs.Screen name="printer" options={{ href: null }} />
        <Tabs.Screen name="store-settings" options={{ href: null }} />
        <Tabs.Screen name="data-management" options={{ href: null }} />
      </Tabs>

      {/* Gerbang Login Peran Kasir vs Pemilik */}
      <RoleLoginModal visible={currentUserRole === null && isOnboarded} />
    </>
  );
}
