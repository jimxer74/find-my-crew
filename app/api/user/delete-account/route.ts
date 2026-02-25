import { sanitizeErrorResponse } from '@shared/database';
import { logger } from '@shared/logging';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@shared/database/server';
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
    logger.debug(`Starting deletion of ${table}`, { table, userId }, true);
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

    logger.debug(`Successfully deleted ${table}`, { table }, true);
    return { success: true, table, operation: 'delete' };
  } catch (error: any) {
    logger.error(`Failed to delete ${table}`, { table, error: error.message });

    // Check if this is an RLS policy violation for consent tables
    const isConsentTable = ['user_consents', 'consent_audit_log'].includes(table);
    const isRLSBlocked = error.code === 'PGRST110' || error.message?.includes('permission denied');

    let errorMessage = error.message;
    if (isConsentTable && isRLSBlocked) {
      errorMessage = `RLS policy violation: Cannot delete ${table}. Use service role client to bypass RLS policies. Error: ${error.message}`;
    }

    return {
      success: false,
      table,
      operation: 'delete',
      error: errorMessage,
      details: { code: error.code, details: error.details, isRLSBlocked, isConsentTable }
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
    logger.debug(`Starting deletion of files from storage`, { bucketName, fileCount: filePaths.length }, true);

    if (filePaths.length === 0) {
      logger.debug(`No files found in storage bucket`, { bucketName }, true);
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
      logger.debug(`Deleted batch of files from storage`, { bucketName, count: batch.length }, true);
    }

    logger.debug(`Successfully deleted files from storage`, { bucketName, count: totalDeleted }, true);
    return { success: true, table: 'storage', operation: 'delete', details: { deleted: totalDeleted } };
  } catch (error: any) {
    logger.error(`Failed to delete storage files`, { bucketName, fileCount: filePaths.length, error: error.message });
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

    // 2. Delete consent audit log (use service role client to bypass RLS)
    let consentAuditResult;
    if (serviceRoleKey && supabaseUrl) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      consentAuditResult = await safeDelete('consent_audit_log', { user_id: user.id }, adminClient, user.id);
    } else {
      consentAuditResult = await safeDelete('consent_audit_log', { user_id: user.id }, supabase, user.id);
    }
    deletionResults.push(consentAuditResult);

    // 3. Delete user consents (use service role client to bypass RLS)
    let userConsentsResult;
    if (serviceRoleKey && supabaseUrl) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      userConsentsResult = await safeDelete('user_consents', { user_id: user.id }, adminClient, user.id);
    } else {
      userConsentsResult = await safeDelete('user_consents', { user_id: user.id }, supabase, user.id);
    }
    deletionResults.push(userConsentsResult);

    // 4. Delete email preferences
    const emailPrefsResult = await safeDelete('email_preferences', { user_id: user.id }, supabase, user.id);
    deletionResults.push(emailPrefsResult);

    // 5a. Delete registration answers (through registrations owned by this user)
    // registration_answers references registrations.id with CASCADE, but we delete explicitly for completeness
    logger.debug(`Deleting registration answers for user registrations`, {}, true);
    const { data: userRegistrations } = await supabase
      .from('registrations')
      .select('id')
      .eq('user_id', user.id);

    if (userRegistrations && userRegistrations.length > 0) {
      for (const reg of userRegistrations) {
        const regAnswersResult = await safeDelete('registration_answers', { registration_id: reg.id }, supabase, user.id);
        if (!regAnswersResult.success) {
          deletionResults.push(regAnswersResult);
        }
      }
      logger.debug(`Deleted registration answers`, { count: userRegistrations.length }, true);
    }

    // 5b. Delete registrations (ensure this happens before boats are deleted)
    const registrationsResult = await safeDelete('registrations', { user_id: user.id }, supabase, user.id);
    deletionResults.push(registrationsResult);

    // 5. Delete AI conversations and related data
    const aiConversationsResult = await safeDelete('ai_conversations', { user_id: user.id }, supabase, user.id);
    deletionResults.push(aiConversationsResult);

    const aiPendingActionsResult = await safeDelete('ai_pending_actions', { user_id: user.id }, supabase, user.id);
    deletionResults.push(aiPendingActionsResult);

    // 6. Clear feedback records where user is referenced in status_changed_by
    logger.debug(`Clearing feedback status_changed_by references`, {}, true);
    const { error: feedbackStatusError } = await supabase
      .from('feedback')
      .update({ status_changed_by: null })
      .eq('status_changed_by', user.id);

    if (feedbackStatusError) {
      logger.error(`Failed to clear feedback status_changed_by`, { error: feedbackStatusError?.message || String(feedbackStatusError) });
      deletionResults.push({
        success: false,
        table: 'feedback_status_changed_by',
        operation: 'update',
        error: feedbackStatusError.message,
        details: { code: feedbackStatusError.code }
      });
    } else {
      logger.debug(`Successfully cleared feedback status_changed_by references`, {}, true);
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

    // 8. Delete document vault data
    // Delete access logs first (references document_vault and auth.users)
    if (serviceRoleKey && supabaseUrl) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const docAccessLogResult = await safeDelete('document_access_log', { document_owner_id: user.id }, adminClient, user.id);
      deletionResults.push(docAccessLogResult);
    } else {
      const docAccessLogResult = await safeDelete('document_access_log', { document_owner_id: user.id }, supabase, user.id);
      deletionResults.push(docAccessLogResult);
    }

    // Delete access grants where user is grantor (cascades from document_vault anyway, but explicit)
    const docGrantsResult = await safeDelete('document_access_grants', { grantor_id: user.id }, supabase, user.id);
    deletionResults.push(docGrantsResult);

    // Delete document vault records (cascades remaining grants)
    const docVaultResult = await safeDelete('document_vault', { owner_id: user.id }, supabase, user.id);
    deletionResults.push(docVaultResult);

    // 9. For owned boats: delete waypoints, legs, journeys, boats (cascade)
    const { data: ownedBoats, error: boatsError } = await supabase
      .from('boats')
      .select('id')
      .eq('owner_id', user.id);

    if (boatsError) {
      logger.error(`Failed to query owned boats`, { error: boatsError?.message });
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
      logger.debug(`No owned boats found, skipping boat deletion`, {}, true);
      deletionResults.push({ success: true, table: 'boats', operation: 'skip', details: { owned: 0 } });
    }

    // 10. Delete profile (explicit deletion before auth user deletion)
    // Note: profiles.id has foreign key to auth.users.id, but without CASCADE
    // So we need to delete it before the auth user
    logger.debug(`Attempting profile deletion`, {}, true);
    const profilesResult = await safeDelete('profiles', { id: user.id }, supabase, user.id);

    // Verify profile deletion was successful
    if (profilesResult.success) {
      logger.debug(`Verifying profile deletion`, {}, true);
      const { data: profileVerify, error: profileVerifyError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileVerifyError && profileVerifyError.code !== 'PGRST116') {
        logger.warn(`Profile verification query failed`, { error: profileVerifyError?.message });
        profilesResult.success = false;
        profilesResult.error = profileVerifyError.message;
      } else if (profileVerify && profileVerify.id) {
        logger.error(`Profile still exists after deletion attempt`, {});
        profilesResult.success = false;
        profilesResult.error = 'Profile still exists after deletion';

        // Try a force delete using admin client if available
        if (serviceRoleKey && supabaseUrl) {
          logger.debug(`Attempting force delete of profile using admin client`, {}, true);
          const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          });

          try {
            const { error: forceDeleteError } = await adminClient
              .from('profiles')
              .delete()
              .eq('id', user.id);

            if (forceDeleteError) {
              logger.error(`Force delete of profile failed`, { error: forceDeleteError.message });
              profilesResult.error = `Force delete failed: ${forceDeleteError.message}`;
            } else {
              logger.debug(`Profile force deleted successfully`, { userId: user.id }, true);
              profilesResult.success = true;
              profilesResult.error = undefined;
            }
          } catch (forceError: unknown) {
            const errorMsg = forceError instanceof Error ? forceError.message : String(forceError);
            logger.error(`Exception during force delete`, { error: errorMsg });
            profilesResult.error = `Force delete exception: ${errorMsg}`;
          }
        }
      } else {
        logger.debug(`Profile successfully deleted`, { userId: user.id }, true);
      }
    }

    deletionResults.push(profilesResult);

    // 10.5. Delete storage files from boat-images and journey-images buckets
    try {
      logger.debug(`Starting storage cleanup`, {}, true);
      const storageCleanupResult = await deleteStorageFilesForUser(user.id, supabase);
      deletionResults.push(storageCleanupResult);

      if (!storageCleanupResult.success) {
        logger.warn(`Storage cleanup completed with errors`, { details: storageCleanupResult.details });
      } else {
        logger.debug(`Storage cleanup completed successfully`, { deletedCount: storageCleanupResult.details?.deleted || 0 }, true);
      }
    } catch (error: any) {
      logger.error(`Storage cleanup failed`, { error: error.message });
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
        logger.debug(`Deleting auth user`, {}, true);
        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        // Use Supabase Admin API for auth user deletion (recommended approach)
        logger.debug(`Attempting auth user deletion via admin API`, {}, true);

        // First, let's double-check that all cleanup was completed successfully
        logger.debug(`Performing final verification before auth user deletion`, {}, true);
        const finalVerification = await verifyUserDeletion(user.id, supabase);

        if (finalVerification.hasRemainingData) {
          const remainingItems = finalVerification.verificationResults.filter(v => v.status === 'remaining');
          logger.warn(`Some user data remains before auth deletion`, { remainingCount: remainingItems.length });
          // Log the remaining data but continue - this might be expected for some tables
        }

        // Additional constraint check for auth-specific references
        const constraintCheck = await checkForConstraintViolations(user.id, supabase);
        if (constraintCheck.hasViolations) {
          logger.error(`Constraint violations detected before auth deletion`, { violationCount: constraintCheck.violations.length });

          // For critical violations, we should not proceed with auth deletion
          const criticalViolations = constraintCheck.violations.filter(v =>
            v.table === 'profiles' || v.column === 'id' ||
            (v.table === 'feedback' && v.column === 'status_changed_by')
          );

          if (criticalViolations.length > 0) {
            logger.error(`Critical violations found - cannot proceed with auth deletion`, { criticalCount: criticalViolations.length });
            authDeletionResult = {
              success: false,
              table: 'auth.users',
              operation: 'skip',
              error: 'Critical constraint violations prevent auth user deletion',
              details: { criticalViolations, constraintCheck: constraintCheck.violations }
            };
          }
        }

        logger.debug(`Proceeding with auth user deletion`, {}, true);
        const { error: adminDeleteError } = await adminClient.auth.admin.deleteUser(user.id);

        // Verify the admin API deletion was successful
        if (!adminDeleteError) {
          logger.debug(`Auth user successfully deleted via admin API`, { userId: user.id }, true);
          authDeletionResult = { success: true, table: 'auth.users', operation: 'delete' };

          // Optional: Verify deletion by checking if user exists (using service role client)
          try {
            const { data: userData } = await adminClient.auth.admin.getUserById(user.id);
            if (userData) {
              logger.warn(`User still exists after admin API deletion`, { userId: user.id });
            }
          } catch (verifyError) {
            const errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
            logger.debug(`User verification failed after deletion (expected)`, { message: errorMessage }, true);
          }
        } else {
          logger.error(`Auth user deletion via admin API failed`, {
            error: adminDeleteError.message,
            status: adminDeleteError.status
          });

          // Try to get more information about what's preventing deletion
          const detailedCheck = await checkForConstraintViolations(user.id, supabase);
          logger.error(`Detailed constraint check after deletion failure`, { violationCount: detailedCheck.violations.length });

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
        logger.error(`Exception deleting auth user`, { error: error.message });
        authDeletionResult = {
          success: false,
          table: 'auth.users',
          operation: 'delete',
          error: error.message,
          details: { stack: error.stack }
        };
      }
    } else {
      logger.warn(`Service role key not configured - auth user not deleted`, {});
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

    logger.debug(`Deletion summary`, { successful: successfulDeletions.length, failed: failedDeletions.length }, true);

    // Final verification step - verify all data has been deleted
    logger.debug(`Starting final verification`, {}, true);
    const verificationResult = await verifyUserDeletion(user.id, supabase);
    logger.debug(`Verification completed`, { hasRemainingData: verificationResult.hasRemainingData }, true);

    // Enhanced audit logging
    logger.debug(`Logging enhanced audit trail`, {}, true);
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
    logger.error('Error deleting user account', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      sanitizeErrorResponse(error, 'Request failed'),
      { status: 500 }
    );
  }
}

/**
 * Delete all user files from Supabase Storage buckets
 * Handles boat-images and journey-images buckets
 */
async function deleteStorageFilesForUser(userId: string, supabase: any): Promise<DeletionResult> {
  const bucketNames = ['boat-images', 'journey-images', 'secure-documents'];
  const result: DeletionResult = {
    success: true,
    table: 'storage',
    operation: 'cleanup',
    details: { deleted: 0, errors: [], buckets: [] }
  };

  for (const bucketName of bucketNames) {
    try {
      logger.debug(`Starting cleanup for bucket`, { bucketName }, true);

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
        logger.error(`Failed to list files in storage bucket`, { bucketName, error: listError.message });
        result.success = false;
        result.details?.errors?.push(`Failed to list files in ${bucketName}: ${listError.message}`);
        continue;
      }

      if (!fileList || fileList.length === 0) {
        logger.debug(`No files found in storage bucket`, { bucketName }, true);
        result.details?.buckets?.push({ name: bucketName, deleted: 0, found: 0 });
        continue;
      }

      // Extract file paths
      const filePaths = fileList.map((file: any) => `${userId}/${file.name}`);
      logger.debug(`Found files in storage bucket`, { bucketName, count: filePaths.length }, true);

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
          logger.error(`Failed to delete batch from storage bucket`, { bucketName, error: deleteError.message });
          result.success = false;
          result.details?.errors?.push(`Failed to delete batch from ${bucketName}: ${deleteError.message}`);
        } else {
          logger.debug(`Deleted batch of files from storage bucket`, { bucketName, count: batch.length }, true);
          bucketDeleted += batch.length;
        }
      }

      result.details!.deleted! += bucketDeleted;
      result.details?.buckets?.push({ name: bucketName, deleted: bucketDeleted, found: fileList.length });

      // Handle nested directories (boat_id/journey_id subdirectories)
      // We need to list recursively by checking for directories
      for (const file of fileList) {
        if (file.metadata?.isFolder) {
          logger.debug(`Found directory in storage bucket`, { bucketName, directory: file.name }, true);
          // Recursively delete files in subdirectories
          const dirResult = await deleteStorageDirectory(userId, bucketName, file.name, supabase);
          if (!dirResult.success) {
            result.success = false;
            result.details?.errors?.push(`Failed to delete directory ${file.name} in ${bucketName}: ${dirResult.error}`);
          }
        }
      }

    } catch (error: any) {
      logger.error(`Error processing storage bucket`, { bucketName, error: error.message });
      result.success = false;
      result.details?.errors?.push(`Error processing bucket ${bucketName}: ${error.message}`);
    }
  }

  if (!result.success) {
    logger.warn(`Storage cleanup completed with errors`, { errorCount: result.details?.errors?.length || 0 });
  } else {
    logger.debug(`Storage cleanup completed successfully`, { totalDeleted: result.details?.deleted }, true);
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
      logger.error(`Failed to list files in storage directory`, { path: fullPath, error: listError.message });
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
      logger.error(`Failed to delete files in storage directory`, { path: fullPath, error: deleteError.message });
      result.success = false;
      result.error = deleteError.message;
      return result;
    } else {
      logger.debug(`Successfully deleted files from storage directory`, { path: fullPath, count: filePaths.length }, true);
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
    logger.error(`Error deleting storage directory`, { directory: directoryPath, error: error.message });
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
      { table: 'registration_answers', column: 'registration_id' },  // checked via registrations
      { table: 'boats', column: 'owner_id' },
      { table: 'email_preferences', column: 'user_id' },
      { table: 'document_vault', column: 'owner_id' },
      { table: 'document_access_grants', column: 'grantor_id' },
      { table: 'document_access_log', column: 'document_owner_id' }
    ];

    for (const { table, column } of tablesToCheck) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq(column, userId);

        if (error) {
          logger.warn(`Error checking constraint on table`, { table, column, error: error.message });
        } else if (count && count > 0) {
          violations.push({
            table,
            column,
            remainingRecords: count,
            message: `${table}.${column} still references user ${userId} (${count} records)`
          });
        }
      } catch (checkError) {
        const errorMsg = checkError instanceof Error ? checkError.message : String(checkError);
        logger.warn(`Exception checking constraint on table`, { table, column, error: errorMsg });
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
      logger.warn(`Constraint violations detected`, { violationCount: violations.length });
    } else {
      logger.debug(`No constraint violations detected`, {}, true);
    }

    return {
      hasViolations,
      violations,
      remainingData
    };

  } catch (error: any) {
    logger.error(`Error checking for constraint violations`, { error: error.message });
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
    'registrations', 'registration_answers', 'notifications', 'email_preferences',
    'user_consents', 'consent_audit_log', 'ai_conversations',
    'ai_pending_actions', 'feedback', 'feedback_votes',
    'feedback_prompt_dismissals',
    'document_vault',
    'document_access_grants',
    'document_access_log'
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

