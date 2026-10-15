import * as ImagePicker from 'expo-image-picker';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

/**
 * Pemeriksaan izin kamera Android/Expo yang tangguh untuk perangkat tablet (Xiaomi MIUI/HyperOS, dll).
 * Mengatasi masalah izin yang sudah diaktifkan di Pengaturan Tablet tetapi ditolak oleh Expo ImagePicker.
 */
export async function requestCameraPermissionRobust(): Promise<boolean> {
  try {
    const expoPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (expoPerm.granted) return true;
  } catch (e) {
    console.warn('Expo camera permission error:', e);
  }

  // Fallback Android native PermissionsAndroid
  if (Platform.OS === 'android') {
    try {
      const hasAndroidPerm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (hasAndroidPerm) return true;

      const requestRes = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (requestRes === PermissionsAndroid.RESULTS.GRANTED) return true;
    } catch (e) {
      console.warn('Native Android camera permission error:', e);
    }
  }

  return false;
}

/**
 * Membuka galeri foto dengan opsi legacy: true untuk kompatibilitas penuh dengan tablet Android.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  try {
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    } catch {}

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // Ramah tablet: eliminasi crash crop intent Android
      quality: 0.75,
      legacy: true, // WAJIB untuk stabilitas tablet Xiaomi / Android
    });

    if (!result.canceled && result.assets && result.assets[0]?.uri) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error: any) {
    console.warn('pickImageFromGallery error:', error);
    Alert.alert(
      'Perhatian Galeri',
      `Gagal memuat galeri foto: ${error?.message || 'Terjadi gangguan sistem perangkat'}`
    );
    return null;
  }
}

/**
 * Mengambil foto langsung dari kamera perangkat dengan penanganan izin yang tangguh.
 */
export async function capturePhotoFromCamera(): Promise<string | null> {
  try {
    const hasPermission = await requestCameraPermissionRobust();
    if (!hasPermission) {
      Alert.alert(
        'Izin Kamera Perangkat',
        'Aplikasi membutuhkan izin kamera untuk mengambil foto secara langsung. Silakan aktifkan izin kamera di Pengaturan Aplikasi tablet Anda.',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Buka Pengaturan', onPress: () => Linking.openSettings().catch(() => {}) },
        ]
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, // Ramah tablet
      quality: 0.75,
    });

    if (!result.canceled && result.assets && result.assets[0]?.uri) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error: any) {
    console.warn('capturePhotoFromCamera error:', error);
    Alert.alert(
      'Perhatian Kamera',
      `Gagal membuka kamera: ${error?.message || 'Terjadi gangguan sistem perangkat'}`
    );
    return null;
  }
}
