'use client';

import { useState } from 'react';
import { Button, Input, Modal } from '@shared/ui';
import type { BoatMaintenanceTask } from '@boat-management/lib/types';

interface MaintenanceCompleteFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CompletionData) => Promise<void>;
  task: BoatMaintenanceTask;
}

export interface CompletionData {
  actual_hours: number | null;
  actual_cost: number | null;
  notes: string;
}

export function MaintenanceCompleteForm({ isOpen, onClose, onSubmit, task }: MaintenanceCompleteFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actualHours, setActualHours] = useState(task.estimated_hours?.toString() ?? '');
  const [actualCost, setActualCost] = useState(task.estimated_cost?.toString() ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        actual_hours: actualHours ? parseFloat(actualHours) : null,
        actual_cost: actualCost ? parseFloat(actualCost) : null,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete Task" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">{error}</div>
        )}

        <div className="p-3 bg-muted rounded-md">
          <p className="font-medium text-foreground">{task.title}</p>
          {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
        </div>

        {task.parts_needed && task.parts_needed.length > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-md text-sm">
            <p className="font-medium text-yellow-800 dark:text-yellow-400">
              This task will deduct {task.parts_needed.length} inventory item(s) when completed.
            </p>
          </div>
        )}

        {task.recurrence && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-md text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-400">
              A new recurring task will be automatically created after completion.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Actual Hours"
            type="number"
            value={actualHours}
            onChange={(e) => setActualHours(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Actual Cost"
            type="number"
            value={actualCost}
            onChange={(e) => setActualCost(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Completion Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Work performed, observations, issues found..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" isLoading={saving}>Mark Complete</Button>
        </div>
      </form>
    </Modal>
  );
}
