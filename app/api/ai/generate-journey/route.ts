import { NextRequest, NextResponse } from 'next/server';
import { callAI, AIServiceError } from '@/app/lib/ai/service';
import {
  validateLocation,
  validateWaypointArray,
  validateDateString,
  validatePositiveNumber,
  MAX_INPUT_LENGTHS,
} from '@/app/lib/ai/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startLocation, endLocation, intermediateWaypoints, boatId, startDate, endDate, useSpeedPlanning, boatSpeed } = body;

    // Validate start location
    const startResult = validateLocation(startLocation, 'Start location');
    if (!startResult.valid) {
      return NextResponse.json({ error: startResult.error }, { status: 400 });
    }

    // Validate end location
    const endResult = validateLocation(endLocation, 'End location');
    if (!endResult.valid) {
      return NextResponse.json({ error: endResult.error }, { status: 400 });
    }

    // Validate intermediate waypoints (max 20)
    const waypointsResult = validateWaypointArray(intermediateWaypoints, 20);
    if (!waypointsResult.valid) {
      return NextResponse.json({ error: waypointsResult.error }, { status: 400 });
    }

    // Validate dates
    const startDateResult = validateDateString(startDate, 'Start date');
    if (!startDateResult.valid) {
      return NextResponse.json({ error: startDateResult.error }, { status: 400 });
    }

    const endDateResult = validateDateString(endDate, 'End date');
    if (!endDateResult.valid) {
      return NextResponse.json({ error: endDateResult.error }, { status: 400 });
    }

    // Validate boat speed
    const speedResult = validatePositiveNumber(boatSpeed, 'Boat speed', 50);
    if (!speedResult.valid) {
      return NextResponse.json({ error: speedResult.error }, { status: 400 });
    }

    // Use validated and sanitized values
    const validatedStart = startResult.location!;
    const validatedEnd = endResult.location!;
    const validatedWaypoints = waypointsResult.waypoints;
    const validatedStartDate = startDateResult.date;
    const validatedEndDate = endDateResult.date;
    const validatedSpeed = speedResult.value;

    // Log received coordinates for debugging
    console.log('Validated startLocation:', validatedStart);
    console.log('Validated endLocation:', validatedEnd);

    // Build waypoints list for prompt using validated values
    const allWaypoints = [
      validatedStart,
      ...validatedWaypoints,
      validatedEnd,
    ];
    
    const waypointsInfo = allWaypoints.length > 2
      ? `\n\nWaypoints (in order):\n${allWaypoints.map((wp, idx) => 
          `  ${idx === 0 ? 'START' : idx === allWaypoints.length - 1 ? 'END' : `WAYPOINT ${idx}`}: ${wp.name} (${wp.lat}, ${wp.lng})`
        ).join('\n')}`
      : '';
    
    // Create a prompt for Gemini
    const dateInfo = validatedStartDate || validatedEndDate
      ? `\nJourney Dates:${validatedStartDate ? ` Start: ${validatedStartDate}` : ''}${validatedEndDate ? ` End: ${validatedEndDate}` : ''}`
      : '';

    const speedPlanningInstructions = useSpeedPlanning && validatedSpeed && validatedStartDate && validatedEndDate
      ? `\n\nSPEED-BASED PLANNING (CRITICAL):
- The boat's average cruising speed is ${validatedSpeed} knots
- Journey must start on ${validatedStartDate} and end by ${validatedEndDate}
- You MUST calculate realistic dates for each leg based on:
  * Distance between waypoints (calculate using coordinates)
  * Boat speed (${validatedSpeed} knots)
  * Realistic sailing time (consider weather, rest periods, and safe navigation)
- For each leg, calculate:
  * Distance in nautical miles between start and end waypoints
  * Estimated sailing time = Distance / Speed (account for 70-80% efficiency due to conditions)
  * Start date: Use journey start date for first leg, or end date of previous leg
  * End date: Start date + calculated sailing time + buffer for rest/weather
- Ensure all leg dates fit within the journey timeframe (${validatedStartDate} to ${validatedEndDate})
- Leg dates should be sequential and realistic
- Include start_date and end_date for each leg in the response`
      : '';
    
    const prompt = `You are a sailing route planner. Generate a sailing journey with legs between locations.${waypointsInfo}

Start Location: ${validatedStart.name} (approximately ${validatedStart.lat}, ${validatedStart.lng})
End Location: ${validatedEnd.name} (approximately ${validatedEnd.lat}, ${validatedEnd.lng})${dateInfo}${speedPlanningInstructions}

CRITICAL RULES:
1. Leg START and END waypoints MUST ALWAYS be at:
   - Ports
   - Marinas
   - Towns
   - Cities
   - Any location where crew can be exchanged (accessible by land/ferry)
   - NEVER in open ocean or remote sea locations

2. Intermediate waypoints (between start and end of a leg) CAN be:
   - Anywhere relevant for navigation
   - Open ocean waypoints for routing
   - Navigation points, buoys, or landmarks
   - Used when needed for safe routing or interesting stops

3. ${allWaypoints.length > 2 
      ? `You MUST create legs that visit ALL waypoints in the specified order: ${allWaypoints.map(wp => wp.name).join(' → ')}. Each waypoint must be included as either a start or end point of a leg.`
      : 'Each leg should:'}
   - Have a descriptive name
   - Start at a port/town/city/marina (crew exchange point)
   - End at a port/town/city/marina (crew exchange point)
   - Include intermediate waypoints ONLY if they add value (routing, safety, or interesting stops)
   - Form a logical sailing route considering safe passages
   ${allWaypoints.length > 2 ? `- Visit all specified waypoints in order: ${allWaypoints.map(wp => wp.name).join(' → ')}` : ''}

4. Geocodes (coordinates):
   - You must determine the EXACT coordinates for each waypoint
   - Use real, accurate coordinates for ports, towns, cities, and marinas
   - For the start location (${validatedStart.name}), use the actual coordinates of that port/town/city
   - For the end location (${validatedEnd.name}), use the actual coordinates of that port/town/city
   - Do NOT use the approximate coordinates provided above - find the real coordinates
   - Coordinates must be in [longitude, latitude] format
   - All coordinates must be valid numbers

Return ONLY valid JSON in this exact format:${useSpeedPlanning && validatedSpeed && validatedStartDate && validatedEndDate ? `
{
  "journeyName": "Journey name here",
  "description": "Brief description of the journey",
  "legs": [
    {
      "name": "Leg name",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "waypoints": [
        {
          "index": 0,
          "name": "Starting port/town/city name",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        },
        {
          "index": 1,
          "name": "Intermediate waypoint name (optional, only if needed)",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        },
        {
          "index": 2,
          "name": "Ending port/town/city name",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        }
      ]
    }
  ]
}` : `
{
  "journeyName": "Journey name here",
  "description": "Brief description of the journey",
  "legs": [
    {
      "name": "Leg name",
      "waypoints": [
        {
          "index": 0,
          "name": "Starting port/town/city name",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        },
        {
          "index": 1,
          "name": "Intermediate waypoint name (optional, only if needed)",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        },
        {
          "index": 2,
          "name": "Ending port/town/city name",
          "geocode": {
            "type": "Point",
            "coordinates": [longitude, latitude]
          }
        }
      ]
    }
  ]
}`}

IMPORTANT:
- First leg's starting waypoint (index 0) name should be "${validatedStart.name}" or a specific port/marina in that location
- Last leg's ending waypoint (highest index) name should be "${validatedEnd.name}" or a specific port/marina in that location
${allWaypoints.length > 2 
  ? `- You MUST create legs that visit ALL ${allWaypoints.length} waypoints in order: ${allWaypoints.map(wp => wp.name).join(' → ')}\n- Each waypoint from the list must appear as either the start or end of a leg\n- Create multiple legs if needed to visit all waypoints`
  : ''}
- Waypoint indices must be sequential (0, 1, 2, 3, etc.)
- Start waypoint (index 0) and end waypoint (highest index) of each leg MUST be ports/towns/cities/marinas
- Intermediate waypoints (between start and end) are optional and can be anywhere
- You must provide accurate, real coordinates for all waypoints - do not use placeholder values
- For waypoints provided by the user, use their exact coordinates: ${allWaypoints.map((wp, idx) => `${wp.name}: [${wp.lng}, ${wp.lat}]`).join(', ')}
- Coordinates are [longitude, latitude] format
- Return ONLY the JSON, no markdown, no code blocks`;

    // Use centralized AI service
    let result;
    try {
      console.log('Calling AI with Prompt:', prompt);

      result = await callAI({
        useCase: 'generate-journey',
        prompt,
      });
      console.log(`Success with ${result.provider}/${result.model}`);
    } catch (error: any) {
      console.error('=== AI SERVICE ERROR ===');
      console.error('Error:', error.message);
      if (error instanceof AIServiceError) {
        console.error('Provider:', error.provider);
        console.error('Model:', error.model);
      }
      console.error('========================');
      return NextResponse.json(
        { error: error.message || 'Failed to generate journey' },
        { status: 500 }
      );
    }

    const text = result.text;

    console.log('AI Response:', text);

    // Parse the JSON response (remove markdown code blocks if present)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const generatedData = JSON.parse(jsonText);

    // Validate the structure
    if (!generatedData.journeyName || !generatedData.legs || !Array.isArray(generatedData.legs)) {
      return NextResponse.json(
        { error: 'Invalid response format from AI' },
        { status: 500 }
      );
    }

    // Validate and structure waypoints - let AI determine all geocodes
    for (let i = 0; i < generatedData.legs.length; i++) {
      const leg = generatedData.legs[i];
      
      // Ensure leg has waypoints array
      if (!leg.waypoints || !Array.isArray(leg.waypoints)) {
        return NextResponse.json(
          { error: `Leg ${i + 1} is missing waypoints array` },
          { status: 500 }
        );
      }

      // Sort waypoints by index to ensure correct order
      leg.waypoints.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));
      
      // Ensure we have at least 2 waypoints (start and end)
      if (leg.waypoints.length < 2) {
        return NextResponse.json(
          { error: `Leg ${i + 1} must have at least 2 waypoints (start and end)` },
          { status: 500 }
        );
      }
      
      // Re-index waypoints sequentially to ensure proper order
      leg.waypoints.forEach((wp: any, idx: number) => {
        wp.index = idx;
        
        // Validate geocode structure exists
        if (!wp.geocode) {
          wp.geocode = { type: 'Point', coordinates: [0, 0] };
        }
        if (!wp.geocode.coordinates || !Array.isArray(wp.geocode.coordinates)) {
          wp.geocode.coordinates = [0, 0];
        }
        if (wp.geocode.coordinates.length !== 2) {
          wp.geocode.coordinates = [0, 0];
        }
        // Ensure coordinates are numbers
        wp.geocode.coordinates[0] = typeof wp.geocode.coordinates[0] === 'number' ? wp.geocode.coordinates[0] : 0;
        wp.geocode.coordinates[1] = typeof wp.geocode.coordinates[1] === 'number' ? wp.geocode.coordinates[1] : 0;
        
        // Ensure geocode type
        if (!wp.geocode.type) {
          wp.geocode.type = 'Point';
        }
      });
      
      // Validate that first waypoint name matches start location (for first leg)
      if (i === 0 && leg.waypoints.length > 0) {
        const firstWp = leg.waypoints[0];
        // Only update name if it's clearly wrong, but keep AI's coordinates
        if (!firstWp.name || firstWp.name.trim() === '') {
          firstWp.name = validatedStart.name;
        }
      }

      // Validate that last waypoint name matches end location (for last leg)
      if (i === generatedData.legs.length - 1 && leg.waypoints.length > 0) {
        const lastWp = leg.waypoints[leg.waypoints.length - 1];
        // Only update name if it's clearly wrong, but keep AI's coordinates
        if (!lastWp.name || lastWp.name.trim() === '') {
          lastWp.name = validatedEnd.name;
        }
      }
      
      // Ensure intermediate legs connect properly (end of previous = start of current)
      if (i > 0) {
        const prevLeg = generatedData.legs[i - 1];
        const prevEndWp = prevLeg.waypoints[prevLeg.waypoints.length - 1];
        const currentStartWp = leg.waypoints[0];
        
        if (prevEndWp && currentStartWp) {
          // Use previous leg's end waypoint as current leg's start
          // But keep AI's coordinates if they're valid
          currentStartWp.index = 0;
          if (!currentStartWp.name || currentStartWp.name.trim() === '') {
            currentStartWp.name = prevEndWp.name || 'Port';
          }
          // Only copy coordinates if current waypoint has invalid coordinates
          if (!currentStartWp.geocode || 
              !currentStartWp.geocode.coordinates || 
              currentStartWp.geocode.coordinates[0] === 0 && currentStartWp.geocode.coordinates[1] === 0) {
            if (prevEndWp.geocode && prevEndWp.geocode.coordinates) {
              currentStartWp.geocode = {
                type: 'Point',
                coordinates: [...prevEndWp.geocode.coordinates]
              };
            }
          }
        }
      }
    }
    
    // Log final waypoints for debugging
    const finalFirstWp = generatedData.legs[0]?.waypoints?.[0];
    const finalLastLeg = generatedData.legs[generatedData.legs.length - 1];
    const finalLastWp = finalLastLeg?.waypoints?.[finalLastLeg.waypoints.length - 1];
    console.log('Final first waypoint:', {
      name: finalFirstWp?.name,
      coordinates: finalFirstWp?.geocode?.coordinates
    });
    console.log('Final last waypoint:', {
      name: finalLastWp?.name,
      coordinates: finalLastWp?.geocode?.coordinates
    });

    return NextResponse.json({ 
      success: true, 
      data: generatedData,
      prompt: prompt // Return the prompt used for AI generation
    });
  } catch (error: any) {
    console.error('Error generating journey:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate journey' },
      { status: 500 }
    );
  }
}
