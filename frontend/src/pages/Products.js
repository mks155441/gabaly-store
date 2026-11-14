import React, { useEffect, useState, useRef } from 'react';
import { getProducts, updateProduct, deleteProduct } from '../api';
import {
  EditIcon,
  TrashIcon,
  PackageIcon,
  CloseIcon,
  CameraIcon,
  SaveIcon,
  DollarIcon,
  LightbulbIcon
} from '../components/Icons';

const API_URL = window.location.origin.includes(':3000') ? 'http://localhost:5000' : '';
// عرض الأسعار كأرقام صحيحة بالإنجليزية بدون كسور عشرية
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  // مودال تعديل الأسعار والمنتج
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState({ name: '', wholesale_price: '', selling_price: '' });
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const fileRef = useRef();

  const load = () => {
    setLoading(true);
    getProducts({ search })
      .then(res => setProducts(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [search]);

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      wholesale_price: p.wholesale_price,
      selling_price: p.selling_price
    });
    setImageFile(null);
    setImagePreview(p.image_path ? `${API_URL}${p.image_path}` : null);
    setError('');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) return setError('اسم المنتج مطلوب');
    if (!form.wholesale_price) return setError('سعر الجملة مطلوب');
    if (!form.selling_price) return setError('سعر البيع مطلوب');

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('wholesale_price', form.wholesale_price);
      fd.append('selling_price', form.selling_price);
      if (imageFile) fd.append('image', imageFile);

      await updateProduct(editing.id, fd);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في تحديث المنتج');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${p.name}" نهائياً من المخزن؟`)) return;
    try {
      await deleteProduct(p.id);
      if (editing && editing.id === p.id) setEditing(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'فشل حذف المنتج');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">المخزن والمنتجات</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            معرض الأحذية بالمخزن — اضغط على أي كارت لتحديث أسعار البيع والتكلفة
          </p>
        </div>

        <div className="page-header-actions">
          <span className="badge badge-dark" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', fontSize: 13 }}>
            <PackageIcon size={16} />
            <span>{products.length} صنف مسجل بالمخزن</span>
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 22 }}>
        <input
          className="search-input"
          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 15, padding: '4px 8px' }}
          placeholder="ابحث عن حذاء بالاسم أو كود SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Grid of Minimal Cards */}
      {loading ? (
        <div className="loading">جاري تحميل المنتجات...</div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <PackageIcon size={44} color="#94a3b8" />
          </div>
          <p>لا توجد منتجات مطابقة في المخزن</p>
        </div>
      ) : (
        <div className="product-grid">
          {products.map(p => (
            <div
              key={p.id}
              className="product-card"
            >
              {/* صورة المنتج كاملة ونقية 100% بدون أي أوفرلاي */}
              <div className="product-card-img-wrapper" onClick={() => openEdit(p)} style={{ cursor: 'pointer' }}>
                {p.image_path ? (
                  <img src={`${API_URL}${p.image_path}`} alt={p.name} className="product-card-img" />
                ) : (
                  <div className="product-card-placeholder">
                    <PackageIcon size={48} color="#cbd5e1" />
                  </div>
                )}
              </div>

              {/* تفاصيل المنتج: الاسم، سعر البيع، وأزرار التحكم بالأسفل */}
              <div className="product-card-body">
                <div className="product-card-title" title={p.name}>
                  {p.name}
                </div>

                <div className="product-price-pill">
                  {fmt(p.selling_price)} ج
                </div>

                {/* أزرار الإجراءات أسفل الصورة والسعر بدون أي تغطية على الصورة */}
                <div className="product-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEdit(p)}
                    title="تعديل سعر الجملة أو سعر البيع"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <EditIcon size={14} />
                    <span>تعديل السعر</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    style={{ flex: '0 0 42px', padding: '6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => handleDelete(p)}
                    title="حذف المنتج نهائياً من المخزن"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================
          MODAL: تعديل سعر الجملة وسعر البيع
          ======================================================== */}
      {editing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <EditIcon size={18} color="#0284c7" />
                <span className="modal-title">تعديل بيانات المنتج: {editing.name}</span>
              </div>
              <button className="modal-close" onClick={() => setEditing(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label className="form-label">اسم المنتج</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    سعر الجملة (التكلفة) *
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.wholesale_price}
                    onChange={e => setForm({ ...form, wholesale_price: e.target.value })}
                  />
                  <small style={{ color: '#64748b', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <LightbulbIcon size={13} color="#d97706" />
                    <span>السعر الجديد سيطبق على فواتير الشراء والبيع الجديدة فقط</span>
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">سعر البيع للجمهور *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.selling_price}
                    onChange={e => setForm({ ...form, selling_price: e.target.value })}
                  />
                </div>
              </div>

              {/* هامش الربح المحسوب */}
              {form.wholesale_price && form.selling_price && (
                <div className="alert alert-success" style={{ margin: '8px 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarIcon size={16} color="#059669" />
                  <span>هامش الربح المتوقع للقطعة: <strong>{fmt(parseFloat(form.selling_price) - parseFloat(form.wholesale_price))} ج</strong></span>
                </div>
              )}

              {/* تغيير الصورة */}
              <div className="form-group">
                <label className="form-label">صورة المنتج</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #eee' }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 8, background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PackageIcon size={28} color="#94a3b8" />
                    </div>
                  )}
                  <div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CameraIcon size={16} />
                      <span>تغيير الصورة</span>
                    </button>
                    <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(editing)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <TrashIcon size={15} />
                <span>حذف هذا المنتج</span>
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>إلغاء</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <SaveIcon size={16} />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ وتحديث الأسعار'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
