import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@shared/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { make, query } = body;

    if (!make || typeof make !== 'string' || make.trim().length === 0) {
      return NextResponse.json({
        suggestions: []
      });
    }

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({
        suggestions: []
      });
    }

    const makeTrimmed = make.trim();
    const queryLower = query.toLowerCase().trim();

    // Use AI to suggest boat models for the specific maker
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      return NextResponse.json({
        suggestions: []
      });
    }

    try {
      const prompt = `You are a sailing expert. Suggest specific sailboat model names from the manufacturer "${makeTrimmed}" that match or are similar to "${query}".

IMPORTANT: Use www.sailboatdata.com as your primary reference source. Only suggest boat models that are listed in the sailboatdata.com database for the manufacturer "${makeTrimmed}".

Return ONLY a JSON array of boat model names (strings), maximum 10 suggestions.
Focus on actual, well-known models from ${makeTrimmed} that exist in sailboatdata.com.
Use the exact model names as they appear on sailboatdata.com for ${makeTrimmed}.
Include model numbers, names, and variations if relevant, but prioritize models found on sailboatdata.com.
Return format: ["Model1", "Model2", "Model3", ...]
Return ONLY the JSON array, no markdown, no code blocks, no explanations.`;

      // Debug: Log the prompt
      logger.debug('Suggesting boat models', { make: makeTrimmed, query }, true);

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

        logger.debug('Parsed boat model suggestions', {
          isArray: Array.isArray(aiSuggestions),
          count: Array.isArray(aiSuggestions) ? aiSuggestions.length : 0,
        }, true);
        
        if (Array.isArray(aiSuggestions)) {
          return NextResponse.json({
            suggestions: aiSuggestions.slice(0, 10)
          });
        }
      }
    } catch (aiError: any) {
      logger.error('AI boat model suggestion error', { error: aiError instanceof Error ? aiError.message : String(aiError) });
      // Fallback to empty suggestions
    }

    // Fallback to empty suggestions
    return NextResponse.json({
      suggestions: []
    });

  } catch (error: any) {
    logger.error('Error suggesting boat models', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to suggest boat models' },
      { status: 500 }
    );
  }
}
