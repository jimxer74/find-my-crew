import { NextRequest, NextResponse } from 'next/server';

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
        console.log('=== AI SUGGEST-BOAT-MAKERS DEBUG ===');
        console.log('Query:', query);
        console.log('Prompt sent to AI:');
        console.log(prompt);
        console.log('====================================');

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
                console.log('=== AI RESPONSE DEBUG ===');
                console.log('API Version:', apiVersion);
                console.log('Model:', modelName);
                console.log('Raw AI Response:');
                console.log(text);
                console.log('==========================');
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
          
          // Debug: Log parsed suggestions
          console.log('=== PARSED SUGGESTIONS DEBUG ===');
          console.log('Parsed JSON:', aiSuggestions);
          console.log('Is Array:', Array.isArray(aiSuggestions));
          if (Array.isArray(aiSuggestions)) {
            console.log('Number of suggestions:', aiSuggestions.length);
            console.log('AI Suggestions:', aiSuggestions);
            console.log('Curated matches:', filteredCurated);
          }
          console.log('================================');
          
          if (Array.isArray(aiSuggestions)) {
            // Combine curated and AI suggestions, remove duplicates
            const combined = [...new Set([...filteredCurated, ...aiSuggestions])];
            console.log('Final combined suggestions:', combined);
            return NextResponse.json({
              suggestions: combined.slice(0, 10)
            });
          }
        }
      } catch (aiError: any) {
        console.error('AI suggestion error:', aiError);
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
    console.error('Error suggesting boat makers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to suggest boat makers' },
      { status: 500 }
    );
  }
}
