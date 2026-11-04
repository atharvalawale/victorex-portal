import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import './Sidebar.css';

const NAV_MAIN = [
  { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { to: '/orders', icon: 'ti-shopping-cart', label: 'Orders' },
  { to: '/creditbalance', icon: 'ti-credit-card', label: 'Credit Balance' },
  { to: '/dealers', icon: 'ti-users', label: 'Dealers' },
  { to: '/pricelist', icon: 'ti-receipt', label: 'Price List' },
  { to: '/products', icon: 'ti-package', label: 'Products' },
  { to: '/khata', icon: 'ti-book', label: 'Khata / Ledger' },
  { to: '/cheques', icon: 'ti-writing', label: 'Cheques' },
  { to: '/analytics', icon: 'ti-chart-bar', label: 'Analytics' },
  { to: '/invoices', icon: 'ti-file-invoice', label: 'Invoices' },
];

const NAV_MORE = [
  {
    to: '/batch-costing',
    icon: 'ti-lock',
    label: 'Batch Costing',
    ownerOnly: 'atharvalawale383@gmail.com',
  },
  { to: '/suppliers', icon: 'ti-truck', label: 'Suppliers' },
  { to: '/purchases', icon: 'ti-shopping-bag', label: 'Purchases' },
  { to: '/costcalc', icon: 'ti-calculator', label: 'Cost Calculator' },
  { to: '/stock', icon: 'ti-package', label: 'Stock' },
  { to: '/export', icon: 'ti-file-spreadsheet', label: 'Export' },
  { to: '/report', icon: 'ti-file-analytics', label: 'Daily Report' },
  { to: '/offers', icon: 'ti-tag', label: 'Offers' },
  { to: '/settings', icon: 'ti-settings', label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');

  const visibleMore = NAV_MORE.filter(
    item => !item.ownerOnly || userEmail.toLowerCase() === item.ownerOnly
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email || '');
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-inner">
            <div className="sidebar-logo-mark"><span>V</span></div>
            <div className="sidebar-logo-text">
              <div className="name">Victorex</div>
              <div className="sub">Portal</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main</div>

          {NAV_MAIN.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-item${isActive ? ' active' : ''}`
              }
              onClick={onClose}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              {item.label}
              {item.badge && (
                <span className="sidebar-item-badge">{item.badge}</span>
              )}
            </NavLink>
          ))}

          <div className="sidebar-divider" />
          <div className="sidebar-section-label">More</div>

          {visibleMore.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-item${isActive ? ' active' : ''}`
              }
              onClick={onClose}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div
            className="sidebar-user-inner"
            onClick={handleLogout}
            title="Sign out"
          >
            <div className="sidebar-avatar">
              {userEmail ? userEmail[0].toUpperCase() : 'A'}
            </div>
            <div className="sidebar-user-info">
              <div className="uname" title={userEmail}>
                {userEmail || 'Administrator'}
              </div>
              <div className="urole">Administrator</div>
            </div>
            <i className="ti ti-logout sidebar-user-logout" aria-hidden="true" />
          </div>
        </div>
      </aside>
    </>
  );
}