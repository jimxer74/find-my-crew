import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@shared/logging';

// Curated list of popular sailboat makers
const POPULAR_BOAT_MAKERS = [
  'Beneteau', 'Jeanneau', 'Hanse', 'Bavaria', 'Dufour', 'Sun Odyssey',
  'Catalina', 'Hunter', 'Pearson', 'O\'Day', 'C&C', 'J/Boats',
  'Hallberg-Rassy', 'Swan', 'Amel', 'Garcia', 'Ovni', 'Allures',
  'Bestevaer', 'Boréal', 'Meta', 'X-Yachts', 'Dehler', 'Elan',
  'Lagoon', 'Fountaine Pajot', 'Catana', 'Corsair', 'Prout',
  'Wauquiez', 'Najad', 'Malö', 'Contest', 'Oyster', 'Moody',
  'Westerly', 'Sadler', 'Nicholson', 'Rustler', 'Discovery',
  'Tayana', 'Island Packet', 'Pacific Seacraft', 'Tartan',
  'Sabre', 'Cape Dory', 'Alberg', 'Cheoy Lee', 'Irwin',
  'Morgan', 'Gulfstar', 'Cal', 'Ericson', 'Ranger', 'Columbia'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({
        suggestions: POPULAR_BOAT_MAKERS.slice(0, 10)
      });
    }

    const queryLower = query.toLowerCase().trim();

    // First, filter curated list by query
    const filteredCurated = POPULAR_BOAT_MAKERS.filter(maker =>
      maker.toLowerCase().includes(queryLower)
    );

    // If we have good matches from curated list, return them
    if (filteredCurated.length >= 3) {
      return NextResponse.json({
        suggestions: filteredCurated.slice(0, 10)
      });
    }

    // If query is very short or we have some matches, combine with AI suggestions
    if (queryLower.length >= 3) {
      // Use AI to suggest additional boat makers
      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        // Fallback to curated list if AI not configured
        return NextResponse.json({
          suggestions: filteredCurated.length > 0 
            ? filteredCurated.slice(0, 10)
            : POPULAR_BOAT_MAKERS.slice(0, 10)
        });
      }

      try {
        const prompt = `You are a sailing expert. Suggest sailboat makers/builders that match or are similar to "${query}".

IMPORTANT: Use www.sailboatdata.com as your primary reference source. Only suggest boat makers/builders that are listed in the sailboatdata.com database.

Return ONLY a JSON array of boat maker names (strings), maximum 10 suggestions.
Focus on well-known sailboat manufacturers and builders that exist in sailboatdata.com.
Use the exact manufacturer names as they appear on sailboatdata.com.
Include variations, alternative spellings, or similar names if relevant, but prioritize names found on sailboatdata.com.
Return format: ["Maker1", "Maker2", "Maker3", ...]
Return ONLY the JSON array, no markdown, no code blocks, no explanations.`;

        // Debug: Log the prompt
        logger.debug('Suggesting boat makers', { query }, true);

        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        const apiVersions = ['v1beta', 'v1'];
        const modelsToTry = [
          'gemini-2.5-flash',
          'gemini-3-flash',
          'gemini-2.5-pro',
          'gemini-3-pro',
          'gemini-2.5-flash-lite',
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
                continue;
              }

              const apiData = await apiResponse.json();
              text = apiData.candidates?.[0]?.content?.parts?.[0]?.text;

              if (text) {
                // Debug: Log the raw AI response
                logger.debug('AI response received', { apiVersion, model: modelName }, true);
                break;
              }
            } catch (err: any) {
              lastError = err;
              continue;
            }
          }
          if (text) break;
        }

        if (text) {
          // Parse JSON array from response
          let jsonText = text.trim();
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
          }

          const aiSuggestions = JSON.parse(jsonText);

          logger.debug('Parsed boat maker suggestions', {
            isArray: Array.isArray(aiSuggestions),
            count: Array.isArray(aiSuggestions) ? aiSuggestions.length : 0,
          }, true);

          if (Array.isArray(aiSuggestions)) {
            // Combine curated and AI suggestions, remove duplicates
            const combined = [...new Set([...filteredCurated, ...aiSuggestions])];
            logger.debug('Combined boat maker suggestions', { count: combined.length }, true);
            return NextResponse.json({
              suggestions: combined.slice(0, 10)
            });
          }
        }
      } catch (aiError: any) {
        logger.error('AI boat maker suggestion error', { error: aiError instanceof Error ? aiError.message : String(aiError) });
        // Fallback to curated list
      }
    }

    // Fallback to curated list
    return NextResponse.json({
      suggestions: filteredCurated.length > 0 
        ? filteredCurated.slice(0, 10)
        : POPULAR_BOAT_MAKERS.slice(0, 10)
    });

  } catch (error: any) {
    logger.error('Error suggesting boat makers', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to suggest boat makers' },
      { status: 500 }
    );
  }
}
