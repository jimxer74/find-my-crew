import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * GET /api/legs/[legId]/waypoints
 * 
 * Returns all waypoints for a specific leg, ordered by index.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ legId: string }> | { legId: string } }
) {
  try {
    // Handle both Promise and direct params (for Next.js version compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const legId = resolvedParams.legId;

    console.log('[Waypoints API] Received params:', { params, resolvedParams, legId });

    if (!legId) {
      console.error('[Waypoints API] Leg ID is missing');
      return NextResponse.json(
        { error: 'Leg ID is required' },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    // Fetch waypoints using RPC function that returns GeoJSON
    const { data, error } = await supabase.rpc('get_leg_waypoints', {
      leg_id_param: legId,
    });

    if (error) {
      console.error('Error fetching waypoints:', error);
      return NextResponse.json(
        { error: 'Failed to fetch waypoints', details: error.message },
        { status: 500 }
      );
    }

    // Transform the RPC result - location should be GeoJSON
    const transformedWaypoints = (data || []).map((waypoint: any) => {
      let coordinates: [number, number] | null = null;
      
      if (waypoint.location) {
        // location is GeoJSON from RPC: { type: 'Point', coordinates: [lng, lat] }
        if (waypoint.location.coordinates && Array.isArray(waypoint.location.coordinates)) {
          coordinates = waypoint.location.coordinates as [number, number];
        } else if (typeof waypoint.location === 'string') {
          try {
            const parsed = JSON.parse(waypoint.location);
            if (parsed.coordinates && Array.isArray(parsed.coordinates)) {
              coordinates = parsed.coordinates as [number, number];
            }
          } catch {
            console.warn('Could not parse location:', waypoint.location);
          }
        }
      }

      return {
        id: `waypoint-${waypoint.index}`, // Generate ID from index since RPC doesn't return id
        index: waypoint.index,
        name: waypoint.name || null,
        coordinates: coordinates || null,
      };
    });

    return NextResponse.json({
      waypoints: transformedWaypoints,
      count: transformedWaypoints.length,
    });
  } catch (error: any) {
    console.error('Unexpected error in waypoints API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
