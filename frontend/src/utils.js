export const STATUS_META = {
  OPEN: { label: 'Open', className: 'open', action: 'Start work', next: 'IN_PROGRESS' },
  IN_PROGRESS: { label: 'In progress', className: 'progress', action: 'Resolve', next: 'RESOLVED' },
  RESOLVED: { label: 'Resolved', className: 'resolved', action: 'Reopen', next: 'OPEN' },
};

export const PRIORITY_META = {
  HIGH: { label: 'High', className: 'high' },
  MEDIUM: { label: 'Medium', className: 'medium' },
  LOW: { label: 'Low', className: 'low' },
};

export function formatStatus(status) {
  return STATUS_META[status]?.label || status?.replace('_', ' ') || 'Unknown';
}

export function formatTimeAgo(value) {
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

export function getInitials(name) {
  const safeName = name?.trim() || 'Unassigned';
  if (safeName.toLowerCase() === 'unassigned') return '—';
  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function filterIncidents(tasks, { query = '', status = 'ALL', priority = 'ALL' } = {}) {
  const normalizedQuery = query.trim().toLowerCase();

  return tasks.filter((task) => {
    const matchesStatus = status === 'ALL' || task.status === status;
    const matchesPriority = priority === 'ALL' || task.priority === priority;
    const haystack = `${task.title} ${task.description || ''} ${task.assignee || ''}`.toLowerCase();
    return matchesStatus && matchesPriority && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
}
