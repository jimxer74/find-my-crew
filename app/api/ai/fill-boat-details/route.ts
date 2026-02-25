import { NextRequest, NextResponse } from 'next/server';
import { callAI, AIServiceError } from '@shared/ai/service';
import { parseJsonObjectFromAIResponse } from '@shared/ai/shared';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { make_model } = body;

    if (!make_model || typeof make_model !== 'string' || make_model.trim().length < 2) {
      return NextResponse.json(
        { error: 'Make and Model is required' },
        { status: 400 }
      );
    }

    const makeModelTrimmed = make_model.trim();

    const searchUrl = `https://sailboatdata.com/?keyword=${encodeURIComponent(makeModelTrimmed)}&sort-select&sailboats_per_page=50`;
    
    const prompt = `You are a sailing expert with comprehensive knowledge of sailboats from www.sailboatdata.com database.

A user wants detailed information about the sailboat: "${makeModelTrimmed}"

The search URL on sailboatdata.com would be: ${searchUrl}

Your task: Provide comprehensive details about this sailboat in JSON format. Use your knowledge of sailboats from sailboatdata.com and general sailing expertise.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON, no markdown, no code blocks, no explanations
2. Use exact values from sailboatdata.com when available, or from other sources such as directly from the builder websites
3. For sailboat category, choose ONE from: "Daysailers", "Coastal cruisers", "Traditional offshore cruisers", "Performance cruisers", "Multihulls", "Expedition sailboats"
4. Find following sailboat calculations from web, prioritize sailboatdata.com but search other sources as well if available
   - Sail aread / displacement ratio or S.A. / Disp
   - A Ballast / Displacement ration or Bal. / Displ.
   - Displacement / Length ratio or Disp: / Len
   - Comfort Ratio 
   - Capsize Screening Formula
   - Hull Speed
   - Pounds/Inch Immersion (PPI)
5. Provide realistic average speed in knots based on boat performance calculations data
6. If you don't have exact data (sail area, ballast, LWL) do not guess or try to calculate anything just leave empty
7. Return in metric units if available

Return a JSON object with this exact structure:
{
  "type": "one of the categories above or null",
  "capacity": number (number of people, typically 2-12),
  "loa_m": number (length overall in meters, typically 5-30),
  "beam_m": number (beam width in meters, typically 1.5-8),
  "displcmt_m": number (displacement in kg, typically 1000-50000),
  "average_speed_knots": number (realistic average cruising speed, typically 5-12),
  "characteristics": "detailed text describing hull design, construction, rigging, keel type, etc.",
  "capabilities": "detailed text describing what the boat can do - sailing conditions, range, single-handed capability, etc.",
  "accommodations": "detailed text describing interior layout, berths, galley, head, storage, etc.",
  "link_to_specs": "URL to sailboatdata.com page if known, or empty string",
  "sa_displ_ratio": number or null (S.A. / Displ. - Sail Area to Displacement ratio)
  "ballast_displ_ratio": number or null (Bal. / Displ. - Ballast to Displacement ratio),
  "displ_len_ratio": number or null (Disp. / Len - Displacement to Length ratio in meters)
  "comfort_ratio": number or null (Comfort Ratio) 
  "capsize_screening": number or null (Capsize Screening Formula)
  "hull_speed_knots": number or null (Hull Speed) 
  "ppi_pounds_per_inch": number or null (Pounds/Inch Immersion)
}

IMPORTANT: Return ONLY the JSON object, nothing else.`;

    // Debug: Log the prompt
    logger.aiFlow('BoatDetails', 'Filling boat details', {
      makeModel: makeModelTrimmed,
      searchUrl,
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
    let boatDetails;
    try {
      boatDetails = parseJsonObjectFromAIResponse(text);
    } catch (parseError: any) {
      logger.error(`JSON parse error`, { error: parseError.message });
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }
    
    // Debug: Log parsed details
    logger.debug(`Boat details parsed successfully`, {
      type: boatDetails.type,
      capacity: boatDetails.capacity,
      loa_m: boatDetails.loa_m,
      beam_m: boatDetails.beam_m
    }, true);

    // Validate and return the boat details
    return NextResponse.json({
      boatDetails: {
        type: boatDetails.type || null,
        capacity: boatDetails.capacity || null,
        loa_m: boatDetails.loa_m || null,
        beam_m: boatDetails.beam_m || null,
        displcmt_m: boatDetails.displcmt_m || null,
        average_speed_knots: boatDetails.average_speed_knots || null,
        characteristics: boatDetails.characteristics || '',
        capabilities: boatDetails.capabilities || '',
        accommodations: boatDetails.accommodations || '',
        link_to_specs: boatDetails.link_to_specs || '',
        sa_displ_ratio: boatDetails.sa_displ_ratio || null,
        ballast_displ_ratio: boatDetails.ballast_displ_ratio || null,
        displ_len_ratio: boatDetails.displ_len_ratio || null,
        comfort_ratio: boatDetails.comfort_ratio || null,
        capsize_screening: boatDetails.capsize_screening || null,
        hull_speed_knots: boatDetails.hull_speed_knots || null,
        ppi_pounds_per_inch: boatDetails.ppi_pounds_per_inch || null,
      }
    });

  } catch (error: any) {
    logger.error('AI boat details filling failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Failed to fill boat details'),
      { status: 500 }
    );
  }
}
