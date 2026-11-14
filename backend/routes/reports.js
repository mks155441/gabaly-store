const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ==========================================
// GET /api/reports/dashboard — لوحة التحكم
// ==========================================
router.get('/dashboard', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const minStock = parseInt(db.prepare(`SELECT value FROM settings WHERE key='min_stock_quantity'`).get()?.value || 5);

    // مبيعات اليوم
    const todaySales = db.prepare(`
      SELECT COALESCE(SUM(paid_amount), 0) AS total FROM sale_invoices WHERE date = ?
    `).get(today);

    // مبيعات الشهر الحالي
    const thisMonth = today.slice(0, 7);
    const monthSales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total FROM sale_invoices WHERE date LIKE ?
    `).get(`${thisMonth}%`);

    // الشهر اللي فات
    const lastMonthDate  = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonth      = lastMonthDate.toISOString().slice(0, 7);
    const lastMonthSales = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total FROM sale_invoices WHERE date LIKE ?
    `).get(`${lastMonth}%`);

    // منتجات منخفضة المخزن
    const lowStockProducts = db.prepare(`
      SELECT id, code, name, current_quantity FROM products WHERE current_quantity <= ?
    `).all(minStock);

    // الديون (فواتير بيع غير مدفوعة أو جزئية)
    const pendingSales = db.prepare(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total_amount - paid_amount), 0) AS amount
      FROM sale_invoices WHERE status IN ('unpaid','partial')
    `).get();

    // الديون على الموردين (فواتير شراء غير مدفوعة أو جزئية)
    const pendingPurchases = db.prepare(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total_amount - paid_amount), 0) AS amount
      FROM purchase_invoices WHERE status IN ('unpaid','partial')
    `).get();

    // قيمة المخزن الحالي
    // قيمة المخزن الحالي وإجمالي أزواج الأحذية
    const stockStats = db.prepare(`
      SELECT COALESCE(SUM(current_quantity * wholesale_price), 0) AS total_val,
             COALESCE(SUM(current_quantity), 0) AS total_pairs
      FROM products
    `).get();

    // مبيعات آخر 14 يوم للرسم البياني الحديث (Climate Index style)
    const dailyActivity = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'short' }).format(d);
      const row = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM sale_invoices WHERE date = ?`).get(dateStr);
      dailyActivity.push({
        date: dateStr,
        day: dayName,
        amount: row ? row.total : 0
      });
    }

    // حركة الأصناف الأبرز في المخزن (Plastic Recycling by Region style table)
    const topProducts = db.prepare(`
      SELECT p.id, p.code, p.name, p.image_path, p.current_quantity, p.selling_price,
             COALESCE(SUM(sii.quantity), 0) AS sold_qty,
             COALESCE(SUM(sii.total), 0) AS total_revenue
      FROM products p
      LEFT JOIN sale_invoice_items sii ON p.id = sii.product_id
      GROUP BY p.id
      ORDER BY sold_qty DESC, p.current_quantity DESC
      LIMIT 5
    `).all();

    res.json({
      success: true,
      data: {
        today_sales:        todaySales.total,
        this_month_sales:   monthSales.total,
        last_month_sales:   lastMonthSales.total,
        low_stock_products: lowStockProducts,
        pending_sales:      pendingSales,
        pending_purchases:  pendingPurchases,
        debt_for_us:        pendingSales,     // دين ليا (على العملاء)
        debt_on_us:         pendingPurchases, // دين عليا (للموردين)
        stock_value:        stockStats.total_val,
        stock_pairs:        stockStats.total_pairs,
        daily_activity:     dailyActivity,
        top_products:       topProducts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GET /api/reports/profit — تقرير الجرد والأرباح
// ==========================================
router.get('/profit', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ success: false, message: 'من فضلك حدد الفترة (from & to)' });

    // إجمالي المبيعات وعدد الفواتير
    const salesStats = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS invoices_count
      FROM sale_invoices WHERE date BETWEEN ? AND ?
    `).get(from, to);

    // إجمالي التكلفة وعدد القطع المباعة
    const costStats = db.prepare(`
      SELECT
        COALESCE(SUM(sii.quantity * sii.wholesale_price), 0) AS total,
        COALESCE(SUM(sii.quantity), 0) AS items_sold_count
      FROM sale_invoice_items sii
      JOIN sale_invoices si ON sii.invoice_id = si.id
      WHERE si.date BETWEEN ? AND ?
    `).get(from, to);

    // إجمالي المشتريات
    const purchasesTotal = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS total FROM purchase_invoices WHERE date BETWEEN ? AND ?
    `).get(from, to);

    // المصروفات اليدوية في الفترة
    const manualExpenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM financial_transactions
      WHERE type = 'expense' AND source = 'manual' AND date BETWEEN ? AND ?
    `).get(from, to);

    // قيمة ورصيد المخزن الحالي كجرد فعلي
    const stockStats = db.prepare(`
      SELECT
        COALESCE(SUM(current_quantity * wholesale_price), 0) AS total_value,
        COALESCE(SUM(current_quantity), 0) AS total_pairs
      FROM products
    `).get();

    // صافي الربح
    const grossProfit = salesStats.total - costStats.total;
    const netProfit   = grossProfit - manualExpenses.total;

    // تفاصيل المبيعات لكل منتج
    const productBreakdown = db.prepare(`
      SELECT
        p.id, p.code, p.name, p.image_path, p.current_quantity,
        SUM(sii.quantity)                         AS total_qty,
        SUM(sii.quantity * sii.unit_price)        AS total_revenue,
        SUM(sii.quantity * sii.wholesale_price)   AS total_cost,
        SUM(sii.quantity * (sii.unit_price - sii.wholesale_price)) AS profit
      FROM sale_invoice_items sii
      JOIN sale_invoices si  ON sii.invoice_id = si.id
      JOIN products p        ON sii.product_id = p.id
      WHERE si.date BETWEEN ? AND ?
      GROUP BY p.id
      ORDER BY profit DESC
    `).all(from, to);

    res.json({
      success: true,
      period: { from, to },
      data: {
        total_sales:          salesStats.total,
        invoices_count:       salesStats.invoices_count,
        items_sold_count:     costStats.items_sold_count,
        total_cost:           costStats.total,
        total_purchases:      purchasesTotal.total,
        manual_expenses:      manualExpenses.total,
        gross_profit:         grossProfit,
        net_profit:           netProfit,
        current_stock_value:  stockStats.total_value,
        current_stock_pairs:  stockStats.total_pairs,
        product_breakdown:    productBreakdown
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// GET /api/reports/settings — الإعدادات
// ==========================================
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM settings`).all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// PUT /api/reports/settings — تحديث إعداد
// ==========================================
router.put('/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ success: false, message: 'key و value مطلوبان' });

    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, String(value));
    res.json({ success: true, message: 'تم تحديث الإعداد بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
