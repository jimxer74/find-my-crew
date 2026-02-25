import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';

/**
 * GET /api/journeys/[journeyId]/images
 *
 * Retrieves all images for a journey.
 * Public access if journey is published, otherwise owner only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const journeyId = resolvedParams.journeyId;

    const supabase = await getSupabaseServerClient();

    // Get authenticated user (optional for public access)
    const { data: { user } } = await supabase.auth.getUser();

    // Verify journey exists and check if it's published
    const { data: journey, error: journeyError } = await supabase
      .from('journeys')
      .select(`
        id,
        state,
        boat_id,
        boats!inner (
          owner_id
        )
      `)
      .eq('id', journeyId)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      );
    }

    // Check access: public if published, otherwise owner only
    const boat = journey.boats as unknown as { owner_id: string };
    if (journey.state !== 'Published') {
      if (!user || boat.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Get journey with images
    const { data: journeyWithImages, error: fetchError } = await supabase
      .from('journeys')
      .select('images')
      .eq('id', journeyId)
      .single();

    if (fetchError) {
      logger.error('Error fetching journey images:', fetchError);
      return NextResponse.json(
        sanitizeErrorResponse(fetchError, 'Failed to fetch journey images'),
        { status: 500 }
      );
    }

    return NextResponse.json({
      images: journeyWithImages?.images || [],
      count: journeyWithImages?.images?.length || 0,
    });

  } catch (error: any) {
    logger.error('Unexpected error in journey images GET API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/journeys/[journeyId]/images
 *
 * Uploads new images to a journey.
 * Only journey owners can upload images.
 *
 * Body: Form data with image files
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const journeyId = resolvedParams.journeyId;

    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is an owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (!profile || !hasOwnerRole(profile)) {
      return NextResponse.json(
        { error: 'Only owners can upload images' },
        { status: 403 }
      );
    }

    // Verify journey exists and belongs to user
    const { data: journey, error: journeyError } = await supabase
      .from('journeys')
      .select(`
        id,
        boat_id,
        boats!inner (
          owner_id
        )
      `)
      .eq('id', journeyId)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      );
    }

    // Verify owner owns this journey
    const boat = journey.boats as unknown as { owner_id: string };
    if (boat.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to upload images for this journey' },
        { status: 403 }
      );
    }

    // Handle form data
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No image files provided' },
        { status: 400 }
      );
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      // Validate file
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload image files only.' },
          { status: 400 }
        );
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return NextResponse.json(
          { error: 'File too large. Maximum size is 5MB per image.' },
          { status: 400 }
        );
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('journey-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        logger.error('Upload error:', uploadError);
        return NextResponse.json(
          sanitizeErrorResponse(uploadError, 'Failed to upload image'),
          { status: 500 }
        );
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('journey-images')
        .getPublicUrl(uploadData.path);

      uploadedUrls.push(publicUrl);
    }

    // Update journey with new images
    const { data: updatedJourney, error: updateError } = await supabase
      .from('journeys')
      .update({
        images: uploadedUrls,
        updated_at: new Date().toISOString(),
      })
      .eq('id', journeyId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating journey with images:', updateError);
      return NextResponse.json(
        sanitizeErrorResponse(updateError, 'Failed to update journey with images'),
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Images uploaded successfully',
      journeyId: updatedJourney.id,
      images: updatedJourney.images,
      count: updatedJourney.images?.length || 0,
    }, { status: 201 });

  } catch (error: any) {
    logger.error('Unexpected error in journey images POST API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/journeys/[journeyId]/images
 *
 * Removes all images from a journey.
 * Only journey owners can delete images.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ journeyId: string }> }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const journeyId = resolvedParams.journeyId;

    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is an owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();

    if (!profile || !hasOwnerRole(profile)) {
      return NextResponse.json(
        { error: 'Only owners can delete images' },
        { status: 403 }
      );
    }

    // Verify journey exists and belongs to user
    const { data: journey, error: journeyError } = await supabase
      .from('journeys')
      .select(`
        id,
        boat_id,
        boats!inner (
          owner_id
        )
      `)
      .eq('id', journeyId)
      .single();

    if (journeyError || !journey) {
      return NextResponse.json(
        { error: 'Journey not found' },
        { status: 404 }
      );
    }

    // Verify owner owns this journey
    const boat = journey.boats as unknown as { owner_id: string };
    if (boat.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to delete images for this journey' },
        { status: 403 }
      );
    }

    // Get current images to delete from storage
    const { data: currentJourney } = await supabase
      .from('journeys')
      .select('images')
      .eq('id', journeyId)
      .single();

    // Delete images from storage (optional - you might want to keep them)
    // This is commented out to keep images in storage for potential reuse
    /*
    if (currentJourney?.images && currentJourney.images.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from('journey-images')
        .remove(currentJourney.images.map(url => url.split('/').pop()!));

      if (deleteError) {
        logger.warn('Failed to delete old images from storage:', { error: deleteError });
      }
    }
    */

    // Update journey to remove all images
    const { data: updatedJourney, error: updateError } = await supabase
      .from('journeys')
      .update({
        images: [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', journeyId)
      .select()
      .single();

    if (updateError) {
      logger.error('Error removing journey images:', updateError);
      return NextResponse.json(
        sanitizeErrorResponse(updateError, 'Failed to remove journey images'),
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'All images removed successfully',
      journeyId: updatedJourney.id,
      images: updatedJourney.images,
      count: 0,
    });

  } catch (error: any) {
    logger.error('Unexpected error in journey images DELETE API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}