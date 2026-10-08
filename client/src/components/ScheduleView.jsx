import React, { useMemo, useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
  AUDIENCE_LABELS,
  STATE_LABELS,
  activityState,
  canManageSchedule,
  committeeTone,
  dateKey,
  periodOf,
  upcomingDays
} from '../config/schedule';

// Day-based campus schedule.
//
// Layout mirrors the reference design: a horizontal day picker, a row of track
// filter chips, then the day's activities grouped into MORNING / AFTERNOON /
// EVENING sections. Each activity shows its start time, name, venue and
// organizer, followed by audience, track and state tags.
//
// Activities that are happening right now are marked Live automatically.

const DAYS_SHOWN = 6;

// Splits a time into its parts so the hour can sit large above the AM/PM.
const timeParts = (iso) => {
  const d = new Date(iso);
  const hours24 = d.getHours();
  const hour12 = hours24 % 12 || 12;
  return {
    hour: String(hour12),
    suffix: hours24 >= 12 ? 'PM' : 'AM',
    minutes: String(d.getMinutes()).padStart(2, '0'),
    full: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  };
};

export default function ScheduleView({ tasks, onEdit, onDelete, focusDay }) {
  const { user, users } = useContext(AuthContext);

  const days = useMemo(() => upcomingDays(DAYS_SHOWN), []);
  const [selectedDay, setSelectedDay] = useState(days[0].key);
  const [track, setTrack] = useState('all');
  const [publicOnly, setPublicOnly] = useState(false);

  // When a new activity lands on a different day, follow it so the user sees
  // what they just scheduled instead of an apparently empty screen.
  useEffect(() => {
    if (!focusDay) return;
    const match = days.find((d) => d.key === focusDay);
    if (match) {
      setSelectedDay(match.key);
      setTrack('all');
      setPublicOnly(false);
    }
  }, [focusDay, days]);

  const canManage = canManageSchedule(user);

  // Track chips come from the data so the row adapts as activities are added.
  const tracks = useMemo(() => {
    const found = new Set(tasks.map((t) => t.committee).filter(Boolean));
    return ['all', ...[...found].sort()];
  }, [tasks]);

  const nameOf = (id) => {
    const account = users.find((u) => u.id === id);
    return account ? account.name : 'Unassigned';
  };

  // Activities for the selected day, filtered by track and audience.
  const dayActivities = useMemo(() => {
    const now = Date.now();
    return tasks
      .filter((t) => dateKey(t.deadline) === selectedDay)
      .filter((t) => track === 'all' || t.committee === track)
      .filter((t) => !publicOnly || t.audience === 'open-to-public')
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .map((t) => ({ ...t, state: activityState(t, now) }));
  }, [tasks, selectedDay, track, publicOnly]);

  // Group into time-of-day sections, preserving chronological order.
  const grouped = useMemo(() => {
    const buckets = new Map();
    for (const activity of dayActivities) {
      const period = periodOf(activity.deadline);
      if (!buckets.has(period.id)) buckets.set(period.id, { label: period.label, items: [] });
      buckets.get(period.id).items.push(activity);
    }
    return [...buckets.values()];
  }, [dayActivities]);

  const selectedIndex = days.findIndex((d) => d.key === selectedDay);
  const selected = days[selectedIndex] || days[0];
  const dayCount = dayActivities.length;

  const daySummary = selected.isToday
    ? `Today · ${selected.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : selected.date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });

  return (
    <div className="schedule">
      <header className="schedule-head">
        <h2>Schedule</h2>
        <p className="schedule-note">
          Tap a day, then filter by track. Activities happening right now are marked Live.
        </p>
      </header>

      {/* Audience legend */}
      <div className="audience-legend">
        <span className="audience-chip tone-open">
          <span aria-hidden="true">🌐</span> Open to public
        </span>
        <span className="legend-note">everyone is welcome</span>
      </div>
      <div className="audience-legend">
        <span className="audience-chip tone-exclusive">
          <span aria-hidden="true">👥</span> Exclusive for campus community
        </span>
        <span className="legend-note">students, faculty and staff only</span>
      </div>

      {/* Day picker */}
      <div className="day-picker" role="tablist" aria-label="Choose a day">
        {days.map((day) => {
          const isActive = day.key === selectedDay;
          const total = tasks.filter((t) => dateKey(t.deadline) === day.key).length;
          return (
            <button
              key={day.key}
              role="tab"
              aria-selected={isActive}
              className={`day-card ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedDay(day.key)}
            >
              <span className="day-weekday">{day.weekday}</span>
              <span className="day-number">{day.dayNumber}</span>
              <span className="day-dot" data-count={total} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <p className="day-summary">
        Day {selectedIndex + 1} of {days.length} · {daySummary} · {dayCount}{' '}
        {dayCount === 1 ? 'activity' : 'activities'}
      </p>

      {/* Track filters */}
      <div className="track-filters">
        {tracks.map((name) => (
          <button
            key={name}
            className={`filter-chip ${track === name ? 'active' : ''}`}
            onClick={() => setTrack(name)}
          >
            {name === 'all' ? 'All' : name}
          </button>
        ))}
        <button
          className={`filter-chip chip-public ${publicOnly ? 'active' : ''}`}
          onClick={() => setPublicOnly((v) => !v)}
          aria-pressed={publicOnly}
        >
          <span aria-hidden="true">🌐</span> Open to public only
        </button>
      </div>

      {/* Activity list */}
      {grouped.length === 0 ? (
        <p className="empty-state">
          No activities scheduled for this day{track !== 'all' ? ` in ${track}` : ''}
          {publicOnly ? ' that are open to the public' : ''}.
        </p>
      ) : (
        <div className="activity-groups">
          {grouped.map((group) => (
            <section key={group.label} className="activity-group">
              <h3 className="activity-period">{group.label}</h3>
              <div className="activity-rows">
                {group.items.map((activity) => {
                  const time = timeParts(activity.deadline);
                  return (
                    <article
                      key={activity.id}
                      className={`activity-row state-${activity.state}`}
                    >
                      <div className="activity-time">
                        <span className="activity-hour">{time.hour}</span>
                        <span className="activity-suffix">{time.suffix}</span>
                      </div>

                      <div className="activity-body">
                        <h4 className="activity-title">{activity.title}</h4>

                        <p className="activity-meta">
                          {[activity.venue, activity.organizer, activity.description]
                            .filter(Boolean)
                            // The description often repeats the venue and organizer;
                            // drop part of the line rather than printing it twice.
                            .filter((part, index, all) =>
                              all.findIndex((other) => other && part && other.includes(part)) === index
                            )
                            .join(' · ')}
                        </p>

                        <div className="activity-tags">
                          <span className={`audience-chip tone-${activity.audience === 'open-to-public' ? 'open' : 'exclusive'}`}>
                            <span aria-hidden="true">
                              {activity.audience === 'open-to-public' ? '🌐' : '👥'}
                            </span>
                            {AUDIENCE_LABELS[activity.audience] || activity.audience}
                          </span>

                          {activity.committee && (
                            <span className={`track-tag tone-${committeeTone(activity.committee)}`}>
                              {activity.committee}
                            </span>
                          )}

                          <span className={`state-tag state-${activity.state}`}>
                            {activity.state === 'live' && <span className="live-dot" aria-hidden="true" />}
                            {STATE_LABELS[activity.state] || activity.state}
                          </span>
                        </div>

                        <p className="activity-assignee">
                          In charge: {nameOf(activity.assignee_id)}
                        </p>
                      </div>

                      {canManage && (
                        <div className="activity-actions">
                          <button
                            className="edit-btn"
                            title="Edit activity"
                            aria-label={`Edit ${activity.title}`}
                            onClick={() => onEdit(activity)}
                          >
                            ✏️
                          </button>
                          <button
                            className="delete-btn"
                            title="Delete activity"
                            aria-label={`Delete ${activity.title}`}
                            onClick={() => onDelete(activity.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
