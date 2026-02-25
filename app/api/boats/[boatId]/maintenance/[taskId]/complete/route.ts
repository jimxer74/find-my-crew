import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { completeMaintenanceTask } from '@boat-management/lib/maintenance-service';

type RouteParams = { params: Promise<{ boatId: string; taskId: string }> };

/**
 * POST /api/boats/[boatId]/maintenance/[taskId]/complete
 * Complete a maintenance task with optional inventory deduction
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const task = await completeMaintenanceTask(
      taskId,
      {
        completed_by: user.id,
        actual_hours: body.actual_hours,
        actual_cost: body.actual_cost,
        notes: body.notes,
        images_after: body.images_after,
      },
      supabase
    );

    return NextResponse.json({ data: task });
  } catch (error) {
    logger.error('Failed to complete maintenance task', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to complete maintenance task'), { status: 500 });
  }
}
