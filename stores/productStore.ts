import { create } from 'zustand';
import type { SQLiteDatabase } from '@/services/database';

export interface Product {
  id: number;
  name: string;
  price: number;
  cost_price: number;
  has_stock: number;   // 0 = tidak ber-stok, 1 = ber-stok
  stock: number;
  barcode: string;
  image_path: string;
  category_id: number | null;
  category_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ProductState {
  products: Product[];
  loading: boolean;
  loadProducts: (db: SQLiteDatabase, categoryId?: number | null) => Promise<void>;
  addProduct: (db: SQLiteDatabase, product: {
    name: string;
    price: number;
    cost_price?: number;
    has_stock?: boolean;
    stock?: number;
    barcode?: string;
    image_path?: string;
    category_id?: number | null;
  }) => Promise<void>;
  updateProduct: (db: SQLiteDatabase, id: number, product: {
    name?: string;
    price?: number;
    cost_price?: number;
    has_stock?: boolean;
    stock?: number;
    barcode?: string;
    image_path?: string;
    category_id?: number | null;
  }) => Promise<void>;
  deleteProduct: (db: SQLiteDatabase, id: number) => Promise<void>;
  adjustStock: (db: SQLiteDatabase, productId: number, delta: number) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  loading: false,

  loadProducts: async (db: SQLiteDatabase, categoryId?: number | null) => {
    set({ loading: true });
    let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';
    const params: any[] = [];

    if (categoryId) {
      query += ' WHERE p.category_id = ?';
      params.push(categoryId);
    }

    query += ' ORDER BY p.name ASC';

    const products = await db.getAllAsync<Product>(query, ...params);
    set({ products, loading: false });
  },

  addProduct: async (db, product) => {
    await db.runAsync(
      'INSERT INTO products (name, price, cost_price, has_stock, stock, barcode, image_path, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      product.name,
      product.price,
      product.cost_price ?? 0,
      product.has_stock ? 1 : 0,
      product.stock ?? 0,
      product.barcode ?? '',
      product.image_path ?? '',
      product.category_id ?? null
    );
    await get().loadProducts(db);
  },

  updateProduct: async (db, id, product) => {
    const fields: string[] = [];
    const values: any[] = [];

    if (product.name !== undefined) { fields.push('name = ?'); values.push(product.name); }
    if (product.price !== undefined) { fields.push('price = ?'); values.push(product.price); }
    if (product.cost_price !== undefined) { fields.push('cost_price = ?'); values.push(product.cost_price); }
    if (product.has_stock !== undefined) { fields.push('has_stock = ?'); values.push(product.has_stock ? 1 : 0); }
    if (product.stock !== undefined) { fields.push('stock = ?'); values.push(product.stock); }
    if (product.barcode !== undefined) { fields.push('barcode = ?'); values.push(product.barcode); }
    if (product.image_path !== undefined) { fields.push('image_path = ?'); values.push(product.image_path); }
    if (product.category_id !== undefined) { fields.push('category_id = ?'); values.push(product.category_id); }

    if (fields.length === 0) return;

    fields.push("updated_at = datetime('now','localtime')");
    values.push(id);

    await db.runAsync(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    await get().loadProducts(db);
  },

  deleteProduct: async (db, id) => {
    await db.runAsync('DELETE FROM products WHERE id = ?', id);
    await get().loadProducts(db);
  },

  // Kurangi/tambah stok — hanya untuk produk has_stock=1
  // Tidak akan error / memblokir jika stok sudah habis
  adjustStock: async (db, productId, delta) => {
    await db.runAsync(
      `UPDATE products
       SET stock = MAX(0, stock + ?), updated_at = datetime('now','localtime')
       WHERE id = ? AND has_stock = 1`,
      delta,
      productId
    );
    await get().loadProducts(db);
  },
}));
