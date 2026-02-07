# Delete My Account Functionality - Gap Analysis Report

**Date:** February 7, 2026
**Analysis Scope:** Complete audit of user account deletion functionality
**Status:** Gap Analysis Complete - Implementation Required

## Executive Summary

This report documents a comprehensive analysis of the "Delete My Account" functionality in the SailSmart application. While the core data deletion is properly implemented, several critical gaps were identified that could leave user data undeleted and violate GDPR compliance requirements.

**Risk Level:** 🔴 **HIGH** - Storage buckets and incomplete data export pose significant privacy and compliance risks

## Current Implementation Overview

### Location
- **API Endpoint:** `app/api/user/delete-account/route.ts`
- **Frontend:** `app/settings/privacy/page.tsx`
- **Database Schema:** `specs/tables.sql`

### Currently Deleted Data (✅ Properly Handled)

The following tables are explicitly deleted when a user requests account deletion:

1. **notifications** - User notification records
2. **consent_audit_log** - GDPR audit trail for consent changes
3. **user_consents** - User consent preferences
4. **email_preferences** - Email notification settings
5. **registrations** - Crew registration records
6. **boats** - User-owned boats (cascades to journeys, legs, waypoints)
7. **profiles** - User profile information

### Database Tables Analysis

**Total User Data Tables:** 17

| Table | Status | Notes |
|-------|--------|-------|
| auth.users | ✅ Deleted | Via Supabase admin client |
| profiles | ✅ Explicitly Deleted | Core user information |
| boats | ✅ Explicitly Deleted | Cascades to journeys/legs/waypoints |
| journeys | ✅ Cascaded | Through boat deletion |
| legs | ✅ Cascaded | Through journey deletion |
| waypoints | ✅ Cascaded | Through leg deletion |
| registrations | ✅ Explicitly Deleted | Crew registration data |
| notifications | ✅ Explicitly Deleted | User notifications |
| email_preferences | ✅ Explicitly Deleted | Email settings |
| user_consents | ✅ Explicitly Deleted | Consent preferences |
| consent_audit_log | ✅ Explicitly Deleted | Consent audit trail |
| ai_conversations | ⚠️ CASCADE | AI chat conversations |
| ai_messages | ⚠️ CASCADE | Individual AI messages |
| ai_pending_actions | ⚠️ CASCADE | Pending AI actions |
| feedback | ⚠️ CASCADE | User feedback submissions |
| feedback_votes | ⚠️ CASCADE | Feedback voting history |
| feedback_prompt_dismissals | ⚠️ CASCADE | Feedback prompt dismissals |

## Critical Gaps Identified

### 🔴 HIGH PRIORITY: Storage Bucket Cleanup

**Issue:** User-uploaded images in Supabase Storage buckets are never deleted.

**Affected Buckets:**
- `boat-images` - Boat images stored as `{user_id}/{boat_id}/{filename}`
- `journey-images` - Journey images stored as `{user_id}/{journey_id}/{filename}`

**Risk:**
- Orphaned files persist indefinitely
- Potential privacy/security vulnerabilities
- Storage costs accumulate with deleted users
- GDPR non-compliance (right to be forgotten)

**Evidence:**
```sql
-- Storage policies exist in specs/tables.sql but no deletion logic
create policy "Users can upload boat images" on storage.objects for insert
create policy "Public can view boat images" on storage.objects for select
```

### 🟡 MEDIUM-HIGH PRIORITY: AI Assistant Data

**Issue:** AI conversation data relies on CASCADE deletes rather than explicit cleanup.

**Affected Tables:**
- `ai_conversations` - User chat conversation threads
- `ai_messages` - Individual messages within conversations
- `ai_pending_actions` - Pending action suggestions from AI

**Risk:**
- Incomplete audit trail for data deletion
- Potential data remnants if CASCADE fails
- GDPR compliance verification difficulties

### 🟡 MEDIUM PRIORITY: Feedback System Data

**Issue:** User feedback and voting history relies on CASCADE deletes.

**Affected Tables:**
- `feedback` - User-submitted feedback (bugs, features, improvements)
- `feedback_votes` - User votes on feedback items
- `feedback_prompt_dismissals` - Feedback prompt dismissal tracking

**Risk:**
- User feedback history may remain linked to orphaned records
- Incomplete data deletion audit trail

## GDPR Compliance Issues

### Data Export Gaps

The data export functionality (`app/api/user/data-export/route.ts`) is missing several data types:

**Current Export:**
- profiles
- user_consents
- boats (with nested journeys, legs, waypoints)
- registrations (with nested legs and journeys)
- notifications
- email_preferences
- consent_audit_log

**Missing from Export:**
- ai_conversations
- ai_messages
- ai_pending_actions
- feedback
- feedback_votes
- feedback_prompt_dismissals

**Impact:** Violates GDPR "right to data portability" requirement.

## Technical Analysis

### Database Relationships

```
auth.users (Supabase)
├── ON DELETE CASCADE
│   ├── profiles
│   │   └── notifications
│   ├── boats
│   │   └── journeys
│   │       └── legs
│   │           └── waypoints
│   ├── registrations
│   ├── email_preferences
│   ├── user_consents
│   ├── consent_audit_log
│   ├── ai_conversations
│   │   └── ai_messages
│   ├── ai_pending_actions
│   ├── feedback
│   │   └── feedback_votes
│   └── feedback_prompt_dismissals
│
└── Storage Buckets (NOT CASCADE)
    ├── boat-images/{user_id}/*
    └── journey-images/{user_id}/*
```

### Current Deletion Logic

```typescript
// app/api/user/delete-account/route.ts
async function DELETE(request: NextRequest) {
  // 1. Delete notifications
  await supabase.from('notifications').delete().eq('user_id', user.id);

  // 2. Delete consent audit log
  await supabase.from('consent_audit_log').delete().eq('user_id', user.id);

  // 3. Delete user consents
  await supabase.from('user_consents').delete().eq('user_id', user.id);

  // 4. Delete email preferences
  await supabase.from('email_preferences').delete().eq('user_id', user.id);

  // 5. Delete registrations
  await supabase.from('registrations').delete().eq('user_id', user.id);

  // 6. Delete boats (cascades to journeys, legs, waypoints)
  await supabase.from('boats').delete().eq('owner_id', user.id);

  // 7. Delete profile
  await supabase.from('profiles').delete().eq('id', user.id);

  // 8. Delete auth user
  await adminClient.auth.admin.deleteUser(user.id);
}
```

## Recommendations

### 🔴 Immediate Actions Required

1. **Add Storage Bucket Cleanup**
   ```typescript
   // Delete all user files from storage buckets
   await supabase.storage.from('boat-images').remove([/* user files */]);
   await supabase.storage.from('journey-images').remove([/* user files */]);
   ```

2. **Add Explicit Deletion for Critical Tables**
   ```typescript
   // Explicitly delete AI and feedback data
   await supabase.from('ai_conversations').delete().eq('user_id', user.id);
   await supabase.from('feedback').delete().eq('user_id', user.id);
   ```

3. **Update Data Export Functionality**
   ```typescript
   // Include missing data types in export
   const aiData = await supabase.from('ai_conversations').select('*').eq('user_id', user.id);
   const feedbackData = await supabase.from('feedback').select('*').eq('user_id', user.id);
   ```

### 🟡 Secondary Improvements

1. **Add Deletion Logging**
   ```typescript
   // Log each step for audit trail
   console.log(`[${user.id}] Deleting notifications...`);
   console.log(`[${user.id}] Deleting profiles...`);
   ```

2. **Add Error Handling**
   ```typescript
   // Handle partial failures gracefully
   try {
     await deleteStorageFiles(user.id);
   } catch (error) {
     console.error(`Failed to delete storage files for ${user.id}:`, error);
     // Continue with deletion but log the issue
   }
   ```

3. **Add Verification Step**
   ```typescript
   // Verify all data is deleted
   const remainingData = await verifyUserDeletion(user.id);
   if (remainingData.length > 0) {
     throw new Error(`Incomplete deletion: ${remainingData.join(', ')}`);
   }
   ```

### Implementation Priority

1. **Priority 1:** Storage bucket cleanup (GDPR compliance)
2. **Priority 2:** Data export completeness (GDPR compliance)
3. **Priority 3:** Explicit deletion of cascade-dependent tables
4. **Priority 4:** Enhanced logging and error handling

## Files Requiring Updates

| File | Change Type | Priority |
|------|-------------|----------|
| `app/api/user/delete-account/route.ts` | Add deletion logic | 🔴 High |
| `app/api/user/data-export/route.ts` | Add missing data export | 🔴 High |
| `docs/delete-account-gaps-analysis.md` | Documentation | 🟢 Complete |
| `specs/tables.sql` | Add deletion procedures (optional) | 🟡 Medium |

## Testing Strategy

### Unit Tests
- Test deletion of each table individually
- Test storage bucket cleanup
- Test data export completeness

### Integration Tests
- Test complete account deletion workflow
- Verify no data remains after deletion
- Test edge cases (partial failures, network issues)

### GDPR Compliance Tests
- Verify "right to be forgotten" is complete
- Verify "right to data portability" includes all data
- Test audit trail completeness

## Compliance Standards

This analysis aligns with:
- **GDPR Article 17:** Right to erasure ("right to be forgotten")
- **GDPR Article 20:** Right to data portability
- **GDPR Article 30:** Records of processing activities
- **ISO 27001:** Information security management

## Conclusion

The current "Delete My Account" implementation handles core business data correctly but has significant gaps in storage cleanup and data export completeness. These gaps pose privacy risks and GDPR compliance issues that must be addressed.

**Next Steps:**
1. Implement the recommended fixes prioritized by risk level
2. Add comprehensive testing for deletion workflows
3. Update documentation and procedures
4. Conduct regular audits of deletion functionality

**Contact:** Development team for implementation planning and execution.