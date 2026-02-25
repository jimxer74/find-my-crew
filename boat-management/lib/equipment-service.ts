/**
 * Equipment Service - CRUD operations for boat equipment
 */

import { logger } from '@shared/logging';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  BoatEquipment,
  BoatEquipmentInsert,
  BoatEquipmentUpdate,
  EquipmentTreeNode,
} from './types';

/**
 * Fetch all equipment for a boat
 */
export async function getBoatEquipment(
  boatId: string,
  supabase: SupabaseClient
): Promise<BoatEquipment[]> {
  const { data, error } = await supabase
    .from('boat_equipment')
    .select('*')
    .eq('boat_id', boatId)
    .order('category')
    .order('name');

  if (error) {
    logger.error('Failed to fetch boat equipment', { boatId, error: error.message });
    throw error;
  }

  return (data ?? []) as BoatEquipment[];
}

/**
 * Get a single equipment item by ID
 */
export async function getEquipmentById(
  equipmentId: string,
  supabase: SupabaseClient
): Promise<BoatEquipment | null> {
  const { data, error } = await supabase
    .from('boat_equipment')
    .select('*')
    .eq('id', equipmentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to fetch equipment', { equipmentId, error: error.message });
    throw error;
  }

  return data as BoatEquipment;
}

/**
 * Create a new equipment item
 */
export async function createEquipment(
  equipment: BoatEquipmentInsert,
  supabase: SupabaseClient
): Promise<BoatEquipment> {
  const { data, error } = await supabase
    .from('boat_equipment')
    .insert({
      ...equipment,
      specs: equipment.specs ?? {},
      images: equipment.images ?? [],
      status: equipment.status ?? 'active',
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create equipment', { boatId: equipment.boat_id, error: error.message });
    throw error;
  }

  return data as BoatEquipment;
}

/**
 * Update an equipment item
 */
export async function updateEquipment(
  equipmentId: string,
  updates: BoatEquipmentUpdate,
  supabase: SupabaseClient
): Promise<BoatEquipment> {
  const { data, error } = await supabase
    .from('boat_equipment')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', equipmentId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update equipment', { equipmentId, error: error.message });
    throw error;
  }

  return data as BoatEquipment;
}

/**
 * Delete an equipment item
 */
export async function deleteEquipment(
  equipmentId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('boat_equipment')
    .delete()
    .eq('id', equipmentId);

  if (error) {
    logger.error('Failed to delete equipment', { equipmentId, error: error.message });
    throw error;
  }
}

/**
 * Build equipment tree from flat list (parent-child hierarchy)
 */
export function buildEquipmentTree(equipment: BoatEquipment[]): EquipmentTreeNode[] {
  const map = new Map<string, EquipmentTreeNode>();
  const roots: EquipmentTreeNode[] = [];

  // Create nodes
  for (const item of equipment) {
    map.set(item.id, { ...item, children: [] });
  }

  // Build tree
  for (const item of equipment) {
    const node = map.get(item.id)!;
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
