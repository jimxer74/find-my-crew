/**
 * Inventory Service - CRUD operations for boat spare parts and inventory
 */

import { logger } from '@shared/logging';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  BoatInventory,
  BoatInventoryInsert,
  BoatInventoryUpdate,
} from './types';

/**
 * Fetch all inventory items for a boat
 */
export async function getBoatInventory(
  boatId: string,
  supabase: SupabaseClient
): Promise<BoatInventory[]> {
  const { data, error } = await supabase
    .from('boat_inventory')
    .select('*')
    .eq('boat_id', boatId)
    .order('category')
    .order('name');

  if (error) {
    logger.error('Failed to fetch boat inventory', { boatId, error: error.message });
    throw error;
  }

  return (data ?? []) as BoatInventory[];
}

/**
 * Get a single inventory item by ID
 */
export async function getInventoryById(
  itemId: string,
  supabase: SupabaseClient
): Promise<BoatInventory | null> {
  const { data, error } = await supabase
    .from('boat_inventory')
    .select('*')
    .eq('id', itemId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    logger.error('Failed to fetch inventory item', { itemId, error: error.message });
    throw error;
  }

  return data as BoatInventory;
}

/**
 * Create a new inventory item
 */
export async function createInventoryItem(
  item: BoatInventoryInsert,
  supabase: SupabaseClient
): Promise<BoatInventory> {
  const { data, error } = await supabase
    .from('boat_inventory')
    .insert({
      ...item,
      min_quantity: item.min_quantity ?? 0,
      currency: item.currency ?? 'EUR',
      images: item.images ?? [],
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create inventory item', { boatId: item.boat_id, error: error.message });
    throw error;
  }

  return data as BoatInventory;
}

/**
 * Update an inventory item
 */
export async function updateInventoryItem(
  itemId: string,
  updates: BoatInventoryUpdate,
  supabase: SupabaseClient
): Promise<BoatInventory> {
  const { data, error } = await supabase
    .from('boat_inventory')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to update inventory item', { itemId, error: error.message });
    throw error;
  }

  return data as BoatInventory;
}

/**
 * Delete an inventory item
 */
export async function deleteInventoryItem(
  itemId: string,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('boat_inventory')
    .delete()
    .eq('id', itemId);

  if (error) {
    logger.error('Failed to delete inventory item', { itemId, error: error.message });
    throw error;
  }
}

/**
 * Get low-stock items for a boat (quantity <= min_quantity)
 */
export async function getLowStockItems(
  boatId: string,
  supabase: SupabaseClient
): Promise<BoatInventory[]> {
  const { data, error } = await supabase
    .from('boat_inventory')
    .select('*')
    .eq('boat_id', boatId)
    .filter('quantity', 'lte', 'min_quantity')
    .order('name');

  if (error) {
    logger.error('Failed to fetch low-stock items', { boatId, error: error.message });
    throw error;
  }

  // Filter in JS since Supabase doesn't support column-to-column comparison in .filter()
  const allItems = (data ?? []) as BoatInventory[];
  return allItems.filter(item => item.quantity <= item.min_quantity && item.min_quantity > 0);
}

/**
 * Deduct inventory quantity (e.g., when completing a maintenance task)
 */
export async function deductInventory(
  itemId: string,
  quantity: number,
  supabase: SupabaseClient
): Promise<BoatInventory> {
  // Fetch current quantity
  const item = await getInventoryById(itemId, supabase);
  if (!item) {
    throw new Error(`Inventory item not found: ${itemId}`);
  }

  const newQuantity = Math.max(0, item.quantity - quantity);

  const { data, error } = await supabase
    .from('boat_inventory')
    .update({
      quantity: newQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    logger.error('Failed to deduct inventory', { itemId, quantity, error: error.message });
    throw error;
  }

  return data as BoatInventory;
}
