const express  = require('express');
const cors     = require('cors');
const path     = require('path');

const app = express();

// ==========================================
// Middleware
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الصور
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// Routes
// ==========================================
app.use('/api/products',  require('./routes/products'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/sales',     require('./routes/sales'));
app.use('/api/finance',   require('./routes/finance'));
app.use('/api/reports',   require('./routes/reports'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '✅ السيرفر شغال', time: new Date().toLocaleString('ar-EG') });
});

// ==========================================
// Frontend Static Files (React Build)
// ==========================================
const frontendBuildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuildPath));

// Any non-API GET request serves React index.html for SPA routing
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// ==========================================
// Start Server
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`);
});
