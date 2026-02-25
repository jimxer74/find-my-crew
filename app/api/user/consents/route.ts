import { sanitizeErrorResponse } from '@/app/lib/errorResponseHelper';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
import { ConsentType, CookiePreferences } from '@shared/types/consents';

/**
 * GET /api/user/consents
 *
 * Returns the current user's consent settings
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user consents
    const { data: consents, error: consentsError } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (consentsError && consentsError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's ok for new users
      logger.error('Error fetching consents:', { error: consentsError });
      return NextResponse.json(
        { error: 'Failed to fetch consents' },
        { status: 500 }
      );
    }

    const hasAcceptedRequired = !!(
      consents?.privacy_policy_accepted_at &&
      consents?.terms_accepted_at
    );

    return NextResponse.json({
      consents: consents || null,
      hasAcceptedRequired,
    });

  } catch (error: any) {
    logger.error('Error in consents API:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/consents
 *
 * Updates a specific consent setting
 *
 * Body:
 * - consent_type: 'ai_processing' | 'profile_sharing' | 'marketing' | 'cookies'
 * - value: boolean (for ai_processing, profile_sharing, marketing) or CookiePreferences (for cookies)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { consent_type, value } = body as { consent_type: ConsentType; value: boolean | CookiePreferences };

    // Validate consent type
    const validTypes: ConsentType[] = ['ai_processing', 'profile_sharing', 'marketing', 'cookies'];
    if (!validTypes.includes(consent_type)) {
      return NextResponse.json(
        { error: `Invalid consent_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get current consents
    const { data: currentConsents } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const now = new Date().toISOString();

    // Build update object based on consent type
    let updateData: Record<string, any> = {};
    let oldValue: any = null;
    let newValue: any = null;

    if (consent_type === 'cookies') {
      oldValue = currentConsents?.cookie_preferences || null;
      newValue = value as CookiePreferences;
      updateData = {
        cookie_preferences: value,
        cookie_preferences_at: now,
      };
    } else {
      const consentField = `${consent_type}_consent`;
      const timestampField = `${consent_type}_consent_at`;

      oldValue = currentConsents ? currentConsents[consentField] : null;
      newValue = value as boolean;
      updateData = {
        [consentField]: value,
        [timestampField]: now,
      };
    }

    // Upsert the consent
    const { error: updateError } = await supabase
      .from('user_consents')
      .upsert({
        user_id: user.id,
        ...updateData,
      }, {
        onConflict: 'user_id',
      });

    if (updateError) {
      logger.error('Error updating consent:', { error: updateError });
      return NextResponse.json(
        { error: 'Failed to update consent' },
        { status: 500 }
      );
    }

    // Log to audit trail
    const action = consent_type === 'cookies' ? 'updated' : (value ? 'granted' : 'revoked');
    await supabase.from('consent_audit_log').insert({
      user_id: user.id,
      consent_type,
      action,
      old_value: oldValue !== null ? { value: oldValue } : null,
      new_value: { value: newValue, at: now },
    });

    // Fetch updated consents
    const { data: updatedConsents } = await supabase
      .from('user_consents')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      success: true,
      consents: updatedConsents,
    });

  } catch (error: any) {
    logger.error('Error updating consent:', { error });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}
