import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import { useSettingsStore, BusinessMode, ViewMode } from '@/stores/settingsStore';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StoreSettingsScreen() {
  useLockOrientation(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const {
    storeName,
    businessType,
    businessMode,
    adminPin,
    defaultViewMode,
    loadSettings,
    saveSettings,
    setBusinessMode,
    setAdminPin,
    setDefaultViewMode,
  } = useSettingsStore();

  const [name, setName] = useState(storeName);
  const [type, setType] = useState(businessType);
  const [mode, setMode] = useState<BusinessMode>(businessMode);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [pin, setPin] = useState(adminPin);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings(db);
  }, [db, loadSettings]);

  useEffect(() => {
    setName(storeName);
    setType(businessType);
    setMode(businessMode);
    setViewMode(defaultViewMode);
    setPin(adminPin);
  }, [storeName, businessType, businessMode, defaultViewMode, adminPin]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Nama toko tidak boleh kosong');
      return;
    }
    if (pin.trim().length !== 6) {
      Alert.alert('Error', 'PIN Admin harus 6 digit angka');
      return;
    }

    setSaving(true);
    try {
      await saveSettings(db, name.trim(), type.trim());
      await setBusinessMode(db, mode);
      await setDefaultViewMode(db, viewMode);
      await setAdminPin(db, pin.trim());

      Alert.alert('Berhasil', 'Pengaturan toko dan mode UMKM berhasil disimpan!');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
      ]}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <IconSymbol name="chevron.left" size={18} color={Colors.tint} />
          <ThemedText style={{ color: Colors.tint, fontWeight: '600' }}>Kembali</ThemedText>
        </View>
      </Pressable>

      <ThemedText type="title" style={{ marginBottom: 16 }}>Atur Toko & Mode UMKM</ThemedText>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Card padding={16} style={{ gap: 18 }}>
          {/* Identitas Toko */}
          <View style={{ gap: 6 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Nama Toko / Usaha
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Toko Berkah / Warung Makan Sedap"
              placeholderTextColor={Colors.muted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Deskripsi / Kategori Usaha
            </ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Contoh: Toko Kelontong, Cafe, Warung Makan"
              placeholderTextColor={Colors.muted}
              value={type}
              onChangeText={setType}
            />
          </View>

          {/* Switch Mode UMKM */}
          <View style={{ gap: 8 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Tipe Mode UMKM
            </ThemedText>
            <ThemedText style={styles.helpText}>
              Pilih alur kerja sistem yang sesuai dengan karakteristik usaha Anda.
            </ThemedText>

            <View style={styles.modeGrid}>
              <TouchableOpacity
                style={[styles.modeCard, mode === 'retail' && styles.modeCardActive]}
                onPress={() => {
                  setMode('retail');
                  setViewMode('list');
                }}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.modeIcon}>🛒</ThemedText>
                <ThemedText
                  type="defaultSemiBold"
                  style={[styles.modeTitle, mode === 'retail' && styles.modeTitleActive]}
                >
                  Toko / Retail
                </ThemedText>
                <ThemedText style={styles.modeDesc}>
                  Kontrol stok ketat, modul pembelian kulakan & stock opname aktif.
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeCard, mode === 'kuliner' && styles.modeCardActive]}
                onPress={() => {
                  setMode('kuliner');
                  setViewMode('grid');
                }}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.modeIcon}>☕</ThemedText>
                <ThemedText
                  type="defaultSemiBold"
                  style={[styles.modeTitle, mode === 'kuliner' && styles.modeTitleActive]}
                >
                  Kuliner / Jasa
                </ThemedText>
                <ThemedText style={styles.modeDesc}>
                  Bebas stok siap jual. Pembelian & opname disembunyikan agar simpel.
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Default Tampilan Kasir */}
          <View style={{ gap: 8 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Tampilan Awal Kasir
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.viewChoiceBtn, viewMode === 'list' && styles.viewChoiceActive]}
                onPress={() => setViewMode('list')}
              >
                <ThemedText style={[styles.viewChoiceText, viewMode === 'list' && styles.viewChoiceTextActive]}>
                  📋 Compact List (Tombol Ramping)
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewChoiceBtn, viewMode === 'grid' && styles.viewChoiceActive]}
                onPress={() => setViewMode('grid')}
              >
                <ThemedText style={[styles.viewChoiceText, viewMode === 'grid' && styles.viewChoiceTextActive]}>
                  🖼️ Grid Card (Kotak Gambar)
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* PIN Admin */}
          <View style={{ gap: 6 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              6 Digit PIN Admin
            </ThemedText>
            <ThemedText style={styles.helpText}>
              PIN ini melindungi menu Pengaturan & pergantian mode usaha dari akses kasir.
            </ThemedText>
            <TextInput
              style={[styles.input, styles.pinInput]}
              value={pin}
              onChangeText={setPin}
              maxLength={6}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="123456"
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          <Button
            title={saving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
            onPress={handleSave}
            disabled={saving}
          />
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  backRow: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 13,
    color: '#334155',
  },
  helpText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: -2,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  pinInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.tint,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  modeCardActive: {
    borderColor: Colors.tint,
    backgroundColor: '#faf5ff',
  },
  modeIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  modeTitle: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 2,
  },
  modeTitleActive: {
    color: Colors.tint,
  },
  modeDesc: {
    fontSize: 9.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 13,
  },
  viewChoiceBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  viewChoiceActive: {
    borderColor: Colors.tint,
    backgroundColor: '#f3e8ff',
  },
  viewChoiceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  viewChoiceTextActive: {
    color: Colors.tintDark,
    fontWeight: '700',
  },
});
