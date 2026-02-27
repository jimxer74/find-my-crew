/**
 * Boat Registry Service
 *
 * Provides caching layer for boat specifications fetched from external sources.
 * Reduces external API calls and improves performance by storing boat model data
 * in a local registry table.
 */

import { logger } from '@shared/logging';
import { SupabaseClient } from '@supabase/supabase-js';
import { SailboatDetails } from '@/app/lib/sailboatdata_queries';
import { getSupabaseUnauthenticatedClient, getSupabaseServiceRoleClient } from '@shared/database/server';

export interface BoatRegistryEntry {
  id: string;
  make_model: string;
  slug: string | null;
  type: string | null;
  capacity: number | null;
  loa_m: number | null;
  beam_m: number | null;
  max_draft_m: number | null;
  displcmt_m: number | null;
  average_speed_knots: number | null;
  link_to_specs: string | null;
  characteristics: string | null;
  capabilities: string | null;
  accommodations: string | null;
  sa_displ_ratio: number | null;
  ballast_displ_ratio: number | null;
  displ_len_ratio: number | null;
  comfort_ratio: number | null;
  capsize_screening: number | null;
  hull_speed_knots: number | null;
  ppi_pounds_per_inch: number | null;
  fetch_count: number;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Lookup boat data in registry by make_model (and optionally slug)
 * Uses unauthenticated client since registry is public read-only data
 */
export async function lookupBoatRegistry(
  makeModel: string,
  slug?: string
): Promise<BoatRegistryEntry | null> {
  const supabase = getSupabaseUnauthenticatedClient();
  
  // Try slug first if provided (more specific)
  if (slug && slug.trim()) {
    const { data, error } = await supabase
      .from('boat_registry')
      .select('*')
      .eq('slug', slug.trim())
      .single();
    
    if (!error && data) {
      return data as BoatRegistryEntry;
    }
  }
  
  // Fallback to make_model lookup — normalize to uppercase to match how saveBoatRegistry stores values
  const { data, error } = await supabase
    .from('boat_registry')
    .select('*')
    .eq('make_model', makeModel.trim().toUpperCase())
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data as BoatRegistryEntry;
}

/**
 * Increment fetch_count for a registry entry (track usage)
 */
export async function incrementRegistryFetchCount(entryId: string): Promise<void> {
  const supabase = getSupabaseServiceRoleClient();
  
  // Get current count
  const { data: current } = await supabase
    .from('boat_registry')
    .select('fetch_count')
    .eq('id', entryId)
    .single();
  
  if (current) {
    await supabase
      .from('boat_registry')
      .update({ 
        fetch_count: (current.fetch_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId);
  }
}

/**
 * Save or update boat data in registry
 * Uses service role client to bypass RLS for system-managed data
 */
export async function saveBoatRegistry(
  makeModel: string,
  boatData: SailboatDetails,
  slug?: string
): Promise<BoatRegistryEntry> {
  const supabase = getSupabaseServiceRoleClient();
  
  // Normalize make_model to uppercase for consistent lookups
  const normalizedMakeModel = makeModel.trim().toUpperCase();
  
  const registryData = {
    make_model: normalizedMakeModel,
    slug: slug?.trim() || null,
    type: boatData.type || null,
    capacity: boatData.capacity ?? null,
    loa_m: boatData.loa_m ?? null,
    beam_m: boatData.beam_m ?? null,
    max_draft_m: boatData.max_draft_m ?? null,
    displcmt_m: boatData.displcmt_m ?? null,
    average_speed_knots: boatData.average_speed_knots ?? null,
    link_to_specs: boatData.link_to_specs || null,
    // Trim whitespace and use null if empty string
    characteristics: boatData.characteristics?.trim() || null,
    capabilities: boatData.capabilities?.trim() || null,
    accommodations: boatData.accommodations?.trim() || null,
    sa_displ_ratio: boatData.sa_displ_ratio ?? null,
    ballast_displ_ratio: boatData.ballast_displ_ratio ?? null,
    displ_len_ratio: boatData.displ_len_ratio ?? null,
    comfort_ratio: boatData.comfort_ratio ?? null,
    capsize_screening: boatData.capsize_screening ?? null,
    hull_speed_knots: boatData.hull_speed_knots ?? null,
    ppi_pounds_per_inch: boatData.ppi_pounds_per_inch ?? null,
    updated_at: new Date().toISOString(),
    last_fetched_at: new Date().toISOString(),
  };
  
  // Try to find existing entry
  const { data: existing } = await supabase
    .from('boat_registry')
    .select('id, fetch_count, characteristics, capabilities, accommodations')
    .eq('make_model', normalizedMakeModel)
    .single();
  
  if (existing) {
    // Preserve existing descriptive fields if new data doesn't have them
    // These fields are often populated by AI and shouldn't be overwritten with null
    const updateData = {
      ...registryData,
      // Only update descriptive fields if new data actually has values
      characteristics: boatData.characteristics?.trim() || existing.characteristics || null,
      capabilities: boatData.capabilities?.trim() || existing.capabilities || null,
      accommodations: boatData.accommodations?.trim() || existing.accommodations || null,
      fetch_count: (existing.fetch_count || 0) + 1, // Increment on update too
    };
    
    // Update existing entry
    const { data, error } = await supabase
      .from('boat_registry')
      .update(updateData)
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) {
      logger.error('Failed to update boat registry:', { error: error?.message || String(error) });
      throw error;
    }
    return data as BoatRegistryEntry;
  } else {
    // Insert new entry
    const { data, error } = await supabase
      .from('boat_registry')
      .insert({
        ...registryData,
        fetch_count: 1,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Failed to insert boat registry:', { error: error?.message || String(error) });
      throw error;
    }
    return data as BoatRegistryEntry;
  }
}

/**
 * Update descriptive fields (characteristics, capabilities, accommodations) in registry
 * Only updates if new values are provided and non-empty
 */
export async function updateRegistryDescriptiveFields(
  makeModel: string,
  fields: {
    characteristics?: string;
    capabilities?: string;
    accommodations?: string;
  }
): Promise<void> {
  const supabase = getSupabaseServiceRoleClient();
  
  // Build update object with only non-empty fields
  const updateData: Partial<BoatRegistryEntry> = {
    updated_at: new Date().toISOString(),
  };
  
  if (fields.characteristics?.trim()) {
    updateData.characteristics = fields.characteristics.trim();
  }
  if (fields.capabilities?.trim()) {
    updateData.capabilities = fields.capabilities.trim();
  }
  if (fields.accommodations?.trim()) {
    updateData.accommodations = fields.accommodations.trim();
  }
  
  // Only update if we have at least one field to update
  if (Object.keys(updateData).length <= 1) {
    return; // Only updated_at, nothing else to update
  }
  
  // Find existing entry — normalize make_model to uppercase to match how saveBoatRegistry stores values
  const { data: existing } = await supabase
    .from('boat_registry')
    .select('id')
    .eq('make_model', makeModel.trim().toUpperCase())
    .single();
  
  if (existing) {
    await supabase
      .from('boat_registry')
      .update(updateData)
      .eq('id', existing.id);
    
    logger.debug(`✅ Updated descriptive fields in registry for: ${makeModel}`);
  } else {
    logger.warn(`⚠️ Cannot update registry - entry not found for: ${makeModel}`);
  }
}

/**
 * Convert registry entry to SailboatDetails format
 */
export function registryToSailboatDetails(entry: BoatRegistryEntry): SailboatDetails {
  return {
    make_model: entry.make_model,
    type: entry.type as any,
    capacity: entry.capacity,
    loa_m: entry.loa_m,
    beam_m: entry.beam_m,
    max_draft_m: entry.max_draft_m,
    displcmt_m: entry.displcmt_m,
    average_speed_knots: entry.average_speed_knots,
    link_to_specs: entry.link_to_specs || undefined,
    characteristics: entry.characteristics || undefined,
    capabilities: entry.capabilities || undefined,
    accommodations: entry.accommodations || undefined,
    sa_displ_ratio: entry.sa_displ_ratio,
    ballast_displ_ratio: entry.ballast_displ_ratio,
    displ_len_ratio: entry.displ_len_ratio,
    comfort_ratio: entry.comfort_ratio,
    capsize_screening: entry.capsize_screening,
    hull_speed_knots: entry.hull_speed_knots,
    ppi_pounds_per_inch: entry.ppi_pounds_per_inch,
  };
}
