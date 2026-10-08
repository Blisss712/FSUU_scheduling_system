// In-memory fallback store with realistic school events.
// Used whenever Supabase credentials are missing (Local Demo mode) or when a
// live Supabase query fails, so the app keeps working offline.
// NOTE: data resets when the server restarts - perfect for demos and testing.

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------
// Seeds are positioned relative to "now" so every demo run has a believable
// schedule: events that already finished, one happening right now, and more
// spread over the next few days.

const at = (dayOffset, hours, minutes = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

// Builds a timestamp for "today at this time", moving it two hours earlier if
// that moment is still in the future. Used for the demonstration event that
// should read as LIVE right now.
const liveNow = () => {
  const d = new Date(Date.now() - 45 * 60 * 1000);
  return d.toISOString();
};

// ---------------------------------------------------------------------------
// Member types
// ---------------------------------------------------------------------------
// faculty  - teaching staff, may manage the schedule
// student  - learners, may browse the schedule
// staff    - admin / non-teaching personnel, full access
// visitor  - guests, may browse the schedule only
export const ROLES = ['faculty', 'student', 'staff', 'visitor'];

// Roles allowed to create, edit or delete activities and members.
export const MANAGER_ROLES = ['staff', 'faculty'];

// Campus community members (mirrors supabase/schema.sql)
export const profiles = [
  {
    id: 'user-janilla',
    name: 'Janilla O. Juma-ang',
    email: 'janilla.jumaang@school.edu.ph',
    role: 'staff',
    department: 'Registrar',
    status: 'active',
    notify_email: true,
    notify_in_app: true
  },
  {
    id: 'user-derek',
    name: 'Derek Josh Reyes',
    email: 'derek.reyes@school.edu.ph',
    role: 'faculty',
    department: 'College of Engineering',
    status: 'active',
    notify_email: true,
    notify_in_app: true
  },
  {
    id: 'user-archangel',
    name: 'Archangel Fortun',
    email: 'archangel.fortun@school.edu.ph',
    role: 'student',
    department: 'College of Engineering',
    status: 'active',
    notify_email: false,
    notify_in_app: true
  },
  {
    id: 'user-maria',
    name: 'Maria L. Santos',
    email: 'maria.santos@school.edu.ph',
    role: 'visitor',
    department: 'Guest',
    status: 'active',
    notify_email: false,
    notify_in_app: true
  }
];

// Campus events (mirrors the seed rows in supabase/schema.sql).
// `audience` drives the badges and the "Open to public only" filter, while
// `committee` is the organising body shown as the track tag.
export const tasks = [
  {
    id: 'event-1',
    title: 'Bike and Plant',
    description: 'Tree planting and coastal cleanup drive with student volunteers.',
    venue: 'Sitio Iyao, Brgy. Anticala',
    organizer: 'Mr. Brian Casanos',
    deadline: at(0, 4, 0),
    priority: 'medium',
    status: 'completed',
    audience: 'open-to-public',
    committee: 'Institutional',
    assignee_id: 'user-derek'
  },
  {
    id: 'event-2',
    title: 'Urian H.E.L.P.',
    description: 'Community health and literacy program, running until 12:00 PM.',
    venue: 'Brgy. San Mateo, Butuan City',
    organizer: 'Dr. Sheila Mae P. Jalique, MSc, MD',
    deadline: at(0, 6, 30),
    priority: 'medium',
    status: 'completed',
    audience: 'open-to-public',
    committee: 'Institutional',
    assignee_id: 'user-janilla'
  },
  {
    id: 'event-3',
    title: 'College of Engineering Days Opening Program',
    description: 'Opening program and amazing race for all engineering students.',
    venue: 'Engineering Grounds',
    organizer: 'c/o College of Engineering',
    deadline: liveNow(),
    priority: 'high',
    status: 'in-progress',
    audience: 'exclusive',
    committee: 'College of Engineering',
    assignee_id: 'user-derek'
  },
  {
    id: 'event-4',
    title: 'GS Acquaintance Party',
    description: 'Welcome gathering for graduate school students, until 3:00 PM.',
    venue: 'CBE Function Hall',
    organizer: 'c/o Graduate School',
    deadline: at(0, 11, 0),
    priority: 'low',
    status: 'todo',
    audience: 'exclusive',
    committee: 'Graduate School',
    assignee_id: 'user-archangel'
  },
  {
    id: 'event-5',
    title: 'Q3 Departmental Examinations',
    description: 'Multi-purpose Hall - coverage: Mathematics, Science and English departments.',
    venue: 'Multi-purpose Hall',
    organizer: 'c/o Office of the Registrar',
    deadline: at(0, 17, 0),
    priority: 'high',
    status: 'todo',
    audience: 'exclusive',
    committee: 'Basic Education',
    assignee_id: 'user-janilla'
  },
  {
    id: 'event-6',
    title: 'Faculty General Assembly',
    description: 'Conference Room A - presentation of the new academic calendar and committee assignments.',
    venue: 'Conference Room A',
    organizer: 'c/o Office of the President',
    deadline: at(1, 9, 0),
    priority: 'high',
    status: 'todo',
    audience: 'exclusive',
    committee: 'Institutional',
    assignee_id: 'user-janilla'
  },
  {
    id: 'event-7',
    title: 'Annual Intramurals Sports Fest',
    description: 'Campus Gymnasium - basketball, volleyball, badminton and chess across all year levels.',
    venue: 'Campus Gymnasium',
    organizer: 'c/o Sports and Cultural Affairs',
    deadline: at(1, 13, 30),
    priority: 'medium',
    status: 'todo',
    audience: 'exclusive',
    committee: 'Institutional',
    assignee_id: 'user-archangel'
  },
  {
    id: 'event-8',
    title: 'Community Health Mission',
    description: 'Barangay Health Center - free check-up, dental and optometry services.',
    venue: 'Barangay Health Center',
    organizer: 'c/o College of Nursing',
    deadline: at(2, 8, 0),
    priority: 'medium',
    status: 'todo',
    audience: 'open-to-public',
    committee: 'Institutional',
    assignee_id: 'user-maria'
  },
  {
    id: 'event-9',
    title: 'College of Law Days Opening Program',
    description: 'Law Amphitheater - moot court exhibition and legal aid clinic launch.',
    venue: 'Law Amphitheater',
    organizer: 'c/o Consejo de Legis',
    deadline: at(3, 8, 0),
    priority: 'medium',
    status: 'todo',
    audience: 'exclusive',
    committee: 'College of Law',
    assignee_id: 'user-derek'
  },
  {
    id: 'event-10',
    title: 'Cultural Gala & Talent Showcase',
    description: 'School Auditorium - dance, music and drama performances by student organizations.',
    venue: 'School Auditorium',
    organizer: 'c/o Student Affairs Office',
    deadline: at(4, 18, 0),
    priority: 'low',
    status: 'todo',
    audience: 'open-to-public',
    committee: 'Institutional',
    assignee_id: 'user-archangel'
  },
  {
    id: 'event-11',
    title: 'Campus Earthquake Safety Drill',
    description: 'Main Quadrangle - evacuation route briefing for all teaching and non-teaching personnel.',
    venue: 'Main Quadrangle',
    organizer: 'c/o Campus Safety Office',
    deadline: at(-1, 9, 0),
    priority: 'medium',
    status: 'completed',
    audience: 'exclusive',
    committee: 'Institutional',
    assignee_id: 'user-janilla'
  },
  {
    id: 'event-12',
    title: 'Foundation Day Parade',
    description: 'Academic Oval - contingent formation of all departments followed by the flag ceremony.',
    venue: 'Academic Oval',
    organizer: 'c/o Office of Student Affairs',
    deadline: at(-3, 7, 30),
    priority: 'low',
    status: 'completed',
    audience: 'open-to-public',
    committee: 'Institutional',
    assignee_id: 'user-archangel'
  }
];

// Simple in-memory session so the "1-click member switcher" works in both
// modes. A production deployment would use Supabase Auth sessions instead.
export const session = {
  currentUserId: null
};

// ---------------------------------------------------------------------------
// Fallback store methods
// ---------------------------------------------------------------------------
// These keep Local Demo mode fully functional: every Supabase write in the
// routes has a matching store method here, so the app behaves identically
// whether or not credentials are configured.
// ---------------------------------------------------------------------------

// Read helpers -------------------------------------------------------------

// All members, ordered by name for a stable directory table.
export function getUsers() {
  return [...profiles].sort((a, b) => a.name.localeCompare(b.name));
}

// A single member profile by readable id (e.g. 'user-derek').
export function findUserById(id) {
  return profiles.find((p) => p.id === id) || null;
}

// A single member profile by institutional email (case-insensitive).
export function findUserByEmail(email) {
  const target = String(email || '').trim().toLowerCase();
  return profiles.find((p) => p.email.toLowerCase() === target) || null;
}

// Every event that references this person, so callers can clear assignments
// before the profile disappears.
export function findTasksByAssignee(id) {
  return tasks.filter((t) => t.assignee_id === id);
}

// Write helpers ------------------------------------------------------------

// Creates a member account. The route is responsible for validating the
// payload and rejecting duplicate emails.
export function addUser(profile) {
  const newProfile = {
    id: profile.id || `user-${Date.now()}`,
    name: profile.name,
    email: profile.email,
    role: profile.role || 'student',
    department: profile.department || 'Institutional',
    status: profile.status || 'active',
    notify_email: profile.notify_email !== undefined ? Boolean(profile.notify_email) : true,
    notify_in_app: profile.notify_in_app !== undefined ? Boolean(profile.notify_in_app) : true
  };
  profiles.push(newProfile);
  return newProfile;
}

// Removes a member account. Any campus event that was assigned to that person
// becomes "Unassigned" instead of pointing at a deleted profile.
export function deleteUser(id) {
  const index = profiles.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const [removed] = profiles.splice(index, 1);
  for (const task of tasks) {
    if (task.assignee_id === id) task.assignee_id = null;
  }
  if (session.currentUserId === id) session.currentUserId = null;
  return removed;
}

// Updates only the supplied fields of an existing member profile.
export function updateUser(id, updates) {
  const profile = findUserById(id);
  if (!profile) return null;
  Object.assign(profile, updates);
  return profile;
}

// Schedules a new campus event.
export function addTask(task) {
  const newTask = {
    id: task.id || `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: task.title,
    description: task.description || '',
    venue: task.venue || '',
    organizer: task.organizer || '',
    deadline: task.deadline,
    priority: task.priority || 'medium',
    status: task.status || 'todo',
    audience: task.audience || 'exclusive',
    committee: task.committee || 'Institutional',
    assignee_id: task.assignee_id || null
  };
  tasks.push(newTask);
  return newTask;
}

// Full event edit: title, venue/organizer, schedule, urgency, audience,
// committee and assignee. Fields not present in `updates` are left untouched.
export function updateTask(id, updates) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;

  const allowed = [
    'title',
    'description',
    'venue',
    'organizer',
    'deadline',
    'priority',
    'status',
    'audience',
    'committee',
    'assignee_id'
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) task[key] = updates[key];
  }
  return task;
}

// Changes only the status of one event (used by the status control).
export function updateTaskStatus(id, status) {
  return updateTask(id, { status });
}

// Deletes a campus event by id. Returns the removed event, or null.
export function deleteTask(id) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const [removed] = tasks.splice(index, 1);
  return removed;
}
