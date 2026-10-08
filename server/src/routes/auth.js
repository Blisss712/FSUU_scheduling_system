// Authentication and campus community endpoints.
//
// Every route works in both modes. In Live mode Supabase Auth owns the
// credentials; otherwise the temporary demo auth takes over. Which one answered
// is reported on every response and by /api/health, so the frontend can show it.
import { Router } from 'express';
import { getSupabase, getMode } from '../config/supabase.js';
import {
  authMode,
  publicConfig,
  signIn,
  signUp,
  signOut,
  getUserFromToken,
  provisionAuthUser,
  listMembers,
  demoStore
} from '../services/auth-service.js';

const router = Router();

const ROLES = ['faculty', 'student', 'staff', 'visitor'];
const STATUS_VALUES = ['active', 'suspended'];

// Reads the caller's access token from the Authorization header.
const tokenFrom = (req) => {
  const header = req.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
};

// Resolves the signed-in member for a request, or null when not signed in.
async function currentMember(req) {
  const token = tokenFrom(req);
  if (token) {
    const result = await getUserFromToken(token);
    return result.ok ? result.profile : null;
  }

  // Temporary demo sessions are tracked in server memory, so a request without
  // a token can still resolve the most recent demo sign-in.
  if (demoStore.session.currentUserId) {
    return demoStore.findUserById(demoStore.session.currentUserId);
  }
  return null;
}

// GET /api/auth/config - what the frontend needs to pick an auth strategy
router.get('/config', (req, res) => {
  res.json(publicConfig());
});

// GET /api/auth/status - database mode, auth implementation and session overview
router.get('/status', async (req, res) => {
  const member = await currentMember(req);
  res.json({
    ...getMode(),
    authenticated: Boolean(member),
    sessionAuth: member?.auth_mode || (member ? 'demo' : null),
    userCount: (await listMembers()).length
  });
});

// GET /api/auth/users - full campus community directory
router.get('/users', async (req, res) => {
  res.json(await listMembers());
});

// GET /api/auth/me - currently active member
router.get('/me', async (req, res) => {
  res.json((await currentMember(req)) || null);
});

// POST /api/auth/login - sign in.
// Live mode requires { email, password }; the temporary demo auth needs only
// the email, because it has no passwords by design. Supplying { fallback: true }
// invokes the temporary demo login even when live Supabase is configured.
router.post('/login', async (req, res) => {
  const { email, password, fallback } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'An email address is required.' });
  }
  if (authMode() === 'live' && !fallback && !password) {
    return res.status(400).json({ error: 'A password is required.' });
  }

  const result = await signIn({ email, password, fallback: Boolean(fallback) });
  if (!result.ok) {
    return res.status(result.status || 401).json({
      error: result.error,
      canFallback: Boolean(result.canFallback)
    });
  }

  res.json({
    user: result.profile,
    token: result.token,
    auth: result.mode,
    temporaryAuth: Boolean(result.temporaryAuth)
  });
});

// POST /api/auth/signup - create an account.
// Supabase may require email confirmation first; that is reported back so the
// UI can tell the member to check their inbox. Supplying { fallback: true }
// signs up through the temporary demo directory.
router.post('/signup', async (req, res) => {
  const { email, password, name, role, department, fallback } = req.body || {};

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'Your name is required.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (authMode() === 'live' && !fallback && (!password || String(password).length < 6)) {
    return res.status(400).json({ error: 'A password of at least 6 characters is required.' });
  }
  if (role !== undefined && !ROLES.includes(role)) {
    return res.status(400).json({ error: `Member type must be one of: ${ROLES.join(', ')}` });
  }

  const result = await signUp({ email, password, name, role, department, fallback: Boolean(fallback) });
  if (!result.ok) {
    return res.status(result.status || 400).json({
      error: result.error,
      canFallback: Boolean(result.canFallback)
    });
  }

  res.status(201).json({
    user: result.profile,
    token: result.token,
    auth: result.mode,
    temporaryAuth: Boolean(result.temporaryAuth),
    needsEmailConfirmation: Boolean(result.needsEmailConfirmation)
  });
});

// POST /api/auth/logout - end the session
router.post('/logout', async (req, res) => {
  await signOut(tokenFrom(req));
  res.json({ ok: true });
});

// PUT /api/auth/profile - update display name & reminder preferences
router.put('/profile', async (req, res) => {
  const member = await currentMember(req);
  if (!member) {
    return res.status(401).json({ error: 'No active session. Sign in first.' });
  }

  const { name, notify_email, notify_in_app } = req.body || {};
  if (name !== undefined && String(name).trim() === '') {
    return res.status(400).json({ error: 'Display name cannot be empty.' });
  }

  const updates = {
    ...(name !== undefined ? { name: String(name).trim() } : {}),
    ...(notify_email !== undefined ? { notify_email: Boolean(notify_email) } : {}),
    ...(notify_in_app !== undefined ? { notify_in_app: Boolean(notify_in_app) } : {})
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', member.id)
        .select()
        .maybeSingle();
      if (!error && data) return res.json(data);
      if (error) {
        console.error('Supabase profile update failed, falling back to demo store:', error.message);
      }
    } catch (err) {
      console.error('Supabase unreachable, falling back to demo store:', err.message);
    }
  }

  const target = demoStore.findUserById(member.id);
  if (!target) {
    return res.status(404).json({ error: 'Active account not found in the directory.' });
  }
  Object.assign(target, updates);
  res.json(target);
});

// POST /api/auth/users - create a member (Admin / Staff)
router.post('/users', async (req, res) => {
  const { name, email, role, department, status, password, notify_email, notify_in_app } =
    req.body || {};

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: 'Member name is required.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'A valid institutional email address is required.' });
  }
  if (role !== undefined && !ROLES.includes(role)) {
    return res.status(400).json({ error: `Member type must be one of: ${ROLES.join(', ')}` });
  }
  if (status !== undefined && !STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUS_VALUES.join(', ')}` });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const existing = await listMembers();
  if (existing.some((u) => String(u.email).toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: `${cleanEmail} is already registered to a campus account.` });
  }

  // In live mode Supabase Auth must own the credential, so the account is
  // created there first and its id is stored on the profile row.
  const provisioned = await provisionAuthUser({
    email: cleanEmail,
    password,
    name: String(name).trim(),
    role: role || 'student',
    department: department || 'Institutional'
  });
  if (!provisioned.ok) {
    return res.status(400).json({ error: provisioned.error });
  }

  const newProfile = {
    id: provisioned.authUserId || `user-${Date.now()}`,
    name: String(name).trim(),
    email: cleanEmail,
    role: role || 'student',
    department: department ? String(department) : 'Institutional',
    status: status || 'active',
    notify_email: notify_email !== undefined ? Boolean(notify_email) : true,
    notify_in_app: notify_in_app !== undefined ? Boolean(notify_in_app) : true,
    ...(provisioned.authUserId ? { auth_user_id: provisioned.authUserId } : {})
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .maybeSingle();
      if (!error && data) {
        return res.status(201).json({
          ...data,
          needsEmailConfirmation: Boolean(provisioned.needsEmailConfirmation)
        });
      }
      if (error) {
        console.error('Supabase member insert failed, falling back to demo store:', error.message);
      }
    } catch (err) {
      console.error('Supabase unreachable, falling back to demo store:', err.message);
    }
  }

  const created = demoStore.addUser(newProfile);
  return res.status(201).json({
    ...created,
    needsEmailConfirmation: Boolean(provisioned.needsEmailConfirmation)
  });
});

// DELETE /api/auth/users/:id - remove a member
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  const caller = await currentMember(req);

  if (caller && caller.id === id) {
    return res.status(400).json({ error: 'You cannot remove the account you are signed in as.' });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      // Unassign this member from any activity first so no foreign key dangles.
      await supabase.from('tasks').update({ assignee_id: null }).eq('assignee_id', id);
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) {
        demoStore.deleteUser(id);
        return res.json({ success: true, id });
      }
      console.error('Supabase member delete failed, falling back to demo store:', error.message);
    } catch (err) {
      console.error('Supabase unreachable, falling back to demo store:', err.message);
    }
  }

  const removed = demoStore.deleteUser(id);
  if (!removed) {
    return res.status(404).json({ error: `No campus account found with id ${id}` });
  }
  return res.json({ success: true, id, name: removed.name });
});

export default router;
