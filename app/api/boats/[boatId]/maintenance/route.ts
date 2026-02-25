import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { getBoatMaintenanceTasks, createMaintenanceTask } from '@boat-management/lib/maintenance-service';
import type { BoatMaintenanceTaskInsert } from '@boat-management/lib/types';

/**
 * GET /api/boats/[boatId]/maintenance
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

    const tasks = await getBoatMaintenanceTasks(boatId, supabase);
    return NextResponse.json({ data: tasks });
  } catch (error) {
    logger.error('Failed to list maintenance tasks', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to list maintenance tasks'), { status: 500 });
  }
}

/**
 * POST /api/boats/[boatId]/maintenance
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
    if (!body.title || !body.category) {
      return NextResponse.json({ error: 'Title and category are required' }, { status: 400 });
    }

    const insertData: BoatMaintenanceTaskInsert = {
      boat_id: boatId,
      title: body.title,
      category: body.category,
      description: body.description,
      priority: body.priority,
      status: body.status,
      equipment_id: body.equipment_id,
      is_template: body.is_template,
      recurrence: body.recurrence,
      due_date: body.due_date,
      assigned_to: body.assigned_to,
      estimated_hours: body.estimated_hours,
      estimated_cost: body.estimated_cost,
      instructions: body.instructions,
      parts_needed: body.parts_needed,
      notes: body.notes,
    };

    const task = await createMaintenanceTask(insertData, supabase);
    return NextResponse.json({ data: task }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create maintenance task', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to create maintenance task'), { status: 500 });
  }
}
