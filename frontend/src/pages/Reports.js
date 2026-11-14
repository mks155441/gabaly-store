import React, { useState } from 'react';
import { getProfitReport } from '../api';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  BarChartIcon,
  ShoppingBagIcon,
  CalendarIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  PackageIcon
} from '../components/Icons';

const API_URL = window.location.origin.includes(':3000') ? 'http://localhost:5000' : '';
// عرض الأرقام الصحيحة بالإنجليزية بدون كسور
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

export default function Reports() {
  const today     = new Date().toISOString().split('T')[0];
  const firstDay  = today.slice(0, 7) + '-01';
  const [from, setFrom]     = useState(firstDay);
  const [to, setTo]         = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const load = async () => {
    if (!from || !to) return setError('حدد الفترة من وإلى');
    setError('');
    setLoading(true);
    try {
      const res = await getProfitReport(from, to);
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في تحميل التقرير');
    } finally {
      setLoading(false);
    }
  };

  // فترات سريعة
  const setQuickPeriod = (type) => {
    const now = new Date();
    if (type === 'today') {
      setFrom(today);
      setTo(today);
    } else if (type === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      setFrom(weekAgo.toISOString().split('T')[0]);
      setTo(today);
    } else if (type === 'thisMonth') {
      setFrom(today.slice(0, 7) + '-01');
      setTo(today);
    } else if (type === 'lastMonth') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const m = d.toISOString().slice(0, 7);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      setFrom(m + '-01');
      setTo(last);
    } else if (type === 'thisYear') {
      setFrom(today.slice(0, 4) + '-01-01');
      setTo(today);
    }
  };

  // حساب نسبة هامش الربح
  const salesVal = report?.data?.total_sales || 0;
  const netProfitVal = report?.data?.net_profit || 0;
  const profitMargin = salesVal > 0 ? Math.round((netProfitVal / salesVal) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">الجرد</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            جرد مبيعات المحل، تكلفة البضاعة، المصروفات اليومية، وصافي الأرباح الفعلية
          </p>
        </div>
      </div>

      {/* شريط اختيار الفترة السريعة */}
      <div className="card" style={{ marginBottom: 24, padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarIcon size={18} color="#0284c7" />
            <span>حدد الفترة الزمنية للجرد:</span>
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('today')}>اليوم</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('week')}>آخر 7 أيام</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('thisMonth')}>هذا الشهر</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('lastMonth')}>الشهر السابق</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('thisYear')}>من أول السنة</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>من تاريخ</label>
            <input type="date" className="form-control" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
            <label className="form-label" style={{ fontWeight: 700 }}>إلى تاريخ</label>
            <input type="date" className="form-control" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '10px 28px', fontSize: 15, fontWeight: 800, minWidth: 180, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={load}
            disabled={loading}
          >
            <BarChartIcon size={18} color="#ffffff" />
            <span>{loading ? 'جاري احتساب الجرد...' : 'استخراج تقرير الجرد'}</span>
          </button>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 1. HERO NET PROFIT BANNER — كارت ملكي فخم وعميق بدون أي ألوان بيضاء */}
          <div
            style={{
              background: netProfitVal >= 0
                ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                : 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: 20,
              padding: '28px 32px',
              boxShadow: netProfitVal >= 0
                ? '0 12px 35px -6px rgba(5, 150, 105, 0.5)'
                : '0 12px 35px -6px rgba(225, 29, 72, 0.5)',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    padding: '6px 16px',
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: 800,
                    marginBottom: 10,
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  {netProfitVal >= 0 ? <CheckCircleIcon size={16} color="#ffffff" /> : <AlertCircleIcon size={16} color="#ffffff" />}
                  <span>{netProfitVal >= 0 ? 'أرباح إيجابية للمحل' : 'عجز / خسارة في الفترة'}</span>
                </span>
                <div style={{ fontSize: 18, color: '#ffffff', fontWeight: 800, marginBottom: 4 }}>
                  صافي أرباح المحل الفعلية الحقيقية
                </div>
                <div style={{ fontSize: 13.5, color: 'rgba(255, 255, 255, 0.85)' }}>
                  الفترة من <strong style={{ color: '#ffffff' }}>{report.period.from}</strong> إلى <strong style={{ color: '#ffffff' }}>{report.period.to}</strong>
                </div>
              </div>

              <div style={{ textAlign: 'left', minWidth: 220 }}>
                <div
                  style={{
                    fontSize: 50,
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1,
                    letterSpacing: -1,
                    textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  {fmt(netProfitVal)} <span style={{ fontSize: 24, fontWeight: 700 }}>ج</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
                  نسبة هامش الربح الصافي: <span style={{ fontWeight: 800, color: '#ffffff' }}>{profitMargin}%</span> من المبيعات
                </div>
              </div>
            </div>

            {/* معادلة الحساب الشفافة ذات التباين العالي */}
            <div
              style={{
                marginTop: 22,
                padding: '14px 20px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 13.5,
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.9)'
              }}
            >
              <span>المبيعات: <strong style={{ color: '#38bdf8' }}>{fmt(report.data.total_sales)} ج</strong></span>
              <span>−</span>
              <span>تكلفة البضاعة: <strong style={{ color: '#fca5a5' }}>{fmt(report.data.total_cost)} ج</strong></span>
              <span>=</span>
              <span>مجمل الربح: <strong style={{ color: '#86efac' }}>{fmt(report.data.gross_profit)} ج</strong></span>
              <span>−</span>
              <span>المصروفات: <strong style={{ color: '#fde047' }}>{fmt(report.data.manual_expenses)} ج</strong></span>
              <span>=</span>
              <span>الصافي: <strong style={{ color: '#ffffff' }}>{fmt(netProfitVal)} ج</strong></span>
            </div>
          </div>

          {/* 2. بطاقات التفاصيل المالية الأربعة — كل عنصر بلون ومعبر */}
          <div className="stats-grid">
            <div className="stat-card emerald">
              <div className="stat-info">
                <div className="stat-label">إجمالي المبيعات (دخل المحل)</div>
                <div className="stat-value">{fmt(report.data.total_sales)} <span className="stat-currency">ج</span></div>
                <div style={{ fontSize: 12, color: '#15803d', marginTop: 4 }}>
                  {report.data.invoices_count || 0} فاتورة ({report.data.items_sold_count || 0} زوج حذاء)
                </div>
              </div>
              <div className="stat-icon-box">
                <TrendingUpIcon size={24} color="#ffffff" />
              </div>
            </div>

            <div className="stat-card red">
              <div className="stat-info">
                <div className="stat-label">تكلفة البضاعة (رأس المال)</div>
                <div className="stat-value">{fmt(report.data.total_cost)} <span className="stat-currency">ج</span></div>
                <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>
                  سعر شراء وجملة الأحذية المباعة
                </div>
              </div>
              <div className="stat-icon-box">
                <ShoppingBagIcon size={24} color="#ffffff" />
              </div>
            </div>

            <div className="stat-card blue">
              <div className="stat-info">
                <div className="stat-label">مجمل ربح المبيعات</div>
                <div className="stat-value">{fmt(report.data.gross_profit)} <span className="stat-currency">ج</span></div>
                <div style={{ fontSize: 12, color: '#0369a1', marginTop: 4 }}>
                  الفارق المباشر بين البيع والجملة
                </div>
              </div>
              <div className="stat-icon-box">
                <BarChartIcon size={24} color="#ffffff" />
              </div>
            </div>

            <div className="stat-card amber">
              <div className="stat-info">
                <div className="stat-label">المصروفات التشغيلية</div>
                <div className="stat-value">{fmt(report.data.manual_expenses)} <span className="stat-currency">ج</span></div>
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>
                  إيجار، كهرباء، عمالة، ومصروفات نثرية
                </div>
              </div>
              <div className="stat-icon-box">
                <TrendingDownIcon size={24} color="#ffffff" />
              </div>
            </div>
          </div>

          {/* 3. بطاقة حالة المخزن الفعلي في المحل حالياً (كارت كحلي فاخر) */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 18,
              padding: '22px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 18,
              boxShadow: '0 10px 25px -4px rgba(15, 23, 42, 0.5)',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PackageIcon size={22} color="#38bdf8" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16.5, color: '#ffffff', marginBottom: 3 }}>
                  جرد بضاعة المحل الحالية في المخزن
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' }}>
                  إجمالي قيمة البضاعة ورصيد الأزواج المتوفرة بالمحل في هذه اللحظة
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 2 }}>إجمالي قيمة بضاعة المخزن</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>{fmt(report.data.current_stock_value)} ج</div>
              </div>
              <div style={{ width: 1, height: 42, background: 'rgba(255, 255, 255, 0.15)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 2 }}>الأحذية المتوفرة بالمخزن</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8' }}>{report.data.current_stock_pairs || 0} قطعة</div>
              </div>
              <div style={{ width: 1, height: 42, background: 'rgba(255, 255, 255, 0.15)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 2 }}>مشتريات جديدة في الفترة</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#e2e8f0' }}>{fmt(report.data.total_purchases)} ج</div>
              </div>
            </div>
          </div>

          {/* 4. تفاصيل مبيعات الأصناف — جدول فخم وواسع */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontWeight: 800, fontSize: 17, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChartIcon size={20} color="#0284c7" />
                <span>تفاصيل مبيعات وأرباح كل صنف خلال الفترة ({report.data.product_breakdown?.length || 0})</span>
              </h3>
            </div>

            {report.data.product_breakdown?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                لا توجد مبيعات لأي صنف خلال هذه الفترة المحددة
              </div>
            ) : (
              <div className="table-wrapper" style={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <table style={{ fontSize: 14 }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ width: 70 }}>الصورة</th>
                      <th>الكود</th>
                      <th>اسم الحذاء</th>
                      <th>الكمية المباعة</th>
                      <th>إجمالي المبيعات</th>
                      <th>إجمالي التكلفة</th>
                      <th>صافي الربح</th>
                      <th>الرصيد المتبقي بالمخزن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.data.product_breakdown.map((p, i) => {
                      const itemMargin = p.total_revenue > 0 ? Math.round((p.profit / p.total_revenue) * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td>
                            {p.image_path ? (
                              <img
                                src={`${API_URL}${p.image_path}`}
                                alt={p.name}
                                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                              />
                            ) : (
                              <div style={{ width: 44, height: 44, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PackageIcon size={20} color="#94a3b8" />
                              </div>
                            )}
                          </td>
                          <td>
                            <code style={{ fontSize: 12, background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                              {p.code}
                            </code>
                          </td>
                          <td style={{ fontWeight: 700, color: '#1e293b' }}>{p.name}</td>
                          <td style={{ fontWeight: 800 }}>{p.total_qty} قطعة</td>
                          <td style={{ fontWeight: 700, color: '#0369a1' }}>{fmt(p.total_revenue)} ج</td>
                          <td style={{ color: '#b91c1c' }}>{fmt(p.total_cost)} ج</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 800, color: p.profit >= 0 ? '#15803d' : '#b91c1c' }}>
                                {fmt(p.profit)} ج
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 12,
                                  background: p.profit >= 0 ? '#dcfce7' : '#fee2e2',
                                  color: p.profit >= 0 ? '#15803d' : '#b91c1c'
                                }}
                              >
                                {itemMargin}%
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: (p.current_quantity || 0) <= 5 ? '#e94560' : '#475569' }}>
                              {p.current_quantity !== undefined ? `${p.current_quantity} قطعة` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="empty-state" style={{ padding: '60px 20px', background: '#fff', borderRadius: 16 }}>
          <div className="empty-icon" style={{ marginBottom: 12 }}>
            <BarChartIcon size={48} color="#94a3b8" />
          </div>
          <h3 style={{ fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>شاشة الجرد وأرباح المحل</h3>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            اختر الفترة الزمنية بالأعلى واضغط على "استخراج تقرير الجرد" لعرض الحسابات التفصيلية والأرباح
          </p>
        </div>
      )}
    </div>
  );
}
