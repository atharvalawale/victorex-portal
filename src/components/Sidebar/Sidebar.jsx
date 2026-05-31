import { NavLink, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const NAV_MAIN = [
  { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { to: '/orders',    icon: 'ti-shopping-cart',    label: 'Orders', badge: 7 },
  { to: '/dealers',   icon: 'ti-users',            label: 'Dealers' },
  { to: '/khata',     icon: 'ti-notebook',         label: 'Khata / Ledger' },
  { to: '/cheques',   icon: 'ti-writing',          label: 'Cheques' },
  { to: '/analytics', icon: 'ti-chart-bar',        label: 'Analytics' },
  { to: '/invoices',  icon: 'ti-file-invoice',     label: 'Invoices' },
  
  { to: '/export',    icon: 'ti-file-spreadsheet', label: 'Export' },
  { to: '/report',    icon: 'ti-file-analytics',   label: 'Daily Report' },
  
  
];

const NAV_MORE = [
  { to: '/stock',    icon: 'ti-package',  label: 'Stock' },
  { to: '/offers',   icon: 'ti-tag',      label: 'Offers' },
  { to: '/settings', icon: 'ti-settings', label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();

  function handleLogout() {
    sessionStorage.removeItem('vx_auth');
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
          {NAV_MAIN.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
              onClick={onClose}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              {item.label}
              {item.badge && <span className="sidebar-item-badge">{item.badge}</span>}
            </NavLink>
          ))}

          <div className="sidebar-divider" />
          <div className="sidebar-section-label">More</div>
          {NAV_MORE.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
              onClick={onClose}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-inner" onClick={handleLogout} title="Sign out">
            <div className="sidebar-avatar">SL</div>
            <div className="sidebar-user-info">
              <div className="uname">Sanjay Lawale</div>
              <div className="urole">Administrator</div>
            </div>
            <i className="ti ti-logout sidebar-user-logout" aria-hidden="true" />
          </div>
        </div>
      </aside>
    </>
  );
}