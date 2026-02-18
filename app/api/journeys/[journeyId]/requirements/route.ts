import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { hasOwnerRole } from '@/app/lib/auth/checkRole';
import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@/app/lib/logger';

const VALID_REQUIREMENT_TYPES = ['risk_level', 'experience_level', 'skill', 'passport', 'question'] as const;
type RequirementType = typeof VALID_REQUIREMENT_TYPES[number];

// Requirement types that can only appear once per journey
const SINGLETON_TYPES: RequirementType[] = ['risk_level', 'experience_level', 'passport'];

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
    const boat = journey.boats as unknown as { owner_id: string };
    if (journey.state !== 'Published') {
      if (!user || boat.owner_id !== user.id) {
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
        sanitizeErrorResponse(reqError, 'Failed to fetch requirements'),
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
      sanitizeErrorResponse(error, 'Internal server error'),
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
 * - requirement_type: 'risk_level' | 'experience_level' | 'skill' | 'passport' | 'question' (required)
 * - question_text: string (required for 'question' type)
 * - skill_name: string (required for 'skill' type, canonical name from skills-config)
 * - qualification_criteria: string (required for 'skill' and 'question' types)
 * - weight: integer 0-10 (for 'skill' and 'question' types, default 5)
 * - require_photo_validation: boolean (for 'passport' type, default false)
 * - pass_confidence_score: integer 0-10 (for 'passport' type, default 7)
 * - is_required: boolean (default true)
 * - order: integer (default auto-increment)
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
        skills,
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
        { error: 'You do not have permission to create requirements for this journey' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      requirement_type,
      question_text,
      skill_name,
      qualification_criteria,
      weight,
      require_photo_validation,
      pass_confidence_score,
      is_required,
      order,
    } = body;

    // Validate requirement_type
    if (!requirement_type || !VALID_REQUIREMENT_TYPES.includes(requirement_type)) {
      return NextResponse.json(
        { error: `Invalid requirement_type. Must be one of: ${VALID_REQUIREMENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Enforce singleton types (only one per journey)
    if (SINGLETON_TYPES.includes(requirement_type)) {
      const { count: existingCount } = await supabase
        .from('journey_requirements')
        .select('*', { count: 'exact', head: true })
        .eq('journey_id', journeyId)
        .eq('requirement_type', requirement_type);

      if (existingCount && existingCount > 0) {
        return NextResponse.json(
          { error: `A ${requirement_type} requirement already exists for this journey. Only one is allowed.` },
          { status: 409 }
        );
      }
    }

    // Type-specific validation
    if (requirement_type === 'question') {
      if (!question_text?.trim()) {
        return NextResponse.json(
          { error: 'question_text is required for question type requirements' },
          { status: 400 }
        );
      }
      if (!qualification_criteria?.trim()) {
        return NextResponse.json(
          { error: 'qualification_criteria is required for question type requirements' },
          { status: 400 }
        );
      }
    }

    if (requirement_type === 'skill') {
      if (!skill_name?.trim()) {
        return NextResponse.json(
          { error: 'skill_name is required for skill type requirements' },
          { status: 400 }
        );
      }
      if (!qualification_criteria?.trim()) {
        return NextResponse.json(
          { error: 'qualification_criteria is required for skill type requirements' },
          { status: 400 }
        );
      }
      // Validate skill_name exists in the journey's skills
      const journeySkills = (journey as any).skills || [];
      if (journeySkills.length > 0 && !journeySkills.includes(skill_name)) {
        return NextResponse.json(
          { error: `skill_name '${skill_name}' is not in this journey's skills list` },
          { status: 400 }
        );
      }
    }

    // Validate weight range
    const weightValue = weight !== undefined ? weight : 5;
    if (weightValue < 0 || weightValue > 10) {
      return NextResponse.json(
        { error: 'weight must be between 0 and 10' },
        { status: 400 }
      );
    }

    // Validate passport-specific fields
    const confidenceScore = pass_confidence_score !== undefined ? pass_confidence_score : 7;
    if (requirement_type === 'passport' && (confidenceScore < 0 || confidenceScore > 10)) {
      return NextResponse.json(
        { error: 'pass_confidence_score must be between 0 and 10' },
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
      ? (existingRequirements[0] as any).order + 1
      : 0;

    // Build insert payload based on requirement_type
    const insertPayload: Record<string, any> = {
      journey_id: journeyId,
      requirement_type,
      is_required: is_required !== undefined ? is_required : true,
      order: order !== undefined ? order : maxOrder,
    };

    // Type-specific fields
    if (requirement_type === 'question') {
      insertPayload.question_text = question_text.trim();
      insertPayload.qualification_criteria = qualification_criteria.trim();
      insertPayload.weight = weightValue;
    } else if (requirement_type === 'skill') {
      insertPayload.skill_name = skill_name.trim();
      insertPayload.qualification_criteria = qualification_criteria.trim();
      insertPayload.weight = weightValue;
    } else if (requirement_type === 'passport') {
      insertPayload.require_photo_validation = require_photo_validation || false;
      insertPayload.pass_confidence_score = confidenceScore;
    }
    // risk_level and experience_level don't need extra fields

    // Create requirement
    const { data: requirement, error: insertError } = await supabase
      .from('journey_requirements')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating requirement:', insertError);
      return NextResponse.json(
        sanitizeErrorResponse(insertError, 'Failed to create requirement'),
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
      sanitizeErrorResponse(error, 'Internal server error'),
      { status: 500 }
    );
  }
}
