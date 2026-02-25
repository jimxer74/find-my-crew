/**
 * Maintenance Service - CRUD operations for boat maintenance tasks
 */

import { logger } from '@shared/logging';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  BoatMaintenanceTask,
  BoatMaintenanceTaskInsert,
  BoatMaintenanceTaskUpdate,
  PartNeeded,
} from './types';
import { deductInventory } from './inventory-service';

/**
 * Fetch all maintenance tasks for a boat (non-templates)
 */
export async function getBoatMaintenanceTasks(
  boatId: string,
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask[]> {
  const { data, error } = await supabase
    .from('boat_maintenance_tasks')
    .select('*')
    .eq('boat_id', boatId)
    .eq('is_template', false)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch maintenance tasks', { boatId, error: error.message });
    throw error;
  }

  return (data ?? []) as BoatMaintenanceTask[];
}

/**
 * Get a single maintenance task by ID
 */
export async function getMaintenanceTaskById(
  taskId: string,
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask | null> {
  const { data, error } = await supabase
    .from('boat_maintenance_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to fetch maintenance task', { taskId, error: error.message });
    throw error;
  }

  return data as BoatMaintenanceTask;
}

/**
 * Get template tasks (reusable maintenance templates)
 */
export async function getMaintenanceTemplates(
  boatId: string,
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask[]> {
  const { data, error } = await supabase
    .from('boat_maintenance_tasks')
    .select('*')
    .eq('boat_id', boatId)
    .eq('is_template', true)
    .order('category')
    .order('title');

  if (error) {
    logger.error('Failed to fetch maintenance templates', { boatId, error: error.message });
    throw error;
  }

  return (data ?? []) as BoatMaintenanceTask[];
}

/**
 * Create a new maintenance task
 */
export async function createMaintenanceTask(
  task: BoatMaintenanceTaskInsert,
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask> {
  const { data, error } = await supabase
    .from('boat_maintenance_tasks')
    .insert({
      ...task,
      priority: task.priority ?? 'medium',
      status: task.status ?? 'pending',
      is_template: task.is_template ?? false,
      parts_needed: task.parts_needed ?? [],
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create maintenance task', { boatId: task.boat_id, error: error.message });
    throw error;
  }

  return data as BoatMaintenanceTask;
}

/**
 * Create a task from a template
 */
export async function createTaskFromTemplate(
  templateId: string,
  overrides: { due_date?: string; assigned_to?: string; notes?: string },
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask> {
  const template = await getMaintenanceTaskById(templateId, supabase);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return createMaintenanceTask(
    {
      boat_id: template.boat_id,
      equipment_id: template.equipment_id,
      title: template.title,
      description: template.description,
      category: template.category,
      priority: template.priority,
      instructions: template.instructions,
      parts_needed: template.parts_needed,
      recurrence: template.recurrence,
      template_id: templateId,
      due_date: overrides.due_date,
      assigned_to: overrides.assigned_to,
      notes: overrides.notes,
    },
    supabase
  );
}

/**
 * Update a maintenance task
 */
export async function updateMaintenanceTask(
  taskId: string,
  updates: BoatMaintenanceTaskUpdate,
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask> {
  const { data, error } = await supabase
    .from('boat_maintenance_tasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update maintenance task', { taskId, error: error.message });
    throw error;
  }

  return data as BoatMaintenanceTask;
}

/**
 * Complete a maintenance task with optional inventory deduction
 */
export async function completeMaintenanceTask(
  taskId: string,
  completionData: {
    completed_by: string;
    actual_hours?: number;
    actual_cost?: number;
    notes?: string;
    images_after?: string[];
  },
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask> {
  // Get the task to check for parts_needed
  const task = await getMaintenanceTaskById(taskId, supabase);
  if (!task) {
    throw new Error(`Maintenance task not found: ${taskId}`);
  }

  // Deduct inventory for required parts
  if (task.parts_needed && task.parts_needed.length > 0) {
    for (const part of task.parts_needed) {
      try {
        await deductInventory(part.inventory_id, part.quantity, supabase);
      } catch (err) {
        logger.warn('Failed to deduct inventory for part', {
          inventoryId: part.inventory_id,
          quantity: part.quantity,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue with completion even if inventory deduction fails
      }
    }
  }

  // Mark task as completed
  const updatedTask = await updateMaintenanceTask(
    taskId,
    {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: completionData.completed_by,
      actual_hours: completionData.actual_hours,
      actual_cost: completionData.actual_cost,
      notes: completionData.notes ?? task.notes,
      images_after: completionData.images_after ?? task.images_after,
    },
    supabase
  );

  // If task has recurrence, create the next occurrence
  if (task.recurrence && task.recurrence.type === 'time' && task.recurrence.interval_days) {
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + task.recurrence.interval_days);

    await createMaintenanceTask(
      {
        boat_id: task.boat_id,
        equipment_id: task.equipment_id,
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        instructions: task.instructions,
        parts_needed: task.parts_needed,
        recurrence: task.recurrence,
        template_id: task.template_id,
        due_date: nextDueDate.toISOString().split('T')[0],
      },
      supabase
    );
  }

  return updatedTask;
}

/**
 * Delete a maintenance task
 */
export async function deleteMaintenanceTask(
  taskId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('boat_maintenance_tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    logger.error('Failed to delete maintenance task', { taskId, error: error.message });
    throw error;
  }
}

/**
 * Get overdue tasks for a boat
 */
export async function getOverdueTasks(
  boatId: string,
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('boat_maintenance_tasks')
    .select('*')
    .eq('boat_id', boatId)
    .eq('is_template', false)
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', today)
    .order('due_date');

  if (error) {
    logger.error('Failed to fetch overdue tasks', { boatId, error: error.message });
    throw error;
  }

  return (data ?? []) as BoatMaintenanceTask[];
}

/**
 * Get upcoming tasks (next N days)
 */
export async function getUpcomingTasks(
  boatId: string,
  days: number,
  supabase: SupabaseClient
): Promise<BoatMaintenanceTask[]> {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('boat_maintenance_tasks')
    .select('*')
    .eq('boat_id', boatId)
    .eq('is_template', false)
    .in('status', ['pending', 'in_progress'])
    .gte('due_date', today)
    .lte('due_date', futureDateStr)
    .order('due_date');

  if (error) {
    logger.error('Failed to fetch upcoming tasks', { boatId, days, error: error.message });
    throw error;
  }

  return (data ?? []) as BoatMaintenanceTask[];
}
