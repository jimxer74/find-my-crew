import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { updateRegistryDescriptiveFields } from '@/app/lib/boat-registry/service';

/**
 * API route to update descriptive fields (characteristics, capabilities, accommodations)
 * in the boat registry. This is called from client components after AI generates these fields.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { make_model, characteristics, capabilities, accommodations } = body;

    if (!make_model || typeof make_model !== 'string' || make_model.trim().length < 2) {
      return NextResponse.json(
        { error: 'make_model is required' },
        { status: 400 }
      );
    }

    // Update registry with descriptive fields
    await updateRegistryDescriptiveFields(make_model.trim(), {
      characteristics,
      capabilities,
      accommodations,
    });

    return NextResponse.json({
      success: true,
      message: 'Registry updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating registry descriptive fields:', { error });
    return NextResponse.json(
      { error: error.message || 'Failed to update registry' },
      { status: 500 }
    );
  }
}
