'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Select, Modal } from '@shared/ui';
import type {
  BoatMaintenanceTask,
  BoatEquipment,
  MaintenanceCategory,
  MaintenancePriority,
} from '@boat-management/lib/types';

interface MaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MaintenanceFormData) => Promise<void>;
  task?: BoatMaintenanceTask | null;
  equipment?: BoatEquipment[];
}

export interface MaintenanceFormData {
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  equipment_id: string | null;
  due_date: string;
  estimated_hours: number | null;
  estimated_cost: number | null;
  instructions: string;
  notes: string;
  is_template: boolean;
  recurrence_type: string;
  recurrence_interval: number | null;
}

const CATEGORY_OPTIONS = [
  { value: 'routine', label: 'Routine' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'safety', label: 'Safety' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const RECURRENCE_OPTIONS = [
  { value: '', label: 'No recurrence' },
  { value: 'time_30', label: 'Every 30 days' },
  { value: 'time_90', label: 'Every 90 days' },
  { value: 'time_180', label: 'Every 6 months' },
  { value: 'time_365', label: 'Every year' },
  { value: 'usage_100', label: 'Every 100 engine hours' },
  { value: 'usage_250', label: 'Every 250 engine hours' },
  { value: 'usage_500', label: 'Every 500 engine hours' },
  { value: 'custom', label: 'Custom interval...' },
];

export function MaintenanceForm({ isOpen, onClose, onSubmit, task, equipment = [] }: MaintenanceFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MaintenanceCategory>('routine');
  const [priority, setPriority] = useState<MaintenancePriority>('medium');
  const [equipmentId, setEquipmentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [recurrenceKey, setRecurrenceKey] = useState('');
  const [customDays, setCustomDays] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description ?? '');
        setCategory(task.category);
        setPriority(task.priority);
        setEquipmentId(task.equipment_id ?? '');
        setDueDate(task.due_date ?? '');
        setEstimatedHours(task.estimated_hours?.toString() ?? '');
        setEstimatedCost(task.estimated_cost?.toString() ?? '');
        setInstructions(task.instructions ?? '');
        setNotes(task.notes ?? '');
        setIsTemplate(task.is_template);
        // Map recurrence to key
        if (task.recurrence) {
          const r = task.recurrence;
          if (r.type === 'time' && r.interval_days) {
            const match = RECURRENCE_OPTIONS.find(
              o => o.value === `time_${r.interval_days}`
            );
            if (match) {
              setRecurrenceKey(match.value);
            } else {
              setRecurrenceKey('custom');
              setCustomDays(r.interval_days.toString());
            }
          } else if (r.type === 'usage' && r.engine_hours) {
            const match = RECURRENCE_OPTIONS.find(
              o => o.value === `usage_${r.engine_hours}`
            );
            setRecurrenceKey(match?.value ?? '');
          }
        } else {
          setRecurrenceKey('');
          setCustomDays('');
        }
      } else {
        setTitle(''); setDescription(''); setCategory('routine'); setPriority('medium');
        setEquipmentId(''); setDueDate(''); setEstimatedHours(''); setEstimatedCost('');
        setInstructions(''); setNotes(''); setIsTemplate(false);
        setRecurrenceKey(''); setCustomDays('');
      }
      setError('');
    }
  }, [isOpen, task]);

  const equipmentOptions = [
    { value: '', label: 'None (general task)' },
    ...equipment.map(e => ({ value: e.id, label: `${e.name} (${e.category})` })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category) {
      setError('Title and category are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let recurrenceType = '';
      let recurrenceInterval: number | null = null;

      if (recurrenceKey === 'custom') {
        recurrenceType = 'time';
        recurrenceInterval = parseInt(customDays, 10) || null;
      } else if (recurrenceKey.startsWith('time_')) {
        recurrenceType = 'time';
        recurrenceInterval = parseInt(recurrenceKey.split('_')[1], 10);
      } else if (recurrenceKey.startsWith('usage_')) {
        recurrenceType = 'usage';
        recurrenceInterval = parseInt(recurrenceKey.split('_')[1], 10);
      }

      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        equipment_id: equipmentId || null,
        due_date: dueDate,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
        instructions: instructions.trim(),
        notes: notes.trim(),
        is_template: isTemplate,
        recurrence_type: recurrenceType,
        recurrence_interval: recurrenceInterval,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Edit Task' : 'New Maintenance Task'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">{error}</div>
        )}

        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Engine oil change" required />

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Brief description of the task"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as MaintenanceCategory)} options={CATEGORY_OPTIONS} required />
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)} options={PRIORITY_OPTIONS} />
          <Select label="Equipment" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)} options={equipmentOptions} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input label="Estimated Hours" type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="0" />
          <Input label="Estimated Cost" type="number" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} placeholder="0.00" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Recurrence" value={recurrenceKey} onChange={(e) => setRecurrenceKey(e.target.value)} options={RECURRENCE_OPTIONS} />
          {recurrenceKey === 'custom' && (
            <Input label="Interval (days)" type="number" value={customDays} onChange={(e) => setCustomDays(e.target.value)} placeholder="e.g., 60" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Step-by-Step Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="w-full rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="1. Warm up engine for 5 minutes&#10;2. Turn off engine and locate drain plug&#10;3. ..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} className="rounded border-border" />
          <span className="text-muted-foreground">Save as reusable template</span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" isLoading={saving}>{task ? 'Update' : 'Create Task'}</Button>
        </div>
      </form>
    </Modal>
  );
}
