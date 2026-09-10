import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

export function FloatingNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const isDashboard = pathname === '/' || pathname === '/index' || pathname.endsWith('(tabs)');
  const isReports = pathname.includes('reports');
  const isSettings = pathname.includes('settings');

  const handleNavigate = (route: string) => {
    setIsOpen(false);
    router.replace(route as any);
  };

  return (
    <>
      {/* Backdrop penutup saat menu bola terbuka */}
      {isOpen && (
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Kontainer Bola Navigasi di Samping Kanan */}
      <View
        style={[
          styles.container,
          { bottom: Math.max(insets.bottom + 18, 24) },
        ]}
        pointerEvents="box-none"
      >
        {/* Pilihan Bola Menu (Muncul Saat Dibuka) */}
        {isOpen && (
          <View style={styles.bubbleList}>
            {/* Bola 1: Dasbor */}
            <TouchableOpacity
              style={[
                styles.bubbleBtn,
                isDashboard && styles.bubbleBtnActiveDashboard,
              ]}
              onPress={() => handleNavigate('/')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isDashboard ? 'speedometer' : 'speedometer-outline'}
                size={22}
                color={isDashboard ? '#ffffff' : '#2563eb'}
              />
            </TouchableOpacity>

            {/* Bola 2: Laporan */}
            <TouchableOpacity
              style={[
                styles.bubbleBtn,
                isReports && styles.bubbleBtnActiveReports,
              ]}
              onPress={() => handleNavigate('/reports')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isReports ? 'bar-chart' : 'bar-chart-outline'}
                size={22}
                color={isReports ? '#ffffff' : '#059669'}
              />
            </TouchableOpacity>

            {/* Bola 3: Pengaturan */}
            <TouchableOpacity
              style={[
                styles.bubbleBtn,
                isSettings && styles.bubbleBtnActiveSettings,
              ]}
              onPress={() => handleNavigate('/settings')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isSettings ? 'settings' : 'settings-outline'}
                size={22}
                color={isSettings ? '#ffffff' : '#475569'}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Bola Pemicu Utama (Khas & Kompak) */}
        <TouchableOpacity
          style={[styles.triggerBtn, isOpen && styles.triggerBtnOpen]}
          onPress={() => setIsOpen(!isOpen)}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isOpen ? 'close' : 'apps'}
            size={22}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    zIndex: 998,
  },
  container: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  bubbleList: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  bubbleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  bubbleBtnActiveDashboard: {
    backgroundColor: '#2563eb',
    borderColor: '#1d4ed8',
  },
  bubbleBtnActiveReports: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  bubbleBtnActiveSettings: {
    backgroundColor: '#334155',
    borderColor: '#1e293b',
  },
  triggerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 7,
  },
  triggerBtnOpen: {
    backgroundColor: '#334155',
  },
});
