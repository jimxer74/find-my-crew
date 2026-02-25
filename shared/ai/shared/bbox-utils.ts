/**
 * Shared Bounding Box Utilities
 *
 * Common utilities for handling geographic bounding boxes in AI searches.
 * Used by both assistant and prospect chat services.
 */

import { logger } from '@shared/logging';
import { BoundingBox, describeBbox } from '@shared/lib/geocoding/geocoding';

// Re-export BoundingBox type for convenience
export type { BoundingBox };
export { describeBbox };

// Debug logging helper
const DEBUG = true;
const log = (message: string, data?: unknown) => {
  if (DEBUG) {
    logger.debug(`[Bbox Utils] ${message}`, data !== undefined ? (data as Record<string, any>) : undefined);
  }
};

/**
 * Normalized bounding box arguments returned from AI
 */
export interface NormalizedBboxArgs {
  departureBbox?: BoundingBox;
  arrivalBbox?: BoundingBox;
  departureDescription?: string;
  arrivalDescription?: string;
}

/**
 * Helper to convert string/number to number
 */
function toNumber(val: unknown): number | undefined {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Helper to normalize a bbox object (convert strings to numbers)
 * Handles:
 * - Object: { minLng: -6, minLat: 35, maxLng: 10, maxLat: 44 }
 * - JSON string: '{"minLng": -6, "minLat": 35, "maxLng": 10, "maxLat": 44}'
 * - String numbers: { minLng: "-6", minLat: "35", ... }
 */
function normalizeSingleBbox(bbox: unknown): BoundingBox | undefined {
  if (!bbox) return undefined;

  // Handle JSON string (from XML parser)
  let bboxObj: Record<string, unknown>;
  if (typeof bbox === 'string') {
    try {
      bboxObj = JSON.parse(bbox);
      log('Parsed bbox from JSON string:', bboxObj);
    } catch {
      log('Failed to parse bbox string:', bbox);
      return undefined;
    }
  } else if (typeof bbox === 'object') {
    bboxObj = bbox as Record<string, unknown>;
  } else {
    return undefined;
  }

  const minLng = toNumber(bboxObj.minLng);
  const minLat = toNumber(bboxObj.minLat);
  const maxLng = toNumber(bboxObj.maxLng);
  const maxLat = toNumber(bboxObj.maxLat);

  // Check if all coordinates are present
  if (minLng === undefined || minLat === undefined || maxLng === undefined || maxLat === undefined) {
    // Log which coordinates are missing for debugging AI errors
    const missing: string[] = [];
    if (minLng === undefined) missing.push('minLng');
    if (minLat === undefined) missing.push('minLat');
    if (maxLng === undefined) missing.push('maxLng');
    if (maxLat === undefined) missing.push('maxLat');
    log(`Incomplete bbox - missing: ${missing.join(', ')}. Received:`, bboxObj);
    return undefined;
  }

  return { minLng, minLat, maxLng, maxLat };
}

/**
 * Normalize bounding box arguments from AI
 * Handles multiple formats:
 * 1. Proper nested: { departureBbox: { minLng: -6, ... } }
 * 2. Flat coordinates: { minLng: -6, minLat: 35, maxLng: 10, maxLat: 44 }
 * 3. String values: { departureBbox: { minLng: "-6", ... } }
 */
export function normalizeBboxArgs(args: Record<string, unknown>): NormalizedBboxArgs {
  const result: NormalizedBboxArgs = {};

  // Check for proper nested format first
  if (args.departureBbox) {
    result.departureBbox = normalizeSingleBbox(args.departureBbox);
  }
  if (args.arrivalBbox) {
    result.arrivalBbox = normalizeSingleBbox(args.arrivalBbox);
  }

  // Preserve descriptions
  if (args.departureDescription && typeof args.departureDescription === 'string') {
    result.departureDescription = args.departureDescription;
  }
  if (args.arrivalDescription && typeof args.arrivalDescription === 'string') {
    result.arrivalDescription = args.arrivalDescription;
  }

  // If no nested bbox found, check for flat coordinates at root level
  // This handles the case where AI sends: { minLng: -6, minLat: 35, maxLng: 10, maxLat: 44 }
  if (!result.departureBbox && !result.arrivalBbox) {
    const minLng = toNumber(args.minLng);
    const minLat = toNumber(args.minLat);
    const maxLng = toNumber(args.maxLng);
    const maxLat = toNumber(args.maxLat);

    if (minLng !== undefined && minLat !== undefined && maxLng !== undefined && maxLat !== undefined) {
      // Flat coordinates found - treat as departure bbox by default
      result.departureBbox = { minLng, minLat, maxLng, maxLat };
      log('Converted flat coordinates to departureBbox:', result.departureBbox);

      // Use departureDescription if provided, otherwise generate one
      if (!result.departureDescription) {
        result.departureDescription = 'Search area (coordinates provided)';
      }
    }
  }

  return result;
}

/**
 * Validate that a bounding box has valid coordinates
 */
export function isValidBbox(bbox: BoundingBox): boolean {
  // Check all values are numbers
  if (
    typeof bbox.minLng !== 'number' ||
    typeof bbox.minLat !== 'number' ||
    typeof bbox.maxLng !== 'number' ||
    typeof bbox.maxLat !== 'number'
  ) {
    return false;
  }

  // Check longitude range (-180 to 180)
  if (bbox.minLng < -180 || bbox.minLng > 180 || bbox.maxLng < -180 || bbox.maxLng > 180) {
    return false;
  }

  // Check latitude range (-90 to 90)
  if (bbox.minLat < -90 || bbox.minLat > 90 || bbox.maxLat < -90 || bbox.maxLat > 90) {
    return false;
  }

  // Check min < max (allow for bboxes crossing the antimeridian)
  if (bbox.minLat > bbox.maxLat) {
    return false;
  }

  return true;
}

/**
 * Check if a point is within a bounding box
 */
export function isPointInBbox(lng: number, lat: number, bbox: BoundingBox): boolean {
  return (
    lng >= bbox.minLng &&
    lng <= bbox.maxLng &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

/**
 * Extract coordinates from a PostGIS geometry response
 */
export function extractCoordinates(location: unknown): { lng: number; lat: number } | null {
  try {
    if (typeof location === 'string') {
      // Could be GeoJSON string or WKT
      if (location.startsWith('{')) {
        const geoJson = JSON.parse(location);
        if (geoJson.coordinates) {
          return { lng: geoJson.coordinates[0], lat: geoJson.coordinates[1] };
        }
      }
    } else if (location && typeof location === 'object') {
      const loc = location as Record<string, unknown>;
      if (loc.coordinates && Array.isArray(loc.coordinates)) {
        // GeoJSON object
        return { lng: loc.coordinates[0] as number, lat: loc.coordinates[1] as number };
      } else if (loc.x !== undefined && loc.y !== undefined) {
        // Point object with x/y
        return { lng: loc.x as number, lat: loc.y as number };
      }
    }
  } catch (e) {
    log('Failed to extract coordinates:', e);
  }
  return null;
}
