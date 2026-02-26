import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import {
  getEquipmentById,
  updateEquipment,
  deleteEquipment,
} from '@boat-management/lib/equipment-service';
import type { BoatEquipmentUpdate } from '@boat-management/lib/types';

type RouteParams = { params: Promise<{ boatId: string; equipmentId: string }> };

/**
 * GET /api/boats/[boatId]/equipment/[equipmentId]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { equipmentId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const equipment = await getEquipmentById(equipmentId, supabase);
    if (!equipment) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    return NextResponse.json({ data: equipment });
  } catch (error) {
    logger.error('Failed to get equipment', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to get equipment'), { status: 500 });
  }
}

/**
 * PUT /api/boats/[boatId]/equipment/[equipmentId]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { boatId, equipmentId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify boat ownership
    const { data: boat } = await supabase
      .from('boats')
      .select('id, owner_id')
      .eq('id', boatId)
      .single();

    if (!boat || boat.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const updates: BoatEquipmentUpdate = {};

    const allowedFields: (keyof BoatEquipmentUpdate)[] = [
      'name', 'category', 'subcategory', 'manufacturer', 'model',
      'serial_number', 'year_installed', 'specs', 'notes', 'images',
      'status', 'parent_id', 'product_registry_id',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updates as any)[field] = body[field];
      }
    }

    const equipment = await updateEquipment(equipmentId, updates, supabase);
    return NextResponse.json({ data: equipment });
  } catch (error) {
    logger.error('Failed to update equipment', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to update equipment'), { status: 500 });
  }
}

/**
 * DELETE /api/boats/[boatId]/equipment/[equipmentId]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { boatId, equipmentId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify boat ownership
    const { data: boat } = await supabase
      .from('boats')
      .select('id, owner_id')
      .eq('id', boatId)
      .single();

    if (!boat || boat.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await deleteEquipment(equipmentId, supabase);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete equipment', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to delete equipment'), { status: 500 });
  }
}
