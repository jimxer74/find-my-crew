import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';

const REGISTRY_COLUMNS =
  'id, category, subcategory, manufacturer, model, description, variants, specs, is_verified';

/**
 * Converts a raw user query into a PostgreSQL prefix tsquery.
 * e.g. "yan 3ym" → "yan:* & 3ym:*"
 */
function buildPrefixTsQuery(raw: string): string | null {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/[^a-zA-Z0-9\-]/g, ''))
    .filter(t => t.length >= 1);
  if (tokens.length === 0) return null;
  return tokens.map(t => `${t}:*`).join(' & ');
}

/**
 * GET /api/product-registry?q=&category=
 * Search the product registry. Accessible without authentication.
 * Uses FTS prefix matching on the stored search_vector GIN index.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';
    const category = searchParams.get('category') ?? '';

    const supabase = await getSupabaseServerClient();

    let query = supabase
      .from('product_registry')
      .select(REGISTRY_COLUMNS)
      .order('is_verified', { ascending: false })
      .order('manufacturer', { ascending: true })
      .order('model', { ascending: true })
      .limit(10);

    if (category) {
      query = query.eq('category', category);
    }

    if (q.trim()) {
      const tsQuery = buildPrefixTsQuery(q);
      if (tsQuery) {
        query = query.textSearch('search_vector', tsQuery, { config: 'english' });
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/product-registry
 * Submit a new product to the registry. Requires authentication.
 * On duplicate (same manufacturer + model), returns the existing entry.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category, subcategory, manufacturer, model, description, variants, specs, manufacturer_url } = body;

    if (!category || !manufacturer?.trim() || !model?.trim()) {
      return NextResponse.json(
        { error: 'category, manufacturer and model are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('product_registry')
      .insert({
        category,
        subcategory: subcategory ?? null,
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        description: description?.trim() ?? null,
        variants: variants ?? [],
        specs: specs ?? {},
        manufacturer_url: manufacturer_url?.trim() ?? null,
        documentation_links: [],
        spare_parts_links: [],
        is_verified: false,
        submitted_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      // Conflict: entry already exists — fetch and return it
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('product_registry')
          .select('*')
          .eq('manufacturer', manufacturer.trim())
          .eq('model', model.trim())
          .single();
        if (existing) {
          return NextResponse.json({ product: existing });
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
