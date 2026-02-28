import { NextRequest, NextResponse } from 'next/server';
import { geocodeLocation } from '@shared/lib/geocoding/geocoding';
import { logger } from '@shared/logging';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const result = await geocodeLocation(query.trim());
    if (!result) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    return NextResponse.json({
      name: result.name,
      lat: result.center.lat,
      lng: result.center.lng,
    });
  } catch (error) {
    logger.error('[Onboarding geocode] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 });
  }
}
