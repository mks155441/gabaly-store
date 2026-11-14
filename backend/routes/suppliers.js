const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ==========================================
// GET /api/suppliers — كل الموردين
// ==========================================
router.get('/', (req, res) => {
  try {
    const suppliers = db.prepare(`SELECT * FROM suppliers ORDER BY name ASC`).all();
    res.json({ success: true, data: suppliers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// POST /api/suppliers — إضافة مورد
// ==========================================
router.post('/', (req, res) => {
  try {
    const { name, phone, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'اسم المورد مطلوب' });

    const result = db.prepare(`
      INSERT INTO suppliers (name, phone, notes) VALUES (?, ?, ?)
    `).run(name.trim(), phone || null, notes || null);

    const newSupplier = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newSupplier, message: 'تم إضافة المورد بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PUT /api/suppliers/:id — تعديل مورد
// ==========================================
router.put('/:id', (req, res) => {
  try {
    const { name, phone, notes } = req.body;
    const existing = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'المورد غير موجود' });

    db.prepare(`
      UPDATE suppliers SET name = ?, phone = ?, notes = ? WHERE id = ?
    `).run(name?.trim() || existing.name, phone ?? existing.phone, notes ?? existing.notes, req.params.id);

    const updated = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(req.params.id);
    res.json({ success: true, data: updated, message: 'تم تعديل المورد بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// DELETE /api/suppliers/:id — حذف مورد
// ==========================================
router.delete('/:id', (req, res) => {
  try {
    const inUse = db.prepare(`SELECT COUNT(*) as c FROM purchase_invoices WHERE supplier_id = ?`).get(req.params.id);
    if (inUse.c > 0) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف المورد لأنه مستخدم في فواتير' });
    }
    db.prepare(`DELETE FROM suppliers WHERE id = ?`).run(req.params.id);
    res.json({ success: true, message: 'تم حذف المورد بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
