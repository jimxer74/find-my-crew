import { NextRequest, NextResponse } from 'next/server';
import { callAI, AIServiceError } from '@/app/lib/ai/service';

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
      console.log('=== AI SUGGEST-SAILBOATS DEBUG ===');
      console.log('Query:', queryTrimmed);
      console.log('Search URL:', searchUrl);
      console.log('Prompt sent to AI:');
      console.log(prompt);
      console.log('===================================');

      // Use centralized AI service
      let result;
      try {
        result = await callAI({
          useCase: 'suggest-sailboats',
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
        return NextResponse.json({
          suggestions: []
        });
      }

      const text = result.text;

      // Parse JSON array from response
      let jsonText = text.trim();
      console.log('=== JSON PARSING DEBUG ===');
      console.log('Original text length:', jsonText.length);
      console.log('First 200 chars:', jsonText.substring(0, 200));
      console.log('Last 200 chars:', jsonText.substring(Math.max(0, jsonText.length - 200)));
      
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        console.log('Removed json code block markers');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
        console.log('Removed code block markers');
      }
      
      console.log('Cleaned text length:', jsonText.length);
      console.log('Cleaned text:', jsonText);
      console.log('==========================');

      // Check if JSON appears truncated (ends abruptly without closing bracket/quote)
      if (jsonText.trim().endsWith('"') && !jsonText.trim().endsWith('"]')) {
        console.warn('=== TRUNCATED JSON DETECTED ===');
        console.warn('Response appears to be truncated. Attempting to fix...');
        // Try to close the JSON array properly
        const lastQuoteIndex = jsonText.lastIndexOf('"');
        if (lastQuoteIndex > 0) {
          // Remove the incomplete last item and close the array
          const fixedJson = jsonText.substring(0, lastQuoteIndex) + '"]';
          jsonText = fixedJson;
          console.warn('Fixed JSON:', jsonText);
        }
        console.warn('================================');
      } else if (jsonText.trim().endsWith(',') || jsonText.trim().endsWith('",')) {
        console.warn('=== TRUNCATED JSON DETECTED ===');
        console.warn('Response appears to be truncated. Attempting to fix...');
        // Remove trailing comma and close the array
        jsonText = jsonText.replace(/,\s*$/, '') + ']';
        console.warn('Fixed JSON:', jsonText);
        console.warn('================================');
      }

      let aiSuggestions;
      try {
        aiSuggestions = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error('=== JSON PARSE ERROR ===');
        console.error('Parse error:', parseError.message);
        console.error('Text that failed to parse:', jsonText);
        // Try to extract valid items from truncated JSON
        try {
          const arrayMatch = jsonText.match(/\[(.*)\]/s);
          if (arrayMatch) {
            const items = arrayMatch[1]
              .split(',')
              .map(item => {
                const match = item.match(/"([^"]+)"/);
                return match ? match[1] : null;
              })
              .filter(item => item !== null);
            if (items.length > 0) {
              console.log('Extracted valid items from truncated JSON:', items);
              aiSuggestions = items;
            }
          }
        } catch (extractError) {
          console.error('Failed to extract items from truncated JSON');
        }
        if (!aiSuggestions) {
          console.error('========================');
          return NextResponse.json({
            suggestions: []
          });
        }
      }
      
      // Debug: Log parsed suggestions
      console.log('=== PARSED SUGGESTIONS DEBUG ===');
      console.log('Parsed JSON:', aiSuggestions);
      console.log('Type:', typeof aiSuggestions);
      console.log('Is Array:', Array.isArray(aiSuggestions));
      if (Array.isArray(aiSuggestions)) {
        console.log('Number of suggestions:', aiSuggestions.length);
        console.log('Suggestions:', aiSuggestions);
        return NextResponse.json({
          suggestions: aiSuggestions.slice(0, 10)
        });
      } else {
        console.error('Parsed result is not an array:', aiSuggestions);
      }
      console.log('================================');
    } catch (aiError: any) {
      console.error('=== AI SUGGESTION ERROR ===');
      console.error('Error:', aiError.message);
      console.error('Stack:', aiError.stack);
      console.error('===========================');
      // Fallback to empty suggestions
    }

    // Fallback to empty suggestions
    return NextResponse.json({
      suggestions: []
    });

  } catch (error: any) {
    console.error('Error suggesting sailboats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to suggest sailboats' },
      { status: 500 }
    );
  }
}
