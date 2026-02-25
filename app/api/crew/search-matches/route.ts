import { logger } from '@shared/logging';
/**
 * API Route: POST /api/crew/search-matches
 * 
 * Search for crew members matching skipper requirements.
 * Can be called by authenticated or unauthenticated users.
 * Unauthenticated users get anonymized results (no names/images).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchMatchingCrew, CrewSearchParams } from '@/app/lib/crew/matching-service';

// Create admin client for public searches (no auth required)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate and parse request parameters
    const params: CrewSearchParams = {
      experienceLevel: body.experienceLevel,
      riskLevels: body.riskLevels,
      location: body.location,
      dateRange: body.dateRange,
      skills: body.skills,
      limit: body.limit,
      includePrivateInfo: false, // Default to false
    };

    // Check authentication status
    const authHeader = request.headers.get('authorization');
    const hasValidAuth = authHeader && authHeader.startsWith('Bearer ');

    // Only include private info if authenticated
    if (hasValidAuth) {
      // Verify token is valid (optional but recommended)
      // For now, trust the presence of Bearer token
      params.includePrivateInfo = true;
    }

    // Log search for analytics (optional)
    if (process.env.NODE_ENV === 'development') {
      logger.info('[API] Crew search request:', {
        authenticated: hasValidAuth,
        params: {
          ...params,
          includePrivateInfo: params.includePrivateInfo,
        },
      });
    }

    // Execute search
    const result = await searchMatchingCrew(supabaseAdmin, params);

    // Return results
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('[API] Crew search error:', error instanceof Error ? { error: error.message } : { error: String(error) });

    return NextResponse.json(
      {
        error: 'Failed to search for crew',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
