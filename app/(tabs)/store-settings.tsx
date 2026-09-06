import { ReceiptPreviewModal } from '@/components/receipt-preview-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useLockOrientation } from '@/hooks/use-orientation';
import { useSettingsStore, BusinessMode, ViewMode, AppOrientation } from '@/stores/settingsStore';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import {
  Alert,
  Image,
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
    storeAddress,
    storePhone,
    receiptFooter,
    qrisImagePath,
    appOrientation,
    loadSettings,
    saveSettings,
    setBusinessMode,
    setAdminPin,
    setDefaultViewMode,
    setAppOrientation,
  } = useSettingsStore();

  const [name, setName] = useState(storeName);
  const [type, setType] = useState(businessType);
  const [mode, setMode] = useState<BusinessMode>(businessMode);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [orientation, setOrientation] = useState<AppOrientation>(appOrientation);
  const [pin, setPin] = useState(adminPin);
  const [address, setAddress] = useState(storeAddress);
  const [phone, setPhone] = useState(storePhone);
  const [footer, setFooter] = useState(receiptFooter);
  const [qrisPath, setQrisPath] = useState(qrisImagePath);
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    loadSettings(db);
  }, [db, loadSettings]);

  useEffect(() => {
    setName(storeName);
    setType(businessType);
    setMode(businessMode);
    setViewMode(defaultViewMode);
    setOrientation(appOrientation);
    setPin(adminPin);
    setAddress(storeAddress);
    setPhone(storePhone);
    setFooter(receiptFooter);
    setQrisPath(qrisImagePath);
  }, [storeName, businessType, businessMode, defaultViewMode, appOrientation, adminPin, storeAddress, storePhone, receiptFooter, qrisImagePath]);

  const pickQrisImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      legacy: true,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop() ?? 'jpg';
      const dir = new Directory(Paths.document, 'qris');
      dir.create({ intermediates: true, idempotent: true });
      const file = new File(dir, `qris_${Date.now()}.${ext}`);
      const source = new File(uri);
      source.copy(file);
      setQrisPath(file.uri);
    }
  };

  const removeQrisImage = () => {
    Alert.alert('Hapus QRIS', 'Apakah Anda yakin ingin menghapus gambar QRIS toko?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => setQrisPath('') },
    ]);
  };

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
      await saveSettings(db, name.trim(), type.trim(), address.trim(), phone.trim(), footer.trim(), qrisPath.trim());
      await setDefaultViewMode(db, viewMode);
      await setAppOrientation(db, orientation);
      await setAdminPin(db, pin.trim());

      Alert.alert('Berhasil', 'Pengaturan toko dan preferensi orientasi berhasil disimpan!');
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
      <View style={styles.topHeader}>
        <Pressable
          style={styles.exitBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'))}
        >
          <ThemedText style={styles.exitBtnText}>← Keluar</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.headerTitle}>Atur Toko</ThemedText>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Card padding={16} style={{ gap: 18 }}>
          {/* Identitas Toko */}
          <View style={{ gap: 6 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Nama Toko / Usaha
            </ThemedText>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Contoh: Toko Berkah / Warung Rasa"
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Jenis Bidang Usaha
            </ThemedText>
            <TextInput
              style={styles.input}
              value={type}
              onChangeText={setType}
              placeholder="Contoh: Warung Kopi / Toko Kelontong"
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          {/* Desain & Informasi Nota / Struk Kasir */}
          <View style={styles.sectionDivider}>
            <ThemedText type="defaultSemiBold" style={styles.sectionHeader}>
              🧾 Desain & Informasi Nota Kasir
            </ThemedText>
            <ThemedText style={styles.helpText}>
              Informasi ini akan tercetak di struk printer thermal Bluetooth dan ditampilkan pada struk digital.
            </ThemedText>
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Alamat Toko di Struk
            </ThemedText>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Contoh: Jl. Cipto Mangunkusumo, Samarinda"
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              No. Telepon / WhatsApp Toko
            </ThemedText>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Contoh: 0812-3456-7890"
              placeholderTextColor={Colors.placeholder}
            />
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Catatan Kaki Struk (Footer Nota)
            </ThemedText>
            <TextInput
              style={styles.input}
              value={footer}
              onChangeText={setFooter}
              placeholder="Contoh: Terima kasih atas kunjungan Anda!"
              placeholderTextColor={Colors.placeholder}
            />
            <Button
              title="Preview Desain Struk (58mm)"
              variant="outline"
              size="sm"
              onPress={() => setShowPreviewModal(true)}
              style={{ marginTop: 4 }}
            />
          </View>

          {/* Foto QRIS Statis Toko (Poin 15) */}
          <View style={{ gap: 8 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Foto / Gambar QRIS Statis Toko
            </ThemedText>
            <ThemedText style={styles.helpText}>
              Gambar QRIS ini akan dimunculkan di layar kasir saat pelanggan memilih metode pembayaran QRIS.
            </ThemedText>

            {qrisPath ? (
              <View style={styles.qrisPreviewContainer}>
                <Image source={{ uri: qrisPath }} style={styles.qrisImageThumbnail} resizeMode="contain" />
                <View style={{ flex: 1, gap: 8 }}>
                  <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#15803d' }}>
                    ✓ QRIS Siap Digunakan
                  </ThemedText>
                  <Button
                    title="Ganti Gambar QRIS"
                    variant="outline"
                    size="sm"
                    onPress={pickQrisImage}
                  />
                  <Button
                    title="Hapus Gambar QRIS"
                    variant="danger"
                    size="sm"
                    onPress={removeQrisImage}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.qrisEmptyBox}>
                <ThemedText style={{ fontSize: 32, marginBottom: 4 }}>📱</ThemedText>
                <ThemedText style={{ fontSize: 12, color: Colors.muted, textAlign: 'center', marginBottom: 8 }}>
                  Belum ada gambar QRIS toko yang diunggah.
                </ThemedText>
                <Button
                  title="Unggah Foto QRIS dari Galeri"
                  variant="outline"
                  size="sm"
                  onPress={pickQrisImage}
                />
              </View>
            )}
          </View>

          {/* Pilihan Default Tampilan Kasir */}
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
                  📋 Compact List (Tombol Cepat)
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

          {/* Kunci Orientasi Layar Aplikasi (Poin 22) */}
          <View style={{ gap: 8 }}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Kunci Orientasi Layar Aplikasi
            </ThemedText>
            <ThemedText style={styles.helpText}>
              Pilih mode tampilan layar yang dikunci sesuai jenis perangkat yang digunakan.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.viewChoiceBtn, orientation === 'portrait' && styles.viewChoiceActive]}
                onPress={() => setOrientation('portrait')}
              >
                <ThemedText style={{ fontSize: 20, marginBottom: 2 }}>📱</ThemedText>
                <ThemedText style={[styles.viewChoiceText, orientation === 'portrait' && styles.viewChoiceTextActive]}>
                  Portrait (Tegak)
                </ThemedText>
                <ThemedText style={{ fontSize: 10, color: orientation === 'portrait' ? '#ffffff' : Colors.muted }}>
                  Cocok untuk Smartphone
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewChoiceBtn, orientation === 'landscape' && styles.viewChoiceActive]}
                onPress={() => setOrientation('landscape')}
              >
                <ThemedText style={{ fontSize: 20, marginBottom: 2 }}>💻</ThemedText>
                <ThemedText style={[styles.viewChoiceText, orientation === 'landscape' && styles.viewChoiceTextActive]}>
                  Landscape (Mendatar)
                </ThemedText>
                <ThemedText style={{ fontSize: 10, color: orientation === 'landscape' ? '#ffffff' : Colors.muted }}>
                  Cocok untuk Tablet / Kasir Meja
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

      <ReceiptPreviewModal
        visible={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        storeName={name.trim() || storeName}
        storeAddress={address.trim()}
        storePhone={phone.trim()}
        receiptFooter={footer.trim()}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exitBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  exitBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.tint,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
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
  sectionDivider: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 4,
  },
  sectionHeader: {
    fontSize: 14,
    color: Colors.tint,
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
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 200,
    alignSelf: 'center',
  },
  modeCard: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#ffffff',
  },
  modeCardActive: {
    borderColor: Colors.tint,
    backgroundColor: '#faf5ff',
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  modeTitle: {
    fontSize: 14,
    color: '#1e293b',
  },
  modeDesc: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },
  viewChoiceBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  viewChoiceActive: {
    borderColor: Colors.tint,
    backgroundColor: '#faf5ff',
  },
  viewChoiceText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  viewChoiceTextActive: {
    color: Colors.tint,
    fontWeight: '700',
  },
  qrisPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrisImageThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  qrisEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
});
