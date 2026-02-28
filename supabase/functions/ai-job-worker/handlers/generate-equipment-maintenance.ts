/**
 * Handler: generate-equipment-maintenance
 *
 * Generates maintenance tasks for a single piece of equipment that was just added.
 * Uses the product_maintenance_tasks cache: if tasks exist for the product registry entry,
 * return them directly. Otherwise calls AI to generate and caches the result.
 *
 * Returns: { maintenanceTasks: MaintenanceTaskItem[] }
 */

import { callAI } from '../../_shared/ai-client.ts';
import { supabase } from '../../_shared/job-helpers.ts';
import type { JobHandler, HandlerContext } from '../../_shared/types.ts';

// ---------------------------------------------------------------------------
// AI configuration
// ---------------------------------------------------------------------------

const AI_OPTIONS = {
  model: 'openai/gpt-4o-mini',
  maxTokens: 4000,
  temperature: 0.1,
  systemPrompt:
    'You are a marine maintenance expert. Generate accurate maintenance schedules based on ' +
    'manufacturer service manuals and known best practices for the specific equipment. ' +
    'Only include tasks with documented service intervals. OMIT any task you cannot verify.',
};

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

interface GenerateEquipmentMaintenancePayload {
  boatId: string;
  equipmentId: string;
  equipmentName: string;
  category: string;
  subcategory: string | null;
  manufacturer: string | null;
  model: string | null;
  yearInstalled: number | null;
  productRegistryId: string | null;
  boatMakeModel: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface MaintenanceTaskItem {
  title: string;
  description: string | null;
  category: string;
  priority: string;
  recurrence: { type: string; interval_days?: number; engine_hours?: number };
  estimated_hours: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

function buildPrompt(payload: GenerateEquipmentMaintenancePayload): string {
  const { equipmentName, category, subcategory, manufacturer, model, yearInstalled, boatMakeModel } = payload;

  const equipDesc = [
    manufacturer && model ? `${manufacturer} ${model}` : equipmentName,
    subcategory ? `(${subcategory})` : null,
    yearInstalled ? `installed ${yearInstalled}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return `TASK: Generate maintenance tasks for the following marine equipment.

EQUIPMENT: ${equipDesc}
CATEGORY: ${category}
BOAT: ${boatMakeModel}

RULES (CRITICAL):
1. ONLY include tasks described in owner's manuals or service docs for this specific equipment.
2. DO NOT invent tasks. OMIT anything you cannot verify.
3. Intervals must come from actual documentation — do not guess.
4. category must be one of: routine, seasonal, repair, inspection, safety
5. priority must be one of: low, medium, high, critical
6. recurrence.type must be "time" (use interval_days) or "usage" (use engine_hours)

Return ONLY valid JSON with no extra text or markdown fences:
{
  "maintenanceTasks": [
    {
      "title": "Engine Oil & Filter Change",
      "description": "Change engine oil and oil filter per manufacturer service manual.",
      "category": "routine",
      "priority": "high",
      "recurrence": { "type": "usage", "engine_hours": 150 },
      "estimated_hours": 1.5
    }
  ]
}`;
}

function parseTasks(text: string): MaintenanceTaskItem[] {
  const raw = JSON.parse(extractJson(text));
  if (!Array.isArray(raw.maintenanceTasks)) return [];

  const VALID_CATS = ['routine', 'seasonal', 'repair', 'inspection', 'safety'];
  const VALID_PRIS = ['low', 'medium', 'high', 'critical'];

  return raw.maintenanceTasks.map((task: Record<string, unknown>) => ({
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
    const payload = rawPayload as unknown as GenerateEquipmentMaintenancePayload;

    await ctx.emitProgress(jobId, 'Checking maintenance task cache', 15);

    // -------------------------------------------------------------------------
    // Check product_maintenance_tasks cache if we have a product registry entry
    // -------------------------------------------------------------------------
    if (payload.productRegistryId) {
      const { data: cachedRows } = await supabase
        .from('product_maintenance_tasks')
        .select('title, description, category, priority, recurrence, estimated_hours')
        .eq('product_registry_id', payload.productRegistryId);

      if (cachedRows && cachedRows.length > 0) {
        await ctx.emitProgress(jobId, 'Found cached maintenance tasks', 100, undefined, true);
        return {
          maintenanceTasks: cachedRows.map((row) => ({
            title: row.title,
            description: row.description,
            category: row.category,
            priority: row.priority,
            recurrence: row.recurrence ?? { type: 'time', interval_days: 365 },
            estimated_hours: row.estimated_hours,
          })),
        };
      }
    }

    // -------------------------------------------------------------------------
    // No cache — generate via AI
    // -------------------------------------------------------------------------
    await ctx.emitProgress(jobId, 'Generating maintenance tasks with AI (15–45 seconds)', 25);
    const prompt = buildPrompt(payload);
    const text = await callAI(prompt, AI_OPTIONS);

    await ctx.emitProgress(jobId, 'Processing results', 85);
    const maintenanceTasks = parseTasks(text);

    // -------------------------------------------------------------------------
    // Cache the generated tasks for future reuse if linked to product registry
    // -------------------------------------------------------------------------
    if (payload.productRegistryId && maintenanceTasks.length > 0) {
      const { error: cacheErr } = await supabase
        .from('product_maintenance_tasks')
        .insert(
          maintenanceTasks.map((task) => ({
            product_registry_id: payload.productRegistryId,
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            recurrence: task.recurrence,
            estimated_hours: task.estimated_hours,
            source: 'ai',
          })),
        );

      if (cacheErr) {
        console.error('[generate-equipment-maintenance] Cache write error:', cacheErr.message);
      }
    }

    await ctx.emitProgress(jobId, 'Maintenance tasks ready', 100, undefined, true);

    return { maintenanceTasks };
  },
};
