import * as FileSystem from 'expo-file-system/legacy';

/**
 * Menyimpan gambar dari URI sumber (baik file:// maupun content:// dari Android Photo Picker)
 * ke direktori dokumen lokal perangkat secara permanen.
 * 
 * Jika proses penyalinan mengalami kegagalan, fungsi mengembalikan sourceUri asli
 * agar alur operasional pengguna tidak macet atau menampilkan alert gagal.
 */
export async function saveImageLocally(
  sourceUri: string,
  folder: 'products' | 'qris' | 'logo' | 'debts'
): Promise<string> {
  if (!sourceUri) return '';

  try {
    const rawExt = sourceUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';

    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      return sourceUri;
    }

    // Jika gambar sudah berada di dalam direktori dokumen lokal aplikasi, tidak perlu disalin ulang
    if (sourceUri.startsWith(baseDir)) {
      return sourceUri;
    }

    const targetDir = `${baseDir}${folder}/`;
    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    const filename = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
    const destinationUri = `${targetDir}${filename}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.warn(`[saveImageLocally] Gagal menyalin gambar ke direktori lokal (${folder}):`, error);
    // Fallback aman: gunakan sourceUri langsung
    return sourceUri;
  }
}
