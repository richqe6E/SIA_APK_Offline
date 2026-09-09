import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const STORAGE_FILENAME = 'kendali_azizah_prefs.json';

let memoryCache: Record<string, string> | null = null;

async function loadMemoryCache(): Promise<Record<string, string>> {
  if (memoryCache !== null) return memoryCache;

  if (Platform.OS === 'web') {
    memoryCache = {};
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith('azizah_')) {
            memoryCache[key] = window.localStorage.getItem(key) || '';
          }
        }
      }
    } catch {}
    return memoryCache;
  }

  try {
    const file = new File(Paths.document, STORAGE_FILENAME);
    if (file.exists) {
      const content = await file.text();
      memoryCache = JSON.parse(content || '{}');
    } else {
      memoryCache = {};
    }
  } catch {
    memoryCache = {};
  }
  return memoryCache!;
}

async function persistMemoryCache(): Promise<void> {
  if (!memoryCache) return;

  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (const [k, v] of Object.entries(memoryCache)) {
          window.localStorage.setItem(k, v);
        }
      }
    } catch {}
    return;
  }

  try {
    const file = new File(Paths.document, STORAGE_FILENAME);
    file.write(JSON.stringify(memoryCache));
  } catch (err) {
    console.warn('Failed to persist storage:', err);
  }
}

export const Storage = {
  async getItem(key: string): Promise<string | null> {
    const cache = await loadMemoryCache();
    return cache[key] ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const cache = await loadMemoryCache();
    cache[key] = value;
    await persistMemoryCache();
  },

  async removeItem(key: string): Promise<void> {
    const cache = await loadMemoryCache();
    delete cache[key];
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {}
    }
    await persistMemoryCache();
  },
};
