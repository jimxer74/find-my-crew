import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * GET /api/user/email-preferences
 *
 * Returns the user's email notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: preferences, error } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching email preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Return defaults if no preferences exist
    const defaultPreferences = {
      user_id: user.id,
      registration_updates: true,
      journey_updates: true,
      profile_reminders: true,
    };

    return NextResponse.json({
      preferences: preferences || defaultPreferences,
    });

  } catch (error: any) {
    console.error('Error in email preferences API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/email-preferences
 *
 * Updates the user's email notification preferences
 *
 * Body:
 * - registration_updates?: boolean
 * - journey_updates?: boolean
 * - profile_reminders?: boolean
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { registration_updates, journey_updates, profile_reminders } = body;

    // Build update object with only provided fields
    const updateData: Record<string, any> = { user_id: user.id };
    if (typeof registration_updates === 'boolean') {
      updateData.registration_updates = registration_updates;
    }
    if (typeof journey_updates === 'boolean') {
      updateData.journey_updates = journey_updates;
    }
    if (typeof profile_reminders === 'boolean') {
      updateData.profile_reminders = profile_reminders;
    }

    // Upsert preferences
    const { data, error } = await supabase
      .from('email_preferences')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating email preferences:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      preferences: data,
    });

  } catch (error: any) {
    console.error('Error in email preferences API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
