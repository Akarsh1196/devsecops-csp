import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = '/api';
const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];
const PRIORITIES = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];
const INITIAL_STATS = { total: 0, open: 0, inProgress: 0, resolved: 0 };

const STATUS_META = {
  OPEN: { label: 'Open', className: 'open', action: 'Start work', next: 'IN_PROGRESS' },
  IN_PROGRESS: { label: 'In progress', className: 'progress', action: 'Resolve', next: 'RESOLVED' },
  RESOLVED: { label: 'Resolved', className: 'resolved', action: 'Reopen', next: 'OPEN' },
};

const PRIORITY_META = {
  HIGH: { label: 'High', className: 'high' },
  MEDIUM: { label: 'Medium', className: 'medium' },
  LOW: { label: 'Low', className: 'low' },
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function formatStatus(status) {
  return STATUS_META[status]?.label || status?.replace('_', ' ') || 'Unknown';
}

function formatTimeAgo(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getInitials(name) {
  const safeName = name?.trim() || 'Unassigned';
  if (safeName.toLowerCase() === 'unassigned') return '—';
  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    inbox: <><path d="M4 5.5h16v13H4z" /><path d="m4 14 4-4 3 3 3-3 6 4" /><path d="M8 18h8" /></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    activity: <><path d="M3 12h4l2.2-7 4.1 14 2.3-7H21" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-4L3 10" /><path d="M3 5v5h5" /><path d="M4 13a8 8 0 0 0 14.7 4L21 14" /><path d="M21 19v-5h-5" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    alert: <><path d="M12 3 2.7 20h18.6L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    spark: <><path d="m12 3 1.2 5.8L19 10l-5.8 1.2L12 17l-1.2-5.8L5 10l5.8-1.2L12 3ZM19 16l.5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z" /></>,
    filter: <><path d="M4 5h16M7 12h10M10 19h4" /></>,
  };

  return <svg {...common}>{paths[name] || paths.grid}</svg>;
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const loadData = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const [taskData, statData] = await Promise.all([
        request('/incidents'),
        request('/incidents/stats'),
      ]);
      setTasks(taskData);
      setStats(statData);
    } catch (loadError) {
      setError(loadError.message || 'OpsDesk could not reach the API.');
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData({ initial: true });
  }, [loadData]);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'ALL' || task.priority === priorityFilter;
      const haystack = `${task.title} ${task.description || ''} ${task.assignee || ''}`.toLowerCase();
      return matchesStatus && matchesPriority && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [priorityFilter, query, statusFilter, tasks]);

  const hasFilters = Boolean(query.trim() || statusFilter !== 'ALL' || priorityFilter !== 'ALL');

  function clearFilters() {
    setQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
  }

  async function handleStatusChange(task) {
    const nextStatus = STATUS_META[task.status]?.next;
    if (!nextStatus) return;

    setUpdatingId(task.id);
    setActionError('');
    try {
      await request(`/incidents/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadData();
    } catch (updateError) {
      setActionError(`Could not update “${task.title}”. ${updateError.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCreate(payload) {
    setActionError('');
    await request('/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowCreate(false);
    await loadData();
  }

  return (
    <div className="app-shell">
      <Sidebar onCreate={() => setShowCreate(true)} />
      <div className="mobile-topbar">
        <div className="brand compact-brand">
          <span className="brand-mark">O</span>
          <span className="brand-name">OpsDesk</span>
        </div>
        <button className="mobile-create" type="button" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={17} />
          <span>New</span>
        </button>
      </div>

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">OPERATIONS / INCIDENTS</p>
            <h1>Good morning, Nensi <span className="wave">✦</span></h1>
            <p className="page-subtitle">Keep your team moving with a clear view of every work item.</p>
          </div>
          <div className="header-actions">
            <button className="icon-button" type="button" onClick={() => loadData()} disabled={refreshing} aria-label="Refresh incidents">
              <Icon name="refresh" size={17} />
            </button>
            <button className="primary-button" type="button" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={17} />
              New incident
            </button>
          </div>
        </header>

        {error && <ErrorBanner message={error} onRetry={() => loadData({ initial: tasks.length === 0 })} />}
        {actionError && <ErrorBanner message={actionError} onRetry={() => setActionError('')} dismissible />}

        <section className="stats-grid" aria-label="Incident summary">
          <StatCard label="Total work items" value={stats.total} detail="Across this workspace" icon="grid" tone="blue" />
          <StatCard label="Open incidents" value={stats.open} detail="Waiting for action" icon="inbox" tone="amber" />
          <StatCard label="In progress" value={stats.inProgress} detail="Actively being handled" icon="activity" tone="violet" />
          <StatCard label="Resolved" value={stats.resolved} detail="Closed successfully" icon="check" tone="green" />
        </section>

        <section className="dashboard-grid">
          <div className="panel queue-panel">
            <div className="panel-heading">
              <div>
                <div className="title-with-status">
                  <h2>Incident queue</h2>
                  <span className="live-badge"><span /> Live</span>
                </div>
                <p className="panel-description">Prioritize, assign, and move work through resolution.</p>
              </div>
              {refreshing && <span className="refreshing"><span className="spinner small" /> Syncing</span>}
            </div>

            <div className="queue-toolbar">
              <label className="search-field">
                <Icon name="search" size={17} />
                <span className="sr-only">Search incidents</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search incidents, owners…" />
              </label>
              <div className="filter-group" aria-label="Filter by status">
                <Icon name="filter" size={16} />
                {STATUSES.map((status) => (
                  <button
                    className={statusFilter === status ? 'filter-button selected' : 'filter-button'}
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'ALL' ? 'All' : formatStatus(status)}
                  </button>
                ))}
              </div>
              <label className="priority-select">
                <span className="sr-only">Filter by priority</span>
                <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                  {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority === 'ALL' ? 'All priorities' : `${PRIORITY_META[priority].label} priority`}</option>)}
                </select>
                <Icon name="chevron" size={15} />
              </label>
              {hasFilters && <button className="clear-filters" type="button" onClick={clearFilters}>Clear</button>}
            </div>

            {loading ? (
              <LoadingTable />
            ) : tasks.length === 0 ? (
              <EmptyState type="empty" onCreate={() => setShowCreate(true)} />
            ) : visibleTasks.length === 0 ? (
              <EmptyState type="filtered" onClear={clearFilters} />
            ) : (
              <IncidentTable tasks={visibleTasks} updatingId={updatingId} onStatusChange={handleStatusChange} />
            )}
          </div>

          <aside className="side-column">
            <HealthCard tasks={tasks} />
            <ActivityCard tasks={tasks} />
          </aside>
        </section>
      </main>

      {showCreate && <CreateIncidentModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}

function Sidebar({ onCreate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">O</span>
        <div>
          <strong className="brand-name">OpsDesk</strong>
          <small>Incident operations</small>
        </div>
      </div>
      <button className="sidebar-create" type="button" onClick={onCreate}>
        <Icon name="plus" size={17} />
        <span>New incident</span>
        <kbd>N</kbd>
      </button>
      <p className="nav-label">Workspace</p>
      <nav className="sidebar-nav" aria-label="Workspace navigation">
        <button className="nav-item active" type="button"><Icon name="grid" size={18} /><span>Overview</span></button>
        <button className="nav-item" type="button"><Icon name="inbox" size={18} /><span>My queue</span><span className="nav-count">4</span></button>
        <button className="nav-item" type="button"><Icon name="list" size={18} /><span>All work items</span></button>
        <button className="nav-item" type="button"><Icon name="activity" size={18} /><span>Activity</span></button>
      </nav>
      <div className="sidebar-footer">
        <div className="workspace-card">
          <span className="workspace-icon"><Icon name="spark" size={16} /></span>
          <div><strong>Production</strong><small>Connected workspace</small></div>
          <span className="connected-dot" />
        </div>
        <div className="profile">
          <div className="avatar profile-avatar">NR</div>
          <div><strong>Nensi Ravaliya</strong><small>Developer</small></div>
          <span className="profile-menu">•••</span>
        </div>
      </div>
    </aside>
  );
}

function StatCard({ label, value, detail, icon, tone }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon name={icon} size={19} /></div>
      <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      <span className="stat-arrow"><Icon name="arrow" size={16} /></span>
    </article>
  );
}

function ErrorBanner({ message, onRetry, dismissible = false }) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-icon"><Icon name="alert" size={17} /></span>
      <span className="error-message">{message}</span>
      {onRetry && <button type="button" onClick={onRetry}>{dismissible ? 'Dismiss' : 'Try again'}</button>}
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="loading-table" aria-label="Loading incidents" aria-busy="true">
      {[1, 2, 3, 4].map((row) => <div className="skeleton-row" key={row}><span /><span /><span /><span /><span /></div>)}
    </div>
  );
}

function EmptyState({ type, onCreate, onClear }) {
  const isFiltered = type === 'filtered';
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={isFiltered ? 'search' : 'inbox'} size={22} /></div>
      <h3>{isFiltered ? 'No incidents match those filters' : 'Your queue is clear'}</h3>
      <p>{isFiltered ? 'Try a different search or reset the active filters.' : 'Create the first work item to start tracking operational work.'}</p>
      {isFiltered ? <button className="secondary-button" type="button" onClick={onClear}>Reset filters</button> : <button className="primary-button" type="button" onClick={onCreate}><Icon name="plus" size={16} /> Create incident</button>}
    </div>
  );
}

function IncidentTable({ tasks, updatingId, onStatusChange }) {
  return (
    <div className="table-wrap">
      <table className="incident-table">
        <thead><tr><th>Work item</th><th>Owner</th><th>Priority</th><th>Status</th><th>Next action</th></tr></thead>
        <tbody>
          {tasks.map((task) => {
            const status = STATUS_META[task.status] || STATUS_META.OPEN;
            const priority = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM;
            const isUpdating = updatingId === task.id;
            return (
              <tr key={task.id}>
                <td data-label="Work item" className="work-item-cell">
                  <div className={`task-mark ${status.className}`}><Icon name={task.status === 'RESOLVED' ? 'check' : 'activity'} size={15} /></div>
                  <div className="work-item-copy"><strong title={task.title}>{task.title}</strong><span title={task.description || undefined}>{task.description || 'No description provided'}</span><small>{formatTimeAgo(task.created_at)}</small></div>
                </td>
                <td data-label="Owner" className="owner-cell"><span className="avatar">{getInitials(task.assignee)}</span><span>{task.assignee || 'Unassigned'}</span></td>
                <td data-label="Priority"><span className={`priority-badge ${priority.className}`}><span />{priority.label}</span></td>
                <td data-label="Status"><span className={`status-badge ${status.className}`}><span />{status.label}</span></td>
                <td data-label="Next action"><button className="status-action" type="button" onClick={() => onStatusChange(task)} disabled={isUpdating}><span>{isUpdating ? <span className="spinner" /> : <Icon name={task.status === 'RESOLVED' ? 'refresh' : task.status === 'OPEN' ? 'arrow' : 'check'} size={14} />}</span>{isUpdating ? 'Updating…' : status.action}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="table-footer"><span>Showing {tasks.length} {tasks.length === 1 ? 'work item' : 'work items'}</span><span>Updated just now</span></div>
    </div>
  );
}

function HealthCard({ tasks }) {
  const openCount = tasks.filter((task) => task.status !== 'RESOLVED').length;
  const highCount = tasks.filter((task) => task.priority === 'HIGH' && task.status !== 'RESOLVED').length;
  return (
    <article className="panel health-card">
      <div className="small-panel-heading"><div><p className="eyebrow">WORKSPACE HEALTH</p><h2>Attention needed</h2></div><span className="health-pulse" /></div>
      <div className="health-score"><strong>{openCount}</strong><span>active {openCount === 1 ? 'item' : 'items'}</span></div>
      <div className="health-bar"><span style={{ width: tasks.length ? `${Math.max(8, Math.round((openCount / tasks.length) * 100))}%` : '0%' }} /></div>
      <p className="health-caption">{highCount ? <><strong>{highCount} high priority</strong> {highCount === 1 ? 'item' : 'items'} need attention.</> : 'No high priority items need attention.'}</p>
    </article>
  );
}

function ActivityCard({ tasks }) {
  const recentTasks = tasks.slice(0, 3);
  return (
    <article className="panel activity-card">
      <div className="small-panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Latest updates</h2></div><Icon name="activity" size={17} /></div>
      {recentTasks.length ? <div className="activity-list">{recentTasks.map((task) => <div className="activity-item" key={task.id}><span className={`activity-dot ${STATUS_META[task.status]?.className || 'open'}`} /><div><strong>{task.status === 'RESOLVED' ? 'Resolved' : 'Added'} <span>{task.title}</span></strong><small>{formatTimeAgo(task.created_at)} · {task.assignee || 'Unassigned'}</small></div></div>)}</div> : <p className="activity-empty">Activity will appear here as your team works.</p>}
      <button className="text-button" type="button">View all activity <Icon name="arrow" size={14} /></button>
    </article>
  );
}

function CreateIncidentModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', assignee: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (formError) setFormError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      setFormError('Add a short title so your team knows what needs attention.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        assignee: form.assignee.trim() || 'Unassigned',
        status: 'OPEN',
      });
    } catch (createError) {
      setFormError(createError.message || 'Could not create this incident.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-incident-title">
        <div className="modal-header"><div><p className="eyebrow">NEW WORK ITEM</p><h2 id="create-incident-title">Create an incident</h2><p>Capture the context your team needs to take action.</p></div><button className="close-button" type="button" onClick={onClose} disabled={submitting} aria-label="Close dialog"><Icon name="close" size={18} /></button></div>
        <form onSubmit={submit}>
          <label className="form-field"><span>Title <em>Required</em></span><input name="title" value={form.title} onChange={updateField} placeholder="e.g. Checkout API returning 500s" autoFocus maxLength={200} /></label>
          <label className="form-field"><span>Description <em>Optional</em></span><textarea name="description" value={form.description} onChange={updateField} placeholder="Add impact, symptoms, or useful links…" rows="4" /></label>
          <div className="form-row"><label className="form-field"><span>Priority</span><span className="select-wrap"><select name="priority" value={form.priority} onChange={updateField}><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select><Icon name="chevron" size={15} /></span></label><label className="form-field"><span>Owner <em>Optional</em></span><input name="assignee" value={form.assignee} onChange={updateField} placeholder="e.g. Priya S." /></label></div>
          {formError && <p className="form-error" role="alert"><Icon name="alert" size={15} />{formError}</p>}
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={submitting}>Cancel</button><button className="primary-button" type="submit" disabled={submitting}>{submitting && <span className="spinner" />}{submitting ? 'Creating…' : 'Create incident'}</button></div>
        </form>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
