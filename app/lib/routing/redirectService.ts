/**
 * Redirect Service - Centralized redirect decision engine
 * Single source of truth for all redirect logic
 */

import type { RedirectContext, RedirectResult } from './redirectTypes';

class RedirectService {
  /**
   * Determine redirect path based on user context
   * Returns the highest priority redirect path
   */
  async determineRedirect(context: RedirectContext): Promise<RedirectResult> {
    const checks = [
      () => this.checkPendingOnboardingSessions(context),
      () => this.checkProfileCompletionTriggered(context),
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

  /**
   * Priority 1: Check for pending onboarding sessions
   * Users with active onboarding sessions stay in onboarding flow
   */
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

  /**
   * Priority 2: Check for profile completion triggered sessions
   * Users who triggered profile completion return to onboarding
   */
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

  /**
   * Priority 3: Check for existing conversations
   * Users with existing conversation history return to chat
   */
  private checkExistingConversations(
    context: RedirectContext
  ): RedirectResult | null {
    if (context.existingOwnerConversation) {
      return {
        path: '/welcome/owner',
        reason: 'existing_owner_conversation',
        priority: 3,
      };
    }
    if (context.existingProspectConversation) {
      return {
        path: '/welcome/crew',
        reason: 'existing_prospect_conversation',
        priority: 3,
      };
    }
    return null;
  }

  /**
   * Priority 4: Check source-based redirects
   * Context-aware redirects based on where user came from
   */
  private checkSourceBasedRedirects(
    context: RedirectContext
  ): RedirectResult | null {
    // If user came from owner chat, redirect back to owner chat with profile completion
    if (context.fromOwner) {
      return {
        path: '/welcome/owner',
        reason: 'source_owner_chat',
        priority: 4,
        queryParams: { profile_completion: 'true' },
      };
    }

    // If user came from prospect chat, redirect back to prospect chat with profile completion
    if (context.fromProspect) {
      return {
        path: '/welcome/crew',
        reason: 'source_prospect_chat',
        priority: 4,
        queryParams: { profile_completion: 'true' },
      };
    }

    return null;
  }

  /**
   * Priority 5: Check role-based redirects
   * Based on user profile roles
   */
  private checkRoleBasedRedirects(
    context: RedirectContext
  ): RedirectResult | null {
    if (!context.profile || !context.profile.roles || context.profile.roles.length === 0) {
      return null;
    }

    // Priority: owner > crew (if user has both roles)
    if (context.profile.roles.includes('owner')) {
      return {
        path: '/owner/journeys',
        reason: 'role_owner',
        priority: 5,
      };
    }

    if (context.profile.roles.includes('crew')) {
      return {
        path: '/crew',
        reason: 'role_crew',
        priority: 5,
      };
    }

    return null;
  }

  /**
   * Priority 6: Check new user redirects
   * NOTE: /profile-setup route is deprecated - all onboarding now via AI flows
   * New users are directed to crew homepage or kept in onboarding flow
   */
  private checkNewUserRedirects(
    context: RedirectContext
  ): RedirectResult | null {
    // New users without pending onboarding session go to crew homepage
    if (context.isNewUser) {
      return {
        path: '/crew',
        reason: 'new_user_no_profile',
        priority: 6,
      };
    }

    return null;
  }
}

export const redirectService = new RedirectService();
