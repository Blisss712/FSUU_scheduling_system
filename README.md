# School & Campus Event Scheduling System

A centralized platform for schools and academic campuses to plan, schedule,
assign and track campus events: academic calendars, examinations, intramurals,
cultural galas, faculty assemblies and safety drills.

Built as a beginner-friendly project by a three-person team.

- **Frontend:** React 18 (plain JavaScript + plain CSS, no TypeScript, no Tailwind, no UI library)
- **Backend:** Node.js + Express
- **Database:** Supabase (PostgreSQL) with an offline in-memory fallback

### Interface

The visual language is adapted from the **E-Skedyul** UI kit: a navy `#1B3A6B`
and gold `#C9921A` palette, the Inter typeface, softly rounded cards, pill
buttons, and status pills. It is implemented as plain CSS in
[`client/src/App.css`](client/src/App.css) — the Tailwind utility classes from
the original kit were translated into named classes so the project keeps its
"no Tailwind, no UI library" guarantee. The layout is mobile-first and fits
screens down to 320px wide.

---

## Quick start

```bash
# 1. Install the root tooling and both workspaces
npm install

# 2. Start the API and the web client together
npm run dev
```

| Service | URL |
| --- | --- |
| Web client | <http://localhost:5173> |
| Backend API | <http://localhost:5000> |

The app starts in **Local Demo** mode with pre-seeded school data, so it works
immediately with no database setup. The navigation bar shows a 🟡 **Local Demo**
or 🟢 **Live Cloud** badge so you always know which mode is active.

### Other commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the API and the web client together |
| `npm run dev:server` | Start only the backend API |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run build` | Production build of the web client |
| `npm start` | Start the backend API without watch mode |
| `node _verify_api.mjs` | Run the 35-check endpoint test suite (API must be running) |

---

## Going live with Supabase

1. Create a free project at <https://supabase.com>.
2. Open the **SQL Editor**, paste the whole of `supabase/schema.sql`, and click
   **Run**. This creates the tables, the RLS policies and the sample data.
3. Copy your **Project URL** and **anon public** key from
   *Project Settings → API*.
4. Put them in `server/.env` (copy `server/.env.example` first).
5. Restart the backend — the badge flips to 🟢 **Live Cloud**.

Full walkthrough with screenshots-free step-by-step instructions and
troubleshooting: [`docs/SUPABASE_SETUP_GUIDE.md`](docs/SUPABASE_SETUP_GUIDE.md).

---

## Project structure

```
.
├── client/                       React web client
│   ├── src/
│   │   ├── App.jsx               Layout, activity state & editing modal orchestration
│   │   ├── App.css               All styling (plain CSS flexbox & grid)
│   │   ├── config/
│   │   │   └── schedule.js       Member types, audiences, tracks & day helpers
│   │   ├── context/
│   │   │   └── AuthContext.jsx   Session, community directory, live/demo flag
│   │   └── components/
│   │       ├── Navbar.jsx        Navigation, member-type badge, connection badge
│   │       ├── LoginModal.jsx    1-click member switcher
│   │       ├── ScheduleView.jsx  Day picker, track filters & tagged activity rows
│   │       ├── TaskForm.jsx      Dual-mode activity create + edit form
│   │       ├── CalendarView.jsx  Date-grouped activity timeline
│   │       ├── AlertBanner.jsx   Overdue & 24-hour warning banner
│   │       └── ProfileView.jsx   Profile, preferences & community management
│   └── vite.config.js            Dev server + /api proxy to port 5000
├── server/                       Express API
│   ├── src/
│   │   ├── index.js              Entry point, /api/health
│   │   ├── config/supabase.js    Client initialiser & live/demo detector
│   │   ├── data/store.js         In-memory fallback store
│   │   └── routes/
│   │       ├── auth.js           Member CRUD, login, profile
│   │       └── tasks.js          Activity CRUD, audience, calendar grouping
│   └── .env.example
├── supabase/schema.sql           Tables, RLS policies & seed data
├── docs/                         Setup guide & progress report
└── _verify_api.mjs               Endpoint test suite
```

---

## API reference

Every route answers from Supabase in Live Cloud mode and from the in-memory
store otherwise. `/api/events` is a full alias of `/api/tasks`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status plus the live/demo detector |
| GET | `/api/auth/status` | Connection and session overview |
| GET | `/api/auth/users` | Campus community directory |
| GET | `/api/auth/me` | Currently active account |
| POST | `/api/auth/login` | 1-click sign-in by email |
| PUT | `/api/auth/profile` | Update name and reminder preferences |
| POST | `/api/auth/users` | Create a member (admin/staff) |
| DELETE | `/api/auth/users/:id` | Remove a member (blocks self-removal) |
| GET | `/api/tasks` | All activities, soonest first, with a derived `state` |
| GET | `/api/tasks?group=calendar` | Activities grouped by `YYYY-MM-DD` |
| GET | `/api/tasks/calendar` | Same grouping as a dedicated endpoint |
| POST | `/api/tasks` | Schedule a new activity |
| PUT | `/api/tasks/:id` | Full activity edit |
| PATCH | `/api/tasks/:id/status` | Change only the status |
| DELETE | `/api/tasks/:id` | Remove an activity |

Every activity carries an **audience** (`open-to-public`, `exclusive`,
`institutional`, `college`, `basic-education`, `graduate-school`,
`college-of-law`), an organising body in **committee**, a **venue**, an
**organizer**, and a read-only **state** of `done`, `live` or `upcoming` that
the API derives from the clock.

---

## Member types

The 1-click switcher (click your name in the navigation bar) makes it easy to
test each member type. Only **Admin / Staff** and **Faculty** can change the
schedule; **Student** and **Visitor** see a read-only schedule.

| Member type | Label | Capabilities |
| --- | --- | --- |
| `staff` | Admin / Staff | Everything, plus add/remove members |
| `faculty` | Faculty | Schedule, edit and reassign activities |
| `student` | Student | Browse the schedule |
| `visitor` | Visitor | Browse the schedule |

### The Schedule screen

The Events tab is a day-based schedule:

- a **day picker** across the next six days, with a dot marking days that have activities
- **track filter chips** built from the data (Institutional, College of Law, …) plus an *Open to public only* toggle
- activities grouped into **Early Morning / Morning / Afternoon / Evening**, ordered by start time
- each row shows its start time, name, venue, organizer, and **audience / track / state** tags
- anything currently running is tagged **Live** automatically, from the schedule window rather than a manual status

---

## Documentation

- [`docs/SUPABASE_SETUP_GUIDE.md`](docs/SUPABASE_SETUP_GUIDE.md) — database setup, step by step
- [`docs/TWO_DAY_PROGRESS_DOCUMENTATION.md`](docs/TWO_DAY_PROGRESS_DOCUMENTATION.md) — progress report, work breakdown and verification results

---

## Known limitations

Authentication is demo-grade (email-only switching, no password), RLS currently
trusts the anon key so the demo needs no logins, Local Demo mode resets on
restart, and reminder preferences are stored but nothing sends the emails yet.
See section 7 of the progress report for the full list and next steps.
