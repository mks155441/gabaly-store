const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ==========================================
// GET /api/customers — قائمة كل العملاء مع إحصائيات الديون والمشتريات
// ==========================================
router.get('/', (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.notes,
        c.created_at,
        COUNT(si.id) AS invoice_count,
        COALESCE(SUM(si.total_amount), 0) AS total_bought,
        COALESCE(SUM(si.paid_amount), 0) AS total_paid,
        COALESCE(SUM(si.total_amount - si.paid_amount), 0) AS total_debt,
        MAX(si.date) AS last_purchase_date
      FROM customers c
      LEFT JOIN sale_invoices si ON si.customer_name = c.name
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY c.id ORDER BY total_debt DESC, c.name ASC`;

    const customers = db.prepare(query).all(...params);

    // ملخص عام للعملاء
    const totalCustomers = customers.length;
    const totalDebts = customers.reduce((s, c) => s + c.total_debt, 0);
    const totalSalesAll = customers.reduce((s, c) => s + c.total_bought, 0);

    res.json({
      success: true,
      data: customers,
      summary: {
        total_customers: totalCustomers,
        total_debt_on_customers: totalDebts,
        total_sales_to_customers: totalSalesAll
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GET /api/customers/:id/invoices — فواتير عميل محدد
// ==========================================
router.get('/:id/invoices', (req, res) => {
  try {
    const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'العميل غير موجود' });

    const invoices = db.prepare(`
      SELECT * FROM sale_invoices 
      WHERE customer_name = ? 
      ORDER BY date DESC, id DESC
    `).all(customer.name);

    res.json({
      success: true,
      customer,
      invoices
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// POST /api/customers — إضافة عميل يدوياً
// ==========================================
router.post('/', (req, res) => {
  try {
    const { name, phone, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'اسم العميل مطلوب' });

    const existing = db.prepare(`SELECT id FROM customers WHERE name = ?`).get(name.trim());
    if (existing) return res.status(400).json({ success: false, message: 'هذا العميل مسجل بالفعل' });

    const result = db.prepare(`
      INSERT INTO customers (name, phone, notes) VALUES (?, ?, ?)
    `).run(name.trim(), phone ? phone.trim() : null, notes || null);

    const newCust = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newCust, message: 'تمت إضافة العميل بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// DELETE /api/customers/:id — حذف عميل
// ==========================================
router.delete('/:id', (req, res) => {
  try {
    const cust = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
    if (!cust) return res.status(404).json({ success: false, message: 'العميل غير موجود' });

    db.prepare(`DELETE FROM customers WHERE id = ?`).run(req.params.id);
    res.json({ success: true, message: 'تم حذف العميل بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
