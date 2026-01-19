import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * GET /api/legs/viewport
 * 
 * Returns legs within a viewport for crew browsing.
 * Uses PostGIS bbox for efficient geospatial queries.
 * 
 * Query parameters:
 * - min_lng: Minimum longitude (required)
 * - min_lat: Minimum latitude (required)
 * - max_lng: Maximum longitude (required)
 * - max_lat: Maximum latitude (required)
 * - start_date: Filter legs starting on or after this date (optional, YYYY-MM-DD)
 * - end_date: Filter legs ending on or before this date (optional, YYYY-MM-DD)
 * - risk_levels: Comma-separated risk levels to filter (optional, e.g., "Coastal sailing,Offshore sailing")
 * - skills: Comma-separated skills to filter (optional, e.g., "First Aid,Navigation")
 * - min_experience_level: User's experience level for matching (optional, integer 1-4)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Extract viewport bounds (required)
    const minLng = searchParams.get('min_lng');
    const minLat = searchParams.get('min_lat');
    const maxLng = searchParams.get('max_lng');
    const maxLat = searchParams.get('max_lat');

    // Validate required parameters
    if (!minLng || !minLat || !maxLng || !maxLat) {
      return NextResponse.json(
        { error: 'Viewport bounds are required: min_lng, min_lat, max_lng, max_lat' },
        { status: 400 }
      );
    }

    // Parse and validate coordinates
    const minLngNum = parseFloat(minLng);
    const minLatNum = parseFloat(minLat);
    const maxLngNum = parseFloat(maxLng);
    const maxLatNum = parseFloat(maxLat);

    if (
      isNaN(minLngNum) || isNaN(minLatNum) || isNaN(maxLngNum) || isNaN(maxLatNum) ||
      minLngNum < -180 || minLngNum > 180 ||
      maxLngNum < -180 || maxLngNum > 180 ||
      minLatNum < -90 || minLatNum > 90 ||
      maxLatNum < -90 || maxLatNum > 90 ||
      minLngNum >= maxLngNum ||
      minLatNum >= maxLatNum
    ) {
      return NextResponse.json(
        { error: 'Invalid viewport bounds. Coordinates must be valid numbers within valid ranges, and min < max' },
        { status: 400 }
      );
    }

    // Extract optional filters
    const startDateFilter = searchParams.get('start_date') || null;
    const endDateFilter = searchParams.get('end_date') || null;
    const riskLevelsParam = searchParams.get('risk_levels');
    const skillsParam = searchParams.get('skills');
    const minExperienceLevelParam = searchParams.get('min_experience_level');

    // Parse risk levels (comma-separated string to array)
    let riskLevelsFilter: string[] | null = null;
    if (riskLevelsParam) {
      riskLevelsFilter = riskLevelsParam
        .split(',')
        .map(level => level.trim())
        .filter(level => level.length > 0);
      // Validate risk levels
      const validRiskLevels = ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'];
      const invalidLevels = riskLevelsFilter.filter(level => !validRiskLevels.includes(level));
      if (invalidLevels.length > 0) {
        return NextResponse.json(
          { error: `Invalid risk levels: ${invalidLevels.join(', ')}. Valid values: ${validRiskLevels.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Parse skills (comma-separated string to array)
    let skillsFilter: string[] | null = null;
    if (skillsParam) {
      skillsFilter = skillsParam
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
    }

    // Parse experience level (integer 1-4)
    let minExperienceLevelFilter: number | null = null;
    if (minExperienceLevelParam) {
      const parsedLevel = parseInt(minExperienceLevelParam, 10);
      if (!isNaN(parsedLevel) && parsedLevel >= 1 && parsedLevel <= 4) {
        minExperienceLevelFilter = parsedLevel;
      } else {
        return NextResponse.json(
          { error: 'Invalid min_experience_level. Must be an integer between 1 and 4.' },
          { status: 400 }
        );
      }
    }

    // Validate date formats if provided
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    if (startDateFilter) {
      startDate = new Date(startDateFilter);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid start_date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
    }

    if (endDateFilter) {
      endDate = new Date(endDateFilter);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid end_date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
    }

    // Get Supabase client
    const supabase = await getSupabaseServerClient();

    // Call RPC function
    const { data, error } = await supabase.rpc('get_legs_in_viewport', {
      min_lng: minLngNum,
      min_lat: minLatNum,
      max_lng: maxLngNum,
      max_lat: maxLatNum,
      start_date_filter: startDateFilter ? startDateFilter : null,
      end_date_filter: endDateFilter ? endDateFilter : null,
      risk_levels_filter: riskLevelsFilter,
      skills_filter: skillsFilter && skillsFilter.length > 0 ? skillsFilter : null,
      min_experience_level_filter: minExperienceLevelFilter,
    });

    if (error) {
      console.error('Error calling get_legs_in_viewport:', error);
      return NextResponse.json(
        { error: 'Failed to fetch legs', details: error.message },
        { status: 500 }
      );
    }

    // Transform waypoints from GeoJSON to { lng, lat, name } format
    const transformedData = (data || []).map((leg: any) => {
      const transformWaypoint = (waypointData: any) => {
        if (!waypointData || !waypointData.coordinates) {
          return null;
        }
        // Coordinates format: [lng, lat]
        return {
          lng: waypointData.coordinates[0],
          lat: waypointData.coordinates[1],
          name: waypointData.name || null,
        };
      };

      return {
        ...leg,
        start_waypoint: transformWaypoint(leg.start_waypoint),
        end_waypoint: transformWaypoint(leg.end_waypoint),
      };
    });

    return NextResponse.json({
      legs: transformedData,
      count: transformedData.length,
    });
  } catch (error: any) {
    console.error('Unexpected error in viewport API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
