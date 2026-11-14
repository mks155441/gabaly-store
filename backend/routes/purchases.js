const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/database');

// ==========================================
// إعداد رفع صور الفواتير الورقية
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `purchase_${Date.now()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('نوع الملف غير مسموح به (صور وفواتير فقط)'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ==========================================
// توليد رقم فاتورة شراء تلقائي
// ==========================================
function generatePurchaseNumber() {
  const last = db.prepare(`SELECT invoice_number FROM purchase_invoices ORDER BY id DESC LIMIT 1`).get();
  if (!last) return 'PUR-001';
  const num = parseInt(last.invoice_number.split('-')[1]) + 1;
  return `PUR-${String(num).padStart(3, '0')}`;
}

// ==========================================
// توليد كود SKU تلقائي للمنتجات الجديدة بالفاتورة
// ==========================================
function generateProductSKU() {
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
// GET /api/purchases — كل فواتير الشراء
// ==========================================
router.get('/', (req, res) => {
  try {
    const { from, to, status, search, q } = req.query;
    let query  = `
      SELECT pi.*, s.name AS supplier_name
      FROM purchase_invoices pi
      LEFT JOIN suppliers s ON pi.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (from)   { query += ` AND pi.date >= ?`; params.push(from); }
    if (to)     { query += ` AND pi.date <= ?`; params.push(to);   }
    if (status) { query += ` AND pi.status = ?`; params.push(status); }

    const searchTerm = search || q;
    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      query += ` AND (pi.invoice_number LIKE ? OR s.name LIKE ?)`;
      params.push(term, term);
    }

    query += ` ORDER BY pi.date DESC, pi.id DESC`;

    const invoices = db.prepare(query).all(...params);
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GET /api/purchases/:id — فاتورة واحدة بتفاصيلها
// ==========================================
router.get('/:id', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT pi.*, s.name AS supplier_name
      FROM purchase_invoices pi
      LEFT JOIN suppliers s ON pi.supplier_id = s.id
      WHERE pi.id = ?
    `).get(req.params.id);

    if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    const items = db.prepare(`
      SELECT pii.*, p.name AS product_name, p.code AS product_code
      FROM purchase_invoice_items pii
      JOIN products p ON pii.product_id = p.id
      WHERE pii.invoice_id = ?
    `).all(req.params.id);

    res.json({ success: true, data: { ...invoice, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// POST /api/purchases — إضافة فاتورة شراء
// ==========================================
router.post('/', upload.single('invoice_image'), (req, res) => {
  try {
    let { date, supplier_id, items, paid_amount, status, notes } = req.body;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }

    if (!date)                    return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'لازم تضيف منتج واحد على الأقل' });

    // حساب الإجمالي والتحقق من البيانات
    let total = 0;
    for (const item of items) {
      const isNew = item.is_new || !item.product_id;
      if (isNew) {
        if (!item.name || !item.name.trim()) {
          return res.status(400).json({ success: false, message: 'اسم الصنف الجديد مطلوب' });
        }
        if (!item.quantity || !item.unit_price) {
          return res.status(400).json({ success: false, message: 'الكمية وسعر الشراء مطلوبان لكل صنف' });
        }
      } else {
        if (!item.product_id || !item.quantity || !item.unit_price) {
          return res.status(400).json({ success: false, message: 'بيانات الأصناف ناقصة' });
        }
      }
      total += (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    }

    const invoice_number = generatePurchaseNumber();
    const paid           = parseFloat(paid_amount) || 0;
    const invoiceStatus  = status || (paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid');
    const invoice_image  = req.file ? `/uploads/${req.file.filename}` : (req.body.invoice_image || null);

    // كل العمليات في transaction واحدة لضمان الترابط
    const insertAll = db.transaction(() => {
      // إدراج الفاتورة
      const invoiceResult = db.prepare(`
        INSERT INTO purchase_invoices (invoice_number, date, supplier_id, total_amount, paid_amount, status, invoice_image, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invoice_number, date, supplier_id || null, total, paid, invoiceStatus, invoice_image, notes || null);

      const invoiceId = invoiceResult.lastInsertRowid;

      // إدراج تفاصيل الفاتورة + إنشاء الأصناف الجديدة + تحديث المخزن
      for (const item of items) {
        let prodId = item.product_id;
        const qty = parseInt(item.quantity) || 1;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const sellingPrice = parseFloat(item.selling_price) || (unitPrice * 1.35);

        // إنشاء صنف جديد في المخزن إن كان محدداً كصنف جديد
        if (item.is_new || !prodId) {
          const sku = generateProductSKU();
          const prodResult = db.prepare(`
            INSERT INTO products (code, name, wholesale_price, selling_price, current_quantity, image_path)
            VALUES (?, ?, ?, ?, 0, ?)
          `).run(sku, item.name.trim(), unitPrice, sellingPrice, item.image_path || null);
          prodId = prodResult.lastInsertRowid;
        }

        db.prepare(`
          INSERT INTO purchase_invoice_items (invoice_id, product_id, quantity, unit_price)
          VALUES (?, ?, ?, ?)
        `).run(invoiceId, prodId, qty, unitPrice);

        // زيادة الكمية في المخزن
        db.prepare(`
          UPDATE products SET current_quantity = current_quantity + ?, wholesale_price = ? WHERE id = ?
        `).run(qty, unitPrice, prodId);

        // تحديث سعر البيع للجمهور إن تم إدخاله
        if (item.selling_price && parseFloat(item.selling_price) > 0) {
          db.prepare(`UPDATE products SET selling_price = ? WHERE id = ?`).run(parseFloat(item.selling_price), prodId);
        }
      }

      // تسجيل الحركة المالية تلقائياً
      if (paid > 0) {
        db.prepare(`
          INSERT INTO financial_transactions (date, type, category, amount, description, reference_id, source)
          VALUES (?, 'expense', 'مشتريات بضاعة', ?, ?, ?, 'auto')
        `).run(date, paid, `فاتورة شراء ${invoice_number}`, invoiceId);
      }

      return invoiceId;
    });

    const newId = insertAll();
    const newInvoice = db.prepare(`SELECT * FROM purchase_invoices WHERE id = ?`).get(newId);
    res.status(201).json({ success: true, data: newInvoice, message: 'تم تسجيل فاتورة الشراء بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PATCH /api/purchases/:id/pay — تسجيل دفع
// ==========================================
router.patch('/:id/pay', (req, res) => {
  try {
    const { amount } = req.body;
    const invoice = db.prepare(`SELECT * FROM purchase_invoices WHERE id = ?`).get(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    const newPaid = invoice.paid_amount + parseFloat(amount);
    if (newPaid > invoice.total_amount) {
      return res.status(400).json({ success: false, message: 'المبلغ المدفوع أكبر من إجمالي الفاتورة' });
    }

    const newStatus = newPaid >= invoice.total_amount ? 'paid' : 'partial';

    db.transaction(() => {
      db.prepare(`UPDATE purchase_invoices SET paid_amount = ?, status = ? WHERE id = ?`)
        .run(newPaid, newStatus, req.params.id);

      db.prepare(`
        INSERT INTO financial_transactions (date, type, category, amount, description, reference_id, source)
        VALUES (datetime('now','localtime'), 'expense', 'مشتريات بضاعة', ?, ?, ?, 'auto')
      `).run(parseFloat(amount), `دفعة على فاتورة شراء ${invoice.invoice_number}`, invoice.id);
    })();

    const updated = db.prepare(`SELECT * FROM purchase_invoices WHERE id = ?`).get(req.params.id);
    res.json({ success: true, data: updated, message: 'تم تسجيل الدفع بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PUT /api/purchases/:id — تعديل فاتورة شراء
// ==========================================
router.put('/:id', upload.single('invoice_image'), (req, res) => {
  try {
    const invoiceId = req.params.id;
    const existing = db.prepare(`SELECT * FROM purchase_invoices WHERE id = ?`).get(invoiceId);
    if (!existing) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    let { date, supplier_id, items, paid_amount, status, notes } = req.body;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) { items = []; }
    }

    if (!date) return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'لازم تضيف منتج واحد على الأقل' });

    let total = 0;
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        return res.status(400).json({ success: false, message: 'بيانات المنتجات ناقصة' });
      }
      total += item.quantity * item.unit_price;
    }

    const paid = parseFloat(paid_amount) || 0;
    const invoiceStatus = status || (paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid');
    const invoice_image = req.file ? `/uploads/${req.file.filename}` : (req.body.invoice_image !== undefined ? req.body.invoice_image : existing.invoice_image);

    const updateAll = db.transaction(() => {
      // 1. استرجاع الكميات القديمة من المخزن
      const oldItems = db.prepare(`SELECT product_id, quantity FROM purchase_invoice_items WHERE invoice_id = ?`).all(invoiceId);
      for (const oldIt of oldItems) {
        db.prepare(`UPDATE products SET current_quantity = MAX(0, current_quantity - ?) WHERE id = ?`).run(oldIt.quantity, oldIt.product_id);
      }

      // 2. تحديث رأس الفاتورة
      db.prepare(`
        UPDATE purchase_invoices
        SET date = ?, supplier_id = ?, total_amount = ?, paid_amount = ?, status = ?, invoice_image = ?, notes = ?
        WHERE id = ?
      `).run(date, supplier_id || null, total, paid, invoiceStatus, invoice_image, notes || null, invoiceId);

      // 3. حذف الأصناف القديمة وإدراج الجديدة وتزويد المخزن
      db.prepare(`DELETE FROM purchase_invoice_items WHERE invoice_id = ?`).run(invoiceId);
      for (const item of items) {
        db.prepare(`
          INSERT INTO purchase_invoice_items (invoice_id, product_id, quantity, unit_price)
          VALUES (?, ?, ?, ?)
        `).run(invoiceId, item.product_id, item.quantity, item.unit_price);

        db.prepare(`UPDATE products SET current_quantity = current_quantity + ?, wholesale_price = ? WHERE id = ?`)
          .run(item.quantity, item.unit_price, item.product_id);
      }

      // 4. تحديث الحركات المالية
      db.prepare(`DELETE FROM financial_transactions WHERE reference_id = ? AND category = 'مشتريات بضاعة' AND source = 'auto'`).run(invoiceId);
      if (paid > 0) {
        db.prepare(`
          INSERT INTO financial_transactions (date, type, category, amount, description, reference_id, source)
          VALUES (?, 'expense', 'مشتريات بضاعة', ?, ?, ?, 'auto')
        `).run(date, paid, `فاتورة شراء ${existing.invoice_number}`, invoiceId);
      }
    });

    updateAll();
    const updated = db.prepare(`SELECT * FROM purchase_invoices WHERE id = ?`).get(invoiceId);
    res.json({ success: true, data: updated, message: 'تم تعديل فاتورة الشراء وتحديث المخزن بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// POST /api/purchases/:id/image — رفع أو تغيير صورة الفاتورة
// ==========================================
router.post('/:id/image', upload.single('invoice_image'), (req, res) => {
  try {
    const invoiceId = req.params.id;
    const existing = db.prepare(`SELECT * FROM purchase_invoices WHERE id = ?`).get(invoiceId);
    if (!existing) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    if (!req.file) return res.status(400).json({ success: false, message: 'يرجى اختيار ملف الصورة' });

    const invoice_image = `/uploads/${req.file.filename}`;
    db.prepare(`UPDATE purchase_invoices SET invoice_image = ? WHERE id = ?`).run(invoice_image, invoiceId);

    res.json({ success: true, data: { invoice_image }, message: 'تم حفظ صورة الفاتورة بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// DELETE /api/purchases/:id — مسح فاتورة شراء
// ==========================================
router.delete('/:id', (req, res) => {
  try {
    const invoiceId = req.params.id;
    const existing = db.prepare(`SELECT * FROM purchase_invoices WHERE id = ?`).get(invoiceId);
    if (!existing) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    db.transaction(() => {
      // 1. خصم الكميات من المخزن
      const items = db.prepare(`SELECT product_id, quantity FROM purchase_invoice_items WHERE invoice_id = ?`).all(invoiceId);
      for (const it of items) {
        db.prepare(`UPDATE products SET current_quantity = MAX(0, current_quantity - ?) WHERE id = ?`).run(it.quantity, it.product_id);
      }

      // 2. حذف الحركات المالية التلقائية
      db.prepare(`DELETE FROM financial_transactions WHERE reference_id = ? AND category = 'مشتريات بضاعة' AND source = 'auto'`).run(invoiceId);

      // 3. حذف الفاتورة
      db.prepare(`DELETE FROM purchase_invoices WHERE id = ?`).run(invoiceId);
    })();

    res.json({ success: true, message: `تم مسح فاتورة الشراء ${existing.invoice_number} وخصم البضاعة من المخزن` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
