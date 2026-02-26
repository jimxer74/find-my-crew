import { getSupabaseBrowserClient } from '@shared/database/client';
import type { ProductRegistryEntry, ProductRegistryInsert } from './types';

// Explicit column list — excludes the internal search_vector tsvector column
const REGISTRY_COLUMNS =
  'id, category, subcategory, manufacturer, model, description, variants, specs, ' +
  'manufacturer_url, documentation_links, spare_parts_links, is_verified, submitted_by, ' +
  'created_at, updated_at';

/**
 * Converts a raw user query string into a PostgreSQL prefix tsquery.
 * e.g. "yan 3ym" → "yan:* & 3ym:*"
 * Returns null if the query contains no usable tokens.
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
 * Search the product registry by query string and optional category filter.
 * Uses the stored search_vector GIN index via FTS prefix matching.
 * Returns up to 10 results ordered by verification status then name.
 */
export async function searchProducts(
  query: string,
  category?: string
): Promise<ProductRegistryEntry[]> {
  const supabase = getSupabaseBrowserClient();

  let q = supabase
    .from('product_registry')
    .select(REGISTRY_COLUMNS)
    .order('is_verified', { ascending: false })
    .order('manufacturer', { ascending: true })
    .order('model', { ascending: true })
    .limit(10);

  if (category) {
    q = q.eq('category', category);
  }

  if (query.trim()) {
    const tsQuery = buildPrefixTsQuery(query);
    if (tsQuery) {
      q = q.textSearch('search_vector', tsQuery, { config: 'english' });
    }
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ProductRegistryEntry[];
}

/**
 * Fetch a single product registry entry by ID.
 */
export async function getProductById(id: string): Promise<ProductRegistryEntry | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('product_registry')
    .select(REGISTRY_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ProductRegistryEntry | null;
}

/**
 * Submit a new product to the registry.
 * On conflict (same manufacturer + model), returns the existing entry instead of erroring.
 */
export async function createProduct(
  data: ProductRegistryInsert
): Promise<ProductRegistryEntry> {
  const supabase = getSupabaseBrowserClient();
  const { data: created, error } = await supabase
    .from('product_registry')
    .insert({
      ...data,
      documentation_links: data.documentation_links ?? [],
      spare_parts_links: data.spare_parts_links ?? [],
      variants: data.variants ?? [],
      specs: data.specs ?? {},
    })
    .select(REGISTRY_COLUMNS)
    .single();

  if (error) {
    // Conflict: entry already exists — fetch and return it
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('product_registry')
        .select(REGISTRY_COLUMNS)
        .eq('manufacturer', data.manufacturer)
        .eq('model', data.model)
        .single();
      if (existing) return existing as unknown as ProductRegistryEntry;
    }
    throw error;
  }

  return created as unknown as ProductRegistryEntry;
}
