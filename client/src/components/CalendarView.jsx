import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
  AUDIENCE_LABELS,
  STATE_LABELS,
  activityState,
  committeeTone
} from '../config/schedule';

// Date-grouped activity timeline: every scheduled activity ordered
// chronologically, grouped by calendar date, with its audience and track.
const dayLabel = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function CalendarView({ tasks }) {
  const { users } = useContext(AuthContext);

  const nameOf = (id) => {
    const account = users.find((u) => u.id === id);
    return account ? account.name : 'Unassigned';
  };

  // Group the activities by calendar date (sorted chronologically).
  const groups = [];
  const byDate = new Map();
  for (const task of [...tasks].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))) {
    const key = new Date(task.deadline).toDateString();
    if (!byDate.has(key)) {
      byDate.set(key, []);
      groups.push(key);
    }
    byDate.get(key).push(task);
  }

  const today = new Date().toDateString();
  const now = Date.now();

  return (
    <div className="calendar-view">
      {groups.length === 0 ? (
        <p className="empty-state">Nothing scheduled yet.</p>
      ) : (
        groups.map((key) => (
          <div key={key} className={`calendar-day ${key === today ? 'today' : ''}`}>
            <div className="calendar-day-header">
              <h3>
                {dayLabel(byDate.get(key)[0].deadline)}
                {key === today ? ' (Today)' : ''}
              </h3>
              <span className="calendar-day-count">
                {byDate.get(key).length} {byDate.get(key).length === 1 ? 'activity' : 'activities'}
              </span>
            </div>
            <div className="calendar-slots">
              {byDate.get(key).map((task) => {
                const state = activityState(task, now);
                return (
                  <div key={task.id} className={`calendar-slot state-${state}`}>
                    <span className="slot-time">{timeLabel(task.deadline)}</span>
                    <span
                      className={`slot-priority priority-${task.priority}`}
                      title={`${task.priority} priority`}
                    />
                    <span className="slot-title">{task.title}</span>
                    <span className={`state-tag state-${state}`}>
                      {state === 'live' && <span className="live-dot" aria-hidden="true" />}
                      {STATE_LABELS[state] || state}
                    </span>

                    <span className="slot-detail">
                      {task.venue ? `${task.venue} · ` : ''}
                      {AUDIENCE_LABELS[task.audience] || task.audience || ''}
                    </span>
                    <span className="slot-tags">
                      {task.committee && (
                        <span className={`track-tag tone-${committeeTone(task.committee)}`}>
                          {task.committee}
                        </span>
                      )}
                      <span className="slot-assignee">👤 {nameOf(task.assignee_id)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
