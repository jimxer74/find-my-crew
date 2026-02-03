/**
 * PostGIS Helper Functions
 * Utilities for converting between frontend waypoint format and PostGIS geometry
 */

export type WaypointGeoJSON = {
  index: number;
  geocode: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
  name: string;
};

/**
 * Convert frontend waypoint format to PostGIS ST_MakePoint SQL expression
 * Returns SQL string for use in raw queries: ST_MakePoint(lng, lat)
 */
export function waypointToPostGISSQL(waypoint: WaypointGeoJSON): string {
  const [lng, lat] = waypoint.geocode.coordinates;
  return `ST_MakePoint(${lng}, ${lat})`;
}

/**
 * Convert PostGIS geometry result to frontend waypoint format
 * PostGIS returns geometry as GeoJSON when using ST_AsGeoJSON()
 */
export function postGISToWaypoint(row: {
  index: number;
  name: string | null;
  location: any; // PostGIS geometry (can be GeoJSON string or object)
}): WaypointGeoJSON {
  let coordinates: [number, number];
  
  // Handle different PostGIS return formats
  if (typeof row.location === 'string') {
    // If it's a GeoJSON string, parse it
    const geoJson = JSON.parse(row.location);
    coordinates = geoJson.coordinates as [number, number];
  } else if (row.location?.coordinates) {
    // If it's already a GeoJSON object
    coordinates = row.location.coordinates as [number, number];
  } else if (row.location?.x !== undefined && row.location?.y !== undefined) {
    // If it's a point with x/y properties (some PostGIS clients return this)
    coordinates = [row.location.x, row.location.y];
  } else {
    throw new Error(`Unable to parse PostGIS geometry: ${JSON.stringify(row.location)}`);
  }

  return {
    index: row.index,
    geocode: {
      type: 'Point',
      coordinates: coordinates,
    },
    name: row.name || '',
  };
}

/**
 * Calculate bounding box from array of waypoints
 * Returns SQL expression: ST_Envelope(ST_Collect(...))
 */
export function calculateBboxSQL(waypoints: WaypointGeoJSON[]): string {
  if (waypoints.length === 0) {
    return 'NULL';
  }
  
  const points = waypoints
    .map(wp => {
      const [lng, lat] = wp.geocode.coordinates;
      return `ST_MakePoint(${lng}, ${lat})`;
    })
    .join(', ');
  
  return `ST_Envelope(ST_Collect(ARRAY[${points}]))`;
}

/**
 * Validate coordinate ranges
 */
export function validateCoordinates(lng: number, lat: number): boolean {
  return (
    lng >= -180 && lng <= 180 &&
    lat >= -90 && lat <= 90 &&
    !isNaN(lng) && !isNaN(lat) &&
    isFinite(lng) && isFinite(lat)
  );
}

/**
 * Convert array of waypoints to PostGIS insert values
 * Returns array of objects ready for Supabase insert
 */
export function waypointsToPostGISInsert(waypoints: WaypointGeoJSON[], legId: string): Array<{
  leg_id: string;
  index: number;
  name: string | null;
  location: string; // SQL expression as string for raw query
}> {
  return waypoints.map(wp => {
    const [lng, lat] = wp.geocode.coordinates;

    if (!validateCoordinates(lng, lat)) {
      throw new Error(`Invalid coordinates: lng=${lng}, lat=${lat}`);
    }

    return {
      leg_id: legId,
      index: wp.index,
      name: wp.name || null,
      location: `ST_MakePoint(${lng}, ${lat})`, // Will be used in raw SQL
    };
  });
}

/**
 * Check if two consecutive points cross the antimeridian (180°/-180° longitude)
 * A crossing occurs when one point is in the far east (lng > 90) and the next is in the far west (lng < -90)
 * or vice versa, AND the shortest path would cross the antimeridian rather than go the long way.
 */
export function crossesAntimeridian(lng1: number, lng2: number): boolean {
  // Check if the points are on opposite sides of the antimeridian
  // and the difference suggests crossing at 180° rather than going around
  const diff = Math.abs(lng2 - lng1);
  return diff > 180;
}

/**
 * Calculate the latitude where a line segment crosses the antimeridian
 * Uses linear interpolation between the two points
 */
function interpolateLatAtAntimeridian(
  lng1: number, lat1: number,
  lng2: number, lat2: number
): number {
  // Normalize longitudes for interpolation
  // If crossing from east to west (positive to negative), adjust lng2
  // If crossing from west to east (negative to positive), adjust lng1
  let normalizedLng1 = lng1;
  let normalizedLng2 = lng2;

  if (lng1 > 0 && lng2 < 0) {
    // Crossing from east to west
    normalizedLng2 = lng2 + 360;
  } else if (lng1 < 0 && lng2 > 0) {
    // Crossing from west to east
    normalizedLng1 = lng1 + 360;
  }

  // Find where the line crosses 180° (or 180° + 360° = 540° in normalized space)
  const targetLng = lng1 > 0 ? 180 : 180 + 360;

  // Linear interpolation: lat = lat1 + (lat2 - lat1) * (targetLng - normalizedLng1) / (normalizedLng2 - normalizedLng1)
  const t = (targetLng - normalizedLng1) / (normalizedLng2 - normalizedLng1);
  return lat1 + (lat2 - lat1) * t;
}

/**
 * Split a line that crosses the antimeridian into multiple segments
 * Returns a GeoJSON geometry - either a LineString (no crossing) or MultiLineString (with crossing)
 *
 * When a line crosses the antimeridian, we split it into two segments:
 * - First segment goes from start to the crossing point at +180°
 * - Second segment starts at -180° (same latitude) and continues to the end
 *
 * This ensures Mapbox draws the line correctly across the Pacific instead of
 * wrapping around the entire globe the other way.
 */
export function splitLineAtAntimeridian(
  coordinates: [number, number][]
): GeoJSON.LineString | GeoJSON.MultiLineString {
  if (coordinates.length < 2) {
    return {
      type: 'LineString',
      coordinates: coordinates,
    };
  }

  const segments: [number, number][][] = [];
  let currentSegment: [number, number][] = [coordinates[0]];

  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];

    if (crossesAntimeridian(lng1, lng2)) {
      // Calculate the latitude at the crossing point
      const crossingLat = interpolateLatAtAntimeridian(lng1, lat1, lng2, lat2);

      // End the current segment at the antimeridian
      // Use +180 or -180 depending on which side we're coming from
      const exitLng = lng1 > 0 ? 180 : -180;
      currentSegment.push([exitLng, crossingLat]);
      segments.push(currentSegment);

      // Start a new segment from the other side of the antimeridian
      const entryLng = lng1 > 0 ? -180 : 180;
      currentSegment = [[entryLng, crossingLat], [lng2, lat2]];
    } else {
      currentSegment.push([lng2, lat2]);
    }
  }

  // Add the final segment
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  // Return appropriate geometry type
  if (segments.length === 1) {
    return {
      type: 'LineString',
      coordinates: segments[0],
    };
  } else {
    return {
      type: 'MultiLineString',
      coordinates: segments,
    };
  }
}

/**
 * Create a GeoJSON Feature for a route, handling antimeridian crossing
 * Returns a Feature with either LineString or MultiLineString geometry
 */
export function createRouteFeature(
  coordinates: [number, number][],
  properties: Record<string, any> = {}
): GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString> {
  const geometry = splitLineAtAntimeridian(coordinates);
  return {
    type: 'Feature',
    properties,
    geometry,
  };
}

/**
 * Calculate bounds that correctly handle antimeridian crossing
 * Returns bounds in format [[minLng, minLat], [maxLng, maxLat]]
 * For routes crossing the antimeridian, returns bounds that span across 180°
 */
export function calculateBoundsWithAntimeridian(
  coordinates: [number, number][]
): [[number, number], [number, number]] | null {
  if (coordinates.length === 0) return null;

  const lngs = coordinates.map(c => c[0]);
  const lats = coordinates.map(c => c[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Check if any consecutive points cross the antimeridian
  let crossesDateline = false;
  for (let i = 1; i < coordinates.length; i++) {
    if (crossesAntimeridian(coordinates[i - 1][0], coordinates[i][0])) {
      crossesDateline = true;
      break;
    }
  }

  if (crossesDateline) {
    // For routes crossing the antimeridian, we need special bounds
    // Split longitudes into east (positive) and west (negative) hemispheres
    const eastLngs = lngs.filter(lng => lng > 0);
    const westLngs = lngs.filter(lng => lng < 0);

    if (eastLngs.length > 0 && westLngs.length > 0) {
      // Route spans both hemispheres across the antimeridian
      // Use the eastern-most east longitude and western-most west longitude
      const minLng = Math.min(...eastLngs); // Furthest east point from antimeridian
      const maxLng = Math.max(...westLngs); // Furthest west point from antimeridian
      return [[minLng, minLat], [maxLng, maxLat]];
    }
  }

  // Standard bounds calculation for routes not crossing the antimeridian
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return [[minLng, minLat], [maxLng, maxLat]];
}
