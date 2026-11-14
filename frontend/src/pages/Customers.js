import React, { useEffect, useState } from 'react';
import { getCustomers, getCustomerInvoices, paySale, markSalePaid } from '../api';
import {
  UsersIcon,
  TrendingUpIcon,
  WalletIcon,
  ReceiptIcon,
  PhoneIcon,
  CheckIcon,
  CloseIcon,
  DollarIcon,
  WhatsAppIcon
} from '../components/Icons';

const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');
const statusLabel = { paid: 'مسددة بالكامل', unpaid: 'آجل بالكامل', partial: 'متبقي على العميل' };
const statusBadge = { paid: 'badge-success', unpaid: 'badge-danger', partial: 'badge-warning' };

// بناء رابط واتساب مع رسالة ديناميكية حسب حالة العميل
const buildWhatsAppUrl = (phone, name, debt) => {
  if (!phone) return null;
  // تنسيق الرقم: إزالة المسافات والأصفار البادئة وإضافة كود مصر
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('0')) cleaned = '2' + cleaned;  // مصر
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;

  let message;
  if (debt > 0) {
    message = `السلام عليكم يا ${name} 👋\nأهلا بيك، حبيت أفكرك إن عليك مبلغ ${Math.round(debt).toLocaleString('en-US')} جنيه متبقي من حسابك عندنا.\nلو تقدر تمر علينا أو تحول المبلغ نكون شاكرين ليك 🙏\nشكرا ليك.`;
  } else {
    message = `السلام عليكم يا ${name} 👋\nأهلا بيك، حسابك عندنا خالص والحمد لله.\nنتمنى نشوفك عندنا قريب 🙏`;
  }

  return `https://wa.me/${cleaned.replace('+', '')}?text=${encodeURIComponent(message)}`;
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  // مودال كشف الحساب
  const [detailModal, setDetailModal] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading]   = useState(false);

  // مودال دفع
  const [payModal, setPayModal]   = useState(null);
  const [payAmount, setPayAmount] = useState('');

  const loadCustomers = () => {
    setLoading(true);
    getCustomers({ search })
      .then(res => {
        setCustomers(res.data.data);
        setSummary(res.data.summary || {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadCustomers, [search]);

  // فتح كشف حساب العميل
  const openCustomerStatement = async (cust) => {
    setDetailModal(cust);
    setInvoicesLoading(true);
    try {
      const res = await getCustomerInvoices(cust.id);
      setCustomerInvoices(res.data.invoices || []);
    } catch (err) {
      alert('فشل تحميل فواتير العميل');
    } finally {
      setInvoicesLoading(false);
    }
  };

  // سداد دفعة على فاتورة من داخل كشف الحساب
  const handlePayInvoice = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return alert('أدخل مبلغ صحيح');
    try {
      await paySale(payModal.id, parseFloat(payAmount));
      setPayModal(null);
      setPayAmount('');
      // تحديث فواتير العميل والقائمة الرئيسية
      if (detailModal) {
        const res = await getCustomerInvoices(detailModal.id);
        setCustomerInvoices(res.data.invoices || []);
      }
      loadCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  // جعل الفاتورة خالصة فوراً
  const handleMarkPaid = async (inv) => {
    if (!window.confirm(`تحويل الفاتورة ${inv.invoice_number} إلى خالصة بالكامل؟`)) return;
    try {
      await markSalePaid(inv.id);
      if (detailModal) {
        const res = await getCustomerInvoices(detailModal.id);
        setCustomerInvoices(res.data.invoices || []);
      }
      loadCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">حسابات العملاء</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            متابعة مستحقات المحل عند الزبائن، ومشترياتهم السابقة وأرقام هواتفهم
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card purple">
          <div className="stat-info">
            <div className="stat-label">إجمالي العملاء</div>
            <div className="stat-value">{summary.total_customers || 0} <span className="stat-currency">عميل</span></div>
          </div>
          <div className="stat-icon-box">
            <UsersIcon size={24} color="#ffffff" />
          </div>
        </div>

        <div className="stat-card emerald">
          <div className="stat-info">
            <div className="stat-label">إجمالي مبيعات العملاء</div>
            <div className="stat-value">
              {fmt(summary.total_sales_to_customers)} <span className="stat-currency">ج</span>
            </div>
          </div>
          <div className="stat-icon-box">
            <TrendingUpIcon size={24} color="#ffffff" />
          </div>
        </div>

        <div className="stat-card blue">
          <div className="stat-info">
            <div className="stat-label">إجمالي فلوس لينا عند العملاء</div>
            <div className="stat-value">
              {fmt(summary.total_debt_on_customers)} <span className="stat-currency">ج</span>
            </div>
          </div>
          <div className="stat-icon-box">
            <WalletIcon size={24} color="#ffffff" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar" style={{ background: '#fff', padding: 14, borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', marginBottom: 20 }}>
        <input
          className="search-input"
          placeholder="ابحث بالاسم أو رقم الموبايل (مثال: أحمد أو 010...)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading">جاري التحميل...</div>
      ) : customers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <UsersIcon size={44} color="#94a3b8" />
          </div>
          <p>لا يوجد عملاء مسجلين حتى الآن</p>
          <p style={{ fontSize: 13, color: '#999', marginTop: 6 }}>
            عند تسجيل اسم أي عميل في فواتير البيع سيظهر تلقائياً هنا في كشف العملاء.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>اسم العميل</th>
                <th>رقم الموبايل</th>
                <th>عدد الفواتير</th>
                <th>إجمالي المشتريات</th>
                <th>المدفوع</th>
                <th>فلوس لينا (المتبقي عليه)</th>
                <th>آخر تعامل</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const hasDebt = c.total_debt > 0;
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.phone ? <code>{c.phone}</code> : <span style={{ color: '#bbb' }}>—</span>}
                        {c.phone && (
                          <a
                            href={buildWhatsAppUrl(c.phone, c.name, c.total_debt)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="تواصل عبر واتساب"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: '#25D366',
                              color: '#ffffff',
                              textDecoration: 'none',
                              transition: 'all 0.2s',
                              flexShrink: 0,
                              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.4)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37, 211, 102, 0.55)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 211, 102, 0.4)'; }}
                          >
                            <WhatsAppIcon size={16} color="#ffffff" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td><span className="badge badge-info">{c.invoice_count} فاتورة</span></td>
                    <td style={{ fontWeight: 600 }}>{fmt(c.total_bought)} ج</td>
                    <td style={{ color: '#2e7d32' }}>{fmt(c.total_paid)} ج</td>
                    <td>
                      {hasDebt ? (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {fmt(c.total_debt)} ج (عليه)
                        </span>
                      ) : (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckIcon size={12} />
                          <span>خالص بالكامل</span>
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: '#666' }}>{c.last_purchase_date || '—'}</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openCustomerStatement(c)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <ReceiptIcon size={14} />
                        <span>كشف الحساب ({c.invoice_count})</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================
          MODAL: كشف حساب العميل وفواتيره
          ======================================================== */}
      {detailModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetailModal(null)}>
          <div className="modal" style={{ maxWidth: 780 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ReceiptIcon size={20} color="#0284c7" />
                <span className="modal-title">كشف حساب العميل: {detailModal.name}</span>
                {detailModal.phone && (
                  <span style={{ marginRight: 10, fontSize: 13, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <PhoneIcon size={14} />
                    <span>{detailModal.phone}</span>
                    <a
                      href={buildWhatsAppUrl(detailModal.phone, detailModal.name, detailModal.total_debt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="تواصل عبر واتساب"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: '#25D366',
                        color: '#ffffff',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(37, 211, 102, 0.4)'
                      }}
                    >
                      <WhatsAppIcon size={14} color="#ffffff" />
                    </a>
                  </span>
                )}
              </div>
              <button className="modal-close" onClick={() => setDetailModal(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              {/* ملخص الحساب */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 12, background: '#f0f4f8', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>إجمالي المشتريات</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(detailModal.total_bought)} ج</div>
                </div>
                <div style={{ padding: 12, background: '#e8f5e9', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#2e7d32' }}>المسدد</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#2e7d32' }}>{fmt(detailModal.total_paid)} ج</div>
                </div>
                <div style={{ padding: 12, background: detailModal.total_debt > 0 ? '#fce4ec' : '#e8f5e9', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: detailModal.total_debt > 0 ? '#c62828' : '#2e7d32' }}>
                    المتبقي عليه (دين ليا)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: detailModal.total_debt > 0 ? '#c62828' : '#2e7d32' }}>
                    {fmt(detailModal.total_debt)} ج
                  </div>
                </div>
              </div>

              {/* جدول الفواتير */}
              <h4 style={{ fontWeight: 700, marginBottom: 12 }}>فواتير العميل:</h4>
              {invoicesLoading ? (
                <div className="loading">⏳ جاري تحميل الفواتير...</div>
              ) : customerInvoices.length === 0 ? (
                <p style={{ color: '#888' }}>لا توجد فواتير مسجلة لهذا العميل</p>
              ) : (
                <div className="table-wrapper" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>رقم الفاتورة</th>
                        <th>التاريخ</th>
                        <th>الإجمالي</th>
                        <th>الخصم</th>
                        <th>المدفوع</th>
                        <th>المتبقي</th>
                        <th>الحالة</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerInvoices.map(inv => {
                        const rem = inv.total_amount - inv.paid_amount;
                        return (
                          <tr key={inv.id}>
                            <td><code>{inv.invoice_number}</code></td>
                            <td>{inv.date}</td>
                            <td style={{ fontWeight: 700 }}>{fmt(inv.total_amount)} ج</td>
                            <td>{inv.discount > 0 ? `${fmt(inv.discount)} ج` : '—'}</td>
                            <td style={{ color: '#2e7d32' }}>{fmt(inv.paid_amount)} ج</td>
                            <td style={{ color: rem > 0 ? '#c62828' : '#2e7d32', fontWeight: 700 }}>
                              {fmt(rem)} ج
                            </td>
                            <td><span className={`badge ${statusBadge[inv.status]}`}>{statusLabel[inv.status]}</span></td>
                            <td>
                              {inv.status !== 'paid' ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => handleMarkPaid(inv)}
                                    title="خالصة"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <CheckIcon size={13} />
                                    <span>خالصة</span>
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => { setPayModal(inv); setPayAmount(''); }}
                                    title="سداد دفعة"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                  >
                                    <DollarIcon size={14} />
                                    <span>سداد</span>
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: '#2e7d32', fontSize: 12, fontWeight: 600 }}>مسددة بالكامل</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailModal(null)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: سداد دفعة على فاتورة
          ======================================================== */}
      {payModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && setPayModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarIcon size={20} color="#059669" />
                <span className="modal-title">تسجيل دفعة من العميل — {payModal.invoice_number}</span>
              </div>
              <button className="modal-close" onClick={() => setPayModal(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, fontSize: 14 }}>
                المتبقي عليه: <strong style={{ color: '#c62828' }}>{fmt(payModal.total_amount - payModal.paid_amount)} ج</strong>
              </p>
              <div className="form-group">
                <label className="form-label">المبلغ المستلم منه الآن (ج) *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPayModal(null)}>إلغاء</button>
              <button className="btn btn-success" onClick={handlePayInvoice} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CheckIcon size={15} />
                <span>تأكيد السداد</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
