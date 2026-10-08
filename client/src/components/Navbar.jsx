import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ROLE_LABELS, ROLE_SHORT_LABELS } from '../config/schedule';

// Friendly labels for the member types live in config/schedule.js; re-exported
// here so existing imports keep working.
export { ROLE_LABELS };

const TABS = [
  { id: 'events', label: 'Schedule' },
  { id: 'calendar', label: 'Timeline' },
  { id: 'profile', label: 'My Profile' }
];

// One badge per layer, because the database and the authentication can each be
// on Supabase or on the local fallback independently.
function ModeBadge({ label, mode }) {
  const live = mode === 'live';
  return (
    <span
      className={`status-badge ${live ? 'live' : 'local'}`}
      title={
        live
          ? `${label}: live Supabase`
          : `${label}: local ${label === 'Auth' ? 'temporary demo auth' : 'demo store'}`
      }
    >
      <span className="status-badge-label">{label}</span>
      {live ? '🟢 Supabase' : '🟡 Local demo'}
    </span>
  );
}

export default function Navbar({ activeTab, onTabChange, onSwitchAccount }) {
  const { user, dbMode, authMode, isSessionLive } = useContext(AuthContext);
  const roleLabel = user ? ROLE_SHORT_LABELS[user.role] || user.role : null;
  const anyDemo = dbMode !== 'live' || authMode !== 'live';

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo" aria-hidden="true">🏫</span>
        <div>
          <h1>School Event Scheduler</h1>
          <span className="navbar-subtitle">Campus activities, exams &amp; assemblies</span>
        </div>
      </div>

      <div className="navbar-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="navbar-right">
        <div className="mode-badges">
          <ModeBadge label="DB" mode={dbMode} />
          <ModeBadge label="Auth" mode={authMode} />
        </div>

        {user ? (
          <button className="user-chip" onClick={onSwitchAccount} title="Switch account / view authentication">
            <span className={`role-badge role-${user.role}`}>{roleLabel}</span>
            <span className="user-chip-name">{user.name}</span>
            <span
              className={`session-auth-pill ${isSessionLive ? 'live' : 'demo'}`}
              title={isSessionLive ? 'Signed in via Supabase Auth' : 'Signed in via Temporary Demo Auth'}
            >
              {isSessionLive ? '🔐 Supabase' : '🧪 Demo'}
            </span>
          </button>
        ) : (
          <button className="btn btn-on-dark" onClick={onSwitchAccount}>
            Sign In
          </button>
        )}
      </div>

      {anyDemo && (
        <p className="demo-notice">
          {dbMode !== 'live' && authMode !== 'live'
            ? 'Running in Local Demo mode: Database (local store) & Authentication (temporary fallback auth).'
            : dbMode !== 'live'
              ? 'Database is running on the local demo store. Authentication is live Supabase Auth.'
              : 'Authentication is running on the temporary demo fallback. Database is live Supabase.'}
        </p>
      )}
    </nav>
  );
}
