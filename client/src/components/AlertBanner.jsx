import React from 'react';

// Past activity & 24h upcoming activity notification banner: warns the campus
// community about activities that already finished without being marked done,
// and about activities starting within the next 24 hours.
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export default function AlertBanner({ tasks }) {
  const now = Date.now();

  // "Not marked done" means the activity has finished and nobody closed it out.
  // Activities that are still running are not overdue, and anything already
  // completed is clearly fine.
  const overdue = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (t.state === 'live') return false;
    const startsAt = new Date(t.deadline).getTime();
    return t.status === 'overdue' || startsAt < now;
  });

  const urgentSoon = tasks.filter((t) => {
    const when = new Date(t.deadline).getTime();
    return t.status !== 'completed' && when >= now && when - now <= DAY_IN_MS;
  });

  if (overdue.length === 0 && urgentSoon.length === 0) {
    return (
      <div className="alert-banner clear">
        ✅ Nothing overdue, and nothing starting in the next 24 hours.
      </div>
    );
  }

  return (
    <div className="alert-banner">
      {overdue.length > 0 && (
        <p className="alert-line overdue">
          ⛔ <strong>{overdue.length}</strong> past {overdue.length > 1 ? 'activities' : 'activity'} not
          marked done: {overdue.map((t) => t.title).join(', ')}
        </p>
      )}
      {urgentSoon.length > 0 && (
        <p className="alert-line soon">
          ⏰ <strong>{urgentSoon.length}</strong> {urgentSoon.length > 1 ? 'activities' : 'activity'}{' '}
          starting within the next 24 hours:{' '}
          {urgentSoon.map((t) => `${t.title} (${t.priority} priority)`).join(', ')}
        </p>
      )}
    </div>
  );
}
