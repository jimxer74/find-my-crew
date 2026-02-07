import { getSupabaseAdmin, listAuthUsers, deleteAuthUser } from './supabase-admin.js';

/**
 * Tables in order of deletion (child tables first due to FK constraints)
 * This ensures we don't violate foreign key constraints when truncating.
 */
const TABLES_IN_DELETE_ORDER = [
  // Leaf tables (no other tables reference these)
  'consent_audit_log',
  'feedback_prompt_dismissals',
  'feedback_votes',
  'ai_pending_actions',
  'ai_messages',
  'waypoints',

  // Tables that reference leaf tables
  'feedback',
  'ai_conversations',
  'registrations',

  // Mid-level tables
  'legs',
  'notifications',
  'email_preferences',
  'user_consents',

  // Tables that reference profiles/boats
  'journeys',
  'boats',

  // Top-level tables (profiles references auth.users)
  'profiles',
] as const;

/**
 * Email domain used to identify test users
 */
const TEST_USER_EMAIL_DOMAIN = '@test.sailsmart.local';

export interface CleanupOptions {
  /** If true, also deletes auth.users with test email domain */
  deleteAuthUsers?: boolean;
  /** Custom email domain to identify test users */
  testEmailDomain?: string;
  /** If true, shows what would be deleted without actually deleting */
  dryRun?: boolean;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

/**
 * Clean up all test data from the database.
 * Tables are truncated in the correct order to respect FK constraints.
 */
export async function cleanupTestData(options: CleanupOptions = {}): Promise<{
  tablesCleared: string[];
  usersDeleted: number;
}> {
  const {
    deleteAuthUsers = true,
    testEmailDomain = TEST_USER_EMAIL_DOMAIN,
    dryRun = false,
    onProgress = console.log,
  } = options;

  const admin = getSupabaseAdmin();
  const tablesCleared: string[] = [];
  let usersDeleted = 0;

  onProgress(`Starting cleanup${dryRun ? ' (DRY RUN)' : ''}...`);

  // First, delete data from tables in correct order
  for (const table of TABLES_IN_DELETE_ORDER) {
    onProgress(`  Clearing table: ${table}`);

    if (!dryRun) {
      const { error } = await admin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        // Ignore "no rows deleted" errors
        if (!error.message.includes('0 rows')) {
          onProgress(`    Warning: ${error.message}`);
        }
      }
    }

    tablesCleared.push(table);
  }

  // Then, delete auth users with test email domain
  if (deleteAuthUsers) {
    onProgress(`  Deleting auth users with domain: ${testEmailDomain}`);

    const users = await listAuthUsers();
    const testUsers = users.filter(u => u.email.endsWith(testEmailDomain));

    onProgress(`    Found ${testUsers.length} test users`);

    for (const user of testUsers) {
      if (!dryRun) {
        try {
          await deleteAuthUser(user.id);
          usersDeleted++;
        } catch (err) {
          onProgress(`    Warning: Failed to delete user ${user.email}: ${err}`);
        }
      } else {
        usersDeleted++;
      }
    }
  }

  onProgress(`Cleanup complete: ${tablesCleared.length} tables cleared, ${usersDeleted} users deleted`);

  return { tablesCleared, usersDeleted };
}

/**
 * Delete all data from a specific table
 */
export async function clearTable(tableName: string): Promise<number> {
  const admin = getSupabaseAdmin();

  // Use a dummy condition to delete all rows
  const { data, error } = await admin
    .from(tableName)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');

  if (error) {
    throw new Error(`Failed to clear table ${tableName}: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Get count of records in a table
 */
export async function getTableCount(tableName: string): Promise<number> {
  const admin = getSupabaseAdmin();

  const { count, error } = await admin
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count table ${tableName}: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Get counts for all main tables
 */
export async function getAllTableCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const table of TABLES_IN_DELETE_ORDER) {
    try {
      counts[table] = await getTableCount(table);
    } catch {
      counts[table] = -1; // Indicates error
    }
  }

  return counts;
}
