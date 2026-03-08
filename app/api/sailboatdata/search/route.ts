import { NextRequest, NextResponse } from 'next/server';
import { searchSailboatData } from '@/app/lib/sailboatdata_queries';
import { logger } from '@shared/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const queryTrimmed = query.trim();
    logger.debug('SAILBOATDATA SEARCH API', { query: queryTrimmed });

    // Always search Algolia first — it is comprehensive and fast.
    // Registry is only used as a fallback when Algolia returns no results.
    const results = await searchSailboatData(queryTrimmed);

    if (results.length > 0) {
      logger.debug('Algolia search results', { count: results.length });
      return NextResponse.json({
        suggestions: results.map(r => ({ name: r.name, url: r.url, slug: r.slug })),
        source: 'external',
      });
    }

    // Algolia returned nothing — fall back to boat_registry
    logger.debug('Algolia returned no results, falling back to boat_registry');
    try {
      const { getSupabaseUnauthenticatedClient } = await import('@/app/lib/supabaseServer');
      const supabase = getSupabaseUnauthenticatedClient();

      const { data } = await supabase
        .from('boat_registry')
        .select('make_model, slug, link_to_specs')
        .ilike('make_model', `%${queryTrimmed}%`)
        .limit(10);

      if (data && data.length > 0) {
        const registrySuggestions = data.map((entry: any) => {
          let slug = entry.slug || null;
          let url = '';

          if (slug) {
            url = `https://sailboatdata.com/sailboat/${slug}`;
          } else if (entry.link_to_specs) {
            url = entry.link_to_specs;
            const m = url.match(/sailboat\/([^/]+)/);
            if (m) slug = m[1];
          } else {
            slug = entry.make_model.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            url = `https://sailboatdata.com/sailboat/${slug}`;
          }

          return { name: entry.make_model, url, slug: slug || '' };
        });

        logger.debug('Registry fallback results', { count: registrySuggestions.length });
        return NextResponse.json({ suggestions: registrySuggestions, source: 'registry' });
      }
    } catch (registryError) {
      logger.warn('Registry fallback failed', {
        error: registryError instanceof Error ? registryError.message : String(registryError),
      });
    }

    return NextResponse.json({ suggestions: [], source: 'external' });

  } catch (error: any) {
    logger.error('Error searching sailboats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error.message || 'Failed to search sailboats' },
      { status: 500 },
    );
  }
}
