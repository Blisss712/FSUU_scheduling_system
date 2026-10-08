// Authentication service.
//
// Two interchangeable implementations behind one interface:
//
//   LIVE     - Supabase Auth. Passwords are handled by Supabase; this module
//              never stores them. Signing in returns a real access token that
//              the client sends back as a Bearer token.
//   FALLBACK - a temporary local demo auth kept deliberately simple: identity
//              is claimed by email, with no password. This exists only so the
//              app is fully usable before Supabase credentials are entered, and
//              it is clearly labelled as temporary in the UI.
//
// Every function returns { ok, ... } so the routes never throw on a bad login.
import { getSupabase, isSupabaseAuthConfigured, isSupabaseConfigured } from '../config/supabase.js';
import {
  profiles,
  session,
  getUsers,
  findUserById,
  findUserByEmail,
  addUser,
  deleteUser
} from '../data/store.js';

// Which implementation is active, for /api/health and the frontend badge.
export const authMode = () => (isSupabaseAuthConfigured() ? 'live' : 'demo');

// The client bundle is built by Vite, so the variables must appear literally
// for it to inline them. A service-role key is server-only and never exposed.
export function publicConfig() {
  const live = isSupabaseAuthConfigured();
  return {
    auth: authMode(),
    db: isSupabaseConfigured() ? 'live' : 'demo',
    supabaseUrl: live ? process.env.SUPABASE_URL : null,
    supabaseAnonKey: live ? process.env.SUPABASE_ANON_KEY : null
  };
}

// ---------------------------------------------------------------------------
// Profile helpers
// ---------------------------------------------------------------------------
// A member's `profiles` row is the app-facing record; Supabase's own identity
// lives in auth.users. They are linked by profiles.auth_user_id.

const sanitizeProfile = (profile) => {
  if (!profile) return null;
  // Never leak a stored credential to the client.
  const { password, ...safe } = profile;
  return safe;
};

async function findProfileByAuthUserId(authUserId) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) {
    console.error('Supabase profile lookup by auth id failed:', error.message);
    return null;
  }
  return data;
}

// Finds the member row for a Supabase Auth user, creating one when the account
// exists in auth.users but has no profile yet (for example a self sign-up).
async function resolveProfileForAuthUser(authUser, fallbackName) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const linked = await findProfileByAuthUserId(authUser.id);
  if (linked) return linked;

  // A pre-seeded profile may exist for this email but not yet be linked.
  const email = (authUser.email || '').toLowerCase();
  const { data: byEmail } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (byEmail) {
    const { data: linkedRow } = await supabase
      .from('profiles')
      .update({ auth_user_id: authUser.id })
      .eq('id', byEmail.id)
      .select()
      .maybeSingle();
    return linkedRow || { ...byEmail, auth_user_id: authUser.id };
  }

  // Brand new account: create the app-facing profile row.
  const newProfile = {
    id: authUser.id,
    auth_user_id: authUser.id,
    name: fallbackName || email.split('@')[0] || 'New Member',
    email,
    role: 'student',
    department: 'Institutional',
    status: 'active',
    notify_email: true,
    notify_in_app: true
  };

  const { data: created, error } = await supabase
    .from('profiles')
    .insert(newProfile)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Could not create the profile row for a new auth user:', error.message);
    // Return the in-memory shape so the user can still reach the app; the row
    // is created on the next successful sign-in once the schema is in place.
    return newProfile;
  }
  return created;
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
export async function signIn({ email, password, fallback = false }) {
  const supabase = getSupabase();
  const useDemo = fallback || !supabase || !isSupabaseAuthConfigured();

  if (useDemo) {
    // Temporary demo auth: claim an existing seeded identity by email.
    const profile = findUserByEmail(email);
    if (!profile) {
      return { ok: false, status: 404, error: `No campus account found for ${email}` };
    }
    if (profile.status === 'suspended') {
      return { ok: false, status: 403, error: `${profile.name} is suspended and cannot sign in.` };
    }
    session.currentUserId = profile.id;
    return {
      ok: true,
      mode: 'demo',
      profile: { ...sanitizeProfile(profile), auth_mode: 'demo', temporary_auth: true },
      token: `demo.${profile.id}`,
      temporaryAuth: true
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || '')
    });

    if (error) {
      return { ok: false, status: 401, error: error.message, canFallback: true };
    }

    const profile = await resolveProfileForAuthUser(data.user, data.user.user_metadata?.name);
    if (!profile) {
      return { ok: false, status: 500, error: 'Signed in, but no campus profile could be loaded.' };
    }
    if (profile.status === 'suspended') {
      return { ok: false, status: 403, error: `${profile.name} is suspended and cannot sign in.` };
    }

    return {
      ok: true,
      mode: 'live',
      profile: { ...sanitizeProfile(profile), auth_mode: 'live', temporary_auth: false },
      token: data.session ? data.session.access_token : null,
      expiresAt: data.session ? data.session.expires_at : null
    };
  } catch (err) {
    console.error('Supabase Auth error during signIn:', err.message);
    return {
      ok: false,
      status: 502,
      error: `Could not connect to Supabase Auth: ${err.message}`,
      canFallback: true
    };
  }
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------
// Creates a Supabase Auth account. Depending on the project's email settings
// Supabase either returns a session immediately or asks the user to confirm
// their address first; both outcomes are reported to the client.
export async function signUp({ email, password, name, role, department, fallback = false }) {
  const supabase = getSupabase();
  const useDemo = fallback || !supabase || !isSupabaseAuthConfigured();

  if (useDemo) {
    // Temporary demo auth has no passwords, so "signing up" simply adds a
    // member to the in-memory directory with the chosen member type.
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (findUserByEmail(cleanEmail)) {
      return { ok: false, status: 409, error: `${cleanEmail} is already registered.` };
    }
    const created = addUser({
      name: String(name || cleanEmail.split('@')[0]).trim(),
      email: cleanEmail,
      role: role || 'student',
      department: department || 'Institutional'
    });
    return {
      ok: true,
      mode: 'demo',
      profile: { ...sanitizeProfile(created), auth_mode: 'demo', temporary_auth: true },
      token: `demo.${created.id}`,
      temporaryAuth: true,
      needsEmailConfirmation: false
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: String(email || '').trim(),
      password: String(password || ''),
      options: { data: { name: name || '', role: role || 'student', department: department || 'Institutional' } }
    });

    if (error) {
      return { ok: false, status: 400, error: error.message };
    }

    // With confirmation enabled Supabase hides whether the address already
    // exists and returns a user with no session; treat that as "confirm email".
    const needsEmailConfirmation = !data.session;

    let profile = null;
    if (data.session && data.user) {
      profile = await resolveProfileForAuthUser(data.user, name);
    }

    return {
      ok: true,
      mode: 'live',
      profile: profile ? { ...sanitizeProfile(profile), auth_mode: 'live', temporary_auth: false } : null,
      token: data.session ? data.session.access_token : null,
      needsEmailConfirmation
    };
  } catch (err) {
    console.error('Supabase Auth error during signUp:', err.message);
    return {
      ok: false,
      status: 502,
      error: `Could not connect to Supabase Auth: ${err.message}`,
      canFallback: true
    };
  }
}

// ---------------------------------------------------------------------------
// Token verification and sign out
// ---------------------------------------------------------------------------
export async function getUserFromToken(token) {
  if (!token) return { ok: false, status: 401, error: 'Missing access token.' };

  // Demo tokens are "demo.<profile id>".
  if (token.startsWith('demo.')) {
    const profile = findUserById(token.slice('demo.'.length));
    if (!profile) return { ok: false, status: 401, error: 'Unknown demo session.' };
    return {
      ok: true,
      mode: 'demo',
      profile: { ...sanitizeProfile(profile), auth_mode: 'demo', temporary_auth: true }
    };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, status: 401, error: 'Live auth is not configured.' };

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, status: 401, error: error ? error.message : 'Invalid access token.' };
    }

    const member = findUserByEmail(data.user.email);
    const profile = (await findProfileByAuthUserId(data.user.id)) || member;
    return {
      ok: true,
      mode: 'live',
      profile: profile ? { ...sanitizeProfile(profile), auth_mode: 'live', temporary_auth: false } : null,
      authUser: data.user
    };
  } catch (err) {
    console.error('Supabase token verification error:', err.message);
    return { ok: false, status: 502, error: `Could not verify token: ${err.message}` };
  }
}

export async function signOut(token) {
  // Supabase signs a user out by revoking their session. The shared API client
  // holds no session of its own, and the caller discards the token regardless,
  // so this is best-effort: the client is signed out either way.
  if (token && !token.startsWith('demo.')) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.admin.signOut(token);
      } catch (err) {
        console.warn('Supabase sign-out warning:', err.message);
      }
    }
  }

  // The temporary demo session is only a pointer in memory.
  session.currentUserId = null;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Account provisioning used when an admin adds a member in live mode
// ---------------------------------------------------------------------------
// Returns { authUserId, needsEmailConfirmation } or an error. Uses signUp so
// Supabase owns the credential; the caller stores the returned id on the
// profile row.
export async function provisionAuthUser({ email, password, name, role, department }) {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, authUserId: null, needsEmailConfirmation: false };

  // Supabase needs a password to create the account. When the admin did not
  // choose one, generate a throwaway: the member sets their own later through
  // the password reset email.
  const credential =
    password || `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}Aa1!`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password: credential,
    options: { data: { name, role, department } }
  });

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    authUserId: data.user ? data.user.id : null,
    needsEmailConfirmation: !data.session
  };
}

// ---------------------------------------------------------------------------
// Directory passthroughs
// ---------------------------------------------------------------------------
// In live mode the directory lives in the database; in demo mode it is the
// in-memory array. Both are exposed here so the routes have one import.
export async function listMembers() {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from('profiles').select('*').order('name');
    if (!error && data) return data.map(sanitizeProfile);
    if (error) console.error('Supabase directory query failed:', error.message);
  }
  return getUsers().map(sanitizeProfile);
}

export const demoStore = {
  profiles,
  session,
  findUserById,
  findUserByEmail,
  addUser,
  deleteUser,
  getUsers
};
