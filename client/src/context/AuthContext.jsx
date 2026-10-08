import React, { createContext, useState, useEffect, useCallback } from 'react';

// Global session management for the campus scheduler.
//
// It tracks three things the rest of the app needs:
//   * the signed-in member and the campus community directory
//   * which authentication is answering: Supabase Auth, or the temporary
//     local demo auth
//   * which database is answering: Supabase PostgreSQL, or the local demo store
//
// The two modes are independent, so they are tracked separately and shown
// separately in the navigation bar.
export const AuthContext = createContext();

// The access token is kept in localStorage so a refresh keeps the session.
// In live mode it is a real Supabase token; in demo mode it is a demo pointer.
const TOKEN_KEY = 'schedyuling.token';

const readToken = () => {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const writeToken = (token) => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts only
    // as long as the page.
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [token, setToken] = useState(readToken);
  const [loading, setLoading] = useState(true);

  // Database and authentication modes, each 'live' or 'demo'.
  const [dbMode, setDbMode] = useState('demo');
  const [authMode, setAuthMode] = useState('demo');

  // Authorised fetch: attaches the access token when there is one.
  const api = useCallback(async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    const active = readToken();
    if (active) headers.Authorization = `Bearer ${active}`;

    const res = await fetch(path, { ...options, headers });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  }, []);

  // Reload the community directory (after adding or removing a member).
  const refreshUsers = useCallback(async () => {
    const { ok, data } = await api('/api/auth/users');
    if (ok && Array.isArray(data)) {
      setUsers(data);
      return data;
    }
    return null;
  }, [api]);

  // Adopt a new session: store the token and the member.
  const adoptSession = useCallback((member, accessToken) => {
    writeToken(accessToken || null);
    setToken(accessToken || null);
    setUser(member || null);
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const [health, config, directory, me] = await Promise.all([
        api('/api/health'),
        api('/api/auth/config'),
        api('/api/auth/users'),
        api('/api/auth/me')
      ]);

      if (health.ok && health.data) {
        setDbMode(health.data.db || (health.data.supabase ? 'live' : 'demo'));
        setAuthMode(health.data.auth || 'demo');
      }
      // The auth config can correct the mode reported by health.
      if (config.ok && config.data && config.data.auth) {
        setAuthMode(config.data.auth);
      }
      if (directory.ok && Array.isArray(directory.data)) setUsers(directory.data);
      setUser(me.ok && me.data ? me.data : null);
    } catch (err) {
      console.error('Could not reach the scheduler API, running offline:', err);
      setDbMode('demo');
      setAuthMode('demo');
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Sign in. Live mode needs a password; the temporary demo auth does not.
  // Supplying options = { fallback: true } triggers the temporary demo auth.
  const login = useCallback(
    async (email, password, options = {}) => {
      const { ok, data } = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, fallback: options.fallback })
      });
      if (!ok) return data || { error: 'Sign in failed.' };

      adoptSession(data.user, data.token);
      if (data.auth) setAuthMode(data.auth);
      await refreshUsers();
      return data;
    },
    [api, adoptSession, refreshUsers]
  );

  // 1-click temporary demo auth sign-in
  const loginDemo = useCallback(
    async (email) => {
      return login(email, null, { fallback: true });
    },
    [login]
  );

  // Create an account. Live mode may require email confirmation first.
  const signup = useCallback(
    async (fields, options = {}) => {
      const { ok, data } = await api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ ...fields, fallback: options.fallback })
      });
      if (!ok) return data || { error: 'Sign up failed.' };

      // With confirmation enabled there is no session yet, so stay signed out.
      if (data.token) adoptSession(data.user, data.token);
      if (data.auth) setAuthMode(data.auth);
      await refreshUsers();
      return data;
    },
    [api, adoptSession, refreshUsers]
  );

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    adoptSession(null, null);
  }, [api, adoptSession]);

  // 1-click switch used by the demo member switcher. It signs in by email only,
  // which the temporary demo auth allows.
  const switchUser = useCallback(
    async (email) => {
      const result = await login(email, null, { fallback: true });
      return result && result.user ? result.user : result;
    },
    [login]
  );

  // Profile screen save: display name + reminder preferences.
  const updateProfile = useCallback(
    async (updates) => {
      const { ok, data } = await api('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      if (ok) {
        setUser(data);
        await refreshUsers();
      }
      return data;
    },
    [api, refreshUsers]
  );

  // Admin action: create a member.
  const addUser = useCallback(
    async (profile) => {
      const { ok, data } = await api('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify(profile)
      });
      if (ok) await refreshUsers();
      return data;
    },
    [api, refreshUsers]
  );

  // Admin action: remove a member. The API refuses to remove the caller.
  const deleteUser = useCallback(
    async (id) => {
      const { ok, data } = await api(`/api/auth/users/${id}`, { method: 'DELETE' });
      if (ok) await refreshUsers();
      return data;
    },
    [api, refreshUsers]
  );

  // How the active session authenticated: 'live' (Supabase Auth) vs 'demo' (Temporary demo auth)
  const sessionAuthMode = user
    ? (user.auth_mode || (token?.startsWith('demo.') ? 'demo' : (authMode === 'live' ? 'live' : 'demo')))
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        token,
        login,
        loginDemo,
        signup,
        logout,
        switchUser,
        updateProfile,
        addUser,
        deleteUser,
        refreshUsers,
        api,
        loading,
        dbMode,
        authMode,
        sessionAuthMode,
        // Backwards-compatible alias: the database is the layer the original
        // badge described.
        isLive: dbMode === 'live',
        isAuthLive: authMode === 'live',
        isSessionLive: sessionAuthMode === 'live'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
