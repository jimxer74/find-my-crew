'use client';

import { useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { submitJob } from '@shared/lib/async-jobs/submitJob';
import { JobProgressPanel } from '@shared/components/async-jobs';
import { EQUIPMENT_CATEGORIES } from '../../../boat-management/lib/types';
import { Button } from '@shared/ui/Button/Button';
import { logger } from '@shared/logging';

// ---------------------------------------------------------------------------
// Types for AI-generated results
// ---------------------------------------------------------------------------

interface GeneratedEquipmentItem {
  index: number;
  name: string;
  category: string;
  subcategory: string | null;
  parentIndex: number | null;
  manufacturer: string | null;
  model: string | null;
  notes: string | null;
  productRegistryId?: string | null;
}

interface GeneratedTaskItem {
  equipmentIndex: number | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  recurrence: { type: string; interval_days?: number; engine_hours?: number };
  estimated_hours: number | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NewBoatWizardStep3Props {
  boatId: string;
  makeModel: string;
  boatType: string | null;
  loa_m: number | null;
  onComplete: () => void;
  onSkip: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Phase = 'select' | 'generating' | 'review' | 'saving';

const ALL_CATEGORIES = EQUIPMENT_CATEGORIES.map((c) => c.value);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewBoatWizardStep3({
  boatId,
  makeModel,
  boatType,
  loa_m,
  onComplete,
  onSkip,
}: NewBoatWizardStep3Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Category selection — all checked by default
  const [selectedCategories, setSelectedCategories] = useState<string[]>([...ALL_CATEGORIES]);
  const [maintenanceCategories, setMaintenanceCategories] = useState<string[]>([...ALL_CATEGORIES]);

  // Generated results (mutable — user can delete items)
  const [equipment, setEquipment] = useState<GeneratedEquipmentItem[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<GeneratedTaskItem[]>([]);
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Category toggle helpers
  // -------------------------------------------------------------------------

  const toggleCategory = (cat: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(cat) ? list.filter((c) => c !== cat) : [...list, cat]);
  };

  const toggleAll = (list: string[], setList: (v: string[]) => void) => {
    setList(list.length === ALL_CATEGORIES.length ? [] : [...ALL_CATEGORIES]);
  };

  // -------------------------------------------------------------------------
  // Generate — submit async job
  // -------------------------------------------------------------------------

  const handleGenerate = async () => {
    if (selectedCategories.length === 0) return;
    setJobError(null);
    setPhase('generating');
    try {
      const { jobId: id } = await submitJob({
        job_type: 'generate-boat-equipment',
        payload: {
          boatId,
          makeModel,
          boatType,
          loa_m,
          selectedCategories,
          maintenanceCategories,
        },
      });
      setJobId(id);
    } catch (err) {
      setJobError(err instanceof Error ? err.message : 'Failed to start generation');
      setPhase('select');
    }
  };

  const handleJobComplete = useCallback((result: Record<string, unknown>) => {
    const eq = (result.equipment as GeneratedEquipmentItem[]) ?? [];
    const mt = (result.maintenanceTasks as GeneratedTaskItem[]) ?? [];
    setEquipment(eq);
    setMaintenanceTasks(mt);
    setPhase('review');
  }, []);

  const handleJobError = useCallback((error: string) => {
    setJobError(error);
    setPhase('select');
  }, []);

  // -------------------------------------------------------------------------
  // Delete helpers
  // -------------------------------------------------------------------------

  const deleteEquipment = (index: number) => {
    // Remove the item and all its children
    const toRemove = new Set<number>();
    toRemove.add(index);
    // Find all descendants
    let changed = true;
    while (changed) {
      changed = false;
      equipment.forEach((item) => {
        if (item.parentIndex !== null && toRemove.has(item.parentIndex) && !toRemove.has(item.index)) {
          toRemove.add(item.index);
          changed = true;
        }
      });
    }
    setEquipment((prev) => prev.filter((item) => !toRemove.has(item.index)));
    setMaintenanceTasks((prev) =>
      prev.filter((task) => task.equipmentIndex === null || !toRemove.has(task.equipmentIndex))
    );
  };

  const deleteTask = (taskIdx: number) => {
    setMaintenanceTasks((prev) => prev.filter((_, i) => i !== taskIdx));
  };

  // -------------------------------------------------------------------------
  // Save to DB
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const supabase = getSupabaseBrowserClient();

      // Build index → inserted DB id map
      const indexToId: Record<number, string> = {};

      // Step 1: Insert parent items (parentIndex === null)
      // productRegistryId is already populated by the edge function — use it directly.
      const parents = equipment.filter((e) => e.parentIndex === null);
      if (parents.length > 0) {
        const { data: insertedParents, error: parentErr } = await supabase
          .from('boat_equipment')
          .insert(
            parents.map((e) => ({
              boat_id: boatId,
              name: e.name,
              category: e.category,
              subcategory: e.subcategory,
              manufacturer: e.manufacturer,
              model: e.model,
              notes: e.notes,
              status: 'active',
              product_registry_id: e.productRegistryId ?? null,
            }))
          )
          .select('id');

        if (parentErr) throw new Error(`Failed to save equipment: ${parentErr.message}`);
        parents.forEach((e, i) => {
          if (insertedParents?.[i]) indexToId[e.index] = insertedParents[i].id;
        });
      }

      // Step 2: Insert child items (parentIndex !== null)
      const children = equipment.filter((e) => e.parentIndex !== null);
      if (children.length > 0) {
        const { data: insertedChildren, error: childErr } = await supabase
          .from('boat_equipment')
          .insert(
            children.map((e) => ({
              boat_id: boatId,
              parent_id: e.parentIndex !== null ? (indexToId[e.parentIndex] ?? null) : null,
              name: e.name,
              category: e.category,
              subcategory: e.subcategory,
              manufacturer: e.manufacturer,
              model: e.model,
              notes: e.notes,
              status: 'active',
              product_registry_id: e.productRegistryId ?? null,
            }))
          )
          .select('id');

        if (childErr) throw new Error(`Failed to save child equipment: ${childErr.message}`);
        children.forEach((e, i) => {
          if (insertedChildren?.[i]) indexToId[e.index] = insertedChildren[i].id;
        });
      }

      // Step 3: Insert maintenance tasks — is_template: false so they appear in the Maintenance section
      const tasksToInsert = maintenanceTasks
        .filter((t) => t.equipmentIndex === null || indexToId[t.equipmentIndex])
        .map((t) => ({
          boat_id: boatId,
          equipment_id: t.equipmentIndex !== null ? (indexToId[t.equipmentIndex] ?? null) : null,
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          status: 'pending',
          is_template: false,
          recurrence: t.recurrence,
          estimated_hours: t.estimated_hours,
        }));

      if (tasksToInsert.length > 0) {
        const { error: taskErr } = await supabase.from('boat_maintenance_tasks').insert(tasksToInsert);
        if (taskErr) throw new Error(`Failed to save maintenance tasks: ${taskErr.message}`);
      }

      onComplete();
    } catch (err) {
      logger.error('[Step3] Save failed:', err instanceof Error ? { error: err.message } : { error: String(err) });
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Grouped review data
  // -------------------------------------------------------------------------

  const equipmentByCategory = equipment.reduce<Record<string, GeneratedEquipmentItem[]>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {}
  );

  const tasksByEquipmentIndex = maintenanceTasks.reduce<Record<string, GeneratedTaskItem[]>>(
    (acc, task, i) => {
      const key = task.equipmentIndex !== null ? String(task.equipmentIndex) : '_unlinked';
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    },
    {}
  );

  const getCategoryLabel = (value: string) =>
    EQUIPMENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  // -------------------------------------------------------------------------
  // Render: Selection phase
  // -------------------------------------------------------------------------

  if (phase === 'select') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Equipment & Maintenance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI will generate a standard equipment list and maintenance schedule for{' '}
            <span className="font-medium text-foreground">{makeModel || 'your boat'}</span>. Select
            which categories to include. You can review and remove items before saving.
          </p>
        </div>

        {jobError && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {jobError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Equipment categories */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Generate Equipment For</h3>
              <button
                onClick={() => toggleAll(selectedCategories, setSelectedCategories)}
                className="text-xs text-primary hover:underline"
              >
                {selectedCategories.length === ALL_CATEGORIES.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2">
              {EQUIPMENT_CATEGORIES.map((cat) => (
                <label key={cat.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={selectedCategories.includes(cat.value)}
                    onChange={() => toggleCategory(cat.value, selectedCategories, setSelectedCategories)}
                  />
                  <span className="text-sm text-foreground">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Maintenance categories */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Generate Maintenance Tasks For</h3>
              <button
                onClick={() => toggleAll(maintenanceCategories, setMaintenanceCategories)}
                className="text-xs text-primary hover:underline"
              >
                {maintenanceCategories.length === ALL_CATEGORIES.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2">
              {EQUIPMENT_CATEGORIES.map((cat) => (
                <label key={cat.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={maintenanceCategories.includes(cat.value)}
                    onChange={() =>
                      toggleCategory(cat.value, maintenanceCategories, setMaintenanceCategories)
                    }
                  />
                  <span className="text-sm text-foreground">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={selectedCategories.length === 0}
          >
            Generate Equipment & Tasks
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Generating phase
  // -------------------------------------------------------------------------

  if (phase === 'generating') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Generating Equipment List</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI is generating a standard equipment list for{' '}
            <span className="font-medium text-foreground">{makeModel || 'your boat'}</span>. This
            typically takes 30–90 seconds.
          </p>
        </div>

        {jobId && (
          <JobProgressPanel
            jobId={jobId}
            onComplete={handleJobComplete}
            onError={handleJobError}
          />
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Review phase
  // -------------------------------------------------------------------------

  if (phase === 'review') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Review Equipment & Maintenance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the generated equipment and maintenance tasks. Remove any items you don&apos;t
            need, then save to your boat.
          </p>
        </div>

        {saveError && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {saveError}
          </div>
        )}

        {/* Equipment list */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
            Equipment ({equipment.length} items)
          </h3>
          {equipment.length === 0 ? (
            <p className="text-sm text-muted-foreground">No equipment items remaining.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(equipmentByCategory).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {getCategoryLabel(category)}
                  </h4>
                  <div className="space-y-1">
                    {items.map((item) => {
                      const isChild = item.parentIndex !== null;
                      return (
                        <div
                          key={item.index}
                          className={`flex items-start justify-between gap-2 rounded-md px-3 py-2 bg-muted/40 ${
                            isChild ? 'ml-6' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {isChild && (
                                <span className="text-muted-foreground text-xs flex-shrink-0">↳</span>
                              )}
                              <span className="text-sm font-medium text-foreground">{item.name}</span>
                              {item.manufacturer && (
                                <span className="text-xs text-muted-foreground">
                                  {item.manufacturer}
                                  {item.model ? ` ${item.model}` : ''}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5 ml-4">{item.notes}</p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteEquipment(item.index)}
                            className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Maintenance tasks list */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
            Maintenance Tasks ({maintenanceTasks.length} tasks)
          </h3>
          {maintenanceTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance tasks remaining.</p>
          ) : (
            <div className="space-y-2">
              {maintenanceTasks.map((task, i) => {
                const linkedEquipment =
                  task.equipmentIndex !== null
                    ? equipment.find((e) => e.index === task.equipmentIndex)
                    : null;
                const recurrenceLabel =
                  task.recurrence.type === 'time'
                    ? task.recurrence.interval_days
                      ? `Every ${task.recurrence.interval_days} days`
                      : 'Recurring'
                    : task.recurrence.engine_hours
                    ? `Every ${task.recurrence.engine_hours} engine hours`
                    : 'Usage-based';

                return (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 rounded-md px-3 py-2 bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{task.title}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            task.priority === 'critical'
                              ? 'bg-destructive/20 text-destructive'
                              : task.priority === 'high'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span className="text-xs text-muted-foreground">{recurrenceLabel}</span>
                      </div>
                      {linkedEquipment && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {linkedEquipment.name}
                        </p>
                      )}
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTask(i)}
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setJobId(null);
                setJobError(null);
                setPhase('select');
              }}
            >
              Back (Re-generate)
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Skip
            </Button>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || (equipment.length === 0 && maintenanceTasks.length === 0)}
            isLoading={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save to Boat'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
