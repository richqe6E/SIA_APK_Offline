import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settingsStore';

interface AdminPinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function AdminPinModal({
  visible,
  onClose,
  onSuccess,
  title = 'Akses Khusus Admin',
  description = 'Masukkan 6 digit PIN Admin untuk melanjutkan',
}: AdminPinModalProps) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const verifyPin = useSettingsStore((s) => s.verifyPin);

  const handleVerify = () => {
    if (!pin.trim()) {
      setErrorMsg('Harap masukkan PIN Admin');
      return;
    }
    if (verifyPin(pin)) {
      setPin('');
      setErrorMsg('');
      onSuccess();
    } else {
      setErrorMsg('PIN salah! Default: 123456');
    }
  };

  const handleClose = () => {
    setPin('');
    setErrorMsg('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>🔐</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              value={pin}
              onChangeText={(txt) => {
                setPin(txt);
                if (errorMsg) setErrorMsg('');
              }}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              autoFocus
              placeholder="••••••"
              placeholderTextColor={Colors.placeholder}
              style={styles.pinInput}
            />
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleVerify}>
              <Text style={styles.submitText}>Verifikasi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 26,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e1b4b',
    textAlign: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  pinInput: {
    width: '80%',
    height: 50,
    borderWidth: 2,
    borderColor: Colors.tint,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    color: Colors.tintDark,
    backgroundColor: '#faf5ff',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
