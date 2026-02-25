import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import {
  getMaintenanceTaskById,
  updateMaintenanceTask,
  deleteMaintenanceTask,
} from '@boat-management/lib/maintenance-service';
import type { BoatMaintenanceTaskUpdate } from '@boat-management/lib/types';

type RouteParams = { params: Promise<{ boatId: string; taskId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const task = await getMaintenanceTaskById(taskId, supabase);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ data: task });
  } catch (error) {
    logger.error('Failed to get maintenance task', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to get maintenance task'), { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { boatId, taskId } = await params;
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
    const updates: BoatMaintenanceTaskUpdate = {};
    const allowedFields: (keyof BoatMaintenanceTaskUpdate)[] = [
      'title', 'description', 'category', 'priority', 'status',
      'equipment_id', 'recurrence', 'due_date', 'assigned_to',
      'estimated_hours', 'actual_hours', 'estimated_cost', 'actual_cost',
      'instructions', 'parts_needed', 'notes', 'images_before', 'images_after',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updates as any)[field] = body[field];
      }
    }

    const task = await updateMaintenanceTask(taskId, updates, supabase);
    return NextResponse.json({ data: task });
  } catch (error) {
    logger.error('Failed to update maintenance task', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to update maintenance task'), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { boatId, taskId } = await params;
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

    await deleteMaintenanceTask(taskId, supabase);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete maintenance task', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to delete maintenance task'), { status: 500 });
  }
}
