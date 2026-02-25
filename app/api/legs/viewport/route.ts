import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';

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
 *
 * Location filters (two modes - direct bbox takes priority over center point):
 * Mode 1 - Direct bbox (for cruising regions with predefined boundaries):
 * - departure_min_lng, departure_min_lat, departure_max_lng, departure_max_lat
 * - arrival_min_lng, arrival_min_lat, arrival_max_lng, arrival_max_lat
 *
 * Mode 2 - Center point (API calculates ±1° bbox):
 * - departure_lat, departure_lng
 * - arrival_lat, arrival_lng
 */

// Margin in degrees for location bounding box (~111km at equator)
const LOCATION_MARGIN_DEGREES = 1.0;
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

    // Extract location filter parameters
    // Support both direct bbox (for cruising regions) and center point (for regular locations)
    const departureLatParam = searchParams.get('departure_lat');
    const departureLngParam = searchParams.get('departure_lng');
    const arrivalLatParam = searchParams.get('arrival_lat');
    const arrivalLngParam = searchParams.get('arrival_lng');

    // Direct bbox parameters (used for cruising regions with predefined bounding boxes)
    const departureMinLngParam = searchParams.get('departure_min_lng');
    const departureMinLatParam = searchParams.get('departure_min_lat');
    const departureMaxLngParam = searchParams.get('departure_max_lng');
    const departureMaxLatParam = searchParams.get('departure_max_lat');
    const arrivalMinLngParam = searchParams.get('arrival_min_lng');
    const arrivalMinLatParam = searchParams.get('arrival_min_lat');
    const arrivalMaxLngParam = searchParams.get('arrival_max_lng');
    const arrivalMaxLatParam = searchParams.get('arrival_max_lat');

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

    // Calculate departure location bounding box
    // Priority: direct bbox params > center point with margin
    let departureBbox: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    } | null = null;

    // Check for direct bbox first (cruising regions)
    if (departureMinLngParam && departureMinLatParam && departureMaxLngParam && departureMaxLatParam) {
      const minLng = parseFloat(departureMinLngParam);
      const minLat = parseFloat(departureMinLatParam);
      const maxLng = parseFloat(departureMaxLngParam);
      const maxLat = parseFloat(departureMaxLatParam);

      if (!isNaN(minLng) && !isNaN(minLat) && !isNaN(maxLng) && !isNaN(maxLat)) {
        departureBbox = { minLng, minLat, maxLng, maxLat };
        // Clamp latitude to valid range
        departureBbox.minLat = Math.max(-90, departureBbox.minLat);
        departureBbox.maxLat = Math.min(90, departureBbox.maxLat);
      }
    }
    // Fall back to center point with margin (regular locations)
    else if (departureLatParam && departureLngParam) {
      const departureLat = parseFloat(departureLatParam);
      const departureLng = parseFloat(departureLngParam);

      if (
        !isNaN(departureLat) &&
        !isNaN(departureLng) &&
        departureLat >= -90 &&
        departureLat <= 90 &&
        departureLng >= -180 &&
        departureLng <= 180
      ) {
        departureBbox = {
          minLng: departureLng - LOCATION_MARGIN_DEGREES,
          minLat: departureLat - LOCATION_MARGIN_DEGREES,
          maxLng: departureLng + LOCATION_MARGIN_DEGREES,
          maxLat: departureLat + LOCATION_MARGIN_DEGREES,
        };
        // Clamp latitude to valid range
        departureBbox.minLat = Math.max(-90, departureBbox.minLat);
        departureBbox.maxLat = Math.min(90, departureBbox.maxLat);
      }
    }

    // Calculate arrival location bounding box
    // Priority: direct bbox params > center point with margin
    let arrivalBbox: {
      minLng: number;
      minLat: number;
      maxLng: number;
      maxLat: number;
    } | null = null;

    // Check for direct bbox first (cruising regions)
    if (arrivalMinLngParam && arrivalMinLatParam && arrivalMaxLngParam && arrivalMaxLatParam) {
      const minLng = parseFloat(arrivalMinLngParam);
      const minLat = parseFloat(arrivalMinLatParam);
      const maxLng = parseFloat(arrivalMaxLngParam);
      const maxLat = parseFloat(arrivalMaxLatParam);

      if (!isNaN(minLng) && !isNaN(minLat) && !isNaN(maxLng) && !isNaN(maxLat)) {
        arrivalBbox = { minLng, minLat, maxLng, maxLat };
        // Clamp latitude to valid range
        arrivalBbox.minLat = Math.max(-90, arrivalBbox.minLat);
        arrivalBbox.maxLat = Math.min(90, arrivalBbox.maxLat);
      }
    }
    // Fall back to center point with margin (regular locations)
    else if (arrivalLatParam && arrivalLngParam) {
      const arrivalLat = parseFloat(arrivalLatParam);
      const arrivalLng = parseFloat(arrivalLngParam);

      if (
        !isNaN(arrivalLat) &&
        !isNaN(arrivalLng) &&
        arrivalLat >= -90 &&
        arrivalLat <= 90 &&
        arrivalLng >= -180 &&
        arrivalLng <= 180
      ) {
        arrivalBbox = {
          minLng: arrivalLng - LOCATION_MARGIN_DEGREES,
          minLat: arrivalLat - LOCATION_MARGIN_DEGREES,
          maxLng: arrivalLng + LOCATION_MARGIN_DEGREES,
          maxLat: arrivalLat + LOCATION_MARGIN_DEGREES,
        };
        // Clamp latitude to valid range
        arrivalBbox.minLat = Math.max(-90, arrivalBbox.minLat);
        arrivalBbox.maxLat = Math.min(90, arrivalBbox.maxLat);
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
      // Location filter bounding boxes
      departure_min_lng: departureBbox?.minLng ?? null,
      departure_min_lat: departureBbox?.minLat ?? null,
      departure_max_lng: departureBbox?.maxLng ?? null,
      departure_max_lat: departureBbox?.maxLat ?? null,
      arrival_min_lng: arrivalBbox?.minLng ?? null,
      arrival_min_lat: arrivalBbox?.minLat ?? null,
      arrival_max_lng: arrivalBbox?.maxLng ?? null,
      arrival_max_lat: arrivalBbox?.maxLat ?? null,
    });

    if (error) {
      logger.error('Error calling get_legs_in_viewport:', { error });
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Failed to fetch legs'),
        { status: 500 }
      );
    }

    // Normalize skills to canonical format (handles both display and canonical formats)
    // This ensures compatibility even if migration hasn't been run yet
    const { normalizeSkillNames } = require('@shared/utils');
    
    // Transform waypoints from GeoJSON to { lng, lat, name } format
    // Also normalize skills to canonical format
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
        skills: normalizeSkillNames(leg.skills || []), // Normalize skills to canonical format
        start_waypoint: transformWaypoint(leg.start_waypoint),
        end_waypoint: transformWaypoint(leg.end_waypoint),
      };
    });

    return NextResponse.json({
      legs: transformedData,
      count: transformedData.length,
    });
  } catch (error: any) {
    logger.error('Unexpected error in viewport API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
