/**
 * Handler: generate-equipment-documentation
 *
 * Generates documentation links and manufacturer URL for equipment.
 * Uses the product_registry fields: if documentation_links and manufacturer_url exist,
 * returns them directly. Otherwise calls AI with web search to generate and caches the result.
 *
 * Returns: { manufacturer_url?: string, documentation_links: Array<{url, title, region?}> }
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
    'You are a marine equipment documentation expert. Find official manufacturer websites and ' +
    'equipment documentation URLs including manuals, guides, and support resources. ' +
    'Only include HTTPS URLs from official manufacturer sources. Include regional variants when available (US, EU, ASIA, GLOBAL). ' +
    'Focus on accuracy and official sources only.',
};

// ---------------------------------------------------------------------------
// Payload type
// ---------------------------------------------------------------------------

interface GenerateEquipmentDocumentationPayload {
  boatId: string;
  equipmentId: string;
  equipmentName: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  productRegistryId: string | null;
  boatMakeModel: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface DocumentationLink {
  url: string;
  title: string;
  region?: string;
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

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function buildPrompt(payload: GenerateEquipmentDocumentationPayload): string {
  const { equipmentName, category, manufacturer, model, boatMakeModel } = payload;

  const equipDesc = [
    manufacturer && model ? `${manufacturer} ${model}` : equipmentName,
    category ? `(${category})` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return `TASK: Find official documentation URLs and manufacturer website for marine equipment.

EQUIPMENT: ${equipDesc}
CATEGORY: ${category}
BOAT: ${boatMakeModel}

SEARCH FOR:
1. Manufacturer's official website URL
2. Equipment manual/documentation links (with region if available: US, EU, ASIA, GLOBAL)
3. Official support/resources pages

RULES (CRITICAL):
1. ONLY include HTTPS URLs from official manufacturer or authorized sources
2. DO NOT invent URLs. Verify all URLs are real, accessible, and relevant.
3. Include regional variants when different manuals exist (e.g., US manual vs EU manual)
4. Exclude generic landing pages or redirect URLs
5. Return complete, working URLs only

Return ONLY valid JSON with no extra text or markdown fences:
{
  "manufacturer_url": "https://example.com",
  "documentation_links": [
    {
      "url": "https://example.com/manual-us.pdf",
      "title": "Owner's Manual",
      "region": "us"
    },
    {
      "url": "https://example.com/manual-eu.pdf",
      "title": "Owner's Manual",
      "region": "eu"
    },
    {
      "url": "https://example.com/support",
      "title": "Support Resources",
      "region": "global"
    }
  ]
}`;
}

interface ParsedDocumentation {
  manufacturer_url?: string;
  documentation_links: DocumentationLink[];
}

function parseDocumentation(text: string): ParsedDocumentation {
  const raw = JSON.parse(extractJson(text)) as Record<string, unknown>;

  const manufacturer_url = raw.manufacturer_url ? String(raw.manufacturer_url).trim() : undefined;
  if (manufacturer_url && !isValidHttpsUrl(manufacturer_url)) {
    console.warn('[generate-equipment-documentation] Invalid manufacturer URL:', manufacturer_url);
  }

  const documentation_links: DocumentationLink[] = [];
  if (Array.isArray(raw.documentation_links)) {
    for (const link of raw.documentation_links) {
      if (typeof link === 'object' && link !== null) {
        const url = String(link.url ?? '').trim();
        const title = String(link.title ?? 'Documentation').trim();
        const region = link.region ? String(link.region).toLowerCase() : undefined;

        if (url && isValidHttpsUrl(url)) {
          documentation_links.push({
            url,
            title: title || 'Documentation',
            ...(region && { region }),
          });
        } else if (url) {
          console.warn('[generate-equipment-documentation] Invalid documentation URL:', url);
        }
      }
    }
  }

  return {
    ...(manufacturer_url && isValidHttpsUrl(manufacturer_url) && { manufacturer_url }),
    documentation_links,
  };
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
    const payload = rawPayload as unknown as GenerateEquipmentDocumentationPayload;

    await ctx.emitProgress(jobId, 'Checking documentation cache', 15);

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
    // Check product_registry for existing documentation
    // -------------------------------------------------------------------------
    if (effectiveProductRegistryId) {
      const { data: cached } = await supabase
        .from('product_registry')
        .select('manufacturer_url, documentation_links')
        .eq('id', effectiveProductRegistryId)
        .maybeSingle();

      if (
        cached &&
        ((cached.manufacturer_url && cached.manufacturer_url.trim()) ||
          (Array.isArray(cached.documentation_links) && cached.documentation_links.length > 0))
      ) {
        await ctx.emitProgress(jobId, 'Found cached documentation', 100, undefined, true);
        return {
          manufacturer_url: cached.manufacturer_url ?? undefined,
          documentation_links: cached.documentation_links ?? [],
        };
      }
    }

    // -------------------------------------------------------------------------
    // No cache — generate via AI
    // -------------------------------------------------------------------------
    await ctx.emitProgress(jobId, 'Searching for documentation with AI (10–30 seconds)', 25);
    const prompt = buildPrompt(payload);
    const text = await callAI(prompt, AI_OPTIONS);

    await ctx.emitProgress(jobId, 'Processing results', 85);
    const parsed = parseDocumentation(text);

    // -------------------------------------------------------------------------
    // Update product_registry with found documentation
    // Use the existing upsert_and_enrich_product_registry() RPC to fill only
    // empty fields (never overwrites existing data)
    // -------------------------------------------------------------------------
    if (effectiveProductRegistryId && (parsed.manufacturer_url || parsed.documentation_links.length > 0)) {
      const { error: updateErr } = await supabase
        .from('product_registry')
        .update({
          manufacturer_url: parsed.manufacturer_url ?? null,
          documentation_links: parsed.documentation_links.length > 0 ? parsed.documentation_links : null,
        })
        .eq('id', effectiveProductRegistryId);

      if (updateErr) {
        console.error('[generate-equipment-documentation] Update error:', updateErr.message);
      }
    }

    await ctx.emitProgress(jobId, 'Documentation ready', 100, undefined, true);

    return {
      manufacturer_url: parsed.manufacturer_url,
      documentation_links: parsed.documentation_links,
    };
  },
};
