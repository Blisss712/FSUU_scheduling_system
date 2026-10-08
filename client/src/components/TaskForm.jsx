import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { AUDIENCE_LABELS, COMMITTEES, ROLE_LABELS } from '../config/schedule';

// Converts a stored ISO timestamp into the "YYYY-MM-DDTHH:mm" string that an
// <input type="datetime-local"> expects, using the browser's local timezone.
const toLocalInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Activity form used for BOTH scheduling a new activity and editing an
// existing one. Pass `editingTask` to switch the form into edit mode; the
// submit button then calls onUpdate instead of onAdd.
export default function TaskForm({ onAdd, editingTask, onUpdate, onCancelEdit }) {
  const { users } = useContext(AuthContext);
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [audience, setAudience] = useState('exclusive');
  const [committee, setCommittee] = useState('Institutional');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = Boolean(editingTask);

  const clearForm = () => {
    setTitle('');
    setVenue('');
    setOrganizer('');
    setDescription('');
    setDeadline('');
    setAudience('exclusive');
    setCommittee('Institutional');
    setPriority('medium');
    setAssigneeId('');
    setError('');
  };

  // Load the selected activity into the form when edit mode starts.
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title || '');
      setVenue(editingTask.venue || '');
      setOrganizer(editingTask.organizer || '');
      setDescription(editingTask.description || '');
      setDeadline(toLocalInputValue(editingTask.deadline));
      setAudience(editingTask.audience || 'exclusive');
      setCommittee(editingTask.committee || 'Institutional');
      setPriority(editingTask.priority || 'medium');
      setAssigneeId(editingTask.assignee_id || '');
      setError('');
    } else {
      clearForm();
    }
  }, [editingTask]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!deadline) {
      setError('Please choose the activity date and time.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      title,
      venue,
      organizer,
      description,
      // datetime-local gives "YYYY-MM-DDTHH:mm" in the user's local time -
      // convert to a full ISO timestamp before sending to the API.
      deadline: new Date(deadline).toISOString(),
      audience,
      committee,
      priority,
      assignee_id: assigneeId || null
    };

    const result = isEditing
      ? await onUpdate(editingTask.id, payload)
      : await onAdd(payload);

    setSaving(false);

    if (result && result.error) {
      setError(result.error);
      return;
    }
    if (!isEditing) clearForm();
  };

  const handleCancel = () => {
    clearForm();
    if (onCancelEdit) onCancelEdit();
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <h2>{isEditing ? `Edit Activity: ${editingTask.title}` : 'Schedule an Activity'}</h2>

      {error && <p className="form-error">⚠ {error}</p>}

      <div className="form-grid">
        <label>
          Activity Name
          <input
            placeholder="e.g. College of Law Days Opening Program"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label>
          Starts At
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </label>

        <label>
          Venue
          <input
            placeholder="e.g. Law Amphitheater"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </label>

        <label>
          Organized By
          <input
            placeholder="e.g. c/o Consejo de Legis"
            value={organizer}
            onChange={(e) => setOrganizer(e.target.value)}
          />
        </label>

        <label className="field-span">
          Details
          <textarea
            placeholder="Guidelines, coverage, guests and anything else attendees should know"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </label>

        <label>
          Who May Attend
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label>
          Track / Organizing Body
          <input
            list="committee-options"
            placeholder="e.g. College of Law"
            value={committee}
            onChange={(e) => setCommittee(e.target.value)}
          />
          <datalist id="committee-options">
            {COMMITTEES.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <div className="form-row">
          <label>
            Urgency
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label>
            Person In Charge
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({ROLE_LABELS[account.role] || account.role})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEditing ? '💾 Save Changes' : '➕ Add to Schedule'}
        </button>
        <button className="btn" type="button" onClick={handleCancel}>
          {isEditing ? 'Cancel Edit' : 'Clear'}
        </button>
      </div>
    </form>
  );
}
