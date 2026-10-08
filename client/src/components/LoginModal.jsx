import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { ROLE_LABELS, ROLES } from '../config/schedule';

// Sign-in sheet. It adapts to whichever authentication is active:
//
//   LIVE     - Supabase Auth: email + password, with an optional sign-up form.
//   FALLBACK - the temporary demo auth: pick any campus account to sign in as,
//              plus a sign-up form that adds a member.
//
// The active mode is stated at the top so it is never ambiguous which one is
// answering.
export default function LoginModal({ onClose }) {
  const { user, users, authMode, login, loginDemo, signup, switchUser } = useContext(AuthContext);

  const isLive = authMode === 'live';
  const [view, setView] = useState('signin'); // signin | signup
  const [showFallbackDemo, setShowFallbackDemo] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [department, setDepartment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [canFallback, setCanFallback] = useState(false);

  const reset = () => {
    setError('');
    setNotice('');
    setCanFallback(false);
  };

  const handleSignIn = async (e) => {
    e?.preventDefault();
    reset();
    setBusy(true);
    const result = await login(email, password);
    setBusy(false);

    if (result && result.error) {
      setError(result.error);
      if (result.canFallback) setCanFallback(true);
      return;
    }
    onClose();
  };

  const handleSignUp = async (e) => {
    e?.preventDefault();
    reset();
    setBusy(true);
    const result = await signup({ email, password, name, role, department });
    setBusy(false);

    if (result && result.error) {
      setError(result.error);
      if (result.canFallback) setCanFallback(true);
      return;
    }
    if (result && result.needsEmailConfirmation) {
      setView('signin');
      setNotice(`Account created. Check ${email} to confirm your address, then sign in.`);
      return;
    }
    onClose();
  };

  const handlePick = async (account) => {
    reset();
    setBusy(true);
    await switchUser(account.email);
    setBusy(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{view === 'signup' ? 'Create an Account' : 'Sign In'}</h2>
          <span className={`auth-mode-tag ${isLive ? 'mode-live' : 'mode-demo'}`}>
            {isLive ? '🔐 Supabase Auth' : '🧪 Temporary demo auth'}
          </span>
        </div>

        <p className="modal-hint">
          {isLive
            ? 'Live Supabase Auth is active: sign in with your email and password, or use the temporary fallback demo below.'
            : 'Supabase Auth is not configured: this system is using temporary local demo auth. Pick any seeded account below without password.'}
        </p>

        {error && (
          <div className="form-error-box">
            <p className="form-error">⚠ {error}</p>
            {canFallback && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { reset(); setShowFallbackDemo(true); }}
              >
                🧪 Switch to Temporary Demo Auth
              </button>
            )}
          </div>
        )}
        {notice && <p className="save-message">{notice}</p>}

        {view === 'signin' && isLive && !showFallbackDemo && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <label className="field-label">
              Institutional Email
              <input
                type="email"
                autoComplete="username"
                placeholder="e.g. janilla.jumaang@school.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Password
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Signing in...' : 'Sign In'}
              </button>
              <button className="btn" type="button" onClick={onClose}>Cancel</button>
            </div>
            <div className="modal-footer-links">
              <button
                className="link-button"
                type="button"
                onClick={() => { reset(); setView('signup'); }}
              >
                Need an account? Sign up
              </button>
              <span className="dot-divider">•</span>
              <button
                className="link-button"
                type="button"
                onClick={() => { reset(); setShowFallbackDemo(true); }}
              >
                🧪 Use Temporary Demo Auth
              </button>
            </div>
          </form>
        )}

        {view === 'signin' && (showFallbackDemo || !isLive) && (
          <>
            <div className="demo-notice-bar">
              <span>🧪 <strong>Temporary Fallback Demo Auth</strong>: 1-click test login</span>
              {isLive && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => { reset(); setShowFallbackDemo(false); }}
                >
                  Back to Supabase Auth
                </button>
              )}
            </div>
            <div className="account-list">
              {users.map((account) => (
                <button
                  key={account.id}
                  className={`account-card ${user && user.id === account.id ? 'current' : ''}`}
                  onClick={() => handlePick(account)}
                  disabled={busy}
                >
                  <span className="account-avatar" aria-hidden="true">
                    {account.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                  </span>
                  <span className="account-info">
                    <span className="account-name">{account.name}</span>
                    <span className="account-email">{account.email}</span>
                  </span>
                  <span className={`role-badge role-${account.role}`}>
                    {ROLE_LABELS[account.role] || account.role}
                  </span>
                </button>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn" type="button" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => { reset(); setView('signup'); }}
              >
                ➕ Add Member
              </button>
            </div>
          </>
        )}

        {view === 'signup' && (
          <form className="auth-form" onSubmit={handleSignUp}>
            <label className="field-label">
              Full Name
              <input
                placeholder="e.g. Maria L. Santos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Institutional Email
              <input
                type="email"
                autoComplete="username"
                placeholder="e.g. maria.santos@school.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            {isLive && (
              <label className="field-label">
                Password
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
            )}

            <div className="form-row">
              <label className="field-label">
                Member Type
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((option) => (
                    <option key={option} value={option}>{ROLE_LABELS[option]}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Department / College
                <input
                  placeholder="e.g. College of Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </label>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating...' : 'Create Account'}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => { reset(); setView('signin'); }}
              >
                Back
              </button>
            </div>
            {!isLive && (
              <p className="modal-hint">
                The temporary demo auth has no passwords, so this adds the member to the
                local directory and signs you in as them.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
