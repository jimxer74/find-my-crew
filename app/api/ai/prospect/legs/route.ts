import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[API Prospect Legs Route] ${message}`, data !== undefined ? data : '');
  }
};

export const maxDuration = 30;

/**
 * Request body for prospect leg search
 */
interface ProspectLegsRequest {
  dateRange?: {
    start?: string;
    end?: string;
  };
  locations?: string[];
  riskLevel?: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';
  experienceLevel?: number; // 1-4
  skills?: string[];
  limit?: number;
}

/**
 * Calculate match score based on how well the leg matches preferences
 */
function calculateMatchScore(
  leg: any,
  preferences: ProspectLegsRequest
): number {
  let score = 50; // Base score
  let factors = 0;

  // Date match (if dates specified and leg falls within range)
  if (preferences.dateRange?.start || preferences.dateRange?.end) {
    factors++;
    const legStart = new Date(leg.start_date);
    const legEnd = new Date(leg.end_date);
    const prefStart = preferences.dateRange.start ? new Date(preferences.dateRange.start) : null;
    const prefEnd = preferences.dateRange.end ? new Date(preferences.dateRange.end) : null;

    const startMatch = !prefStart || legStart >= prefStart;
    const endMatch = !prefEnd || legEnd <= prefEnd;

    if (startMatch && endMatch) {
      score += 15;
    } else if (startMatch || endMatch) {
      score += 7;
    }
  }

  // Experience level match
  if (preferences.experienceLevel) {
    factors++;
    const legMinExp = leg.min_experience_level || 1;

    if (preferences.experienceLevel >= legMinExp) {
      // User has enough experience
      score += 15;
    } else if (preferences.experienceLevel >= legMinExp - 1) {
      // User is close to required level
      score += 7;
    }
  }

  // Risk level match
  if (preferences.riskLevel && leg.risk_level) {
    factors++;
    if (leg.risk_level === preferences.riskLevel) {
      score += 15;
    }
  }

  // Location match (basic text matching for now)
  if (preferences.locations && preferences.locations.length > 0 && leg.waypoints) {
    factors++;
    const waypointNames = (leg.waypoints as any[])
      .map((w) => (w.name || '').toLowerCase())
      .join(' ');

    const locationMatches = preferences.locations.some((loc) =>
      waypointNames.includes(loc.toLowerCase())
    );

    if (locationMatches) {
      score += 15;
    }
  }

  // Crew availability bonus (more crew needed = potentially easier to get a spot)
  if (leg.crew_needed >= 3) {
    score += 5;
  } else if (leg.crew_needed >= 2) {
    score += 3;
  }

  // Normalize score to 0-100
  return Math.min(100, Math.max(0, score));
}

/**
 * GET /api/ai/prospect/legs
 *
 * Search for sailing legs matching prospect preferences.
 * No authentication required - only returns published journeys.
 */
export async function GET(request: NextRequest) {
  log('=== GET /api/ai/prospect/legs ===');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { searchParams } = new URL(request.url);

    const preferences: ProspectLegsRequest = {
      dateRange: {
        start: searchParams.get('startDate') || undefined,
        end: searchParams.get('endDate') || undefined,
      },
      locations: searchParams.get('locations')?.split(',').filter(Boolean) || undefined,
      riskLevel: searchParams.get('riskLevel') as any || undefined,
      experienceLevel: searchParams.get('experienceLevel')
        ? parseInt(searchParams.get('experienceLevel')!, 10)
        : undefined,
      skills: searchParams.get('skills')?.split(',').filter(Boolean) || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : 10,
    };

    log('Search preferences:', preferences);

    // Build query for published legs only
    let query = supabase
      .from('legs')
      .select(`
        id,
        name,
        description,
        start_date,
        end_date,
        crew_needed,
        risk_level,
        min_experience_level,
        journeys!inner (
          id,
          name,
          state,
          boats (
            id,
            name,
            type,
            make_model
          )
        ),
        waypoints (
          id,
          index,
          name,
          location
        )
      `)
      .eq('journeys.state', 'Published')
      .gt('crew_needed', 0);

    // Apply date filters
    if (preferences.dateRange?.start) {
      query = query.gte('start_date', preferences.dateRange.start);
    }
    if (preferences.dateRange?.end) {
      query = query.lte('end_date', preferences.dateRange.end);
    }

    // Apply risk level filter
    if (preferences.riskLevel) {
      query = query.eq('risk_level', preferences.riskLevel);
    }

    // Apply experience level filter (legs requiring at most this level)
    if (preferences.experienceLevel) {
      query = query.lte('min_experience_level', preferences.experienceLevel);
    }

    // Order by start date and limit
    query = query.order('start_date', { ascending: true }).limit(preferences.limit || 10);

    const { data: legs, error } = await query;

    if (error) {
      log('Database error:', error);
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Failed to search legs'),
        { status: 500 }
      );
    }

    // Format results with match scores
    const formattedLegs = (legs || []).map((leg: any) => {
      const sortedWaypoints = (leg.waypoints || []).sort((a: any, b: any) => a.index - b.index);
      const departure = sortedWaypoints[0];
      const arrival = sortedWaypoints[sortedWaypoints.length - 1];

      return {
        id: leg.id,
        name: leg.name,
        journeyName: leg.journeys?.name,
        boatName: leg.journeys?.boats?.name,
        boatType: leg.journeys?.boats?.type,
        startDate: leg.start_date,
        endDate: leg.end_date,
        crewNeeded: leg.crew_needed,
        riskLevel: leg.risk_level,
        minExperienceLevel: leg.min_experience_level,
        departureLocation: departure?.name || null,
        arrivalLocation: arrival?.name || null,
        matchScore: calculateMatchScore(leg, preferences),
      };
    });

    // Sort by match score (highest first)
    formattedLegs.sort((a, b) => b.matchScore - a.matchScore);

    log('Found legs:', formattedLegs.length);

    return NextResponse.json({
      legs: formattedLegs,
      total: formattedLegs.length,
    });
  } catch (error: any) {
    log('ERROR:', error.message);
    logger.error('Prospect legs search error:', error);

    return NextResponse.json(
      {
        error: 'Failed to search legs',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/prospect/legs
 *
 * Search for sailing legs with preferences in request body.
 * More flexible than GET for complex preference objects.
 */
export async function POST(request: NextRequest) {
  log('=== POST /api/ai/prospect/legs ===');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const preferences: ProspectLegsRequest = await request.json();
    log('Search preferences:', preferences);

    // Build query for published legs only
    let query = supabase
      .from('legs')
      .select(`
        id,
        name,
        description,
        start_date,
        end_date,
        crew_needed,
        risk_level,
        min_experience_level,
        journeys!inner (
          id,
          name,
          state,
          boats (
            id,
            name,
            type,
            make_model
          )
        ),
        waypoints (
          id,
          index,
          name,
          location
        )
      `)
      .eq('journeys.state', 'Published')
      .gt('crew_needed', 0);

    // Apply date filters
    if (preferences.dateRange?.start) {
      query = query.gte('start_date', preferences.dateRange.start);
    }
    if (preferences.dateRange?.end) {
      query = query.lte('end_date', preferences.dateRange.end);
    }

    // Apply risk level filter
    if (preferences.riskLevel) {
      query = query.eq('risk_level', preferences.riskLevel);
    }

    // Apply experience level filter
    if (preferences.experienceLevel) {
      query = query.lte('min_experience_level', preferences.experienceLevel);
    }

    // Order and limit
    const limit = preferences.limit || 10;
    query = query.order('start_date', { ascending: true }).limit(limit);

    const { data: legs, error } = await query;

    if (error) {
      log('Database error:', error);
      return NextResponse.json(
        sanitizeErrorResponse(error, 'Failed to search legs'),
        { status: 500 }
      );
    }

    // Format results with match scores
    const formattedLegs = (legs || []).map((leg: any) => {
      const sortedWaypoints = (leg.waypoints || []).sort((a: any, b: any) => a.index - b.index);
      const departure = sortedWaypoints[0];
      const arrival = sortedWaypoints[sortedWaypoints.length - 1];

      return {
        id: leg.id,
        name: leg.name,
        journeyName: leg.journeys?.name,
        boatName: leg.journeys?.boats?.name,
        boatType: leg.journeys?.boats?.type,
        startDate: leg.start_date,
        endDate: leg.end_date,
        crewNeeded: leg.crew_needed,
        riskLevel: leg.risk_level,
        minExperienceLevel: leg.min_experience_level,
        departureLocation: departure?.name || null,
        arrivalLocation: arrival?.name || null,
        matchScore: calculateMatchScore(leg, preferences),
      };
    });

    // Sort by match score (highest first)
    formattedLegs.sort((a, b) => b.matchScore - a.matchScore);

    log('Found legs:', formattedLegs.length);

    return NextResponse.json({
      legs: formattedLegs,
      total: formattedLegs.length,
    });
  } catch (error: any) {
    log('ERROR:', error.message);
    logger.error('Prospect legs search error:', error);

    return NextResponse.json(
      {
        error: 'Failed to search legs',
        message: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
