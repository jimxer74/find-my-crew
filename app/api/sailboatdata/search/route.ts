import { NextRequest, NextResponse } from 'next/server';
import { searchSailboatData } from '@/app/lib/sailboatdata_queries';
import { lookupBoatRegistry } from '@/app/lib/boat-registry/service';
import { logger } from '@/app/lib/logger';

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

    logger.debug('SAILBOATDATA SEARCH API', { query: queryTrimmed });

    // First, check boat_registry for exact match (case-insensitive)
    try {
      // Try exact match first (case-sensitive)
      let registryEntry = await lookupBoatRegistry(queryTrimmed);
      
      // If no exact match, try case-insensitive lookup
      if (!registryEntry) {
        const { getSupabaseUnauthenticatedClient } = await import('@/app/lib/supabaseServer');
        const supabase = getSupabaseUnauthenticatedClient();
        
        // Case-insensitive search using ilike
        const { data } = await supabase
          .from('boat_registry')
          .select('*')
          .ilike('make_model', queryTrimmed)
          .limit(1)
          .maybeSingle();
        
        if (data) {
          registryEntry = data as any;
        }
      }
      
      if (registryEntry) {
        // Exact match found in registry - return it without calling external API
        logger.info('Exact match found in boat_registry', { boat: registryEntry.make_model });
        
        // Generate URL from slug if available, otherwise construct from make_model
        let url = '';
        let slug = registryEntry.slug || null;
        
        if (slug) {
          url = `https://sailboatdata.com/sailboat/${slug}`;
        } else if (registryEntry.link_to_specs) {
          url = registryEntry.link_to_specs;
          // Extract slug from URL if possible
          const slugMatch = url.match(/sailboat\/([^\/]+)/);
          if (slugMatch) {
            slug = slugMatch[1];
          }
        } else {
          // Fallback: construct URL from make_model
          const normalizedModel = registryEntry.make_model
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
          url = `https://sailboatdata.com/sailboat/${normalizedModel}`;
          slug = normalizedModel;
        }
        
        const suggestion = {
          name: registryEntry.make_model,
          url: url,
          slug: slug || '',
        };
        
        logger.debug('Registry match result', { suggestion });
        
        return NextResponse.json({
          suggestions: [suggestion],
          source: 'registry',
        });
      }
    } catch (registryError) {
      // Registry lookup failed - continue with external search (non-fatal)
      logger.warn('Registry lookup failed, continuing with external search', { error: registryError instanceof Error ? registryError.message : String(registryError) });
    }

    // No exact match in registry - search external API
    logger.debug('No exact match in registry, searching external API');
    const results = await searchSailboatData(queryTrimmed);

    // Transform to format expected by frontend
    const suggestions = results.map(result => ({
      name: result.name,
      url: result.url,
      slug: result.slug,
    }));

    logger.debug('External search results', { count: suggestions.length, suggestions });

    return NextResponse.json({
      suggestions: suggestions,
      source: 'external',
    });

  } catch (error: any) {
    logger.error('Error searching sailboats', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error.message || 'Failed to search sailboats' },
      { status: 500 }
    );
  }
}
