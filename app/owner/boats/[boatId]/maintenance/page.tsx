'use client';

import { useCallback, useEffect, useState, use } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';
import { MaintenanceList } from '@boat-management/components/maintenance';
import { MaintenanceForm } from '@boat-management/components/maintenance';
import { MaintenanceCompleteForm } from '@boat-management/components/maintenance';
import type { MaintenanceFormData, CompletionData } from '@boat-management/components/maintenance';
import type { BoatMaintenanceTask, BoatEquipment } from '@boat-management/lib/types';

export default function MaintenancePage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = use(params);
  const { user } = useAuth();
  const [tasks, setTasks] = useState<BoatMaintenanceTask[]>([]);
  const [equipment, setEquipment] = useState<BoatEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<BoatMaintenanceTask | null>(null);
  const [completingTask, setCompletingTask] = useState<BoatMaintenanceTask | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const loadData = useCallback(async () => {
    if (!boatId) return;
    try {
      const [taskRes, eqRes] = await Promise.all([
        fetch(`/api/boats/${boatId}/maintenance`),
        fetch(`/api/boats/${boatId}/equipment`),
      ]);
      const [taskJson, eqJson] = await Promise.all([taskRes.json(), eqRes.json()]);
      if (taskRes.ok) setTasks(taskJson.data ?? []);
      if (eqRes.ok) setEquipment(eqJson.data ?? []);
    } catch (err) {
      logger.error('Error loading maintenance data', { error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, [boatId]);

  useEffect(() => {
    if (!user?.id || !boatId) return;
    const supabase = getSupabaseBrowserClient();
    supabase
      .from('boats')
      .select('owner_id')
      .eq('id', boatId)
      .single()
      .then(({ data }) => {
        setIsOwner(data?.owner_id === user.id);
      });
  }, [user?.id, boatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = () => { setEditingTask(null); setIsFormOpen(true); };
  const handleEdit = (task: BoatMaintenanceTask) => { setEditingTask(task); setIsFormOpen(true); };
  const handleComplete = (task: BoatMaintenanceTask) => { setCompletingTask(task); setIsCompleteOpen(true); };

  const handleDelete = async (task: BoatMaintenanceTask) => {
    try {
      const res = await fetch(`/api/boats/${boatId}/maintenance/${task.id}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== task.id));
      }
    } catch (err) {
      logger.error('Error deleting task', { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleSubmit = async (data: MaintenanceFormData) => {
    const url = editingTask
      ? `/api/boats/${boatId}/maintenance/${editingTask.id}`
      : `/api/boats/${boatId}/maintenance`;
    const method = editingTask ? 'PUT' : 'POST';

    // Build recurrence object from form data
    let recurrence = null;
    if (data.recurrence_type && data.recurrence_interval) {
      recurrence = data.recurrence_type === 'time'
        ? { type: 'time' as const, interval_days: data.recurrence_interval }
        : { type: 'usage' as const, engine_hours: data.recurrence_interval };
    }

    const payload = {
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      equipment_id: data.equipment_id,
      due_date: data.due_date || null,
      estimated_hours: data.estimated_hours,
      estimated_cost: data.estimated_cost,
      instructions: data.instructions,
      notes: data.notes,
      is_template: data.is_template,
      recurrence,
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Failed to save task');
    }
    await loadData();
  };

  const handleCompleteSubmit = async (data: CompletionData) => {
    if (!completingTask) return;

    const res = await fetch(`/api/boats/${boatId}/maintenance/${completingTask.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || 'Failed to complete task');
    }
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading maintenance tasks...</div>
      </div>
    );
  }

  return (
    <>
      <MaintenanceList
        tasks={tasks}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onComplete={handleComplete}
        isOwner={isOwner}
      />
      <MaintenanceForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingTask(null); }}
        onSubmit={handleSubmit}
        task={editingTask}
        equipment={equipment}
      />
      {completingTask && (
        <MaintenanceCompleteForm
          isOpen={isCompleteOpen}
          onClose={() => { setIsCompleteOpen(false); setCompletingTask(null); }}
          onSubmit={handleCompleteSubmit}
          task={completingTask}
        />
      )}
    </>
  );
}
