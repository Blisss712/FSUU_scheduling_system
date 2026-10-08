import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ROLE_LABELS, ROLES } from '../config/schedule';

// Member profile screen: display name editing, notification preferences, the
// campus community directory, plus Admin/Staff-only "+ Add Member" and
// row-level removal with self-removal guards.
const EMPTY_NEW_MEMBER = {
  name: '',
  email: '',
  role: 'student',
  department: 'Institutional',
  status: 'active',
  notify_email: true,
  notify_in_app: true
};

export default function ProfileView() {
  const {
    user,
    users,
    updateProfile,
    addUser,
    deleteUser,
    logout,
    authMode,
    dbMode,
    isSessionLive,
    token
  } = useContext(AuthContext);

  const [name, setName] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Admin/Staff-only "add member" form state.
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState(EMPTY_NEW_MEMBER);
  const [addingMember, setAddingMember] = useState(false);
  const [directoryMessage, setDirectoryMessage] = useState('');
  const [directoryError, setDirectoryError] = useState('');

  // Keep the editable fields in sync with the active account.
  useEffect(() => {
    if (user) {
      setName(user.name);
      setNotifyEmail(Boolean(user.notify_email));
      setNotifyInApp(Boolean(user.notify_in_app));
      setMessage('');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="profile-view">
        <p className="empty-state">
          No active account. Use <strong>Switch Account</strong> in the navigation bar to pick a
          member.
        </p>
      </div>
    );
  }

  // Admin / Staff manage the directory. Faculty and students may edit only
  // their own profile.
  const isAdmin = user.role === 'staff';

  const handleSave = async () => {
    setSaving(true);
    const updated = await updateProfile({
      name,
      notify_email: notifyEmail,
      notify_in_app: notifyInApp
    });
    setSaving(false);
    setMessage(updated && !updated.error ? 'Profile saved ✓' : 'Could not save profile.');
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setAddingMember(true);
    setDirectoryError('');
    setDirectoryMessage('');

    const created = await addUser(newMember);
    setAddingMember(false);

    if (created && created.error) {
      setDirectoryError(created.error);
      return;
    }
    setDirectoryMessage(`${created.name} was added to the campus community.`);
    setNewMember(EMPTY_NEW_MEMBER);
    setShowAddForm(false);
  };

  const handleDeleteMember = async (account) => {
    if (account.id === user.id) return;
    setDirectoryError('');
    setDirectoryMessage('');

    const result = await deleteUser(account.id);
    if (result && result.error) {
      setDirectoryError(result.error);
      return;
    }
    setDirectoryMessage(`${account.name} was removed from the campus community.`);
  };

  return (
    <div className="profile-view">
      <div className="profile-layout">
        <section className="profile-card card">
          <h3>Account Details</h3>
          <div className="profile-header">
            <span className="profile-avatar" aria-hidden="true">
              {user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
            </span>
            <div>
              <p className="profile-name">{user.name}</p>
              <p className="profile-email">{user.email}</p>
              <span className={`role-badge role-${user.role}`}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </div>

          <label className="field-label">
            Display Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <p className="field-note">
            Member type: <strong>{ROLE_LABELS[user.role] || user.role}</strong>
            {user.department ? ` · ${user.department}` : ''}
          </p>

          <fieldset className="notify-fieldset">
            <legend>Activity Reminder Preferences</legend>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
              />
              Email reminders ({user.email})
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={notifyInApp}
                onChange={(e) => setNotifyInApp(e.target.checked)}
              />
              In-app notifications
            </label>
          </fieldset>

          <div className="profile-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn" onClick={logout}>
              Sign Out
            </button>
            {message && <span className="save-message">{message}</span>}
          </div>

          {/* Dual-Mode Architecture & Active Session Readout */}
          <div className="system-status-card">
            <h4>System &amp; Connection Status</h4>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-item-label">Database Layer</span>
                <span className={`auth-mode-tag ${dbMode === 'live' ? 'mode-live' : 'mode-demo'}`}>
                  {dbMode === 'live' ? '🗄️ Supabase PostgreSQL' : '🟡 Local Demo Store'}
                </span>
                <p className="status-item-note">
                  {dbMode === 'live'
                    ? 'Live PostgreSQL database connected.'
                    : 'Temporary in-memory storage (resets on restart).'}
                </p>
              </div>

              <div className="status-item">
                <span className="status-item-label">Authentication Layer</span>
                <span className={`auth-mode-tag ${authMode === 'live' ? 'mode-live' : 'mode-demo'}`}>
                  {authMode === 'live' ? '🔐 Supabase Auth' : '🧪 Temporary Demo Auth'}
                </span>
                <p className="status-item-note">
                  {authMode === 'live'
                    ? 'Cloud JWT credentials verified by Supabase.'
                    : 'Local passwordless fallback demo authentication.'}
                </p>
              </div>

              <div className="status-item full-width">
                <span className="status-item-label">Your Active Session</span>
                <div className="session-detail-line">
                  <span className={`session-auth-pill ${isSessionLive ? 'live' : 'demo'}`}>
                    {isSessionLive ? '🔐 Supabase Cloud Session' : '🧪 Temporary Local Demo Session'}
                  </span>
                  <span className="token-preview">
                    Token: <code>{token ? (token.startsWith('demo.') ? token : `${token.slice(0, 18)}...`) : 'None'}</code>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="committee-card card">
          <h3>Campus Community</h3>

          {isAdmin && (
            <>
              <div className="profile-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowAddForm((open) => !open);
                    setDirectoryError('');
                    setDirectoryMessage('');
                  }}
                >
                  {showAddForm ? 'Close Form' : '➕ Add Member'}
                </button>
                <span className="modal-hint">
                  Admin / Staff only — create or remove accounts.
                </span>
              </div>

              {showAddForm && (
                <form className="add-member-form" onSubmit={handleAddMember}>
                  <h3>New Community Member</h3>

                  <label className="field-label">
                    Full Name
                    <input
                      placeholder="e.g. Maria L. Santos"
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                      required
                    />
                  </label>

                  <label className="field-label">
                    Institutional Email
                    <input
                      type="email"
                      placeholder="e.g. maria.santos@school.edu.ph"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      required
                    />
                  </label>

                  <label className="field-label">
                    Member Type
                    <select
                      value={newMember.role}
                      onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field-label">
                    Department / College
                    <input
                      placeholder="e.g. College of Engineering"
                      value={newMember.department}
                      onChange={(e) => setNewMember({ ...newMember, department: e.target.value })}
                    />
                  </label>

                  <label className="field-label">
                    Status
                    <select
                      value={newMember.status}
                      onChange={(e) => setNewMember({ ...newMember, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>

                  <div className="form-actions">
                    <button className="btn btn-primary" type="submit" disabled={addingMember}>
                      {addingMember ? 'Adding...' : 'Add to Community'}
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewMember(EMPTY_NEW_MEMBER);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {directoryError && <p className="form-error">⚠ {directoryError}</p>}
          {directoryMessage && <p className="save-message">{directoryMessage}</p>}

          <table className="committee-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Member Type</th>
                <th>Department</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id} className={user.id === account.id ? 'current-row' : ''}>
                  <td>{account.name}</td>
                  <td>{account.email}</td>
                  <td>
                    <span className={`role-badge role-${account.role}`}>
                      {ROLE_LABELS[account.role] || account.role}
                    </span>
                  </td>
                  <td>{account.department || '—'}</td>
                  <td>
                    <span className={`status-pill ${account.status === 'active' ? 'pill-active' : 'pill-suspended'}`}>
                      {account.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      {account.id === user.id ? (
                        <span className="modal-hint">Current account</span>
                      ) : (
                        <button
                          className="delete-btn"
                          title={`Remove ${account.name}`}
                          aria-label={`Remove ${account.name}`}
                          onClick={() => handleDeleteMember(account)}
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
