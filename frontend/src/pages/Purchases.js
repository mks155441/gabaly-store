import React, { useEffect, useState, useRef } from 'react';
import { getPurchases, getPurchase, createPurchase, updatePurchase, deletePurchase, payPurchase, getSuppliers, getProducts, uploadProductImage } from '../api';
import {
  ReceiptIcon,
  ShoppingCartIcon,
  AlertCircleIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  CreditCardIcon,
  CloseIcon,
  CameraIcon,
  DollarIcon,
  CheckIcon,
  SearchIcon
} from '../components/Icons';

const API_URL = window.location.origin.includes(':3000') ? 'http://localhost:5000' : '';
// عرض الأسعار كأرقام صحيحة بالإنجليزية بدون كسور
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');
const statusLabel = { paid: 'مسددة بالكامل', unpaid: 'آجل بالكامل', partial: 'متبقي علينا' };
const statusBadge = { paid: 'badge-success', unpaid: 'badge-danger', partial: 'badge-warning' };

export default function Purchases() {
  const [invoices, setInvoices]   = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({ from: '', to: '', status: '', search: '' });
  
  // Modal إضافة وتعديل فاتورة
  const [modal, setModal]             = useState(false);
  const [editModal, setEditModal]     = useState(false);
  const [editForm, setEditForm]       = useState(null);
  const [editItems, setEditItems]     = useState([]);
  const [editSaving, setEditSaving]   = useState(false);
  const [editError, setEditError]     = useState('');
  
  const [detailModal, setDetailModal] = useState(null);
  const [payModal, setPayModal]       = useState(null);
  const [payAmount, setPayAmount]     = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // صورة الفاتورة الورقية في الإضافة
  const [invoiceImageFile, setInvoiceImageFile] = useState(null);
  const [invoiceImagePreview, setInvoiceImagePreview] = useState(null);
  const invoiceFileRef = useRef();

  // صورة الفاتورة الورقية في التعديل
  const [editInvoiceImageFile, setEditInvoiceImageFile] = useState(null);
  const [editInvoiceImagePreview, setEditInvoiceImagePreview] = useState(null);
  const editInvoiceFileRef = useRef();

  // نافذة معاينة صورة الفاتورة بحجم كبير
  const [previewImageModal, setPreviewImageModal] = useState(null);

  // دالة إنشاء بند فارغ (يدعم صنف مسجل أو صنف جديد بالكامل)
  const createEmptyItem = () => ({
    type: 'existing', // 'existing' أو 'new'
    product_id: '',
    name: '',
    quantity: 1,
    unit_price: '',
    selling_price: '',
    image_path: '',
    image_preview: null,
    uploading_image: false
  });

  // نموذج الفاتورة الجديدة
  const today = new Date().toISOString().split('T')[0];
  const emptyForm = { date: today, supplier_id: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([createEmptyItem()]);
  
  // حقل الدفع البسيط للمورد
  const [paidInput, setPaidInput] = useState('');

  const handleInvoiceImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setInvoiceImageFile(file);
    setInvoiceImagePreview(URL.createObjectURL(file));
  };

  const handleEditInvoiceImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditInvoiceImageFile(file);
    setEditInvoiceImagePreview(URL.createObjectURL(file));
  };

  const loadData = () => {
    setLoading(true);
    const params = {};
    if (filters.from)   params.from   = filters.from;
    if (filters.to)     params.to     = filters.to;
    if (filters.status) params.status = filters.status;
    if (filters.search) params.search = filters.search;

    Promise.all([
      getPurchases(params),
      getSuppliers(),
      getProducts()
    ]).then(([pRes, sRes, prRes]) => {
      setInvoices(pRes.data.data);
      setSuppliers(sRes.data.data);
      setProducts(prRes.data.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadData, [filters]);

  const addItem = () => setItems([...items, createEmptyItem()]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    const newItems = [...items];
    newItems[i] = { ...newItems[i], [field]: val };
    if (field === 'product_id') {
      const p = products.find(prod => prod.id === parseInt(val));
      if (p) {
        newItems[i].unit_price = p.wholesale_price;
        newItems[i].selling_price = p.selling_price;
      }
    }
    setItems(newItems);
  };

  // رفع صورة لصنف جديد بالفاتورة فور اختيارها
  const handleItemImageUpload = async (index, file) => {
    if (!file) return;
    const copy = [...items];
    copy[index].image_preview = URL.createObjectURL(file);
    copy[index].uploading_image = true;
    setItems(copy);

    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await uploadProductImage(fd);
      const updated = [...items];
      updated[index].image_path = res.data.image_path;
      updated[index].uploading_image = false;
      setItems(updated);
    } catch (err) {
      alert('فشل رفع صورة المنتج');
      const updated = [...items];
      updated[index].uploading_image = false;
      setItems(updated);
    }
  };

  const total = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  
  // الحساب التلقائي للمدفوع والمتبقي للمورد
  const actualPaidAmount = paidInput === '' ? total : (parseFloat(paidInput) || 0);
  const calculatedRemaining = Math.max(0, total - actualPaidAmount);

  const openAddModal = () => {
    setError('');
    setForm(emptyForm);
    setItems([createEmptyItem()]);
    setPaidInput(''); // سيأخذ الإجمالي تلقائياً
    setInvoiceImageFile(null);
    setInvoiceImagePreview(null);
    if (invoiceFileRef.current) invoiceFileRef.current.value = '';
    setModal(true);
  };

  // حفظ فاتورة الشراء مع إمكانية إضافة أصناف جديدة كلياً وصورها
  const handleSaveInvoice = async () => {
    setError('');
    if (!form.date) return setError('تاريخ الفاتورة مطلوب');
    
    // التحقق من بنود الفاتورة
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      if (it.type === 'existing') {
        if (!it.product_id) return setError(`البند رقم #${idx + 1}: يرجى اختيار المنتج من المخزن`);
        if (!it.quantity || it.quantity < 1) return setError(`البند رقم #${idx + 1}: يرجى تحديد الكمية المشتراة`);
        if (!it.unit_price) return setError(`البند رقم #${idx + 1}: يرجى تحديد سعر الشراء`);
      } else {
        if (!it.name || !it.name.trim()) return setError(`البند رقم #${idx + 1}: يرجى كتابة اسم الموديل / الحذاء الجديد`);
        if (!it.quantity || it.quantity < 1) return setError(`البند رقم #${idx + 1}: يرجى تحديد الكمية المشتراة`);
        if (!it.unit_price) return setError(`البند رقم #${idx + 1}: يرجى تحديد سعر الشراء (الجملة)`);
        if (!it.selling_price) return setError(`البند رقم #${idx + 1}: يرجى تحديد سعر البيع للجمهور`);
      }
    }

    setSaving(true);
    try {
      let status = 'paid';
      if (actualPaidAmount <= 0) status = 'unpaid';
      else if (actualPaidAmount < total) status = 'partial';

      const itemsPayload = items.map(it => ({
        is_new: it.type === 'new',
        product_id: it.type === 'existing' ? it.product_id : null,
        name: it.type === 'new' ? it.name.trim() : null,
        quantity: parseInt(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
        selling_price: it.type === 'new' ? (parseFloat(it.selling_price) || 0) : null,
        image_path: it.type === 'new' ? (it.image_path || null) : null
      }));

      const fd = new FormData();
      fd.append('date', form.date);
      if (form.supplier_id) fd.append('supplier_id', form.supplier_id);
      fd.append('items', JSON.stringify(itemsPayload));
      fd.append('paid_amount', actualPaidAmount);
      fd.append('status', status);
      if (form.notes) fd.append('notes', form.notes);
      if (invoiceImageFile) fd.append('invoice_image', invoiceImageFile);

      await createPurchase(fd);

      setModal(false);
      setForm(emptyForm);
      setItems([createEmptyItem()]);
      setPaidInput('');
      setInvoiceImageFile(null);
      setInvoiceImagePreview(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في حفظ الفاتورة');
    } finally {
      setSaving(false);
    }
  };

  // تعديل فاتورة شراء
  const openEditPurchase = async (inv) => {
    try {
      const res = await getPurchase(inv.id);
      const data = res.data.data;
      setEditForm({
        id: data.id,
        invoice_number: data.invoice_number,
        date: data.date,
        supplier_id: data.supplier_id || '',
        paid_amount: data.paid_amount || 0,
        status: data.status,
        notes: data.notes || '',
        invoice_image: data.invoice_image || null
      });
      setEditItems(data.items.map(it => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price
      })));
      setEditInvoiceImageFile(null);
      setEditInvoiceImagePreview(data.invoice_image ? `${API_URL}${data.invoice_image}` : null);
      if (editInvoiceFileRef.current) editInvoiceFileRef.current.value = '';
      setEditError('');
      setEditModal(true);
    } catch (err) {
      alert('فشل تحميل الفاتورة للتعديل');
    }
  };

  const handleSaveEditPurchase = async () => {
    setEditError('');
    if (!editForm.date) return setEditError('التاريخ مطلوب');
    if (editItems.some(it => !it.product_id || !it.quantity || !it.unit_price)) {
      return setEditError('أكمل بيانات جميع الأصناف والكميات والأسعار');
    }

    setEditSaving(true);
    try {
      const fd = new FormData();
      fd.append('date', editForm.date);
      if (editForm.supplier_id) fd.append('supplier_id', editForm.supplier_id);
      fd.append('items', JSON.stringify(editItems));
      fd.append('paid_amount', parseFloat(editForm.paid_amount) || 0);
      if (editForm.notes) fd.append('notes', editForm.notes);
      if (editInvoiceImageFile) {
        fd.append('invoice_image', editInvoiceImageFile);
      } else if (editInvoiceImagePreview) {
        fd.append('invoice_image', editForm.invoice_image || '');
      } else {
        fd.append('invoice_image', '');
      }

      await updatePurchase(editForm.id, fd);
      setEditModal(false);
      loadData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'فشل حفظ التعديلات');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePurchase = async (inv) => {
    if (!window.confirm(`هل أنت متأكد من مسح فاتورة الشراء ${inv.invoice_number}؟\nسيتم خصم كميات هذه الفاتورة من المخزن تلقائياً وإلغاء الحركة المالية.`)) return;
    try {
      await deletePurchase(inv.id);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'فشل مسح الفاتورة');
    }
  };

  const handlePay = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return alert('أدخل مبلغ صحيح');
    try {
      await payPurchase(payModal.id, parseFloat(payAmount));
      setPayModal(null);
      setPayAmount('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  const openDetail = (inv) => {
    getPurchase(inv.id).then(r => setDetailModal(r.data.data));
  };

  const totalPurchasesAmount = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalDebtOnUs = invoices.reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"><span>فواتير المشتريات وتزويد المخزن</span></h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            تسجيل البضاعة المشتراة وتحديث أرصدة المخزن وحسابات الموردين
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          + فاتورة شراء جديدة
        </button>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-info">
            <div className="stat-label">عدد الفواتير</div>
            <div className="stat-value">{invoices.length}</div>
          </div>
          <div className="stat-icon-box">
            <ReceiptIcon size={24} color="#ffffff" />
          </div>
        </div>

        <div className="stat-card amber">
          <div className="stat-info">
            <div className="stat-label">إجمالي المشتريات</div>
            <div className="stat-value">
              {fmt(totalPurchasesAmount)} <span className="stat-currency">ج</span>
            </div>
          </div>
          <div className="stat-icon-box">
            <ShoppingCartIcon size={24} color="#ffffff" />
          </div>
        </div>

        <div className="stat-card red">
          <div className="stat-info">
            <div className="stat-label">فلوس علينا (للموردين)</div>
            <div className="stat-value">
              {fmt(totalDebtOnUs)} <span className="stat-currency">ج</span>
            </div>
          </div>
          <div className="stat-icon-box">
            <AlertCircleIcon size={24} color="#ffffff" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 240 }}>
            <label className="form-label" style={{ fontWeight: 600 }}>بحث بالفاتورة أو المورد</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-control"
                placeholder="اكتب رقم الفاتورة أو اسم المورد..."
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
              {filters.search && (
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onClick={() => setFilters({ ...filters, search: '' })}
                  title="مسح البحث"
                >
                  <CloseIcon size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">من تاريخ</label>
            <input type="date" className="form-control" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">إلى تاريخ</label>
            <input type="date" className="form-control" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">حالة الدفع</label>
            <select className="form-control" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
              <option value="">كل الحالات</option>
              <option value="paid">مسددة بالكامل</option>
              <option value="partial">متبقي علينا</option>
              <option value="unpaid">آجل بالكامل</option>
            </select>
          </div>
          <button className="btn btn-secondary" onClick={() => setFilters({ from: '', to: '', status: '', search: '' })}>إعادة تعيين</button>
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="loading">جاري التحميل...</div>
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <ShoppingCartIcon size={44} color="#94a3b8" />
          </div>
          <p>لا توجد فواتير شراء مسجلة</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openAddModal}>
            + تسجيل أول فاتورة شراء
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>رقم الفاتورة</th>
                <th>التاريخ</th>
                <th>المورد</th>
                <th>إجمالي الفاتورة</th>
                <th>المدفوع</th>
                <th>فلوس علينا (المتبقي)</th>
                <th>الحالة</th>
                <th>صورة الفاتورة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const remaining = inv.total_amount - inv.paid_amount;
                return (
                  <tr key={inv.id}>
                    <td><code style={{ fontSize: 12, background: '#f0f2f5', padding: '3px 8px', borderRadius: 4 }}>{inv.invoice_number}</code></td>
                    <td>{inv.date}</td>
                    <td style={{ fontWeight: 600 }}>{inv.supplier_name || <span style={{ color: '#bbb' }}>—</span>}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(inv.total_amount)} ج</td>
                    <td style={{ color: '#2e7d32' }}>{fmt(inv.paid_amount)} ج</td>
                    <td style={{ color: remaining > 0 ? '#c62828' : '#2e7d32', fontWeight: 700 }}>
                      {remaining > 0 ? `${fmt(remaining)} ج` : '0 ج'}
                    </td>
                    <td><span className={`badge ${statusBadge[inv.status]}`}>{statusLabel[inv.status]}</span></td>
                    <td>
                      {inv.invoice_image ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', fontSize: 12, background: '#f8fafc', border: '1px solid #cbd5e1' }}
                          onClick={() => setPreviewImageModal(`${API_URL}${inv.invoice_image}`)}
                          title="معاينة صورة الفاتورة الورقية الأصلية"
                        >
                          <img
                            src={`${API_URL}${inv.invoice_image}`}
                            alt="فاتورة"
                            style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4 }}
                          />
                          <span>معاينة</span>
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                        <button className="btn btn-secondary btn-sm" title="عرض التفاصيل" onClick={() => openDetail(inv)}>
                          <EyeIcon size={14} />
                        </button>
                        <button className="btn btn-secondary btn-sm" title="تعديل فاتورة الشراء" onClick={() => openEditPurchase(inv)}>
                          <EditIcon size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm" title="مسح الفاتورة" onClick={() => handleDeletePurchase(inv)}>
                          <TrashIcon size={14} />
                        </button>
                        {inv.status !== 'paid' && (
                          <button className="btn btn-success btn-sm" onClick={() => { setPayModal(inv); setPayAmount(''); }}>
                            سداد
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================
          MODAL: إضافة فاتورة شراء جديدة (تصميم راقي ومنظم)
          ======================================================== */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div
            className="modal"
            style={{
              width: '95vw',
              maxWidth: 1300,
              height: '92vh',
              borderRadius: 24,
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
            }}
          >
            {/* 1. ترويسة بسيطة ونظيفة */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 28px', borderBottom: '1px solid #edf1f5' }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>فاتورة شراء وتزويد المخزن</h2>
                <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>تسجيل بضاعة جديدة للمخزن وحسابات الموردين</p>
              </div>
              <button className="modal-close" onClick={() => setModal(false)}>
                <CloseIcon size={16} />
              </button>
            </div>

            {/* 2. جسم الفاتورة القابل للتمرير */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
              {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

              {/* شريط البيانات الأساسية للفاتورة في سطر واحد واسع */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.6fr 2fr', gap: 16, padding: '16px 20px', background: '#f8fafc', borderRadius: 16, border: '1px solid #edf1f5', marginBottom: 22 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>التاريخ</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>المورد</label>
                  <select
                    className="form-control"
                    value={form.supplier_id}
                    onChange={e => setForm({ ...form, supplier_id: e.target.value })}
                  >
                    <option value="">اختر مورد (اختياري)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>صورة الفاتورة الورقية</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="file"
                      ref={invoiceFileRef}
                      accept="image/*"
                      className="form-control"
                      style={{ fontSize: 12, padding: '7px 10px' }}
                      onChange={handleInvoiceImageChange}
                    />
                    {invoiceImagePreview && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <img src={invoiceImagePreview} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}
                          onClick={() => {
                            setInvoiceImageFile(null);
                            setInvoiceImagePreview(null);
                            if (invoiceFileRef.current) invoiceFileRef.current.value = '';
                          }}
                        >
                          <CloseIcon size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>ملاحظات الفاتورة</label>
                  <input
                    className="form-control"
                    placeholder="رقم سند أو تفاصيل..."
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* قسم الأصناف والبنود */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>الأصناف والبنود الواردة</span>
                    <span className="badge badge-dark" style={{ fontSize: 12 }}>{items.length} صنف</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addItem}
                    style={{ fontWeight: 600, padding: '7px 16px' }}
                  >
                    + إضافة صنف
                  </button>
                </div>

                {/* قائمة البنود */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {items.map((item, i) => {
                    const isNew = item.type === 'new';
                    const itemQty = parseFloat(item.quantity) || 0;
                    const itemUnitPrice = parseFloat(item.unit_price) || 0;
                    const itemSelling = parseFloat(item.selling_price) || 0;
                    const itemTotal = itemQty * itemUnitPrice;
                    const estimatedProfitPerUnit = itemSelling > 0 ? (itemSelling - itemUnitPrice) : 0;

                    return (
                      <div
                        key={i}
                        style={{
                          background: '#ffffff',
                          border: '1.5px solid #edf1f5',
                          borderRadius: 16,
                          padding: '16px 20px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                        }}
                      >
                        {/* ترويسة البند: رقم الصنف، التبديل بين المسجل والجديد، وزر الحذف */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>
                              #{i + 1}
                            </span>

                            {/* مفتاح التبديل البسيط */}
                            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 10, gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => updateItem(i, 'type', 'existing')}
                                style={{
                                  border: 'none',
                                  background: !isNew ? '#0f172a' : 'transparent',
                                  color: !isNew ? '#ffffff' : '#64748b',
                                  fontWeight: 600,
                                  fontSize: 12.5,
                                  padding: '5px 14px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                صنف مسجل بالمخزن
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(i, 'type', 'new')}
                                style={{
                                  border: 'none',
                                  background: isNew ? '#10b981' : 'transparent',
                                  color: isNew ? '#ffffff' : '#64748b',
                                  fontWeight: 600,
                                  fontSize: 12.5,
                                  padding: '5px 14px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                صنف جديد لأول مرة
                              </button>
                            </div>
                          </div>

                          {items.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#ef4444', padding: '4px 10px', fontSize: 12 }}
                              onClick={() => removeItem(i)}
                              title="حذف هذا الصنف"
                            >
                              حذف البند
                            </button>
                          )}
                        </div>

                        {/* محتوى البند */}
                        {!isNew ? (
                          /* حالة الصنف المسجل بالمخزن */
                          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1.2fr', gap: 16, alignItems: 'center' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>اختر الحذاء</label>
                              <select
                                className="form-control"
                                value={item.product_id}
                                onChange={e => updateItem(i, 'product_id', e.target.value)}
                              >
                                <option value="">اختر الحذاء المسجل</option>
                                {products.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.code}) — رصيد المخزن: {p.current_quantity}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>الكمية</label>
                              <input
                                type="number"
                                min={1}
                                className="form-control"
                                placeholder="1"
                                value={item.quantity}
                                onChange={e => updateItem(i, 'quantity', e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>سعر الشراء (التكلفة)</label>
                              <input
                                type="number"
                                min={0}
                                className="form-control"
                                placeholder="0"
                                value={item.unit_price}
                                onChange={e => updateItem(i, 'unit_price', e.target.value)}
                              />
                            </div>

                            <div style={{ textAlign: 'left', paddingTop: 18 }}>
                              <span style={{ fontSize: 12.5, color: '#64748b', marginLeft: 8 }}>الإجمالي:</span>
                              <span style={{ fontSize: 19, fontWeight: 800, color: '#0f172a' }}>{fmt(itemTotal)} ج</span>
                            </div>
                          </div>
                        ) : (
                          /* حالة صنف جديد تماماً */
                          <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr', gap: 14, alignItems: 'center', marginBottom: 12 }}>
                              <div>
                                <label className="form-label" style={{ fontSize: 12 }}>اسم الموديل الجديد</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="اسم الحذاء"
                                  value={item.name}
                                  onChange={e => updateItem(i, 'name', e.target.value)}
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: 12 }}>سعر الشراء (التكلفة)</label>
                                <input
                                  type="number"
                                  min={0}
                                  className="form-control"
                                  placeholder="سعر الجملة"
                                  value={item.unit_price}
                                  onChange={e => updateItem(i, 'unit_price', e.target.value)}
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: 12 }}>سعر البيع للجمهور</label>
                                <input
                                  type="number"
                                  min={0}
                                  className="form-control"
                                  placeholder="سعر البيع"
                                  value={item.selling_price}
                                  onChange={e => updateItem(i, 'selling_price', e.target.value)}
                                />
                              </div>

                              <div>
                                <label className="form-label" style={{ fontSize: 12 }}>الكمية</label>
                                <input
                                  type="number"
                                  min={1}
                                  className="form-control"
                                  placeholder="1"
                                  value={item.quantity}
                                  onChange={e => updateItem(i, 'quantity', e.target.value)}
                                />
                              </div>

                              <div style={{ textAlign: 'left', paddingTop: 18 }}>
                                <span style={{ fontSize: 12.5, color: '#64748b', marginLeft: 8 }}>الإجمالي:</span>
                                <span style={{ fontSize: 19, fontWeight: 800, color: '#0f172a' }}>{fmt(itemTotal)} ج</span>
                              </div>
                            </div>

                            {/* صورة الصنف وهامش الربح بخط أفقي بسيط */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 12, color: '#64748b' }}>صورة المنتج:</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ fontSize: 12 }}
                                  disabled={item.uploading_image}
                                  onChange={e => handleItemImageUpload(i, e.target.files[0])}
                                />
                                {item.uploading_image && <span style={{ fontSize: 12, color: '#0284c7' }}>جاري الرفع...</span>}
                                {item.image_preview && !item.uploading_image && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <img src={item.image_preview} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                                    <button
                                      type="button"
                                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                                      onClick={() => {
                                        const copy = [...items];
                                        copy[i].image_preview = null;
                                        copy[i].image_path = '';
                                        setItems(copy);
                                      }}
                                    >
                                      إزالة
                                    </button>
                                  </div>
                                )}
                              </div>

                              {estimatedProfitPerUnit > 0 && (
                                <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                                  هامش ربح القطعة: {fmt(estimatedProfitPerUnit)} ج
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. شريط الحسابات والإجراءات المثبت بالأسفل */}
            <div
              style={{
                padding: '16px 28px',
                background: '#ffffff',
                borderTop: '1px solid #edf1f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 20
              }}
            >
              {/* إجمالي الفاتورة والمدفوع والمتبقي في صف واحد */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                <div>
                  <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>إجمالي الفاتورة</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{fmt(total)} ج</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 2 }}>المبلغ المدفوع</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control"
                      style={{ width: 150, padding: '7px 12px', fontSize: 15, fontWeight: 700 }}
                      placeholder={total > 0 ? `${total}` : '0'}
                      value={paidInput}
                      onChange={e => setPaidInput(e.target.value)}
                    />
                  </div>

                  <div style={{ paddingTop: 18 }}>
                    {calculatedRemaining === 0 ? (
                      <span className="badge badge-success" style={{ padding: '6px 14px', fontSize: 13 }}>
                        خالصة بالكامل
                      </span>
                    ) : actualPaidAmount === 0 ? (
                      <span className="badge badge-danger" style={{ padding: '6px 14px', fontSize: 13 }}>
                        آجل بالكامل: {fmt(calculatedRemaining)} ج
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ padding: '6px 14px', fontSize: 13 }}>
                        متبقي علينا: {fmt(calculatedRemaining)} ج
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* أزرار الإجراءات */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setModal(false)}>
                  إلغاء
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveInvoice}
                  disabled={saving}
                  style={{ padding: '10px 30px', fontSize: 14, fontWeight: 700 }}
                >
                  {saving ? 'جاري الحفظ...' : 'تأكيد وحفظ الفاتورة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: تفاصيل الفاتورة
          ======================================================== */}
      {detailModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetailModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ReceiptIcon size={20} color="#0284c7" />
                <span className="modal-title">تفاصيل فاتورة الشراء: {detailModal.invoice_number}</span>
              </div>
              <button className="modal-close" onClick={() => setDetailModal(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><span style={{ color: '#888', fontSize: 13 }}>التاريخ:</span> <strong>{detailModal.date}</strong></div>
                <div><span style={{ color: '#888', fontSize: 13 }}>المورد:</span> <strong>{detailModal.supplier_name || '—'}</strong></div>
                <div><span style={{ color: '#888', fontSize: 13 }}>الحالة:</span> <span className={`badge ${statusBadge[detailModal.status]}`}>{statusLabel[detailModal.status]}</span></div>
                <div><span style={{ color: '#888', fontSize: 13 }}>ملاحظات:</span> <strong>{detailModal.notes || '—'}</strong></div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>سعر الشراء</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.items?.map((it, i) => (
                    <tr key={i}>
                      <td>{it.product_name} <span style={{ fontSize: 12, color: '#999' }}>({it.product_code})</span></td>
                      <td>{it.quantity}</td>
                      <td>{fmt(it.unit_price)} ج</td>
                      <td style={{ fontWeight: 700 }}>{fmt(it.total)} ج</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="invoice-total" style={{ marginTop: 14 }}>
                الإجمالي: <span>{fmt(detailModal.total_amount)} ج</span>
                &nbsp;&nbsp;|&nbsp;&nbsp; المدفوع: <span style={{ color: '#2e7d32' }}>{fmt(detailModal.paid_amount)} ج</span>
                &nbsp;&nbsp;|&nbsp;&nbsp; فلوس علينا: <span style={{ color: '#c62828' }}>{fmt(detailModal.total_amount - detailModal.paid_amount)} ج</span>
              </div>

              {detailModal.invoice_image && (
                <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CameraIcon size={16} />
                    <span>صورة الفاتورة الورقية الأصلية:</span>
                  </div>
                  <div
                    style={{ cursor: 'pointer', display: 'inline-block' }}
                    onClick={() => setPreviewImageModal(`${API_URL}${detailModal.invoice_image}`)}
                  >
                    <img
                      src={`${API_URL}${detailModal.invoice_image}`}
                      alt="الفاتورة الورقية"
                      style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                    <div style={{ fontSize: 12, color: '#e94560', marginTop: 4 }}>اضغط لتكبير الصورة بحجم كامل</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: تعديل فاتورة شراء
          ======================================================== */}
      {editModal && editForm && (() => {
        const editTotal = editItems.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
        const editPaid = parseFloat(editForm.paid_amount) || 0;
        const editRemaining = editTotal - editPaid;

        return (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
            <div
              className="modal"
              style={{
                width: '95vw',
                maxWidth: 1300,
                height: '92vh',
                borderRadius: 24,
                display: 'flex',
                flexDirection: 'column',
                background: '#ffffff',
                overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
              }}
            >
              {/* ترويسة بسيطة ونظيفة */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 28px', borderBottom: '1px solid #edf1f5' }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    تعديل فاتورة الشراء: <span style={{ color: '#10b981' }}>{editForm.invoice_number}</span>
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>تحديث الأصناف والكميات وحسابات المورد</p>
                </div>
                <button className="modal-close" onClick={() => setEditModal(false)}>
                  <CloseIcon size={16} />
                </button>
              </div>

              {/* جسم النافذة القابل للتمرير */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 30px' }}>
                {editError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{editError}</div>}

                {/* شريط البيانات الأساسية للفاتورة في سطر واحد واسع */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.6fr 2fr', gap: 16, padding: '16px 20px', background: '#f8fafc', borderRadius: 16, border: '1px solid #edf1f5', marginBottom: 22 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>التاريخ</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editForm.date}
                      onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>المورد</label>
                    <select
                      className="form-control"
                      value={editForm.supplier_id}
                      onChange={e => setEditForm({ ...editForm, supplier_id: e.target.value })}
                    >
                      <option value="">اختر مورد (اختياري)</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>صورة الفاتورة الورقية</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="file"
                        ref={editInvoiceFileRef}
                        accept="image/*"
                        className="form-control"
                        style={{ fontSize: 12, padding: '7px 10px' }}
                        onChange={handleEditInvoiceImageChange}
                      />
                      {editInvoiceImagePreview && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <img src={editInvoiceImagePreview} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}
                            onClick={() => {
                              setEditInvoiceImageFile(null);
                              setEditInvoiceImagePreview(null);
                              if (editInvoiceFileRef.current) editInvoiceFileRef.current.value = '';
                            }}
                          >
                            <CloseIcon size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 12.5, fontWeight: 600 }}>ملاحظات الفاتورة</label>
                    <input
                      className="form-control"
                      placeholder="رقم سند أو تفاصيل..."
                      value={editForm.notes}
                      onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </div>
                </div>

                {/* قسم الأصناف والبنود */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>الأصناف والبنود</span>
                      <span className="badge badge-dark" style={{ fontSize: 12 }}>{editItems.length} صنف</span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditItems([...editItems, { product_id: '', quantity: 1, unit_price: '' }])}
                      style={{ fontWeight: 600, padding: '7px 16px' }}
                    >
                      + إضافة صنف
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {editItems.map((item, i) => {
                      const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);

                      return (
                        <div
                          key={i}
                          style={{
                            background: '#ffffff',
                            border: '1.5px solid #edf1f5',
                            borderRadius: 16,
                            padding: '16px 20px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '40px 3fr 1.2fr 1.5fr 1.5fr auto', gap: 16, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textAlign: 'center' }}>
                              #{i + 1}
                            </span>

                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>المنتج بالمخزن</label>
                              <select
                                className="form-control"
                                value={item.product_id}
                                onChange={e => {
                                  const copy = [...editItems];
                                  copy[i].product_id = parseInt(e.target.value);
                                  const p = products.find(prod => prod.id === parseInt(e.target.value));
                                  if (p) copy[i].unit_price = p.wholesale_price;
                                  setEditItems(copy);
                                }}
                              >
                                <option value="">اختر منتج من المخزن</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                              </select>
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>الكمية</label>
                              <input
                                type="number"
                                min={1}
                                className="form-control"
                                value={item.quantity}
                                onChange={e => {
                                  const copy = [...editItems];
                                  copy[i].quantity = parseInt(e.target.value) || 1;
                                  setEditItems(copy);
                                }}
                              />
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>سعر الشراء للقطعة (ج)</label>
                              <input
                                type="number"
                                className="form-control"
                                value={item.unit_price}
                                onChange={e => {
                                  const copy = [...editItems];
                                  copy[i].unit_price = parseFloat(e.target.value) || 0;
                                  setEditItems(copy);
                                }}
                              />
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: 12 }}>إجمالي البند</label>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', padding: '8px 0' }}>
                                {fmt(itemTotal)} ج
                              </div>
                            </div>

                            <div style={{ paddingTop: 20 }}>
                              {editItems.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#ef4444', padding: '6px 12px', display: 'flex', alignItems: 'center' }}
                                  onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))}
                                  title="حذف هذا الصنف"
                                >
                                  <CloseIcon size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* شريط الإجماليات وتأكيد الحفظ مثبت بالأسفل */}
              <div
                style={{
                  background: '#f8fafc',
                  borderTop: '1.5px solid #edf1f5',
                  padding: '16px 28px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 20,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>إجمالي الفاتورة</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                      {fmt(editTotal)} <span style={{ fontSize: 14, fontWeight: 500 }}>ج</span>
                    </div>
                  </div>

                  <div style={{ width: 1, height: 36, background: '#cbd5e1' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                      المبلغ المدفوع:
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: 130, fontWeight: 700, fontSize: 15 }}
                      placeholder="0"
                      value={editForm.paid_amount}
                      onChange={e => setEditForm({ ...editForm, paid_amount: e.target.value })}
                    />
                  </div>

                  <div>
                    {editRemaining <= 0 ? (
                      <span className="badge badge-success" style={{ padding: '6px 14px', fontSize: 13 }}>
                        خالصة بالكامل
                      </span>
                    ) : editPaid <= 0 ? (
                      <span className="badge badge-danger" style={{ padding: '6px 14px', fontSize: 13 }}>
                        آجل بالكامل: {fmt(editRemaining)} ج
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ padding: '6px 14px', fontSize: 13 }}>
                        متبقي علينا: {fmt(editRemaining)} ج
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditModal(false)}
                    style={{ padding: '9px 20px', fontWeight: 600 }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveEditPurchase}
                    disabled={editSaving}
                    style={{ padding: '9px 24px', fontWeight: 700 }}
                  >
                    {editSaving ? 'جاري الحفظ...' : 'حفظ التعديلات وتحديث المخزن'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================
          MODAL: سداد دفعة للمورد
          ======================================================== */}
      {payModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPayModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarIcon size={20} color="#059669" />
                <span className="modal-title">سداد للمورد — {payModal.invoice_number}</span>
              </div>
              <button className="modal-close" onClick={() => setPayModal(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, fontSize: 14 }}>
                المتبقي علينا للمورد: <strong style={{ color: '#c62828' }}>{fmt(payModal.total_amount - payModal.paid_amount)} ج</strong>
              </p>
              <div className="form-group">
                <label className="form-label">المبلغ المسدد الآن (ج) *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPayModal(null)}>إلغاء</button>
              <button className="btn btn-success" onClick={handlePay} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CheckIcon size={15} />
                <span>تأكيد السداد</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: معاينة صورة الفاتورة الورقية بحجم كامل
          ======================================================== */}
      {previewImageModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setPreviewImageModal(null)}>
          <div className="modal" style={{ maxWidth: 750, padding: 18 }}>
            <div className="modal-header" style={{ marginBottom: 12, paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CameraIcon size={20} />
                <span className="modal-title">صورة الفاتورة الورقية الأصلية</span>
              </div>
              <button className="modal-close" onClick={() => setPreviewImageModal(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div style={{ textAlign: 'center', maxHeight: '72vh', overflow: 'auto', background: '#0f172a', borderRadius: 8, padding: 10 }}>
              <img
                src={previewImageModal}
                alt="الفاتورة الورقية"
                style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: 6 }}
              />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={previewImageModal}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                فتح الصورة في تبويب مستقل ↗
              </a>
              <button className="btn btn-primary btn-sm" onClick={() => setPreviewImageModal(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
