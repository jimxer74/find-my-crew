# Proposal: Centralized Redirect Management System

## Problem Statement

Currently, redirect logic for authenticated users is scattered across multiple files with duplicated checks and inconsistent priorities. This makes the codebase hard to maintain, test, and understand.

### Current Issues

1. **Logic Scattered Across 6+ Files:**
   - `app/page.tsx` - Root route redirect logic (60+ lines)
   - `app/auth/callback/route.ts` - OAuth callback redirects (50+ lines)
   - `app/auth/login/page.tsx` - Login page redirects (50+ lines)
   - `app/components/LoginModal.tsx` - Modal login redirects (30+ lines)
   - `app/components/SignupModal.tsx` - Signup redirects
   - `app/owner/dashboard/page.tsx` - Dashboard redirects
   - `app/lib/profile/redirectHelper.ts` - Profile redirects

2. **Inconsistent Priorities:**
   - Different entry points use different priority orders
   - `app/page.tsx` checks pending sessions before redirecting
   - `app/auth/login/page.tsx` has different priority order
   - `app/auth/callback/route.ts` uses yet another order

3. **Hard to Maintain:**
   - Changes require updates in multiple places
   - Risk of introducing bugs when updating one location but missing others
   - No single source of truth for redirect rules

4. **Hard to Test:**
   - Logic embedded in components/pages
   - Difficult to unit test redirect decisions
   - No way to verify consistency across entry points

5. **No Observability:**
   - No centralized logging of redirect decisions
   - Hard to debug why users are redirected to specific paths
   - No analytics on redirect patterns

## Proposed Solution

Create a centralized `RedirectService` that serves as the single source of truth for all redirect decisions. This service will:

- Consolidate all redirect logic into one maintainable module
- Provide consistent priority ordering across all entry points
- Enable easy testing and debugging
- Support both client-side and server-side redirects
- Include structured logging for observability

## Architecture

### File Structure

```
app/lib/routing/
├── redirectService.ts          # Main redirect logic engine
├── redirectTypes.ts            # TypeScript type definitions
├── redirectContext.ts          # Context detection utilities
└── redirectHelpers.ts          # Client/server helper functions
```

### Core Components

#### 1. Redirect Decision Engine (`redirectService.ts`)

The main service that determines redirect paths based on user context.

**Key Features:**
- Priority-based decision tree
- Type-safe context handling
- Structured result with reason and priority
- Easy to extend with new rules

**Priority Order:**
1. **Pending Onboarding Sessions** (Priority 1)
   - Users with active onboarding sessions stay in onboarding flow
   - Owner: `/welcome/owner`
   - Prospect: `/welcome/crew`

2. **Profile Completion Triggered** (Priority 2)
   - Users who triggered profile completion return to onboarding
   - Owner: `/welcome/owner?profile_completion=true`
   - Prospect: `/welcome/crew?profile_completion=true`

3. **Existing Conversations** (Priority 3)
   - Users with existing conversation history return to chat
   - Owner: `/welcome/owner`
   - Prospect: `/welcome/crew`

4. **Source-Based Redirects** (Priority 4)
   - Context-aware redirects based on where user came from
   - OAuth callbacks, in-chat signups, etc.

5. **Role-Based Redirects** (Priority 5)
   - Based on user profile roles
   - Owner: `/owner` (!note route is not implemented yet, but will be)
   - Crew: `/crew`

6. **New User Redirects** (Priority 6)
   - Facebook login → `/profile-setup`
   - No profile → `/profile-setup` or `/crew`

7. **Default Fallback** (Priority 999)
   - `/crew` homepage

#### 2. Context Builder (`redirectContext.ts`)

Assembles all required data for redirect decisions.

**Responsibilities:**
- Fetch user profile
- Check for pending sessions
- Check for profile completion triggers
- Check for existing conversations
- Parallel data fetching for performance

**Data Sources:**
- `profiles` table
- `owner_sessions` table
- `prospect_sessions` table
- Auth metadata (Facebook login, etc.)

#### 3. Integration Helpers (`redirectHelpers.ts`)

Convenience functions for common use cases.

**Client-Side Helpers:**
- `redirectAfterAuth()` - For client-side redirects after login/signup
- `shouldStayOnHomepage()` - Check if user should remain on homepage

**Server-Side Helpers:**
- `getRedirectResponse()` - For API route redirects (OAuth callbacks)

## Implementation Details

### Type Definitions (`redirectTypes.ts`)

```typescript
export type RedirectSource = 
  | 'owner' 
  | 'prospect' 
  | 'oauth' 
  | 'login' 
  | 'signup' 
  | 'root';

export interface RedirectContext {
  userId: string;
  source?: RedirectSource;
  profile?: {
    roles: string[];
    username?: string | null;
  };
  pendingOwnerSession?: boolean;
  pendingProspectSession?: boolean;
  ownerProfileCompletionTriggered?: boolean;
  prospectProfileCompletionTriggered?: boolean;
  existingOwnerConversation?: boolean;
  existingProspectConversation?: boolean;
  isNewUser?: boolean;
  isFacebookLogin?: boolean;
  fromOwner?: boolean;
  fromProspect?: boolean;
}

export interface RedirectResult {
  path: string;
  reason: string;
  priority: number;
  queryParams?: Record<string, string>;
}
```

### Redirect Service (`redirectService.ts`)

```typescript
class RedirectService {
  /**
   * Determine redirect path based on user context
   * Returns the highest priority redirect path
   */
  async determineRedirect(context: RedirectContext): Promise<RedirectResult> {
    const checks = [
      () => this.checkPendingOnboardingSessions(context),
      () => this.checkProfileCompletionTriggered(context),
      () => this.checkExistingConversations(context),
      () => this.checkSourceBasedRedirects(context),
      () => this.checkRoleBasedRedirects(context),
      () => this.checkNewUserRedirects(context),
    ];

    // Return first non-null result (highest priority)
    for (const check of checks) {
      const result = await check();
      if (result) return result;
    }

    // Default fallback
    return {
      path: '/crew',
      reason: 'default_fallback',
      priority: 999,
    };
  }

  private checkPendingOnboardingSessions(
    context: RedirectContext
  ): RedirectResult | null {
    if (context.pendingOwnerSession) {
      return {
        path: '/welcome/owner',
        reason: 'pending_owner_onboarding',
        priority: 1,
      };
    }
    if (context.pendingProspectSession) {
      return {
        path: '/welcome/crew',
        reason: 'pending_prospect_onboarding',
        priority: 1,
      };
    }
    return null;
  }

  private checkProfileCompletionTriggered(
    context: RedirectContext
  ): RedirectResult | null {
    if (context.ownerProfileCompletionTriggered) {
      return {
        path: '/welcome/owner',
        reason: 'owner_profile_completion_triggered',
        priority: 2,
        queryParams: { profile_completion: 'true' },
      };
    }
    if (context.prospectProfileCompletionTriggered) {
      return {
        path: '/welcome/crew',
        reason: 'prospect_profile_completion_triggered',
        priority: 2,
        queryParams: { profile_completion: 'true' },
      };
    }
    return null;
  }

  // ... other priority checks
}

export const redirectService = new RedirectService();
```

### Context Builder (`redirectContext.ts`)

```typescript
export async function buildRedirectContext(
  userId: string,
  source?: RedirectSource,
  additionalData?: Partial<RedirectContext>
): Promise<RedirectContext> {
  const supabase = getSupabaseClient(); // Server or browser client
  
  // Parallel fetch all required data
  const [
    profile,
    pendingOwnerSession,
    pendingProspectSession,
    ownerProfileCompletionSession,
    prospectProfileCompletionSession,
    existingOwnerSession,
    existingProspectSession,
  ] = await Promise.all([
    fetchProfile(userId, supabase),
    checkPendingOwnerSession(userId, supabase),
    checkPendingProspectSession(userId, supabase),
    checkOwnerProfileCompletionTriggered(userId, supabase),
    checkProspectProfileCompletionTriggered(userId, supabase),
    checkExistingOwnerConversation(userId, supabase),
    checkExistingProspectConversation(userId, supabase),
  ]);

  return {
    userId,
    source,
    profile,
    pendingOwnerSession: !!pendingOwnerSession,
    pendingProspectSession: !!pendingProspectSession,
    ownerProfileCompletionTriggered: !!ownerProfileCompletionSession,
    prospectProfileCompletionTriggered: !!prospectProfileCompletionSession,
    existingOwnerConversation: (existingOwnerSession?.conversation?.length ?? 0) > 0,
    existingProspectConversation: (existingProspectSession?.conversation?.length ?? 0) > 0,
    ...additionalData,
  };
}
```

### Integration Helpers (`redirectHelpers.ts`)

```typescript
import { redirectService } from './redirectService';
import { buildRedirectContext } from './redirectContext';
import type { RedirectSource } from './redirectTypes';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Client-side redirect helper
 * Use in React components after authentication
 */
export async function redirectAfterAuth(
  userId: string,
  source: RedirectSource,
  router: AppRouterInstance,
  additionalContext?: Partial<RedirectContext>
): Promise<void> {
  const context = await buildRedirectContext(userId, source, additionalContext);
  const result = await redirectService.determineRedirect(context);
  
  const url = result.queryParams
    ? `${result.path}?${new URLSearchParams(result.queryParams).toString()}`
    : result.path;
  
  console.log(`[RedirectService] ${result.reason} (priority ${result.priority}): ${url}`);
  router.push(url);
  router.refresh();
}

/**
 * Server-side redirect helper (for API routes)
 * Use in Next.js API routes and server components
 */
export async function getRedirectResponse(
  userId: string,
  source: RedirectSource,
  request: Request,
  additionalContext?: Partial<RedirectContext>
): Promise<NextResponse> {
  const context = await buildRedirectContext(userId, source, additionalContext);
  const result = await redirectService.determineRedirect(context);
  
  const url = result.queryParams
    ? `${result.path}?${new URLSearchParams(result.queryParams).toString()}`
    : result.path;
  
  console.log(`[RedirectService] ${result.reason} (priority ${result.priority}): ${url}`);
  return NextResponse.redirect(new URL(url, request.url));
}

/**
 * Check if user should stay on homepage (for root route)
 * Returns true if user has pending onboarding session
 */
export async function shouldStayOnHomepage(userId: string): Promise<boolean> {
  const context = await buildRedirectContext(userId, 'root');
  const result = await redirectService.determineRedirect(context);
  
  // Stay on homepage if there's a pending onboarding session
  return result.reason === 'pending_owner_onboarding' || 
         result.reason === 'pending_prospect_onboarding';
}

/**
 * Get redirect path without performing redirect
 * Useful for conditional logic or logging
 */
export async function getRedirectPath(
  userId: string,
  source: RedirectSource,
  additionalContext?: Partial<RedirectContext>
): Promise<string> {
  const context = await buildRedirectContext(userId, source, additionalContext);
  const result = await redirectService.determineRedirect(context);
  
  return result.queryParams
    ? `${result.path}?${new URLSearchParams(result.queryParams).toString()}`
    : result.path;
}
```

## Usage Examples

### Before: Root Route (`app/page.tsx`)

**Before (60+ lines of duplicate logic):**
```typescript
useEffect(() => {
  async function checkUserAndRedirect() {
    if (authLoading) return;
    if (!user) {
      setIsCheckingRole(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.roles && profile.roles.length > 0) {
        if (profile.roles.includes('owner')) {
          const { data: pendingOwnerSession } = await supabase
            .from('owner_sessions')
            .select('session_id')
            .eq('user_id', user.id)
            .in('onboarding_state', ['signup_pending', 'consent_pending', 'profile_pending', 'boat_pending', 'journey_pending'])
            .limit(1)
            .maybeSingle();

          if (pendingOwnerSession) {
            setIsCheckingRole(false);
            return;
          }
        }

        if (profile.roles.includes('owner')) {
          router.push('/owner/dashboard');
          return;
        } else if (profile.roles.includes('crew')) {
          router.push('/crew');
          return;
        }
      }
    } catch (error) {
      console.error('Failed to check user profile:', error);
    }

    setIsCheckingRole(false);
  }

  checkUserAndRedirect();
}, [user, authLoading, router]);
```

**After (clean and simple):**
```typescript
import { shouldStayOnHomepage, redirectAfterAuth } from '@/app/lib/routing/redirectHelpers';

useEffect(() => {
  async function checkUserAndRedirect() {
    if (authLoading) return;
    if (!user) {
      setIsCheckingRole(false);
      return;
    }

    // Check if user should stay on homepage (pending onboarding)
    const shouldStay = await shouldStayOnHomepage(user.id);
    if (shouldStay) {
      setIsCheckingRole(false);
      return;
    }

    // Otherwise redirect based on context
    await redirectAfterAuth(user.id, 'root', router);
    setIsCheckingRole(false);
  }

  checkUserAndRedirect();
}, [user, authLoading, router]);
```

### Before: OAuth Callback (`app/auth/callback/route.ts`)

**Before (50+ lines):**
```typescript
// Determine redirect based on context and profile
let redirectPath = '/crew';

if (isFromOwner) {
  redirectPath = '/welcome/owner?profile_completion=true';
} else if (isFromProspect) {
  redirectPath = '/welcome/crew?profile_completion=true';
} else if (pendingOwnerSession) {
  redirectPath = '/welcome/owner';
} else if (pendingProspectSession) {
  redirectPath = '/welcome/crew';
} else if (existingOwnerSession?.conversation && existingOwnerSession.conversation.length > 0) {
  redirectPath = '/welcome/owner';
} else if (existingProspectSession?.conversation && existingProspectSession.conversation.length > 0) {
  redirectPath = '/welcome/crew';
} else if (profile && profile.roles && profile.roles.length > 0) {
  if (profile.roles.includes('owner')) {
    redirectPath = '/owner/dashboard';
  } else if (profile.roles.includes('crew')) {
    redirectPath = '/crew';
  }
}

return NextResponse.redirect(new URL(redirectPath, request.url));
```

**After (clean and consistent):**
```typescript
import { getRedirectResponse } from '@/app/lib/routing/redirectHelpers';

if (user) {
  const additionalContext = {
    isFacebookLogin: isFacebookLogin,
    fromOwner: isFromOwner,
    fromProspect: isFromProspect,
    isNewUser: !profile || !profile.username,
  };
  
  return await getRedirectResponse(user.id, 'oauth', request, additionalContext);
}
```

### Before: Login Page (`app/auth/login/page.tsx`)

**Before (50+ lines):**
```typescript
let redirectPath = '/crew';

if (ownerSession) {
  redirectPath = '/welcome/owner';
} else if (prospectSession) {
  redirectPath = '/welcome/crew';
} else if (ownerProfileCompletionSession) {
  redirectPath = '/welcome/owner';
} else if (prospectProfileCompletionSession) {
  redirectPath = '/welcome/crew';
} else if (existingOwnerSession && existingOwnerSession.conversation && existingOwnerSession.conversation.length > 0) {
  redirectPath = '/welcome/owner';
} else if (existingProspectSession && existingProspectSession.conversation && existingProspectSession.conversation.length > 0) {
  redirectPath = '/welcome/crew';
} else if (profile && profile.roles && profile.roles.length > 0) {
  if (profile.roles.includes('owner')) {
    redirectPath = '/owner/dashboard';
  } else if (profile.roles.includes('crew')) {
    redirectPath = '/crew';
  }
} else {
  redirectPath = '/profile-setup';
}

router.push(redirectPath);
router.refresh();
```

**After:**
```typescript
import { redirectAfterAuth } from '@/app/lib/routing/redirectHelpers';

if (data.user) {
  await redirectAfterAuth(data.user.id, 'login', router);
}
```

### Before: Login Modal (`app/components/LoginModal.tsx`)

**Before (30+ lines):**
```typescript
// Similar duplicate logic...
```

**After:**
```typescript
import { redirectAfterAuth } from '@/app/lib/routing/redirectHelpers';

if (data.user) {
  const source = fromProspect ? 'prospect' : 'login';
  await redirectAfterAuth(data.user.id, source, router);
  onClose();
}
```

## Benefits

### 1. **Single Source of Truth**
- All redirect logic in one place (`redirectService.ts`)
- Changes propagate to all entry points automatically
- No risk of inconsistent behavior

### 2. **Consistent Priorities**
- Same priority order across all entry points
- Predictable behavior for users
- Easier to reason about redirect flow

### 3. **Maintainability**
- Change logic once, applies everywhere
- Clear separation of concerns
- Easy to add new redirect rules

### 4. **Testability**
- Pure functions, easy to unit test
- Mockable dependencies
- Test all scenarios in isolation

### 5. **Type Safety**
- TypeScript interfaces for all data structures
- Compile-time checks prevent errors
- Better IDE autocomplete support

### 6. **Observability**
- Structured logging with reasons and priorities
- Easy to debug redirect issues
- Analytics-ready (can track redirect patterns)

### 7. **Performance**
- Parallel data fetching
- Efficient database queries
- Optional caching layer

## Migration Strategy

### Phase 1: Create Service (Week 1)
- [ ] Create `app/lib/routing/` directory structure
- [ ] Implement `redirectTypes.ts` with type definitions
- [ ] Implement `redirectContext.ts` with context builder
- [ ] Implement `redirectService.ts` with decision engine
- [ ] Implement `redirectHelpers.ts` with integration helpers
- [ ] Add unit tests for redirect service

### Phase 2: Migrate Entry Points (Week 2-3)
- [ ] Migrate `app/page.tsx` (root route)
- [ ] Migrate `app/auth/callback/route.ts` (OAuth callback)
- [ ] Migrate `app/auth/login/page.tsx` (login page)
- [ ] Migrate `app/components/LoginModal.tsx` (login modal)
- [ ] Migrate `app/components/SignupModal.tsx` (signup modal)
- [ ] Migrate `app/owner/dashboard/page.tsx` (dashboard)

### Phase 3: Cleanup (Week 4)
- [ ] Remove old redirect logic from all files
- [ ] Update `app/lib/profile/redirectHelper.ts` to use new service
- [ ] Add integration tests
- [ ] Update documentation

### Phase 4: Enhancements (Week 5+)
- [ ] Add caching layer for context data
- [ ] Add analytics tracking
- [ ] Add performance monitoring
- [ ] Create admin dashboard for redirect analytics

## Testing Strategy

### Unit Tests

```typescript
// redirectService.test.ts
describe('RedirectService', () => {
  it('should prioritize pending onboarding sessions', async () => {
    const context: RedirectContext = {
      userId: '123',
      pendingOwnerSession: true,
      profile: { roles: ['owner'] },
    };
    const result = await redirectService.determineRedirect(context);
    expect(result.path).toBe('/welcome/owner');
    expect(result.reason).toBe('pending_owner_onboarding');
    expect(result.priority).toBe(1);
  });

  it('should redirect to role-based pages when no pending sessions', async () => {
    const context: RedirectContext = {
      userId: '123',
      profile: { roles: ['owner'] },
    };
    const result = await redirectService.determineRedirect(context);
    expect(result.path).toBe('/owner/dashboard');
    expect(result.reason).toBe('role_based_redirect');
  });

  // ... more test cases
});
```

### Integration Tests

```typescript
// redirectHelpers.test.ts
describe('redirectHelpers', () => {
  it('should redirect after auth correctly', async () => {
    const mockRouter = {
      push: jest.fn(),
      refresh: jest.fn(),
    };
    
    await redirectAfterAuth('user-123', 'login', mockRouter as any);
    
    expect(mockRouter.push).toHaveBeenCalled();
    expect(mockRouter.refresh).toHaveBeenCalled();
  });
});
```

## Performance Considerations

### Caching Strategy

```typescript
// Optional: Add caching layer
const contextCache = new Map<string, { context: RedirectContext; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

export async function buildRedirectContextCached(
  userId: string,
  source?: RedirectSource
): Promise<RedirectContext> {
  const cacheKey = `${userId}-${source}`;
  const cached = contextCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.context;
  }
  
  const context = await buildRedirectContext(userId, source);
  contextCache.set(cacheKey, { context, timestamp: Date.now() });
  
  return context;
}
```

### Database Query Optimization

- Use `select()` to fetch only required fields
- Use `limit(1)` for existence checks
- Parallel queries with `Promise.all()`
- Consider database indexes on frequently queried fields

## Monitoring and Analytics

### Logging Structure

```typescript
{
  timestamp: '2026-02-12T10:30:00Z',
  userId: 'user-123',
  source: 'login',
  redirectPath: '/welcome/owner',
  reason: 'pending_owner_onboarding',
  priority: 1,
  context: {
    hasProfile: true,
    roles: ['owner'],
    pendingOwnerSession: true,
  }
}
```

### Analytics Events

Track redirect patterns:
- Most common redirect reasons
- User flow through onboarding
- Drop-off points
- Performance metrics

## Future Enhancements

1. **A/B Testing Support**
   - Test different redirect strategies
   - Measure conversion rates

2. **Personalization**
   - User preference-based redirects
   - Time-based redirects (e.g., return to last page)

3. **Admin Dashboard**
   - View redirect patterns
   - Configure redirect rules
   - Debug user redirect issues

4. **Multi-Language Support**
   - Locale-aware redirects
   - Language preference handling

## Conclusion

This centralized redirect management system will significantly improve code maintainability, consistency, and testability. By consolidating all redirect logic into a single service, we eliminate duplication, reduce bugs, and make the codebase easier to understand and modify.

The migration can be done incrementally, allowing us to test each entry point migration independently while maintaining backward compatibility.
