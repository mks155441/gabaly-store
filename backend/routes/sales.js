const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ==========================================
// توليد رقم فاتورة بيع تلقائي
// ==========================================
function generateSaleNumber() {
  const last = db.prepare(`SELECT invoice_number FROM sale_invoices ORDER BY id DESC LIMIT 1`).get();
  if (!last) return 'SAL-001';
  const num = parseInt(last.invoice_number.split('-')[1]) + 1;
  return `SAL-${String(num).padStart(3, '0')}`;
}

// دالة مساعدة لتحديث أو إضافة العميل
function syncCustomer(name, phone) {
  if (!name || !name.trim()) return;
  const cleanName  = name.trim();
  const cleanPhone = phone ? phone.trim() : null;
  const existing = db.prepare(`SELECT id, phone FROM customers WHERE name = ?`).get(cleanName);
  if (existing) {
    if (cleanPhone && cleanPhone !== existing.phone) {
      db.prepare(`UPDATE customers SET phone = ? WHERE id = ?`).run(cleanPhone, existing.id);
    }
  } else {
    db.prepare(`INSERT INTO customers (name, phone) VALUES (?, ?)`).run(cleanName, cleanPhone);
  }
}

// ==========================================
// GET /api/sales — كل فواتير البيع
// ==========================================
router.get('/', (req, res) => {
  try {
    const { from, to, status, customer, search, q } = req.query;
    let query  = `SELECT * FROM sale_invoices WHERE 1=1`;
    const params = [];

    if (from)     { query += ` AND date >= ?`;   params.push(from);   }
    if (to)       { query += ` AND date <= ?`;   params.push(to);     }
    if (status)   { query += ` AND status = ?`;  params.push(status); }

    const searchTerm = search || q || customer;
    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      query += ` AND (invoice_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)`;
      params.push(term, term, term);
    }

    query += ` ORDER BY date DESC, id DESC`;

    const invoices = db.prepare(query).all(...params);
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GET /api/sales/:id — فاتورة واحدة بتفاصيلها
// ==========================================
router.get('/:id', (req, res) => {
  try {
    const invoice = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    const items = db.prepare(`
      SELECT sii.*, p.name AS product_name, p.code AS product_code, p.image_path
      FROM sale_invoice_items sii
      JOIN products p ON sii.product_id = p.id
      WHERE sii.invoice_id = ?
    `).all(req.params.id);

    res.json({ success: true, data: { ...invoice, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// POST /api/sales — إضافة فاتورة بيع
// ==========================================
router.post('/', (req, res) => {
  try {
    const { date, customer_name, customer_phone, items, discount, paid_amount, status, notes } = req.body;

    if (!date) return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'لازم تضيف منتج واحد على الأقل' });

    // التحقق من الكميات وحساب الإجمالي
    let subtotal = 0;
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        return res.status(400).json({ success: false, message: 'بيانات المنتجات ناقصة' });
      }
      const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(item.product_id);
      if (!product) return res.status(400).json({ success: false, message: `منتج برقم ${item.product_id} غير موجود` });
      if (product.current_quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `الكمية المتاحة من "${product.name}" هي ${product.current_quantity} فقط`
        });
      }
      subtotal += item.quantity * item.unit_price;
    }

    const discountVal = parseFloat(discount) || 0;
    const total       = Math.max(0, subtotal - discountVal);
    const paid        = parseFloat(paid_amount) || 0;
    const invoice_number = generateSaleNumber();
    const invoiceStatus  = status || (paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid');

    const insertAll = db.transaction(() => {
      // إدراج الفاتورة
      const invoiceResult = db.prepare(`
        INSERT INTO sale_invoices (invoice_number, date, customer_name, customer_phone, total_amount, discount, paid_amount, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoice_number,
        date,
        customer_name ? customer_name.trim() : null,
        customer_phone ? customer_phone.trim() : null,
        total,
        discountVal,
        paid,
        invoiceStatus,
        notes || null
      );

      const invoiceId = invoiceResult.lastInsertRowid;

      // إدراج تفاصيل الفاتورة + تقليل المخزن
      for (const item of items) {
        const product = db.prepare(`SELECT wholesale_price FROM products WHERE id = ?`).get(item.product_id);
        db.prepare(`
          INSERT INTO sale_invoice_items (invoice_id, product_id, quantity, unit_price, wholesale_price)
          VALUES (?, ?, ?, ?, ?)
        `).run(invoiceId, item.product_id, item.quantity, item.unit_price, product.wholesale_price);

        // تقليل الكمية في المخزن
        db.prepare(`
          UPDATE products SET current_quantity = current_quantity - ? WHERE id = ?
        `).run(item.quantity, item.product_id);
      }

      // تسجيل الحركة المالية تلقائياً
      if (paid > 0) {
        db.prepare(`
          INSERT INTO financial_transactions (date, type, category, amount, description, reference_id, source)
          VALUES (?, 'income', 'مبيعات', ?, ?, ?, 'auto')
        `).run(date, paid, `فاتورة بيع ${invoice_number}`, invoiceId);
      }

      // تحديث قائمة العملاء
      if (customer_name) {
        syncCustomer(customer_name, customer_phone);
      }

      return invoiceId;
    });

    const newId = insertAll();
    const newInvoice = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(newId);
    res.status(201).json({ success: true, data: newInvoice, message: 'تم تسجيل فاتورة البيع بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PUT /api/sales/:id — تعديل فاتورة بيع
// ==========================================
router.put('/:id', (req, res) => {
  try {
    const invoiceId = req.params.id;
    const existing = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(invoiceId);
    if (!existing) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    const { date, customer_name, customer_phone, items, discount, paid_amount, notes } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'لازم تضيف منتج واحد على الأقل' });

    const updateAll = db.transaction(() => {
      // 1. إعادة الكميات القديمة للمخزن مؤقتاً لحساب المتاح بدقة
      const oldItems = db.prepare(`SELECT product_id, quantity FROM sale_invoice_items WHERE invoice_id = ?`).all(invoiceId);
      for (const oldIt of oldItems) {
        db.prepare(`UPDATE products SET current_quantity = current_quantity + ? WHERE id = ?`).run(oldIt.quantity, oldIt.product_id);
      }

      // 2. التحقق من كفاية المخزون للكميات الجديدة
      let subtotal = 0;
      for (const item of items) {
        const prod = db.prepare(`SELECT name, current_quantity, wholesale_price FROM products WHERE id = ?`).get(item.product_id);
        if (!prod) throw new Error(`منتج برقم ${item.product_id} غير موجود`);
        if (prod.current_quantity < item.quantity) {
          throw new Error(`الكمية المتاحة من "${prod.name}" هي ${prod.current_quantity} فقط`);
        }
        subtotal += item.quantity * item.unit_price;
      }

      const discountVal = parseFloat(discount) || 0;
      const total       = Math.max(0, subtotal - discountVal);
      const paid        = parseFloat(paid_amount) || 0;
      const invoiceStatus = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

      // 3. تحديث الفاتورة
      db.prepare(`
        UPDATE sale_invoices
        SET date = ?, customer_name = ?, customer_phone = ?, total_amount = ?, discount = ?, paid_amount = ?, status = ?, notes = ?
        WHERE id = ?
      `).run(
        date,
        customer_name ? customer_name.trim() : null,
        customer_phone ? customer_phone.trim() : null,
        total,
        discountVal,
        paid,
        invoiceStatus,
        notes || null,
        invoiceId
      );

      // 4. حذف الأصناف القديمة وإدراج الأصناف الجديدة وخصم الكميات من المخزن
      db.prepare(`DELETE FROM sale_invoice_items WHERE invoice_id = ?`).run(invoiceId);
      for (const item of items) {
        const prod = db.prepare(`SELECT wholesale_price FROM products WHERE id = ?`).get(item.product_id);
        db.prepare(`
          INSERT INTO sale_invoice_items (invoice_id, product_id, quantity, unit_price, wholesale_price)
          VALUES (?, ?, ?, ?, ?)
        `).run(invoiceId, item.product_id, item.quantity, item.unit_price, prod.wholesale_price);

        db.prepare(`UPDATE products SET current_quantity = current_quantity - ? WHERE id = ?`).run(item.quantity, item.product_id);
      }

      // 5. ضبط الحركات المالية
      db.prepare(`DELETE FROM financial_transactions WHERE reference_id = ? AND category = 'مبيعات' AND source = 'auto'`).run(invoiceId);
      if (paid > 0) {
        db.prepare(`
          INSERT INTO financial_transactions (date, type, category, amount, description, reference_id, source)
          VALUES (?, 'income', 'مبيعات', ?, ?, ?, 'auto')
        `).run(date, paid, `فاتورة بيع ${existing.invoice_number}`, invoiceId);
      }

      // 6. مزامنة بيانات العميل
      if (customer_name) {
        syncCustomer(customer_name, customer_phone);
      }
    });

    updateAll();
    const updated = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(invoiceId);
    res.json({ success: true, data: updated, message: 'تم تعديل الفاتورة بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// DELETE /api/sales/:id — مسح فاتورة بيع
// ==========================================
router.delete('/:id', (req, res) => {
  try {
    const invoiceId = req.params.id;
    const existing = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(invoiceId);
    if (!existing) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    db.transaction(() => {
      // 1. استرجاع الكميات للمخزن
      const items = db.prepare(`SELECT product_id, quantity FROM sale_invoice_items WHERE invoice_id = ?`).all(invoiceId);
      for (const it of items) {
        db.prepare(`UPDATE products SET current_quantity = current_quantity + ? WHERE id = ?`).run(it.quantity, it.product_id);
      }

      // 2. حذف الحركات المالية التلقائية المرتبطة بالفاتورة
      db.prepare(`DELETE FROM financial_transactions WHERE reference_id = ? AND category = 'مبيعات' AND source = 'auto'`).run(invoiceId);

      // 3. حذف الفاتورة وأصنافها
      db.prepare(`DELETE FROM sale_invoices WHERE id = ?`).run(invoiceId);
    })();

    res.json({ success: true, message: `تم مسح الفاتورة ${existing.invoice_number} وإعادة البضاعة للمخزن بنجاح` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PATCH /api/sales/:id/mark-paid — جعل الفاتورة خالصة
// ==========================================
router.patch('/:id/mark-paid', (req, res) => {
  try {
    const invoice = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    const remaining = invoice.total_amount - invoice.paid_amount;
    if (remaining <= 0) {
      return res.json({ success: true, message: 'الفاتورة خالصة بالفعل' });
    }

    db.transaction(() => {
      db.prepare(`UPDATE sale_invoices SET paid_amount = total_amount, status = 'paid' WHERE id = ?`).run(invoice.id);
      db.prepare(`
        INSERT INTO financial_transactions (date, type, category, amount, description, reference_id, source)
        VALUES (datetime('now','localtime'), 'income', 'مبيعات', ?, ?, ?, 'auto')
      `).run(remaining, `سداد باقي فاتورة بيع ${invoice.invoice_number} (خالصة)`, invoice.id);
    })();

    const updated = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(req.params.id);
    res.json({ success: true, data: updated, message: 'تم تحويل الفاتورة إلى خالصة بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PATCH /api/sales/:id/pay — تسجيل دفع جزء
// ==========================================
router.patch('/:id/pay', (req, res) => {
  try {
    const { amount } = req.body;
    const invoice = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });

    const newPaid = invoice.paid_amount + parseFloat(amount);
    if (newPaid > invoice.total_amount) {
      return res.status(400).json({ success: false, message: 'المبلغ المدفوع أكبر من إجمالي الفاتورة' });
    }

    const newStatus = newPaid >= invoice.total_amount ? 'paid' : 'partial';

    db.transaction(() => {
      db.prepare(`UPDATE sale_invoices SET paid_amount = ?, status = ? WHERE id = ?`)
        .run(newPaid, newStatus, req.params.id);

      db.prepare(`
        INSERT INTO financial_transactions (date, type, category, amount, description, reference_id, source)
        VALUES (datetime('now','localtime'), 'income', 'مبيعات', ?, ?, ?, 'auto')
      `).run(parseFloat(amount), `دفعة على فاتورة بيع ${invoice.invoice_number}`, invoice.id);
    })();

    const updated = db.prepare(`SELECT * FROM sale_invoices WHERE id = ?`).get(req.params.id);
    res.json({ success: true, data: updated, message: 'تم تسجيل الدفع بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
