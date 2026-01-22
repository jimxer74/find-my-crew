import { NextRequest, NextResponse } from 'next/server';
import { searchSailboatData } from '@/app/lib/sailboatdata_queries';

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

    console.log('=== SAILBOATDATA SEARCH API ===');
    console.log('Query:', queryTrimmed);
    console.log('================================');

    // Search sailboatdata.com using scraping
    const results = await searchSailboatData(queryTrimmed);

    // Transform to format expected by frontend
    const suggestions = results.map(result => ({
      name: result.name,
      url: result.url,
      slug: result.slug,
    }));

    console.log('=== SEARCH RESULTS ===');
    console.log('Found:', suggestions.length, 'suggestions');
    console.log('Suggestions:', suggestions);
    console.log('======================');

    return NextResponse.json({
      suggestions: suggestions
    });

  } catch (error: any) {
    console.error('Error searching sailboats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search sailboats' },
      { status: 500 }
    );
  }
}
