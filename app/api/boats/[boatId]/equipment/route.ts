import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { getBoatEquipment, createEquipment } from '@boat-management/lib/equipment-service';
import type { BoatEquipmentInsert } from '@boat-management/lib/types';

/**
 * GET /api/boats/[boatId]/equipment
 * List all equipment for a boat
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

    const equipment = await getBoatEquipment(boatId, supabase);
    return NextResponse.json({ data: equipment });
  } catch (error) {
    logger.error('Failed to list equipment', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to list equipment'), { status: 500 });
  }
}

/**
 * POST /api/boats/[boatId]/equipment
 * Create new equipment for a boat
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

    // Verify boat ownership
    const { data: boat, error: boatError } = await supabase
      .from('boats')
      .select('id, owner_id')
      .eq('id', boatId)
      .single();

    if (boatError || !boat) {
      return NextResponse.json({ error: 'Boat not found' }, { status: 404 });
    }
    if (boat.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, category, subcategory, manufacturer, model, serial_number, year_installed, specs, notes, images, status, parent_id, product_registry_id, quantity } = body;

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category are required' }, { status: 400 });
    }

    const insertData: BoatEquipmentInsert = {
      boat_id: boatId,
      name,
      category,
      subcategory,
      manufacturer,
      model,
      serial_number,
      year_installed,
      specs,
      notes,
      images,
      status,
      parent_id,
      product_registry_id: product_registry_id ?? null,
      quantity: typeof quantity === 'number' && quantity >= 1 ? quantity : 1,
    };

    const equipment = await createEquipment(insertData, supabase);
    return NextResponse.json({ data: equipment }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create equipment', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to create equipment'), { status: 500 });
  }
}
