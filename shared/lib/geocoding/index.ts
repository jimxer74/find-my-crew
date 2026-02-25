// Export types from geocoding
export type { BoundingBox, GeocodedLocation } from './geocoding';
// Export functions from geocoding
export { geocodeLocation, geocodeLocations, describeBbox } from './geocoding';

// Export types from locations
export type { LocationRegion, LocationSearchResult } from './locations';
// Export values and functions from locations
export { LOCATION_REGISTRY, searchLocation, getLocationBbox, listRegions, getCategories, getBboxCenter, calculateDistance, getAllRegions } from './locations';
