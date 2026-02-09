/**
 * Debug script to identify foreign key constraint issues
 * Run this to understand what's preventing auth user deletion
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function debugConstraints(userId: string) {
  console.log(`\n=== DEBUGGING CONSTRAINTS FOR USER: ${userId} ===\n`);

  // Check for remaining references to this user
  const tablesToCheck = [
    { table: 'profiles', column: 'id' },
    { table: 'feedback', column: 'status_changed_by' },
    { table: 'user_consents', column: 'user_id' },
    { table: 'consent_audit_log', column: 'user_id' },
    { table: 'email_preferences', column: 'user_id' },
    { table: 'notifications', column: 'user_id' },
    { table: 'ai_conversations', column: 'user_id' },
    { table: 'ai_pending_actions', column: 'user_id' },
    { table: 'feedback', column: 'user_id' },
    { table: 'feedback_votes', column: 'user_id' },
    { table: 'feedback_prompt_dismissals', column: 'user_id' },
    { table: 'registrations', column: 'user_id' },
    { table: 'boats', column: 'owner_id' },
  ];

  console.log('Checking for remaining references...\n');

  for (const { table, column } of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(column, userId);

      if (error) {
        console.log(`❌ ${table}.${column}: ERROR - ${error.message}`);
      } else if (count && count > 0) {
        console.log(`⚠️  ${table}.${column}: ${count} records still reference user`);
      } else {
        console.log(`✅ ${table}.${column}: No remaining references`);
      }
    } catch (checkError) {
      console.log(`❌ ${table}.${column}: EXCEPTION - ${checkError}`);
    }
  }

  // Check profile specifically
  console.log('\n--- Profile Check ---');
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.log(`❌ Profile query failed: ${error.message}`);
    } else if (profile) {
      console.log(`⚠️  Profile still exists: ${profile.username}`);
    } else {
      console.log(`✅ Profile deleted successfully`);
    }
  } catch (profileError) {
    console.log(`❌ Profile check exception: ${profileError}`);
  }

  // Check auth user
  console.log('\n--- Auth User Check ---');
  try {
    const { data: user, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      console.log(`❌ Auth user query failed: ${error.message}`);
    } else if (user?.user) {
      console.log(`⚠️  Auth user still exists: ${user.user.email}`);
    } else {
      console.log(`✅ Auth user deleted successfully`);
    }
  } catch (userError) {
    console.log(`❌ Auth user check exception: ${userError}`);
  }

  console.log('\n=== DEBUGGING COMPLETE ===\n');
}

// Usage: node debug-constraints.js <user-id>
const userId = process.argv[2];
if (!userId) {
  console.log('Usage: node debug-constraints.js <user-id>');
  process.exit(1);
}

debugConstraints(userId).catch(console.error);