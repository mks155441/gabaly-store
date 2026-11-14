const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ==========================================
// GET /api/finance — كل الحركات المالية
// ==========================================
router.get('/', (req, res) => {
  try {
    const { from, to, type, category } = req.query;
    let query  = `SELECT * FROM financial_transactions WHERE 1=1`;
    const params = [];

    if (from)     { query += ` AND date >= ?`;     params.push(from);     }
    if (to)       { query += ` AND date <= ?`;     params.push(to);       }
    if (type)     { query += ` AND type = ?`;      params.push(type);     }
    if (category) { query += ` AND category = ?`;  params.push(category); }

    query += ` ORDER BY date DESC, id DESC`;

    const transactions = db.prepare(query).all(...params);

    // ملخص
    const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    res.json({
      success: true,
      data: transactions,
      summary: {
        total_income:  totalIncome,
        total_expense: totalExpense,
        net:           totalIncome - totalExpense
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// POST /api/finance — إضافة حركة يدوية
// ==========================================
router.post('/', (req, res) => {
  try {
    const { date, type, category, amount, description } = req.body;

    if (!date)        return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    if (!type)        return res.status(400).json({ success: false, message: 'النوع مطلوب (income/expense)' });
    if (!category)    return res.status(400).json({ success: false, message: 'الفئة مطلوبة' });
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'المبلغ مطلوب' });

    const result = db.prepare(`
      INSERT INTO financial_transactions (date, type, category, amount, description, source)
      VALUES (?, ?, ?, ?, ?, 'manual')
    `).run(date, type, category, parseFloat(amount), description || null);

    const newTx = db.prepare(`SELECT * FROM financial_transactions WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newTx, message: 'تم تسجيل الحركة المالية بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// DELETE /api/finance/:id — حذف حركة يدوية فقط
// ==========================================
router.delete('/:id', (req, res) => {
  try {
    const tx = db.prepare(`SELECT * FROM financial_transactions WHERE id = ?`).get(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: 'الحركة غير موجودة' });
    if (tx.source === 'auto') {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف حركة تلقائية مرتبطة بفاتورة' });
    }
    db.prepare(`DELETE FROM financial_transactions WHERE id = ?`).run(req.params.id);
    res.json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
