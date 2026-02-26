import { getSupabaseBrowserClient } from '@shared/database/client';
import type { ProductRegistryEntry, ProductRegistryInsert } from './types';

/**
 * Search the product registry by query string and optional category filter.
 * Returns up to 10 results ordered by verification status then name.
 */
export async function searchProducts(
  query: string,
  category?: string
): Promise<ProductRegistryEntry[]> {
  const supabase = getSupabaseBrowserClient();

  let q = supabase
    .from('product_registry')
    .select('*')
    .order('is_verified', { ascending: false })
    .order('manufacturer', { ascending: true })
    .order('model', { ascending: true })
    .limit(10);

  if (category) {
    q = q.eq('category', category);
  }

  if (query.trim()) {
    q = q.or(
      `manufacturer.ilike.%${query}%,model.ilike.%${query}%,description.ilike.%${query}%`
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProductRegistryEntry[];
}

/**
 * Fetch a single product registry entry by ID.
 */
export async function getProductById(id: string): Promise<ProductRegistryEntry | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('product_registry')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as ProductRegistryEntry | null;
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
    .select('*')
    .single();

  if (error) {
    // Conflict: entry already exists — fetch and return it
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('product_registry')
        .select('*')
        .eq('manufacturer', data.manufacturer)
        .eq('model', data.model)
        .single();
      if (existing) return existing as ProductRegistryEntry;
    }
    throw error;
  }

  return created as ProductRegistryEntry;
}
