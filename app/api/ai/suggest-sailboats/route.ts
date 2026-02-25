import { NextRequest, NextResponse } from 'next/server';
import { callAI, AIServiceError } from '@shared/ai/service';
import { logger } from '@shared/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({
        suggestions: []
      });
    }

    const queryTrimmed = query.trim();

    try {
      const searchUrl = `https://sailboatdata.com/?keyword=${encodeURIComponent(queryTrimmed)}&sort-select&sailboats_per_page=50`;
      
      const prompt = `You are a sailing expert with access to www.sailboatdata.com database. 

A user is searching for sailboats using the keyword: "${queryTrimmed}"

The search URL on sailboatdata.com would be: ${searchUrl}

Your task: Based on your knowledge of sailboats listed in sailboatdata.com, suggest actual sailboat names that would appear in the MODEL column when searching sailboatdata.com with this keyword.

CRITICAL REQUIREMENTS:
1. Only suggest sailboats that actually exist in sailboatdata.com database
2. Use the exact format as they appear on sailboatdata.com: "Make Model" or "Make Model Number"
3. Examples of correct format: "Hallberg-Rassy 38", "Beneteau Oceanis 40", "Jeanneau Sun Odyssey 349", "Najad 380"
4. The suggestions should match or be similar to the keyword "${queryTrimmed}"
5. Return maximum 10 suggestions
6. Return ONLY a JSON array of strings, no markdown, no code blocks, no explanations

Return format: ["Make Model1", "Make Model2", "Make Model3", ...]`;

      // Debug: Log the prompt
      logger.debug(`Suggest sailboats API request`, { query: queryTrimmed, searchUrl }, true);

      // Use centralized AI service
      let result;
      try {
        result = await callAI({
          useCase: 'suggest-sailboats',
          prompt,
        });
        logger.aiFlow('SuggestSailboats', 'AI call succeeded', { provider: result.provider, model: result.model });
      } catch (error: any) {
        const errorMsg = error instanceof AIServiceError
          ? `${error.provider}/${error.model}: ${error.message}`
          : error.message;
        logger.error('AI suggest sailboats call failed', { error: errorMsg });
        return NextResponse.json({
          suggestions: []
        });
      }

      const text = result.text;

      // Parse JSON array from response
      let jsonText = text.trim();
      logger.debug('Parsing AI response', { originalLength: jsonText.length }, true);

      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        logger.debug('Removed json code block markers', {}, true);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
        logger.debug('Removed code block markers', {}, true);
      }

      logger.debug('JSON parsing cleaned', { cleanedLength: jsonText.length }, true);

      // Check if JSON appears truncated (ends abruptly without closing bracket/quote)
      if (jsonText.trim().endsWith('"') && !jsonText.trim().endsWith('"]')) {
        logger.warn('Truncated JSON detected - attempting to fix', {});
        // Try to close the JSON array properly
        const lastQuoteIndex = jsonText.lastIndexOf('"');
        if (lastQuoteIndex > 0) {
          // Remove the incomplete last item and close the array
          const fixedJson = jsonText.substring(0, lastQuoteIndex) + '"]';
          jsonText = fixedJson;
          logger.debug('Fixed truncated JSON', {}, true);
        }
      } else if (jsonText.trim().endsWith(',') || jsonText.trim().endsWith('",')) {
        logger.warn('Truncated JSON detected - attempting to fix', {});
        // Remove trailing comma and close the array
        jsonText = jsonText.replace(/,\s*$/, '') + ']';
        logger.debug('Fixed truncated JSON', {}, true);
      }

      let aiSuggestions;
      try {
        aiSuggestions = JSON.parse(jsonText);
      } catch (parseError: any) {
        logger.warn('JSON parse error - attempting fallback extraction', { error: parseError.message });
        // Try to extract valid items from truncated JSON
        try {
          const arrayMatch = jsonText.match(/\[([\s\S]*)\]/);
          if (arrayMatch) {
            const items = arrayMatch[1]
              .split(',')
              .map(item => {
                const match = item.match(/"([^"]+)"/);
                return match ? match[1] : null;
              })
              .filter(item => item !== null);
            if (items.length > 0) {
              logger.debug('Extracted valid items from truncated JSON', { count: items.length }, true);
              aiSuggestions = items;
            }
          }
        } catch (extractError) {
          logger.error('Failed to extract items from truncated JSON', { error: extractError instanceof Error ? extractError.message : String(extractError) });
        }
        if (!aiSuggestions) {
          return NextResponse.json({
            suggestions: []
          });
        }
      }
      
      // Debug: Log parsed suggestions
      logger.debug('Parsed AI suggestions', { isArray: Array.isArray(aiSuggestions) }, true);
      if (Array.isArray(aiSuggestions)) {
        logger.debug('Sailboat suggestions generated', { count: aiSuggestions.length }, true);
        return NextResponse.json({
          suggestions: aiSuggestions.slice(0, 10)
        });
      } else {
        logger.error('Parsed result is not an array', { type: typeof aiSuggestions });
      }
    } catch (aiError: any) {
      logger.error('AI suggestion error', { error: aiError instanceof Error ? aiError.message : String(aiError) });
      // Fallback to empty suggestions
    }

    // Fallback to empty suggestions
    return NextResponse.json({
      suggestions: []
    });

  } catch (error: any) {
    logger.error('Error suggesting sailboats', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to suggest sailboats' },
      { status: 500 }
    );
  }
}
