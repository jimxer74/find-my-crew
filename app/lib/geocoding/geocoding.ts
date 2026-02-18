/**
 * AI Assistant Geocoding Service
 *
 * Server-side geocoding using Mapbox Search Box API for location-based leg searches.
 */

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[Geocoding Service] ${message}`, data !== undefined ? data : '');
  }
};

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Geocoded location result
 */
export interface GeocodedLocation {
  name: string;
  center: { lat: number; lng: number };
  bbox: BoundingBox;
  type: string; // 'place', 'city', 'region', 'country', etc.
  country?: string;
}

/**
 * Default margins in degrees for different location types
 * Approximate: 1 degree latitude ≈ 111km
 */
const LOCATION_TYPE_MARGINS: Record<string, number> = {
  address: 0.1,      // ~11km - very specific
  poi: 0.2,          // ~22km - point of interest
  place: 0.5,        // ~55km - city/town
  city: 0.5,         // ~55km - city
  locality: 0.3,     // ~33km - neighborhood
  district: 0.5,     // ~55km - district
  region: 2.0,       // ~220km - state/province
  country: 5.0,      // ~550km - country (use actual bbox when available)
  default: 1.0,      // ~110km - fallback
};

/**
 * Calculate a bounding box with margin around a center point
 */
function calculateBboxWithMargin(
  centerLat: number,
  centerLng: number,
  marginDegrees: number
): BoundingBox {
  return {
    minLng: centerLng - marginDegrees,
    minLat: centerLat - marginDegrees,
    maxLng: centerLng + marginDegrees,
    maxLat: centerLat + marginDegrees,
  };
}

/**
 * Expand an existing bounding box by a percentage
 */
function expandBbox(bbox: BoundingBox, expandPercent: number = 0.2): BoundingBox {
  const lngSpan = bbox.maxLng - bbox.minLng;
  const latSpan = bbox.maxLat - bbox.minLat;
  const lngExpand = lngSpan * expandPercent;
  const latExpand = latSpan * expandPercent;

  return {
    minLng: bbox.minLng - lngExpand,
    minLat: bbox.minLat - latExpand,
    maxLng: bbox.maxLng + lngExpand,
    maxLat: bbox.maxLat + latExpand,
  };
}

/**
 * Geocode a location name using Mapbox Search Box API
 * Returns the best matching location with coordinates and bounding box
 */
export async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  log('Geocoding location:', query);

  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    log('ERROR: Mapbox access token not configured');
    throw new Error('Mapbox access token not configured');
  }

  if (!query || query.trim().length < 2) {
    log('Query too short, returning null');
    return null;
  }

  try {
    // Generate a session token for the API call
    const sessionToken = generateSessionToken();

    // Step 1: Get suggestions using Mapbox Search Box API /suggest endpoint
    const suggestUrl =
      `https://api.mapbox.com/search/searchbox/v1/suggest?` +
      `q=${encodeURIComponent(query.trim())}&` +
      `access_token=${accessToken}&` +
      `session_token=${sessionToken}&` +
      `types=region,city,country,place&` +
      `limit=1&` +
      `language=en`;

    log('Calling Mapbox suggest API...');
    const suggestResponse = await fetch(suggestUrl);

    if (!suggestResponse.ok) {
      const errorText = await suggestResponse.text();
      log('Mapbox suggest API error:', { status: suggestResponse.status, error: errorText });
      throw new Error(`Mapbox API error: ${suggestResponse.status}`);
    }

    const suggestData = await suggestResponse.json();
    log('Suggest response:', { suggestionCount: suggestData.suggestions?.length });

    if (!suggestData.suggestions || suggestData.suggestions.length === 0) {
      log('No suggestions found for query:', query);
      return null;
    }

    const suggestion = suggestData.suggestions[0];
    const mapboxId = suggestion.mapbox_id;

    if (!mapboxId) {
      log('No mapbox_id in suggestion');
      return null;
    }

    // Step 2: Retrieve full details with coordinates using /retrieve endpoint
    const retrieveUrl =
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?` +
      `access_token=${accessToken}&` +
      `session_token=${sessionToken}&` +
      `language=en`;

    log('Calling Mapbox retrieve API for:', mapboxId);
    const retrieveResponse = await fetch(retrieveUrl);

    if (!retrieveResponse.ok) {
      const errorText = await retrieveResponse.text();
      log('Mapbox retrieve API error:', { status: retrieveResponse.status, error: errorText });
      throw new Error(`Mapbox retrieve API error: ${retrieveResponse.status}`);
    }

    const retrieveData = await retrieveResponse.json();
    const feature = retrieveData.features?.[0];

    if (!feature || !feature.geometry || !feature.geometry.coordinates) {
      log('No valid feature in retrieve response');
      return null;
    }

    const [lng, lat] = feature.geometry.coordinates;
    const properties = feature.properties || {};
    const featureType = properties.feature_type || suggestion.feature_type || 'default';
    const fullName = properties.full_address || properties.name || suggestion.name || query;
    const country = properties.context?.country?.name;

    log('Feature retrieved:', { name: fullName, type: featureType, lat, lng });

    // Calculate bounding box
    let bbox: BoundingBox;

    // Check if Mapbox returned a bbox
    if (properties.bbox && Array.isArray(properties.bbox) && properties.bbox.length === 4) {
      // Mapbox bbox format: [minLng, minLat, maxLng, maxLat]
      bbox = {
        minLng: properties.bbox[0],
        minLat: properties.bbox[1],
        maxLng: properties.bbox[2],
        maxLat: properties.bbox[3],
      };
      // Expand the bbox by 20% to ensure we catch nearby legs
      bbox = expandBbox(bbox, 0.2);
      log('Using Mapbox bbox (expanded 20%):', bbox);
    } else {
      // Calculate bbox with margin based on location type
      const marginDegrees = LOCATION_TYPE_MARGINS[featureType] || LOCATION_TYPE_MARGINS.default;
      bbox = calculateBboxWithMargin(lat, lng, marginDegrees);
      log('Calculated bbox with margin:', { marginDegrees, bbox });
    }

    const result: GeocodedLocation = {
      name: fullName,
      center: { lat, lng },
      bbox,
      type: featureType,
      country,
    };

    log('Geocoding complete:', result);
    return result;
  } catch (error: any) {
    log('Geocoding error:', error.message);
    throw error;
  }
}

/**
 * Geocode multiple locations in parallel
 */
export async function geocodeLocations(queries: string[]): Promise<Map<string, GeocodedLocation | null>> {
  const results = new Map<string, GeocodedLocation | null>();

  const promises = queries.map(async (query) => {
    try {
      const result = await geocodeLocation(query);
      results.set(query, result);
    } catch (error) {
      results.set(query, null);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Generate a UUID v4 session token for Mapbox API
 */
function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get a human-readable description of the search area
 */
export function describeBbox(bbox: BoundingBox): string {
  const lngSpan = Math.abs(bbox.maxLng - bbox.minLng);
  const latSpan = Math.abs(bbox.maxLat - bbox.minLat);
  const avgSpan = (lngSpan + latSpan) / 2;
  const approxKm = Math.round(avgSpan * 111); // 1 degree ≈ 111km

  if (approxKm < 50) return 'nearby area';
  if (approxKm < 200) return 'local region';
  if (approxKm < 500) return 'wider region';
  return 'broad area';
}
