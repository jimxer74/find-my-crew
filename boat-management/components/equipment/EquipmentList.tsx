'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button, Card, Select } from '@shared/ui';
import type { BoatEquipment, EquipmentCategory, ProductRegistryEntry } from '@boat-management/lib/types';
import { EQUIPMENT_CATEGORIES, getCategoryLabel, getSubcategoryLabel } from '@boat-management/lib/types';
import { ProductLinks } from '../registry/ProductLinks';
import { submitJob } from '@shared/lib/async-jobs/submitJob';
import { JobProgressPanel } from '@shared/components/async-jobs/JobProgressPanel';
import { getSupabaseBrowserClient } from '@shared/database/client';

interface CachedTask {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  recurrence: { type: string; interval_days?: number; engine_hours?: number } | null;
  estimated_hours: number | null;
}

interface EquipmentListProps {
  equipment: BoatEquipment[];
  boatId: string;
  boatMakeModel?: string;
  onAdd: () => void;
  onEdit: (item: BoatEquipment) => void;
  onDelete: (item: BoatEquipment) => void;
  onGenerateAI?: () => void;
  isOwner: boolean;
}

const statusBorderClass: Record<string, string> = {
  active: 'border-l-green-500',
  needs_replacement: 'border-l-yellow-400',
  decommissioned: 'border-l-slate-400 dark:border-l-slate-600',
};

export function EquipmentList({ equipment, boatId, boatMakeModel, onAdd, onEdit, onDelete, onGenerateAI, isOwner }: EquipmentListProps) {
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let items = equipment;
    if (filterCategory) {
      items = items.filter(item => item.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        item =>
          item.name.toLowerCase().includes(q) ||
          item.manufacturer?.toLowerCase().includes(q) ||
          item.model?.toLowerCase().includes(q) ||
          item.serial_number?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [equipment, filterCategory, searchQuery]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, BoatEquipment[]>();
    for (const item of filtered) {
      const existing = map.get(item.category) ?? [];
      existing.push(item);
      map.set(item.category, existing);
    }
    return map;
  }, [filtered]);

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...EQUIPMENT_CATEGORIES.map(c => ({ value: c.value, label: c.label })),
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1 w-full sm:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search equipment..."
            className="w-full sm:w-64 rounded border border-border bg-input-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={categoryOptions}
            className="w-full sm:w-auto"
          />
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            {onGenerateAI && (
              <Button variant="secondary" onClick={onGenerateAI} size="sm">
                ✦ Generate with AI
              </Button>
            )}
            <Button variant="primary" onClick={onAdd} size="sm">
              + Add Equipment
            </Button>
          </div>
        )}
      </div>

      {/* Equipment count */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        {filterCategory && ` in ${getCategoryLabel(filterCategory as EquipmentCategory)}`}
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {equipment.length === 0
              ? 'No equipment added yet. Start building your boat equipment profile.'
              : 'No equipment matches your filter.'}
          </p>
          {isOwner && equipment.length === 0 && (
            <Button variant="primary" onClick={onAdd}>
              Add Your First Equipment
            </Button>
          )}
        </Card>
      )}

      {/* Grouped equipment list — horizontal swipeable carousel per category */}
      {Array.from(grouped.entries()).map(([categoryKey, items]) => (
        <div key={categoryKey}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {getCategoryLabel(categoryKey as EquipmentCategory)} ({items.length})
          </h3>
          <CategoryCarousel
            items={items}
            boatId={boatId}
            boatMakeModel={boatMakeModel}
            onEdit={onEdit}
            onDelete={onDelete}
            isOwner={isOwner}
          />
        </div>
      ))}
    </div>
  );
}

// --- Category carousel (horizontal scroll, 2-per-row on mobile) ---

function CategoryCarousel({ items, boatId, boatMakeModel, onEdit, onDelete, isOwner }: {
  items: BoatEquipment[];
  boatId: string;
  boatMakeModel?: string;
  onEdit: (item: BoatEquipment) => void;
  onDelete: (item: BoatEquipment) => void;
  isOwner: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    check();
    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [items]);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' });
  };

  return (
    <div className="relative group/carousel">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
      >
        {items.map(item => (
          <div
            key={item.id}
            className="flex-shrink-0 w-[calc(50%-6px)] sm:w-[260px] snap-start"
          >
            <EquipmentCard
              item={item}
              boatId={boatId}
              boatMakeModel={boatMakeModel}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              isOwner={isOwner}
            />
          </div>
        ))}
      </div>
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 w-7 h-7 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Scroll left"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {/* Right scroll button + fade */}
      {canScrollRight && (
        <>
          <div className="absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 z-10 w-7 h-7 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Scroll right"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

// --- Equipment Card ---

function EquipmentCard({
  item,
  boatId,
  boatMakeModel,
  onEdit,
  onDelete,
  isOwner,
}: {
  item: BoatEquipment;
  boatId: string;
  boatMakeModel?: string;
  onEdit: () => void;
  onDelete: () => void;
  isOwner: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [registryProduct, setRegistryProduct] = useState<ProductRegistryEntry | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const handleToggleLinks = async () => {
    if (showLinks) {
      setShowLinks(false);
      return;
    }
    if (registryProduct) {
      setShowLinks(true);
      return;
    }
    if (!item.product_registry_id) return;
    setLoadingLinks(true);
    try {
      const res = await fetch(`/api/product-registry/${item.product_registry_id}`);
      if (res.ok) {
        const json = await res.json();
        setRegistryProduct(json.product);
        setShowLinks(true);
      }
    } finally {
      setLoadingLinks(false);
    }
  };

  return (
    <div className={`bg-card border border-border rounded-lg border-l-4 ${statusBorderClass[item.status] ?? statusBorderClass.active} flex flex-col overflow-hidden h-full`}>
      <div className="p-2.5 flex-1">
        {/* Name + quantity */}
        <div className="flex items-start justify-between gap-1.5 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="font-medium text-card-foreground text-sm leading-tight truncate">{item.name}</h4>
              {(item.quantity ?? 1) > 1 && (
                <span className="shrink-0 text-xs font-semibold px-1 py-0.5 rounded bg-muted text-muted-foreground">
                  ×{item.quantity}
                </span>
              )}
            </div>
            {item.subcategory && (
              <p className="text-xs text-muted-foreground leading-tight">
                {getSubcategoryLabel(item.category, item.subcategory)}
              </p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {item.manufacturer && (
            <p className="truncate">
              <span className="font-medium">Make:</span> {item.manufacturer}
              {item.model && ` ${item.model}`}
            </p>
          )}
          {item.serial_number && (
            <p className="truncate">
              <span className="font-medium">S/N:</span> {item.serial_number}
            </p>
          )}
          {item.year_installed && (
            <p>
              <span className="font-medium">Installed:</span> {item.year_installed}
            </p>
          )}
          {item.notes && (
            <p className="truncate text-xs mt-1" title={item.notes}>
              {item.notes}
            </p>
          )}
        </div>

        {/* Registry links toggle */}
        {item.product_registry_id && (
          <div className="mt-1.5">
            <button
              onClick={handleToggleLinks}
              disabled={loadingLinks}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {loadingLinks ? 'Loading...' : showLinks ? 'Hide docs & parts' : 'View docs & parts'}
            </button>
            {showLinks && registryProduct && (
              <div className="mt-1.5 border-t border-border pt-1.5">
                <ProductLinks product={registryProduct} />
              </div>
            )}
          </div>
        )}

        {/* Maintenance tasks section */}
        {isOwner && item.product_registry_id && (
          <div className="mt-1.5 border-t border-border pt-1.5">
            <EquipmentMaintenanceSection
              item={item}
              boatId={boatId}
              boatMakeModel={boatMakeModel}
            />
          </div>
        )}

        {/* Spare parts section */}
        {isOwner && item.product_registry_id && (
          <div className="mt-1.5 border-t border-border pt-1.5">
            <EquipmentSparesSection
              item={item}
              boatId={boatId}
              boatMakeModel={boatMakeModel}
            />
          </div>
        )}
      </div>

      {/* Card actions */}
      {isOwner && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-t border-border">
          {/* Edit */}
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>

          {/* Delete */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-muted-foreground px-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete();
                  setConfirmDelete(false);
                }}
                className="text-xs text-destructive font-medium px-1"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Equipment Maintenance Section ---

type MaintenanceState = 'idle' | 'fetching' | 'has_tasks' | 'no_tasks' | 'generating' | 'applying' | 'applied' | 'error';

function EquipmentMaintenanceSection({
  item,
  boatId,
  boatMakeModel,
}: {
  item: BoatEquipment;
  boatId: string;
  boatMakeModel?: string;
}) {
  const [state, setState] = useState<MaintenanceState>('idle');
  const [tasks, setTasks] = useState<CachedTask[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchCached = async () => {
    setState('fetching');
    try {
      const res = await fetch(`/api/product-registry/${item.product_registry_id}/maintenance-tasks`);
      if (res.ok) {
        const json = await res.json();
        const fetched = (json.tasks ?? []) as CachedTask[];
        if (fetched.length > 0) {
          setTasks(fetched);
          setState('has_tasks');
        } else {
          setState('no_tasks');
        }
      } else {
        setState('no_tasks');
      }
    } catch {
      setState('no_tasks');
    }
  };

  const handleGenerate = async () => {
    setState('generating');
    setJobId(null);
    try {
      const result = await submitJob({
        job_type: 'generate-equipment-maintenance',
        payload: {
          boatId,
          equipmentId: item.id,
          equipmentName: item.name,
          category: item.category,
          subcategory: item.subcategory ?? null,
          manufacturer: item.manufacturer ?? null,
          model: item.model ?? null,
          yearInstalled: item.year_installed ?? null,
          productRegistryId: item.product_registry_id ?? null,
          boatMakeModel: boatMakeModel ?? '',
        },
      });
      setJobId(result.jobId);
    } catch {
      setState('no_tasks');
    }
  };

  const handleJobComplete = useCallback(async () => {
    await fetchCached();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.product_registry_id]);

  const handleJobError = useCallback((err: string) => {
    setErrorMsg(err);
    setState('error');
  }, []);

  const handleApply = async () => {
    setState('applying');
    try {
      const supabase = getSupabaseBrowserClient();

      // Fetch existing task titles for this equipment to avoid duplicates
      const { data: existing } = await supabase
        .from('boat_maintenance_tasks')
        .select('title')
        .eq('boat_id', boatId)
        .eq('equipment_id', item.id);
      const existingTitles = new Set((existing ?? []).map(t => t.title.toLowerCase().trim()));

      const newTasks = tasks.filter(t => !existingTitles.has(t.title.toLowerCase().trim()));
      const skipped = tasks.length - newTasks.length;

      if (newTasks.length > 0) {
        const { error } = await supabase.from('boat_maintenance_tasks').insert(
          newTasks.map(t => ({
            boat_id: boatId,
            equipment_id: item.id,
            title: t.title,
            description: t.description ?? null,
            category: t.category,
            priority: t.priority ?? 'medium',
            recurrence: t.recurrence ?? null,
            estimated_hours: t.estimated_hours ?? null,
            status: 'pending',
            is_template: false,
          }))
        );
        if (error) throw error;
      }

      setAppliedCount(newTasks.length);
      setSkippedCount(skipped);
      setState('applied');
    } catch {
      setState('has_tasks');
    }
  };

  if (state === 'idle') {
    return (
      <button onClick={fetchCached} className="text-xs text-primary hover:underline">
        ✦ Fetch maintenance tasks
      </button>
    );
  }

  if (state === 'fetching') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
        Loading tasks…
      </div>
    );
  }

  if (state === 'no_tasks') {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">No cached maintenance tasks.</p>
        <button onClick={handleGenerate} className="text-xs font-medium text-primary hover:underline">
          ✦ Generate with AI
        </button>
      </div>
    );
  }

  if (state === 'generating') {
    if (!jobId) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          Starting…
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Generating maintenance tasks…</p>
        <JobProgressPanel
          jobId={jobId}
          onComplete={handleJobComplete}
          onError={handleJobError}
        />
      </div>
    );
  }

  if (state === 'has_tasks') {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{tasks.length} tasks cached</p>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCached}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
            title="Refresh from cache"
          >
            ↻ Refresh
          </button>
          <button onClick={handleApply} className="text-xs font-medium text-primary hover:underline">
            Apply to boat
          </button>
        </div>
      </div>
    );
  }

  if (state === 'applying') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
        Applying…
      </div>
    );
  }

  if (state === 'applied') {
    return (
      <div className="space-y-0.5">
        {appliedCount > 0 && (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ {appliedCount} task{appliedCount !== 1 ? 's' : ''} added to maintenance list</p>
        )}
        {skippedCount > 0 && (
          <p className="text-xs text-muted-foreground">{skippedCount} already existed, skipped</p>
        )}
        {appliedCount === 0 && skippedCount > 0 && (
          <p className="text-xs text-muted-foreground">All tasks already exist on this equipment</p>
        )}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="space-y-1">
        <p className="text-xs text-destructive">{errorMsg || 'Generation failed.'}</p>
        <button onClick={() => setState('no_tasks')} className="text-xs text-muted-foreground hover:text-primary">
          Try again
        </button>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Equipment Spares Section
// ============================================================================

interface CachedSparePart {
  name: string;
  part_number: string | null;
  category: string;
  description: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
}

type SparesState = 'idle' | 'fetching' | 'has_parts' | 'no_parts' | 'generating' | 'applying' | 'applied' | 'error';

function EquipmentSparesSection({
  item,
  boatId,
  boatMakeModel,
}: {
  item: BoatEquipment;
  boatId: string;
  boatMakeModel?: string;
}) {
  const [state, setState] = useState<SparesState>('idle');
  const [parts, setParts] = useState<CachedSparePart[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchCached = async () => {
    setState('fetching');
    try {
      const res = await fetch(`/api/product-registry/${item.product_registry_id}/spare-parts`);
      if (res.ok) {
        const json = await res.json();
        const fetched = (json.parts ?? []) as CachedSparePart[];
        if (fetched.length > 0) {
          setParts(fetched);
          setState('has_parts');
        } else {
          setState('no_parts');
        }
      } else {
        setState('no_parts');
      }
    } catch {
      setState('no_parts');
    }
  };

  const handleGenerate = async () => {
    setState('generating');
    setJobId(null);
    try {
      const result = await submitJob({
        job_type: 'generate-equipment-spares',
        payload: {
          boatId,
          equipmentId: item.id,
          equipmentName: item.name,
          category: item.category,
          subcategory: item.subcategory ?? null,
          manufacturer: item.manufacturer ?? null,
          model: item.model ?? null,
          yearInstalled: item.year_installed ?? null,
          productRegistryId: item.product_registry_id ?? null,
          boatMakeModel: boatMakeModel ?? '',
        },
      });
      setJobId(result.jobId);
    } catch {
      setState('no_parts');
    }
  };

  const handleJobComplete = useCallback(async () => {
    await fetchCached();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.product_registry_id]);

  const handleJobError = useCallback((err: string) => {
    setErrorMsg(err);
    setState('error');
  }, []);

  const handleApply = async () => {
    setState('applying');
    try {
      const supabase = getSupabaseBrowserClient();

      // Fetch existing inventory items for this equipment to avoid duplicates
      const { data: existing } = await supabase
        .from('boat_inventory')
        .select('name')
        .eq('boat_id', boatId)
        .eq('equipment_id', item.id);
      const existingNames = new Set((existing ?? []).map(i => i.name.toLowerCase().trim()));

      const newParts = parts.filter(p => !existingNames.has(p.name.toLowerCase().trim()));
      const skipped = parts.length - newParts.length;

      if (newParts.length > 0) {
        const { error } = await supabase.from('boat_inventory').insert(
          newParts.map(p => ({
            boat_id: boatId,
            equipment_id: item.id,
            name: p.name,
            category: item.category,
            quantity: 0,
            min_quantity: p.quantity,
            unit: p.unit,
            part_number: p.part_number ?? null,
            notes: [p.description, p.notes].filter(Boolean).join(' — ') || null,
          }))
        );
        if (error) throw error;
      }

      setAppliedCount(newParts.length);
      setSkippedCount(skipped);
      setState('applied');
    } catch {
      setState('has_parts');
    }
  };

  if (state === 'idle') {
    return (
      <button onClick={fetchCached} className="text-xs text-primary hover:underline">
        ✦ Fetch spare parts
      </button>
    );
  }

  if (state === 'fetching') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
        Loading spare parts…
      </div>
    );
  }

  if (state === 'no_parts') {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">No cached spare parts.</p>
        <button onClick={handleGenerate} className="text-xs font-medium text-primary hover:underline">
          ✦ Generate with AI
        </button>
      </div>
    );
  }

  if (state === 'generating') {
    if (!jobId) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          Starting…
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Generating spare parts list…</p>
        <JobProgressPanel
          jobId={jobId}
          onComplete={handleJobComplete}
          onError={handleJobError}
        />
      </div>
    );
  }

  if (state === 'has_parts') {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{parts.length} part{parts.length !== 1 ? 's' : ''} cached</p>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCached}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
            title="Refresh from cache"
          >
            ↻ Refresh
          </button>
          <button onClick={handleApply} className="text-xs font-medium text-primary hover:underline">
            Add to inventory
          </button>
        </div>
      </div>
    );
  }

  if (state === 'applying') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
        Saving…
      </div>
    );
  }

  if (state === 'applied') {
    return (
      <div className="space-y-0.5">
        {appliedCount > 0 && (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ {appliedCount} part{appliedCount !== 1 ? 's' : ''} added to inventory</p>
        )}
        {skippedCount > 0 && (
          <p className="text-xs text-muted-foreground">{skippedCount} already existed, skipped</p>
        )}
        {appliedCount === 0 && skippedCount > 0 && (
          <p className="text-xs text-muted-foreground">All parts already exist in inventory</p>
        )}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="space-y-1">
        <p className="text-xs text-destructive">{errorMsg || 'Generation failed.'}</p>
        <button onClick={() => setState('no_parts')} className="text-xs text-muted-foreground hover:text-primary">
          Try again
        </button>
      </div>
    );
  }

  return null;
}
