import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { getInventoryById, updateInventoryItem, deleteInventoryItem } from '@boat-management/lib/inventory-service';
import type { BoatInventoryUpdate } from '@boat-management/lib/types';

type RouteParams = { params: Promise<{ boatId: string; itemId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const item = await getInventoryById(itemId, supabase);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch (error) {
    logger.error('Failed to get inventory item', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to get inventory item'), { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { boatId, itemId } = await params;
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
    const updates: BoatInventoryUpdate = {};
    const allowedFields: (keyof BoatInventoryUpdate)[] = [
      'name', 'category', 'quantity', 'min_quantity', 'unit', 'location',
      'supplier', 'part_number', 'cost', 'currency', 'purchase_date',
      'expiry_date', 'notes', 'equipment_id',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updates as any)[field] = body[field];
      }
    }

    const item = await updateInventoryItem(itemId, updates, supabase);
    return NextResponse.json({ data: item });
  } catch (error) {
    logger.error('Failed to update inventory item', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to update inventory item'), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { boatId, itemId } = await params;
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

    await deleteInventoryItem(itemId, supabase);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete inventory item', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to delete inventory item'), { status: 500 });
  }
}
