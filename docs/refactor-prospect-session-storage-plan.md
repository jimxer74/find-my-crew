# Refactoring Plan: Prospect Session Storage to Server-Side Database

**Date:** 2026-02-10  
**Status:** Planning  
**Target:** Option 1 - Server-side database storage

---

## Executive Summary

This plan outlines the migration from client-side localStorage-based prospect session storage to server-side database storage using Supabase. This change will eliminate cross-user data contamination, enable server-side validation, and provide better data integrity.

**Current Architecture:**
- Session ID stored in HttpOnly cookie (`prospect_session_id`)
- Session data stored in localStorage (`prospect_session`)
- Single localStorage key shared across all users on same browser

**Target Architecture:**
- Session ID stored in HttpOnly cookie (unchanged)
- Session data stored in Supabase `prospect_sessions` table
- Server-side validation and cleanup
- No localStorage dependency for session data

---

## Phase 1: Database Schema & Migration

### 1.1 Create Database Table

**File:** `migrations/XXX_create_prospect_sessions.sql`

```sql
-- Create prospect_sessions table
CREATE TABLE IF NOT EXISTS public.prospect_sessions (
  session_id UUID PRIMARY KEY,
  -- CRITICAL: user_id is NULL for unauthenticated users (before signup)
  -- After signup, this gets linked to auth.users(id)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULLABLE for unauthenticated users
  -- Optional: email for linking sessions before signup (if user shares email)
  -- This helps link sessions when user signs up with same email
  email TEXT,
  conversation JSONB NOT NULL DEFAULT '[]'::jsonb,
  gathered_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  viewed_legs TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_user_id 
  ON public.prospect_sessions(user_id) 
  WHERE user_id IS NOT NULL;

-- Index for email-based session linking (before signup)
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_email 
  ON public.prospect_sessions(email) 
  WHERE email IS NOT NULL AND user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_prospect_sessions_expires 
  ON public.prospect_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_prospect_sessions_last_active 
  ON public.prospect_sessions(last_active_at);

-- Enable Row Level Security
ALTER TABLE public.prospect_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- CRITICAL: Allow unauthenticated access to sessions with user_id = NULL
-- This enables prospect users to access their sessions before signup
CREATE POLICY "Unauthenticated users can access their sessions"
  ON public.prospect_sessions
  FOR ALL
  USING (user_id IS NULL);

-- Authenticated users can access their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.prospect_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.prospect_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.prospect_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all sessions (for cleanup jobs and session linking)
CREATE POLICY "Service role can manage all sessions"
  ON public.prospect_sessions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

**CRITICAL NOTE ON UNAUTHENTICATED ACCESS:**

The RLS policy `"Unauthenticated users can access their sessions"` allows ANY unauthenticated user to access sessions where `user_id IS NULL`. This is intentional but requires:

1. **Session ID validation:** The API must validate that the `session_id` from the cookie matches the requested session
2. **No sensitive data:** Session data should not contain sensitive information (it's just conversation/preferences)
3. **Session linking on signup:** When a user signs up, we MUST link their session to their `user_id` immediately

**Security Considerations:**
- Session IDs are UUIDs (hard to guess)
- Session IDs are stored in HttpOnly cookies (not accessible to JavaScript)
- API routes validate session_id from cookie matches requested session
- After signup, session is immediately linked to user_id (becomes protected)

**Tasks:**
- [ ] Create migration file
- [ ] Test migration on development database
- [ ] Update `specs/tables.sql` with new table definition
- [ ] Document RLS policies

**Considerations:**
- `user_id` is nullable to support unauthenticated users (CRITICAL)
- `email` field optional for linking sessions before signup
- JSONB for flexible schema (matches current ProspectSession structure)
- Automatic expiry via `expires_at` field
- RLS policies allow unauthenticated access to sessions with `user_id IS NULL`
- **Security:** API routes MUST validate session_id from cookie matches requested session

---

### 1.2 Create Session Recovery Functions

**File:** `migrations/XXX_prospect_sessions_recovery.sql`

```sql
-- Function to find sessions by email (for returning users who lost their cookie)
-- Returns most recent active session for the email
CREATE OR REPLACE FUNCTION public.find_prospect_session_by_email(
  p_email TEXT
)
RETURNS TABLE (
  session_id UUID,
  conversation JSONB,
  gathered_preferences JSONB,
  viewed_legs TEXT[],
  created_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.session_id,
    ps.conversation,
    ps.gathered_preferences,
    ps.viewed_legs,
    ps.created_at,
    ps.last_active_at
  FROM public.prospect_sessions ps
  WHERE ps.email = LOWER(TRIM(p_email))
    AND ps.user_id IS NULL  -- Only unauthenticated sessions
    AND ps.expires_at > NOW()  -- Not expired
  ORDER BY ps.last_active_at DESC
  LIMIT 1;  -- Return most recent session
END;
$$;

-- Function to merge multiple sessions (if user had multiple sessions before signup)
CREATE OR REPLACE FUNCTION public.merge_prospect_sessions(
  p_target_session_id UUID,
  p_source_session_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  source_session RECORD;
  merged_conversation JSONB;
  merged_preferences JSONB;
  merged_viewed_legs TEXT[];
BEGIN
  -- Get target session
  SELECT conversation, gathered_preferences, viewed_legs
  INTO merged_conversation, merged_preferences, merged_viewed_legs
  FROM public.prospect_sessions
  WHERE session_id = p_target_session_id;
  
  IF merged_conversation IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Merge each source session into target
  FOR source_session IN 
    SELECT conversation, gathered_preferences, viewed_legs
    FROM public.prospect_sessions
    WHERE session_id = ANY(p_source_session_ids)
      AND session_id != p_target_session_id
  LOOP
    -- Merge conversations (append messages, keeping chronological order)
    merged_conversation := merged_conversation || source_session.conversation;
    
    -- Merge preferences (target takes precedence, but fill in missing fields)
    merged_preferences := merged_preferences || COALESCE(source_session.gathered_preferences, '{}'::jsonb);
    
    -- Merge viewed legs (union, no duplicates)
    merged_viewed_legs := (
      SELECT ARRAY_AGG(DISTINCT leg_id)
      FROM (
        SELECT UNNEST(merged_viewed_legs) AS leg_id
        UNION
        SELECT UNNEST(source_session.viewed_legs) AS leg_id
      ) AS combined_legs
    );
  END LOOP;
  
  -- Update target session with merged data
  UPDATE public.prospect_sessions
  SET 
    conversation = merged_conversation,
    gathered_preferences = merged_preferences,
    viewed_legs = merged_viewed_legs,
    last_active_at = NOW()
  WHERE session_id = p_target_session_id;
  
  -- Delete source sessions (they've been merged)
  DELETE FROM public.prospect_sessions
  WHERE session_id = ANY(p_source_session_ids)
    AND session_id != p_target_session_id;
  
  RETURN TRUE;
END;
$$;
```

**Tasks:**
- [ ] Create session recovery functions
- [ ] Test finding sessions by email
- [ ] Test merging sessions
- [ ] Document recovery process
- [ ] Add error handling

**Use Cases:**
1. **Returning user:** User shares email → find their previous session
2. **Multiple sessions:** User had sessions on different devices → merge them
3. **Session recovery:** User lost cookie → recover by email

---

### 1.3 Create Session Linking Function

**File:** `migrations/XXX_prospect_sessions_link_user.sql`

```sql
-- Function to link a prospect session to a user after signup
-- This is called when a user signs up and we need to link their existing session
CREATE OR REPLACE FUNCTION public.link_prospect_session_to_user(
  p_session_id UUID,
  p_user_id UUID,
  p_user_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_exists BOOLEAN;
BEGIN
  -- Check if session exists
  SELECT EXISTS(SELECT 1 FROM public.prospect_sessions WHERE session_id = p_session_id)
  INTO session_exists;
  
  IF NOT session_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Link session to user
  UPDATE public.prospect_sessions
  SET 
    user_id = p_user_id,
    email = COALESCE(p_user_email, email), -- Update email if provided
    last_active_at = NOW()
  WHERE session_id = p_session_id;
  
  RETURN TRUE;
END;
$$;

-- Function to find and link sessions by email (for users who shared email before signup)
CREATE OR REPLACE FUNCTION public.link_prospect_sessions_by_email(
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  linked_count INTEGER;
BEGIN
  -- Link all unauthenticated sessions with matching email to the new user
  UPDATE public.prospect_sessions
  SET 
    user_id = p_user_id,
    email = p_user_email,
    last_active_at = NOW()
  WHERE email = p_user_email 
    AND user_id IS NULL;
  
  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RETURN linked_count;
END;
$$;
```

**Tasks:**
- [ ] Create session linking functions
- [ ] Test linking by session_id
- [ ] Test linking by email
- [ ] Document linking process
- [ ] Add error handling

**Use Cases:**
1. **Direct session linking:** User signs up while having an active session → link by session_id
2. **Email-based linking:** User shared email in chat before signup → link all sessions with that email
3. **Multiple sessions:** User had multiple sessions before signup → link all to user_id

---

### 1.4 Create Cleanup Function

**File:** `migrations/XXX_prospect_sessions_cleanup.sql`

```sql
-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_prospect_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.prospect_sessions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Optional: Create scheduled job (if using pg_cron extension)
-- SELECT cron.schedule('cleanup-prospect-sessions', '0 2 * * *', 
--   'SELECT public.cleanup_expired_prospect_sessions()');
```

**Tasks:**
- [ ] Create cleanup function
- [ ] Test cleanup function manually
- [ ] Set up scheduled job (if pg_cron available) or manual cleanup process
- [ ] Document cleanup process

---

## Phase 2: API Routes

### 2.1 Create Session Data API Routes

**New File:** `app/api/prospect/session/data/route.ts`

**Endpoints:**
- `GET /api/prospect/session/data` - Load session data
- `POST /api/prospect/session/data` - Save/update session data
- `DELETE /api/prospect/session/data` - Delete session data
- `POST /api/prospect/session/recover` - Find session by email (for returning users)
- `POST /api/prospect/session/merge` - Merge multiple sessions

**Implementation Details:**

```typescript
// GET /api/prospect/session/data
// - Reads session_id from HttpOnly cookie (CRITICAL: validates cookie matches)
// - Fetches session from database WHERE session_id = cookie_session_id
// - Validates: if user_id IS NOT NULL, verify auth.uid() === user_id
// - Returns ProspectSession or null

// POST /api/prospect/session/data
// - Reads session_id from HttpOnly cookie
// - Validates session_id matches cookie (security check)
// - Upserts session data in database
// - Updates last_active_at and expires_at
// - If authenticated: links to user_id automatically
// - If email provided: stores email for future linking

// DELETE /api/prospect/session/data
// - Reads session_id from cookie
// - Validates session ownership (user_id match or user_id IS NULL)
// - Deletes session from database
// - Also clears cookie (calls existing DELETE /api/prospect/session)

// NEW: POST /api/prospect/session/link
// - Links existing session to authenticated user after signup
// - Called automatically after user signs up
// - Parameters: session_id (from cookie), user_id (from auth)
// - Also links by email if user shared email before signup

// NEW: POST /api/prospect/session/recover
// - Finds session by email for returning users
// - Parameters: email
// - Returns: session_id and session data (if found)
// - Use case: User lost cookie, shares email to recover session

// NEW: POST /api/prospect/session/merge
// - Merges multiple sessions into one
// - Parameters: target_session_id, source_session_ids[]
// - Use case: User had sessions on multiple devices/browsers
```

**Tasks:**
- [ ] Create GET endpoint with session_id validation
- [ ] Create POST endpoint with session_id validation
- [ ] Create DELETE endpoint with ownership validation
- [ ] Create POST /api/prospect/session/link endpoint
- [ ] Create POST /api/prospect/session/recover endpoint
- [ ] Create POST /api/prospect/session/merge endpoint
- [ ] Add error handling and validation
- [ ] Add logging for debugging
- [ ] Add rate limiting (if needed)
- [ ] Write API tests
- [ ] Test unauthenticated access
- [ ] Test authenticated access
- [ ] Test session linking after signup
- [ ] Test session recovery by email
- [ ] Test session merging

**Considerations:**
- **CRITICAL:** Always validate session_id from cookie matches requested session
- Handle unauthenticated users (user_id = NULL) - allow access via session_id
- Handle authenticated users (link session to user_id automatically)
- Validate session_id format (UUID)
- Handle expired sessions gracefully
- Return appropriate HTTP status codes
- Consider caching for frequently accessed sessions
- **Security:** Never allow access to sessions with user_id != NULL unless auth.uid() matches

---

### 2.2 Update Existing Session Route

**File:** `app/api/prospect/session/route.ts`

**Changes:**
- Keep existing GET/DELETE endpoints (session ID management)
- Add optional query param to GET endpoint: `?includeData=true` to return session data
- Consider adding `userId` to response when user is authenticated

**Tasks:**
- [ ] Review current implementation
- [ ] Add optional data inclusion
- [ ] Ensure backward compatibility
- [ ] Update documentation

---

## Phase 3: Client-Side Refactoring

### 3.1 Create Session Service Module

**New File:** `app/lib/prospect/sessionService.ts`

**Purpose:** Centralize all session data operations

**Functions:**
```typescript
// Load session from server
// - Uses session_id from cookie (validated by API)
async function loadSession(sessionId: string): Promise<ProspectSession | null>

// Save session to server
// - Uses session_id from cookie
// - Automatically links to user_id if authenticated
// - Stores email if user shares it in conversation
async function saveSession(sessionId: string, session: ProspectSession): Promise<void>

// Delete session from server
async function deleteSession(sessionId: string): Promise<void>

// Link session to authenticated user (called after signup)
// - Links by session_id (current session)
// - Also links by email (all sessions with matching email)
async function linkSessionToUser(sessionId: string, userId: string, email?: string): Promise<void>

// NEW: Recover session by email (for returning users)
// - Finds most recent session with matching email
// - Returns session_id and session data
async function recoverSessionByEmail(email: string): Promise<{ sessionId: string; session: ProspectSession } | null>

// NEW: Merge multiple sessions
// - Merges conversations, preferences, viewed legs
// - Keeps most recent session as target
async function mergeSessions(targetSessionId: string, sourceSessionIds: string[]): Promise<void>
```

**Tasks:**
- [ ] Create sessionService module
- [ ] Implement loadSession
- [ ] Implement saveSession
- [ ] Implement deleteSession
- [ ] Implement linkSessionToUser
- [ ] Add error handling
- [ ] Add retry logic for network failures
- [ ] Add offline detection (fallback to localStorage temporarily?)

**Considerations:**
- Handle network failures gracefully
- Consider optimistic updates
- Add debouncing for save operations (avoid too many API calls)
- Consider caching in memory to reduce API calls
- Handle race conditions (multiple tabs)
- **CRITICAL:** Call `linkSessionToUser()` immediately after user signs up
- Handle email-based session linking (if user shared email before signup)
- **NEW:** Extract email from conversation IF user shares it (optional, not required)
- **NEW:** Implement email-based recovery (optional feature, not primary)
- **NEW:** Accept fresh start when no cookie and no email (default behavior)
- **NEW:** Don't push users to share email - starting fresh is fine

---

### 3.2 Refactor ProspectChatContext

**File:** `app/contexts/ProspectChatContext.tsx`

**Changes Required:**

1. **Remove localStorage functions:**
   - Remove `loadSession()` function
   - Remove `saveSession()` function
   - Remove `STORAGE_KEY` constant
   - Keep `SESSION_EXPIRY_DAYS` for reference

2. **Update initialization:**
   - Replace `loadSession()` with `sessionService.loadSession(sessionId)`
   - Handle async loading properly
   - Show loading state while fetching session

3. **Update save logic:**
   - Replace `saveSession()` calls with `sessionService.saveSession()`
   - Debounce save operations (e.g., save max once per 2 seconds)
   - Handle save failures gracefully

4. **Update cleanup logic:**
   - Replace `localStorage.removeItem()` with `sessionService.deleteSession()`
   - Update profile creation cleanup to use API

5. **Add session linking on signup:**
   - Listen for authentication events
   - When user signs up, call `linkSessionToUser(sessionId, userId, email)`
   - This links the prospect session to the new user account
   - Also links any other sessions with matching email

5. **Update useEffect for auto-save:**
   - Replace localStorage save with API call
   - Add debouncing
   - Handle errors

**Tasks:**
- [ ] Import sessionService
- [ ] Remove localStorage code
- [ ] Update initSession useEffect
- [ ] Update sendMessage function
- [ ] Update profile creation cleanup
- [ ] Update clearSession function
- [ ] Update auto-save useEffect
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test all flows

**Considerations:**
- Maintain backward compatibility during transition
- Handle offline scenarios (maybe keep localStorage as fallback temporarily?)
- Ensure no data loss during migration
- Test with multiple tabs open
- Test with slow network connections
- **CRITICAL:** Test session linking after signup
- **CRITICAL:** Test unauthenticated session access (before signup)
- **CRITICAL:** Test authenticated session access (after signup)
- Test email-based session linking

---

### 3.3 Update Types (if needed)

**File:** `app/lib/ai/prospect/types.ts`

**Review:**
- Ensure `ProspectSession` interface matches database schema
- Add any new fields if needed
- Document any changes

**Tasks:**
- [ ] Review ProspectSession interface
- [ ] Ensure JSONB fields match TypeScript types
- [ ] Update documentation

---

## Phase 4: Migration & Data Migration

### 4.1 Migration Strategy

**Option A: Clean Slate (Recommended)**
- Don't migrate existing localStorage data
- Users start fresh with new system
- Simpler and cleaner

**Option B: One-Time Migration**
- Create migration script to read localStorage and migrate to database
- More complex, but preserves user data
- Requires detecting localStorage data and migrating on first load

**Recommendation:** Option A (Clean Slate)
- Prospect sessions are temporary (7-day expiry)
- Reduces complexity
- Eliminates stale data issues
- Users can start fresh conversations

**Tasks:**
- [ ] Decide on migration strategy
- [ ] If Option B: Create migration script
- [ ] If Option B: Test migration script
- [ ] Document migration approach

---

### 4.2 Backward Compatibility

**During Transition Period:**

1. **Dual Mode (Optional):**
   - Try to load from API first
   - Fallback to localStorage if API fails
   - Save to both during transition
   - Remove localStorage after transition period

2. **Clean Break (Recommended):**
   - Remove localStorage code completely
   - Users start fresh
   - Simpler implementation

**Recommendation:** Clean Break

**Tasks:**
- [ ] Decide on transition approach
- [ ] If dual mode: Implement fallback logic
- [ ] Plan transition timeline
- [ ] Communicate changes to users (if needed)

---

## Phase 5: Testing

### 5.1 Unit Tests

**Files to Test:**
- `app/lib/prospect/sessionService.ts`
- `app/api/prospect/session/data/route.ts`

**Test Cases:**
- [ ] Load existing session
- [ ] Load non-existent session
- [ ] Save new session
- [ ] Update existing session
- [ ] Delete session
- [ ] Link session to user
- [ ] Handle expired sessions
- [ ] Handle network errors
- [ ] Handle invalid session IDs
- [ ] Handle unauthenticated users
- [ ] Handle authenticated users

---

### 5.2 Integration Tests

**Test Scenarios:**
- [ ] New user flow (no existing session)
- [ ] Returning user flow (existing session)
- [ ] Multiple tabs (same session)
- [ ] Profile creation flow
- [ ] Session expiry
- [ ] User authentication during session
- [ ] Clear session flow
- [ ] Network failure scenarios

**Tasks:**
- [ ] Create integration test suite
- [ ] Test all user flows
- [ ] Test edge cases
- [ ] Test error scenarios

---

### 5.3 Manual Testing Checklist

- [ ] New prospect user can start conversation
- [ ] Conversation persists across page refreshes
- [ ] Conversation persists across browser sessions
- [ ] Multiple tabs share same session
- [ ] Profile creation clears session correctly
- [ ] "Start Fresh" clears session correctly
- [ ] Session expires after 7 days
- [ ] Authenticated user session links to user_id
- [ ] Unauthenticated user session works correctly
- [ ] No stale data appears
- [ ] No cross-user contamination
- [ ] Performance is acceptable (API response times)
- [ ] **NEW:** Cookie-based session persistence works (primary method)
- [ ] **NEW:** Email extraction from conversation works (if user shares email)
- [ ] **NEW:** Email-based recovery API works (if email was shared)
- [ ] **NEW:** Fresh start works when no cookie and no email (acceptable UX)
- [ ] **NEW:** Multiple sessions can be merged (if email was shared)
- [ ] **NEW:** AI handles returning users gracefully (doesn't push for email)

---

## Phase 6: Deployment & Rollout

### 6.1 Pre-Deployment Checklist

- [ ] Database migration tested on staging
- [ ] API routes tested and working
- [ ] Client code refactored and tested
- [ ] All tests passing
- [ ] Performance benchmarks acceptable
- [ ] Error handling tested
- [ ] Logging in place
- [ ] Monitoring set up

---

### 6.2 Deployment Steps

1. **Deploy Database Migration:**
   - Run migration on production database
   - Verify table created correctly
   - Verify indexes created
   - Verify RLS policies active

2. **Deploy API Routes:**
   - Deploy new API routes
   - Test endpoints manually
   - Monitor for errors

3. **Deploy Client Changes:**
   - Deploy refactored ProspectChatContext
   - Monitor error logs
   - Monitor API call patterns
   - Watch for performance issues

4. **Post-Deployment:**
   - Monitor error rates
   - Monitor API response times
   - Check database query performance
   - Verify cleanup job running (if scheduled)

---

### 6.3 Rollback Plan

**If Issues Occur:**

1. **Quick Rollback:**
   - Revert client code to localStorage version
   - Keep database table (harmless)
   - Users start fresh (acceptable)

2. **Partial Rollback:**
   - Keep database table
   - Revert to localStorage
   - Migrate later when stable

**Tasks:**
- [ ] Document rollback procedure
- [ ] Test rollback on staging
- [ ] Prepare rollback scripts if needed

---

## Phase 7: Cleanup & Optimization

### 7.1 Remove Old Code

**After Successful Deployment:**

- [ ] Remove localStorage code completely
- [ ] Remove STORAGE_KEY constant
- [ ] Remove loadSession/saveSession functions
- [ ] Clean up unused imports
- [ ] Update documentation
- [ ] Remove migration scripts (if one-time)

---

### 7.2 Optimization Opportunities

**Future Enhancements:**

1. **Caching:**
   - Add Redis cache for frequently accessed sessions
   - Reduce database load

2. **Batch Operations:**
   - Batch multiple session updates
   - Reduce API calls

3. **Compression:**
   - Compress large conversation arrays
   - Reduce storage and bandwidth

4. **Analytics:**
   - Track session metrics
   - Monitor conversion rates
   - Identify drop-off points

**Tasks:**
- [ ] Monitor performance metrics
- [ ] Identify optimization opportunities
- [ ] Plan future enhancements

---

## Risk Assessment

### High Risk Areas

1. **Data Loss During Migration:**
   - **Risk:** Users lose conversation history
   - **Mitigation:** Clean slate approach (users start fresh)
   - **Impact:** Low (sessions are temporary)

2. **Performance Issues:**
   - **Risk:** API calls slower than localStorage
   - **Mitigation:** Add caching, optimize queries, monitor performance
   - **Impact:** Medium (affects user experience)

3. **Network Failures:**
   - **Risk:** Users can't save/load sessions offline
   - **Mitigation:** Handle errors gracefully, show user feedback
   - **Impact:** Medium (affects user experience)

### Medium Risk Areas

1. **RLS Policy Issues:**
   - **Risk:** Users can't access their sessions
   - **Mitigation:** Thoroughly test RLS policies, monitor errors
   - **Impact:** Medium (blocks functionality)

2. **Race Conditions:**
   - **Risk:** Multiple tabs overwrite each other
   - **Mitigation:** Use optimistic locking, handle conflicts
   - **Impact:** Low (rare scenario)

---

## Success Criteria

### Functional Requirements

- [x] Sessions persist across page refreshes
- [x] Sessions persist across browser sessions
- [x] No cross-user data contamination
- [x] No stale data issues
- [x] Profile creation clears session correctly
- [x] Session expiry works correctly
- [x] Authenticated users linked correctly

### Performance Requirements

- [ ] Session load time < 200ms (p95)
- [ ] Session save time < 300ms (p95)
- [ ] Database query time < 100ms (p95)
- [ ] No noticeable UI lag

### Quality Requirements

- [ ] Zero data loss incidents
- [ ] Zero cross-user contamination incidents
- [ ] Error rate < 0.1%
- [ ] All tests passing

---

## Timeline Estimate

**Phase 1:** Database Schema - 2-3 hours  
**Phase 2:** API Routes - 4-6 hours  
**Phase 3:** Client Refactoring - 6-8 hours  
**Phase 4:** Migration - 1-2 hours  
**Phase 5:** Testing - 4-6 hours  
**Phase 6:** Deployment - 2-3 hours  
**Phase 7:** Cleanup - 1-2 hours  

**Total Estimate:** 20-30 hours

**Recommended Approach:**
- Week 1: Phases 1-3 (Development)
- Week 2: Phases 4-5 (Testing)
- Week 3: Phases 6-7 (Deployment & Cleanup)

---

## Dependencies

- Supabase database access
- Existing session cookie infrastructure
- ProspectChatContext refactoring capability
- Testing infrastructure

---

## Critical: Handling Returning Users (Session Recovery)

### The Problem: Returning Users Who Lost Their Cookie

**Scenario:**
1. User starts prospect chat (unauthenticated)
2. Provides information (conversation, preferences, **NO email shared**)
3. Leaves before signing up
4. Returns later (days/weeks later)
5. **Problem:** Cookie expired/cleared, different browser, can't find session

**Current Limitations:**
- HttpOnly cookie approach only works if:
  - User returns on same browser
  - Cookie hasn't expired (7 days)
  - Cookie hasn't been cleared
- If cookie is lost AND no email shared → **can't find previous session**

### Solution: Multi-Tier Recovery Strategy

**Reality Check:**
- **Most users DON'T share email before signup** (they're just exploring)
- **Prospect sessions are temporary** (7-day expiry)
- **Starting fresh is acceptable UX** for unauthenticated users
- **Primary goal:** Preserve session when cookie exists (most common case)

**Recovery Strategy (Tiered Approach):**

#### Tier 1: Cookie-Based (Primary - Works 90% of cases)
- User returns on same browser → Cookie exists → Session loaded automatically
- **Success rate:** High (most users return on same browser)

#### Tier 2: Email-Based (Secondary - Only if email was shared)
- If user shared email in conversation → Extract and store
- When user returns → AI asks for email → Find session by email
- **Success rate:** Low (most users don't share email before signup)
- **Use case:** User explicitly shared email during chat

#### Tier 3: Name + Details Matching (Tertiary - Experimental)
- If user shared name and other identifying details → Store in session
- When user returns → AI asks for name/details → Fuzzy match against sessions
- **Success rate:** Very low (privacy concerns, false matches)
- **Recommendation:** **Skip this tier** - too complex, privacy issues

#### Tier 4: Accept Fresh Start (Fallback - Acceptable UX)
- If no cookie AND no email → User starts fresh conversation
- **This is OK:** Prospect sessions are temporary, user hasn't signed up yet
- **UX:** AI can acknowledge: "I don't see a previous conversation. Let's start fresh!"

### Revised Implementation

**1. Cookie-Based Recovery (Primary):**
```typescript
// On page load
const cookieSession = await fetchSessionFromCookie();
if (cookieSession && !cookieSession.isNewSession) {
  // Cookie exists → Load session from database
  const session = await loadSession(cookieSession.sessionId);
  if (session) {
    // Restore conversation
    return session;
  }
}
// Cookie expired or new session → Start fresh
```

**2. Email-Based Recovery (Optional - Only if email was shared):**
```typescript
// Extract email from conversation (if user shares it)
const emailMatch = message.content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
if (emailMatch) {
  // Store email in session (for future recovery)
  await updateSessionEmail(sessionId, emailMatch[0]);
}

// Recovery flow (only if user explicitly shares email)
if (userMentionsPreviousChat && userProvidesEmail) {
  const recovered = await recoverSessionByEmail(email);
  if (recovered) {
    // Switch to recovered session
    setSessionId(recovered.sessionId);
    loadSession(recovered.sessionId);
  }
}
```

**3. AI Prompt Strategy:**
```typescript
// In AI system prompt
"If user mentions they chatted before but you don't see a previous session:
- If they provide an email: Try to recover their session by email
- If they don't provide email: Acknowledge and offer to start fresh
- Don't push for email if they don't want to share it
- Starting fresh is perfectly fine for prospect users"
```

**4. Accept Fresh Start (Default):**
```typescript
// If no cookie and no email → Start fresh
// This is acceptable UX for prospect users
// AI can say: "I don't see a previous conversation, but I'm happy to help you explore sailing opportunities!"
```

### Key Decisions

**What to Keep:**
- ✅ Cookie-based session persistence (primary method)
- ✅ Email extraction and storage (if user shares email)
- ✅ Email-based recovery API (for users who DID share email)
- ✅ Accept fresh start as default (acceptable UX)

**What to Remove/Skip:**
- ❌ Requiring email for session recovery (most users don't share it)
- ❌ Name/details matching (privacy concerns, false matches)
- ❌ Complex recovery flows (over-engineering)

**Acceptable Limitations:**
- If user loses cookie AND didn't share email → **They start fresh**
- This is **acceptable** because:
  - Prospect sessions are temporary (7-day expiry)
  - User hasn't signed up yet (low commitment)
  - Starting fresh is not a huge loss
  - Most users return on same browser (cookie works)

### Updated Database Schema

**Email field remains optional:**
```sql
email TEXT,  -- NULLABLE: Only set if user shares email in conversation
```

**Index for email recovery (only if email exists):**
```sql
CREATE INDEX IF NOT EXISTS idx_prospect_sessions_email 
  ON public.prospect_sessions(email) 
  WHERE email IS NOT NULL AND user_id IS NULL;
```

**Recovery function (only works if email was shared):**
```sql
-- Returns NULL if no email-based session found
-- This is expected - most users won't have email stored
CREATE OR REPLACE FUNCTION public.find_prospect_session_by_email(...)
```

### UX Flow

**Scenario 1: Cookie Exists (Most Common)**
```
User returns → Cookie found → Session loaded → Continue conversation
✅ Works seamlessly
```

**Scenario 2: Cookie Lost, Email Shared**
```
User returns → No cookie → User mentions previous chat → 
AI asks for email → User provides → Session recovered → Continue
✅ Works if email was shared
```

**Scenario 3: Cookie Lost, No Email (Most Common for No-Email Users)**
```
User returns → No cookie → User mentions previous chat → 
AI acknowledges → Offers to start fresh → User continues fresh
✅ Acceptable UX - user starts new conversation
```

**Recommendation:** Focus on Tier 1 (cookie-based). Tier 2 (email) is a nice-to-have bonus. Tier 3+ are not worth the complexity.

---

## Critical: Handling Unauthenticated Users

### The Problem

**Before Signup:**
- User has NO `user_id` in `auth.users` (not authenticated)
- User chats with AI, provides preferences, conversation history
- Session must be stored with `user_id = NULL`
- Multiple users on same browser must NOT see each other's sessions

**After Signup:**
- User creates account → gets `user_id` in `auth.users`
- Existing prospect session must be linked to new `user_id`
- User's conversation/preferences should persist after signup

### Solution Architecture

1. **Unauthenticated Sessions (`user_id = NULL`):**
   - Stored in database with `user_id = NULL`
   - Accessed via `session_id` from HttpOnly cookie
   - RLS policy allows access: `user_id IS NULL` (any unauthenticated user)
   - **Security:** API validates `session_id` from cookie matches requested session

2. **Session Linking on Signup:**
   - When user signs up, immediately call `linkSessionToUser(session_id, user_id, email)`
   - Links current session by `session_id`
   - Also links any other sessions with matching `email` (if user shared email)
   - After linking, `user_id` is set → session becomes protected by RLS

3. **RLS Policy Logic:**
   ```sql
   -- Unauthenticated users can access sessions with user_id IS NULL
   -- (validated by session_id from cookie)
   CREATE POLICY "Unauthenticated users can access their sessions"
     USING (user_id IS NULL);
   
   -- Authenticated users can only access their own sessions
   CREATE POLICY "Users can view own sessions"
     USING (auth.uid() = user_id);
   ```

4. **API Security:**
   - Always read `session_id` from HttpOnly cookie (server-side)
   - Validate requested `session_id` matches cookie `session_id`
   - Never allow access to sessions with `user_id != NULL` unless `auth.uid() === user_id`

### Implementation Points

**Where to Link Sessions:**

1. **Email Signup:** `/app/auth/signup/page.tsx`
   ```typescript
   // After successful signup
   const { data: { user } } = await supabase.auth.signUp({...});
   if (user) {
     await linkSessionToUser(sessionId, user.id, email);
   }
   ```

2. **OAuth Signup:** `/app/auth/callback/route.ts`
   ```typescript
   // After OAuth callback
   if (user && isFromProspect) {
     await linkSessionToUser(sessionId, user.id, user.email);
   }
   ```

3. **ProspectChatContext:** Auth state change handler
   ```typescript
   // When user signs in
   if (event === 'SIGNED_IN' && user) {
     await linkSessionToUser(currentSessionId, user.id, user.email);
   }
   ```

### Security Considerations

✅ **Secure:**
- Session IDs are UUIDs (hard to guess)
- Session IDs stored in HttpOnly cookies (not accessible to JavaScript)
- API validates session_id from cookie matches requested session
- After signup, session immediately linked to user_id (becomes protected)

⚠️ **Potential Risks:**
- Unauthenticated sessions accessible to anyone with session_id
- **Mitigation:** Session IDs are UUIDs + HttpOnly cookies + API validation
- Session data is not sensitive (just conversation/preferences)

✅ **After Signup:**
- Session linked to user_id → protected by RLS
- Only authenticated user can access their own sessions
- Multiple sessions can be linked to same user (by email)

---

## Notes

- This refactoring eliminates the root cause of stale data issues
- Server-side storage provides better data integrity
- Clean slate approach simplifies implementation
- Future enhancements (caching, analytics) become possible
- GDPR compliance easier (can delete by user_id)
- **CRITICAL:** Handles unauthenticated users properly (user_id = NULL)
- **CRITICAL:** Sessions automatically linked to users after signup

---

## Questions to Resolve

1. **Migration Strategy:** Clean slate vs. one-time migration?
   - **Recommendation:** Clean slate

2. **Offline Support:** Should we support offline mode?
   - **Recommendation:** No (prospect chat requires internet)

3. **Caching:** Should we add client-side caching?
   - **Recommendation:** Yes, in-memory cache to reduce API calls

4. **Debouncing:** How often should we save?
   - **Recommendation:** Max once per 2 seconds, or on user action

5. **Error Handling:** What happens on network failure?
   - **Recommendation:** Show error message, retry automatically, allow user to retry manually

6. **Session Linking:** When should we link sessions to users?
   - **Recommendation:** Immediately after signup, in auth callback or signup handler
   - **Implementation:** Call `linkSessionToUser()` in:
     - `/app/auth/callback/route.ts` (OAuth flow)
     - `/app/auth/signup/page.tsx` (email signup)
     - ProspectChatContext auth state change handler

7. **Email Storage:** Should we store email in sessions before signup?
   - **Recommendation:** Yes, if user shares email in conversation
   - **Benefit:** Can link multiple sessions if user had multiple browser sessions
   - **Benefit:** Enables session recovery for returning users
   - **Privacy:** Email is already shared in conversation, so storing in session is acceptable

8. **Session Recovery:** How should returning users find their sessions?
   - **Primary:** Cookie-based (works if cookie exists - most common case)
   - **Secondary:** Email-based recovery (only if user shared email - rare)
   - **Fallback:** Accept fresh start (acceptable UX for prospect users)
   - **Reality:** Most users don't share email before signup, so recovery is limited
   - **Decision:** Focus on cookie persistence, email recovery is bonus feature

9. **Multiple Sessions:** What if user has sessions on multiple devices?
   - **Recommendation:** Merge sessions when user signs up (by email)
   - **Implementation:** `mergeSessions()` function combines conversations/preferences
   - **Strategy:** Keep most recent session as target, merge others into it
   - **Note:** Only works if user shared email, otherwise sessions remain separate

10. **No Email Scenario:** What if user never shares email?
   - **Answer:** User relies on cookie persistence (Tier 1)
   - **If cookie lost:** User starts fresh (acceptable - prospect sessions are temporary)
   - **This is OK:** Most users return on same browser, cookie works
   - **Don't over-engineer:** Complex recovery isn't worth it for unauthenticated users

---

## Approval

**Status:** Pending Review  
**Next Steps:** Review plan, resolve questions, begin Phase 1
