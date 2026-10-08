// School event CRUD endpoints, status transitions & calendar grouping.
// GET /api/tasks also runs the automatic overdue check: any event whose
// scheduled time has passed and is not completed is flipped to "overdue".
// /api/events is kept as a friendly alias for the same data.
import { Router } from 'express';
import { getSupabase } from '../config/supabase.js';
import {
  tasks,
  addTask,
  updateTask,
  updateTaskStatus,
  deleteTask
} from '../data/store.js';

const router = Router();

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in-progress', 'completed', 'overdue'];

// Who is allowed to attend. Drives the audience badges on each event and the
// "Open to public only" filter in the schedule view.
const AUDIENCES = [
  'open-to-public',
  'exclusive',
  'institutional',
  'college',
  'basic-education',
  'graduate-school',
  'college-of-law'
];

// Default organising body when the client does not send one.
const DEFAULT_COMMITTEE = 'Institutional';

// An event counts as LIVE while the current time is inside this window after
// its scheduled start. Past that it is treated as finished.
const LIVE_WINDOW_HOURS = 3;

// Adds the display state the schedule view renders as a Done / Live / Upcoming
// tag. `state` is derived, never stored, so it cannot drift out of date.
function withDisplayState(list) {
  const now = Date.now();
  const liveMs = LIVE_WINDOW_HOURS * 60 * 60 * 1000;

  for (const task of list) {
    const startsAt = new Date(task.deadline).getTime();
    const done = task.status === 'completed';

    if (done) {
      task.state = 'done';
    } else if (now >= startsAt && now - startsAt <= liveMs) {
      task.state = 'live';
    } else if (now < startsAt) {
      task.state = 'upcoming';
    } else {
      task.state = 'done';
    }
  }
  return list;
}

// Flips past-due events to "overdue" so the alert banner stays accurate.
// Events inside the live window are left alone - they are still happening.
// Returns the (possibly updated) list of events.
async function applyOverdueCheck(list) {
  const now = Date.now();
  const liveMs = LIVE_WINDOW_HOURS * 60 * 60 * 1000;

  const pastDue = list.filter((t) => {
    const startsAt = new Date(t.deadline).getTime();
    if (t.status === 'completed' || t.status === 'overdue') return false;
    // Still inside the live window.
    if (now - startsAt <= liveMs && now >= startsAt) return false;
    return startsAt < now;
  });

  if (pastDue.length === 0) return list;

  const supabase = getSupabase();
  for (const task of pastDue) {
    task.status = 'overdue';
    // Keep the fallback store in step with Supabase rows when they overlap.
    updateTaskStatus(task.id, 'overdue');
    if (supabase) {
      try {
        await supabase.from('tasks').update({ status: 'overdue' }).eq('id', task.id);
      } catch (err) {
        console.error('Supabase overdue update failed for', task.id, '-', err.message);
      }
    }
  }
  return list;
}

// Calendar grouping helper: school events grouped by calendar date, for the
// day-by-day timeline view. Keys are 'YYYY-MM-DD' in local time so events do
// not jump a day for users east or west of UTC.
function groupByDate(list) {
  const groups = {};
  for (const task of list) {
    const when = new Date(task.deadline);
    const date = [
      when.getFullYear(),
      String(when.getMonth() + 1).padStart(2, '0'),
      String(when.getDate()).padStart(2, '0')
    ].join('-');
    (groups[date] = groups[date] || []).push(task);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Shared handlers so /api/tasks and /api/events behave identically.
// ---------------------------------------------------------------------------

// GET /api/tasks            -> chronological list of every campus event
// GET /api/tasks?group=calendar -> the same events grouped by calendar date
async function listTasks(req, res) {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('deadline', { ascending: true });
      if (!error) return res.json(withDisplayState(await applyOverdueCheck(data)));
      console.error('Supabase tasks query failed, falling back to demo store:', error.message);
    } catch (err) {
      console.error('Supabase unreachable, falling back to demo store:', err.message);
    }
  }

  const sorted = [...tasks].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  res.json(withDisplayState(await applyOverdueCheck(sorted)));
}

// Shared validation for create & full edit payloads. Returns an error string
// when the payload is unusable, otherwise null.
function validateEventPayload(body, { requireAll }) {
  const { title, deadline, priority, status, audience } = body;

  if ((requireAll || title !== undefined) && (!title || String(title).trim() === '')) {
    return 'Event title is required.';
  }
  if (
    (requireAll || deadline !== undefined) &&
    (!deadline || Number.isNaN(new Date(deadline).getTime()))
  ) {
    return 'A valid event schedule (date & time) is required.';
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return `Priority must be one of: ${PRIORITIES.join(', ')}`;
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return `Status must be one of: ${STATUSES.join(', ')}`;
  }
  if (audience !== undefined && !AUDIENCES.includes(audience)) {
    return `Audience must be one of: ${AUDIENCES.join(', ')}`;
  }
  return null;
}

// POST /api/tasks (alias: POST /api/events) - schedule a new campus event
async function createTask(req, res) {
  const error = validateEventPayload(req.body || {}, { requireAll: true });
  if (error) return res.status(400).json({ error });

  const {
    title,
    description,
    venue,
    organizer,
    deadline,
    priority,
    status,
    audience,
    committee,
    assignee_id
  } = req.body || {};

  const newTask = {
    id: `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: String(title).trim(),
    description: description ? String(description) : '',
    venue: venue ? String(venue) : '',
    organizer: organizer ? String(organizer) : '',
    deadline: new Date(deadline).toISOString(),
    priority: priority || 'medium',
    status: status || 'todo',
    audience: audience || 'exclusive',
    committee: committee || DEFAULT_COMMITTEE,
    assignee_id: assignee_id || null
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error: dbError } = await supabase
        .from('tasks')
        .insert(newTask)
        .select()
        .maybeSingle();
      if (!dbError && data) {
        addTask(data);
        return res.status(201).json(data);
      }
      if (dbError) {
        console.error('Supabase task insert failed, falling back to demo store:', dbError.message);
      }
    } catch (err) {
      console.error('Supabase unreachable, falling back to demo store:', err.message);
    }
  }

  return res.status(201).json(addTask(newTask));
}

// PUT /api/tasks/:id (alias: PUT /api/events/:id)
// Full event edit - title, venue/description, schedule, urgency, status and
// assigned faculty. Only the supplied fields are changed.
async function updateTask_route(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  const error = validateEventPayload(body, { requireAll: false });
  if (error) return res.status(400).json({ error });

  const updates = {};
  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.description !== undefined) updates.description = String(body.description);
  if (body.venue !== undefined) updates.venue = String(body.venue);
  if (body.organizer !== undefined) updates.organizer = String(body.organizer);
  if (body.deadline !== undefined) updates.deadline = new Date(body.deadline).toISOString();
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.status !== undefined) updates.status = body.status;
  if (body.audience !== undefined) updates.audience = body.audience;
  if (body.committee !== undefined) updates.committee = String(body.committee);
  if (body.assignee_id !== undefined) updates.assignee_id = body.assignee_id || null;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No editable event fields were provided.' });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error: dbError } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (!dbError && data) {
        updateTask(id, data);
        return res.json(data);
      }
      if (dbError) {
        console.error('Supabase event update failed, falling back to demo store:', dbError.message);
      }
    } catch (err) {
      console.error('Supabase unreachable, falling back to demo store:', err.message);
    }
  }

  const updated = updateTask(id, updates);
  if (!updated) {
    return res.status(404).json({ error: `No school event found with id ${id}` });
  }
  return res.json(updated);
}

// PATCH /api/tasks/:id/status - change only the status of one event
async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}` });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error: dbError } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (!dbError && data) {
        updateTaskStatus(id, status);
        return res.json(data);
      }
      if (dbError) {
        console.error('Supabase status update failed, falling back to demo store:', dbError.message);
      }
    } catch (err) {
      console.error('Supabase unreachable, falling back to demo store:', err.message);
    }
  }

  const updated = updateTaskStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: `No school event found with id ${id}` });
  }
  return res.json(updated);
}

// DELETE /api/tasks/:id - remove a campus event
async function removeTask(req, res) {
  const { id } = req.params;

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error: dbError } = await supabase.from('tasks').delete().eq('id', id);
      if (!dbError) {
        deleteTask(id);
        return res.json({ success: true, id });
      }
      console.error('Supabase delete failed, falling back to demo store:', dbError.message);
    } catch (err) {
      console.error('Supabase unreachable, falling back to demo store:', err.message);
    }
  }

  const removed = deleteTask(id);
  if (!removed) {
    return res.status(404).json({ error: `No school event found with id ${id}` });
  }
  return res.json({ success: true, id });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
// A small helper keeps the /tasks and /events aliases in step: both mount the
// identical handler, and ?group=calendar switches the response to the grouped
// timeline format.
const asCalendarAware = (handler) => (req, res, next) => {
  if (req.query.group === 'calendar') {
    return listTasks(req, {
      json: (data) => res.json(groupByDate(data))
    });
  }
  return handler(req, res, next);
};

router.get('/tasks', asCalendarAware(listTasks));
// Dedicated calendar endpoint used by the timeline view.
router.get('/tasks/calendar', (req, res) => {
  listTasks(req, { json: (data) => res.json(groupByDate(data)) });
});
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask_route);
router.patch('/tasks/:id/status', updateStatus);
router.delete('/tasks/:id', removeTask);

// Friendly alias - same school events, same behavior.
router.get('/events', asCalendarAware(listTasks));
router.get('/events/calendar', (req, res) => {
  listTasks(req, { json: (data) => res.json(groupByDate(data)) });
});
router.post('/events', createTask);
router.put('/events/:id', updateTask_route);
router.patch('/events/:id/status', updateStatus);
router.delete('/events/:id', removeTask);

export default router;
