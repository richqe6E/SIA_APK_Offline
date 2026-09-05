import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

export type BusinessMode = 'retail' | 'kuliner';
export type ViewMode = 'list' | 'grid';

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
  loading: boolean;

  loadSettings: (db: SQLiteDatabase) => Promise<void>;
  saveSettings: (
    db: SQLiteDatabase,
    storeName: string,
    businessType: string,
    storeAddress?: string,
    storePhone?: string,
    receiptFooter?: string
  ) => Promise<void>;
  setBusinessMode: (db: SQLiteDatabase, mode: BusinessMode) => Promise<void>;
  setAdminPin: (db: SQLiteDatabase, pin: string) => Promise<void>;
  setDefaultViewMode: (db: SQLiteDatabase, mode: ViewMode) => Promise<void>;
  completeOnboarding: (
    db: SQLiteDatabase,
    storeName: string,
    mode: BusinessMode,
    pin: string
  ) => Promise<void>;
  verifyPin: (pin: string) => boolean;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  storeName: 'POS Offline',
  businessType: 'Toko',
  businessMode: 'retail',
  adminPin: '123456',
  defaultViewMode: 'list',
  isOnboarded: true,
  storeAddress: 'Jl. Cipto Mangunkusumo, Samarinda',
  storePhone: '0812-3456-7890',
  receiptFooter: 'Terima kasih atas kunjungan Anda!',
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
      const mode = (map.business_mode as BusinessMode) || 'retail';
      set({
        storeName: map.store_name ?? 'POS Offline',
        businessType: map.business_type ?? (mode === 'kuliner' ? 'Kuliner / Cafe' : 'Toko Retail'),
        businessMode: mode,
        adminPin: map.admin_pin ?? '123456',
        defaultViewMode: (map.default_view_mode as ViewMode) || (mode === 'kuliner' ? 'grid' : 'list'),
        isOnboarded: map.is_onboarded === '1',
        storeAddress: map.store_address ?? 'Jl. Cipto Mangunkusumo, Samarinda',
        storePhone: map.store_phone ?? '0812-3456-7890',
        receiptFooter: map.receipt_footer ?? 'Terima kasih atas kunjungan Anda!',
        loading: false,
      });
    } catch (e) {
      console.error('loadSettings error:', e);
      set({ loading: false });
    }
  },

  saveSettings: async (db, storeName, businessType, storeAddress, storePhone, receiptFooter) => {
    const address = storeAddress ?? get().storeAddress;
    const phone = storePhone ?? get().storePhone;
    const footer = receiptFooter ?? get().receiptFooter;

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_name', storeName);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'business_type', businessType);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_address', address);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_phone', phone);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'receipt_footer', footer);
    });
    set({
      storeName,
      businessType,
      storeAddress: address,
      storePhone: phone,
      receiptFooter: footer,
    });
  },

  setBusinessMode: async (db, mode) => {
    const defaultView: ViewMode = mode === 'kuliner' ? 'grid' : 'list';
    const businessType = mode === 'kuliner' ? 'Kuliner / Cafe' : 'Toko Retail';
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        'business_mode',
        mode
      );
      await txn.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        'default_view_mode',
        defaultView
      );
      await txn.runAsync(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        'business_type',
        businessType
      );
    });
    set({ businessMode: mode, defaultViewMode: defaultView, businessType });
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

  completeOnboarding: async (db, storeName, mode, pin) => {
    const defaultView: ViewMode = mode === 'kuliner' ? 'grid' : 'list';
    const businessType = mode === 'kuliner' ? 'Kuliner / Cafe' : 'Toko Retail';
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'store_name', storeName);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'business_mode', mode);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'business_type', businessType);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'admin_pin', pin);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'default_view_mode', defaultView);
      await txn.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'is_onboarded', '1');
    });
    set({
      storeName,
      businessMode: mode,
      businessType,
      adminPin: pin,
      defaultViewMode: defaultView,
      isOnboarded: true,
    });
  },

  verifyPin: (pin) => {
    const currentPin = get().adminPin || '123456';
    return pin.trim() === currentPin.trim();
  },
}));
