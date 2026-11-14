import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../api';
import {
  BellIcon,
  BoltIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  BarChartIcon,
  PackageIcon,
  WalletIcon
} from '../components/Icons';

const API_URL = window.location.origin.includes(':3000') ? 'http://localhost:5000' : '';
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading" style={{ paddingTop: 80 }}>
        <div>جاري تحميل لوحة التحكم...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="alert alert-error" style={{ margin: 20 }}>
        فشل تحميل بيانات لوحة التحكم
      </div>
    );
  }

  // حساب أقصى قيمة مبيعات في الأيام لرسم المخطط البياني النسبي
  const maxDaily = Math.max(...(data.daily_activity || []).map(d => d.amount), 100);

  return (
    <div>
      {/* ========================================================
          Top Header Bar (مستوحى من هيدر AeuxGlobal)
          ======================================================== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">لوحة التحكم</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            {new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}
          </p>
        </div>

        <div className="page-header-actions">
          {/* Notification Button */}
          <button className="icon-btn-round" title="التنبيهات">
            <BellIcon size={18} />
            {data.low_stock_products?.length > 0 && <span className="icon-btn-dot"></span>}
          </button>

          {/* Primary Dark Pill Button */}
          <Link to="/sales" className="btn btn-dark" style={{ textDecoration: 'none', gap: 8 }}>
            <BoltIcon size={16} color="#10b981" />
            <span>نقطة بيع سريعة (الكاشير)</span>
          </Link>
        </div>
      </div>

      {/* ========================================================
          الصف الأول: 4 بطاقات ومؤشرات رئيسية ملونة بالكامل بدون أي درجات أبيض
          ======================================================== */}
      <div className="dashboard-metrics-grid">
        {/* كارت 1: مبيعات اليوم (داكن فخم) */}
        <div className="widget-card-dark">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="widget-label-dark">مبيعات اليوم</div>
              <div className="widget-value-dark">
                <span>{fmt(data.today_sales)}</span>
                <span className="widget-currency-dark">ج</span>
              </div>
            </div>
            <div className="stat-icon-box" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)' }}>
              <TrendingUpIcon size={20} color="#10b981" />
            </div>
          </div>

          <div className="widget-chart-row">
            <span className="widget-pill-growth">
              <TrendingUpIcon size={14} color="#10b981" />
              <span>نشاط اليوم المباشر</span>
            </span>

            {/* أعمدة مصغرة خضراء */}
            <div className="mini-bars">
              <span className="mini-bar" style={{ height: '35%' }}></span>
              <span className="mini-bar" style={{ height: '60%' }}></span>
              <span className="mini-bar" style={{ height: '40%' }}></span>
              <span className="mini-bar" style={{ height: '95%' }}></span>
              <span className="mini-bar" style={{ height: '75%' }}></span>
            </div>
          </div>
        </div>

        {/* كارت 2: مبيعات هذا الشهر (أزرق ياقوتي صريح) */}
        <div className="widget-card-blue">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="widget-label-white">مبيعات هذا الشهر</div>
              <div className="widget-value-white">
                <span>{fmt(data.this_month_sales)}</span>
                <span className="widget-currency-white">ج</span>
              </div>
            </div>
            <div className="stat-icon-box" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)' }}>
              <BarChartIcon size={20} color="#ffffff" />
            </div>
          </div>

          <div className="widget-chart-row">
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.9)' }}>
              الشهر السابق: <strong style={{ color: '#ffffff' }}>{fmt(data.last_month_sales)} ج</strong>
            </span>

            {/* مؤشر أعمدة مصغرة */}
            <div className="mini-bars mini-bars-muted">
              <span className="mini-bar" style={{ height: '40%' }}></span>
              <span className="mini-bar" style={{ height: '70%' }}></span>
              <span className="mini-bar" style={{ height: '55%' }}></span>
              <span className="mini-bar" style={{ height: '85%' }}></span>
            </div>
          </div>
        </div>

        {/* كارت 3: إجمالي قيمة بضاعة المخزن (زمردي ملكي صريح) */}
        <div className="widget-card-emerald">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="widget-label-white">إجمالي قيمة بضاعة المخزن</div>
              <div className="widget-value-white">
                <span>{fmt(data.stock_value)}</span>
                <span className="widget-currency-white">ج</span>
              </div>
            </div>
            <div className="stat-icon-box" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)' }}>
              <PackageIcon size={20} color="#ffffff" />
            </div>
          </div>

          <div className="widget-chart-row">
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.95)', fontWeight: 600 }}>
              {fmt(data.stock_pairs || 0)} زوج حذاء جاهز بالمخزن
            </span>

            {/* مؤشر أعمدة خضراء */}
            <div className="mini-bars mini-bars-emerald">
              <span className="mini-bar" style={{ height: '30%' }}></span>
              <span className="mini-bar" style={{ height: '50%' }}></span>
              <span className="mini-bar" style={{ height: '75%' }}></span>
              <span className="mini-bar" style={{ height: '100%' }}></span>
            </div>
          </div>
        </div>

        {/* كارت 4: حسابات المستحقات والديون (داكن كحلي فاخر) */}
        <div className="widget-card-slate">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="widget-label-mint">حسابات المستحقات والديون</div>
              <div className="widget-value-mint">
                <span>{fmt(data.debt_for_us?.amount)}</span>
                <span style={{ fontSize: 16, color: '#38bdf8', fontWeight: 600 }}>ج</span>
                <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginRight: 6 }}>دين لينا</span>
              </div>
            </div>
            <div className="stat-icon-box" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)' }}>
              <WalletIcon size={20} color="#38bdf8" />
            </div>
          </div>

          <div>
            <div className="widget-breakdown-row">
              <div className="breakdown-dot green"></div>
              <div className="breakdown-text">
                <span>فلوس لينا (على العملاء)</span>
                <strong style={{ color: '#4ade80' }}>{fmt(data.debt_for_us?.amount)} ج ({data.debt_for_us?.count || 0})</strong>
              </div>
            </div>

            <div className="widget-breakdown-row" style={{ marginTop: 6 }}>
              <div className="breakdown-dot red"></div>
              <div className="breakdown-text">
                <span>فلوس علينا (للموردين)</span>
                <strong style={{ color: '#f87171' }}>{fmt(data.debt_on_us?.amount)} ج ({data.debt_on_us?.count || 0})</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          الصف الثاني: رسم النشاط البياني + جدول الأصناف الأكثر حركة
          ======================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 20, marginBottom: 22 }}>
        {/* مخطط بياني لحركة المبيعات (Climate Change Index Style) */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>حركة ونشاط المبيعات اليومية</h3>
              <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>توزيع إيرادات المبيعات على مدار آخر 14 يوم</p>
            </div>
            <span style={{ background: '#0f172a', color: '#fff', padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              آخر 14 يوم ▾
            </span>
          </div>

          {/* حاوية الرسم البياني بالأعمدة */}
          <div style={{ height: 210, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative', paddingTop: 30 }}>
            {/* خط إرشادي مستهدف (Dashed Target Line) */}
            <div style={{ position: 'absolute', top: 50, left: 0, right: 0, borderTop: '1.5px dashed #cbd5e1', zIndex: 1 }}>
              <span style={{ position: 'absolute', top: -18, right: 0, fontSize: 11, color: '#94a3b8', background: '#fff', padding: '0 4px' }}>
                المعدل القياسي
              </span>
            </div>

            {/* الأعمدة البيانية */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 6, zIndex: 2 }}>
              {(data.daily_activity || []).map((item, idx) => {
                const heightPct = item.amount > 0 ? Math.max(Math.round((item.amount / maxDaily) * 100), 14) : 8;
                const isPeak = item.amount > 0 && item.amount === Math.max(...(data.daily_activity || []).map(x => x.amount));

                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    {/* Tooltip Badge on Peak Day (like 82.6 CCI in image) */}
                    {isPeak && (
                      <div style={{ background: '#0f172a', color: '#10b981', padding: '2px 6px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, marginBottom: 4, whiteSpace: 'nowrap' }}>
                        {fmt(item.amount)} ج
                      </div>
                    )}
                    
                    {/* عمود النشاط */}
                    <div
                      title={`${item.date} (${item.day}): ${fmt(item.amount)} ج`}
                      style={{
                        width: '70%',
                        maxWidth: 18,
                        height: `${heightPct}%`,
                        borderRadius: '4px 4px 0 0',
                        background: isPeak
                          ? '#10b981'
                          : item.amount > 0
                          ? '#34d399'
                          : '#e2e8f0',
                        transition: 'all 0.3s'
                      }}
                    />
                    
                    {/* اسم اليوم أسفل العمود */}
                    <span style={{ fontSize: 10, color: isPeak ? '#0f172a' : '#94a3b8', fontWeight: isPeak ? 700 : 500, marginTop: 6, whiteSpace: 'nowrap' }}>
                      {item.day?.replace('ال', '') || item.date?.slice(-2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* جدول حركة الأصناف بالمخزن (Plastic Recycling by Region Style) */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>أصناف المخزن وحركة السحب</h3>
              <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>متابعة حركة المنتجات ومخزونها</p>
            </div>
            <Link to="/products" style={{ fontSize: 12.5, color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
              المخزن بالكامل ↗
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px' }}>الصنف</th>
                  <th style={{ padding: '10px 12px' }}>المخزون</th>
                  <th style={{ padding: '10px 12px' }}>المسار</th>
                  <th style={{ padding: '10px 12px' }}>سعر البيع</th>
                </tr>
              </thead>
              <tbody>
                {(data.top_products || []).map((p) => {
                  const hasStock = p.current_quantity > 0;
                  const isLow = p.current_quantity <= 5;

                  return (
                    <tr key={p.id}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {p.image_path ? (
                            <img
                              src={`${API_URL}${p.image_path}`}
                              alt={p.name}
                              style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0' }}
                            />
                          ) : (
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PackageIcon size={18} color="#94a3b8" />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.code}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span className={`badge ${!hasStock ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`}>
                          {p.current_quantity} زوج
                        </span>
                      </td>

                      {/* Sparkline Curve (SVG مسار موجي مصغر) */}
                      <td style={{ padding: '10px 12px' }}>
                        <svg width="60" height="20" viewBox="0 0 60 20">
                          <path
                            d={hasStock ? "M 2 15 Q 15 5, 30 12 T 58 4" : "M 2 5 Q 15 15, 30 8 T 58 18"}
                            fill="none"
                            stroke={hasStock ? "#10b981" : "#ef4444"}
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </td>

                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                        {fmt(p.selling_price)} ج
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================
          الصف الثالث: النواقص والتنبيهات المباشرة (كارت عنبري فخم بدون أبيض)
          ======================================================== */}
      {data.low_stock_products?.length > 0 && (
        <div
          className="card"
          style={{
            padding: 22,
            background: 'linear-gradient(135deg, #78350f 0%, #9a3412 100%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 10px 25px -4px rgba(154, 52, 18, 0.45)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircleIcon size={22} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', margin: 0 }}>أصناف قاربت على النفاذ بالمخزن (بحاجة لطلب وتزويد)</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '2px 0 0' }}>يوجد {data.low_stock_products.length} أصناف رصيدها قليل جداً</p>
              </div>
            </div>
            <Link to="/purchases" className="btn btn-dark btn-sm" style={{ background: '#0f172a', borderColor: '#334155' }}>
              + عمل فاتورة شراء وتزويد المخزن
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {data.low_stock_products.map(p => (
              <div
                key={p.id}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 12,
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{p.code}</div>
                </div>
                <span className="badge badge-danger" style={{ boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)' }}>
                  {p.current_quantity} متبقي
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
