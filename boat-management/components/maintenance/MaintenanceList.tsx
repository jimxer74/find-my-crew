'use client';

import { useState, useMemo } from 'react';
import { Button, Badge, Card, Select } from '@shared/ui';
import type { BoatMaintenanceTask, MaintenanceStatus } from '@boat-management/lib/types';

interface MaintenanceListProps {
  tasks: BoatMaintenanceTask[];
  onAdd: () => void;
  onEdit: (task: BoatMaintenanceTask) => void;
  onDelete: (task: BoatMaintenanceTask) => void;
  onComplete: (task: BoatMaintenanceTask) => void;
  isOwner: boolean;
}

const statusConfig: Record<MaintenanceStatus, { variant: 'info' | 'warning' | 'success' | 'error' | 'secondary'; label: string }> = {
  pending: { variant: 'info', label: 'Pending' },
  in_progress: { variant: 'warning', label: 'In Progress' },
  completed: { variant: 'success', label: 'Completed' },
  overdue: { variant: 'error', label: 'Overdue' },
  skipped: { variant: 'secondary', label: 'Skipped' },
};

const priorityConfig: Record<string, { variant: 'secondary' | 'info' | 'warning' | 'error' }> = {
  low: { variant: 'secondary' },
  medium: { variant: 'info' },
  high: { variant: 'warning' },
  critical: { variant: 'error' },
};

const categoryLabels: Record<string, string> = {
  routine: 'Routine',
  seasonal: 'Seasonal',
  repair: 'Repair',
  inspection: 'Inspection',
  safety: 'Safety',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'routine', label: 'Routine' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'safety', label: 'Safety' },
];

export function MaintenanceList({ tasks, onAdd, onEdit, onDelete, onComplete, isOwner }: MaintenanceListProps) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Mark overdue tasks
  const tasksWithOverdue = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.map(t => {
      if (t.due_date && t.due_date < today && (t.status === 'pending' || t.status === 'in_progress')) {
        return { ...t, status: 'overdue' as MaintenanceStatus };
      }
      return t;
    });
  }, [tasks]);

  const filtered = useMemo(() => {
    let items = tasksWithOverdue;
    if (filterStatus) {
      items = items.filter(t => t.status === filterStatus);
    }
    if (filterCategory) {
      items = items.filter(t => t.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [tasksWithOverdue, filterStatus, filterCategory, searchQuery]);

  const overdueCount = tasksWithOverdue.filter(t => t.status === 'overdue').length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1 w-full sm:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full sm:w-64 rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} options={STATUS_OPTIONS} className="w-full sm:w-auto" />
          <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} options={CATEGORY_OPTIONS} className="w-full sm:w-auto" />
        </div>
        {isOwner && (
          <Button variant="primary" onClick={onAdd} size="sm">+ New Task</Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}
        </p>
        {overdueCount > 0 && (
          <Badge variant="error" size="sm">{overdueCount} overdue</Badge>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {tasks.length === 0
              ? 'No maintenance tasks scheduled. Create your first task to stay on top of boat care.'
              : 'No tasks match your filter.'}
          </p>
          {isOwner && tasks.length === 0 && (
            <Button variant="primary" onClick={onAdd}>Create First Task</Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <MaintenanceCard
              key={task.id}
              task={task}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task)}
              onComplete={() => onComplete(task)}
              isOwner={isOwner}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaintenanceCard({
  task,
  onEdit,
  onDelete,
  onComplete,
  isOwner,
}: {
  task: BoatMaintenanceTask;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  isOwner: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = statusConfig[task.status] ?? statusConfig.pending;
  const priorityCfg = priorityConfig[task.priority] ?? priorityConfig.medium;
  const canComplete = task.status === 'pending' || task.status === 'in_progress' || task.status === 'overdue';

  return (
    <Card padding="sm" className="flex flex-col sm:flex-row sm:items-center gap-3">
      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h4 className="font-medium text-card-foreground truncate">{task.title}</h4>
          <Badge variant={status.variant} size="sm">{status.label}</Badge>
          <Badge variant={priorityCfg.variant} size="sm" outlined>{task.priority}</Badge>
          <Badge variant="secondary" size="sm">{categoryLabels[task.category] ?? task.category}</Badge>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
          {task.due_date && (
            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
          )}
          {task.estimated_hours != null && <span>Est: {task.estimated_hours}h</span>}
          {task.estimated_cost != null && <span>~{task.estimated_cost} EUR</span>}
          {task.recurrence && (
            <span className="text-blue-600 dark:text-blue-400">
              Recurring ({task.recurrence.type === 'time'
                ? `${task.recurrence.interval_days}d`
                : `${task.recurrence.engine_hours}h`})
            </span>
          )}
        </div>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
        )}
      </div>

      {/* Actions */}
      {isOwner && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {canComplete && (
            <Button variant="primary" size="sm" onClick={onComplete}>
              Complete
            </Button>
          )}
          <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1">
            Edit
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1">
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground px-1">Cancel</button>
              <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="text-xs text-destructive font-medium px-1">Confirm</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
