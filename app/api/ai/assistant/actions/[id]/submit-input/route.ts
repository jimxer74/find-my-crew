import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

// POST /api/ai/assistant/actions/[id]/submit-input
// Submit input value for a pending action
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', userMessage: 'Please log in to submit input' },
        { status: 401 }
      );
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const actionId = resolvedParams.id;
    const { value } = await request.json();

    // Validate required fields
    if (!actionId) {
      return NextResponse.json(
        { error: 'Action ID is required', userMessage: 'Invalid action' },
        { status: 400 }
      );
    }

    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Input value is required', userMessage: 'Please provide a value' },
        { status: 400 }
      );
    }

    // Get the action to verify it exists and belongs to the user
    const { data: action, error: actionError } = await supabase
      .from('ai_pending_actions')
      .select('*')
      .eq('id', actionId)
      .eq('user_id', user.id)
      .single();

    if (actionError || !action) {
      return NextResponse.json(
        { error: 'Action not found', userMessage: 'This action no longer exists' },
        { status: 404 }
      );
    }

    // Validate action status
    if (action.status !== 'pending') {
      return NextResponse.json(
        { error: 'Action already processed', userMessage: 'This action has already been processed' },
        { status: 400 }
      );
    }

    // Validate input type and value
    let validatedValue = value;

    switch (action.input_type) {
      case 'text':
        if (typeof value !== 'string') {
          return NextResponse.json(
            { error: 'Invalid input type', userMessage: 'Please provide text input' },
            { status: 400 }
          );
        }
        validatedValue = value.trim();
        if (!validatedValue) {
          return NextResponse.json(
            { error: 'Input cannot be empty', userMessage: 'Please provide a non-empty value' },
            { status: 400 }
          );
        }
        break;

      case 'text_array':
      case 'select':
        if (!Array.isArray(value)) {
          return NextResponse.json(
            { error: 'Invalid input type', userMessage: 'Please select from the available options' },
            { status: 400 }
          );
        }
        if (value.length === 0) {
          return NextResponse.json(
            { error: 'At least one option must be selected', userMessage: 'Please select at least one option' },
            { status: 400 }
          );
        }
        validatedValue = value;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action type', userMessage: 'This action does not require input' },
          { status: 400 }
        );
    }

    // Update the action with the submitted value
    const { error: updateError } = await supabase
      .from('ai_pending_actions')
      .update({
        action_payload: {
          ...action.action_payload,
          newValue: validatedValue
        },
        status: 'approved', // Mark as approved since user provided input
        resolved_at: new Date().toISOString()
      })
      .eq('id', actionId);

    if (updateError) {
      console.error('Error updating action with input:', updateError);
      return NextResponse.json(
        { error: 'Failed to update action', userMessage: 'Failed to submit input. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Input submitted successfully',
      actionId: actionId
    });

  } catch (error) {
    console.error('Error submitting input:', error);
    return NextResponse.json(
      { error: 'Internal server error', userMessage: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}