import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { callAI } from '@shared/ai/service';
import { parseJsonArrayFromAIResponse } from '@shared/ai/shared';
import { logger } from '@shared/logging';

const EQUIPMENT_CATEGORIES = [
  'engine', 'rigging', 'electrical', 'navigation', 'safety',
  'plumbing', 'anchoring', 'hull_deck', 'electronics', 'galley', 'comfort', 'dinghy',
] as const;

const SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
  engine:      ['engine', 'fuel_system', 'cooling', 'gearbox', 'propeller', 'alternator', 'exhaust'],
  rigging:     ['mast', 'boom', 'standing_rigging', 'running_rigging', 'winches', 'sails', 'furlers'],
  electrical:  ['batteries', 'solar', 'wind_generator', 'shore_power', 'wiring', 'inverter', 'charger'],
  navigation:  ['gps', 'chartplotter', 'radar', 'ais', 'compass', 'autopilot', 'instruments'],
  safety:      ['life_raft', 'life_jackets', 'epirb', 'flares', 'fire_extinguishers', 'jacklines'],
  plumbing:    ['freshwater', 'watermaker', 'bilge_pumps', 'heads', 'holding_tank'],
  anchoring:   ['anchors', 'chain', 'windlass'],
  hull_deck:   ['hull', 'keel', 'rudder', 'hatches', 'ports', 'teak_deck'],
  electronics: ['vhf_radio', 'ssb', 'satellite_phone', 'wifi'],
  galley:      ['stove', 'oven', 'refrigeration', 'provisions'],
  comfort:     ['heating', 'ventilation', 'lighting', 'cushions'],
  dinghy:      ['dinghy', 'outboard', 'davits'],
};

/**
 * POST /api/product-registry/ai-search
 * AI-driven marine equipment search.
 * Returns up to 5 matching products and saves them to product_registry.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { manufacturer, model, additionalText } = body;

    if (!manufacturer?.trim() && !model?.trim() && !additionalText?.trim()) {
      return NextResponse.json(
        { error: 'At least one of manufacturer, model, or additional search text is required' },
        { status: 400 }
      );
    }

    const prompt = buildSearchPrompt(manufacturer, model, additionalText);

    logger.debug('[product-ai-search] Calling AI', { manufacturer, model, additionalText });

    const result = await callAI({ useCase: 'product-search', prompt });

    let products: any[] = [];
    try {
      products = parseJsonArrayFromAIResponse(result.text) ?? [];
    } catch {
      logger.warn('[product-ai-search] Failed to parse AI response as JSON array', { text: result.text });
      return NextResponse.json({ products: [], message: 'AI returned no structured results' });
    }

    // Validate and sanitize each product
    const valid = products
      .slice(0, 5)
      .map(p => sanitizeProduct(p))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Save to product_registry (ON CONFLICT DO NOTHING — don't overwrite existing curated entries)
    if (valid.length > 0) {
      const rows = valid.map(p => ({
        category: p.category,
        subcategory: p.subcategory ?? null,
        manufacturer: p.manufacturer,
        model: p.model,
        description: p.description ?? null,
        variants: p.variants ?? [],
        specs: p.specs ?? {},
        manufacturer_url: p.manufacturer_url ?? null,
        documentation_links: p.documentation_links ?? [],
        spare_parts_links: p.spare_parts_links ?? [],
        is_verified: true,       // AI-curated = verified
        submitted_by: null,       // AI-sourced, not user-submitted
      }));

      const { error: insertError } = await supabase
        .from('product_registry')
        .upsert(rows, { onConflict: 'manufacturer,model', ignoreDuplicates: true });

      if (insertError) {
        logger.warn('[product-ai-search] Failed to save products to registry', { error: insertError.message });
      } else {
        logger.debug('[product-ai-search] Saved products to registry', { count: rows.length });
      }

      // Fetch the saved records to get their IDs
      const { data: saved } = await supabase
        .from('product_registry')
        .select('*')
        .in('manufacturer', valid.map(p => p.manufacturer))
        .in('model', valid.map(p => p.model));

      if (saved && saved.length > 0) {
        return NextResponse.json({ products: saved });
      }
    }

    return NextResponse.json({ products: valid });
  } catch (error: any) {
    logger.error('[product-ai-search] Error', { error: error.message ?? error });
    return NextResponse.json({ error: 'Search failed', products: [] }, { status: 500 });
  }
}

function buildSearchPrompt(manufacturer?: string, model?: string, additionalText?: string): string {
  const mfr = manufacturer?.trim() || '(not specified)';
  const mdl = model?.trim() || '(not specified)';
  const extra = additionalText?.trim() || '(none)';

  const categoryList = EQUIPMENT_CATEGORIES.join(' | ');
  const subcategoryLines = Object.entries(SUBCATEGORIES_BY_CATEGORY)
    .map(([cat, subs]) => `  ${cat}: ${subs.join(', ')}`)
    .join('\n');

  return `You are a marine equipment expert. Search for information about sailing/motor boat equipment and return structured product data.

Search parameters:
- Manufacturer: ${mfr}
- Model/Name: ${mdl}
- Additional context: ${extra}

Return a JSON array of up to 5 real products that match the search. Use this exact structure:
[
  {
    "manufacturer": "Exact manufacturer name",
    "model": "Exact model name/number",
    "category": "one of: ${categoryList}",
    "subcategory": "specific subcategory (see list below)",
    "description": "One clear sentence describing the product",
    "variants": ["variant 1", "variant 2"],
    "specs": {"hp": 27, "cooling": "heat-exchanger"},
    "manufacturer_url": "https://official-product-page-or-null",
    "documentation_links": [{"title": "Manual Name", "url": "https://verified-url"}],
    "spare_parts_links": [{"region": "global", "title": "Source name", "url": "https://verified-url"}]
  }
]

Valid subcategories by category:
${subcategoryLines}

IMPORTANT:
- Only return products that ACTUALLY EXIST — never invent products
- For URLs in documentation_links and spare_parts_links: only include URLs you are highly confident are real and working; omit any URL you are uncertain about
- specs should contain relevant technical data (hp, voltage_v, capacity_ah, screen_inches, etc.)
- Return [] if no matching real products found
- Maximum 5 products
- Response must be valid JSON only — no additional text`;
}

function sanitizeProduct(p: any): {
  manufacturer: string;
  model: string;
  category: string;
  subcategory?: string;
  description?: string;
  variants?: string[];
  specs?: Record<string, any>;
  manufacturer_url?: string;
  documentation_links?: { title: string; url: string }[];
  spare_parts_links?: { region: string; title: string; url: string }[];
} | null {
  if (!p || typeof p !== 'object') return null;
  if (!p.manufacturer?.trim() || !p.model?.trim()) return null;
  if (!EQUIPMENT_CATEGORIES.includes(p.category)) return null;

  const validSubs = SUBCATEGORIES_BY_CATEGORY[p.category] ?? [];
  const subcategory = validSubs.includes(p.subcategory) ? p.subcategory : validSubs[0];

  const documentation_links = Array.isArray(p.documentation_links)
    ? p.documentation_links.filter((l: any) => l?.title && l?.url && isUrl(l.url))
    : [];

  const spare_parts_links = Array.isArray(p.spare_parts_links)
    ? p.spare_parts_links.filter((l: any) => l?.title && l?.url && isUrl(l.url))
        .map((l: any) => ({ region: l.region ?? 'global', title: l.title, url: l.url }))
    : [];

  return {
    manufacturer: p.manufacturer.trim(),
    model: p.model.trim(),
    category: p.category,
    subcategory,
    description: typeof p.description === 'string' ? p.description.trim() : undefined,
    variants: Array.isArray(p.variants) ? p.variants.filter((v: any) => typeof v === 'string') : [],
    specs: typeof p.specs === 'object' && !Array.isArray(p.specs) ? p.specs : {},
    manufacturer_url: typeof p.manufacturer_url === 'string' && isUrl(p.manufacturer_url) ? p.manufacturer_url : undefined,
    documentation_links,
    spare_parts_links,
  };
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
