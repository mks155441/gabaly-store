const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/database');

// ==========================================
// إعداد رفع الصور
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `product_${Date.now()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('نوع الملف غير مسموح به'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ==========================================
// توليد كود المنتج بنظام باركود وتكويد احترافي (SKU)
// ==========================================
function generateCode(custom) {
  if (custom && custom.trim()) {
    const existing = db.prepare(`SELECT id FROM products WHERE code = ?`).get(custom.trim());
    if (!existing) return custom.trim();
  }
  const year = new Date().getFullYear().toString().slice(-2);
  const countRow = db.prepare(`SELECT count(*) as c FROM products`).get();
  let seq = (countRow ? countRow.c : 0) + 1;
  let candidate = `SKU-${year}${String(seq).padStart(4, '0')}`;
  while (db.prepare(`SELECT id FROM products WHERE code = ?`).get(candidate)) {
    seq++;
    candidate = `SKU-${year}${String(seq).padStart(4, '0')}`;
  }
  return candidate;
}

// ==========================================
// POST /api/products/upload-image — رفع صورة منتج سريعة
// ==========================================
router.post('/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'لم يتم اختيار ملف صورة' });
    const image_path = `/uploads/${req.file.filename}`;
    res.json({ success: true, image_path, message: 'تم رفع صورة المنتج بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GET /api/products — عرض كل المنتجات
// ==========================================
router.get('/', (req, res) => {
  try {
    const { search, low_stock } = req.query;
    const minStock = parseInt(db.prepare(`SELECT value FROM settings WHERE key='min_stock_quantity'`).get()?.value || 5);

    let query = `SELECT * FROM products`;
    const params = [];

    if (search) {
      query += ` WHERE (name LIKE ? OR code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (low_stock === 'true') {
      query += search ? ` AND current_quantity <= ?` : ` WHERE current_quantity <= ?`;
      params.push(minStock);
    }

    query += ` ORDER BY created_at DESC`;

    const products = db.prepare(query).all(...params);
    res.json({ success: true, data: products, min_stock: minStock });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GET /api/products/:id — عرض منتج واحد
// ==========================================
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// POST /api/products — إضافة منتج جديد
// ==========================================
router.post('/', upload.single('image'), (req, res) => {
  try {
    const { name, wholesale_price, selling_price, code: customCode } = req.body;

    if (!name)            return res.status(400).json({ success: false, message: 'اسم المنتج مطلوب' });
    if (!wholesale_price) return res.status(400).json({ success: false, message: 'سعر الجملة مطلوب' });
    if (!selling_price)   return res.status(400).json({ success: false, message: 'سعر البيع مطلوب' });

    const code       = generateCode(customCode);
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO products (code, name, wholesale_price, selling_price, image_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, name.trim(), parseFloat(wholesale_price), parseFloat(selling_price), image_path);

    const newProduct = db.prepare(`SELECT * FROM products WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newProduct, message: 'تم إضافة المنتج بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PUT /api/products/:id — تعديل منتج
// ==========================================
router.put('/:id', upload.single('image'), (req, res) => {
  try {
    const { name, wholesale_price, selling_price } = req.body;
    const existing = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });

    // لو في صورة جديدة، احذف القديمة
    let image_path = existing.image_path;
    if (req.file) {
      if (existing.image_path) {
        const oldPath = path.join(__dirname, '..', existing.image_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image_path = `/uploads/${req.file.filename}`;
    }

    db.prepare(`
      UPDATE products
      SET name = ?, wholesale_price = ?, selling_price = ?, image_path = ?
      WHERE id = ?
    `).run(
      name?.trim() || existing.name,
      parseFloat(wholesale_price) || existing.wholesale_price,
      parseFloat(selling_price)   || existing.selling_price,
      image_path,
      req.params.id
    );

    const updated = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    res.json({ success: true, data: updated, message: 'تم تعديل المنتج بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// DELETE /api/products/:id — حذف منتج من المخزن
// ==========================================
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });

    db.transaction(() => {
      // إزالة أي ارتباطات قديمة بالمنتج
      db.prepare(`DELETE FROM purchase_invoice_items WHERE product_id = ?`).run(req.params.id);
      db.prepare(`DELETE FROM sale_invoice_items WHERE product_id = ?`).run(req.params.id);

      // حذف صورة المنتج من السيرفر إن وجدت
      if (existing.image_path) {
        const imgPath = path.join(__dirname, '..', existing.image_path);
        if (fs.existsSync(imgPath)) {
          try { fs.unlinkSync(imgPath); } catch (e) {}
        }
      }

      // حذف المنتج نهائياً من المخزن
      db.prepare(`DELETE FROM products WHERE id = ?`).run(req.params.id);
    })();

    res.json({ success: true, message: `تم حذف "${existing.name}" بنجاح من المخزن` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
