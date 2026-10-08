// Supabase client initializers and the live/demo detectors.
//
// The project runs in one of two modes, decided purely by server/.env:
//
//   Live mode  - both SUPABASE_URL and SUPABASE_ANON_KEY are real values, so
//                the API talks to Supabase PostgreSQL (DATABASE) and Supabase
//                Auth (AUTHENTICATION).
//   Local demo - credentials are missing, so both fall back to the in-memory
//                store (data/store.js) and the temporary demo auth.
//
// The two are detected separately so the UI can report them independently: the
// anon key is required for both, but keeping the checks apart means a future
// change (a service-role key for data, say) cannot silently desync the badges.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();

// A real project URL always starts with https:// and an anon key is a long JWT.
function hasValidCredentials() {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
}

// True when the database layer should use live Supabase PostgreSQL.
export function isSupabaseConfigured() {
  if (process.env.DB_MODE === 'demo') return false;
  return hasValidCredentials();
}

// True when authentication should use live Supabase Auth.
// Falls back to the temporary demo auth whenever credentials are absent or
// AUTH_MODE=demo is set, so a developer can always sign in and exercise the app.
export function isSupabaseAuthConfigured() {
  if (process.env.AUTH_MODE === 'demo') return false;
  return hasValidCredentials();
}

// A shared client, created once. Returns null in Local Demo mode.
let cachedClient = null;

export function getSupabase() {
  if (!hasValidCredentials()) return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // The API is stateless: it validates a token per request rather than
        // keeping a session, so persistence and refresh are unnecessary here.
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return cachedClient;
}

// One place that describes the running mode, used by /api/health and the
// mode badge the frontend renders.
export function getMode() {
  const dbLive = isSupabaseConfigured();
  const authLive = isSupabaseAuthConfigured();
  const overallLive = dbLive && authLive;
  return {
    db: dbLive ? 'live' : 'demo',
    auth: authLive ? 'live' : 'demo',
    supabase: dbLive, // kept for backwards compatibility
    mode: overallLive ? 'live' : (dbLive || authLive ? 'hybrid' : 'demo')
  };
}
