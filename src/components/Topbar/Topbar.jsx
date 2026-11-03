import dayjs from 'dayjs';
import './Topbar.css';

export default function Topbar({ title, onMenuClick }) {
  const hour = dayjs().hour();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
          <i className="ti ti-menu-2" aria-hidden="true" />
        </button>
        <h1 className="topbar-title">{title || `${greeting} 👋`}</h1>
      </div>
      <div className="topbar-right">
        <span className="topbar-date">
          <i className="ti ti-calendar" aria-hidden="true" />
          {dayjs().format('ddd, DD MMM YYYY')}
        </span>
      </div>
    </header>
  );
}
