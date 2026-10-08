// Shared vocabulary for the school schedule: member types, audiences and the
// organising bodies ("tracks") shown as tags on every activity row.
//
// Keeping this in one module means the navbar, schedule, form and profile all
// describe the same thing in the same words.

// ---------------------------------------------------------------------------
// Member types
// ---------------------------------------------------------------------------
// faculty  - teaching staff
// student  - learners
// staff    - admin / non-teaching personnel
// visitor  - guests from outside the campus
export const ROLE_LABELS = {
  faculty: 'Faculty',
  student: 'Student',
  staff: 'Admin / Staff',
  visitor: 'Visitor'
};

// Shorter wording for tight spaces such as table badges.
export const ROLE_SHORT_LABELS = {
  faculty: 'Faculty',
  student: 'Student',
  staff: 'Staff',
  visitor: 'Visitor'
};

export const ROLES = ['faculty', 'student', 'staff', 'visitor'];

// Member types allowed to create, edit and delete activities. Students and
// visitors get a read-only schedule.
export const MANAGER_ROLES = ['staff', 'faculty'];

export const canManageSchedule = (user) =>
  Boolean(user && MANAGER_ROLES.includes(user.role));

// ---------------------------------------------------------------------------
// Audience - who may attend
// ---------------------------------------------------------------------------
export const AUDIENCE_LABELS = {
  'open-to-public': 'Open to public',
  exclusive: 'Exclusive for campus community',
  institutional: 'Institutional',
  college: 'College',
  'basic-education': 'Basic Education',
  'graduate-school': 'Graduate School',
  'college-of-law': 'College of Law'
};

export const AUDIENCES = Object.keys(AUDIENCE_LABELS);

// ---------------------------------------------------------------------------
// Organising bodies (tracks)
// ---------------------------------------------------------------------------
// Used both as the tag on an activity and as a filter chip. Anything not in
// this list still renders, with a neutral colour.
export const COMMITTEES = [
  'Institutional',
  'Basic Education',
  'College of Engineering',
  'College of Law',
  'Graduate School'
];

// Colour family per track, matching the chip colours in the schedule.
const COMMITTEE_TONES = {
  Institutional: 'navy',
  'Basic Education': 'gold',
  'College of Engineering': 'green',
  'College of Law': 'maroon',
  'Graduate School': 'violet'
};

export const committeeTone = (committee) =>
  COMMITTEE_TONES[committee] || 'slate';

// ---------------------------------------------------------------------------
// Schedule helpers
// ---------------------------------------------------------------------------
// Display state derived from the clock, so a live activity is always marked
// Live without anyone editing it.
export function activityState(task, now = Date.now()) {
  if (task.state) return task.state; // server-computed when available
  const startsAt = new Date(task.deadline).getTime();
  if (task.status === 'completed') return 'done';
  return startsAt > now ? 'upcoming' : 'done';
}

export const STATE_LABELS = {
  done: 'Done',
  live: 'Live',
  upcoming: 'Upcoming'
};

// Buckets used to group a day's activities into MORNING / AFTERNOON sections.
const PERIODS = [
  { id: 'early', label: 'Early Morning', from: 0 },
  { id: 'morning', label: 'Morning', from: 5 },
  { id: 'afternoon', label: 'Afternoon', from: 12 },
  { id: 'evening', label: 'Evening', from: 17 }
];

export function periodOf(iso) {
  const hour = new Date(iso).getHours();
  for (let i = PERIODS.length - 1; i >= 0; i -= 1) {
    if (hour >= PERIODS[i].from) return PERIODS[i];
  }
  return PERIODS[0];
}

export const PERIOD_ORDER = PERIODS.map((p) => p.id);

// 'YYYY-MM-DD' key in local time, so activities never jump a day.
export const dateKey = (value) => {
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// The next `count` days starting today, as picker entries.
export function upcomingDays(count = 6, from = new Date()) {
  const days = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    days.push({
      key: dateKey(d),
      date: d,
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNumber: d.getDate(),
      isToday: i === 0
    });
  }
  return days;
}
