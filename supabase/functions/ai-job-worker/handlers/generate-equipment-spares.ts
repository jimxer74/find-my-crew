/**
 * Handler: generate-equipment-spares
 *
 * Generates a recommended spare parts list for a single piece of equipment.
 * Uses the product_spare_parts cache: if parts exist for the product registry
 * entry, return them directly. Otherwise calls AI to generate and caches the result.
 *
 * Returns: { spareParts: SparePartItem[] }
 */

import { callAI } from '../../_shared/ai-client.ts';
import { supabase } from '../../_shared/job-helpers.ts';
import type { JobHandler, HandlerContext } from '../../_shared/types.ts';

// ---------------------------------------------------------------------------
// AI configuration
// ---------------------------------------------------------------------------

const AI_OPTIONS = {
  model: 'openrouter/auto:online',
  maxTokens: 3000,
  temperature: 0.1,
  systemPrompt:
    'You are a marine spare parts expert. Generate accurate spare parts lists based on ' +
    'manufacturer service manuals and known best practices for the specific equipment. ' +
    'Only include parts documented in official service literature. OMIT any part you cannot verify.',
};

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

interface GenerateEquipmentSparesPayload {
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

interface SparePartItem {
  name: string;
  part_number: string | null;
  category: string;
  description: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
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

const VALID_UNITS = ['pieces', 'liters', 'meters', 'kg', 'sets', 'rolls', 'bottles', 'cans'];

function buildPrompt(payload: GenerateEquipmentSparesPayload): string {
  const { equipmentName, category, subcategory, manufacturer, model, yearInstalled, boatMakeModel } = payload;

  const equipDesc = [
    manufacturer && model ? `${manufacturer} ${model}` : equipmentName,
    subcategory ? `(${subcategory})` : null,
    yearInstalled ? `installed ${yearInstalled}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return `TASK: Generate a recommended on-board spare parts list for the following marine equipment.

EQUIPMENT: ${equipDesc}
CATEGORY: ${category}
BOAT: ${boatMakeModel}

RULES (CRITICAL):
1. ONLY include parts listed in the manufacturer's service manual or spare parts catalogue.
2. DO NOT invent parts. OMIT anything you cannot verify from official documentation.
3. Include OEM part numbers where known.
4. quantity = recommended on-board quantity to carry as spare.
5. unit must be one of: pieces, liters, meters, kg, sets, rolls, bottles, cans
6. Focus on consumables and wear items that fail at sea (filters, impellers, belts, zincs, etc.)

Return ONLY valid JSON with no extra text or markdown fences:
{
  "spareParts": [
    {
      "name": "Engine Oil Filter",
      "part_number": "119305-35151",
      "category": "engine",
      "description": "Primary oil filter for scheduled oil changes.",
      "quantity": 2,
      "unit": "pieces",
      "notes": "Replace every 150 engine hours or annually."
    }
  ]
}`;
}

function parseParts(text: string): SparePartItem[] {
  const raw = JSON.parse(extractJson(text));
  if (!Array.isArray(raw.spareParts)) return [];

  return raw.spareParts.map((part: Record<string, unknown>) => ({
    name: String(part.name ?? 'Spare Part'),
    part_number: part.part_number ? String(part.part_number) : null,
    category: String(part.category ?? 'engine'),
    description: part.description ? String(part.description) : null,
    quantity: typeof part.quantity === 'number' && part.quantity > 0 ? Math.round(part.quantity) : 1,
    unit: VALID_UNITS.includes(String(part.unit)) ? String(part.unit) : 'pieces',
    notes: part.notes ? String(part.notes) : null,
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
    const payload = rawPayload as unknown as GenerateEquipmentSparesPayload;

    await ctx.emitProgress(jobId, 'Checking spare parts cache', 15);

    // -------------------------------------------------------------------------
    // If no productRegistryId but manufacturer+model are known, try to find or
    // create a product_registry entry and link the equipment to it.
    // -------------------------------------------------------------------------
    let effectiveProductRegistryId = payload.productRegistryId;

    if (!effectiveProductRegistryId && payload.manufacturer && payload.model) {
      const { data: existing } = await supabase
        .from('product_registry')
        .select('id')
        .eq('manufacturer', payload.manufacturer)
        .eq('model', payload.model)
        .maybeSingle();

      if (existing) {
        effectiveProductRegistryId = existing.id;
      } else {
        const { data: created } = await supabase
          .from('product_registry')
          .insert({
            category: payload.category,
            subcategory: payload.subcategory ?? null,
            manufacturer: payload.manufacturer,
            model: payload.model,
          })
          .select('id')
          .single();

        if (created) effectiveProductRegistryId = created.id;
      }

      if (effectiveProductRegistryId) {
        await supabase
          .from('boat_equipment')
          .update({ product_registry_id: effectiveProductRegistryId })
          .eq('id', payload.equipmentId);
      }
    }

    // -------------------------------------------------------------------------
    // Check product_spare_parts cache
    // -------------------------------------------------------------------------
    if (effectiveProductRegistryId) {
      const { data: cachedRows } = await supabase
        .from('product_spare_parts')
        .select('name, part_number, category, description, quantity, unit, notes')
        .eq('product_registry_id', effectiveProductRegistryId);

      if (cachedRows && cachedRows.length > 0) {
        await ctx.emitProgress(jobId, 'Found cached spare parts', 100, undefined, true);
        return { spareParts: cachedRows };
      }
    }

    // -------------------------------------------------------------------------
    // No cache — generate via AI
    // -------------------------------------------------------------------------
    await ctx.emitProgress(jobId, 'Generating spare parts list with AI (15–45 seconds)', 25);
    const prompt = buildPrompt(payload);
    const text = await callAI(prompt, AI_OPTIONS);

    await ctx.emitProgress(jobId, 'Processing results', 85);
    const spareParts = parseParts(text);

    // -------------------------------------------------------------------------
    // Cache the generated parts for future reuse
    // -------------------------------------------------------------------------
    if (effectiveProductRegistryId && spareParts.length > 0) {
      const { error: cacheErr } = await supabase
        .from('product_spare_parts')
        .insert(
          spareParts.map((part) => ({
            product_registry_id: effectiveProductRegistryId,
            name: part.name,
            part_number: part.part_number ?? null,
            category: part.category,
            description: part.description ?? null,
            quantity: part.quantity,
            unit: part.unit,
            notes: part.notes ?? null,
            source: 'ai',
          })),
        );

      if (cacheErr) {
        console.error('[generate-equipment-spares] Cache write error:', cacheErr.message);
      }
    }

    await ctx.emitProgress(jobId, 'Spare parts list ready', 100, undefined, true);

    return { spareParts };
  },
};
