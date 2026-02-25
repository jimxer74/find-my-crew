import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { getMaintenanceTemplates } from '@boat-management/lib/maintenance-service';

/**
 * GET /api/boats/[boatId]/maintenance/templates
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

    const templates = await getMaintenanceTemplates(boatId, supabase);
    return NextResponse.json({ data: templates });
  } catch (error) {
    logger.error('Failed to list maintenance templates', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(sanitizeErrorResponse(error, 'Failed to list templates'), { status: 500 });
  }
}
