import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';

/**
 * GET /api/legs/by-region
 *
 * Returns legs within a region's bounding box for the crew homepage.
 * Simplified version of the viewport API focused on region-based queries.
 *
 * Query parameters:
 * - min_lng: Minimum longitude (required)
 * - min_lat: Minimum latitude (required)
 * - max_lng: Maximum longitude (required)
 * - max_lat: Maximum latitude (required)
 * - limit: Maximum number of legs to return (optional, default 10)
 * - offset: Pagination offset (optional, default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Extract bbox bounds (required)
    const minLng = searchParams.get('min_lng');
    const minLat = searchParams.get('min_lat');
    const maxLng = searchParams.get('max_lng');
    const maxLat = searchParams.get('max_lat');

    // Validate required parameters
    if (!minLng || !minLat || !maxLng || !maxLat) {
      return NextResponse.json(
        { error: 'Bounding box required: min_lng, min_lat, max_lng, max_lat' },
        { status: 400 }
      );
    }

    // Parse coordinates
    const minLngNum = parseFloat(minLng);
    const minLatNum = parseFloat(minLat);
    const maxLngNum = parseFloat(maxLng);
    const maxLatNum = parseFloat(maxLat);

    if (
      isNaN(minLngNum) || isNaN(minLatNum) || isNaN(maxLngNum) || isNaN(maxLatNum) ||
      minLngNum < -180 || minLngNum > 180 ||
      maxLngNum < -180 || maxLngNum > 180 ||
      minLatNum < -90 || minLatNum > 90 ||
      maxLatNum < -90 || maxLatNum > 90
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Parse pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get Supabase client
    const supabase = await getSupabaseServerClient();

    // Use the viewport RPC function with the region's bbox as both viewport AND departure filter
    // This ensures we get legs that START within this region
    const { data, error } = await supabase.rpc('get_legs_in_viewport', {
      min_lng: minLngNum,
      min_lat: minLatNum,
      max_lng: maxLngNum,
      max_lat: maxLatNum,
      start_date_filter: null,
      end_date_filter: null,
      risk_levels_filter: null,
      skills_filter: null,
      min_experience_level_filter: null,
      // Use the same bbox for departure filter to get legs starting in this region
      departure_min_lng: minLngNum,
      departure_min_lat: minLatNum,
      departure_max_lng: maxLngNum,
      departure_max_lat: maxLatNum,
      arrival_min_lng: null,
      arrival_min_lat: null,
      arrival_max_lng: null,
      arrival_max_lat: null,
    });

    if (error) {
      logger.error('Error calling get_legs_in_viewport:', { error });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Failed to fetch legs'),
        { status: 500 }
      );
    }

    // Normalize skills
    const { normalizeSkillNames } = require('@/app/lib/skillUtils');

    // Transform waypoints from GeoJSON to { lng, lat, name } format
    // Ensure all fields from RPC are preserved, especially journey_risk_level
    const transformedData = (data || []).map((leg: any) => {
      const transformWaypoint = (waypointData: any) => {
        if (!waypointData || !waypointData.coordinates) {
          return null;
        }
        return {
          lng: waypointData.coordinates[0],
          lat: waypointData.coordinates[1],
          name: waypointData.name || null,
        };
      };

      return {
        ...leg,
        // Ensure journey_risk_level is preserved (RPC returns it as array)
        journey_risk_level: leg.journey_risk_level || null,
        // Ensure leg_risk_level field name is consistent
        leg_risk_level: leg.leg_risk_level || leg.risk_level || null,
        skills: normalizeSkillNames(leg.skills || []),
        start_waypoint: transformWaypoint(leg.start_waypoint),
        end_waypoint: transformWaypoint(leg.end_waypoint),
      };
    });

    // Apply pagination
    const paginatedData = transformedData.slice(offset, offset + limit);

    return NextResponse.json({
      legs: paginatedData,
      total: transformedData.length,
      limit,
      offset,
      hasMore: offset + limit < transformedData.length,
    });
  } catch (error: any) {
    logger.error('Unexpected error in by-region API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
