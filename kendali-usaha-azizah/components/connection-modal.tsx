import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useMonitorStore } from '@/stores/monitorStore';

interface ConnectionModalProps {
  visible: boolean;
  onClose?: () => void;
  canClose?: boolean;
}

export function ConnectionModal({
  visible,
  onClose,
  canClose = true,
}: ConnectionModalProps) {
  const { pairingCode, setPairingCode, loading, syncError } = useMonitorStore();
  const [inputCode, setInputCode] = useState(pairingCode || '');
  const [localError, setLocalError] = useState('');

  const handleConnect = async () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      setLocalError('Masukkan kode sambung toko.');
      return;
    }
    setLocalError('');
    const success = await setPairingCode(code);
    if (success && onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={canClose ? onClose : undefined}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.iconBox}>
            <ThemedText style={styles.icon}>📡</ThemedText>
          </View>

          <ThemedText style={styles.modalTitle}>Sambungkan Toko</ThemedText>
          <ThemedText style={styles.modalSubtitle}>
            Masukkan Kode Sambung yang tertera di Tablet Kasir Toko untuk memantau data secara real-time.
          </ThemedText>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>KODE SAMBUNG TOKO (PAIRING CODE)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Contoh: AZ-7789"
              placeholderTextColor="#94a3b8"
              value={inputCode}
              onChangeText={(text) => {
                setInputCode(text.toUpperCase());
                setLocalError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
            />
          </View>

          {(localError || syncError) ? (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorText}>
                ⚠️ {localError || syncError}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.buttonRow}>
            {canClose && onClose ? (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.cancelBtnText}>Batal</ThemedText>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.connectBtn, (!canClose || !onClose) && { flex: 1 }]}
              onPress={handleConnect}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <ThemedText style={styles.connectBtnText}>Hubungkan Toko</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 26,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: Colors.tint,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: 2,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  connectBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  connectBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});
