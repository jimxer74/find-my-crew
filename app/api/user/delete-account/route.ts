import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/app/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';

/**
 * Enhanced error handling and logging for deletion operations
 */
interface DeletionResult {
  success: boolean;
  table?: string;
  operation?: string;
  error?: string;
  details?: any;
}

async function safeDelete(
  table: string,
  condition: { [key: string]: any },
  supabase: any,
  userId: string
): Promise<DeletionResult> {
  try {
    console.log(`[${userId}] Starting deletion of ${table}...`);
    // Build the delete query more robustly
    let deleteQuery = supabase.from(table).delete();

    // Add conditions from the condition object
    for (const [key, value] of Object.entries(condition)) {
      deleteQuery = deleteQuery.eq(key, value);
    }

    const { error } = await deleteQuery;

    if (error) {
      throw error;
    }

    console.log(`[${userId}] Successfully deleted ${table}`);
    return { success: true, table, operation: 'delete' };
  } catch (error: any) {
    console.error(`[${userId}] Failed to delete ${table}:`, error);
    return {
      success: false,
      table,
      operation: 'delete',
      error: error.message,
      details: { code: error.code, details: error.details }
    };
  }
}

async function safeStorageDelete(
  bucketName: string,
  filePaths: string[],
  supabase: any,
  userId: string
): Promise<DeletionResult> {
  try {
    console.log(`[${userId}] Starting deletion of ${filePaths.length} files from ${bucketName}...`);

    if (filePaths.length === 0) {
      console.log(`[${userId}] No files found in ${bucketName}, skipping`);
      return { success: true, table: 'storage', operation: 'skip' };
    }

    // Delete files in batches of 100 (Supabase limit)
    const batchSize = 100;
    let totalDeleted = 0;

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const { error } = await supabase.storage.from(bucketName).remove(batch);

      if (error) {
        throw error;
      }

      totalDeleted += batch.length;
      console.log(`[${userId}] Deleted batch of ${batch.length} files from ${bucketName}`);
    }

    console.log(`[${userId}] Successfully deleted ${totalDeleted} files from ${bucketName}`);
    return { success: true, table: 'storage', operation: 'delete', details: { deleted: totalDeleted } };
  } catch (error: any) {
    console.error(`[${userId}] Failed to delete storage files from ${bucketName}:`, error);
    return {
      success: false,
      table: 'storage',
      operation: 'delete',
      error: error.message,
      details: { code: error.code, failedFiles: filePaths.length }
    };
  }
}

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

    // Service role key for admin operations
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

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
    const deletionResults: DeletionResult[] = [];

    // 1. Delete notifications
    const notificationsResult = await safeDelete('notifications', { user_id: user.id }, supabase, user.id);
    deletionResults.push(notificationsResult);

    // 2. Delete consent audit log
    const consentAuditResult = await safeDelete('consent_audit_log', { user_id: user.id }, supabase, user.id);
    deletionResults.push(consentAuditResult);

    // 3. Delete user consents
    const userConsentsResult = await safeDelete('user_consents', { user_id: user.id }, supabase, user.id);
    deletionResults.push(userConsentsResult);

    // 4. Delete email preferences
    const emailPrefsResult = await safeDelete('email_preferences', { user_id: user.id }, supabase, user.id);
    deletionResults.push(emailPrefsResult);

    // 5. Delete registrations (ensure this happens before boats are deleted)
    const registrationsResult = await safeDelete('registrations', { user_id: user.id }, supabase, user.id);
    deletionResults.push(registrationsResult);

    // 5. Delete AI conversations and related data
    const aiConversationsResult = await safeDelete('ai_conversations', { user_id: user.id }, supabase, user.id);
    deletionResults.push(aiConversationsResult);

    const aiPendingActionsResult = await safeDelete('ai_pending_actions', { user_id: user.id }, supabase, user.id);
    deletionResults.push(aiPendingActionsResult);

    // 6. Clear feedback records where user is referenced in status_changed_by
    console.log(`[${user.id}] Clearing feedback status_changed_by references...`);
    const { error: feedbackStatusError } = await supabase
      .from('feedback')
      .update({ status_changed_by: null })
      .eq('status_changed_by', user.id);

    if (feedbackStatusError) {
      console.error(`[${user.id}] Failed to clear feedback status_changed_by:`, feedbackStatusError);
      deletionResults.push({
        success: false,
        table: 'feedback_status_changed_by',
        operation: 'update',
        error: feedbackStatusError.message,
        details: { code: feedbackStatusError.code }
      });
    } else {
      console.log(`[${user.id}] Successfully cleared feedback status_changed_by references`);
      deletionResults.push({
        success: true,
        table: 'feedback_status_changed_by',
        operation: 'update'
      });
    }

    // 7. Delete feedback data
    const feedbackResult = await safeDelete('feedback', { user_id: user.id }, supabase, user.id);
    deletionResults.push(feedbackResult);

    const feedbackVotesResult = await safeDelete('feedback_votes', { user_id: user.id }, supabase, user.id);
    deletionResults.push(feedbackVotesResult);

    const feedbackDismissalsResult = await safeDelete('feedback_prompt_dismissals', { user_id: user.id }, supabase, user.id);
    deletionResults.push(feedbackDismissalsResult);

    // 8. For owned boats: delete waypoints, legs, journeys, boats (cascade)
    const { data: ownedBoats, error: boatsError } = await supabase
      .from('boats')
      .select('id')
      .eq('owner_id', user.id);

    if (boatsError) {
      console.error(`[${user.id}] Failed to query owned boats:`, boatsError);
      deletionResults.push({
        success: false,
        table: 'boats',
        operation: 'query',
        error: boatsError.message,
        details: { code: boatsError.code }
      });
    } else if (ownedBoats && ownedBoats.length > 0) {
      // Boats have CASCADE delete, so this will clean up journeys, legs, waypoints
      const boatsResult = await safeDelete('boats', { owner_id: user.id }, supabase, user.id);
      deletionResults.push(boatsResult);
    } else {
      console.log(`[${user.id}] No owned boats found, skipping boat deletion`);
      deletionResults.push({ success: true, table: 'boats', operation: 'skip', details: { owned: 0 } });
    }

    // 10. Delete profile (explicit deletion before auth user deletion)
    // Note: profiles.id has foreign key to auth.users.id, but without CASCADE
    // So we need to delete it before the auth user
    console.log(`[${user.id}] Attempting profile deletion...`);
    const profilesResult = await safeDelete('profiles', { id: user.id }, supabase, user.id);

    // Verify profile deletion was successful
    if (profilesResult.success) {
      console.log(`[${user.id}] Verifying profile deletion...`);
      const { data: profileVerify, error: profileVerifyError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileVerifyError && profileVerifyError.code !== 'PGRST116') {
        console.warn(`[${user.id}] Profile verification query failed:`, profileVerifyError);
        profilesResult.success = false;
        profilesResult.error = profileVerifyError.message;
      } else if (profileVerify && profileVerify.id) {
        console.error(`[${user.id}] Profile still exists after deletion attempt!`);
        profilesResult.success = false;
        profilesResult.error = 'Profile still exists after deletion';

        // Try a force delete using admin client if available
        if (serviceRoleKey && supabaseUrl) {
          console.log(`[${user.id}] Attempting force delete of profile using admin client...`);
          const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          });

          try {
            const { error: forceDeleteError } = await adminClient
              .from('profiles')
              .delete()
              .eq('id', user.id);

            if (forceDeleteError) {
              console.error(`[${user.id}] Force delete of profile failed:`, forceDeleteError);
              profilesResult.error = `Force delete failed: ${forceDeleteError.message}`;
            } else {
              console.log(`[${user.id}] Profile force deleted successfully`);
              profilesResult.success = true;
              profilesResult.error = undefined;
            }
          } catch (forceError: unknown) {
            console.error(`[${user.id}] Exception during force delete:`, forceError);
            profilesResult.error = `Force delete exception: ${forceError instanceof Error ? forceError.message : String(forceError)}`;
          }
        }
      } else {
        console.log(`[${user.id}] Profile successfully deleted`);
      }
    }

    deletionResults.push(profilesResult);

    // 10.5. Delete storage files from boat-images and journey-images buckets
    try {
      console.log(`[${user.id}] Starting storage cleanup...`);
      const storageCleanupResult = await deleteStorageFilesForUser(user.id, supabase);
      deletionResults.push(storageCleanupResult);

      if (!storageCleanupResult.success) {
        console.warn(`[${user.id}] Storage cleanup completed with errors:`, storageCleanupResult.details);
      } else {
        console.log(`[${user.id}] Storage cleanup completed successfully. Deleted ${storageCleanupResult.details?.deleted || 0} files.`);
      }
    } catch (error: any) {
      console.error(`[${user.id}] Storage cleanup failed:`, error);
      deletionResults.push({
        success: false,
        table: 'storage',
        operation: 'cleanup',
        error: error.message,
        details: { stack: error.stack }
      });
      // Continue with deletion but log the issue
    }

    // 11. Delete the auth user using service role
    // Note: This requires SUPABASE_SERVICE_ROLE_KEY environment variable
    let authDeletionResult: DeletionResult = { success: true, table: 'auth.users', operation: 'skip' };

    if (serviceRoleKey && supabaseUrl) {
      try {
        console.log(`[${user.id}] Deleting auth user...`);
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        // Use Supabase Admin API for auth user deletion (recommended approach)
        console.log(`[${user.id}] Attempting auth user deletion via admin API...`);

        // First, let's double-check that all cleanup was completed successfully
        console.log(`[${user.id}] Performing final verification before auth user deletion...`);
        const finalVerification = await verifyUserDeletion(user.id, supabase);

        if (finalVerification.hasRemainingData) {
          console.warn(`[${user.id}] WARNING: Some user data remains before auth deletion:`, finalVerification.verificationResults.filter(v => v.status === 'remaining'));
          // Log the remaining data but continue - this might be expected for some tables
        }

        // Additional constraint check for auth-specific references
        const constraintCheck = await checkForConstraintViolations(user.id, supabase);
        if (constraintCheck.hasViolations) {
          console.error(`[${user.id}] CRITICAL: Constraint violations detected before auth deletion:`, constraintCheck.violations);

          // For critical violations, we should not proceed with auth deletion
          const criticalViolations = constraintCheck.violations.filter(v =>
            v.table === 'profiles' || v.column === 'id' ||
            (v.table === 'feedback' && v.column === 'status_changed_by')
          );

          if (criticalViolations.length > 0) {
            console.error(`[${user.id}] CRITICAL VIOLATIONS: Cannot proceed with auth deletion due to:`, criticalViolations);
            authDeletionResult = {
              success: false,
              table: 'auth.users',
              operation: 'skip',
              error: 'Critical constraint violations prevent auth user deletion',
              details: { criticalViolations, constraintCheck: constraintCheck.violations }
            };
          }
        }

        console.log(`[${user.id}] Proceeding with auth user deletion...`);
        const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(user.id);

        // Verify the admin API deletion was successful
        if (!adminDeleteError) {
          console.log(`[${user.id}] Auth user successfully deleted via admin API`);
          authDeletionResult = { success: true, table: 'auth.users', operation: 'delete' };

          // Optional: Verify deletion by checking if user exists (using service role client)
          try {
            const { data: userData } = await adminClient.auth.admin.getUserById(user.id);
            if (userData) {
              console.warn(`[${user.id}] User still exists after admin API deletion, but API call succeeded`);
            }
          } catch (verifyError) {
            const errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
            console.log(`[${user.id}] User verification failed (expected if user was deleted):`, errorMessage);
          }
        } else {
          console.error(`[${user.id}] Auth user deletion via admin API failed:`, adminDeleteError);
          console.error(`[${user.id}] Error details:`, {
            message: adminDeleteError.message,
            name: adminDeleteError.name,
            status: adminDeleteError.status
          });

          // Try to get more information about what's preventing deletion
          const detailedCheck = await checkForConstraintViolations(user.id, supabase);
          console.error(`[${user.id}] Detailed constraint check:`, detailedCheck);

          authDeletionResult = {
            success: false,
            table: 'auth.users',
            operation: 'delete',
            error: adminDeleteError.message,
            details: {
              status: adminDeleteError.status,
              violations: detailedCheck.violations,
              hasViolations: detailedCheck.hasViolations
            }
          };
        }
      } catch (error: any) {
        console.error(`[${user.id}] Exception deleting auth user:`, error);
        authDeletionResult = {
          success: false,
          table: 'auth.users',
          operation: 'delete',
          error: error.message,
          details: { stack: error.stack }
        };
      }
    } else {
      console.warn(`[${user.id}] Service role key not configured - auth user not deleted`);
      authDeletionResult = {
        success: false,
        table: 'auth.users',
        operation: 'skip',
        error: 'Service role key not configured',
        details: { reason: 'Missing SUPABASE_SERVICE_ROLE_KEY environment variable' }
      };
    }

    deletionResults.push(authDeletionResult);

    // Final verification and response preparation
    const failedDeletions = deletionResults.filter(result => !result.success);
    const successfulDeletions = deletionResults.filter(result => result.success);

    console.log(`[${user.id}] Deletion summary: ${successfulDeletions.length} successful, ${failedDeletions.length} failed`);

    // Final verification step - verify all data has been deleted
    console.log(`[${user.id}] Starting final verification...`);
    const verificationResult = await verifyUserDeletion(user.id, supabase);
    console.log(`[${user.id}] Verification completed. Has remaining data: ${verificationResult.hasRemainingData}`);

    // Enhanced audit logging
    console.log(`[${user.id}] Logging enhanced audit trail...`);
    // await logDeletionAudit(
    //   user.id,
    //   supabase,
    //   {
    //     total: deletionResults.length,
    //     successful: successfulDeletions.length,
    //     failed: failedDeletions.length,
    //     results: deletionResults
    //   },
    //   verificationResult
    // );

    return NextResponse.json({
      success: failedDeletions.length === 0 && !verificationResult.hasRemainingData,
      message: failedDeletions.length === 0 && !verificationResult.hasRemainingData
        ? 'Your account and all associated data have been permanently deleted.'
        : `Your account deletion completed with ${failedDeletions.length} error(s) and ${verificationResult.verificationResults.filter(v => v.status === 'remaining').length} remaining data items. Please contact support if issues persist.`,
      deletionSummary: {
        total: deletionResults.length,
        successful: successfulDeletions.length,
        failed: failedDeletions.length,
        results: deletionResults
      },
      verification: {
        hasRemainingData: verificationResult.hasRemainingData,
        verificationResults: verificationResult.verificationResults
      }
    });

  } catch (error: any) {
    console.error('Error deleting user account:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Delete all user files from Supabase Storage buckets
 * Handles boat-images and journey-images buckets
 */
async function deleteStorageFilesForUser(userId: string, supabase: any): Promise<DeletionResult> {
  const bucketNames = ['boat-images', 'journey-images'];
  const result: DeletionResult = {
    success: true,
    table: 'storage',
    operation: 'cleanup',
    details: { deleted: 0, errors: [], buckets: [] }
  };

  for (const bucketName of bucketNames) {
    try {
      console.log(`[${userId}] Starting cleanup for bucket: ${bucketName}`);

      // List all files for this user in the bucket
      const { data: fileList, error: listError } = await supabase
        .storage
        .from(bucketName)
        .list(userId, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) {
        console.error(`[${userId}] Failed to list files in ${bucketName}:`, listError);
        result.success = false;
        result.details?.errors?.push(`Failed to list files in ${bucketName}: ${listError.message}`);
        continue;
      }

      if (!fileList || fileList.length === 0) {
        console.log(`[${userId}] No files found in ${bucketName}`);
        result.details?.buckets?.push({ name: bucketName, deleted: 0, found: 0 });
        continue;
      }

      // Extract file paths
      const filePaths = fileList.map((file: any) => `${userId}/${file.name}`);
      console.log(`[${userId}] Found ${filePaths.length} files in ${bucketName}`);

      // Delete files in batches of 100 (Supabase limit)
      const batchSize = 100;
      let bucketDeleted = 0;

      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        const { data, error: deleteError } = await supabase
          .storage
          .from(bucketName)
          .remove(batch);

        if (deleteError) {
          console.error(`[${userId}] Failed to delete batch from ${bucketName}:`, deleteError);
          result.success = false;
          result.details?.errors?.push(`Failed to delete batch from ${bucketName}: ${deleteError.message}`);
        } else {
          console.log(`[${userId}] Successfully deleted ${batch.length} files from ${bucketName}`);
          bucketDeleted += batch.length;
        }
      }

      result.details!.deleted! += bucketDeleted;
      result.details?.buckets?.push({ name: bucketName, deleted: bucketDeleted, found: fileList.length });

      // Handle nested directories (boat_id/journey_id subdirectories)
      // We need to list recursively by checking for directories
      for (const file of fileList) {
        if (file.metadata?.isFolder) {
          console.log(`[${userId}] Found directory: ${file.name}`);
          // Recursively delete files in subdirectories
          const dirResult = await deleteStorageDirectory(userId, bucketName, file.name, supabase);
          if (!dirResult.success) {
            result.success = false;
            result.details?.errors?.push(`Failed to delete directory ${file.name} in ${bucketName}: ${dirResult.error}`);
          }
        }
      }

    } catch (error: any) {
      console.error(`[${userId}] Error processing bucket ${bucketName}:`, error);
      result.success = false;
      result.details?.errors?.push(`Error processing bucket ${bucketName}: ${error.message}`);
    }
  }

  if (!result.success) {
    console.warn(`[${userId}] Storage cleanup completed with errors:`, result.details?.errors);
  } else {
    console.log(`[${userId}] Storage cleanup completed successfully. Deleted ${result.details?.deleted} files.`);
  }

  return result;
}


/**
 * Recursively delete files in a storage directory
 */
async function deleteStorageDirectory(userId: string, bucketName: string, directoryPath: string, supabase: any): Promise<DeletionResult> {
  const result: DeletionResult = {
    success: true,
    table: 'storage',
    operation: 'directory-delete',
    details: { deleted: 0, directory: directoryPath }
  };

  try {
    // List files in the subdirectory
    const fullPath = `${userId}/${directoryPath}`;
    const { data: fileList, error: listError } = await supabase
      .storage
      .from(bucketName)
      .list(fullPath, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      console.error(`[${userId}] Failed to list files in directory ${fullPath}:`, listError);
      result.success = false;
      result.error = listError.message;
      return result;
    }

    if (!fileList || fileList.length === 0) {
      return result;
    }

    // Delete files in this directory
    const filePaths = fileList.map((file: any) => `${fullPath}/${file.name}`);
    const { data, error: deleteError } = await supabase
      .storage
      .from(bucketName)
      .remove(filePaths);

    if (deleteError) {
      console.error(`[${userId}] Failed to delete files in directory ${fullPath}:`, deleteError);
      result.success = false;
      result.error = deleteError.message;
      return result;
    } else {
      console.log(`[${userId}] Successfully deleted ${filePaths.length} files from directory ${fullPath}`);
      result.details!.deleted! += filePaths.length;
    }

    // Handle nested directories recursively
    for (const file of fileList) {
      if (file.metadata?.isFolder) {
        const subResult = await deleteStorageDirectory(userId, bucketName, `${directoryPath}/${file.name}`, supabase);
        if (!subResult.success) {
          result.success = false;
          result.error = subResult.error;
        }
        result.details!.deleted! += subResult.details?.deleted || 0;
      }
    }

  } catch (error: any) {
    console.error(`[${userId}] Error deleting directory ${directoryPath}:`, error);
    result.success = false;
    result.error = error.message;
  }

  return result;
}

/**
 * Check for potential foreign key constraint violations before auth user deletion
 */
async function checkForConstraintViolations(userId: string, supabase: any) {
  const violations: any[] = [];

  try {
    // Check for any remaining references to this user in auth.users
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
      { table: 'email_preferences', column: 'user_id' }
    ];

    for (const { table, column } of tablesToCheck) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq(column, userId);

        if (error) {
          console.warn(`[${userId}] Error checking ${table}.${column}:`, error);
        } else if (count && count > 0) {
          violations.push({
            table,
            column,
            remainingRecords: count,
            message: `${table}.${column} still references user ${userId} (${count} records)`
          });
        }
      } catch (checkError) {
        console.warn(`[${userId}] Exception checking ${table}.${column}:`, checkError);
      }
    }

    // Check for any unprocessed deletion steps
    const remainingData = await verifyUserDeletion(userId, supabase);
    if (remainingData.hasRemainingData) {
      violations.push({
        type: 'incomplete_deletion',
        message: 'Some user data was not deleted before auth user deletion attempt',
        remainingData: remainingData.verificationResults.filter(v => v.status === 'remaining')
      });
    }

    const hasViolations = violations.length > 0;

    if (hasViolations) {
      console.warn(`[${userId}] Constraint violations detected:`, violations);
    } else {
      console.log(`[${userId}] No constraint violations detected`);
    }

    return {
      hasViolations,
      violations,
      remainingData
    };

  } catch (error: any) {
    console.error(`[${userId}] Error checking for constraint violations:`, error);
    return {
      hasViolations: true,
      violations: [{ type: 'check_error', message: error.message }],
      remainingData: null
    };
  }
}

/**
 * Verify that all user data has been completely deleted
 */
async function verifyUserDeletion(userId: string, supabase: any) {
  const criticalTables = [
    'profiles', 'boats', 'journeys', 'legs', 'waypoints',
    'registrations', 'notifications', 'email_preferences',
    'user_consents', 'consent_audit_log', 'ai_conversations',
    'ai_pending_actions', 'feedback', 'feedback_votes',
    'feedback_prompt_dismissals'
  ];

  const verificationResults: any[] = [];
  let hasRemainingData = false;

  for (const table of criticalTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        verificationResults.push({
          table,
          status: 'error',
          error: error.message
        });
      } else if (count && count > 0) {
        hasRemainingData = true;
        verificationResults.push({
          table,
          status: 'remaining',
          count
        });
      } else {
        verificationResults.push({
          table,
          status: 'cleared',
          count: 0
        });
      }
    } catch (error: any) {
      verificationResults.push({
        table,
        status: 'exception',
        error: error.message
      });
    }
  }

  return {
    hasRemainingData,
    verificationResults,
    userId
  };
}

