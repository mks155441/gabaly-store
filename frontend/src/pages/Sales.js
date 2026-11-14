import React, { useEffect, useState } from 'react';
import { getSales, getSale, createSale, updateSale, deleteSale, markSalePaid, paySale, getProducts } from '../api';
import {
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  PackageIcon,
  CloseIcon,
  CheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  DollarIcon,
  SaveIcon
} from '../components/Icons';

const API_URL = window.location.origin.includes(':3000') ? 'http://localhost:5000' : '';
// أرقام صحيحة بالإنجليزية بدون كسور
const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');
const statusLabel = { paid: 'مسددة بالكامل', unpaid: 'آجل بالكامل', partial: 'متبقي على العميل' };
const statusBadge = { paid: 'badge-success', unpaid: 'badge-danger', partial: 'badge-warning' };

export default function Sales() {
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' أو 'history'
  const [products, setProducts]   = useState([]);
  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  
  // بحث المنتجات في POS
  const [posSearch, setPosSearch] = useState('');
  
  // سلة المبيعات { [productId]: quantity }
  const [cart, setCart] = useState({});

  // فلاتر سجل الفواتير (بحث بالفاتورة أو الاسم أو الرقم)
  const [filters, setFilters] = useState({ from: '', to: '', status: '', search: '' });

  // مودالات
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [detailModal, setDetailModal]     = useState(null);
  const [editModal, setEditModal]         = useState(null);
  const [payModal, setPayModal]           = useState(null);
  const [payAmount, setPayAmount]         = useState('');
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');

  // نموذج إنشاء الفاتورة
  const today = new Date().toISOString().split('T')[0];
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount]           = useState('');
  const [paidInput, setPaidInput]         = useState(''); // المبلغ المستلم/المدفوع فقط
  const [notes, setNotes]                 = useState('');

  // نموذج التعديل
  const [editForm, setEditForm]   = useState(null);
  const [editItems, setEditItems] = useState([]);

  const loadAll = () => {
    setLoading(true);
    const params = {};
    if (filters.from)   params.from   = filters.from;
    if (filters.to)     params.to     = filters.to;
    if (filters.status) params.status = filters.status;
    if (filters.search) params.search = filters.search;

    Promise.all([
      getProducts(),
      getSales(params)
    ]).then(([prRes, slRes]) => {
      setProducts(prRes.data.data);
      setInvoices(slRes.data.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, [filters]);

  // إدارة السلة
  const addToCart = (product) => {
    if (product.current_quantity <= 0) return;
    const current = cart[product.id] || 0;
    if (current >= product.current_quantity) {
      alert(`عفواً، الكمية المتاحة في المخزن هي ${product.current_quantity} فقط`);
      return;
    }
    setCart({ ...cart, [product.id]: current + 1 });
  };

  const removeFromCart = (productId) => {
    const current = cart[productId] || 0;
    if (current <= 1) {
      const copy = { ...cart };
      delete copy[productId];
      setCart(copy);
    } else {
      setCart({ ...cart, [productId]: current - 1 });
    }
  };

  const clearCart = () => setCart({});

  // المنتجات المختارة في السلة
  const selectedCartItems = Object.entries(cart).map(([pId, qty]) => {
    const product = products.find(p => p.id === parseInt(pId));
    return {
      product_id: parseInt(pId),
      product,
      quantity: qty,
      unit_price: product?.selling_price || 0,
      total: (product?.selling_price || 0) * qty
    };
  }).filter(it => it.product);

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartSubtotal = selectedCartItems.reduce((s, it) => s + it.total, 0);
  const discountVal = parseFloat(discount) || 0;
  const cartTotal = Math.max(0, cartSubtotal - discountVal);

  // حساب المدفوع والمتبقي دين على العميل
  const actualPaidAmount = paidInput === '' ? cartTotal : (parseFloat(paidInput) || 0);
  const calculatedRemaining = Math.max(0, cartTotal - actualPaidAmount);

  const openCheckout = () => {
    setError('');
    // الافتراضي: الفاتورة مدفوعة بالكامل لتوفير الوقت، والعميل يمكنه كتابة أي رقم
    setPaidInput(cartTotal.toString());
    setCheckoutModal(true);
  };

  // حفظ الفاتورة الجديدة
  const handleCreateInvoice = async () => {
    setError('');
    if (selectedCartItems.length === 0) return setError('السلة فارغة، اختر منتجات أولاً');
    if (!customerName.trim()) return setError('اسم العميل إجباري لتسجيل الفاتورة وحفظ حسابه');
    if (!customerPhone.trim()) return setError('رقم موبايل العميل إجباري للتواصل ومتابعة الحساب');

    setSaving(true);
    try {
      const itemsPayload = selectedCartItems.map(it => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price
      }));

      const paidVal = actualPaidAmount;
      let status = 'paid';
      if (paidVal <= 0) status = 'unpaid';
      else if (paidVal < cartTotal) status = 'partial';

      await createSale({
        date: today,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        items: itemsPayload,
        discount: discountVal,
        paid_amount: paidVal,
        status,
        notes
      });

      // تنظيف الحالة
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setDiscount('');
      setPaidInput('');
      setNotes('');
      setCheckoutModal(false);

      // الذهاب لسجل الفواتير وتحديث البيانات
      setActiveTab('history');
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في حفظ الفاتورة');
    } finally {
      setSaving(false);
    }
  };

  // فتح تفاصيل فاتورة
  const openDetail = (inv) => {
    getSale(inv.id).then(r => setDetailModal(r.data.data));
  };

  // جعل الفاتورة خالصة
  const handleMarkPaid = async (inv) => {
    if (!window.confirm(`هل تريد تحويل الفاتورة ${inv.invoice_number} إلى خالصة بالكامل؟`)) return;
    try {
      await markSalePaid(inv.id);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  // مسح الفاتورة
  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`هل أنت متأكد من مسح الفاتورة ${inv.invoice_number}؟\nسيتم إعادة بضاعة الفاتورة للمخزن تلقائياً وإلغاء الحركة المالية.`)) return;
    try {
      await deleteSale(inv.id);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  // فتح نافذة التعديل
  const openEdit = async (inv) => {
    try {
      const res = await getSale(inv.id);
      const data = res.data.data;
      setEditForm({
        id: data.id,
        invoice_number: data.invoice_number,
        date: data.date,
        customer_name: data.customer_name || '',
        customer_phone: data.customer_phone || '',
        discount: data.discount || 0,
        paid_amount: data.paid_amount || 0,
        notes: data.notes || ''
      });
      setEditItems(data.items.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price
      })));
      setError('');
      setEditModal(true);
    } catch (err) {
      alert('فشل تحميل الفاتورة للتعديل');
    }
  };

  // حفظ التعديل
  const handleSaveEdit = async () => {
    setError('');
    if (!editForm.date) return setError('التاريخ مطلوب');
    if (editItems.length === 0) return setError('لازم الفاتورة تحتوي على صنف واحد على الأقل');

    setSaving(true);
    try {
      await updateSale(editForm.id, {
        date: editForm.date,
        customer_name: editForm.customer_name,
        customer_phone: editForm.customer_phone,
        items: editItems,
        discount: parseFloat(editForm.discount) || 0,
        paid_amount: parseFloat(editForm.paid_amount) || 0,
        notes: editForm.notes
      });
      setEditModal(false);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.message || 'فشل تعديل الفاتورة');
    } finally {
      setSaving(false);
    }
  };

  // تسجيل دفعة
  const handlePay = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return alert('أدخل مبلغ صحيح');
    try {
      await paySale(payModal.id, parseFloat(payAmount));
      setPayModal(null);
      setPayAmount('');
      loadAll();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  // تصفية المنتجات في نقطة البيع
  const filteredProducts = products.filter(p => {
    if (!posSearch) return true;
    return p.name.toLowerCase().includes(posSearch.toLowerCase()) || p.code.toLowerCase().includes(posSearch.toLowerCase());
  });

  const totalSalesAmount = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalDebtForUs   = invoices.reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">فواتير البيع ونقطة الكاشير</h1>
          <p style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            اختر المنتجات بالكروت وأنشئ فاتورة فورية، أو تصفح وعدّل فواتير البيع السابقة
          </p>
        </div>

        {/* زر تبديل التبويب */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn ${activeTab === 'pos' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('pos')}
          >
            <ShoppingBagIcon size={16} />
            <span>شاشة الكاشير {cartCount > 0 && `(${cartCount})`}</span>
          </button>
          <button
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            <ReceiptIcon size={16} />
            <span>سجل فواتير البيع ({invoices.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          TAB 1: شاشة الكاشير بالكروت الاحترافية (POS)
          ======================================================== */}
      {activeTab === 'pos' && (
        <div>
          {/* شريط البحث السريع وسلة المنتجات */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <input
                className="search-input"
                style={{ background: '#fff', width: '100%', fontSize: 15, padding: '12px 18px', borderRadius: 12 }}
                placeholder="ابحث بالاسم أو الباركود (مثال: كوتشي أو كود SKU)..."
                value={posSearch}
                onChange={e => setPosSearch(e.target.value)}
                autoFocus
              />
            </div>
            {cartCount > 0 && (
              <button className="btn btn-secondary" onClick={clearCart} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TrashIcon size={15} />
                <span>تفريغ السلة ({cartCount})</span>
              </button>
            )}
          </div>

          {/* شبكة كروت المنتجات الاحترافية */}
          {loading ? (
            <div className="loading">جاري تحميل منتجات الكاشير...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <PackageIcon size={44} color="#94a3b8" />
              </div>
              <p>لا توجد منتجات مطابقة للبحث</p>
            </div>
          ) : (
            <div className="pos-grid" style={{ paddingBottom: cartCount > 0 ? 110 : 30 }}>
              {filteredProducts.map(p => {
                const qtyInCart = cart[p.id] || 0;
                const isOutOfStock = p.current_quantity <= 0;
                const isSelected = qtyInCart > 0;

                return (
                  <div
                    key={p.id}
                    className={`pos-card ${isSelected ? 'in-cart' : ''}`}
                    style={{ opacity: isOutOfStock ? 0.6 : 1 }}
                  >
                    {/* صورة المنتج نقية تماماً بدون أي عناصر فوقها */}
                    <div className="pos-card-media">
                      {p.image_path ? (
                        <img src={`${API_URL}${p.image_path}`} alt={p.name} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <PackageIcon size={52} color="#cbd5e1" />
                        </div>
                      )}
                    </div>

                    {/* تفاصيل الكارت: الاسم والأسعار والأزرار بالكامل أسفل الصورة */}
                    <div className="pos-card-content">
                      <div className="pos-card-name" title={p.name}>
                        {p.name}
                      </div>

                      {/* شريط السعر وحالة المخزن أسفل الصورة */}
                      <div className="pos-card-meta">
                        <div className="pos-clean-price">
                          {fmt(p.selling_price)} <span style={{ fontSize: 13, fontWeight: 600 }}>ج</span>
                        </div>
                        <span
                          className={`pos-stock-pill ${
                            isOutOfStock ? 'pill-danger' : p.current_quantity <= 5 ? 'pill-warning' : 'pill-success'
                          }`}
                        >
                          {isOutOfStock ? 'نفد المخزون' : `متاح: ${p.current_quantity}`}
                        </span>
                      </div>

                      {/* زر الإضافة أو عداد الكمية */}
                      <div>
                        {isSelected ? (
                          <div className="pos-stepper">
                            <button
                              type="button"
                              className="pos-step-btn"
                              onClick={() => removeFromCart(p.id)}
                            >
                              -
                            </button>
                            <span className="pos-step-count">
                              {qtyInCart} في السلة
                            </span>
                            <button
                              type="button"
                              className="pos-step-btn"
                              onClick={() => addToCart(p)}
                              disabled={qtyInCart >= p.current_quantity}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="pos-btn-add"
                            disabled={isOutOfStock}
                            onClick={() => addToCart(p)}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <ShoppingCartIcon size={16} />
                            <span>{isOutOfStock ? 'غير متوفر' : 'إضافة للسلة'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* شريط السلة العائم عند اختيار منتجات */}
          {cartCount > 0 && (
            <div className="pos-cart-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBagIcon size={24} color="#4ade80" />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: '#cbd5e1' }}>المنتجات في الفاتورة: <strong>{cartCount} قطعة</strong></div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#4ade80' }}>
                    الإجمالي: {fmt(cartSubtotal)} ج
                  </div>
                </div>
              </div>

              <div>
                <button
                  className="btn btn-primary"
                  style={{
                    fontSize: 16,
                    padding: '12px 32px',
                    borderRadius: 12,
                    boxShadow: '0 4px 20px rgba(233,69,96,0.45)',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                  onClick={openCheckout}
                >
                  <ReceiptIcon size={18} />
                  <span>إنشاء الفاتورة ({cartCount} صنف) ←</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: سجل فواتير البيع (History)
          ======================================================== */}
      {activeTab === 'history' && (
        <div>
          {/* Summary Stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card blue">
              <div className="stat-info">
                <div className="stat-label">عدد فواتير البيع</div>
                <div className="stat-value">{invoices.length}</div>
              </div>
              <div className="stat-icon-box">
                <ReceiptIcon size={24} color="#ffffff" />
              </div>
            </div>

            <div className="stat-card emerald">
              <div className="stat-info">
                <div className="stat-label">إجمالي المبيعات</div>
                <div className="stat-value">
                  {fmt(totalSalesAmount)} <span className="stat-currency">ج</span>
                </div>
              </div>
              <div className="stat-icon-box">
                <TrendingUpIcon size={24} color="#ffffff" />
              </div>
            </div>

            <div className="stat-card amber">
              <div className="stat-info">
                <div className="stat-label">دين ليا (على العملاء)</div>
                <div className="stat-value">
                  {fmt(totalDebtForUs)} <span className="stat-currency">ج</span>
                </div>
              </div>
              <div className="stat-icon-box">
                <WalletIcon size={24} color="#ffffff" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 260 }}>
                <label className="form-label" style={{ fontWeight: 600 }}>بحث بالفاتورة أو الاسم أو الرقم</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    placeholder="اكتب رقم الفاتورة أو اسم العميل أو الموبايل..."
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
                <label className="form-label">الحالة</label>
                <select className="form-control" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">كل الحالات</option>
                  <option value="paid">خالصة</option>
                  <option value="partial">جزئي</option>
                  <option value="unpaid">دين ليا بالكامل</option>
                </select>
              </div>
              <button className="btn btn-secondary" onClick={() => setFilters({ from: '', to: '', status: '', search: '' })}>إعادة تعيين</button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="loading">جاري التحميل...</div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ReceiptIcon size={44} color="#94a3b8" />
              </div>
              <p>لا يوجد فواتير بيع مطابقة</p>
              <button
                className="btn btn-primary"
                style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => setActiveTab('pos')}
              >
                <ShoppingBagIcon size={16} />
                <span>الذهاب لشاشة الكاشير لإنشاء فاتورة</span>
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>التاريخ</th>
                    <th>العميل</th>
                    <th>رقم الموبايل</th>
                    <th>الإجمالي</th>
                    <th>الخصم</th>
                    <th>المدفوع</th>
                    <th>فلوس لينا (المتبقي)</th>
                    <th>الحالة</th>
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
                        <td style={{ fontWeight: 600 }}>{inv.customer_name || <span style={{ color: '#bbb' }}>زبون المحل</span>}</td>
                        <td>{inv.customer_phone ? <code>{inv.customer_phone}</code> : <span style={{ color: '#bbb' }}>—</span>}</td>
                        <td style={{ fontWeight: 700 }}>{fmt(inv.total_amount)} ج</td>
                        <td style={{ color: inv.discount > 0 ? '#e65100' : '#bbb' }}>
                          {inv.discount > 0 ? `${fmt(inv.discount)} ج` : '—'}
                        </td>
                        <td style={{ color: '#2e7d32' }}>{fmt(inv.paid_amount)} ج</td>
                        <td style={{ color: remaining > 0 ? '#c62828' : '#2e7d32', fontWeight: 700 }}>
                          {remaining > 0 ? `${fmt(remaining)} ج` : '0 ج'}
                        </td>
                        <td><span className={`badge ${statusBadge[inv.status]}`}>{statusLabel[inv.status]}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                            <button className="btn btn-secondary btn-sm" title="تفاصيل الفاتورة" onClick={() => openDetail(inv)}>
                              <EyeIcon size={14} />
                            </button>
                            {inv.status !== 'paid' && (
                              <button
                                className="btn btn-success btn-sm"
                                title="تحويل لخالصة فوراً"
                                onClick={() => handleMarkPaid(inv)}
                              >
                                خالصة
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" title="تعديل الفاتورة" onClick={() => openEdit(inv)}>
                              <EditIcon size={14} />
                            </button>
                            <button className="btn btn-danger btn-sm" title="مسح الفاتورة واسترجاع البضاعة" onClick={() => handleDeleteInvoice(inv)}>
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: إتمام فاتورة البيع بتصميم احترافي مبسط بدون تعقيد
          ======================================================== */}
      {checkoutModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCheckoutModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ReceiptIcon size={20} color="#0284c7" />
                <span className="modal-title">تأكيد فاتورة البيع</span>
              </div>
              <button className="modal-close" onClick={() => setCheckoutModal(false)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              {/* بيانات العميل */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">اسم العميل * (إجباري)</label>
                  <input
                    className="form-control"
                    placeholder="مثال: محمد علي"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">رقم موبايل العميل * (إجباري)</label>
                  <input
                    className="form-control"
                    placeholder="مثال: 01012345678"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* جدول المنتجات في الفاتورة */}
              <div className="table-wrapper" style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 14 }}>
                <table style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCartItems.map(it => (
                      <tr key={it.product_id}>
                        <td><strong>{it.product.name}</strong></td>
                        <td>{it.quantity}</td>
                        <td>{fmt(it.unit_price)} ج</td>
                        <td style={{ fontWeight: 700 }}>{fmt(it.total)} ج</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* الخصم والإجمالي الصافي */}
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ color: '#64748b', fontSize: 14 }}>الإجمالي قبل الخصم:</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{fmt(cartSubtotal)} ج</span>
                </div>

                <div className="form-row" style={{ alignItems: 'center', marginBottom: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>قيمة الخصم (ج)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="0.00"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                    />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>المطلوب بعد الخصم:</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#e94560' }}>{fmt(cartTotal)} ج</div>
                  </div>
                </div>

                {/* الحقل الوحيد البسيط للمدفوع والمتبقي */}
                <div style={{ borderTop: '1.5px dashed #cbd5e1', paddingTop: 14, marginTop: 10 }}>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DollarIcon size={16} color="#059669" />
                      <span>المبلغ المدفوع / المستلم من العميل (ج) *</span>
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      style={{ fontSize: 18, fontWeight: 800, padding: '10px 14px' }}
                      placeholder="أدخل المبلغ الذي دفعه العميل"
                      value={paidInput}
                      onChange={e => setPaidInput(e.target.value)}
                    />
                  </div>

                  {/* الحساب التلقائي الذكي للمتبقي */}
                  {calculatedRemaining === 0 ? (
                    <div style={{ background: '#dcfce7', color: '#15803d', padding: '10px 14px', borderRadius: 8, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircleIcon size={18} color="#15803d" />
                      <span>الفاتورة خالصة ومسددة بالكامل (لا يوجد أي متبقي على العميل)</span>
                    </div>
                  ) : (
                    <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircleIcon size={18} color="#b91c1c" />
                        <span>المتبقي على العميل (دين ليا):</span>
                      </div>
                      <span style={{ fontSize: 18, fontWeight: 900 }}>{fmt(calculatedRemaining)} ج</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ملاحظات */}
              <div className="form-group">
                <label className="form-label">ملاحظات على الفاتورة</label>
                <input
                  className="form-control"
                  placeholder="اختياري"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCheckoutModal(false)}>إلغاء</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateInvoice}
                disabled={saving}
                style={{ padding: '10px 24px', fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CheckIcon size={16} />
                <span>{saving ? 'جاري الحفظ...' : 'تأكيد وحفظ الفاتورة'}</span>
              </button>
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
                <span className="modal-title">تفاصيل فاتورة بيع: {detailModal.invoice_number}</span>
              </div>
              <button className="modal-close" onClick={() => setDetailModal(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div><span style={{ color: '#888', fontSize: 13 }}>التاريخ:</span> <strong>{detailModal.date}</strong></div>
                <div><span style={{ color: '#888', fontSize: 13 }}>العميل:</span> <strong>{detailModal.customer_name || 'زبون المحل'}</strong></div>
                <div><span style={{ color: '#888', fontSize: 13 }}>رقم الموبايل:</span> <strong>{detailModal.customer_phone || '—'}</strong></div>
                <div><span style={{ color: '#888', fontSize: 13 }}>الحالة:</span> <span className={`badge ${statusBadge[detailModal.status]}`}>{statusLabel[detailModal.status]}</span></div>
                <div><span style={{ color: '#888', fontSize: 13 }}>الخصم:</span> <strong>{fmt(detailModal.discount)} ج</strong></div>
                <div><span style={{ color: '#888', fontSize: 13 }}>ملاحظات:</span> <strong>{detailModal.notes || '—'}</strong></div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>الكمية</th>
                    <th>سعر البيع</th>
                    <th>الربح/قطعة</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.items?.map((it, i) => (
                    <tr key={i}>
                      <td><strong>{it.product_name}</strong> <span style={{ fontSize: 12, color: '#999' }}>({it.product_code})</span></td>
                      <td>{it.quantity}</td>
                      <td>{fmt(it.unit_price)} ج</td>
                      <td style={{ color: '#2e7d32', fontWeight: 600 }}>{fmt(it.unit_price - it.wholesale_price)} ج</td>
                      <td style={{ fontWeight: 700 }}>{fmt(it.total)} ج</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="invoice-total" style={{ marginTop: 14 }}>
                الإجمالي الصافي: <span>{fmt(detailModal.total_amount)} ج</span>
                &nbsp;&nbsp;|&nbsp;&nbsp; المستلم: <span style={{ color: '#2e7d32' }}>{fmt(detailModal.paid_amount)} ج</span>
                &nbsp;&nbsp;|&nbsp;&nbsp; دين ليا: <span style={{ color: '#c62828' }}>{fmt(detailModal.total_amount - detailModal.paid_amount)} ج</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: تعديل فاتورة بيع
          ======================================================== */}
      {editModal && editForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <EditIcon size={20} color="#0284c7" />
                <span className="modal-title">تعديل الفاتورة: {editForm.invoice_number}</span>
              </div>
              <button className="modal-close" onClick={() => setEditModal(false)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">التاريخ *</label>
                  <input type="date" className="form-control" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">اسم العميل</label>
                  <input className="form-control" value={editForm.customer_name} onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">رقم موبايل العميل</label>
                  <input className="form-control" value={editForm.customer_phone} onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">قيمة الخصم (ج)</label>
                  <input type="number" className="form-control" value={editForm.discount} onChange={e => setEditForm({ ...editForm, discount: e.target.value })} />
                </div>
              </div>

              <label className="form-label">الأصناف والكميات:</label>
              <div className="invoice-items-table">
                <table>
                  <thead>
                    <tr><th>المنتج</th><th>الكمية</th><th>سعر البيع</th><th>الإجمالي</th></tr>
                  </thead>
                  <tbody>
                    {editItems.map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            className="form-control"
                            style={{ width: 85 }}
                            value={item.quantity}
                            onChange={e => {
                              const copy = [...editItems];
                              copy[i].quantity = parseInt(e.target.value) || 1;
                              setEditItems(copy);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control"
                            style={{ width: 100 }}
                            value={item.unit_price}
                            onChange={e => {
                              const copy = [...editItems];
                              copy[i].unit_price = parseFloat(e.target.value) || 0;
                              setEditItems(copy);
                            }}
                          />
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {fmt((item.quantity || 0) * (item.unit_price || 0))} ج
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">المبلغ المدفوع (المستلم من العميل)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.paid_amount}
                    onChange={e => setEditForm({ ...editForm, paid_amount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ملاحظات</label>
                  <input
                    className="form-control"
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditModal(false)}>إلغاء</button>
              <button
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <SaveIcon size={16} />
                <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
