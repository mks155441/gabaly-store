import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard   from './pages/Dashboard';
import Products    from './pages/Products';
import Purchases   from './pages/Purchases';
import Sales       from './pages/Sales';
import Customers   from './pages/Customers';
import Finance     from './pages/Finance';
import Reports     from './pages/Reports';
import Settings    from './pages/Settings';

// أيقونات SVG مطابقة تماماً لتصميم Drivery
const Icons = {
  LogoEmblem: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 7C8 4.5 16 4.5 20 7" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
      <path d="M3 12.5C3 12.5 6 18.5 12 18.5C18 18.5 21 12.5 21 12.5C21 12.5 18 15 12 15C6 15 3 12.5 3 12.5Z" fill="#10b981" />
    </svg>
  ),
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
      <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
      <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
      <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
    </svg>
  ),
  Reports: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  ),
  Products: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  ),
  Purchases: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"></rect>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
      <circle cx="5.5" cy="18.5" r="2.5"></circle>
      <circle cx="18.5" cy="18.5" r="2.5"></circle>
    </svg>
  ),
  Sales: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <path d="M16 10a4 4 0 0 1-8 0"></path>
    </svg>
  ),
  Customers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
  Finance: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
      <line x1="2" y1="10" x2="22" y2="10"></line>
      <circle cx="16" cy="15" r="1.5"></circle>
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  Logout: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  )
};

const navItems = [
  { to: '/',          icon: <Icons.Dashboard />, label: 'لوحة التحكم',   end: true },
  { to: '/sales',     icon: <Icons.Sales />,     label: 'الكاشير' },
  { to: '/products',  icon: <Icons.Products />,  label: 'المخزن' },
  { to: '/purchases', icon: <Icons.Purchases />, label: 'المشتريات' },
  { to: '/customers', icon: <Icons.Customers />, label: 'العملاء' },
  { to: '/reports',   icon: <Icons.Reports />,   label: 'الجرد' },
  { to: '/finance',   icon: <Icons.Finance />,   label: 'الخزينة' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* ========================================================
            قائمة Drivery العصرية بكبسولات منفصلة وبألواننا (Emerald)
            ======================================================== */}
        <aside className="sidebar">
          {/* Logo Header */}
          <div className="sidebar-brand-header">
            <Icons.LogoEmblem />
            <span className="brand-title-text">الجبلي ستور</span>
          </div>

          {/* Capsule Nav List */}
          <nav className="sidebar-capsule-nav">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-capsule-item${isActive ? ' active' : ''}`}
              >
                <div className="nav-capsule-main">
                  <span className="nav-capsule-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="nav-capsule-badge">{item.badge}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom Flat Links (Account settings & Logout) */}
          <div className="sidebar-bottom-section">
            <NavLink
              to="/settings"
              className={({ isActive }) => `bottom-flat-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-capsule-icon"><Icons.Settings /></span>
              <span>إعدادات النظام</span>
            </NavLink>

            <button
              type="button"
              className="bottom-flat-link"
              onClick={() => alert('تم تسجيل الخروج بنجاح')}
            >
              <span className="nav-capsule-icon"><Icons.Logout /></span>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <Routes>
            <Route path="/"          element={<Dashboard />}  />
            <Route path="/products"  element={<Products />}   />
            <Route path="/purchases" element={<Purchases />}  />
            <Route path="/sales"     element={<Sales />}      />
            <Route path="/customers" element={<Customers />}  />
            <Route path="/finance"   element={<Finance />}    />
            <Route path="/reports"   element={<Reports />}    />
            <Route path="/settings"  element={<Settings />}   />
            <Route path="*"          element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
