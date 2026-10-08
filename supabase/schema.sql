-- ============================================================================
-- School & Campus Event Scheduling System - Supabase / PostgreSQL schema
-- ============================================================================
-- HOW TO USE (beginner friendly):
--   1. Open your Supabase project dashboard.
--   2. Go to the "SQL Editor" tab on the left sidebar.
--   3. Click "New query", paste this entire file, then click "Run".
--   4. Go to "Table Editor" - you should now see public.profiles and
--      public.tasks filled with the sample school data below.
--
-- This one script is safe to run more than once: every statement either
-- creates an object only if it is missing, or replaces the seed rows.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- TABLE 1: public.profiles  (campus community members)
-- ----------------------------------------------------------------------------
-- One row per member of the campus community. Two kinds of row exist:
--
--   * SEED rows with readable ids such as 'user-janilla'. They belong to the
--     LOCAL DEMO auth and have auth_user_id = NULL.
--   * AUTH-BACKED rows whose id equals the Supabase Auth user's UUID, linked
--     through auth_user_id. These are created on sign-up, or when an existing
--     seeded row is first signed into (the API links it by email).
--
-- The API works either way, so a project can adopt Supabase Auth gradually.
create table if not exists public.profiles (
  id              text primary key,
  auth_user_id    uuid unique,
  name            text not null,
  email           text not null unique,
  role            text not null default 'student'
                    check (role in ('faculty', 'student', 'staff', 'visitor')),
  department      text not null default 'Institutional',
  status          text not null default 'active'
                    check (status in ('active', 'suspended')),
  notify_email    boolean not null default true,
  notify_in_app   boolean not null default true,
  created_at      timestamptz not null default now()
);

comment on table  public.profiles is 'Campus community directory (faculty, students, admin/staff, visitors).';
comment on column public.profiles.auth_user_id is 'Supabase Auth user this profile belongs to; NULL for local demo seed rows.';
comment on column public.profiles.role is 'Member type: faculty, student, staff (admin/staff) or visitor.';
comment on column public.profiles.department is 'College, office or organising body the member belongs to.';
comment on column public.profiles.status is 'suspended accounts stay in history but should not be assigned new activities.';

-- Existing projects: add the column that links a row to Supabase Auth.
alter table public.profiles add column if not exists auth_user_id uuid;
create unique index if not exists profiles_auth_user_id_idx
  on public.profiles (auth_user_id);

-- Link auth_user_id to auth.users. Added separately (and defensively) because
-- a constraint cannot be created with IF NOT EXISTS.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_auth_user_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users (id) on delete set null;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- TABLE 2: public.tasks  (campus events on the academic calendar)
-- ----------------------------------------------------------------------------
-- "tasks" holds every scheduled campus activity: examinations, intramurals,
-- cultural galas, faculty assemblies and safety drills. The frontend displays
-- them as "events", so the API also exposes an /api/events alias.
create table if not exists public.tasks (
  id              text primary key,
  title           text not null,
  description     text,
  venue           text,
  organizer       text,
  deadline        timestamptz not null,
  priority        text not null default 'medium'
                    check (priority in ('low', 'medium', 'high')),
  status          text not null default 'todo'
                    check (status in ('todo', 'in-progress', 'completed', 'overdue')),
  audience        text not null default 'exclusive'
                    check (audience in ('open-to-public', 'exclusive', 'institutional',
                                        'college', 'basic-education', 'graduate-school',
                                        'college-of-law')),
  committee       text not null default 'Institutional',
  assignee_id     text references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table  public.tasks is 'Scheduled school and campus activities.';
comment on column public.tasks.deadline is 'Scheduled date and time the activity starts.';
comment on column public.tasks.venue is 'Where the activity happens (room, hall, barangay).';
comment on column public.tasks.organizer is 'Person or office running the activity.';
comment on column public.tasks.audience is 'Who may attend; drives the audience badges and filters.';
comment on column public.tasks.committee is 'Organising body shown as the track tag (e.g. College of Law).';
comment on column public.tasks.assignee_id is 'Member in charge of running the event.';

-- Indexes that keep the list, calendar and search queries fast.
create index if not exists tasks_deadline_idx  on public.tasks (deadline);
create index if not exists tasks_status_idx    on public.tasks (status);
create index if not exists tasks_audience_idx  on public.tasks (audience);
create index if not exists tasks_assignee_idx  on public.tasks (assignee_id);


-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
-- RLS is switched on for both tables. Because this milestone uses the public
-- anon key plus the built-in demo login (no Supabase Auth password flow yet),
-- the policies below allow the anon role to read and write. Tighten these to
-- auth.uid() based policies once real Supabase Auth logins are enabled.
alter table public.profiles enable row level security;
alter table public.tasks    enable row level security;

-- public.profiles policies
drop policy if exists "profiles are readable by the school app" on public.profiles;
create policy "profiles are readable by the school app"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles can be added by the school app" on public.profiles;
create policy "profiles can be added by the school app"
  on public.profiles for insert
  to anon, authenticated
  with check (true);

drop policy if exists "profiles can be updated by the school app" on public.profiles;
create policy "profiles can be updated by the school app"
  on public.profiles for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "profiles can be removed by the school app" on public.profiles;
create policy "profiles can be removed by the school app"
  on public.profiles for delete
  to anon, authenticated
  using (true);

-- public.tasks policies
drop policy if exists "tasks are readable by the school app" on public.tasks;
create policy "tasks are readable by the school app"
  on public.tasks for select
  to anon, authenticated
  using (true);

drop policy if exists "tasks can be scheduled by the school app" on public.tasks;
create policy "tasks can be scheduled by the school app"
  on public.tasks for insert
  to anon, authenticated
  with check (true);

drop policy if exists "tasks can be updated by the school app" on public.tasks;
create policy "tasks can be updated by the school app"
  on public.tasks for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "tasks can be removed by the school app" on public.tasks;
create policy "tasks can be removed by the school app"
  on public.tasks for delete
  to anon, authenticated
  using (true);


-- ----------------------------------------------------------------------------
-- SEED DATA - school community (mirrors server/src/data/store.js)
-- ----------------------------------------------------------------------------
insert into public.profiles (id, name, email, role, department, status, notify_email, notify_in_app)
values
  ('user-janilla',   'Janilla O. Juma-ang', 'janilla.jumaang@school.edu.ph',   'staff',   'Registrar',              'active', true,  true),
  ('user-derek',     'Derek Josh Reyes',    'derek.reyes@school.edu.ph',       'faculty', 'College of Engineering', 'active', true,  true),
  ('user-archangel', 'Archangel Fortun',    'archangel.fortun@school.edu.ph',  'student', 'College of Engineering', 'active', false, true),
  ('user-maria',     'Maria L. Santos',     'maria.santos@school.edu.ph',      'visitor', 'Guest',                  'active', false, true)
on conflict (id) do update set
  name          = excluded.name,
  email         = excluded.email,
  role          = excluded.role,
  department    = excluded.department,
  status        = excluded.status,
  notify_email  = excluded.notify_email,
  notify_in_app = excluded.notify_in_app;


-- ----------------------------------------------------------------------------
-- SEED DATA - campus activities (mirrors server/src/data/store.js)
-- ----------------------------------------------------------------------------
-- Timestamps are relative to now() so every run shows a believable schedule:
-- finished activities, one happening right now (state 'live'), and more spread
-- across the next few days for the day picker.
insert into public.tasks
  (id, title, description, venue, organizer, deadline, priority, status, audience, committee, assignee_id)
values
  ('event-1', 'Bike and Plant',
   'Tree planting and coastal cleanup drive with student volunteers.',
   'Sitio Iyao, Brgy. Anticala', 'Mr. Brian Casanos',
   date_trunc('day', now()) + interval '4 hours',  'medium', 'completed', 'open-to-public', 'Institutional', 'user-derek'),

  ('event-2', 'Urian H.E.L.P.',
   'Community health and literacy program, running until 12:00 PM.',
   'Brgy. San Mateo, Butuan City', 'Dr. Sheila Mae P. Jalique, MSc, MD',
   date_trunc('day', now()) + interval '6 hours 30 minutes', 'medium', 'completed', 'open-to-public', 'Institutional', 'user-janilla'),

  ('event-3', 'College of Engineering Days Opening Program',
   'Opening program and amazing race for all engineering students.',
   'Engineering Grounds', 'c/o College of Engineering',
   now() - interval '45 minutes', 'high', 'in-progress', 'exclusive', 'College of Engineering', 'user-derek'),

  ('event-4', 'GS Acquaintance Party',
   'Welcome gathering for graduate school students, until 3:00 PM.',
   'CBE Function Hall', 'c/o Graduate School',
   date_trunc('day', now()) + interval '11 hours', 'low', 'todo', 'exclusive', 'Graduate School', 'user-archangel'),

  ('event-5', 'Q3 Departmental Examinations',
   'Multi-purpose Hall - coverage: Mathematics, Science and English departments.',
   'Multi-purpose Hall', 'c/o Office of the Registrar',
   date_trunc('day', now()) + interval '17 hours', 'high', 'todo', 'exclusive', 'Basic Education', 'user-janilla'),

  ('event-6', 'Faculty General Assembly',
   'Conference Room A - presentation of the new academic calendar and committee assignments.',
   'Conference Room A', 'c/o Office of the President',
   date_trunc('day', now()) + interval '1 day 9 hours', 'high', 'todo', 'exclusive', 'Institutional', 'user-janilla'),

  ('event-7', 'Annual Intramurals Sports Fest',
   'Campus Gymnasium - basketball, volleyball, badminton and chess across all year levels.',
   'Campus Gymnasium', 'c/o Sports and Cultural Affairs',
   date_trunc('day', now()) + interval '1 day 13 hours 30 minutes', 'medium', 'todo', 'exclusive', 'Institutional', 'user-archangel'),

  ('event-8', 'Community Health Mission',
   'Barangay Health Center - free check-up, dental and optometry services.',
   'Barangay Health Center', 'c/o College of Nursing',
   date_trunc('day', now()) + interval '2 days 8 hours', 'medium', 'todo', 'open-to-public', 'Institutional', 'user-maria'),

  ('event-9', 'College of Law Days Opening Program',
   'Law Amphitheater - moot court exhibition and legal aid clinic launch.',
   'Law Amphitheater', 'c/o Consejo de Legis',
   date_trunc('day', now()) + interval '3 days 8 hours', 'medium', 'todo', 'exclusive', 'College of Law', 'user-derek'),

  ('event-10', 'Cultural Gala & Talent Showcase',
   'School Auditorium - dance, music and drama performances by student organizations.',
   'School Auditorium', 'c/o Student Affairs Office',
   date_trunc('day', now()) + interval '4 days 18 hours', 'low', 'todo', 'open-to-public', 'Institutional', 'user-archangel'),

  ('event-11', 'Campus Earthquake Safety Drill',
   'Main Quadrangle - evacuation route briefing for all teaching and non-teaching personnel.',
   'Main Quadrangle', 'c/o Campus Safety Office',
   date_trunc('day', now()) - interval '1 day' + interval '9 hours', 'medium', 'completed', 'exclusive', 'Institutional', 'user-janilla'),

  ('event-12', 'Foundation Day Parade',
   'Academic Oval - contingent formation of all departments followed by the flag ceremony.',
   'Academic Oval', 'c/o Office of Student Affairs',
   date_trunc('day', now()) - interval '3 days' + interval '7 hours 30 minutes', 'low', 'completed', 'open-to-public', 'Institutional', 'user-archangel')
on conflict (id) do update set
  title       = excluded.title,
  description = excluded.description,
  venue       = excluded.venue,
  organizer   = excluded.organizer,
  deadline    = excluded.deadline,
  priority    = excluded.priority,
  status      = excluded.status,
  audience    = excluded.audience,
  committee   = excluded.committee,
  assignee_id = excluded.assignee_id;


-- ----------------------------------------------------------------------------
-- DONE. Verify with:
--   select id, name, role, department from public.profiles order by id;
--   select id, title, deadline, audience, committee from public.tasks order by deadline;
-- ----------------------------------------------------------------------------
