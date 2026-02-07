import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';

/**
 * GET /api/user/data-export
 *
 * Exports all user data as JSON (GDPR data portability requirement)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user data
    const [
      profileResult,
      consentsResult,
      boatsResult,
      registrationsResult,
      notificationsResult,
      emailPrefsResult,
      consentAuditResult,
    ] = await Promise.all([
      // Profile data
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),

      // Consent data
      supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user.id)
        .single(),

      // Boats owned by user
      supabase
        .from('boats')
        .select(`
          *,
          journeys (
            *,
            legs (
              *,
              waypoints (*)
            )
          )
        `)
        .eq('owner_id', user.id),

      // Registrations made by user
      supabase
        .from('registrations')
        .select(`
          *,
          legs (
            name,
            journeys (
              name
            )
          )
        `)
        .eq('user_id', user.id),

      // Notifications
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Email preferences
      supabase
        .from('email_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single(),

      // Consent audit log
      supabase
        .from('consent_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    // Compile all data
    const exportData = {
      exportedAt: new Date().toISOString(),
      userId: user.id,
      email: user.email,

      profile: profileResult.data || null,
      consents: consentsResult.data || null,
      emailPreferences: emailPrefsResult.data || null,

      boats: boatsResult.data || [],
      registrations: registrationsResult.data || [],
      notifications: notificationsResult.data || [],

      consentHistory: consentAuditResult.data || [],

      // Account metadata
      accountCreatedAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
    };

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="SailSmart-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error: any) {
    console.error('Error exporting user data:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
