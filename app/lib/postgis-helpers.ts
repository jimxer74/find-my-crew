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
