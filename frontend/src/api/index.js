import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || (window.location.origin.includes(':3000') ? 'http://localhost:5000/api' : '/api');

const API = axios.create({
  baseURL: API_BASE,
});

// ==========================================
// المنتجات
// ==========================================
export const getProducts    = (params) => API.get('/products', { params });
export const getProduct     = (id)     => API.get(`/products/${id}`);
export const createProduct  = (data)   => API.post('/products', data);        // data = FormData
export const updateProduct  = (id, data) => API.put(`/products/${id}`, data); // data = FormData
export const deleteProduct  = (id)     => API.delete(`/products/${id}`);
export const uploadProductImage = (data) => API.post('/products/upload-image', data); // data = FormData

// ==========================================
// الموردين
// ==========================================
export const getSuppliers   = ()       => API.get('/suppliers');
export const createSupplier = (data)   => API.post('/suppliers', data);
export const updateSupplier = (id, data) => API.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id)     => API.delete(`/suppliers/${id}`);

// ==========================================
// فواتير الشراء
// ==========================================
export const getPurchases   = (params) => API.get('/purchases', { params });
export const getPurchase    = (id)     => API.get(`/purchases/${id}`);
export const createPurchase = (data)   => API.post('/purchases', data);
export const updatePurchase = (id, data) => API.put(`/purchases/${id}`, data);
export const deletePurchase = (id)     => API.delete(`/purchases/${id}`);
export const payPurchase    = (id, amount) => API.patch(`/purchases/${id}/pay`, { amount });
export const uploadPurchaseImage = (id, formData) => API.post(`/purchases/${id}/image`, formData);

// ==========================================
// فواتير البيع
// ==========================================
export const getSales       = (params) => API.get('/sales', { params });
export const getSale        = (id)     => API.get(`/sales/${id}`);
export const createSale     = (data)   => API.post('/sales', data);
export const updateSale     = (id, data) => API.put(`/sales/${id}`, data);
export const deleteSale     = (id)     => API.delete(`/sales/${id}`);
export const markSalePaid   = (id)     => API.patch(`/sales/${id}/mark-paid`);
export const paySale        = (id, amount) => API.patch(`/sales/${id}/pay`, { amount });

// ==========================================
// العملاء
// ==========================================
export const getCustomers        = (params) => API.get('/customers', { params });
export const getCustomerInvoices = (id)     => API.get(`/customers/${id}/invoices`);
export const createCustomer      = (data)   => API.post('/customers', data);
export const deleteCustomer      = (id)     => API.delete(`/customers/${id}`);

// ==========================================
// الأموال
// ==========================================
export const getFinance     = (params) => API.get('/finance', { params });
export const createTransaction = (data) => API.post('/finance', data);
export const deleteTransaction = (id)  => API.delete(`/finance/${id}`);

// ==========================================
// التقارير
// ==========================================
export const getDashboard   = ()           => API.get('/reports/dashboard');
export const getProfitReport = (from, to)  => API.get('/reports/profit', { params: { from, to } });
export const getSettings    = ()           => API.get('/reports/settings');
export const updateSetting  = (key, value) => API.put('/reports/settings', { key, value });
