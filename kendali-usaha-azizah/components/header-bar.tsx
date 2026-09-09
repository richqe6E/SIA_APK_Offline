import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { RealtimeClockBadge } from '@/components/realtime-clock-badge';
import { Colors } from '@/constants/theme';
import { useMonitorStore } from '@/stores/monitorStore';

export function HeaderBar() {
  const insets = useSafeAreaInsets();
  const {
    storeName,
    pairingCode,
    lastSyncTime,
    loading,
    refreshing,
    syncError,
    isOfflineCache,
    fetchData,
  } = useMonitorStore();

  const handleRefresh = () => {
    fetchData(true);
  };

  const isConnected = !!lastSyncTime && !syncError;

  return (
    <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 6, 18) }]}>
      {/* Baris 1: Brand & Toko */}
      <View style={styles.topRow}>
        <View style={styles.titleColumn}>
          <View style={styles.badgeApp}>
            <ThemedText style={styles.badgeAppText}>MONITORING EKSEKUTIF</ThemedText>
          </View>
          <ThemedText style={styles.appTitle}>KENDALI USAHA AZIZAH</ThemedText>
          <ThemedText style={styles.storeName}>{storeName || 'AGEN SOSIS AZIZAH'}</ThemedText>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          disabled={refreshing || loading}
          activeOpacity={0.7}
        >
          {refreshing || loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <ThemedText style={styles.refreshIcon}>🔄</ThemedText>
          )}
        </TouchableOpacity>
      </View>

      {/* Baris 2: Jam Realtime */}
      <View style={styles.clockRow}>
        <RealtimeClockBadge compact={false} />
      </View>

      {/* Baris 3: Status Cloud Bar */}
      <View style={styles.statusBar}>
        <View
          style={[
            styles.statusDot,
            isConnected ? styles.dotConnected : isOfflineCache ? styles.dotWarning : styles.dotError,
          ]}
        />
        <ThemedText style={styles.statusText} numberOfLines={1}>
          {refreshing
            ? 'Menyinkronkan data toko...'
            : isConnected
            ? `Terhubung ke Kasir (${pairingCode}) • Update: ${lastSyncTime || 'Baru saja'}`
            : isOfflineCache
            ? `Cache Offline (${pairingCode}) • Update: ${lastSyncTime}`
            : `Menghubungkan ke ${pairingCode}...`}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleColumn: {
    flex: 1,
  },
  badgeApp: {
    alignSelf: 'flex-start',
    backgroundColor: '#ede9fe',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 3,
  },
  badgeAppText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.tint,
    letterSpacing: 0.5,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 1,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    elevation: 2,
  },
  refreshIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  clockRow: {
    marginTop: 2,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotConnected: {
    backgroundColor: '#16a34a',
  },
  dotWarning: {
    backgroundColor: '#f59e0b',
  },
  dotError: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
});
