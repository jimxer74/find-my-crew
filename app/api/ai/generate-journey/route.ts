import { NextRequest, NextResponse } from 'next/server';
import { generateJourneyRoute } from '@/app/lib/ai/generateJourney';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startLocation, endLocation, intermediateWaypoints, boatId, startDate, endDate, useSpeedPlanning, boatSpeed } = body;

    const result = await generateJourneyRoute({
      startLocation,
      endLocation,
      intermediateWaypoints,
      boatId,
      startDate,
      endDate,
      useSpeedPlanning,
      boatSpeed,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Invalid response format from AI' || result.error?.startsWith('Leg ') ? 500 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error('Error generating journey:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate journey' },
      { status: 500 }
    );
  }
}
