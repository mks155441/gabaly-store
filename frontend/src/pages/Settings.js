import React, { useEffect, useState } from 'react';
import { getSettings, updateSetting, getSuppliers, createSupplier, deleteSupplier } from '../api';
import {
  SettingsIcon,
  PackageIcon,
  TruckIcon,
  SaveIcon,
  CheckIcon,
  TrashIcon,
  PlusIcon
} from '../components/Icons';

export default function Settings() {
  const [minStock, setMinStock]     = useState('');
  const [loadingS, setLoadingS]     = useState(true);
  const [savedS, setSavedS]         = useState(false);
  const [suppliers, setSuppliers]   = useState([]);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', notes: '' });
  const [addingS, setAddingS]       = useState(false);
  const [error, setError]           = useState('');

  const loadSettings = () => {
    getSettings().then(r => { setMinStock(r.data.data.min_stock_quantity || '5'); setLoadingS(false); });
  };
  const loadSuppliers = () => {
    getSuppliers().then(r => setSuppliers(r.data.data));
  };

  useEffect(() => { loadSettings(); loadSuppliers(); }, []);

  const saveMinStock = async () => {
    if (!minStock || parseInt(minStock) < 0) return setError('الحد الأدنى لازم يكون رقم صحيح');
    await updateSetting('min_stock_quantity', minStock);
    setSavedS(true); setTimeout(() => setSavedS(false), 2000);
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name) return setError('اسم المورد مطلوب');
    setError('');
    try {
      await createSupplier(newSupplier);
      setNewSupplier({ name: '', phone: '', notes: '' });
      setAddingS(false);
      loadSuppliers();
    } catch (err) { setError(err.response?.data?.message || 'حدث خطأ'); }
  };

  const handleDeleteSupplier = async (s) => {
    if (!window.confirm(`حذف "${s.name}"؟`)) return;
    try {
      await deleteSupplier(s.id);
      loadSuppliers();
    } catch (err) { alert(err.response?.data?.message || 'حدث خطأ'); }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SettingsIcon size={24} color="#0f172a" />
          <h1 className="page-title"><span>الإعدادات</span></h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* إعدادات المخزن */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PackageIcon size={18} color="#0284c7" />
          <span>إعدادات المخزن</span>
        </h3>
        {loadingS ? <div className="loading">جاري التحميل...</div> : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">الحد الأدنى للمخزن (ينطبق على كل المنتجات)</label>
              <input
                type="number" min={0} className="form-control"
                style={{ maxWidth: 200 }}
                value={minStock}
                onChange={e => setMinStock(e.target.value)}
              />
              <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                لما كمية أي منتج تساوي أو تقل عن هذا الرقم، يظهر تحذير في المخزن ولوحة التحكم.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={saveMinStock}
              style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {savedS ? <CheckIcon size={15} /> : <SaveIcon size={15} />}
              <span>{savedS ? 'تم الحفظ!' : 'حفظ'}</span>
            </button>
          </div>
        )}
      </div>

      {/* إدارة الموردين */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <TruckIcon size={20} color="#059669" />
            <span>إدارة الموردين</span>
          </h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setAddingS(true); setError(''); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <PlusIcon size={14} />
            <span>إضافة مورد</span>
          </button>
        </div>

        {addingS && (
          <div className="card" style={{ background: '#f8f9fb', marginBottom: 16, padding: 16 }}>
            <div className="form-row-3">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">الاسم *</label>
                <input className="form-control" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">التليفون</label>
                <input className="form-control" value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">ملاحظات</label>
                <input className="form-control" value={newSupplier.notes} onChange={e => setNewSupplier({ ...newSupplier, notes: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddSupplier}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CheckIcon size={14} />
                <span>إضافة</span>
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setAddingS(false)}>إلغاء</button>
            </div>
          </div>
        )}

        {suppliers.length === 0 ? (
          <div className="empty-state" style={{ padding: '30px 0' }}>
            <div className="empty-icon">
              <TruckIcon size={44} color="#94a3b8" />
            </div>
            <p>لا يوجد موردين مضافين</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>الاسم</th><th>التليفون</th><th>ملاحظات</th><th>إجراءات</th></tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.phone || <span style={{ color: '#bbb' }}>—</span>}</td>
                  <td>{s.notes || <span style={{ color: '#bbb' }}>—</span>}</td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteSupplier(s)}
                      title="حذف"
                      style={{ padding: '5px 8px' }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
