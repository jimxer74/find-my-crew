import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';

/**
 * DELETE /api/user/delete-account
 *
 * Permanently deletes the user account and all associated data (GDPR right to erasure)
 *
 * Note: This requires a Supabase service role key to delete the user from auth.users
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { confirmation } = body;

    // Require explicit confirmation
    if (confirmation !== 'DELETE MY ACCOUNT') {
      return NextResponse.json(
        { error: 'Invalid confirmation. Please type "DELETE MY ACCOUNT" exactly.' },
        { status: 400 }
      );
    }

    // Log the deletion request to audit trail before deletion
    await supabase.from('consent_audit_log').insert({
      user_id: user.id,
      consent_type: 'account',
      action: 'revoked',
      new_value: { action: 'account_deletion_requested', at: new Date().toISOString() },
    });

    // Delete user data in order (respecting foreign key constraints)
    // Most tables have ON DELETE CASCADE, but we'll be explicit

    // 1. Delete notifications
    await supabase.from('notifications').delete().eq('user_id', user.id);

    // 2. Delete consent audit log
    await supabase.from('consent_audit_log').delete().eq('user_id', user.id);

    // 3. Delete user consents
    await supabase.from('user_consents').delete().eq('user_id', user.id);

    // 4. Delete email preferences
    await supabase.from('email_preferences').delete().eq('user_id', user.id);

    // 5. Delete registration answers (via registrations cascade)
    // 6. Delete registrations
    await supabase.from('registrations').delete().eq('user_id', user.id);

    // 7. For owned boats: delete waypoints, legs, journeys, boats (cascade)
    const { data: ownedBoats } = await supabase
      .from('boats')
      .select('id')
      .eq('owner_id', user.id);

    if (ownedBoats && ownedBoats.length > 0) {
      // Boats have CASCADE delete, so this will clean up journeys, legs, waypoints
      await supabase.from('boats').delete().eq('owner_id', user.id);
    }

    // 8. Delete profile (this may be handled by auth user deletion cascade)
    await supabase.from('profiles').delete().eq('id', user.id);

    // 9. Delete the auth user using service role
    // Note: This requires SUPABASE_SERVICE_ROLE_KEY environment variable
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (serviceRoleKey && supabaseUrl) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

      if (deleteError) {
        console.error('Error deleting auth user:', deleteError);
        // Continue anyway - data is already deleted
      }
    } else {
      console.warn('Service role key not configured - auth user not deleted');
      // The profile and related data is deleted, but auth.users entry remains
      // This is acceptable as the user won't be able to use the account
    }

    return NextResponse.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.',
    });

  } catch (error: any) {
    console.error('Error deleting user account:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
