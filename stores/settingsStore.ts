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
  receiptFooter: string;
  qrisImagePath: string;
  appOrientation: AppOrientation;
  currentUserRole: UserRole | null;
  loading: boolean;

  loadSettings: (db: SQLiteDatabase) => Promise<void>;
  saveSettings: (
    db: SQLiteDatabase,
    storeName: string,
    businessType: string,
    storeAddress?: string,
    storePhone?: string,
    receiptFooter?: string,
    qrisImagePath?: string
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
  receiptFooter: 'Terima kasih atas kunjungan Anda!',
  qrisImagePath: '',
  appOrientation: 'portrait',
  currentUserRole: null,
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
        receiptFooter: map.receipt_footer ?? 'Terima kasih atas kunjungan Anda!',
        qrisImagePath: map.qris_image_path ?? '',
        appOrientation: (map.app_orientation as AppOrientation) || 'portrait',
        loading: false,
      });
    } catch (e) {
      console.error('loadSettings error:', e);
      set({ loading: false });
    }
  },

  saveSettings: async (db, storeName, businessType, storeAddress, storePhone, receiptFooter, qrisImagePath) => {
    const address = storeAddress ?? get().storeAddress;
    const phone = storePhone ?? get().storePhone;
    const footer = receiptFooter ?? get().receiptFooter;
    const qris = qrisImagePath !== undefined ? qrisImagePath : get().qrisImagePath;

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_name', storeName);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'business_type', businessType);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_address', address);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_phone', phone);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'receipt_footer', footer);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'qris_image_path', qris);
    });
    set({
      storeName,
      businessType,
      storeAddress: address,
      storePhone: phone,
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
}));
