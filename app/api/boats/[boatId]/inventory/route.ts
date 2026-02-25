import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { getBoatInventory, createInventoryItem } from '@boat-management/lib/inventory-service';
import type { BoatInventoryInsert } from '@boat-management/lib/types';

/**
 * GET /api/boats/[boatId]/inventory
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boatId: string }> }
) {
  try {
    const { boatId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const inventory = await getBoatInventory(boatId, supabase);
    return NextResponse.json({ data: inventory });
  } catch (error) {
    logger.error('Failed to list inventory', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to list inventory'), { status: 500 });
  }
}

/**
 * POST /api/boats/[boatId]/inventory
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boatId: string }> }
) {
  try {
    const { boatId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: boat } = await supabase
      .from('boats')
      .select('id, owner_id')
      .eq('id', boatId)
      .single();

    if (!boat || boat.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }

    const insertData: BoatInventoryInsert = {
      boat_id: boatId,
      name: body.name,
      category: body.category,
      quantity: body.quantity ?? 0,
      min_quantity: body.min_quantity,
      unit: body.unit,
      location: body.location,
      supplier: body.supplier,
      part_number: body.part_number,
      cost: body.cost,
      currency: body.currency,
      purchase_date: body.purchase_date,
      expiry_date: body.expiry_date,
      notes: body.notes,
      equipment_id: body.equipment_id,
    };

    const item = await createInventoryItem(insertData, supabase);
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create inventory item', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to create inventory item'), { status: 500 });
  }
}
