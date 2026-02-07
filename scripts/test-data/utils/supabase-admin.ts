import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

/**
 * Get Supabase admin client using service role key.
 * This bypasses RLS and allows full database access.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY environment variable is required.\n' +
      'This key can be found in your Supabase project settings under API keys.'
    );
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Create a new auth user using Supabase Admin API
 */
export async function createAuthUser(
  email: string,
  password: string,
  metadata?: Record<string, unknown>
): Promise<{ id: string; email: string }> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email for test users
    user_metadata: metadata,
  });

  if (error) {
    throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  }

  if (!data.user) {
    throw new Error(`No user returned when creating ${email}`);
  }

  return {
    id: data.user.id,
    email: data.user.email!,
  };
}

/**
 * Delete an auth user by ID
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Failed to delete auth user ${userId}: ${error.message}`);
  }
}

/**
 * List all auth users (for cleanup purposes)
 */
export async function listAuthUsers(): Promise<{ id: string; email: string }[]> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.admin.listUsers();

  if (error) {
    throw new Error(`Failed to list auth users: ${error.message}`);
  }

  return data.users.map(u => ({
    id: u.id,
    email: u.email!,
  }));
}
