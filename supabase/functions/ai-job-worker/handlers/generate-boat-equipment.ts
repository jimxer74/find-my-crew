/**
 * Handler: generate-boat-equipment
 *
 * Two-phase AI generation:
 *   Phase 1 — Generate equipment list only (gpt-4o-like, webSearch enabled).
 *             Upsert to product_registry. Check product_maintenance_tasks cache.
 *   Phase 2 — Generate maintenance tasks only for uncached equipment (gpt-4o-mini).
 *             Store new tasks to product_maintenance_tasks cache.
 *
 * Returns: { equipment (with productRegistryId populated), maintenanceTasks }
 */

import { callAI } from '../../_shared/ai-client.ts';
import { supabase } from '../../_shared/job-helpers.ts';
import type { JobHandler, HandlerContext } from '../../_shared/types.ts';

// ---------------------------------------------------------------------------
// AI configuration
// ---------------------------------------------------------------------------

const PHASE1_AI_OPTIONS = {
  model: 'openrouter/auto:online',
  maxTokens: 12000,
  temperature: 0.1,
  webSearchMaxResults: 8,
  systemPrompt:
    'You are a marine equipment expert and technical researcher. ' +
    'You only document equipment that is verifiably present on a specific boat model based on ' +
    'manufacturer specifications, owner\'s manuals, official equipment lists, or well-documented ' +
    'sailing community resources. You NEVER invent, infer, or hallucinate equipment. ' +
    'If you cannot verify an item exists for the specific model, you omit it entirely.',
};

const PHASE2_AI_OPTIONS = {
  model: 'openai/gpt-4o-mini',
  maxTokens: 8000,
  temperature: 0.1,
  systemPrompt:
    'You are a marine maintenance expert. Generate accurate maintenance schedules based on ' +
    'manufacturer service manuals and known best practices for the specific equipment listed. ' +
    'Only include tasks with documented service intervals. OMIT any task you cannot verify.',
};

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

interface GenerateBoatEquipmentPayload {
  boatId: string;
  makeModel: string;
  boatType: string | null;
  loa_m: number | null;
  selectedCategories: string[];
  maintenanceCategories: string[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface EquipmentItem {
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

interface MaintenanceTaskItem {
  equipmentIndex: number | null;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  recurrence: { type: string; interval_days?: number; engine_hours?: number };
  estimated_hours: number | null;
}

// ---------------------------------------------------------------------------
// Shared utility
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

// ---------------------------------------------------------------------------
// Phase 1 — Equipment generation
// ---------------------------------------------------------------------------

function buildEquipmentPrompt(payload: GenerateBoatEquipmentPayload): string {
  const { makeModel, boatType, loa_m, selectedCategories } = payload;
  const boatDesc = [
    makeModel,
    boatType ? `type: ${boatType}` : null,
    loa_m ? `LOA: ${loa_m}m` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const categoryDescriptions: Record<string, string> = {
    engine: 'Engine & Propulsion (main engine, fuel system, cooling, gearbox, propeller, alternator, exhaust)',
    rigging: 'Rigging & Sails (mast, boom, standing rigging, running rigging, winches, sails, furlers)',
    electrical: 'Electrical (batteries, solar panels, wind generator, shore power, wiring, inverter, charger)',
    navigation: 'Navigation (GPS, chartplotter, radar, AIS, compass, autopilot, instruments)',
    safety: 'Safety (life raft, life jackets, EPIRB, flares, fire extinguishers, jacklines)',
    plumbing: 'Plumbing (freshwater system, watermaker, bilge pumps, heads, holding tank)',
    anchoring: 'Anchoring (anchors, chain, windlass)',
    hull_deck: 'Hull & Deck (hull, keel, rudder, hatches, ports, teak deck)',
    electronics: 'Electronics & Communication (VHF radio, SSB, satellite phone, WiFi)',
    galley: 'Galley (stove, oven, refrigeration, provisions storage)',
    comfort: 'Comfort (heating, ventilation, lighting, cushions)',
    dinghy: 'Dinghy & Tender (dinghy, outboard motor, davits)',
  };

  const categoryList = selectedCategories
    .map((c) => `- ${categoryDescriptions[c] ?? c}`)
    .join('\n');

  return `TASK: Build a verified equipment list for the sailboat described below by searching manufacturer and authoritative sources.

BOAT: ${boatDesc}

STEP 1 — RESEARCH (use web search):
Search for the following to find verified information about this specific boat model:
- "${makeModel} owner's manual"
- "${makeModel} specifications"
- "${makeModel} standard equipment list"
- "${makeModel} sailboat review"
Use the search results to determine what equipment the manufacturer actually fitted as standard.

STEP 2 — OUTPUT RULES (CRITICAL — read carefully):
1. ONLY include equipment items you can VERIFY exist on this specific boat model from manufacturer documentation, owner's manuals, dealer specifications, or well-established sailing community sources.
2. DO NOT invent, assume, or infer equipment. If uncertain, OMIT it.
3. Include manufacturer and model ONLY when found from a verified source — set to null if uncertain.
4. Use parent-child hierarchy: top-level items have parentIndex: null; sub-items reference the parent's index.
5. Use ONLY these exact category values: engine, rigging, electrical, navigation, safety, plumbing, anchoring, hull_deck, electronics, galley, comfort, dinghy
6. notes must be a brief factual description sourced from the research — not generic filler text.

CATEGORIES TO GENERATE EQUIPMENT FOR:
${categoryList}

Return ONLY valid JSON with no extra text, markdown fences, or commentary:
{
  "equipment": [
    {
      "index": 0,
      "name": "Main Engine",
      "category": "engine",
      "subcategory": "engine",
      "parentIndex": null,
      "manufacturer": "Volvo Penta",
      "model": "D2-75",
      "notes": "75hp diesel inboard, standard fit per manufacturer brochure"
    },
    {
      "index": 1,
      "name": "Fuel Filter",
      "category": "engine",
      "subcategory": "fuel_system",
      "parentIndex": 0,
      "manufacturer": null,
      "model": null,
      "notes": "Inline fuel filter, part of fuel system per service manual"
    }
  ]
}`;
}

function parseEquipment(text: string): EquipmentItem[] {
  const raw = JSON.parse(extractJson(text));
  if (!Array.isArray(raw.equipment)) {
    throw new Error('Invalid response: equipment must be an array');
  }
  return raw.equipment.map((item: Record<string, unknown>, i: number) => ({
    index: typeof item.index === 'number' ? item.index : i,
    name: String(item.name ?? 'Unknown'),
    category: String(item.category ?? 'hull_deck'),
    subcategory: item.subcategory ? String(item.subcategory) : null,
    parentIndex: typeof item.parentIndex === 'number' ? item.parentIndex : null,
    manufacturer: item.manufacturer ? String(item.manufacturer) : null,
    model: item.model ? String(item.model) : null,
    notes: item.notes ? String(item.notes) : null,
  }));
}

// ---------------------------------------------------------------------------
// Phase 2 — Maintenance tasks generation
// ---------------------------------------------------------------------------

function buildMaintenancePrompt(
  equipment: EquipmentItem[],
  maintenanceCategories: string[],
): string {
  const equipmentList = equipment
    .map(
      (e) =>
        `  ${e.index}: ${e.name}${
          e.manufacturer ? ` (${e.manufacturer}${e.model ? ' ' + e.model : ''})` : ''
        } [${e.category}]`,
    )
    .join('\n');

  const catNote =
    maintenanceCategories.length > 0
      ? `Only generate tasks for equipment in these categories: ${maintenanceCategories.join(', ')}`
      : 'Generate maintenance tasks for all equipment listed.';

  return `TASK: Generate maintenance tasks for the following boat equipment.

EQUIPMENT (index: name):
${equipmentList}

${catNote}

RULES (CRITICAL):
1. ONLY include tasks explicitly described in owner's manuals or service docs for this specific equipment.
2. DO NOT invent tasks. OMIT anything you cannot verify.
3. Intervals (interval_days or engine_hours) must come from actual documentation — do not guess.
4. category must be one of: routine, seasonal, repair, inspection, safety
5. priority must be one of: low, medium, high, critical
6. recurrence.type must be "time" (use interval_days) or "usage" (use engine_hours)

Return ONLY valid JSON with no extra text or markdown fences:
{
  "maintenanceTasks": [
    {
      "equipmentIndex": 0,
      "title": "Engine Oil & Filter Change",
      "description": "Change engine oil and oil filter per Volvo Penta service manual.",
      "category": "routine",
      "priority": "high",
      "recurrence": { "type": "usage", "engine_hours": 150 },
      "estimated_hours": 1.5
    }
  ]
}`;
}

function parseMaintenanceTasks(text: string): MaintenanceTaskItem[] {
  const raw = JSON.parse(extractJson(text));
  if (!Array.isArray(raw.maintenanceTasks)) return [];

  const VALID_CATS = ['routine', 'seasonal', 'repair', 'inspection', 'safety'];
  const VALID_PRIS = ['low', 'medium', 'high', 'critical'];

  return raw.maintenanceTasks.map((task: Record<string, unknown>) => ({
    equipmentIndex: typeof task.equipmentIndex === 'number' ? task.equipmentIndex : null,
    title: String(task.title ?? 'Maintenance Task'),
    description: task.description ? String(task.description) : null,
    category: VALID_CATS.includes(String(task.category)) ? String(task.category) : 'routine',
    priority: VALID_PRIS.includes(String(task.priority)) ? String(task.priority) : 'medium',
    recurrence:
      task.recurrence && typeof task.recurrence === 'object'
        ? (task.recurrence as { type: string; interval_days?: number; engine_hours?: number })
        : { type: 'time', interval_days: 365 },
    estimated_hours: typeof task.estimated_hours === 'number' ? task.estimated_hours : null,
  }));
}

// ---------------------------------------------------------------------------
// Handler export
// ---------------------------------------------------------------------------

export const handler: JobHandler = {
  async run(
    jobId: string,
    rawPayload: Record<string, unknown>,
    ctx: HandlerContext,
  ): Promise<Record<string, unknown>> {
    const payload = rawPayload as unknown as GenerateBoatEquipmentPayload;

    // -------------------------------------------------------------------------
    // Phase 1: Generate equipment list
    // -------------------------------------------------------------------------
    await ctx.emitProgress(jobId, 'Preparing equipment prompt', 10);
    const equipmentPrompt = buildEquipmentPrompt(payload);

    await ctx.emitProgress(
      jobId,
      'Searching manufacturer sources & generating equipment list (30–90 seconds)',
      20,
    );
    const equipmentText = await callAI(equipmentPrompt, PHASE1_AI_OPTIONS);

    await ctx.emitProgress(jobId, 'Processing equipment results', 50);
    const equipment = parseEquipment(equipmentText);

    // -------------------------------------------------------------------------
    // Upsert product_registry and populate productRegistryId on each item
    // -------------------------------------------------------------------------
    const withProduct = equipment.filter((e) => e.manufacturer && e.model);
    if (withProduct.length > 0) {
      // Insert new entries; ignore on conflict (upsert without returning rows on conflict)
      await supabase.from('product_registry').upsert(
        withProduct.map((e) => ({
          category: e.category,
          subcategory: e.subcategory,
          manufacturer: e.manufacturer!,
          model: e.model!,
        })),
        { onConflict: 'manufacturer,model', ignoreDuplicates: true },
      );

      // Fetch actual IDs — SELECT needed because ignoreDuplicates returns nothing on conflict
      const manufacturers = [...new Set(withProduct.map((e) => e.manufacturer!))];
      const { data: productRows } = await supabase
        .from('product_registry')
        .select('id, manufacturer, model')
        .in('manufacturer', manufacturers);

      if (productRows) {
        for (const prod of productRows) {
          const matched = equipment.find(
            (e) => e.manufacturer === prod.manufacturer && e.model === prod.model,
          );
          if (matched) matched.productRegistryId = prod.id;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Check product_maintenance_tasks cache
    // -------------------------------------------------------------------------
    await ctx.emitProgress(jobId, 'Checking maintenance tasks cache', 60);

    const allRegistryIds = equipment
      .map((e) => e.productRegistryId)
      .filter((id): id is string => Boolean(id));

    // Map: productRegistryId → cached tasks
    const cachedByRegistryId = new Map<string, MaintenanceTaskItem[]>();

    if (allRegistryIds.length > 0) {
      const { data: cachedRows } = await supabase
        .from('product_maintenance_tasks')
        .select(
          'product_registry_id, title, description, category, priority, recurrence, estimated_hours',
        )
        .in('product_registry_id', allRegistryIds);

      if (cachedRows) {
        for (const row of cachedRows) {
          const existing = cachedByRegistryId.get(row.product_registry_id) ?? [];
          existing.push({
            equipmentIndex: null, // resolved when building final list
            title: row.title,
            description: row.description,
            category: row.category,
            priority: row.priority,
            recurrence: (row.recurrence as { type: string; interval_days?: number; engine_hours?: number }) ??
              { type: 'time', interval_days: 365 },
            estimated_hours: row.estimated_hours,
          });
          cachedByRegistryId.set(row.product_registry_id, existing);
        }
      }
    }

    // -------------------------------------------------------------------------
    // Phase 2: Generate maintenance tasks for uncached equipment
    // Items to generate for:
    //   • Has productRegistryId but no cache entry yet (will be cached after generation)
    //   • Has no productRegistryId (no cache possible; generate but don't cache)
    // -------------------------------------------------------------------------
    const needsGeneration = equipment.filter((e) => {
      if (!payload.maintenanceCategories.includes(e.category)) return false;
      if (e.productRegistryId && cachedByRegistryId.has(e.productRegistryId)) return false;
      return true;
    });

    let newTasks: MaintenanceTaskItem[] = [];

    if (needsGeneration.length > 0) {
      await ctx.emitProgress(jobId, 'Generating maintenance tasks (not in cache)', 70);
      const maintenancePrompt = buildMaintenancePrompt(needsGeneration, payload.maintenanceCategories);
      const maintenanceText = await callAI(maintenancePrompt, PHASE2_AI_OPTIONS);
      newTasks = parseMaintenanceTasks(maintenanceText);

      // Store new tasks to product_maintenance_tasks cache for future reuse
      const tasksToCache: Array<{
        product_registry_id: string;
        title: string;
        description: string | null;
        category: string;
        priority: string;
        recurrence: unknown;
        estimated_hours: number | null;
        source: string;
      }> = [];

      for (const task of newTasks) {
        if (task.equipmentIndex === null) continue;
        const equip = needsGeneration.find((e) => e.index === task.equipmentIndex);
        if (equip?.productRegistryId) {
          tasksToCache.push({
            product_registry_id: equip.productRegistryId,
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            recurrence: task.recurrence,
            estimated_hours: task.estimated_hours,
            source: 'ai',
          });
        }
      }

      if (tasksToCache.length > 0) {
        const { error: cacheErr } = await supabase
          .from('product_maintenance_tasks')
          .insert(tasksToCache);
        if (cacheErr) {
          console.error(
            '[generate-boat-equipment] Failed to cache maintenance tasks:',
            cacheErr.message,
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // Build final maintenance tasks list: cached tasks + newly generated tasks
    // -------------------------------------------------------------------------
    const allMaintenanceTasks: MaintenanceTaskItem[] = [];

    // Add cached tasks, mapping productRegistryId → equipment index
    for (const equip of equipment) {
      if (!equip.productRegistryId) continue;
      const cached = cachedByRegistryId.get(equip.productRegistryId);
      if (cached) {
        for (const task of cached) {
          allMaintenanceTasks.push({ ...task, equipmentIndex: equip.index });
        }
      }
    }

    // Add newly generated tasks (they already carry the original equipment indices)
    for (const task of newTasks) {
      allMaintenanceTasks.push(task);
    }

    await ctx.emitProgress(jobId, 'Equipment & maintenance ready', 100, undefined, true);

    return {
      equipment,
      maintenanceTasks: allMaintenanceTasks,
    };
  },
};
