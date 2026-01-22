import { NextRequest, NextResponse } from 'next/server';
import { fetchSailboatDetails } from '@/app/lib/sailboatdata_queries';

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

    console.log('=== FETCH SAILBOAT DETAILS API ===');
    console.log('Make/Model:', makeModelTrimmed);
    console.log('Slug:', slugTrimmed || '(will be generated from make_model)');
    console.log('==================================');

    // Fetch details from sailboatdata.com (use slug if provided for more reliable URL)
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
      }
    });

  } catch (error: any) {
    console.error('Error fetching sailboat details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sailboat details' },
      { status: 500 }
    );
  }
}
