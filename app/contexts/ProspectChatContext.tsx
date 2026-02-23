'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ProspectMessage,
  ProspectSession,
  ProspectPreferences,
  PendingAction,
  KnownUserProfile,
  PROSPECT_NAME_TAG_REGEX,
  ProspectLegReference,
} from '@/app/lib/ai/prospect/types';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import * as sessionService from '@/app/lib/prospect/sessionService';
import { logger } from '@/app/lib/logger';

const SESSION_EXPIRY_DAYS = 7; // Keep for reference, expiry handled server-side

/**
 * Fetch session ID from server (stored in HttpOnly cookie)
 */
async function fetchSessionFromCookie(): Promise<{ sessionId: string; isNewSession: boolean } | null> {
  try {
    const response = await fetch('/api/prospect/session');
    if (!response.ok) return null;
    return response.json();
  } catch (err: unknown) {
    logger.error('Failed to fetch session from cookie', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/**
 * Clear the session cookie on server
 */
async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/prospect/session', { method: 'DELETE' });
  } catch (err: unknown) {
    logger.error('Failed to clear session cookie', { error: err instanceof Error ? err.message : String(err) });
  }
}

interface ProspectChatState {
  sessionId: string | null;
  messages: ProspectMessage[];
  preferences: ProspectPreferences;
  viewedLegs: string[];
  isLoading: boolean;
  error: string | null;
  profileCompletionMode: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  userProfile: KnownUserProfile | null;
  /** Email stored in prospect_sessions.email for current session */
  sessionEmail: string | null;
  /** True when prospect_sessions.email is set for current session */
  hasSessionEmail: boolean;
  /** True only after user has completed signup AND granted AI consent (consentSetupCompleted with aiProcessingConsent) */
  consentGrantedForProfileCompletion: boolean;
  /** True if user has a profile (regardless of completion status) */
  hasExistingProfile: boolean;
  /** Count of user messages sent after signup (for fallback strategy) */
  userMessageCountAfterSignup: number;
  /** Onboarding state: signup_pending, consent_pending, profile_pending, completed */
  onboardingState: string;
}

interface ProspectChatContextType extends ProspectChatState {
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
  clearSession: () => void;
  addViewedLeg: (legId: string) => void;
  approveAction: (messageId: string, action: PendingAction) => Promise<void>;
  cancelAction: (messageId: string) => void;
  isReturningUser: boolean;
  /** Trigger fallback profile extraction modal */
  triggerFallbackProfileExtraction: () => void;
  updateOnboardingState: (state: string) => Promise<void>;
}

const ProspectChatContext = createContext<ProspectChatContextType | null>(null);

/**
 * NOTE: Session loading and saving now handled by sessionService via API
 * localStorage functions removed - all session data stored server-side
 */

/**
 * Extract known profile data from Supabase auth user metadata.
 * OAuth providers (Facebook, Google, etc.) populate user_metadata with
 * name, email, phone, avatar_url, and other fields.
 */
function extractKnownProfile(user: { email?: string; phone?: string; user_metadata?: Record<string, unknown> }): KnownUserProfile {
  const meta = user.user_metadata || {};
  return {
    fullName: (meta.full_name as string) || (meta.name as string) || null,
    email: user.email || (meta.email as string) || null,
    phone: user.phone || (meta.phone as string) || null,
    avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || null,
  };
}

export function ProspectChatProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQueryProcessed = useRef(false);
  const profileCompletionProcessed = useRef(false);
  const stateRef = useRef<ProspectChatState | null>(null);

  const [state, setState] = useState<ProspectChatState>({
    sessionId: null,
    messages: [],
    preferences: {},
    viewedLegs: [],
    isLoading: false,
    error: null,
    profileCompletionMode: false,
    isAuthenticated: false,
    userId: null,
    userProfile: null,
    sessionEmail: null,
    hasSessionEmail: false,
    consentGrantedForProfileCompletion: false,
    hasExistingProfile: false,
    userMessageCountAfterSignup: 0,
    onboardingState: 'signup_pending',
  });

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [isReturningUser, setIsReturningUser] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const initSessionRunRef = useRef(false); // Track if initSession has run

  // Load session on mount - get session ID from cookie, then load data from API
  useEffect(() => {
    // CRITICAL: Only run once on mount to prevent overwriting messages
    if (initSessionRunRef.current) {
      return;
    }
    initSessionRunRef.current = true;

    async function initSession() {
      try {
        // Check if we're in profile completion mode (post-signup flow)
        const isProfileCompletionMode = searchParams?.get('profile_completion') === 'true';

        // Get session ID from HttpOnly cookie
        const cookieSession = await fetchSessionFromCookie();
        
        if (!cookieSession) {
          logger.debug('No session cookie found - starting fresh', {}, true);
          setIsInitialized(true);
          return;
        }

        const sessionId = cookieSession.sessionId;
        logger.debug('Session ID from cookie', { sessionId, isNewSession: cookieSession.isNewSession }, true);

        // Load session data from API
        let loadedSession: ProspectSession | null = null;
        if (!cookieSession.isNewSession) {
          // Existing session - try to load from database
          try {
            loadedSession = await sessionService.loadSession(sessionId);
            if (loadedSession) {
              const userMessages = loadedSession.conversation.filter(m => m.role === 'user');
              const assistantMessages = loadedSession.conversation.filter(m => m.role === 'assistant');
              logger.debug('Loaded session from API', {
                totalMessages: loadedSession.conversation.length,
                userMessages: userMessages.length,
                assistantMessages: assistantMessages.length,
              }, true);
              
              // CRITICAL: Clear skills from preferences if they exist - skills should ONLY come from conversation, not stored preferences
              // This prevents stale skills from previous sessions being reused
              if (loadedSession.gatheredPreferences?.skills) {
                logger.debug('Removing stale skills from loaded preferences', { skills: loadedSession.gatheredPreferences.skills }, true);
                const { skills, ...prefsWithoutSkills } = loadedSession.gatheredPreferences;
                loadedSession.gatheredPreferences = prefsWithoutSkills;
                // Save cleaned preferences back to API
                await sessionService.saveSession(sessionId, loadedSession);
              }
              
              // Extract PROSPECT_NAME from all assistant messages if not already in preferences
              // This ensures the name persists even if it was extracted in an earlier message
              if (!loadedSession.gatheredPreferences?.fullName) {
                for (const msg of assistantMessages) {
                  const nameMatch = msg.content.match(PROSPECT_NAME_TAG_REGEX);
                  if (nameMatch?.[1]?.trim()) {
                    const extractedName = nameMatch[1].trim();
                    logger.debug('Found PROSPECT_NAME in stored message', { name: extractedName }, true);
                    // Update preferences with extracted name
                    loadedSession.gatheredPreferences = {
                      ...loadedSession.gatheredPreferences,
                      fullName: extractedName,
                    };
                    // Save updated preferences back to API
                    await sessionService.saveSession(sessionId, loadedSession);
                    break; // Use first found name
                  }
                }
              }
            } else {
              logger.debug('No session found in database', { sessionId }, true);
            }
          } catch (error) {
            logger.error('Error loading session from API', { error: error instanceof Error ? error.message : String(error) });
            // Continue with empty session on error
          }
        }

        // Restore session data or start fresh
        if (loadedSession) {
          const sessionToUse = loadedSession;
          // Only clear fullName if this is a page refresh (session exists but no active conversation)
          // If there are messages, keep the fullName as it was extracted during the conversation
          const preferencesToUse = sessionToUse.conversation.length === 0
            ? (() => {
                // New/empty session - clear fullName
                const prefs = { ...sessionToUse.gatheredPreferences };
                delete prefs.fullName;
                return prefs;
              })()
            : sessionToUse.gatheredPreferences; // Active conversation - keep fullName
          
          // Update session if we cleared fullName
          if (sessionToUse.conversation.length === 0 && sessionToUse.gatheredPreferences?.fullName) {
            const updatedSession: ProspectSession = {
              ...sessionToUse,
              gatheredPreferences: preferencesToUse,
            };
            await sessionService.saveSession(sessionId, updatedSession);
          }
          
          setState((prev) => {
            // CRITICAL: Don't overwrite messages if they already exist (user might have sent a message)
            // Only set messages if state is empty (initial load)
            const shouldSetMessages = prev.messages.length === 0;
            if (!shouldSetMessages) {
              logger.debug('Skipping message overwrite - messages already exist in state', { count: prev.messages.length }, true);
            }
            // Recalculate user message count after signup from loaded messages
            // Count user messages that were sent after authentication (profile completion mode)
            let loadedMessageCount = prev.userMessageCountAfterSignup;
            if (shouldSetMessages && sessionToUse.conversation.length > 0) {
              // Count user messages in the loaded conversation
              // This is approximate - we can't know exactly when signup happened, but we count all user messages
              // The counter will continue incrementing from here
              const userMessagesInSession = sessionToUse.conversation.filter(m => m.role === 'user').length;
              loadedMessageCount = userMessagesInSession;
              logger.debug('Recalculated user message count from session', { count: loadedMessageCount }, true);
            }
            
            return {
              ...prev,
              sessionId,
              messages: shouldSetMessages ? sessionToUse.conversation : prev.messages,
              preferences: preferencesToUse,
              viewedLegs: sessionToUse.viewedLegs,
              sessionEmail: sessionToUse.sessionEmail ?? null,
              hasSessionEmail: sessionToUse.hasSessionEmail === true,
              userMessageCountAfterSignup: loadedMessageCount,
              onboardingState: sessionToUse.onboardingState || 'signup_pending',
            };
          });
          setIsReturningUser(sessionToUse.conversation.length > 0);
        } else {
          // No session found - start fresh
          logger.debug('Starting fresh session', {}, true);
          setState((prev) => ({
            ...prev,
            sessionId,
            messages: [],
            preferences: {},
            viewedLegs: [],
            sessionEmail: null,
            hasSessionEmail: false,
            onboardingState: 'signup_pending',
          }));
          setIsReturningUser(false);
        }

        // FALLBACK: Link session if onAuthStateChange fired before we had sessionId
        const isProfileCompletion = searchParams?.get('profile_completion') === 'true';
        if (sessionId && isProfileCompletion) {
          const supabase = getSupabaseBrowserClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            try {
              await sessionService.linkSessionToUser(
                sessionId,
                user.id,
                user.email || undefined,
                { postSignupOnboarding: true }
              );
              logger.debug('Fallback: linked prospect session to user', { userId: user.id }, true);

              // Update onboarding state to consent_pending after signup
              try {
                await sessionService.updateOnboardingState(sessionId, 'consent_pending');
                setState((prev) => ({
                  ...prev,
                  onboardingState: 'consent_pending',
                }));
                logger.debug('Fallback: updated onboarding state to consent_pending', {}, true);
              } catch (stateError) {
                logger.error('Error updating onboarding state after fallback signup', { error: stateError instanceof Error ? stateError.message : String(stateError) });
              }
            } catch (err) {
              logger.error('Fallback link failed', { error: err instanceof Error ? err.message : String(err) });
            }
          }
        }

        setIsInitialized(true);
      } catch (error) {
        logger.error('Error initializing session', { error: error instanceof Error ? error.message : String(error) });
        setIsInitialized(true); // Still mark as initialized to prevent infinite loops
      }
    }

    initSession();
  }, []); // Empty dependency array - only run once on mount to prevent overwriting messages

  // Detect profile completion mode and check authentication
  useEffect(() => {
    async function checkProfileCompletionMode() {
      const isProfileCompletion = searchParams?.get('profile_completion') === 'true';

      if (isProfileCompletion) {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const knownProfile = extractKnownProfile(user);
          setState((prev) => ({
            ...prev,
            profileCompletionMode: true,
            isAuthenticated: true, // User exists = authenticated
            userId: user.id,
            userProfile: knownProfile,
            sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
            hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
          }));
          logger.debug('Profile completion mode activated', { userId: user.id, knownProfile }, true);
        }
      }
    }

    if (isInitialized) {
      checkProfileCompletionMode();
    }
  }, [isInitialized, searchParams]);

  // NOTE: Profile check is now handled by the onAuthStateChange hook below
  // This useEffect was redundant and caused timing issues - removed

  // Listen for auth state changes to update isAuthenticated when user logs in/out
  // This runs IMMEDIATELY on mount to check auth state and profile
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    
    // Check initial auth state on mount - this runs immediately, not waiting for isInitialized
    async function checkAuthAndProfile() {
      logger.debug('Checking auth state on mount', {}, true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        // AuthSessionMissingError is expected for unauthenticated users (prospect flow)
        // Don't log it as an error - it's a normal state
        const isSessionMissingError = authError.message?.includes('Auth session missing') || 
                                      authError.name === 'AuthSessionMissingError';
        
        if (isSessionMissingError) {
          logger.debug('User is not authenticated (expected for prospect flow)', {}, true);
        } else {
          logger.error('Auth check error', { error: authError instanceof Error ? authError.message : String(authError) });
        }
        
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          userId: null,
          userProfile: null,
          hasExistingProfile: false,
        }));
        return;
      }

      if (user) {
        const knownProfile = extractKnownProfile(user);
        logger.debug('User found, checking profile', { userId: user.id }, true);
        
        // Use retry mechanism to wait for session to be fully established
        const queryProfileWithRetry = async (retryCount = 0): Promise<void> => {
          try {
            logger.debug('Initial check - Querying profiles table for user', { userId: user.id, attempt: retryCount + 1 }, true);
            logger.debug('Initial check - Supabase client exists', { exists: !!supabase }, true);
            
            // First verify session is available
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !currentSession) {
              if (retryCount < 3) {
                logger.warn('Initial check - Session not ready yet, retrying in 500ms');
                setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
                // Set auth state but don't query profile yet
                setState((prev) => ({
                  ...prev,
                  isAuthenticated: true,
                  userId: user.id,
                  userProfile: knownProfile,
                  sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
                  hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
                  hasExistingProfile: false,
                }));
                return;
              }
              logger.warn('Initial check - Session not ready after retries, setting auth state only');
              setState((prev) => ({
                ...prev,
                isAuthenticated: true,
                userId: user.id,
                userProfile: knownProfile,
                sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
                hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
                hasExistingProfile: false,
              }));
              return;
            }
            
            const queryStart = Date.now();
            const profileQuery = supabase
              .from('profiles')
              .select('id')
              .eq('id', user.id)
              .maybeSingle();
            
            logger.debug('Initial check - Query promise created, awaiting', {}, true);
            
            const { data: profile, error: profileError } = await profileQuery;
            
            const queryDuration = Date.now() - queryStart;
            logger.debug('Initial check - Profile query completed', { durationMs: queryDuration }, true);
            logger.debug('Initial check - Profile query result', {
              hasProfile: !!profile,
              profile,
              error: profileError?.message,
              queryDuration,
            }, true);

            if (profileError) {
              // Check if it's a session/auth error
              const errorMsg = profileError.message?.toLowerCase() || '';
              if ((errorMsg.includes('session') || errorMsg.includes('auth') || profileError.code === 'PGRST301') && retryCount < 3) {
                logger.warn('Initial check - Auth session error, retrying in 500ms');
                setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
                return;
              }
              
              logger.error('Initial auth check - Profile query error', {
                userId: user.id,
                error: profileError?.message,
                errorCode: profileError?.code,
                errorMessage: profileError.message,
                errorDetails: profileError,
              });
            }

            const hasProfile = !!profile;
            logger.debug('Initial check - Setting hasExistingProfile', { hasProfile }, true);

            setState((prev) => ({
              ...prev,
              isAuthenticated: true, // User exists = authenticated
              userId: user.id,
              userProfile: knownProfile,
              sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
              hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
              hasExistingProfile: hasProfile, // Simple check: profile exists or not
            }));
            logger.debug('Initial auth check - User authenticated', {
              userId: user.id,
              profileExists: hasProfile,
              profileData: profile,
              profileError: profileError ? { code: profileError.code, message: profileError.message } : null,
              hasExistingProfile: hasProfile,
              isAuthenticated: true,
            }, true);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isSessionError = errorMessage.toLowerCase().includes('session') || errorMessage.toLowerCase().includes('auth');
            
            if (isSessionError && retryCount < 3) {
              logger.warn('Initial check - Session error caught, retrying in 500ms');
              setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
              // Set auth state but don't set profile - will retry
              setState((prev) => ({
                ...prev,
                isAuthenticated: true,
                userId: user.id,
                userProfile: knownProfile,
                sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
                hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
                hasExistingProfile: false,
              }));
            } else {
              logger.error('Initial auth check - Exception during profile check', { error: error instanceof Error ? error.message : String(error) });
              logger.error('Initial auth check - Exception details', {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
              });
              setState((prev) => ({
                ...prev,
                isAuthenticated: true,
                userId: user.id,
                userProfile: knownProfile,
                sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
                hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
                hasExistingProfile: false,
              }));
            }
          }
        };
        
        // Start the retry process
        queryProfileWithRetry();
      } else {
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          userId: null,
          userProfile: null,
          hasExistingProfile: false,
        }));
        logger.debug('Initial auth check - no user', {}, true);
      }
    }

    // Run immediately on mount
    checkAuthAndProfile();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('Auth state changed', { event, userId: session?.user?.id }, true);
      
      if (event === 'SIGNED_IN' && session?.user) {
        logger.debug('SIGNED_IN - Checking profile for user', { userId: session.user.id }, true);
        // User just signed in - set authenticated, then check profile
        const knownProfile = extractKnownProfile(session.user);
        
        // CRITICAL: Link prospect session to authenticated user after signup
        const currentSessionId = stateRef.current?.sessionId;
        const isProfileCompletion = typeof window !== 'undefined' && window.location.search.includes('profile_completion=true');
        if (currentSessionId) {
          try {
            await sessionService.linkSessionToUser(
              currentSessionId,
              session.user.id,
              session.user.email || undefined,
              { postSignupOnboarding: isProfileCompletion }
            );
            logger.debug('Linked prospect session to user', { userId: session.user.id }, true);

            // Update onboarding state to consent_pending after signup
            try {
              await sessionService.updateOnboardingState(currentSessionId, 'consent_pending');
              setState((prev) => ({
                ...prev,
                onboardingState: 'consent_pending',
              }));
              logger.debug('Updated onboarding state to consent_pending', {}, true);
            } catch (stateError) {
              logger.error('Error updating onboarding state after signup', { error: stateError instanceof Error ? stateError.message : String(stateError) });
            }
          } catch (error) {
            logger.error('Error linking session to user', { error: error instanceof Error ? error.message : String(error) });
            // Don't fail signup if linking fails - non-critical
          }
        }
        
        // First set authentication state
        setState((prev) => ({
          ...prev,
          isAuthenticated: true, // User exists = authenticated
          userId: session.user.id,
          userProfile: knownProfile,
          sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
          hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
        }));
        
        // Check if they have a profile (simple check - just existence)
        // Use a retry mechanism to wait for session to be fully established
        const queryProfileWithRetry = async (retryCount = 0): Promise<void> => {
          try {
            logger.debug('SIGNED_IN - Verifying session before querying profile', { attempt: retryCount + 1 }, true);
            
            // Verify session first
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !currentSession) {
              if (retryCount < 3) {
                logger.warn('SIGNED_IN - Session not ready, retrying in 500ms');
                setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
                return;
              }
              logger.error('SIGNED_IN - Session not available after retries', { error: sessionError instanceof Error ? sessionError.message : String(sessionError) });
              return;
            }
            
            logger.debug('SIGNED_IN - Session verified, querying profiles table for user', { userId: session.user.id }, true);
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();
            
            logger.debug('SIGNED_IN - Profile query COMPLETED', {}, true);
            logger.debug('SIGNED_IN - Profile query result', {
              hasProfile: !!profile,
              profile,
              error: profileError?.message,
              errorCode: profileError?.code,
            }, true);
            
            if (profileError) {
              // Check if it's a session/auth error
              const errorMsg = profileError.message?.toLowerCase() || '';
              if ((errorMsg.includes('session') || errorMsg.includes('auth') || profileError.code === 'PGRST301') && retryCount < 3) {
                logger.warn('SIGNED_IN - Auth session error, retrying in 500ms');
                setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
                return;
              }
              
              logger.error('SIGNED_IN - Profile query error', {
                userId: session.user.id,
                error: profileError?.message,
                errorCode: profileError?.code,
                errorMessage: profileError.message,
              });
            }
            
            const hasProfile = !!profile;
            logger.debug('SIGNED_IN - Setting hasExistingProfile', { hasProfile }, true);
            
            setState((prev) => {
              logger.debug('SIGNED_IN - setState callback, prev.hasExistingProfile', { hasExistingProfile: prev.hasExistingProfile }, true);
              return {
                ...prev,
                hasExistingProfile: hasProfile,
              };
            });
            
            logger.debug('SIGNED_IN - State updated, hasExistingProfile', { hasProfile }, true);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isSessionError = errorMessage.toLowerCase().includes('session') || errorMessage.toLowerCase().includes('auth');
            
            if (isSessionError && retryCount < 3) {
              logger.warn('SIGNED_IN - Session error caught, retrying in 500ms');
              setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
            } else {
              logger.error('SIGNED_IN - Exception during profile check', { error: error instanceof Error ? error.message : String(error) });
              logger.error('SIGNED_IN - Error details', {
                message: errorMessage,
              });
              setState((prev) => ({
                ...prev,
                hasExistingProfile: false,
              }));
            }
          }
        };
        
        // Start the retry process
        queryProfileWithRetry();
      } else if (event === 'SIGNED_OUT') {
        // User signed out - clear authentication state
        setState((prev) => ({
          ...prev,
          isAuthenticated: false, // No user = not authenticated
          userId: null,
          userProfile: null,
          hasExistingProfile: false,
        }));
        logger.debug('User signed out', {}, true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Trigger profile completion when landing with profile_completion=true OR returning user (incomplete profile + linked session)
  useEffect(() => {
    async function handleProfileCompletionMode() {
      const isProfileCompletionFromUrl = searchParams?.get('profile_completion') === 'true';

      if (profileCompletionProcessed.current || !isInitialized) return;

      const supabase = getSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const currentSessionId = stateRef.current?.sessionId;
      let session: ProspectSession | null = null;
      if (currentSessionId) {
        try {
          session = await sessionService.loadSession(currentSessionId);
        } catch (error) {
          logger.error('Error loading session for profile completion', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Returning user: no URL param, session has messages, not yet triggered, no profile
      const isReturningUser =
        !isProfileCompletionFromUrl &&
        session &&
        session.conversation.length > 0 &&
        !session.profileCompletionTriggeredAt;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      const hasProfile = !!profile;

      const shouldTrigger =
        isProfileCompletionFromUrl ||
        (isReturningUser && !hasProfile);

      if (!shouldTrigger) return;
      if (profileCompletionProcessed.current) return;

      profileCompletionProcessed.current = true;
      const knownProfile = extractKnownProfile(user);
      const currentMessages = stateRef.current?.messages || [];
      const userMessageCount = currentMessages.filter(m => m.role === 'user').length;

      setState((prev) => ({
        ...prev,
        profileCompletionMode: true,
        isAuthenticated: true,
        userId: user.id,
        userProfile: knownProfile,
        sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
        hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
        consentGrantedForProfileCompletion: true,
        isLoading: true,
        error: null,
        userMessageCountAfterSignup: userMessageCount,
      }));

      try {
        const res = await fetch('/api/ai/prospect/trigger-profile-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: session?.sessionId ?? currentSessionId ?? undefined,
            conversationHistory: session?.conversation ?? currentMessages,
            gatheredPreferences: session?.gatheredPreferences ?? stateRef.current?.preferences ?? {},
            userProfile: knownProfile,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.userMessage ?? data.error ?? 'Failed to start profile completion');
        const assistantMessage = data.message;
        if (!assistantMessage || typeof assistantMessage.content !== 'string') {
          throw new Error('Invalid profile completion response. Please try again.');
        }

        const triggerUserMessage: ProspectMessage = {
          id: `user_trigger_${Date.now()}`,
          role: 'user',
          content: data.triggerMessage ?? '[Profile completion]',
          timestamp: new Date().toISOString(),
          metadata: {
            isSystem: true, // Internal system message, don't display to user
          },
        };

        setState((prev) => ({
          ...prev,
          sessionId: data.sessionId ?? prev.sessionId,
          messages: [...prev.messages, triggerUserMessage, assistantMessage],
          preferences: data.extractedPreferences ? { ...prev.preferences, ...data.extractedPreferences } : prev.preferences,
          isLoading: false,
        }));
      } catch (err: any) {
        logger.error('Trigger profile completion failed', { error: err instanceof Error ? err.message : String(err) });
        profileCompletionProcessed.current = false;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message ?? 'Failed to start profile completion. You can continue the conversation below.',
        }));
      }
    }

    if (isInitialized) handleProfileCompletionMode();
  }, [isInitialized, searchParams]);

  const sendMessage = useCallback(async (message: string) => {
    logger.debug('sendMessage called with', { message: message.substring(0, 100) }, true);
    
    // Extract email from message if user shares it (for session recovery)
    const extractedEmail = sessionService.extractEmailFromMessage(message);
    if (extractedEmail) {
      logger.debug('Extracted email from message', { email: extractedEmail }, true);
      // Update session with email (will be saved via auto-save useEffect)
      setState((prev) => {
        if (prev.sessionId) {
          // Store email in preferences for now (will be saved to session.email via API)
          const updatedPreferences = {
            ...prev.preferences,
            email: extractedEmail,
          } as ProspectPreferences & { email?: string };
          return {
            ...prev,
            preferences: updatedPreferences,
            sessionEmail: extractedEmail,
            hasSessionEmail: true,
          };
        }
        return prev;
      });
    }
    
    // Create user message first
    const userMessage: ProspectMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    logger.debug('Created user message', { role: userMessage.role }, true);

    // Increment user message counter after signup (for fallback strategy)
    // Only count if user is authenticated and in profile completion mode
    let newMessageCount = state.userMessageCountAfterSignup;
    if (state.isAuthenticated && state.consentGrantedForProfileCompletion && !state.hasExistingProfile) {
      newMessageCount = state.userMessageCountAfterSignup + 1;
      setState((prev) => ({
        ...prev,
        userMessageCountAfterSignup: prev.userMessageCountAfterSignup + 1,
      }));
      logger.debug('User message count after signup', { count: newMessageCount }, true);
    }

    // CRITICAL: Get current messages from state directly (not ref) to ensure we have all previous messages
    // The ref might be stale or null, but state is always current
    // Use stateRef as fallback only if state is somehow unavailable
    const currentMessages = state.messages.length > 0 ? state.messages : (stateRef.current?.messages || []);
    const updatedMessages = [...currentMessages, userMessage];
    
    logger.debug('Preparing to send message', {
      stateMessages: state.messages.length,
      refMessages: stateRef.current?.messages?.length || 0,
      currentMessages: currentMessages.length,
      updatedMessages: updatedMessages.length,
      userMessageId: userMessage.id,
    }, true);
    
    // Update state with loading and user message
    setState((prev) => {
      // Use the updatedMessages we built above to ensure consistency
      // Update the ref immediately so it's available for the API call
      const newState = {
        ...prev,
        isLoading: true,
        error: null,
        messages: updatedMessages,
      };
      
      // Update ref synchronously
      stateRef.current = newState;
      
      return newState;
    });

    try {
      // CRITICAL: Use updatedMessages directly instead of reading from ref
      // The ref update above ensures consistency, but using updatedMessages is more reliable
      // since we built it from the current state
      const finalConversationHistory = updatedMessages;
      
      logger.debug('Sending to API - conversation history', {
        totalLength: finalConversationHistory.length,
        userMessages: finalConversationHistory.filter(m => m.role === 'user').length,
        assistantMessages: finalConversationHistory.filter(m => m.role === 'assistant').length,
      }, true);
      
      if (finalConversationHistory.length === 0) {
        logger.error('WARNING: conversationHistory is empty! This should not happen', {});
        // Don't proceed if we have no messages - this indicates a serious state issue
        throw new Error('Cannot send message: conversation history is empty');
      }
      
      // Get other state values from ref (these are less critical and should be stable)
      const currentState = stateRef.current || state;
      
      const response = await fetch('/api/ai/prospect/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentState.sessionId || state.sessionId,
          message,
          conversationHistory: finalConversationHistory, // Use the complete conversation history
          gatheredPreferences: currentState.preferences || state.preferences,
          // Include profile completion context for authenticated users
          profileCompletionMode: currentState.profileCompletionMode ?? state.profileCompletionMode,
          userId: currentState.userId || state.userId,
          userProfile: currentState.userProfile || state.userProfile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.userMessage || 'Failed to send message') as Error & { errorType?: string };
        error.errorType = errorData.errorType;
        throw error;
      }

      const data = await response.json();

      // Check for tool errors in response (especially update_user_profile errors)
      if (data.message?.metadata?.toolCalls) {
        // Tool errors might be in a separate field or we need to check the message content
        // For now, check if the message content indicates a profile update error
        const messageContent = data.message.content || '';
        const hasProfileError = 
          messageContent.includes('failed to create profile') ||
          messageContent.includes('failed to save profile') ||
          messageContent.includes('issue saving your profile') ||
          messageContent.includes('error saving') ||
          messageContent.includes('invalid input syntax');
        
        if (hasProfileError && 
            currentState.isAuthenticated && 
            currentState.consentGrantedForProfileCompletion && 
            !currentState.hasExistingProfile) {
          logger.debug('Auto-triggering fallback due to profile update error in message', {}, true);
          // Small delay to ensure message is displayed first
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('triggerProfileExtractionFallback'));
          }, 1000);
        }
      }

      // Check if profile was successfully created - if so, clear all prospect data
      if (data.profileCreated === true) {
        logger.debug('Profile created successfully! Clearing all prospect data', {}, true);
        
        // Dispatch profileUpdated event to refresh profile state
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profileUpdated', {
            detail: {
              updatedFields: ['roles', 'profile_completion_percentage', 'full_name', 'user_description'],
              timestamp: Date.now()
            }
          }));
        }
        
        // CRITICAL: Collect all leg references from previous messages BEFORE clearing
        // This allows displaying them after the congratulations message
        const allPreviousLegRefs: ProspectLegReference[] = [];
        const seenLegIds = new Set<string>();
        
        // Collect leg references from all messages before the congratulations message
        for (const msg of currentState.messages) {
          if (msg.role === 'assistant' && msg.metadata?.legReferences) {
            for (const legRef of msg.metadata.legReferences) {
              // Deduplicate by leg ID
              if (!seenLegIds.has(legRef.id)) {
                seenLegIds.add(legRef.id);
                allPreviousLegRefs.push(legRef);
              }
            }
          }
        }
        
        logger.debug('Collected leg references before clearing', { count: allPreviousLegRefs.length }, true);
        
        // Clear all prospect data: messages, preferences, viewed legs, session
        // Delete session from database
        if (currentState.sessionId) {
          try {
            await sessionService.deleteSession(currentState.sessionId);
            logger.debug('Deleted session from database', {}, true);
          } catch (error) {
            logger.error('Error deleting session', { error: error instanceof Error ? error.message : String(error) });
          }
        }
        await clearSessionCookie();
        logger.debug('Cleared server session cookie', {}, true);

        // Fetch a new session ID from server
        const newSession = await fetchSessionFromCookie();
        logger.debug('Fetched new session ID', { sessionId: newSession?.sessionId }, true);

        // Clear all prospect state but preserve authentication
        // Only show the congratulations message (no previous chat history)
        // CRITICAL: Clear preferences completely including skills to prevent stale data
        const clearedPreferences: ProspectPreferences = {};
        logger.debug('Cleared preferences (including skills)', { preferences: Object.keys(clearedPreferences || {}) }, true);
        
        // Attach collected leg references to the congratulations message metadata
        const congratulationsMessage = data.message ? {
          ...data.message,
          metadata: {
            ...data.message.metadata,
            legReferences: allPreviousLegRefs.length > 0 ? allPreviousLegRefs : undefined,
          },
        } : null;
        
        // CRITICAL: Update stateRef BEFORE setState to prevent useEffect from saving stale data
        const clearedState: ProspectChatState = {
          sessionId: newSession?.sessionId || null,
          messages: congratulationsMessage ? [congratulationsMessage] : [], // Only the congratulations message with leg refs
          preferences: clearedPreferences, // Completely empty preferences object
          viewedLegs: [], // Clear viewed legs
          isLoading: false,
          error: null,
          profileCompletionMode: false,
          // Preserve authentication state
          isAuthenticated: currentState.isAuthenticated,
          userId: currentState.userId,
          userProfile: currentState.userProfile,
          sessionEmail: currentState.sessionEmail,
          hasSessionEmail: currentState.hasSessionEmail,
          consentGrantedForProfileCompletion: currentState.consentGrantedForProfileCompletion,
          hasExistingProfile: true, // Profile now exists
          userMessageCountAfterSignup: currentState.userMessageCountAfterSignup, // Preserve counter
          onboardingState: 'completed', // Profile creation completed
        };
        
        // Update ref immediately to prevent stale saves
        if (stateRef.current) {
          stateRef.current = { ...clearedState, userMessageCountAfterSignup: stateRef.current.userMessageCountAfterSignup };
        }
        
        setState({ ...clearedState, userMessageCountAfterSignup: stateRef.current?.userMessageCountAfterSignup || 0 });
        setIsReturningUser(false);
        logger.debug('All prospect data cleared, profile creation complete', { legReferences: allPreviousLegRefs.length }, true);
        return;
      }

      // Parse [PROSPECT_NAME: ...] from assistant message to prefill signup form
      // Also check all previous messages to ensure we don't lose a name that was extracted earlier
      const assistantContent = data.message?.content ?? '';
      // Reuse currentState from above (line 567) - get fresh ref state for checking previous messages
      const latestState = stateRef.current!;
      let extractedName: string | undefined;
      
      // First check the latest assistant message for PROSPECT_NAME tag
      logger.debug('Checking for PROSPECT_NAME in assistant content', {}, true);
      const nameMatch = assistantContent.match(PROSPECT_NAME_TAG_REGEX);
      if (nameMatch?.[1]?.trim()) {
        extractedName = nameMatch[1].trim();
        logger.debug('Extracted PROSPECT_NAME from latest assistant message', { name: extractedName }, true);
      } else {
        logger.debug('No PROSPECT_NAME tag found in latest message, checking previous messages', {}, true);
        // If not in latest message, check all previous assistant messages
        for (const msg of latestState.messages) {
          if (msg.role === 'assistant') {
            const prevNameMatch = msg.content.match(PROSPECT_NAME_TAG_REGEX);
            if (prevNameMatch?.[1]?.trim()) {
              extractedName = prevNameMatch[1].trim();
              logger.debug('Found PROSPECT_NAME in previous assistant message', { name: extractedName }, true);
              break;
            }
          }
        }
        
        // Also check user messages for name patterns (fallback if AI didn't tag it)
        // Look for patterns like "Name: ...", "My name is ...", "I'm ...", etc.
        if (!extractedName) {
          logger.debug('Checking user messages for name patterns', {}, true);
          const namePatterns = [
            /(?:^|\s)(?:name|i'm|i am|call me|it's|it is)[\s:]+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+)/i,
            /(?:^|\s)(?:name|i'm|i am|call me|it's|it is)[\s:]+([A-Z][a-zA-Z]+)/i,
          ];
          
          // Check latest user message first, then previous ones
          const userMessages = [...latestState.messages, userMessage].filter(m => m.role === 'user').reverse();
          for (const msg of userMessages) {
            for (const pattern of namePatterns) {
              const match = msg.content.match(pattern);
              if (match?.[1]?.trim() && match[1].trim().length > 2) {
                extractedName = match[1].trim();
                logger.debug('Extracted name from user message pattern', { name: extractedName }, true);
                break;
              }
            }
            if (extractedName) break;
          }
        }
        
        if (!extractedName) {
          logger.debug('No name found in any messages', {}, true);
        }
      }
      
      const preferencesUpdate: Partial<ProspectPreferences> = data.extractedPreferences
        ? { ...data.extractedPreferences }
        : {};
      // Always set fullName if extracted (even if it was from a previous message)
      if (extractedName) {
        preferencesUpdate.fullName = extractedName;
      } else if (latestState.preferences?.fullName) {
        // Preserve existing fullName if no new extraction
        preferencesUpdate.fullName = latestState.preferences.fullName;
      }
      // Strip the tag from the message so the user doesn't see it
      const cleanedContent = extractedName
        ? assistantContent.replace(PROSPECT_NAME_TAG_REGEX, '').replace(/\n{2,}/g, '\n').trim()
        : assistantContent;
      const messageToStore =
        cleanedContent !== assistantContent
          ? { ...data.message, content: cleanedContent }
          : data.message;

      // Use functional update to ensure we have the latest state including the user message
      // Always ensure the user message is present - React may batch updates, so check explicitly
      setState((prev) => {
        // CRITICAL: Start with current messages to preserve all existing messages
        // The user message was already added optimistically, so it should be in prev.messages
        let messagesWithUser = [...prev.messages]; // Create a copy to avoid mutations
        
        // Always ensure the user message is present - add it if missing
        const hasUserMessage = messagesWithUser.some(m => m.id === userMessage.id);
        
        if (!hasUserMessage) {
          logger.warn('User message missing from state, adding it', { messageId: userMessage.id });
          messagesWithUser = [...messagesWithUser, userMessage];
        }
        
        // Check if the assistant message already exists to avoid duplicates
        const assistantMessageExists = messagesWithUser.some(m => m.id === messageToStore.id);
        const finalMessages = assistantMessageExists 
          ? messagesWithUser 
          : [...messagesWithUser, messageToStore];
        
        logger.debug('Final messages array', {
          totalLength: finalMessages.length,
          userMessages: finalMessages.filter(m => m.role === 'user').length,
          assistantMessages: finalMessages.filter(m => m.role === 'assistant').length,
          hasUserMessage: finalMessages.some(m => m.id === userMessage.id),
        }, true);
        
        // Update the ref to keep it in sync
        if (stateRef.current) {
          stateRef.current = {
            ...stateRef.current,
            messages: finalMessages,
          };
        }
        
        const updatedPreferences = Object.keys(preferencesUpdate).length > 0
          ? { ...prev.preferences, ...preferencesUpdate }
          : prev.preferences;
        
        // Log when fullName is set/updated
        if (preferencesUpdate.fullName) {
          logger.debug('Updated preferences with fullName', { fullName: preferencesUpdate.fullName }, true);
          logger.debug('Full preferences object', { keys: Object.keys(updatedPreferences || {}) }, true);
        }
        
        return {
          ...prev,
          sessionId: data.sessionId ?? prev.sessionId,
          messages: finalMessages,
          preferences: updatedPreferences,
          isLoading: false,
        };
      });
    } catch (error: any) {
      logger.error('Prospect chat error', { error: error instanceof Error ? error.message : String(error) });
      const errorMessage = error.message || 'Something went wrong. Please try again.';
      const errorType = (error as any).errorType || 'unknown_error';
      
      // Get current state for fallback check
      const currentStateForError = stateRef.current || state;
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        // Remove the optimistic user message on error
        messages: prev.messages.filter((m) => m.id !== userMessage.id),
      }));

      // Auto-trigger fallback if:
      // 1. User is authenticated and in profile completion mode
      // 2. Error is timeout, network error, or update_user_profile tool error
      const shouldTriggerFallback = 
        currentStateForError.isAuthenticated && 
        currentStateForError.consentGrantedForProfileCompletion && 
        !currentStateForError.hasExistingProfile &&
        (errorType === 'timeout' || 
         errorType === 'network_error' ||
         errorType === 'rate_limit' ||
         errorMessage.toLowerCase().includes('update_user_profile') ||
         errorMessage.toLowerCase().includes('failed to create profile') ||
         errorMessage.toLowerCase().includes('failed to save profile') ||
         errorMessage.toLowerCase().includes('invalid input syntax'));
      
      if (shouldTriggerFallback) {
        logger.debug('Auto-triggering fallback profile extraction due to error', { errorType, errorMessage }, true);
        // Small delay to ensure error message is displayed first
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('triggerProfileExtractionFallback'));
        }, 1500);
      }
    }
  }, []); // Empty dependency array - use refs for state values

  // Save session when state changes
  // Auto-save session to API (debounced)
  useEffect(() => {
    if (!state.sessionId) {
      logger.debug('Skipping save - no sessionId', {}, true);
      return;
    }

    const userMessages = state.messages.filter(m => m.role === 'user');
    const assistantMessages = state.messages.filter(m => m.role === 'assistant');
    logger.debug('Auto-saving session', {
      totalMessages: state.messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      sessionId: state.sessionId,
    }, true);
    
    // CRITICAL: Don't save if we just cleared everything (empty messages and empty preferences)
    // This prevents overwriting the cleared state after profile creation
    if (state.messages.length === 0 && Object.keys(state.preferences).length === 0) {
      logger.debug('Skipping save - state is cleared (likely after profile creation)', {}, true);
      return;
    }
    
    // Debounce saves to avoid too many API calls (max once per 2 seconds)
    const timeoutId = setTimeout(async () => {
      try {
        // CRITICAL: Get fresh sessionId from cookie to ensure it matches
        // The state.sessionId might be stale if cookie was refreshed
        const cookieResponse = await fetch('/api/prospect/session', {
          credentials: 'include',
        });
        
        if (!cookieResponse.ok) {
          logger.warn('Failed to get session ID from cookie, skipping save');
          return;
        }
        
        const cookieData = await cookieResponse.json();
        const currentSessionId = cookieData.sessionId;
        
        if (!currentSessionId) {
          logger.warn('No session ID from cookie, skipping save');
          return;
        }
        
        // Sync state.sessionId if it changed (cookie might have been refreshed)
        if (currentSessionId !== state.sessionId) {
          logger.debug('Session ID changed, updating state', {
            old: state.sessionId,
            new: currentSessionId,
          }, true);
          setState((prev) => ({ ...prev, sessionId: currentSessionId }));
        }
        
        // Ensure session.sessionId matches the cookie sessionId
        const session: ProspectSession = {
          sessionId: currentSessionId, // Use cookie sessionId, not state.sessionId
          createdAt: new Date().toISOString(), // Will be set by server on first save
          lastActiveAt: new Date().toISOString(),
          conversation: state.messages,
          gatheredPreferences: state.preferences,
          viewedLegs: state.viewedLegs,
        };
        
        logger.debug('Saving session', {
          sessionId: currentSessionId,
          messages: session.conversation.length,
          preferenceKeys: Object.keys(session.gatheredPreferences).length,
        }, true);
        
        await sessionService.saveSession(currentSessionId, session);
        logger.debug('Session saved to API', {}, true);
      } catch (error: any) {
        logger.error('Error auto-saving session', { error: error instanceof Error ? error.message : String(error) });
        // Don't throw - auto-save failures shouldn't break the UI
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [state.sessionId, state.messages, state.preferences, state.viewedLegs]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearSession = useCallback(async () => {
    logger.debug('Clearing prospect chat session', {}, true);

    // Clear session from database and server cookie
    const currentSessionId = stateRef.current?.sessionId;
    if (currentSessionId) {
      try {
        await sessionService.deleteSession(currentSessionId);
        logger.debug('Deleted session from database', {}, true);
      } catch (error) {
        logger.error('Error deleting session', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    await clearSessionCookie();
    logger.debug('Cleared server session cookie', {}, true);

    // Fetch a new session ID from server
    const newSession = await fetchSessionFromCookie();
    logger.debug('Fetched new session ID', { sessionId: newSession?.sessionId }, true);

    // Preserve authentication state - don't clear user auth info when clearing chat
    setState((prev) => ({
      sessionId: newSession?.sessionId || null,
      messages: [], // Clear all messages
      preferences: {}, // Clear all preferences (including fullName)
      viewedLegs: [], // Clear viewed legs
      isLoading: false,
      error: null,
      profileCompletionMode: false,
      userMessageCountAfterSignup: prev.userMessageCountAfterSignup, // Preserve counter
      // Preserve authentication state
      isAuthenticated: prev.isAuthenticated,
      userId: prev.userId,
      userProfile: prev.userProfile,
      sessionEmail: null,
      hasSessionEmail: false,
      consentGrantedForProfileCompletion: prev.consentGrantedForProfileCompletion,
      hasExistingProfile: prev.hasExistingProfile,
      onboardingState: 'signup_pending',
    }));
    setIsReturningUser(false);
    logger.debug('Session cleared - chat data removed, auth state preserved', {}, true);
  }, []);

  const updateOnboardingState = useCallback(async (newState: string) => {
    if (!state.sessionId || !state.userId) {
      logger.warn('Cannot update onboarding state: no session or user');
      return;
    }

    try {
      await sessionService.updateOnboardingState(state.sessionId, newState);
      // Update local state
      setState((prev) => ({
        ...prev,
        onboardingState: newState,
      }));
      logger.debug('Updated onboarding state', { newState }, true);
    } catch (error) {
      logger.error('Error updating onboarding state', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [state.sessionId, state.userId]);

  const addViewedLeg = useCallback((legId: string) => {
    setState((prev) => ({
      ...prev,
      viewedLegs: prev.viewedLegs.includes(legId)
        ? prev.viewedLegs
        : [...prev.viewedLegs, legId],
    }));
  }, []);

  // Approve a pending action - execute the held tool call
  const approveAction = useCallback(async (messageId: string, action: PendingAction) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Clear the pending action from the message
    let updatedMessages: ProspectMessage[] = [];
    setState((prev) => {
      updatedMessages = prev.messages.map((m) =>
        m.id === messageId
          ? { ...m, metadata: { ...m.metadata, pendingAction: undefined } }
          : m
      );
      return {
        ...prev,
        messages: updatedMessages,
      };
    });

    try {
      // Use ref to get latest state values to avoid stale closure issues
      const currentState = stateRef.current!;
      const response = await fetch('/api/ai/prospect/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentState.sessionId,
          message: `[User approved: ${action.label || action.toolName}. Execute the action now.]`,
          conversationHistory: updatedMessages,
          gatheredPreferences: currentState.preferences,
          profileCompletionMode: currentState.profileCompletionMode,
          userId: currentState.userId,
          userProfile: currentState.userProfile,
          approvedAction: action,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.userMessage || 'Failed to execute action');
      }

      const data = await response.json();

      setState((prev) => ({
        ...prev,
        sessionId: data.sessionId,
        messages: [...prev.messages, data.message],
        isLoading: false,
        ...(action.toolName === 'update_user_profile' ? { hasExistingProfile: true } : {}),
      }));
    } catch (error: any) {
      logger.error('Approve action error', { error: error instanceof Error ? error.message : String(error) });
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to save profile. Please try again.',
      }));
    }
  }, []); // Empty dependency array - use refs for state values

  // Cancel a pending action
  const cancelAction = useCallback((messageId: string) => {
    // Clear the pending action from the message
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) =>
        m.id === messageId
          ? { ...m, metadata: { ...m.metadata, pendingAction: undefined } }
          : m
      ),
    }));

    // Add a note that the user cancelled
    const cancelMessage: ProspectMessage = {
      id: `system_cancel_${Date.now()}`,
      role: 'assistant',
      content: 'No problem! Let me know if you\'d like to make any changes to the profile data, or we can try again when you\'re ready.',
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, cancelMessage],
    }));
  }, []);

  // Process initial query from URL parameter (from welcome page search)
  useEffect(() => {
    if (!isInitialized || initialQueryProcessed.current || state.isLoading) {
      return;
    }

    // Check for new combo search parameters
    const whereFromParam = searchParams?.get('whereFrom');
    const whereToParam = searchParams?.get('whereTo');
    const availabilityTextParam = searchParams?.get('availabilityText');
    const availabilityStartParam = searchParams?.get('availabilityStart');
    const availabilityEndParam = searchParams?.get('availabilityEnd');
    const profileParam = searchParams?.get('profile');
    const legacyQueryParam = searchParams?.get('q');

    // Process combo search parameters (from crew ComboSearchBox: where/when + profile)
    const hasComboParams = whereFromParam || whereToParam || availabilityTextParam || availabilityStartParam || availabilityEndParam || profileParam;
    if (hasComboParams) {
      initialQueryProcessed.current = true;
      logger.debug('Processing combo search parameters', {}, true);

      const parts: string[] = [];

      if (profileParam) {
        parts.push(`Profile: ${profileParam}`);
      }

      if (whereFromParam) {
        try {
          const location = JSON.parse(whereFromParam);
          parts.push(`Looking to sail from: ${location.name}`);
          if (location.isCruisingRegion && location.bbox) {
            parts.push(`(Cruising Region: ${location.name}, Bounding Box: ${JSON.stringify(location.bbox)})`);
          }
        } catch (e) {
          logger.error('Error parsing whereFrom', { error: e instanceof Error ? e.message : String(e) });
          parts.push(`Looking to sail from: ${whereFromParam}`);
        }
      }

      if (whereToParam) {
        try {
          const location = JSON.parse(whereToParam);
          parts.push(`Looking to sail to: ${location.name}`);
          if (location.isCruisingRegion && location.bbox) {
            parts.push(`(Cruising Region: ${location.name}, Bounding Box: ${JSON.stringify(location.bbox)})`);
          }
        } catch (e) {
          logger.error('Error parsing whereTo', { error: e instanceof Error ? e.message : String(e) });
          parts.push(`Looking to sail to: ${whereToParam}`);
        }
      }

      if (availabilityTextParam || availabilityStartParam || availabilityEndParam) {
        let availText = availabilityTextParam || '';
        if (availabilityStartParam && availabilityEndParam) {
          try {
            const start = new Date(availabilityStartParam);
            const end = new Date(availabilityEndParam);
            const dateStr = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
            availText = availText ? `${availText} (${dateStr})` : dateStr;
          } catch (e) {
            logger.error('Error parsing dates', { error: e instanceof Error ? e.message : String(e) });
          }
        } else if (availabilityStartParam) {
          try {
            const start = new Date(availabilityStartParam);
            availText = availText ? `${availText} (from ${start.toLocaleDateString()})` : `From ${start.toLocaleDateString()}`;
          } catch (e) {
            logger.error('Error parsing availability start date', { error: e instanceof Error ? e.message : String(e) });
          }
        }
        if (availText) {
          parts.push(`Available: ${availText}`);
        }
      }

      const initialMessage = parts.join('\n');
      if (initialMessage) {
        sendMessage(initialMessage);
      }
    } else if (legacyQueryParam && legacyQueryParam.trim()) {
      // Fallback to legacy 'q' parameter
      initialQueryProcessed.current = true;
      logger.debug('Processing legacy initial query', { query: legacyQueryParam.trim() }, true);
      sendMessage(legacyQueryParam.trim());
    }
  }, [isInitialized, searchParams, sendMessage, state.isLoading]);

  const triggerFallbackProfileExtraction = useCallback(() => {
    window.dispatchEvent(new CustomEvent('triggerProfileExtractionFallback'));
  }, []);

  const value: ProspectChatContextType = {
    ...state,
    sendMessage,
    clearError,
    clearSession,
    addViewedLeg,
    approveAction,
    cancelAction,
    isReturningUser,
    triggerFallbackProfileExtraction,
    updateOnboardingState,
  };

  return (
    <ProspectChatContext.Provider value={value}>
      {children}
    </ProspectChatContext.Provider>
  );
}

export function useProspectChat() {
  const context = useContext(ProspectChatContext);
  if (!context) {
    throw new Error('useProspectChat must be used within a ProspectChatProvider');
  }
  return context;
}
