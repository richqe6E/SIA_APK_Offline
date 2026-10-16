import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

/**
 * Fallback tangguh menggunakan pemilih berkas sistem (DocumentPicker).
 * Menjamin pemilihan gambar selalu berhasil meskipun ActivityResultLauncher Android
 * pada tablet Xiaomi / Android 13+ mengalami masalah registrasi siklus hidup.
 */
async function fallbackPickImageWithDocumentPicker(): Promise<string | null> {
  try {
    const docResult = await DocumentPicker.getDocumentAsync({
      type: ['image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (!docResult.canceled && docResult.assets && docResult.assets.length > 0) {
      return docResult.assets[0].uri;
    }
    return null;
  } catch (docError: any) {
    console.warn('Fallback DocumentPicker gagal:', docError);
    Alert.alert(
      'Perhatian Galeri',
      'Gagal membuka pemilih berkas gambar perangkat. Silakan coba kembali.'
    );
    return null;
  }
}

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
 * Membuka galeri foto dengan fallback otomatis ke DocumentPicker jika ActivityResultLauncher gagal.
 * Menghapus legacy: true yang rentan crash pada SDK 54 dan tablet Android modern.
 */
export async function pickImageFromGallery(): Promise<string | null> {
  try {
    // Periksa izin terlebih dahulu tanpa memicu dialog ulang jika sudah diberikan
    const currentPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!currentPerm.granted) {
      const reqPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!reqPerm.granted) {
        // Jika izin media ditolak di Android, gunakan DocumentPicker sistem yang tidak butuh izin media khusus
        return await fallbackPickImageWithDocumentPicker();
      }
      // Beri jeda singkat agar MainActivity selesai resume setelah dialog izin tertutup
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // Ramah tablet: eliminasi crash crop intent Android
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error: any) {
    console.warn('ImagePicker gagal, mengalihkan ke DocumentPicker:', error?.message);
    // Jika muncul IllegalStateException (unregistered ActivityResultLauncher),
    // otomatis buka pemilih berkas gambar sistem tanpa menampilkan error teknis ke pengguna!
    return await fallbackPickImageWithDocumentPicker();
  }
}

/**
 * Mengambil foto langsung dari kamera perangkat dengan penanganan izin yang tangguh
 * dan fallback aman ke DocumentPicker jika kamera perangkat tidak tersedia.
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

    await new Promise((resolve) => setTimeout(resolve, 200));

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // Ramah tablet
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error: any) {
    console.warn('capturePhotoFromCamera error:', error);
    Alert.alert(
      'Kamera Tidak Tersedia',
      'Kamera tidak dapat dibuka saat ini. Silakan pilih foto dari berkas galeri perangkat.'
    );
    return await fallbackPickImageWithDocumentPicker();
  }
}
