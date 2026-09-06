import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@/constants/theme';
import { useSettingsStore, BusinessMode } from '@/stores/settingsStore';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const db = useSQLiteContext();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);

  const [storeName, setStoreName] = useState('');
  const [selectedMode, setSelectedMode] = useState<BusinessMode>('retail');
  const [pin, setPin] = useState('123456');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    if (!storeName.trim()) {
      setErrorMsg('Nama toko atau usaha tidak boleh kosong!');
      return;
    }
    if (pin.trim().length !== 6) {
      setErrorMsg('PIN Admin harus terdiri dari 6 digit angka!');
      return;
    }

    try {
      await completeOnboarding(db, storeName.trim(), pin.trim(), 'retail');
      onComplete();
    } catch (e: any) {
      setErrorMsg(e.message || 'Gagal menyimpan pengaturan awal');
    }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>🏪</Text>
            </View>
            <Text style={styles.title}>Selamat Datang di POS Kasir</Text>
            <Text style={styles.subtitle}>
              Sistem Kasir & Pembukuan Usaha Mikro (POS Karya Riki Rivaldi)
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            {/* Nama Toko */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>1. Nama Toko / Usaha</Text>
              <TextInput
                value={storeName}
                onChangeText={(t) => {
                  setStoreName(t);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Contoh: Toko Berkah / Usaha Riki"
                placeholderTextColor={Colors.placeholder}
                style={styles.input}
              />
            </View>

            {/* PIN Admin */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>2. Atur 6 Digit PIN Admin</Text>
              <Text style={styles.sublabel}>
                Digunakan untuk mengamankan menu Pengaturan & Manajemen Data.
              </Text>
              <TextInput
                value={pin}
                onChangeText={(t) => {
                  setPin(t);
                  if (errorMsg) setErrorMsg('');
                }}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                placeholder="123456"
                placeholderTextColor={Colors.placeholder}
                style={[styles.input, styles.pinInput]}
              />
            </View>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>Mulai Aplikasi POS</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 34,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e1b4b',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 380,
  },
  formCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  sublabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  pinInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.tint,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modeCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  modeCardActive: {
    borderColor: Colors.tint,
    backgroundColor: '#faf5ff',
  },
  modeIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  modeTitleActive: {
    color: Colors.tint,
  },
  modeDesc: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 14,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '600',
  },
  submitBtn: {
    height: 50,
    backgroundColor: Colors.tint,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
