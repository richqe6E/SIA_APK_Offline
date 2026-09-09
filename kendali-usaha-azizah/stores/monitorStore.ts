import { create } from 'zustand';
import { Storage } from '@/services/storage';
import { fetchStoreSnapshot, type StoreSyncPayload } from '@/services/cloudSync';

const STORAGE_KEYS = {
  PAIRING_CODE: 'azizah_monitor_pairing_code',
  STORE_NAME: 'azizah_monitor_store_name',
  AUTO_INTERVAL: 'azizah_monitor_auto_interval',
};

interface MonitorState {
  pairingCode: string;
  storeName: string;
  isConfigured: boolean;
  syncData: StoreSyncPayload | null;
  loading: boolean;
  refreshing: boolean;
  lastSyncTime: string;
  syncError: string;
  isOfflineCache: boolean;
  autoRefreshInterval: number; // in seconds, 0 = manual

  loadSavedConfig: () => Promise<void>;
  setPairingCode: (code: string) => Promise<boolean>;
  fetchData: (isPullRefresh?: boolean) => Promise<boolean>;
  setAutoRefreshInterval: (seconds: number) => Promise<void>;
  resetConnection: () => Promise<void>;
}

export const useMonitorStore = create<MonitorState>((set, get) => ({
  pairingCode: 'AZ-7789',
  storeName: 'AGEN SOSIS AZIZAH',
  isConfigured: false,
  syncData: null,
  loading: true,
  refreshing: false,
  lastSyncTime: '',
  syncError: '',
  isOfflineCache: false,
  autoRefreshInterval: 30,

  loadSavedConfig: async () => {
    set({ loading: true });
    try {
      const [savedCode, savedInterval] = await Promise.all([
        Storage.getItem(STORAGE_KEYS.PAIRING_CODE),
        Storage.getItem(STORAGE_KEYS.AUTO_INTERVAL),
      ]);

      const code = savedCode ? savedCode.trim().toUpperCase() : 'AZ-7789';
      const interval = savedInterval ? parseInt(savedInterval, 10) : 30;

      set({
        pairingCode: code,
        storeName: 'AGEN SOSIS AZIZAH',
        isConfigured: !!savedCode,
        autoRefreshInterval: interval,
      });

      // Initial data fetch
      await get().fetchData(false);
    } catch (e: any) {
      console.warn('loadSavedConfig error:', e);
      set({ loading: false });
    }
  },

  setPairingCode: async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return false;

    set({ loading: true, syncError: '' });
    const res = await fetchStoreSnapshot(cleanCode);

    if (res.success && res.payload) {
      await Storage.setItem(STORAGE_KEYS.PAIRING_CODE, cleanCode);
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      set({
        pairingCode: cleanCode,
        storeName: res.payload.storeName || 'AGEN SOSIS AZIZAH',
        isConfigured: true,
        syncData: res.payload,
        lastSyncTime: timeStr,
        syncError: res.error || '',
        isOfflineCache: !!res.isCached,
        loading: false,
      });
      return true;
    } else {
      set({
        loading: false,
        syncError: res.error || 'Gagal menghubungkan ke toko.',
      });
      return false;
    }
  },

  fetchData: async (isPullRefresh = false) => {
    const { pairingCode } = get();
    if (!pairingCode) {
      set({ loading: false, refreshing: false });
      return false;
    }

    if (isPullRefresh) {
      set({ refreshing: true, syncError: '' });
    } else {
      set({ loading: true, syncError: '' });
    }

    const res = await fetchStoreSnapshot(pairingCode);
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (res.success && res.payload) {
      set({
        syncData: res.payload,
        storeName: res.payload.storeName || 'AGEN SOSIS AZIZAH',
        lastSyncTime: timeStr,
        syncError: res.error || '',
        isOfflineCache: !!res.isCached,
        loading: false,
        refreshing: false,
        isConfigured: true,
      });
      return true;
    } else {
      set({
        syncError: res.error || 'Gagal menyinkronkan data toko.',
        loading: false,
        refreshing: false,
      });
      return false;
    }
  },

  setAutoRefreshInterval: async (seconds: number) => {
    set({ autoRefreshInterval: seconds });
    await Storage.setItem(STORAGE_KEYS.AUTO_INTERVAL, seconds.toString());
  },

  resetConnection: async () => {
    await Storage.removeItem(STORAGE_KEYS.PAIRING_CODE);
    set({
      isConfigured: false,
      syncData: null,
      lastSyncTime: '',
      syncError: '',
    });
  },
}));
