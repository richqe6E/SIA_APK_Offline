import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

export type BusinessMode = 'retail' | 'kuliner';
export type ViewMode = 'list' | 'grid';
export type AppOrientation = 'portrait' | 'landscape';
export type UserRole = 'kasir' | 'pemilik';

interface SettingsState {
  storeName: string;
  businessType: string;
  businessMode: BusinessMode;
  adminPin: string;
  defaultViewMode: ViewMode;
  isOnboarded: boolean;
  storeAddress: string;
  storePhone: string;
  storePhone2: string;
  receiptFooter: string;
  qrisImagePath: string;
  appOrientation: AppOrientation;
  currentUserRole: UserRole | null;
  storePairingCode: string;
  isCloudConnected: boolean;
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  supabaseUrl: string;
  supabaseAnonKey: string;
  taxEnabled: boolean;
  taxName: string;
  taxType: 'percent' | 'nominal';
  taxRate: number;
  loading: boolean;

  loadSettings: (db: SQLiteDatabase) => Promise<void>;
  saveSettings: (
    db: SQLiteDatabase,
    storeName: string,
    businessType: string,
    storeAddress?: string,
    storePhone?: string,
    receiptFooter?: string,
    qrisImagePath?: string,
    storePhone2?: string
  ) => Promise<void>;
  setBusinessMode: (db: SQLiteDatabase, mode: BusinessMode) => Promise<void>;
  setAdminPin: (db: SQLiteDatabase, pin: string) => Promise<void>;
  setDefaultViewMode: (db: SQLiteDatabase, mode: ViewMode) => Promise<void>;
  setQrisImagePath: (db: SQLiteDatabase, path: string) => Promise<void>;
  setAppOrientation: (db: SQLiteDatabase, orientation: AppOrientation) => Promise<void>;
  completeOnboarding: (
    db: SQLiteDatabase,
    storeName: string,
    pin: string,
    mode?: BusinessMode
  ) => Promise<void>;
  verifyPin: (pin: string) => boolean;
  loginAsKasir: () => void;
  loginAsPemilik: (pin: string) => boolean;
  logoutRole: () => void;
  setPairingCode: (code: string, db?: SQLiteDatabase) => Promise<void> | void;
  setCloudConnected: (connected: boolean) => void;
  setCloudSyncStatus: (status: 'idle' | 'syncing' | 'synced' | 'error') => void;
  setCloudCredentials: (db: SQLiteDatabase, url: string, key: string) => Promise<void>;
  setTaxSettings: (
    db: SQLiteDatabase,
    enabled: boolean,
    name?: string,
    type?: 'percent' | 'nominal',
    rate?: number
  ) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  storeName: 'POS Offline',
  businessType: 'Toko Retail',
  businessMode: 'retail',
  adminPin: '123456',
  defaultViewMode: 'list',
  isOnboarded: true,
  storeAddress: 'Jl. Cipto Mangunkusumo, Samarinda',
  storePhone: '0812-3456-7890',
  storePhone2: '',
  receiptFooter: 'Terima kasih atas kunjungan Anda!',
  qrisImagePath: '',
  appOrientation: 'portrait',
  currentUserRole: null,
  storePairingCode: 'AZ-7789',
  isCloudConnected: false,
  cloudSyncStatus: 'idle',
  supabaseUrl: 'https://vhtualqxbtrmnljzmees.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodHVhbHF4YnRybW5sanptZWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk4NzAsImV4cCI6MjEwNDQ5NTg3MH0.ZCch1NWey4In2xLiwZht0VbFnNrEScITUCKhHe3EdFE',
  taxEnabled: false,
  taxName: 'Pajak / PB1',
  taxType: 'percent',
  taxRate: 10,
  loading: false,

  loadSettings: async (db) => {
    set({ loading: true });
    try {
      const rows = await db.getAllAsync<{ key: string; value: string }>(
        'SELECT key, value FROM settings'
      );
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      set({
        storeName: map.store_name ?? 'POS Offline',
        businessType: map.business_type ?? 'Toko Retail',
        businessMode: 'retail',
        adminPin: map.admin_pin ?? '123456',
        defaultViewMode: (map.default_view_mode as ViewMode) || 'list',
        isOnboarded: map.is_onboarded === '1',
        storeAddress: map.store_address ?? 'Jl. Cipto Mangunkusumo, Samarinda',
        storePhone: map.store_phone ?? '0812-3456-7890',
        storePhone2: map.store_phone2 ?? '',
        receiptFooter: map.receipt_footer ?? 'Terima kasih atas kunjungan Anda!',
        qrisImagePath: map.qris_image_path ?? '',
        appOrientation: (map.app_orientation as AppOrientation) || 'portrait',
        storePairingCode: map.store_pairing_code || 'AZ-7789',
        supabaseUrl:
          map.supabase_url || 'https://vhtualqxbtrmnljzmees.supabase.co',
        supabaseAnonKey:
          map.supabase_anon_key ||
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZodHVhbHF4YnRybW5sanptZWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk4NzAsImV4cCI6MjEwNDQ5NTg3MH0.ZCch1NWey4In2xLiwZht0VbFnNrEScITUCKhHe3EdFE',
        taxEnabled: map.tax_enabled === '1',
        taxName: map.tax_name || 'Pajak / PB1',
        taxType: (map.tax_type as 'percent' | 'nominal') || 'percent',
        taxRate: map.tax_rate ? parseFloat(map.tax_rate) : 10,
        loading: false,
      });
    } catch (e) {
      console.error('loadSettings error:', e);
      set({ loading: false });
    }
  },

  saveSettings: async (db, storeName, businessType, storeAddress, storePhone, receiptFooter, qrisImagePath, storePhone2) => {
    const address = storeAddress ?? get().storeAddress;
    const phone = storePhone ?? get().storePhone;
    const phone2 = storePhone2 !== undefined ? storePhone2 : get().storePhone2;
    const footer = receiptFooter ?? get().receiptFooter;
    const qris = qrisImagePath !== undefined ? qrisImagePath : get().qrisImagePath;

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_name', storeName);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'business_type', businessType);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_address', address);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_phone', phone);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_phone2', phone2);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'receipt_footer', footer);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'qris_image_path', qris);
    });
    set({
      storeName,
      businessType,
      storeAddress: address,
      storePhone: phone,
      storePhone2: phone2,
      receiptFooter: footer,
      qrisImagePath: qris,
    });
  },

  setBusinessMode: async (db, mode) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'business_mode',
      'retail'
    );
    set({ businessMode: 'retail' });
  },

  setAdminPin: async (db, pin) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'admin_pin',
      pin
    );
    set({ adminPin: pin });
  },

  setDefaultViewMode: async (db, mode) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'default_view_mode',
      mode
    );
    set({ defaultViewMode: mode });
  },

  setQrisImagePath: async (db, path) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'qris_image_path',
      path
    );
    set({ qrisImagePath: path });
  },

  setAppOrientation: async (db, orientation) => {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'app_orientation',
      orientation
    );
    set({ appOrientation: orientation });
  },

  completeOnboarding: async (db, storeName, pin, mode = 'retail') => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_name', storeName);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'business_mode', 'retail');
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'business_type', 'Toko Retail');
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'admin_pin', pin);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'default_view_mode', 'list');
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'is_onboarded', '1');
    });
    set({
      storeName,
      businessMode: 'retail',
      businessType: 'Toko Retail',
      adminPin: pin,
      defaultViewMode: 'list',
      isOnboarded: true,
    });
  },

  verifyPin: (pin) => {
    const currentPin = get().adminPin || '123456';
    return pin.trim() === currentPin.trim();
  },

  loginAsKasir: () => {
    set({ currentUserRole: 'kasir' });
  },

  loginAsPemilik: (pin: string) => {
    if (get().verifyPin(pin)) {
      set({ currentUserRole: 'pemilik' });
      return true;
    }
    return false;
  },

  logoutRole: () => {
    set({ currentUserRole: null });
  },

  setPairingCode: async (code: string, db?: SQLiteDatabase) => {
    if (db) {
      try {
        await db.runAsync(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('store_pairing_code', ?)",
          code
        );
      } catch (e) {
        console.warn('Failed to save store_pairing_code:', e);
      }
    }
    set({ storePairingCode: code });
  },
  setCloudConnected: (connected: boolean) => set({ isCloudConnected: connected }),
  setCloudSyncStatus: (status) => set({ cloudSyncStatus: status }),
  setCloudCredentials: async (db, url, key) => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'supabase_url', url);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'supabase_anon_key', key);
    });
    set({ supabaseUrl: url, supabaseAnonKey: key });
  },

  setTaxSettings: async (db, enabled, name, type, rate) => {
    const finalName = name !== undefined ? name : get().taxName;
    const finalType = type !== undefined ? type : get().taxType;
    const finalRate = rate !== undefined ? rate : get().taxRate;

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'tax_enabled', enabled ? '1' : '0');
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'tax_name', finalName);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'tax_type', finalType);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'tax_rate', finalRate.toString());
    });
    set({
      taxEnabled: enabled,
      taxName: finalName,
      taxType: finalType,
      taxRate: finalRate,
    });
  },
}));
