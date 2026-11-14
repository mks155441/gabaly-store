const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'store.db');
const db = new Database(DB_PATH);

// تفعيل الـ Foreign Keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    -- ==========================================
    -- جدول الإعدادات العامة للنظام
    -- ==========================================
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- الحد الأدنى الافتراضي للمخزن
    INSERT OR IGNORE INTO settings (key, value) VALUES ('min_stock_quantity', '5');

    -- ==========================================
    -- جدول المنتجات
    -- ==========================================
    CREATE TABLE IF NOT EXISTS products (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      code             TEXT    UNIQUE NOT NULL,
      name             TEXT    NOT NULL,
      wholesale_price  REAL    NOT NULL DEFAULT 0,
      selling_price    REAL    NOT NULL DEFAULT 0,
      current_quantity INTEGER NOT NULL DEFAULT 0,
      image_path       TEXT,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ==========================================
    -- جدول الموردين
    -- ==========================================
    CREATE TABLE IF NOT EXISTS suppliers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ==========================================
    -- جدول فواتير الشراء
    -- ==========================================
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT    UNIQUE NOT NULL,
      date           TEXT    NOT NULL,
      supplier_id    INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      total_amount   REAL    NOT NULL DEFAULT 0,
      paid_amount    REAL    NOT NULL DEFAULT 0,
      status         TEXT    NOT NULL DEFAULT 'unpaid' CHECK(status IN ('paid','unpaid','partial')),
      invoice_image  TEXT,
      notes          TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ==========================================
    -- جدول تفاصيل فواتير الشراء
    -- ==========================================
    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id  INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity    INTEGER NOT NULL DEFAULT 1,
      unit_price  REAL    NOT NULL DEFAULT 0,
      total       REAL    GENERATED ALWAYS AS (quantity * unit_price) STORED
    );

    -- ==========================================
    -- جدول العملاء
    -- ==========================================
    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      phone      TEXT,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ==========================================
    -- جدول فواتير البيع
    -- ==========================================
    CREATE TABLE IF NOT EXISTS sale_invoices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT    UNIQUE NOT NULL,
      date           TEXT    NOT NULL,
      customer_name  TEXT,
      customer_phone TEXT,
      total_amount   REAL    NOT NULL DEFAULT 0,
      discount       REAL    NOT NULL DEFAULT 0,
      paid_amount    REAL    NOT NULL DEFAULT 0,
      status         TEXT    NOT NULL DEFAULT 'unpaid' CHECK(status IN ('paid','unpaid','partial')),
      notes          TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- ==========================================
    -- جدول تفاصيل فواتير البيع
    -- ==========================================
    CREATE TABLE IF NOT EXISTS sale_invoice_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id      INTEGER NOT NULL REFERENCES sale_invoices(id) ON DELETE CASCADE,
      product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity        INTEGER NOT NULL DEFAULT 1,
      unit_price      REAL    NOT NULL DEFAULT 0,
      wholesale_price REAL    NOT NULL DEFAULT 0,
      total           REAL    GENERATED ALWAYS AS (quantity * unit_price) STORED
    );

    -- ==========================================
    -- جدول الحركات المالية
    -- ==========================================
    CREATE TABLE IF NOT EXISTS financial_transactions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT    NOT NULL,
      type         TEXT    NOT NULL CHECK(type IN ('income','expense')),
      category     TEXT    NOT NULL,
      amount       REAL    NOT NULL DEFAULT 0,
      description  TEXT,
      reference_id INTEGER,
      source       TEXT    NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','auto')),
      created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // التأكد من وجود عمود customer_phone في حالة كانت القاعدة منشأة مسبقاً
  try {
    const cols = db.prepare(`PRAGMA table_info(sale_invoices)`).all();
    if (!cols.some(c => c.name === 'customer_phone')) {
      db.exec(`ALTER TABLE sale_invoices ADD COLUMN customer_phone TEXT;`);
    }
  } catch (e) {
    console.error('Error checking customer_phone column:', e.message);
  }

  // التأكد من وجود عمود invoice_image في فواتير الشراء
  try {
    const pCols = db.prepare(`PRAGMA table_info(purchase_invoices)`).all();
    if (!pCols.some(c => c.name === 'invoice_image')) {
      db.exec(`ALTER TABLE purchase_invoices ADD COLUMN invoice_image TEXT;`);
    }
  } catch (e) {
    console.error('Error checking invoice_image column:', e.message);
  }

  console.log('✅ قاعدة البيانات جاهزة');
}

initDB();

module.exports = db;
