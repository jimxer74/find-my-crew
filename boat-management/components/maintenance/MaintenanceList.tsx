'use client';

import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
import { Button, Card } from '@shared/ui';
import type { BoatMaintenanceTask, BoatEquipment, MaintenanceDisplayStatus } from '@boat-management/lib/types';
import { getDisplayStatus } from '@boat-management/lib/types';

interface MaintenanceListProps {
  tasks: BoatMaintenanceTask[];
  equipment: BoatEquipment[];
  onAdd: () => void;
  onEdit: (task: BoatMaintenanceTask) => void;
  onDelete: (task: BoatMaintenanceTask) => void;
  onComplete: (task: BoatMaintenanceTask) => void;
  onStart: (task: BoatMaintenanceTask) => void;
  isOwner: boolean;
}

const KANBAN_COLUMNS: { key: MaintenanceDisplayStatus; label: string; headerClass: string; countClass: string }[] = [
  { key: 'todo', label: 'Todo', headerClass: 'text-gray-600 dark:text-gray-400', countClass: 'bg-gray-200 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300' },
  { key: 'planned', label: 'Planned', headerClass: 'text-blue-600 dark:text-blue-400', countClass: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200' },
  { key: 'in_progress', label: 'In Progress', headerClass: 'text-amber-600 dark:text-amber-400', countClass: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' },
  { key: 'done', label: 'Done', headerClass: 'text-green-600 dark:text-green-400', countClass: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200' },
];

const priorityBorderClass: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-400',
  low: 'border-l-slate-300 dark:border-l-slate-600',
};

const priorityDotClass: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-400',
  low: 'bg-slate-300 dark:bg-slate-600',
};

const displayStatusBadgeClass: Record<MaintenanceDisplayStatus, string> = {
  todo: 'bg-gray-200 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
  planned: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200 dark:border dark:border-blue-400/30',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200 dark:border dark:border-amber-400/30',
  done: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200 dark:border dark:border-green-400/30',
};

const displayStatusLabel: Record<MaintenanceDisplayStatus, string> = {
  todo: 'Todo',
  planned: 'Planned',
  in_progress: 'In Progress',
  done: 'Done',
};

// Sort tasks: overdue planned first (past due_date), then by due_date, then by priority weight
const priorityWeight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function sortTasks(tasks: BoatMaintenanceTask[]): BoatMaintenanceTask[] {
  const today = new Date().toISOString().split('T')[0];
  return [...tasks].sort((a, b) => {
    // Overdue planned tasks first
    const aOverdue = a.due_date && a.due_date < today && (a.status === 'pending');
    const bOverdue = b.due_date && b.due_date < today && (b.status === 'pending');
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    // Then by due_date (nulls last)
    if (a.due_date && b.due_date) {
      const dateDiff = a.due_date.localeCompare(b.due_date);
      if (dateDiff !== 0) return dateDiff;
    } else if (a.due_date) return -1;
    else if (b.due_date) return 1;
    // Then by priority
    return (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2);
  });
}

export function MaintenanceList({ tasks, equipment, onAdd, onEdit, onDelete, onComplete, onStart, isOwner }: MaintenanceListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileStatusFilter, setMobileStatusFilter] = useState<MaintenanceDisplayStatus | 'all'>('all');
  const [collapsedColumns, setCollapsedColumns] = useState<Set<MaintenanceDisplayStatus>>(new Set(['done']));

  // Build equipment name map
  const equipmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const eq of equipment) {
      map.set(eq.id, eq.name);
    }
    return map;
  }, [equipment]);

  const filteredTasks = useMemo(() => {
    let items = tasks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    return sortTasks(items);
  }, [tasks, searchQuery]);

  // Group tasks by display status
  const tasksByStatus = useMemo(() => {
    const map = new Map<MaintenanceDisplayStatus, BoatMaintenanceTask[]>();
    for (const col of KANBAN_COLUMNS) {
      map.set(col.key, []);
    }
    for (const task of filteredTasks) {
      const ds = getDisplayStatus(task);
      map.get(ds)!.push(task);
    }
    return map;
  }, [filteredTasks]);

  // Mobile filtered tasks
  const mobileTasks = useMemo(() => {
    if (mobileStatusFilter === 'all') return filteredTasks;
    return filteredTasks.filter(t => getDisplayStatus(t) === mobileStatusFilter);
  }, [filteredTasks, mobileStatusFilter]);

  // Group tasks by equipment for display (used in both Kanban and mobile)
  function groupByEquipment(taskList: BoatMaintenanceTask[]): Map<string, { label: string; tasks: BoatMaintenanceTask[] }> {
    const map = new Map<string, { label: string; tasks: BoatMaintenanceTask[] }>();
    for (const task of taskList) {
      const key = task.equipment_id ?? '__general__';
      const label = task.equipment_id ? (equipmentMap.get(task.equipment_id) ?? 'Unknown Equipment') : 'General';
      if (!map.has(key)) map.set(key, { label, tasks: [] });
      map.get(key)!.tasks.push(task);
    }
    return map;
  }

  const toggleColumn = (col: MaintenanceDisplayStatus) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const totalCount = filteredTasks.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tasks..."
          className="w-full sm:w-64 rounded border border-border bg-input-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {isOwner && (
          <Button variant="primary" onClick={onAdd} size="sm">+ New Task</Button>
        )}
      </div>

      {/* Mobile: clickable status filter badges */}
      <div className="flex md:hidden gap-2 flex-wrap">
        <button
          onClick={() => setMobileStatusFilter('all')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${mobileStatusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          All ({totalCount})
        </button>
        {KANBAN_COLUMNS.map(col => {
          const count = tasksByStatus.get(col.key)?.length ?? 0;
          if (count === 0) return null;
          const isActive = mobileStatusFilter === col.key;
          return (
            <button
              key={col.key}
              onClick={() => setMobileStatusFilter(isActive ? 'all' : col.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors backdrop-blur-sm ${isActive ? 'ring-2 ring-primary/50 ' : ''} ${displayStatusBadgeClass[col.key]}`}
            >
              {col.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Desktop: task count */}
      <p className="hidden md:block text-sm text-muted-foreground">{totalCount} {totalCount === 1 ? 'task' : 'tasks'}</p>

      {/* Empty state */}
      {totalCount === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {tasks.length === 0
              ? 'No maintenance tasks scheduled. Create your first task to stay on top of boat care.'
              : 'No tasks match your search.'}
          </p>
          {isOwner && tasks.length === 0 && (
            <Button variant="primary" onClick={onAdd}>Create First Task</Button>
          )}
        </Card>
      )}

      {totalCount > 0 && (
        <>
          {/* ===== DESKTOP: 4-column Kanban ===== */}
          <div className="hidden md:flex gap-4 items-start">
            {KANBAN_COLUMNS.map(col => {
              const colTasks = tasksByStatus.get(col.key) ?? [];
              const isCollapsed = collapsedColumns.has(col.key);
              const grouped = groupByEquipment(colTasks);

              if (isCollapsed) {
                return (
                  <div key={col.key} className="flex-shrink-0 w-9">
                    <button
                      onClick={() => toggleColumn(col.key)}
                      title={`Expand ${col.label}`}
                      className="flex flex-col items-center gap-2.5 w-full py-3 rounded-lg border border-dashed border-border hover:bg-muted/50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-muted-foreground -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className={`text-xs font-semibold ${col.headerClass}`} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        {col.label}
                      </span>
                      <span className={`text-xs font-medium px-1 py-0.5 rounded-full ${col.countClass}`}>{colTasks.length}</span>
                    </button>
                  </div>
                );
              }

              return (
                <div key={col.key} className="flex-1 min-w-0 flex flex-col gap-2">
                  {/* Column header */}
                  <button
                    onClick={() => toggleColumn(col.key)}
                    className="flex items-center justify-between gap-2 px-1 py-1 rounded hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${col.headerClass}`}>{col.label}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${col.countClass}`}>{colTasks.length}</span>
                    </div>
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Column tasks */}
                  <div className="space-y-2">
                    {colTasks.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                        No tasks
                      </div>
                    ) : (
                      Array.from(grouped.entries()).map(([groupKey, { label: groupLabel, tasks: groupTasks }]) => (
                        <EquipmentGroup key={groupKey} label={groupLabel} count={groupTasks.length}>
                          <div className="space-y-2">
                            {groupTasks.map(task => (
                              <MaintenanceCard
                                key={task.id}
                                task={task}
                                onEdit={() => onEdit(task)}
                                onDelete={() => onDelete(task)}
                                onComplete={() => onComplete(task)}
                                onStart={() => onStart(task)}
                                isOwner={isOwner}
                                compact
                              />
                            ))}
                          </div>
                        </EquipmentGroup>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===== MOBILE: equipment-grouped carousels ===== */}
          <div className="md:hidden space-y-3">
            {(() => {
              const grouped = groupByEquipment(mobileTasks);
              if (grouped.size === 0) return (
                <p className="text-sm text-muted-foreground text-center py-4">No tasks match the selected filter.</p>
              );
              return Array.from(grouped.entries()).map(([groupKey, { label: groupLabel, tasks: groupTasks }]) => (
                <EquipmentGroup key={groupKey} label={groupLabel} count={groupTasks.length}>
                  <MobileEquipmentCarousel
                    tasks={groupTasks}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onComplete={onComplete}
                    onStart={onStart}
                    isOwner={isOwner}
                  />
                </EquipmentGroup>
              ));
            })()}
          </div>
        </>
      )}
    </div>
  );
}

// --- Collapsible Equipment Group (shared by Kanban and mobile) ---

function EquipmentGroup({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center gap-1.5 w-full px-1 py-0.5 mb-1 rounded hover:bg-muted/40 transition-colors group"
      >
        <svg
          className={`w-3 h-3 text-muted-foreground transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0">({count})</span>
      </button>
      {!collapsed && children}
    </div>
  );
}

// --- Mobile carousel (just the scroll area, group header handled by EquipmentGroup) ---

function MobileEquipmentCarousel({
  tasks, onEdit, onDelete, onComplete, onStart, isOwner
}: {
  tasks: BoatMaintenanceTask[];
  onEdit: (t: BoatMaintenanceTask) => void;
  onDelete: (t: BoatMaintenanceTask) => void;
  onComplete: (t: BoatMaintenanceTask) => void;
  onStart: (t: BoatMaintenanceTask) => void;
  isOwner: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    check();
    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [tasks]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
      >
        {tasks.map(task => (
          <div key={task.id} className="flex-shrink-0 w-[calc(50%-6px)] snap-start">
            <MaintenanceCard
              task={task}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task)}
              onComplete={() => onComplete(task)}
              onStart={() => onStart(task)}
              isOwner={isOwner}
              compact
              mobileStatusBadge
            />
          </div>
        ))}
      </div>
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      )}
    </div>
  );
}

// --- Maintenance Card ---

function MaintenanceCard({
  task,
  onEdit,
  onDelete,
  onComplete,
  onStart,
  isOwner,
  compact = false,
  mobileStatusBadge = false,
}: {
  task: BoatMaintenanceTask;
  onEdit: () => void;
  onDelete: () => void;
  onComplete: () => void;
  onStart: () => void;
  isOwner: boolean;
  compact?: boolean;
  mobileStatusBadge?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const displayStatus = getDisplayStatus(task);
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due_date && task.due_date < today && task.status === 'pending';

  return (
    <div className={`bg-card border border-border rounded-lg border-l-4 ${priorityBorderClass[task.priority] ?? priorityBorderClass.medium} flex flex-col overflow-hidden`}>
      <div className="p-2.5 flex-1">
        {/* Title row */}
        <div className="flex items-start gap-1.5 mb-1">
          <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityDotClass[task.priority] ?? priorityDotClass.medium}`} />
          <h4 className="text-sm font-medium text-card-foreground leading-tight line-clamp-2">{task.title}</h4>
        </div>

        {/* Meta: due date + recurrence */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1 ml-3">
          {task.due_date && (
            <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
              {isOverdue ? '⚠ ' : ''}Due {new Date(task.due_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.estimated_hours != null && <span>{task.estimated_hours}h</span>}
          {task.recurrence && (
            <span className="text-blue-500 dark:text-blue-400">
              ↻ {task.recurrence.type === 'time' ? `${task.recurrence.interval_days}d` : `${task.recurrence.engine_hours}h`}
            </span>
          )}
        </div>

        {/* Mobile: clickable status badge */}
        {mobileStatusBadge && (
          <div className="mt-1.5 ml-3">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${displayStatusBadgeClass[displayStatus]}`}>
              {displayStatusLabel[displayStatus]}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {isOwner && (
        <div className="border-t border-border px-2.5 py-1.5 flex items-center gap-2 flex-wrap">
          {/* Primary action based on status */}
          {(displayStatus === 'todo' || displayStatus === 'planned') && (
            <button onClick={onStart} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start
            </button>
          )}
          {displayStatus === 'in_progress' && (
            <button onClick={onComplete} className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Complete
            </button>
          )}

          {/* Edit */}
          <button onClick={onEdit} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>

          {/* Delete */}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground px-1">Cancel</button>
              <button onClick={() => { onDelete(); setConfirmDelete(false); }} className="text-xs text-destructive font-medium px-1">Confirm</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
