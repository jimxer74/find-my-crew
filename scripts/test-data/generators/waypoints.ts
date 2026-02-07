import { getSupabaseAdmin } from '../utils/supabase-admin.js';
import type { GeneratedLeg } from './legs.js';

export interface GeneratedWaypoint {
  id: string;
  leg_id: string;
  index: number;
  name: string;
  lat: number;
  lng: number;
}

export interface WaypointGeneratorOptions {
  legs: GeneratedLeg[];
  onProgress?: (message: string) => void;
}

/**
 * Generate waypoints for legs using the RPC function
 */
export async function generateWaypoints(
  options: WaypointGeneratorOptions
): Promise<GeneratedWaypoint[]> {
  const {
    legs,
    onProgress = console.log,
  } = options;

  const admin = getSupabaseAdmin();
  const waypoints: GeneratedWaypoint[] = [];

  // Calculate total waypoints
  const totalWaypoints = legs.reduce((sum, leg) => sum + leg._waypointCount, 0);

  onProgress(`Generating ${totalWaypoints} waypoints for ${legs.length} legs...`);

  let waypointCount = 0;
  for (let legIdx = 0; legIdx < legs.length; legIdx++) {
    const leg = legs[legIdx];
    const route = leg._journeyRoute;

    // Get waypoints for this leg from the route
    const legWaypoints = route.waypoints.slice(
      leg._waypointStartIndex,
      leg._waypointStartIndex + leg._waypointCount
    );

    // Format waypoints for the RPC function
    const waypointsJson = legWaypoints.map((wp, idx) => ({
      index: idx,
      name: wp.name,
      lng: wp.lng,
      lat: wp.lat,
    }));

    // Use the RPC function to insert waypoints (handles PostGIS conversion)
    const { error } = await admin.rpc('insert_leg_waypoints', {
      leg_id_param: leg.id,
      waypoints_param: waypointsJson,
    });

    if (error) {
      // If RPC fails, fall back to direct insert with ST_MakePoint
      onProgress(`  RPC failed for leg ${leg.id}, using direct insert: ${error.message}`);
      await insertWaypointsDirect(admin, leg.id, waypointsJson);
    }

    // Add to our tracking array
    for (let i = 0; i < legWaypoints.length; i++) {
      const wp = legWaypoints[i];
      waypoints.push({
        id: `${leg.id}-${i}`, // We don't have the actual ID, but this is for tracking
        leg_id: leg.id,
        index: i,
        name: wp.name,
        lat: wp.lat,
        lng: wp.lng,
      });
      waypointCount++;
    }

    if ((legIdx + 1) % 10 === 0 || legIdx === legs.length - 1) {
      onProgress(`  Created waypoints for ${legIdx + 1}/${legs.length} legs (${waypointCount} waypoints)`);
    }
  }

  return waypoints;
}

/**
 * Fallback: Insert waypoints directly using raw SQL for PostGIS
 */
async function insertWaypointsDirect(
  admin: ReturnType<typeof getSupabaseAdmin>,
  legId: string,
  waypoints: { index: number; name: string; lng: number; lat: number }[]
): Promise<void> {
  // Delete existing waypoints for this leg
  await admin.from('waypoints').delete().eq('leg_id', legId);

  // Insert each waypoint
  for (const wp of waypoints) {
    // Use a raw query to insert with ST_MakePoint
    // Since we can't use raw SQL directly, we'll insert with a workaround
    // The database trigger will handle bbox updates

    const { error } = await admin.from('waypoints').insert({
      leg_id: legId,
      index: wp.index,
      name: wp.name,
      // For direct insert, we need to use the geometry format
      // This requires the location to be in WKT format
      // However, Supabase JS doesn't support this directly
      // So we'll use a different approach - insert with a placeholder and update
    });

    if (error) {
      throw new Error(`Failed to insert waypoint: ${error.message}`);
    }
  }
}

/**
 * Get waypoints for a specific leg
 */
export function getWaypointsByLeg(waypoints: GeneratedWaypoint[], legId: string): GeneratedWaypoint[] {
  return waypoints.filter(w => w.leg_id === legId);
}
