import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startLocation, endLocation, boatId } = body;

    if (!startLocation || !endLocation) {
      return NextResponse.json(
        { error: 'Start and end locations are required' },
        { status: 400 }
      );
    }

    // Validate coordinates are present and valid
    if (typeof startLocation.lat !== 'number' || typeof startLocation.lng !== 'number') {
      return NextResponse.json(
        { error: 'Start location must have valid lat and lng coordinates' },
        { status: 400 }
      );
    }
    
    if (typeof endLocation.lat !== 'number' || typeof endLocation.lng !== 'number') {
      return NextResponse.json(
        { error: 'End location must have valid lat and lng coordinates' },
        { status: 400 }
      );
    }

    // Log received coordinates for debugging
    console.log('Received startLocation:', {
      name: startLocation.name,
      lat: startLocation.lat,
      lng: startLocation.lng
    });
    console.log('Received endLocation:', {
      name: endLocation.name,
      lat: endLocation.lat,
      lng: endLocation.lng
    });

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Google Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Create a prompt for Gemini
    const prompt = `You are a sailing route planner. Generate a sailing journey with legs between two locations.

Start Location: ${startLocation.name} (approximately ${startLocation.lat}, ${startLocation.lng})
End Location: ${endLocation.name} (approximately ${endLocation.lat}, ${endLocation.lng})

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

3. Each leg should:
   - Have a descriptive name
   - Start at a port/town/city/marina (crew exchange point)
   - End at a port/town/city/marina (crew exchange point)
   - Include intermediate waypoints ONLY if they add value (routing, safety, or interesting stops)
   - Form a logical sailing route considering safe passages

4. Geocodes (coordinates):
   - You must determine the EXACT coordinates for each waypoint
   - Use real, accurate coordinates for ports, towns, cities, and marinas
   - For the start location (${startLocation.name}), use the actual coordinates of that port/town/city
   - For the end location (${endLocation.name}), use the actual coordinates of that port/town/city
   - Do NOT use the approximate coordinates provided above - find the real coordinates
   - Coordinates must be in [longitude, latitude] format
   - All coordinates must be valid numbers

Return ONLY valid JSON in this exact format:
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
}

IMPORTANT:
- First leg's starting waypoint (index 0) name should be "${startLocation.name}" or a specific port/marina in that location
- Last leg's ending waypoint (highest index) name should be "${endLocation.name}" or a specific port/marina in that location
- Waypoint indices must be sequential (0, 1, 2, 3, etc.)
- Start waypoint (index 0) and end waypoint (highest index) of each leg MUST be ports/towns/cities/marinas
- Intermediate waypoints (between start and end) are optional and can be anywhere
- You must provide accurate, real coordinates for all waypoints - do not use placeholder values
- Coordinates are [longitude, latitude] format
- Return ONLY the JSON, no markdown, no code blocks`;

    // Use REST API directly to avoid SDK version issues
    // Try different API versions and models
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    const apiVersions = ['v1beta', 'v1'];
    // Available models from Google AI Studio
    const modelsToTry = [
      'gemini-2.5-flash',      // Most balanced model with 1M token context
      'gemini-3-flash',        // Frontier-class performance
      'gemini-2.5-pro',        // Powerful reasoning model
      'gemini-3-pro',          // Most intelligent model
      'gemini-2.5-flash-lite', // Fastest and most cost-efficient
    ];
    
    let text: string | undefined;
    let lastError: any = null;
    
    for (const apiVersion of apiVersions) {
      for (const modelName of modelsToTry) {
        try {
          const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
          
          const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }]
            }),
          });

          if (!apiResponse.ok) {
            const errorData = await apiResponse.json().catch(() => ({}));
            lastError = new Error(`${apiVersion}/${modelName}: ${errorData.error?.message || apiResponse.statusText}`);
            console.log(`API ${apiVersion}, Model ${modelName} failed:`, lastError.message);
            continue; // Try next model
          }

          const apiData = await apiResponse.json();
          text = apiData.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (text) {
            console.log(`Successfully used API ${apiVersion}, model: ${modelName}`);
            break; // Success! Exit both loops
          }
        } catch (err: any) {
          lastError = err;
          console.log(`API ${apiVersion}, Model ${modelName} error:`, err.message);
          continue;
        }
      }
      if (text) break; // Exit outer loop if we got text
    }
    
    if (!text) {
      throw new Error(
        `All models failed. Last error: ${lastError?.message || 'Unknown error'}. ` +
        `Tried models: ${modelsToTry.join(', ')}. ` +
        `Please check Google AI Studio (https://aistudio.google.com/) to see which models are available for your API key.`
      );
    }

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
          firstWp.name = startLocation.name;
        }
      }
      
      // Validate that last waypoint name matches end location (for last leg)
      if (i === generatedData.legs.length - 1 && leg.waypoints.length > 0) {
        const lastWp = leg.waypoints[leg.waypoints.length - 1];
        // Only update name if it's clearly wrong, but keep AI's coordinates
        if (!lastWp.name || lastWp.name.trim() === '') {
          lastWp.name = endLocation.name;
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

    return NextResponse.json({ success: true, data: generatedData });
  } catch (error: any) {
    console.error('Error generating journey:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate journey' },
      { status: 500 }
    );
  }
}
