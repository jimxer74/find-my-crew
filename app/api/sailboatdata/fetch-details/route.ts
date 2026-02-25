import { NextRequest, NextResponse } from 'next/server';
import { fetchSailboatDetails } from '@/app/lib/sailboatdata_queries';
import { lookupBoatRegistry } from '@/app/lib/boat-registry/service';
import { logger } from '@shared/logging';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { make_model, slug } = body;

    if (!make_model || typeof make_model !== 'string' || make_model.trim().length < 2) {
      return NextResponse.json(
        { error: 'Make and Model is required' },
        { status: 400 }
      );
    }

    const makeModelTrimmed = make_model.trim();
    const slugTrimmed = slug && typeof slug === 'string' ? slug.trim() : undefined;

    logger.debug('FETCH SAILBOAT DETAILS API', { makeModel: makeModelTrimmed, slug: slugTrimmed || '(will be generated from make_model)' });

    // Check registry first (fetchSailboatDetails will also check, but we can log source here)
    let source = 'external';
    try {
      const registryEntry = await lookupBoatRegistry(makeModelTrimmed, slugTrimmed);
      if (registryEntry) {
        source = 'registry';
        logger.info('Using cached data from boat registry');
      }
    } catch (error) {
      // Registry check failed, continue with fetchSailboatDetails
      logger.warn('Registry check failed, continuing', { error: error instanceof Error ? error.message : String(error) });
    }

    // Fetch details (will check registry internally and fallback to external if needed)
    const details = await fetchSailboatDetails(makeModelTrimmed, slugTrimmed);

    if (!details) {
      return NextResponse.json(
        { error: 'Sailboat not found on sailboatdata.com' },
        { status: 404 }
      );
    }

    // Return the details in the same format as the AI endpoint
    return NextResponse.json({
      boatDetails: {
        type: details.type || null,
        capacity: details.capacity ?? null,
        loa_m: details.loa_m ?? null,
        beam_m: details.beam_m ?? null,
        max_draft_m: details.max_draft_m ?? null,
        displcmt_m: details.displcmt_m ?? null,
        average_speed_knots: details.average_speed_knots ?? null,
        characteristics: details.characteristics || '',
        capabilities: details.capabilities || '',
        accommodations: details.accommodations || '',
        link_to_specs: details.link_to_specs || '',
        sa_displ_ratio: details.sa_displ_ratio ?? null,
        ballast_displ_ratio: details.ballast_displ_ratio ?? null,
        displ_len_ratio: details.displ_len_ratio ?? null,
        comfort_ratio: details.comfort_ratio ?? null,
        capsize_screening: details.capsize_screening ?? null,
        hull_speed_knots: details.hull_speed_knots ?? null,
        ppi_pounds_per_inch: details.ppi_pounds_per_inch ?? null,
      },
      source, // Include source information (registry or external)
    });

  } catch (error: any) {
    logger.error('Error fetching sailboat details', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sailboat details' },
      { status: 500 }
    );
  }
}
