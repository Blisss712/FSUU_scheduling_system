import React, { useState, useEffect, useContext } from 'react';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { canManageSchedule, dateKey } from './config/schedule';
import Navbar from './components/Navbar';
import LoginModal from './components/LoginModal';
import TaskForm from './components/TaskForm';
import ScheduleView from './components/ScheduleView';
import ProfileView from './components/ProfileView';
import CalendarView from './components/CalendarView';
import AlertBanner from './components/AlertBanner';

// School & Campus Event Scheduling System - top-level layout.
// Tabs: Schedule (day-based activities), Timeline (date-grouped list) and
// Profile (account + campus community directory).

// App owns the session context; the screen itself lives in <SchedulerShell>
// so it can read the signed-in member and hide controls they cannot use.
export default function App() {
  return (
    <AuthProvider>
      <SchedulerShell />
    </AuthProvider>
  );
}

function SchedulerShell() {
  const { user } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState('events');
  const [showLogin, setShowLogin] = useState(false);
  const [tasks, setTasks] = useState([]);

  // Form visibility. The creation form is collapsed by default so the schedule
  // gets the full screen; clicking Edit opens it automatically.
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  // The activity currently loaded into the form for editing (null = create).
  const [editingTask, setEditingTask] = useState(null);

  // Day the schedule should jump to after a new activity is created.
  const [focusDay, setFocusDay] = useState(null);

  // Only admin/staff and faculty may change the schedule.
  const canManage = canManageSchedule(user);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Could not load campus events:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Scheduling a brand new activity.
  const handleTaskCreated = async (task) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });
      const created = await res.json();
      if (!res.ok) return created;
      await fetchTasks();
      setIsCreateTaskOpen(false);
      // Follow the new activity to its day so it is visible immediately.
      const createdDay = dateKey(created.deadline);
      setFocusDay(createdDay);
      return created;
    } catch (err) {
      console.error('Could not schedule the activity:', err);
      return { error: 'Could not reach the scheduler API.' };
    }
  };

  // Save a full edit to an existing activity, then leave edit mode.
  const handleTaskUpdated = async (id, updates) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const updated = await res.json();
      if (!res.ok) return updated;
      await fetchTasks();
      setEditingTask(null);
      setIsCreateTaskOpen(false);
      return updated;
    } catch (err) {
      console.error('Could not update the activity:', err);
      return { error: 'Could not reach the scheduler API.' };
    }
  };

  const handleDeleteTask = async (id) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    // Leave edit mode if the activity being edited was the one deleted.
    if (editingTask && editingTask.id === id) setEditingTask(null);
    fetchTasks();
  };

  // Clicking the pencil on a row loads that activity into the form.
  const handleEditTask = (task) => {
    if (!canManage) return;
    setActiveTab('events');
    setIsCreateTaskOpen(true);
    setEditingTask(task);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Closing the form clears any activity that was loaded for editing.
  const closeForm = () => {
    setIsCreateTaskOpen(false);
    setEditingTask(null);
  };

  return (
    <>
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSwitchAccount={() => setShowLogin(true)}
      />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      <main className="app-main">
        <AlertBanner tasks={tasks} />

        {activeTab === 'events' && (
          <>
            {canManage && (isCreateTaskOpen || editingTask) && (
              <TaskForm
                onAdd={handleTaskCreated}
                editingTask={editingTask}
                onUpdate={handleTaskUpdated}
                onCancelEdit={closeForm}
              />
            )}

            {canManage && !isCreateTaskOpen && !editingTask && (
              <button
                className="btn btn-primary new-event-btn"
                onClick={() => setIsCreateTaskOpen(true)}
              >
                ➕ Schedule an Activity
              </button>
            )}

            <ScheduleView
              tasks={tasks}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              focusDay={focusDay}
            />
          </>
        )}

        {activeTab === 'calendar' && (
          <>
            <header className="page-head">
              <h2>Timeline</h2>
              <p className="page-head-note">Every scheduled activity, grouped by date.</p>
            </header>
            <CalendarView tasks={tasks} />
          </>
        )}

        {activeTab === 'profile' && (
          <>
            <header className="page-head">
              <h2>My Profile</h2>
              <p className="page-head-note">
                Your account, reminder preferences and the campus community.
              </p>
            </header>
            <ProfileView />
          </>
        )}
      </main>

      <footer className="app-footer">
        School &amp; Campus Event Scheduling System — React + Node.js + Supabase
      </footer>
    </>
  );
}
