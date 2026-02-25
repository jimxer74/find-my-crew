import { NextRequest, NextResponse } from 'next/server';
import { callAI, AIServiceError } from '@shared/ai/service';
import { parseJsonObjectFromAIResponse } from '@shared/ai/shared';
import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { make_model, hardData } = body;

    if (!make_model || typeof make_model !== 'string' || make_model.trim().length < 2) {
      return NextResponse.json(
        { error: 'Make and Model is required' },
        { status: 400 }
      );
    }

    if (!hardData || typeof hardData !== 'object') {
      return NextResponse.json(
        { error: 'Hard data from sailboatdata.com is required' },
        { status: 400 }
      );
    }

    const makeModelTrimmed = make_model.trim();

    // Build prompt with hard data context
    const prompt = `You are a sailing expert analyzing sailboat specifications and characteristics.

A user wants reasoned analysis for the sailboat: "${makeModelTrimmed}"

HARD DATA (already fetched from sailboatdata.com - these are factual measurements):
- Length Overall (LOA): ${hardData.loa_m ? `${hardData.loa_m} meters` : 'not available'}
- Beam: ${hardData.beam_m ? `${hardData.beam_m} meters` : 'not available'}
- Max Draft: ${hardData.max_draft_m ? `${hardData.max_draft_m} meters` : 'not available'}
- Displacement: ${hardData.displcmt_m ? `${hardData.displcmt_m} kg` : 'not available'}
- Sail Area / Displacement Ratio: ${hardData.sa_displ_ratio !== null && hardData.sa_displ_ratio !== undefined ? hardData.sa_displ_ratio : 'not available'}
- Ballast / Displacement Ratio: ${hardData.ballast_displ_ratio !== null && hardData.ballast_displ_ratio !== undefined ? hardData.ballast_displ_ratio : 'not available'}
- Displacement / Length Ratio: ${hardData.displ_len_ratio !== null && hardData.displ_len_ratio !== undefined ? hardData.displ_len_ratio : 'not available'}
- Comfort Ratio: ${hardData.comfort_ratio !== null && hardData.comfort_ratio !== undefined ? hardData.comfort_ratio : 'not available'}
- Capsize Screening Formula: ${hardData.capsize_screening !== null && hardData.capsize_screening !== undefined ? hardData.capsize_screening : 'not available'}
- Hull Speed: ${hardData.hull_speed_knots !== null && hardData.hull_speed_knots !== undefined ? `${hardData.hull_speed_knots} knots` : 'not available'}
- Pounds/Inch Immersion: ${hardData.ppi_pounds_per_inch !== null && hardData.ppi_pounds_per_inch !== undefined ? hardData.ppi_pounds_per_inch : 'not available'}

YOUR TASK: Based on the hard data above and your knowledge of sailboats, provide reasoned analysis for the following fields:

1. **Category Selection**: Choose ONE category that best fits this sailboat based on its specifications:
   - "Daysailers" - Small (15-30ft), lightweight, minimal cabin, for day trips
   - "Coastal cruisers" - Moderate size (25-40ft), basic amenities, for weekend trips
   - "Traditional offshore cruisers" - Heavy displacement (35-50ft), robust, bluewater-capable
   - "Performance cruisers" - Lighter displacement (30-50ft), fast, racing-inspired
   - "Multihulls" - Multiple hulls, wide beam, shallow draft
   - "Expedition sailboats" - Heavy, reinforced, extreme environments (45-65ft)

2. **Capacity**: Estimate the number of people this sailboat can comfortably accommodate based on LOA, displacement, and typical berth arrangements.

3. **Average Speed**: Provide a realistic average cruising speed in knots based on hull speed and performance ratios. Typically 60-80% of hull speed for cruising.

4. **Characteristics**: Describe the hull design, construction materials, rigging type, keel configuration, and overall design philosophy based on the specifications.

5. **Capabilities**: Describe what sailing conditions this boat can handle, its range, single-handed capability, and typical use cases based on the performance metrics.

6. **Accommodations**: Describe the interior layout, berths, galley, head, storage, and living space based on the boat's size and displacement.

CRITICAL REQUIREMENTS:
- Return ONLY valid JSON, no markdown, no code blocks, no explanations
- Base your analysis on the hard data provided - use the ratios and measurements to make informed conclusions
- For category, choose the SINGLE best fit based on displacement, length, and performance characteristics
- Be specific and detailed in your descriptions
- If certain data is missing, make reasonable inferences but note limitations

Return a JSON object with this exact structure:
{
  "type": "one of the categories above or null",
  "capacity": number (number of people, typically 2-12),
  "average_speed_knots": number (realistic average cruising speed in knots, typically 5-12),
  "characteristics": "detailed text describing hull design, construction, rigging, keel type, etc. based on specifications",
  "capabilities": "detailed text describing what the boat can do - sailing conditions, range, single-handed capability, etc.",
  "accommodations": "detailed text describing interior layout, berths, galley, head, storage, etc. based on size and displacement"
}

IMPORTANT: Return ONLY the JSON object, nothing else.`;

    // Debug: Log the prompt
    logger.aiFlow('ReasonedDetails', 'Filling reasoned details', {
      makeModel: makeModelTrimmed,
      hardDataKeys: Object.keys(hardData),
      promptLength: prompt.length
    });

    // Use centralized AI service
    let result;
    try {
      result = await callAI({
        useCase: 'boat-details',
        prompt,
      });
      logger.debug(`AI call succeeded`, { provider: result.provider, model: result.model }, true);
    } catch (error: any) {
      logger.error(`AI service error`, {
        error: error.message,
        provider: error instanceof AIServiceError ? error.provider : 'unknown',
        model: error instanceof AIServiceError ? error.model : 'unknown'
      });
      return NextResponse.json(
        { error: error.message || 'Failed to get AI response' },
        { status: 500 }
      );
    }

    const text = result.text;

    // Parse JSON from response using shared utility
    let reasonedDetails;
    try {
      reasonedDetails = parseJsonObjectFromAIResponse(text);
    } catch (parseError: any) {
      logger.error(`JSON parse error`, { error: parseError.message });
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }
    
    // Debug: Log parsed details
    logger.debug(`Reasoned details parsed successfully`, {
      type: reasonedDetails.type,
      capacity: reasonedDetails.capacity,
      averageSpeed: reasonedDetails.average_speed_knots
    }, true);

    // Validate and return only the reasoned fields
    return NextResponse.json({
      reasonedDetails: {
        type: reasonedDetails.type || null,
        capacity: reasonedDetails.capacity || null,
        average_speed_knots: reasonedDetails.average_speed_knots || null,
        characteristics: reasonedDetails.characteristics || '',
        capabilities: reasonedDetails.capabilities || '',
        accommodations: reasonedDetails.accommodations || '',
      }
    });

  } catch (error: any) {
    logger.error('AI reasoned details filling failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Failed to fill reasoned details'),
      { status: 500 }
    );
  }
}
