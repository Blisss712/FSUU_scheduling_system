// End-to-end verification of every endpoint claimed in the project docs.
// Runs against the local demo store (server/.env has no Supabase keys), which
// exercises the full fallback path. Exits non-zero on the first failure.
//
// Covers the day-based schedule model: member types (faculty, student,
// admin/staff, visitor), the audience/track fields, and the derived
// done / live / upcoming display state.
// Base URL of the API under test. Override with API_BASE if the backend is
// listening somewhere other than the documented port 5000.
const BASE = process.env.API_BASE || 'http://127.0.0.1:5000';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function req(method, path, body, extraHeaders) {
  const headers = { ...(extraHeaders || {}) };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

// Local-time YYYY-MM-DD, matching how the schedule groups activities.
const dayKey = (value) => {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Finds a member in a directory response by email (case-insensitive).
const findByEmail = (response, target) =>
  (response.data || []).find(
    (u) => String(u.email).toLowerCase() === String(target).toLowerCase()
  );

const at = (dayOffset, hours, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

async function main() {
  // Unique suffix so the suite can run repeatedly against the same server
  // without colliding with members it created in a previous run.
  const RUN = Date.now().toString(36);
  const email = (local) => `${local}.${RUN}@school.edu.ph`;

  // 1. Health
  const health = await req('GET', '/api/health');
  check('GET /api/health returns ok', health.status === 200 && health.data.status === 'ok');
  check(
    'health reports demo mode when no keys',
    health.data.mode === 'demo' && health.data.supabase === false,
    JSON.stringify(health.data)
  );
  // The database and authentication layers are reported separately.
  check(
    'health separates the database and auth modes',
    health.data.db === 'demo' && health.data.auth === 'demo',
    JSON.stringify({ db: health.data.db, auth: health.data.auth })
  );

  // 1b. Auth configuration advertises the temporary fallback
  const authConfig = await req('GET', '/api/auth/config');
  check(
    'GET /api/auth/config reports the temporary demo auth',
    authConfig.status === 200 && authConfig.data.auth === 'demo',
    JSON.stringify(authConfig.data)
  );
  check(
    'auth config exposes no credentials in demo mode',
    authConfig.data.supabaseUrl === null && authConfig.data.supabaseAnonKey === null
  );

  const authStatus = await req('GET', '/api/auth/status');
  check(
    'GET /api/auth/status reports both modes',
    authStatus.status === 200 && authStatus.data.db === 'demo' && authStatus.data.auth === 'demo',
    JSON.stringify({ db: authStatus.data.db, auth: authStatus.data.auth })
  );

  // 2. Member directory
  const users = await req('GET', '/api/auth/users');
  check(
    'GET /api/auth/users returns the campus community',
    users.status === 200 && Array.isArray(users.data) && users.data.length >= 4,
    String(users.data && users.data.length)
  );
  const roles = new Set(users.data.map((u) => u.role));
  check(
    'directory covers all four member types',
    ['faculty', 'student', 'staff', 'visitor'].every((r) => roles.has(r)),
    [...roles].join(', ')
  );
  check(
    'no legacy role values remain',
    !['admin', 'manager', 'member'].some((r) => roles.has(r)),
    [...roles].join(', ')
  );
  check(
    'every member carries a department',
    users.data.every((u) => typeof u.department === 'string' && u.department.length > 0)
  );
  check(
    'the directory never leaks a stored credential',
    users.data.every((u) => u.password === undefined)
  );

  // 3. Sign-in through the temporary demo auth
  const login = await req('POST', '/api/auth/login', { email: 'janilla.jumaang@school.edu.ph' });
  check(
    'POST /api/auth/login signs in an admin/staff member',
    login.status === 200 && login.data.user && login.data.user.role === 'staff',
    JSON.stringify(login.data && login.data.user && login.data.user.role)
  );
  check(
    'login reports which authentication answered',
    login.data.auth === 'demo' && login.data.temporaryAuth === true,
    JSON.stringify({ auth: login.data.auth, temporary: login.data.temporaryAuth })
  );
  check(
    'login issues a session token',
    typeof login.data.token === 'string' && login.data.token.startsWith('demo.'),
    String(login.data.token)
  );

  const authHeader = { Authorization: `Bearer ${login.data.token}` };

  const badLogin = await req('POST', '/api/auth/login', { email: 'nobody@school.edu.ph' });
  check('login rejects an unknown email with 404', badLogin.status === 404);
  const noEmail = await req('POST', '/api/auth/login', {});
  check('login rejects a request with no email', noEmail.status === 400);

  const me = await req('GET', '/api/auth/me');
  check(
    'GET /api/auth/me returns the active member',
    me.status === 200 && me.data && me.data.id === 'user-janilla',
    JSON.stringify(me.data && me.data.id)
  );

  // The same member must resolve from the token alone, with no cookie state.
  const meByToken = await req('GET', '/api/auth/me', null, authHeader);
  check(
    'a bearer token alone identifies the member',
    meByToken.status === 200 && meByToken.data && meByToken.data.id === 'user-janilla',
    JSON.stringify(meByToken.data && meByToken.data.id)
  );
  check(
    '/api/auth/me reports auth_mode and temporary_auth flags',
    meByToken.data && meByToken.data.auth_mode === 'demo' && meByToken.data.temporary_auth === true,
    JSON.stringify({ auth_mode: meByToken.data?.auth_mode, temp: meByToken.data?.temporary_auth })
  );

  const statusWithAuth = await req('GET', '/api/auth/status', null, authHeader);
  check(
    '/api/auth/status reports sessionAuth',
    statusWithAuth.data && statusWithAuth.data.sessionAuth === 'demo' && statusWithAuth.data.authenticated === true,
    JSON.stringify(statusWithAuth.data)
  );

  const fallbackLogin = await req('POST', '/api/auth/login', {
    email: 'derek.reyes@school.edu.ph',
    fallback: true
  });
  check(
    'login with explicit fallback flag succeeds as demo auth',
    fallbackLogin.status === 200 && fallbackLogin.data.auth === 'demo' && fallbackLogin.data.temporaryAuth === true,
    JSON.stringify(fallbackLogin.data)
  );

  const badToken = await req('GET', '/api/auth/me', null, {
    Authorization: 'Bearer demo.user-does-not-exist'
  });
  check('an unknown token resolves to nobody', badToken.status === 200 && badToken.data === null);

  // 4. Profile
  const prof = await req('PUT', '/api/auth/profile', { notify_email: false }, authHeader);
  check(
    'PUT /api/auth/profile saves preferences',
    prof.status === 200 && prof.data.notify_email === false
  );
  const emptyName = await req('PUT', '/api/auth/profile', { name: '   ' }, authHeader);
  check('profile update rejects an empty display name', emptyName.status === 400);
  await req('PUT', '/api/auth/profile', { notify_email: true }, authHeader);

  // 4b. Self sign-up
  const signupEmail = email('self.signup');
  const signup = await req('POST', '/api/auth/signup', {
    name: 'Self Signup',
    email: signupEmail,
    role: 'faculty',
    department: 'College of Engineering'
  });
  check(
    'POST /api/auth/signup creates an account',
    signup.status === 201 && signup.data.user && signup.data.user.role === 'faculty',
    JSON.stringify(signup.data)
  );
  check(
    'signup reports the authentication that answered',
    signup.data.auth === 'demo' && signup.data.temporaryAuth === true,
    JSON.stringify({ auth: signup.data.auth, temporary: signup.data.temporaryAuth })
  );
  check(
    'the temporary demo auth needs no email confirmation',
    signup.data.needsEmailConfirmation === false
  );

  const dupSignup = await req('POST', '/api/auth/signup', {
    name: 'Self Signup Again',
    email: signupEmail
  });
  check('signup rejects a duplicate email with 409', dupSignup.status === 409, String(dupSignup.status));

  const namelessSignup = await req('POST', '/api/auth/signup', { email: email('nameless') });
  check('signup requires a name', namelessSignup.status === 400);

  const badSignupRole = await req('POST', '/api/auth/signup', {
    name: 'Bad Role',
    email: email('badrole'),
    role: 'admin'
  });
  check('signup rejects a legacy member type', badSignupRole.status === 400);

  // 4c. Sign out, then confirm the session really ended
  const logout = await req('POST', '/api/auth/logout', null, authHeader);
  check('POST /api/auth/logout succeeds', logout.status === 200 && logout.data.ok === true);

  // The in-memory demo session pointer is cleared, so /me has nobody to return.
  const afterLogout = await req('GET', '/api/auth/me');
  check(
    'after signing out the session is empty',
    afterLogout.status === 200 && afterLogout.data === null,
    JSON.stringify(afterLogout.data)
  );

  // Sign back in for the remaining checks.
  const relogin = await req('POST', '/api/auth/login', { email: 'janilla.jumaang@school.edu.ph' });
  const staffHeader = { Authorization: `Bearer ${relogin.data.token}` };
  check('signing back in works', relogin.status === 200 && Boolean(relogin.data.token));

  // 5. Member creation across the four types
  const ninaEmail = email('nina.bautista');
  const created = await req('POST', '/api/auth/users', {
    name: 'Nina R. Bautista',
    email: ninaEmail,
    role: 'student',
    department: 'College of Law'
  }, staffHeader);
  check(
    'POST /api/auth/users creates a member',
    created.status === 201 && created.data.role === 'student',
    JSON.stringify(created.data)
  );
  const newId = created.data && created.data.id;
  check('new member keeps its department', created.data.department === 'College of Law');

  const visitor = await req('POST', '/api/auth/users', {
    name: 'Guest Speaker',
    email: email('guest.speaker'),
    role: 'visitor'
  }, staffHeader);
  check(
    'visitor accounts can be created',
    visitor.status === 201 && visitor.data.role === 'visitor',
    JSON.stringify(visitor.data && visitor.data.role)
  );

  const badRole = await req('POST', '/api/auth/users', {
    name: 'Wrong Role',
    email: email('wrong.role'),
    role: 'admin'
  }, staffHeader);
  check('legacy role "admin" is rejected with 400', badRole.status === 400, String(badRole.status));

  // Same address, different case and whitespace: must still be a duplicate.
  const dup = await req('POST', '/api/auth/users', {
    name: 'Duplicate Person',
    email: `  ${ninaEmail.toUpperCase()}  `
  }, staffHeader);
  check('duplicate email is rejected with 409', dup.status === 409, String(dup.status));

  // 6. Activity creation with audience + track
  const task = await req('POST', '/api/tasks', {
    title: 'Legal Aid Clinic Launch',
    description: 'Free notary and consultation for the community',
    venue: 'Law Amphitheater',
    organizer: 'c/o Consejo de Legis',
    deadline: at(1, 8, 0),
    priority: 'high',
    audience: 'open-to-public',
    committee: 'College of Law',
    assignee_id: newId
  });
  check(
    'POST /api/tasks schedules an activity',
    task.status === 201 && task.data.title === 'Legal Aid Clinic Launch',
    JSON.stringify(task.data)
  );
  check('activity stores its venue', task.data.venue === 'Law Amphitheater');
  check('activity stores its organizer', task.data.organizer === 'c/o Consejo de Legis');
  check('activity stores its audience', task.data.audience === 'open-to-public');
  check('activity stores its track', task.data.committee === 'College of Law');
  const taskId = task.data && task.data.id;

  // Defaults
  const minimal = await req('POST', '/api/tasks', {
    title: 'Minimal Activity',
    deadline: at(2, 9, 0)
  });
  check(
    'audience and track fall back to defaults',
    minimal.status === 201 &&
      minimal.data.audience === 'exclusive' &&
      minimal.data.committee === 'Institutional',
    JSON.stringify({ a: minimal.data.audience, c: minimal.data.committee })
  );
  await req('DELETE', `/api/tasks/${minimal.data.id}`);

  const badAudience = await req('POST', '/api/tasks', {
    title: 'Bad Audience',
    deadline: at(1, 10, 0),
    audience: 'invite-only'
  });
  check('unknown audience is rejected with 400', badAudience.status === 400, String(badAudience.status));

  // 7. Display state (done / live / upcoming)
  const liveProbe = await req('POST', '/api/tasks', {
    title: 'Live State Probe',
    deadline: new Date(Date.now() - 20 * 60 * 1000).toISOString()
  });
  const doneProbe = await req('POST', '/api/tasks', {
    title: 'Done State Probe',
    deadline: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
  });
  const soonProbe = await req('POST', '/api/tasks', {
    title: 'Upcoming State Probe',
    deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  });

  const listed = await req('GET', '/api/tasks');
  const byId = (id) => listed.data.find((t) => t.id === id);
  check('an activity inside the live window reports state "live"',
    byId(liveProbe.data.id).state === 'live', byId(liveProbe.data.id).state);
  check('a long-finished activity reports state "done"',
    byId(doneProbe.data.id).state === 'done', byId(doneProbe.data.id).state);
  check('a future activity reports state "upcoming"',
    byId(soonProbe.data.id).state === 'upcoming', byId(soonProbe.data.id).state);
  check('the list is ordered by start time',
    listed.data.every((t, i, a) => i === 0 || new Date(a[i - 1].deadline) <= new Date(t.deadline)));
  check('every activity exposes a display state',
    listed.data.every((t) => ['done', 'live', 'upcoming'].includes(t.state)));

  // The live probe must NOT be flagged overdue while it is still running.
  check('a live activity is not flipped to overdue',
    byId(liveProbe.data.id).status !== 'overdue', byId(liveProbe.data.id).status);
  check('a long-finished activity is flagged overdue',
    byId(doneProbe.data.id).status === 'overdue', byId(doneProbe.data.id).status);

  // 8. Full edit
  const edited = await req('PUT', `/api/tasks/${taskId}`, {
    title: 'Legal Aid Clinic & Notary Day',
    venue: 'Law Gymnasium',
    organizer: 'c/o College of Law',
    audience: 'exclusive',
    committee: 'Graduate School',
    priority: 'medium'
  });
  check(
    'PUT /api/tasks/:id updates audience, track, venue and organizer',
    edited.status === 200 &&
      edited.data.audience === 'exclusive' &&
      edited.data.committee === 'Graduate School' &&
      edited.data.venue === 'Law Gymnasium' &&
      edited.data.organizer === 'c/o College of Law',
    JSON.stringify(edited.data)
  );

  const partial = await req('PUT', `/api/tasks/${taskId}`, { priority: 'low' });
  check(
    'PUT keeps fields that were not supplied',
    partial.status === 200 &&
      partial.data.priority === 'low' &&
      partial.data.title === 'Legal Aid Clinic & Notary Day'
  );

  // 9. Calendar grouping
  const cal = await req('GET', '/api/tasks/calendar');
  const keys = cal.data ? Object.keys(cal.data) : [];
  check(
    'GET /api/tasks/calendar groups by YYYY-MM-DD',
    cal.status === 200 && keys.length > 0 && keys.every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)),
    keys.slice(0, 3).join(', ')
  );
  check(
    'today is one of the grouped days',
    keys.includes(dayKey(new Date())),
    `today=${dayKey(new Date())}`
  );
  const calQuery = await req('GET', '/api/tasks?group=calendar');
  check('?group=calendar matches the calendar endpoint',
    JSON.stringify(calQuery.data) === JSON.stringify(cal.data));

  // 10. /api/events alias
  const events = await req('GET', '/api/events');
  check('GET /api/events aliases the same list',
    events.status === 200 && events.data.length === listed.data.length);

  // 11. Self-removal guard + cascade
  const selfDelete = await req('DELETE', '/api/auth/users/user-janilla', null, staffHeader);
  check('removing the signed-in account is blocked with 400', selfDelete.status === 400);

  const tempPerson = await req('POST', '/api/auth/users', {
    name: 'Temp Faculty',
    email: email('temp.faculty'),
    role: 'faculty'
  }, staffHeader);
  const cascadeEvent = await req('POST', '/api/tasks', {
    title: 'Cascade Unassign Probe',
    deadline: at(2, 14, 0),
    assignee_id: tempPerson.data.id
  });
  await req('DELETE', `/api/auth/users/${tempPerson.data.id}`, null, staffHeader);
  const afterCascade = await req('GET', '/api/tasks');
  const orphan = afterCascade.data.find((t) => t.id === cascadeEvent.data.id);
  check('activities of a removed member become Unassigned',
    orphan && orphan.assignee_id === null, orphan && String(orphan.assignee_id));
  await req('DELETE', `/api/tasks/${cascadeEvent.data.id}`);

  // 12. Activity deletion
  const delTask = await req('DELETE', `/api/tasks/${taskId}`);
  check('DELETE /api/tasks/:id removes the activity',
    delTask.status === 200 && delTask.data.success === true);
  const delTwice = await req('DELETE', `/api/tasks/${taskId}`);
  check('deleting an already-deleted activity returns 404', delTwice.status === 404);

  // Clean up the state probes and the members this run created, so repeated
  // runs leave the demo data as they found it.
  for (const probe of [liveProbe, doneProbe, soonProbe]) {
    await req('DELETE', `/api/tasks/${probe.data.id}`);
  }
  for (const member of [created, visitor]) {
    await req('DELETE', `/api/auth/users/${member.data.id}`, null, staffHeader);
  }
  // The account created by the sign-up check.
  const signupMember = findByEmail(await req('GET', '/api/auth/users'), signupEmail);
  if (signupMember) {
    await req('DELETE', `/api/auth/users/${signupMember.id}`, null, staffHeader);
  }

  const finalUsers = await req('GET', '/api/auth/users');
  check(
    'the suite cleans up the members it created',
    !finalUsers.data.some((u) => u.email === ninaEmail) &&
      !finalUsers.data.some((u) => u.email === signupEmail),
    String(finalUsers.data.length)
  );
  check(
    'the demo directory is left exactly as seeded',
    finalUsers.data.length === 4,
    String(finalUsers.data.length)
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
