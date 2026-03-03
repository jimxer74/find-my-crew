'use client';

import { useState, useCallback, useRef } from 'react';
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
  // Age-aware replacement assessment (from AI)
  replacementLikelihood?: 'low' | 'medium' | 'high';
  replacementReason?: string | null;
  // UI-only state (set by user interactions in review phase)
  replacementStatus?: 'confirmed' | 'replaced';
  replacementManufacturer?: string | null;
  replacementModel?: string | null;
  replacementProductRegistryId?: string | null;
  showReplaceForm?: boolean;
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
  yearBuilt?: number | null;
  onComplete: () => void;
  onSkip: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Phase = 'year_prompt' | 'select' | 'generating' | 'review' | 'saving';

const ALL_CATEGORIES = EQUIPMENT_CATEGORIES.map((c) => c.value);

// ---------------------------------------------------------------------------
// Inline replacement form sub-component
// ---------------------------------------------------------------------------

interface AiProduct {
  id: string;
  manufacturer: string;
  model: string;
  description?: string;
  category?: string;
}

function InlineReplaceForm({
  initialManufacturer,
  equipmentName,
  onApply,
  onCancel,
}: {
  initialManufacturer: string | null;
  equipmentName?: string;
  onApply: (manufacturer: string, model: string, productRegistryId: string | null) => void;
  onCancel: () => void;
}) {
  const [manufacturer, setManufacturer] = useState(initialManufacturer ?? '');
  const [model, setModel] = useState('');
  const [mfrSuggestions, setMfrSuggestions] = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<
    { id: string; manufacturer: string; model: string }[]
  >([]);
  const [showMfrList, setShowMfrList] = useState(false);
  const [showModelList, setShowModelList] = useState(false);
  const [selectedRegistryId, setSelectedRegistryId] = useState<string | null>(null);
  const mfrDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI search state
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<AiProduct[]>([]);
  const [showAiResults, setShowAiResults] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAiSearch = async () => {
    if (!manufacturer.trim() && !model.trim() && !equipmentName?.trim()) return;
    setIsAiSearching(true);
    setAiError(null);
    setShowAiResults(false);
    try {
      const res = await fetch('/api/product-registry/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer: manufacturer.trim() || undefined,
          model: model.trim() || undefined,
          additionalText: equipmentName?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI search failed');
      const products = (data.products ?? []) as AiProduct[];
      setAiResults(products);
      setShowAiResults(true);
      if (products.length === 0) setAiError('No matching products found. Try different search terms.');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI search failed');
    } finally {
      setIsAiSearching(false);
    }
  };

  const selectAiResult = (product: AiProduct) => {
    setManufacturer(product.manufacturer);
    setModel(product.model);
    setSelectedRegistryId(product.id ?? null);
    setShowAiResults(false);
    setAiResults([]);
    setAiError(null);
  };

  const handleMfrChange = (value: string) => {
    setManufacturer(value);
    setModel('');
    setSelectedRegistryId(null);
    if (mfrDebounce.current) clearTimeout(mfrDebounce.current);
    if (!value.trim()) {
      setMfrSuggestions([]);
      setShowMfrList(false);
      return;
    }
    mfrDebounce.current = setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('product_registry')
        .select('manufacturer')
        .ilike('manufacturer', `%${value}%`)
        .limit(15);
      const unique = [...new Set((data ?? []).map((d) => d.manufacturer as string))];
      setMfrSuggestions(unique);
      setShowMfrList(unique.length > 0);
    }, 300);
  };

  const selectManufacturer = (mfr: string) => {
    setManufacturer(mfr);
    setMfrSuggestions([]);
    setShowMfrList(false);
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setSelectedRegistryId(null);
    if (modelDebounce.current) clearTimeout(modelDebounce.current);
    if (!value.trim()) {
      setModelSuggestions([]);
      setShowModelList(false);
      return;
    }
    modelDebounce.current = setTimeout(async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from('product_registry')
        .select('id, manufacturer, model')
        .ilike('model', `%${value}%`)
        .ilike('manufacturer', `%${manufacturer}%`)
        .limit(10);
      setModelSuggestions(data ?? []);
      setShowModelList((data ?? []).length > 0);
    }, 300);
  };

  const selectModel = (entry: { id: string; manufacturer: string; model: string }) => {
    setManufacturer(entry.manufacturer);
    setModel(entry.model);
    setSelectedRegistryId(entry.id);
    setModelSuggestions([]);
    setShowModelList(false);
  };

  const handleApply = () => {
    if (!manufacturer.trim() || !model.trim()) return;
    onApply(manufacturer.trim(), model.trim(), selectedRegistryId);
  };

  const inputCls =
    'w-full px-2 py-1.5 text-sm border border-border bg-background text-foreground rounded focus:outline-none focus:ring-2 focus:ring-primary/50';

  return (
    <div className="mt-3 p-3 bg-background border border-amber-200 dark:border-amber-800 rounded-md space-y-2">
      <p className="text-xs font-medium text-foreground">Enter replacement details:</p>
      <div className="grid grid-cols-2 gap-2">
        {/* Manufacturer */}
        <div className="relative">
          <label className="text-xs text-muted-foreground block mb-0.5">Manufacturer</label>
          <input
            type="text"
            value={manufacturer}
            onChange={(e) => handleMfrChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowMfrList(false), 150)}
            placeholder="e.g. Yanmar"
            className={inputCls}
          />
          {showMfrList && (
            <ul className="absolute z-20 top-full left-0 right-0 bg-popover border border-border rounded shadow-md text-sm max-h-36 overflow-y-auto">
              {mfrSuggestions.map((s) => (
                <li
                  key={s}
                  onMouseDown={() => selectManufacturer(s)}
                  className="px-3 py-1.5 hover:bg-accent cursor-pointer"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Model */}
        <div className="relative">
          <label className="text-xs text-muted-foreground block mb-0.5">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowModelList(false), 150)}
            placeholder="e.g. 3JH5E"
            className={inputCls}
          />
          {showModelList && (
            <ul className="absolute z-20 top-full left-0 right-0 bg-popover border border-border rounded shadow-md text-sm max-h-36 overflow-y-auto">
              {modelSuggestions.map((s) => (
                <li
                  key={s.id}
                  onMouseDown={() => selectModel(s)}
                  className="px-3 py-1.5 hover:bg-accent cursor-pointer"
                >
                  <span className="font-medium">{s.manufacturer}</span>{' '}
                  <span className="text-muted-foreground">{s.model}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {/* AI search button */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleAiSearch}
          disabled={isAiSearching || (!manufacturer.trim() && !model.trim() && !equipmentName?.trim())}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/5 disabled:opacity-40 transition-colors"
        >
          {isAiSearching ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching…
            </>
          ) : (
            <>✨ Search with AI</>
          )}
        </button>
        <span className="text-xs text-muted-foreground">or type manufacturer &amp; model above</span>
      </div>

      {/* AI error */}
      {aiError && (
        <p className="text-xs text-destructive">{aiError}</p>
      )}

      {/* AI results */}
      {showAiResults && aiResults.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden">
          <p className="text-xs text-muted-foreground px-2 py-1.5 bg-muted/40 border-b border-border">
            Select a product:
          </p>
          <ul className="divide-y divide-border max-h-48 overflow-y-auto">
            {aiResults.map((product, i) => (
              <li key={product.id ?? i}>
                <button
                  onClick={() => selectAiResult(product)}
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                >
                  <span className="text-sm font-medium text-foreground block">
                    {product.manufacturer} {product.model}
                  </span>
                  {product.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1 block mt-0.5">
                      {product.description}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!manufacturer.trim() || !model.trim()}
          className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded disabled:opacity-40 hover:bg-primary/90"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewBoatWizardStep3({
  boatId,
  makeModel,
  boatType,
  loa_m,
  yearBuilt,
  onComplete,
  onSkip,
}: NewBoatWizardStep3Props) {
  const [phase, setPhase] = useState<Phase>(yearBuilt ? 'select' : 'year_prompt');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  // Year built — may be resolved from prompt if not supplied via props
  const [resolvedYearBuilt, setResolvedYearBuilt] = useState<number | null>(yearBuilt ?? null);
  const [yearInput, setYearInput] = useState('');
  const [yearSaving, setYearSaving] = useState(false);

  const handleYearConfirm = async () => {
    const parsed = parseInt(yearInput, 10);
    const currentYear = new Date().getFullYear();
    const year = !isNaN(parsed) && parsed >= 1900 && parsed <= currentYear ? parsed : null;
    if (year) {
      setYearSaving(true);
      try {
        const supabase = getSupabaseBrowserClient();
        await supabase.from('boats').update({ year_built: year }).eq('id', boatId);
      } finally {
        setYearSaving(false);
      }
      setResolvedYearBuilt(year);
    }
    setPhase('select');
  };

  // Category selection — all checked by default
  const [selectedCategories, setSelectedCategories] = useState<string[]>([...ALL_CATEGORIES]);
  const [maintenanceCategories, setMaintenanceCategories] = useState<string[]>([...ALL_CATEGORIES]);

  // Generated results (mutable — user can delete or verify items)
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
          yearBuilt: resolvedYearBuilt,
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
  // Equipment mutation helpers
  // -------------------------------------------------------------------------

  const updateItem = (index: number, patch: Partial<GeneratedEquipmentItem>) => {
    setEquipment((prev) =>
      prev.map((item) => (item.index === index ? { ...item, ...patch } : item)),
    );
  };

  const deleteEquipment = (index: number) => {
    const toRemove = new Set<number>();
    toRemove.add(index);
    let changed = true;
    while (changed) {
      changed = false;
      equipment.forEach((item) => {
        if (
          item.parentIndex !== null &&
          toRemove.has(item.parentIndex) &&
          !toRemove.has(item.index)
        ) {
          toRemove.add(item.index);
          changed = true;
        }
      });
    }
    setEquipment((prev) => prev.filter((item) => !toRemove.has(item.index)));
    setMaintenanceTasks((prev) =>
      prev.filter((task) => task.equipmentIndex === null || !toRemove.has(task.equipmentIndex)),
    );
  };

  const confirmOriginal = (index: number) => {
    updateItem(index, { replacementStatus: 'confirmed', showReplaceForm: false });
  };

  const toggleReplaceForm = (index: number) => {
    setEquipment((prev) =>
      prev.map((item) =>
        item.index === index ? { ...item, showReplaceForm: !item.showReplaceForm } : item,
      ),
    );
  };

  const markReplaced = (
    index: number,
    manufacturer: string,
    model: string,
    productRegistryId: string | null,
  ) => {
    // Remove old maintenance tasks linked to this equipment before applying replacement
    setMaintenanceTasks((prev) => prev.filter((t) => t.equipmentIndex !== index));
    updateItem(index, {
      replacementStatus: 'replaced',
      replacementManufacturer: manufacturer,
      replacementModel: model,
      replacementProductRegistryId: productRegistryId,
      showReplaceForm: false,
    });
  };

  const deleteTask = (taskIdx: number) => {
    setMaintenanceTasks((prev) => prev.filter((_, i) => i !== taskIdx));
  };

  // -------------------------------------------------------------------------
  // Fetch maintenance tasks from cache for a replaced equipment item
  // -------------------------------------------------------------------------

  const [fetchingTasksFor, setFetchingTasksFor] = useState<Set<number>>(new Set());
  const [fetchTasksError, setFetchTasksError] = useState<Record<number, string>>({});

  const fetchMaintenanceTasksForReplacement = async (item: GeneratedEquipmentItem) => {
    if (!item.replacementProductRegistryId) return;
    setFetchingTasksFor((prev) => new Set(prev).add(item.index));
    setFetchTasksError((prev) => { const next = { ...prev }; delete next[item.index]; return next; });
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('product_maintenance_tasks')
        .select('title, description, category, priority, recurrence, estimated_hours')
        .eq('product_registry_id', item.replacementProductRegistryId);

      if (error) throw error;

      if (!data || data.length === 0) {
        setFetchTasksError((prev) => ({
          ...prev,
          [item.index]: 'No cached tasks found for this product yet.',
        }));
        return;
      }

      const newTasks: GeneratedTaskItem[] = data.map((t) => ({
        equipmentIndex: item.index,
        title: t.title as string,
        description: (t.description as string | null) ?? null,
        category: t.category as string,
        priority: t.priority as string,
        recurrence: (t.recurrence as GeneratedTaskItem['recurrence']) ?? { type: 'time' },
        estimated_hours: t.estimated_hours != null ? Number(t.estimated_hours) : null,
      }));

      setMaintenanceTasks((prev) => [...prev, ...newTasks]);
    } catch (err) {
      logger.error('[Step3] Failed to fetch maintenance tasks for replacement', {
        error: err instanceof Error ? err.message : String(err),
      });
      setFetchTasksError((prev) => ({
        ...prev,
        [item.index]: err instanceof Error ? err.message : 'Failed to fetch tasks',
      }));
    } finally {
      setFetchingTasksFor((prev) => {
        const next = new Set(prev);
        next.delete(item.index);
        return next;
      });
    }
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

      // Resolve effective manufacturer/model/registryId per item (replacement takes precedence)
      const effectiveValues = (item: GeneratedEquipmentItem) => ({
        manufacturer:
          item.replacementStatus === 'replaced'
            ? (item.replacementManufacturer ?? null)
            : item.manufacturer,
        model:
          item.replacementStatus === 'replaced'
            ? (item.replacementModel ?? null)
            : item.model,
        product_registry_id:
          item.replacementStatus === 'replaced'
            ? (item.replacementProductRegistryId ?? null)
            : (item.productRegistryId ?? null),
      });

      // Step 1: Insert parent items (parentIndex === null)
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
              notes: e.notes,
              status: 'active',
              ...effectiveValues(e),
            })),
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
              notes: e.notes,
              status: 'active',
              ...effectiveValues(e),
            })),
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
        const { error: taskErr } = await supabase
          .from('boat_maintenance_tasks')
          .insert(tasksToInsert);
        if (taskErr) throw new Error(`Failed to save maintenance tasks: ${taskErr.message}`);
      }

      onComplete();
    } catch (err) {
      logger.error(
        '[Step3] Save failed:',
        err instanceof Error ? { error: err.message } : { error: String(err) },
      );
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived data for review
  // -------------------------------------------------------------------------

  const equipmentByCategory = equipment.reduce<Record<string, GeneratedEquipmentItem[]>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {},
  );

  const getCategoryLabel = (value: string) =>
    EQUIPMENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const unreviewedCount = equipment.filter(
    (e) =>
      (e.replacementLikelihood === 'high' || e.replacementLikelihood === 'medium') &&
      !e.replacementStatus,
  ).length;

  // -------------------------------------------------------------------------
  // Render: Selection phase
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Render: Year prompt phase (only shown when yearBuilt was not set)
  // -------------------------------------------------------------------------

  if (phase === 'year_prompt') {
    const currentYear = new Date().getFullYear();
    const parsed = parseInt(yearInput, 10);
    const isValid = !isNaN(parsed) && parsed >= 1900 && parsed <= currentYear;
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">When was your boat built?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The build year helps AI flag equipment that is commonly replaced at this age for your
            review. You can skip this if unknown.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-[160px]">
            <label htmlFor="year_built_prompt" className="block text-sm font-medium text-foreground mb-1">
              Year built
            </label>
            <input
              id="year_built_prompt"
              type="number"
              min={1900}
              max={currentYear}
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && isValid) handleYearConfirm(); }}
              placeholder={`e.g. ${currentYear - 15}`}
              className="w-full px-3 py-2 border border-border bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </div>
          <Button onClick={handleYearConfirm} disabled={yearSaving}>
            {yearSaving ? 'Saving…' : isValid ? 'Continue' : 'Skip'}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'select') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Equipment & Maintenance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI will generate a standard equipment list and maintenance schedule for{' '}
            <span className="font-medium text-foreground">{makeModel || 'your boat'}</span>.
            {resolvedYearBuilt && (
              <>
                {' '}Built in <span className="font-medium text-foreground">{resolvedYearBuilt}</span> —
                AI will flag items commonly replaced at this age for your review.
              </>
            )}{' '}
            Select which categories to include.
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
                    onChange={() =>
                      toggleCategory(cat.value, selectedCategories, setSelectedCategories)
                    }
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
                {maintenanceCategories.length === ALL_CATEGORIES.length
                  ? 'Deselect all'
                  : 'Select all'}
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
          <Button onClick={handleGenerate} disabled={selectedCategories.length === 0}>
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
          <JobProgressPanel jobId={jobId} onComplete={handleJobComplete} onError={handleJobError} />
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

        {/* Unreviewed items banner */}
        {unreviewedCount > 0 && (
          <div className="flex items-start gap-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <svg
              className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {unreviewedCount} item{unreviewedCount > 1 ? 's' : ''} may no longer match
                original spec
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Review the flagged items below and confirm, update, or remove them before saving.
              </p>
            </div>
          </div>
        )}

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
                      const isHighRisk =
                        item.replacementLikelihood === 'high' && !item.replacementStatus;
                      const isMediumRisk =
                        item.replacementLikelihood === 'medium' && !item.replacementStatus;

                      return (
                        <div
                          key={item.index}
                          className={`rounded-md px-3 py-2 ${
                            isHighRisk
                              ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
                              : 'bg-muted/40'
                          } ${isChild ? 'ml-6' : ''}`}
                        >
                          {/* Item header row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isChild && (
                                  <span className="text-muted-foreground text-xs flex-shrink-0">
                                    ↳
                                  </span>
                                )}
                                <span className="text-sm font-medium text-foreground">
                                  {item.name}
                                </span>
                                {/* Show effective manufacturer/model */}
                                {(item.replacementStatus === 'replaced'
                                  ? item.replacementManufacturer
                                  : item.manufacturer) && (
                                  <span className="text-xs text-muted-foreground">
                                    {item.replacementStatus === 'replaced'
                                      ? `${item.replacementManufacturer}${item.replacementModel ? ` ${item.replacementModel}` : ''}`
                                      : `${item.manufacturer}${item.model ? ` ${item.model}` : ''}`}
                                  </span>
                                )}
                                {/* Status badges */}
                                {item.replacementStatus === 'confirmed' && (
                                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                    Original confirmed
                                  </span>
                                )}
                                {item.replacementStatus === 'replaced' && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                    Updated
                                  </span>
                                )}
                                {/* Fetch maintenance tasks for new product */}
                                {item.replacementStatus === 'replaced' &&
                                  item.replacementProductRegistryId && (() => {
                                    const alreadyFetched = maintenanceTasks.some(
                                      (t) => t.equipmentIndex === item.index,
                                    );
                                    const isFetching = fetchingTasksFor.has(item.index);
                                    const taskCount = maintenanceTasks.filter(
                                      (t) => t.equipmentIndex === item.index,
                                    ).length;
                                    if (alreadyFetched) {
                                      return (
                                        <span className="text-xs text-green-600 dark:text-green-400">
                                          {taskCount} task{taskCount !== 1 ? 's' : ''} added
                                        </span>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={() => fetchMaintenanceTasksForReplacement(item)}
                                        disabled={isFetching}
                                        className="text-xs flex items-center gap-1 px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/5 disabled:opacity-40 transition-colors"
                                      >
                                        {isFetching ? (
                                          <>
                                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Fetching…
                                          </>
                                        ) : (
                                          '+ Fetch maintenance tasks'
                                        )}
                                      </button>
                                    );
                                  })()
                                }
                                {isHighRisk && (
                                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                    ⚠ Verify
                                  </span>
                                )}
                                {isMediumRisk && (
                                  <button
                                    onClick={() => toggleReplaceForm(item.index)}
                                    className="text-xs text-amber-500 hover:text-amber-700 dark:text-amber-400 hover:underline"
                                  >
                                    ◇ Verify?
                                  </button>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5 ml-4">
                                  {item.notes}
                                </p>
                              )}
                              {fetchTasksError[item.index] && (
                                <p className="text-xs text-muted-foreground mt-0.5 ml-4">
                                  {fetchTasksError[item.index]}
                                </p>
                              )}
                            </div>
                            {/* Delete button — only for top-level or when not showing replace form */}
                            {!item.showReplaceForm && (
                              <button
                                onClick={() => deleteEquipment(item.index)}
                                className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                                title="Remove"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* HIGH likelihood — always expanded warning */}
                          {isHighRisk && (
                            <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-700">
                              <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                                {item.replacementReason}
                              </p>
                              {!item.showReplaceForm ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => confirmOriginal(item.index)}
                                    className="text-xs px-2.5 py-1 rounded border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                                  >
                                    Confirm original
                                  </button>
                                  <button
                                    onClick={() => toggleReplaceForm(item.index)}
                                    className="text-xs px-2.5 py-1 rounded border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                                  >
                                    It&apos;s been replaced
                                  </button>
                                  <button
                                    onClick={() => deleteEquipment(item.index)}
                                    className="text-xs px-2.5 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : (
                                <InlineReplaceForm
                                  initialManufacturer={item.manufacturer}
                                  equipmentName={item.name}
                                  onApply={(mfr, mdl, regId) =>
                                    markReplaced(item.index, mfr, mdl, regId)
                                  }
                                  onCancel={() => toggleReplaceForm(item.index)}
                                />
                              )}
                            </div>
                          )}

                          {/* MEDIUM likelihood — collapsed, expand on "Verify?" click */}
                          {isMediumRisk && item.showReplaceForm && (
                            <div className="mt-2 pt-2 border-t border-amber-100 dark:border-amber-900">
                              {item.replacementReason && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                                  {item.replacementReason}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <button
                                  onClick={() => confirmOriginal(item.index)}
                                  className="text-xs px-2.5 py-1 rounded border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
                                >
                                  Confirm original
                                </button>
                                <button
                                  onClick={() => deleteEquipment(item.index)}
                                  className="text-xs px-2.5 py-1 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                              <InlineReplaceForm
                                initialManufacturer={item.manufacturer}
                                equipmentName={item.name}
                                onApply={(mfr, mdl, regId) =>
                                  markReplaced(item.index, mfr, mdl, regId)
                                }
                                onCancel={() => toggleReplaceForm(item.index)}
                              />
                            </div>
                          )}
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
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
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
