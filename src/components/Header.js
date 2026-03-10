import React from 'react';
import './Header.css';
import WindfireLogo from './WindfireLogo';

const NAV_ITEMS = [
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'calendar',    label: 'Calendar' },
  { key: 'maps',        label: 'Maps' },
];

export default function Header({ currentPage, onNavigate, user, onLogout }) {
  return (
    <header className="wf-header">
      <button
        className="wf-header-logo"
        onClick={() => onNavigate('home')}
        aria-label="Go to home"
      >
        <WindfireLogo size="small" />
      </button>

      <nav className="wf-header-nav">
        {NAV_ITEMS.map(({ key, label }) => (
          <button
            key={key}
            className={`wf-header-nav-item${currentPage === key ? ' active' : ''}`}
            onClick={() => onNavigate(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="wf-header-user">
        <span className="wf-header-username">
          {user?.name || user?.preferred_username || 'User'}
        </span>
        <button className="wf-header-signout" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
