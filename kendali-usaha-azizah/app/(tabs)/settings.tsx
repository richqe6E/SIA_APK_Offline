import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { HeaderBar } from '@/components/header-bar';
import { ConnectionModal } from '@/components/connection-modal';
import { Colors } from '@/constants/theme';
import { useMonitorStore } from '@/stores/monitorStore';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    storeName,
    pairingCode,
    lastSyncTime,
    autoRefreshInterval,
    setAutoRefreshInterval,
    fetchData,
    resetConnection,
  } = useMonitorStore();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const handleManualSync = async () => {
    setSyncStatusMsg('Sedang menyinkronkan...');
    const ok = await fetchData(true);
    if (ok) {
      setSyncStatusMsg('Data berhasil diperbarui!');
    } else {
      setSyncStatusMsg('Sinkronisasi gagal. Periksa koneksi.');
    }
    setTimeout(() => setSyncStatusMsg(''), 3000);
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Putuskan Sambungan',
      `Apakah Anda yakin ingin memutuskan sambungan dari toko "${storeName || pairingCode}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Putuskan',
          style: 'destructive',
          onPress: async () => {
            await resetConnection();
            setShowConnectModal(true);
          },
        },
      ]
    );
  };

  const intervals = [
    { label: '30 Detik', value: 30 },
    { label: '1 Menit', value: 60 },
    { label: '5 Menit', value: 300 },
    { label: 'Manual', value: 0 },
  ];

  return (
    <ThemedView style={styles.container}>
      <HeaderBar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. KONEKSI TOKO */}
        <Card style={styles.card} padding={18}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <ThemedText style={styles.icon}>🏪</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.cardSectionLabel}>SAMBUNGAN TOKO SAAT INI</ThemedText>
              <ThemedText style={styles.storeNameTitle}>
                {storeName || 'AGEN SOSIS AZIZAH'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Kode Sambung Aktif</ThemedText>
            <View style={styles.codeBadge}>
              <ThemedText style={styles.codeText}>{pairingCode}</ThemedText>
            </View>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={styles.infoLabel}>Pembaruan Terakhir</ThemedText>
            <ThemedText style={styles.infoVal}>{lastSyncTime || 'Belum ada'}</ThemedText>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => setShowConnectModal(true)}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.btnSecondaryText}>Ganti / Hubungkan Toko</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnDanger}
              onPress={handleDisconnect}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.btnDangerText}>Putus</ThemedText>
            </TouchableOpacity>
          </View>
        </Card>

        {/* 2. SINKRONISASI DATA */}
        <Card style={styles.card} padding={18}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBoxSync}>
              <ThemedText style={styles.icon}>🔄</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.cardSectionLabel}>SINKRONISASI OTOMATIS</ThemedText>
              <ThemedText style={styles.cardSectionSub}>
                Pembaruan data dari kasir ke HP pemilik
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.intervalTitle}>Interval Auto-Refresh:</ThemedText>
          <View style={styles.intervalsGrid}>
            {intervals.map((item) => {
              const active = autoRefreshInterval === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.intervalBtn, active && styles.intervalBtnActive]}
                  onPress={() => setAutoRefreshInterval(item.value)}
                  activeOpacity={0.8}
                >
                  <ThemedText
                    style={[styles.intervalBtnText, active && styles.intervalBtnTextActive]}
                  >
                    {item.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.btnSyncNow}
            onPress={handleManualSync}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.btnSyncNowText}>🔄 Sinkronkan Data Sekarang</ThemedText>
          </TouchableOpacity>

          {syncStatusMsg ? (
            <ThemedText style={styles.syncStatusMsg}>{syncStatusMsg}</ThemedText>
          ) : null}
        </Card>

        {/* 3. TENTANG APLIKASI */}
        <Card style={styles.card} padding={18}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBoxInfo}>
              <ThemedText style={styles.icon}>ℹ️</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.cardSectionLabel}>INFORMASI APLIKASI</ThemedText>
              <ThemedText style={styles.appNameBold}>KENDALI USAHA AZIZAH</ThemedText>
            </View>
          </View>

          <View style={styles.aboutTable}>
            <View style={styles.aboutRow}>
              <ThemedText style={styles.aboutLabel}>Versi Sistem</ThemedText>
              <ThemedText style={styles.aboutVal}>v1.0.0 (Edisi Pemantau)</ThemedText>
            </View>
            <View style={styles.aboutRow}>
              <ThemedText style={styles.aboutLabel}>Orientasi Layar</ThemedText>
              <ThemedText style={styles.aboutVal}>Portrait (Khusus HP)</ThemedText>
            </View>
            <View style={styles.aboutRow}>
              <ThemedText style={styles.aboutLabel}>Tipe Akses</ThemedText>
              <ThemedText style={styles.aboutVal}>Read-Only Eksekutif</ThemedText>
            </View>
            <View style={styles.aboutRow}>
              <ThemedText style={styles.aboutLabel}>Dukungan Cloud</ThemedText>
              <ThemedText style={styles.aboutVal}>Supabase REST Bridge</ThemedText>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Modal Hubungkan Toko */}
      <ConnectionModal
        visible={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSync: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxInfo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  cardSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
  },
  cardSectionSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  storeNameTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#475569',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  codeBadge: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  codeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.tint,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  btnDanger: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  btnDangerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
  },

  // Auto-refresh
  intervalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  intervalsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  intervalBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  intervalBtnActive: {
    backgroundColor: Colors.tint,
    borderColor: Colors.tint,
  },
  intervalBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  intervalBtnTextActive: {
    color: '#ffffff',
  },
  btnSyncNow: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSyncNowText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#16a34a',
  },
  syncStatusMsg: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
    textAlign: 'center',
    marginTop: 8,
  },

  // About Table
  appNameBold: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.tint,
    marginTop: 1,
  },
  aboutTable: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  aboutVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
});
