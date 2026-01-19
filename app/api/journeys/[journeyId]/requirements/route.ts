import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * GET /api/journeys/[journeyId]/requirements
 * 
 * Lists all requirements for a journey.
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
    if (journey.state !== 'Published') {
      if (!user || journey.boats.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Get requirements ordered by order field
    const { data: requirements, error: reqError } = await supabase
      .from('journey_requirements')
      .select('*')
      .eq('journey_id', journeyId)
      .order('order', { ascending: true });

    if (reqError) {
      console.error('Error fetching requirements:', reqError);
      return NextResponse.json(
        { error: 'Failed to fetch requirements', details: reqError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      requirements: requirements || [],
      count: requirements?.length || 0,
    });

  } catch (error: any) {
    console.error('Unexpected error in requirements API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/journeys/[journeyId]/requirements
 * 
 * Creates a new requirement for a journey.
 * Only journey owners can create requirements.
 * 
 * Body:
 * - question_text: string (required)
 * - question_type: 'text' | 'multiple_choice' | 'yes_no' | 'rating' (required)
 * - options: JSONB array (required for multiple_choice)
 * - is_required: boolean (default true)
 * - weight: integer 1-10 (default 5)
 * - order: integer (default 0)
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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can create requirements' },
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
    if (journey.boats.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to create requirements for this journey' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { question_text, question_type, options, is_required, weight, order } = body;

    // Validate required fields
    if (!question_text || !question_type) {
      return NextResponse.json(
        { error: 'question_text and question_type are required' },
        { status: 400 }
      );
    }

    // Validate question_type
    const validTypes = ['text', 'multiple_choice', 'yes_no', 'rating'];
    if (!validTypes.includes(question_type)) {
      return NextResponse.json(
        { error: `Invalid question_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate multiple_choice has options
    if (question_type === 'multiple_choice') {
      if (!options || !Array.isArray(options) || options.length === 0) {
        return NextResponse.json(
          { error: 'multiple_choice questions must have options array' },
          { status: 400 }
        );
      }
    }

    // Validate weight range
    const weightValue = weight !== undefined ? weight : 5;
    if (weightValue < 1 || weightValue > 10) {
      return NextResponse.json(
        { error: 'weight must be between 1 and 10' },
        { status: 400 }
      );
    }

    // Get current max order to set default
    const { data: existingRequirements } = await supabase
      .from('journey_requirements')
      .select('order')
      .eq('journey_id', journeyId)
      .order('order', { ascending: false })
      .limit(1);

    const maxOrder = existingRequirements && existingRequirements.length > 0
      ? existingRequirements[0].order + 1
      : 0;

    // Create requirement
    const { data: requirement, error: insertError } = await supabase
      .from('journey_requirements')
      .insert({
        journey_id: journeyId,
        question_text: question_text.trim(),
        question_type,
        options: question_type === 'multiple_choice' ? options : null,
        is_required: is_required !== undefined ? is_required : true,
        weight: weightValue,
        order: order !== undefined ? order : maxOrder,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating requirement:', insertError);
      return NextResponse.json(
        { error: 'Failed to create requirement', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      requirement,
      message: 'Requirement created successfully',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in requirements API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
