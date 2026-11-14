import React, { useEffect, useState } from 'react';
import { getFinance, createTransaction, deleteTransaction } from '../api';
import {
  TrendingUpIcon,
  TrendingDownIcon,
  BarChartIcon,
  WalletIcon,
  TrashIcon,
  CloseIcon,
  PlusIcon
} from '../components/Icons';

// عرض الأرقام الصحيحة بالإنجليزية بدون كسور
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

const EXPENSE_CATS = ['مشتريات بضاعة', 'إيجار', 'رواتب', 'كهرباء', 'مياه', 'مصروفات متنوعة'];
const INCOME_CATS  = ['مبيعات', 'إيراد آخر'];

export default function Finance() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary]           = useState({});
  const [loading, setLoading]           = useState(true);
  const [filters, setFilters]           = useState({ from: '', to: '', type: '', category: '' });
  const [modal, setModal]               = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const today = new Date().toISOString().split('T')[0];
  const emptyForm = { date: today, type: 'expense', category: '', amount: '', description: '' };
  const [form, setForm] = useState(emptyForm);

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.from)     params.from     = filters.from;
    if (filters.to)       params.to       = filters.to;
    if (filters.type)     params.type     = filters.type;
    if (filters.category) params.category = filters.category;
    getFinance(params)
      .then(res => { setTransactions(res.data.data); setSummary(res.data.summary); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [filters]);

  const handleSave = async () => {
    setError('');
    if (!form.date)     return setError('التاريخ مطلوب');
    if (!form.category) return setError('الفئة مطلوبة');
    if (!form.amount || parseFloat(form.amount) <= 0) return setError('المبلغ مطلوب');
    setSaving(true);
    try {
      await createTransaction(form);
      setModal(false); setForm(emptyForm); load();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    } finally { setSaving(false); }
  };

  const handleDelete = async (tx) => {
    if (!window.confirm('هل تريد حذف هذه الحركة؟')) return;
    try {
      await deleteTransaction(tx.id);
      load();
    } catch (err) { alert(err.response?.data?.message || 'حدث خطأ'); }
  };

  const cats = form.type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">الأموال والمصروفات</h1>
        <button className="btn btn-primary" onClick={() => { setError(''); setForm(emptyForm); setModal(true); }}>
          + تسجيل حركة مالية
        </button>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card emerald">
          <div className="stat-info">
            <div className="stat-label">إجمالي الإيرادات</div>
            <div className="stat-value">{fmt(summary.total_income)} <span className="stat-currency">ج</span></div>
          </div>
          <div className="stat-icon-box">
            <TrendingUpIcon size={24} color="#ffffff" />
          </div>
        </div>

        <div className="stat-card red">
          <div className="stat-info">
            <div className="stat-label">إجمالي المصروفات</div>
            <div className="stat-value">{fmt(summary.total_expense)} <span className="stat-currency">ج</span></div>
          </div>
          <div className="stat-icon-box">
            <TrendingDownIcon size={24} color="#ffffff" />
          </div>
        </div>

        <div className={`stat-card ${(summary.net || 0) >= 0 ? 'emerald' : 'red'}`}>
          <div className="stat-info">
            <div className="stat-label">صافي الأرباح</div>
            <div className="stat-value">
              {fmt(summary.net)} <span className="stat-currency">ج</span>
            </div>
          </div>
          <div className="stat-icon-box">
            <BarChartIcon size={24} color="#ffffff" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">من تاريخ</label>
            <input type="date" className="form-control" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">إلى تاريخ</label>
            <input type="date" className="form-control" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">النوع</label>
            <select className="form-control" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
              <option value="">الكل</option>
              <option value="income">إيرادات</option>
              <option value="expense">مصروفات</option>
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => setFilters({ from: '', to: '', type: '', category: '' })}>إعادة تعيين</button>
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="loading">جاري التحميل...</div> :
       transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <WalletIcon size={44} color="#94a3b8" />
          </div>
          <p>لا يوجد حركات مالية</p>
        </div>
       ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>الفئة</th>
                <th>البيان</th>
                <th>المبلغ</th>
                <th>المصدر</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td>{tx.date}</td>
                  <td>
                    <span className={`badge ${tx.type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                      {tx.type === 'income' ? 'إيراد' : 'مصروف'}
                    </span>
                  </td>
                  <td>{tx.category}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.description || <span style={{ color: '#bbb' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 700, color: tx.type === 'income' ? '#2e7d32' : '#c62828' }}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)} ج
                  </td>
                  <td>
                    <span className={`badge ${tx.source === 'auto' ? 'badge-info' : 'badge-warning'}`}>
                      {tx.source === 'auto' ? 'تلقائي' : 'يدوي'}
                    </span>
                  </td>
                  <td>
                    {tx.source === 'manual'
                      ? <button className="btn btn-danger btn-sm" title="حذف" onClick={() => handleDelete(tx)}><TrashIcon size={14} /></button>
                      : <span style={{ fontSize: 12, color: '#bbb' }}>محمي</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <span className="modal-title">+ تسجيل حركة مالية</span>
              <button className="modal-close" onClick={() => setModal(false)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">التاريخ *</label>
                  <input type="date" className="form-control" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">النوع *</label>
                  <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                    <option value="expense">مصروف</option>
                    <option value="income">إيراد</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">الفئة *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="اكتب الفئة بحرية (مثال: إيجار، كهرباء، صيانة، رواتب، مصاريف نقل...)"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  {cats.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">المبلغ (ج) *</label>
                <input type="number" className="form-control" placeholder="0"
                  value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">البيان (بتاع إيه؟)</label>
                <input className="form-control" placeholder="مثال: إيجار شهر أكتوبر"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'تسجيل الحركة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
