import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';

/**
 * GET /api/skipper/[ownerId]/profile
 *
 * Returns the skipper's profile, boat summary, safety equipment, and maintenance summary.
 * Access is restricted to authenticated crew with at least one Approved registration
 * on a leg owned by this skipper.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const ownerId = resolvedParams.ownerId;

    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Access check: caller must have an Approved registration on a leg
    // that belongs to a journey on one of the skipper's boats.
    const { data: accessCheck } = await supabase
      .from('registrations')
      .select(`
        id,
        status,
        legs!inner (
          id,
          journeys!inner (
            id,
            boats!inner (
              owner_id
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'Approved')
      .limit(100);

    const hasAccess = (accessCheck || []).some((reg: any) => {
      const legs = reg.legs as any;
      return legs?.journeys?.boats?.owner_id === ownerId;
    });

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied. You must have an approved registration with this skipper.' },
        { status: 403 }
      );
    }

    // Fetch skipper's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        username,
        profile_image_url,
        user_description,
        certifications,
        sailing_preferences,
        skills,
        sailing_experience,
        risk_level
      `)
      .eq('id', ownerId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Skipper not found' }, { status: 404 });
    }

    // Fetch skipper's boat(s)
    const { data: boats } = await supabase
      .from('boats')
      .select(`
        id,
        name,
        type,
        make_model,
        year_built,
        loa_m,
        capacity,
        home_port,
        country_flag,
        images,
        miles_on_vessel,
        offshore_passage_experience,
        characteristics,
        capabilities,
        accommodations
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    const primaryBoat = boats?.[0] ?? null;

    // Fetch safety equipment for primary boat
    let safetyEquipment: any[] = [];
    if (primaryBoat) {
      const { data: equipment } = await supabase
        .from('boat_equipment')
        .select('id, name, subcategory, status, service_date, next_service_date, expiry_date')
        .eq('boat_id', primaryBoat.id)
        .eq('category', 'safety')
        .eq('status', 'active')
        .order('name');

      safetyEquipment = equipment ?? [];
    }

    // Fetch maintenance summary for primary boat (non-template tasks)
    let maintenanceSummary: {
      open_count: number;
      overdue_count: number;
      last_completed_date: string | null;
      upcoming_by_category: Record<string, number>;
    } = {
      open_count: 0,
      overdue_count: 0,
      last_completed_date: null,
      upcoming_by_category: {},
    };

    if (primaryBoat) {
      const { data: tasks } = await supabase
        .from('boat_maintenance_tasks')
        .select('id, status, category, due_date, completed_at')
        .eq('boat_id', primaryBoat.id)
        .eq('is_template', false);

      if (tasks) {
        const today = new Date().toISOString().split('T')[0];
        let lastCompletedDate: string | null = null;
        const upcomingByCategory: Record<string, number> = {};

        for (const task of tasks) {
          if (task.status === 'pending' || task.status === 'in_progress') {
            maintenanceSummary.open_count++;
            if (task.due_date && task.due_date < today) {
              maintenanceSummary.overdue_count++;
            } else if (task.due_date) {
              upcomingByCategory[task.category] = (upcomingByCategory[task.category] ?? 0) + 1;
            }
          }
          if (task.status === 'completed' && task.completed_at) {
            if (!lastCompletedDate || task.completed_at > lastCompletedDate) {
              lastCompletedDate = task.completed_at;
            }
          }
        }

        maintenanceSummary.last_completed_date = lastCompletedDate;
        maintenanceSummary.upcoming_by_category = upcomingByCategory;
      }
    }

    logger.info('[SkipperProfileAPI] Returning profile for:', { ownerId });

    return NextResponse.json({
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        username: profile.username,
        profile_image_url: profile.profile_image_url,
        user_description: profile.user_description,
        certifications: profile.certifications,
        sailing_preferences: profile.sailing_preferences,
        skills: profile.skills ?? [],
        sailing_experience: profile.sailing_experience,
        risk_level: profile.risk_level ?? [],
      },
      boat: primaryBoat
        ? {
            id: primaryBoat.id,
            name: primaryBoat.name,
            type: primaryBoat.type,
            make_model: primaryBoat.make_model,
            year_built: primaryBoat.year_built,
            loa_m: primaryBoat.loa_m,
            capacity: primaryBoat.capacity,
            home_port: primaryBoat.home_port,
            country_flag: primaryBoat.country_flag,
            images: primaryBoat.images ?? [],
            miles_on_vessel: primaryBoat.miles_on_vessel,
            offshore_passage_experience: primaryBoat.offshore_passage_experience,
            characteristics: primaryBoat.characteristics,
            capabilities: primaryBoat.capabilities,
            accommodations: primaryBoat.accommodations,
          }
        : null,
      safety_equipment: safetyEquipment,
      maintenance_summary: maintenanceSummary,
    });
  } catch (error: any) {
    logger.error('[SkipperProfileAPI] Unexpected error:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
