import { NextRequest, NextResponse } from 'next/server';
import { geocodeLocation } from '@shared/lib/geocoding/geocoding';
import { searchLocation, getBboxCenter } from '@shared/lib/geocoding/locations';
import { logger } from '@shared/logging';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const text = query.trim();

    // 1. Try known sailing regions first (fast, no API call needed)
    const regionMatches = searchLocation(text);
    if (regionMatches.length > 0) {
      const { region } = regionMatches[0];
      const center = getBboxCenter(region.bbox);
      return NextResponse.json({
        name: region.name,
        lat: center.lat,
        lng: center.lng,
        isCruisingRegion: true,
        bbox: region.bbox,
      });
    }

    // 2. Fall back to Mapbox geocoding for user-defined locations
    const result = await geocodeLocation(text);
    if (!result) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: result.name,
      lat: result.center.lat,
      lng: result.center.lng,
      isCruisingRegion: false,
      bbox: result.bbox,
      countryName: result.country ?? undefined,
    });
  } catch (error) {
    logger.error('[Onboarding geocode] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
  }
}
