// School & Campus Event Scheduling System - backend API entry point.
// Runs an Express server on http://localhost:5000 serving /api routes.
//
// Two independent layers each run live or on a local fallback:
//   database       - Supabase PostgreSQL, or the in-memory demo store
//   authentication - Supabase Auth, or the temporary demo auth
// /api/health reports both so the frontend can label them separately.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import { getMode } from './config/supabase.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Backend health check. `db` and `auth` are reported separately because they
// can differ: credentials could be added for one before the other.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ...getMode() });
});

app.use('/api/auth', authRoutes);
app.use('/api', taskRoutes);

app.listen(PORT, () => {
  const { db, auth } = getMode();
  const label = (mode) => (mode === 'live' ? 'Supabase' : 'local demo');
  console.log(
    `School Event Scheduler API running on http://localhost:${PORT} ` +
      `(database: ${label(db)}, authentication: ${auth === 'live' ? 'Supabase Auth' : 'temporary demo auth'})`
  );
});
