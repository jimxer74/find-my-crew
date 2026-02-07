# Delete My Account - Technical Implementation Specification

**Version:** 1.0
**Date:** February 7, 2026
**Purpose:** Technical specification for fixing delete account functionality gaps

## Overview

This document provides the technical implementation details for fixing the identified gaps in the "Delete My Account" functionality. It includes code examples, database queries, and implementation steps.

## Current State Analysis

### Existing Implementation Location
- **File:** `app/api/user/delete-account/route.ts`
- **Method:** `DELETE /api/user/delete-account`

### Current Deletion Sequence
```typescript
1. Delete notifications
2. Delete consent_audit_log
3. Delete user_consents
4. Delete email_preferences
5. Delete registrations
6. Delete boats (cascades to journeys, legs, waypoints)
7. Delete profiles
8. Delete auth user
```

## Required Implementation Changes

### 1. Storage Bucket Cleanup

#### Problem
User-uploaded images in Supabase Storage buckets (`boat-images`, `journey-images`) are never deleted, creating orphaned files and GDPR compliance issues.

#### Solution
Add explicit storage cleanup using Supabase Storage API.

#### Implementation Code

**Add to `app/api/user/delete-account/route.ts` after line 72:**

```typescript
// Delete storage files function
async function deleteStorageFilesForUser(userId: string, supabase: any, adminClient: any) {
  const bucketNames = ['boat-images', 'journey-images'];

  for (const bucketName of bucketNames) {
    try {
      // List all files for this user
      const { data: fileList, error: listError } = await adminClient
        .storage
        .from(bucketName)
        .list(userId, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (listError) {
        console.error(`Failed to list files in ${bucketName} for user ${userId}:`, listError);
        continue;
      }

      if (!fileList || fileList.length === 0) {
        console.log(`No files found in ${bucketName} for user ${userId}`);
        continue;
      }

      // Extract file paths
      const filePaths = fileList.map(file => `${userId}/${file.name}`);

      // Delete files in batches of 100 (Supabase limit)
      const batchSize = 100;
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        const { data, error: deleteError } = await adminClient
          .storage
          .from(bucketName)
          .remove(batch);

        if (deleteError) {
          console.error(`Failed to delete batch from ${bucketName}:`, deleteError);
          // Continue with other batches
        } else {
          console.log(`Successfully deleted ${batch.length} files from ${bucketName}`);
        }
      }

      // Handle nested directories (boat_id/journey_id subdirectories)
      // This requires recursive listing which Supabase doesn't support directly
      // Alternative: Store file paths in a tracking table or use flat structure

    } catch (error) {
      console.error(`Error processing bucket ${bucketName} for user ${userId}:`, error);
      // Continue with other buckets
    }
  }
}
```

**Integration into main DELETE function:**

```typescript
// After boat deletion (around line 69)
try {
  console.log(`[${user.id}] Starting storage cleanup...`);
  await deleteStorageFilesForUser(user.id, supabase, adminClient);
  console.log(`[${user.id}] Storage cleanup completed`);
} catch (error) {
  console.error(`[${user.id}] Storage cleanup failed:`, error);
  // Log but continue with deletion - storage files are less critical than database data
}
```

#### Error Handling
```typescript
// Add comprehensive error handling
const storageCleanupResult = {
  success: true,
  errors: [],
  deletedFiles: 0
};

try {
  await deleteStorageFilesForUser(user.id, supabase, adminClient);
} catch (error) {
  storageCleanupResult.success = false;
  storageCleanupResult.errors.push({
    type: 'storage_cleanup',
    message: error.message,
    timestamp: new Date().toISOString()
  });
}
```

### 2. AI Assistant Data Deletion

#### Problem
AI conversation data relies on CASCADE deletes rather than explicit cleanup, creating incomplete audit trails.

#### Solution
Add explicit deletion of AI-related tables.

#### Implementation Code

**Add to DELETE function after email_preferences deletion (around line 54):**

```typescript
// Delete AI conversations and related data
console.log(`[${user.id}] Deleting AI conversations...`);
const { error: aiConvError } = await supabase
  .from('ai_conversations')
  .delete()
  .eq('user_id', user.id);

if (aiConvError) {
  console.error(`[${user.id}] Failed to delete AI conversations:`, aiConvError);
  throw new Error(`AI conversation deletion failed: ${aiConvError.message}`);
}

console.log(`[${user.id}] Deleting AI pending actions...`);
const { error: aiActionError } = await supabase
  .from('ai_pending_actions')
  .delete()
  .eq('user_id', user.id);

if (aiActionError) {
  console.error(`[${user.id}] Failed to delete AI pending actions:`, aiActionError);
  throw new Error(`AI pending actions deletion failed: ${aiActionError.message}`);
}
```

#### Verification Query

```typescript
// Add verification after all deletions
async function verifyAIDataDeletion(userId: string, supabase: any) {
  const tables = ['ai_conversations', 'ai_messages', 'ai_pending_actions'];
  const remainingData: string[] = [];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error(`Error checking ${table}:`, error);
      remainingData.push(`${table}:error`);
    } else if (count && count > 0) {
      remainingData.push(`${table}:${count}`);
    }
  }

  return {
    hasRemainingData: remainingData.length > 0,
    remainingData
  };
}
```

### 3. Feedback System Data Deletion

#### Problem
Feedback system data relies on CASCADE deletes.

#### Solution
Add explicit deletion of feedback-related tables.

#### Implementation Code

**Add after AI data deletion:**

```typescript
// Delete feedback data
console.log(`[${user.id}] Deleting feedback data...`);
const { error: feedbackError } = await supabase
  .from('feedback')
  .delete()
  .eq('user_id', user.id);

if (feedbackError) {
  console.error(`[${user.id}] Failed to delete feedback:`, feedbackError);
  throw new Error(`Feedback deletion failed: ${feedbackError.message}`);
}

console.log(`[${user.id}] Deleting feedback votes...`);
const { error: feedbackVotesError } = await supabase
  .from('feedback_votes')
  .delete()
  .eq('user_id', user.id);

if (feedbackVotesError) {
  console.error(`[${user.id}] Failed to delete feedback votes:`, feedbackVotesError);
  throw new Error(`Feedback votes deletion failed: ${feedbackVotesError.message}`);
}

console.log(`[${user.id}] Deleting feedback prompt dismissals...`);
const { error: feedbackDismissalsError } = await supabase
  .from('feedback_prompt_dismissals')
  .delete()
  .eq('user_id', user.id);

if (feedbackDismissalsError) {
  console.error(`[${user.id}] Failed to delete feedback prompt dismissals:`, feedbackDismissalsError);
  throw new Error(`Feedback dismissals deletion failed: ${feedbackDismissalsError.message}`);
}
```

### 4. Enhanced Error Handling & Logging

#### Implementation Code

**Wrap each deletion step:**

```typescript
async function safeDelete(table: string, condition: any, supabase: any, userId: string) {
  try {
    console.log(`[${userId}] Deleting ${table}...`);
    const { error } = await supabase.from(table).delete().eq(...Object.entries(condition)[0]);

    if (error) {
      throw error;
    }

    console.log(`[${userId}] Successfully deleted ${table}`);
    return { success: true, table, deleted: true };
  } catch (error) {
    console.error(`[${userId}] Failed to delete ${table}:`, error);
    return { success: false, table, error: error.message };
  }
}

// Usage example:
const deletionResults = [];

const results = await Promise.all([
  safeDelete('notifications', { user_id: user.id }, supabase, user.id),
  safeDelete('consent_audit_log', { user_id: user.id }, supabase, user.id),
  safeDelete('user_consents', { user_id: user.id }, supabase, user.id),
  // ... other tables
]);

deletionResults.push(...results);
```

### 5. Comprehensive Verification

#### Implementation Code

**Add after all deletions:**

```typescript
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
    } catch (error) {
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
```

## Data Export Updates

### Current Export Location
- **File:** `app/api/user/data-export/route.ts`

### Required Changes

**Add to data collection section:**

```typescript
// Collect AI data
const aiConversationsRes = await supabase.from('ai_conversations').select('*').eq('user_id', user.id);
const aiConversationsData = aiConversationsRes.data || [];

const aiMessagesRes = await supabase.from('ai_messages').select('*').eq('user_id', user.id);
const aiMessagesData = aiMessagesRes.data || [];

const aiPendingActionsRes = await supabase.from('ai_pending_actions').select('*').eq('user_id', user.id);
const aiPendingActionsData = aiPendingActionsRes.data || [];

// Collect feedback data
const feedbackRes = await supabase.from('feedback').select('*').eq('user_id', user.id);
const feedbackData = feedbackRes.data || [];

const feedbackVotesRes = await supabase.from('feedback_votes').select('*').eq('user_id', user.id);
const feedbackVotesData = feedbackVotesRes.data || [];

const feedbackDismissalsRes = await supabase.from('feedback_prompt_dismissals').select('*').eq('user_id', user.id);
const feedbackDismissalsData = feedbackDismissalsRes.data || [];
```

**Add to export structure:**

```typescript
const exportData = {
  // ... existing data
  ai_data: {
    conversations: aiConversationsData,
    messages: aiMessagesData,
    pending_actions: aiPendingActionsData
  },
  feedback_data: {
    feedback: feedbackData,
    votes: feedbackVotesData,
    prompt_dismissals: feedbackDismissalsData
  }
};
```

## Database Schema Verification

### Required Indexes for Performance

```sql
-- Ensure indexes exist for deletion queries
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user_id ON ai_pending_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user_id ON feedback_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_prompt_dismissals_user_id ON feedback_prompt_dismissals(user_id);
```

### RLS Policy Verification

```sql
-- Verify RLS policies are correctly set up
SELECT table_name, policy_name, command, with_check, using_expr
FROM information_schema.tables t
JOIN pg_policy p ON p.polrelid = t.table_name::regclass
WHERE table_schema = 'public'
AND table_name IN (
  'ai_conversations', 'ai_pending_actions',
  'feedback', 'feedback_votes', 'feedback_prompt_dismissals'
)
ORDER BY table_name, command;
```

## Testing Implementation

### Unit Tests Structure

```typescript
// tests/delete-account.test.ts
describe('Delete Account Functionality', () => {
  describe('Storage Cleanup', () => {
    test('deletes all user files from boat-images bucket', async () => {
      // Test implementation
    });

    test('deletes all user files from journey-images bucket', async () => {
      // Test implementation
    });

    test('handles storage deletion errors gracefully', async () => {
      // Test implementation
    });
  });

  describe('Database Deletion', () => {
    test('explicitly deletes AI conversations', async () => {
      // Test implementation
    });

    test('explicitly deletes feedback data', async () => {
      // Test implementation
    });

    test('verifies complete data deletion', async () => {
      // Test implementation
    });
  });

  describe('Data Export', () => {
    test('includes AI conversation data in export', async () => {
      // Test implementation
    });

    test('includes feedback data in export', async () => {
      // Test implementation
    });

    test('export contains all user data types', async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

```typescript
// tests/delete-account-integration.test.ts
describe('Complete Account Deletion Integration', () => {
  test('deletes all user data including storage files', async () => {
    // Create test user with data
    // Call delete endpoint
    // Verify complete deletion
  });

  test('handles partial failures gracefully', async () => {
    // Simulate storage failure
    // Verify database deletion still completes
  });

  test('maintains system stability during deletion', async () => {
    // Test deletion under load
    // Verify no performance degradation
  });
});
```

## Performance Considerations

### Batch Processing for Large Datasets

```typescript
async function batchDelete(table: string, userId: string, batchSize: number = 1000) {
  let offset = 0;
  let deletedCount = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .range(offset, offset + batchSize - 1);

    if (error || !data || data.length === 0) {
      break;
    }

    const ids = data.map(row => row.id);
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error(`Batch delete failed for ${table}:`, deleteError);
      break;
    }

    deletedCount += ids.length;
    offset += batchSize;

    // Add small delay to avoid overwhelming database
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return deletedCount;
}
```

### Memory Management

```typescript
// For large datasets, process in chunks to avoid memory issues
async function processLargeDeletion(table: string, userId: string) {
  const batchSize = 1000;
  let offset = 0;
  let totalDeleted = 0;

  while (true) {
    const { data: records, error } = await supabase
      .from(table)
      .select('id')
      .eq('user_id', userId)
      .range(offset, offset + batchSize - 1);

    if (error || !records || records.length === 0) {
      break;
    }

    // Process batch
    const ids = records.map(r => r.id);
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw deleteError;
    }

    totalDeleted += ids.length;
    offset += batchSize;

    // Force garbage collection hint
    if (global.gc) global.gc();
  }

  return totalDeleted;
}
```

## Implementation Checklist

### Code Changes Required

- [ ] Add storage cleanup function to `delete-account/route.ts`
- [ ] Add explicit AI data deletion
- [ ] Add explicit feedback data deletion
- [ ] Add enhanced error handling and logging
- [ ] Add verification step after deletion
- [ ] Update data export to include missing data types
- [ ] Add comprehensive unit tests
- [ ] Add integration tests
- [ ] Add performance tests for large datasets
- [ ] Update documentation

### Database Changes Required

- [ ] Verify all required indexes exist
- [ ] Verify RLS policies are correctly configured
- [ ] Consider adding deletion audit table if needed

### Testing Required

- [ ] Unit tests for all new functions
- [ ] Integration tests for complete workflow
- [ ] Performance tests for large datasets
- [ ] Error handling tests
- [ ] GDPR compliance tests

### Documentation Required

- [ ] Update API documentation
- [ ] Update data protection policies
- [ ] Update operational procedures
- [ ] Add monitoring and alerting documentation

## Rollback Plan

### If Implementation Fails

1. **Database**: CASCADE deletes should still work as backup
2. **Storage**: Files remain but can be cleaned up later
3. **Export**: Missing data can be added in subsequent releases

### Rollback Steps

1. Revert code changes to `delete-account/route.ts`
2. Revert changes to `data-export/route.ts`
3. Verify existing functionality still works
4. Implement fixes in separate branch

## Success Metrics

### Functional Metrics
- [ ] 100% of user data deleted on request
- [ ] 100% of storage files cleaned up
- [ ] Data export includes all data types
- [ ] No orphaned data remains

### Performance Metrics
- [ ] Account deletion completes in < 30 seconds for average user
- [ ] Account deletion completes in < 5 minutes for power users
- [ ] No system performance degradation during deletion
- [ ] Memory usage remains stable during deletion

### Compliance Metrics
- [ ] GDPR Article 17 compliance verified
- [ ] GDPR Article 20 compliance verified
- [ ] Complete audit trail maintained
- [ ] No data remnants after deletion

This technical specification provides a comprehensive guide for implementing the required fixes to the "Delete My Account" functionality, ensuring complete GDPR compliance and proper data management.