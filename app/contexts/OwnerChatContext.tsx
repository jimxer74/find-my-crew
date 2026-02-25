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
  OwnerMessage,
  OwnerSession,
  OwnerPreferences,
  PendingAction,
  KnownUserProfile,
  OWNER_NAME_TAG_REGEX,
} from '@shared/ai/owner/types';
import { getSupabaseBrowserClient } from '@shared/database/client';
import * as sessionService from '@shared/lib/owner/sessionService';
import { logger } from '@shared/logging';

/**
 * Fetch session ID from server (stored in HttpOnly cookie)
 */
async function fetchSessionFromCookie(): Promise<{ sessionId: string; isNewSession: boolean } | null> {
  try {
    const response = await fetch('/api/owner/session');
    if (!response.ok) return null;
    return response.json();
  } catch (e) {
    logger.error('Failed to fetch session from cookie', { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/**
 * Clear the session cookie on server
 */
async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/owner/session', { method: 'DELETE' });
  } catch (e) {
    logger.error('Failed to clear session cookie', { error: e instanceof Error ? e.message : String(e) });
  }
}

interface OwnerChatState {
  sessionId: string | null;
  messages: OwnerMessage[];
  preferences: OwnerPreferences;
  isLoading: boolean;
  error: string | null;
  profileCompletionMode: boolean;
  onboardingState: string;
  isAuthenticated: boolean;
  userId: string | null;
  userProfile: KnownUserProfile | null;
  /** Email stored in owner_sessions.email for current session */
  sessionEmail: string | null;
  /** True when owner_sessions.email is set for current session */
  hasSessionEmail: boolean;
  /** True if user has a profile */
  hasExistingProfile: boolean;
  /** True if user has at least one boat */
  hasBoat: boolean;
  /** True if user has at least one journey */
  hasJourney: boolean;
  /** Raw skipper/owner profile text from combo search box */
  skipperProfile: string | null;
  /** Raw crew requirements text from combo search box */
  crewRequirements: string | null;
  /** Parsed journey details text from combo search box */
  journeyDetails: string | null;
  /** Imported profile data from URL import feature */
  importedProfile: {
    url: string;
    source: string;
    content: string;
  } | null;
}

interface OwnerChatContextType extends OwnerChatState {
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
  clearSession: () => void;
  approveAction: (messageId: string, action: PendingAction) => Promise<void>;
  cancelAction: (messageId: string) => void;
  updateOnboardingState: (state: string) => Promise<void>;
}

const OwnerChatContext = createContext<OwnerChatContextType | null>(null);

/**
 * Extract known profile data from Supabase auth user metadata.
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

export function OwnerChatProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stateRef = useRef<OwnerChatState | null>(null);
  const initSessionRunRef = useRef(false);
  const profileCompletionProcessed = useRef(false);
  const initialCrewDemandProcessed = useRef(false);
  const cleanedCompletedSessionIdRef = useRef<string | null>(null);

  const [state, setState] = useState<OwnerChatState>({
    sessionId: null,
    messages: [],
    preferences: {},
    isLoading: false,
    error: null,
    profileCompletionMode: false,
    onboardingState: 'signup_pending',
    isAuthenticated: false,
    userId: null,
    userProfile: null,
    sessionEmail: null,
    hasSessionEmail: false,
    hasExistingProfile: false,
    hasBoat: false,
    hasJourney: false,
    skipperProfile: null,
    crewRequirements: null,
    journeyDetails: null,
    importedProfile: null,
  });

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [isInitialized, setIsInitialized] = useState(false);

  // Load session on mount - get session ID from cookie, then load data from API
  useEffect(() => {
    if (initSessionRunRef.current) {
      return;
    }
    initSessionRunRef.current = true;

    async function initSession() {
      try {
        // Check if we're in profile completion mode (post-signup flow)
        const isProfileCompletionMode = searchParams?.get('profile_completion') === 'true';

        // Get session ID from HttpOnly cookie
        const sessionData = await fetchSessionFromCookie();
        if (!sessionData) {
          logger.error('Failed to get session ID from cookie', {});
          setIsInitialized(true);
          return;
        }

        const { sessionId, isNewSession } = sessionData;
        logger.debug('Session ID from cookie', { sessionId: !!sessionId, isNewSession }, true);

        // Load session data from API
        let loadedSession: OwnerSession | null = null;
        if (!isNewSession && sessionId) {
          try {
            loadedSession = await sessionService.loadSession(sessionId);
            if (loadedSession) {
              logger.debug('Loaded session from API', {
                messagesCount: loadedSession.conversation.length,
                preferencesKeys: Object.keys(loadedSession.gatheredPreferences),
              }, true);
            } else {
              logger.debug('No session found in database for session ID', { sessionId: !!sessionId }, true);
            }
          } catch (error) {
            logger.error('Error loading session from API', { error: error instanceof Error ? error.message : String(error) });
          }
        }

        // Restore session data or start fresh
        if (loadedSession) {
          setState((prev) => ({
            ...prev,
            sessionId,
            messages: loadedSession!.conversation,
            preferences: loadedSession!.gatheredPreferences,
            sessionEmail: loadedSession!.sessionEmail ?? null,
            hasSessionEmail: loadedSession!.hasSessionEmail === true,
            onboardingState: loadedSession!.onboardingState || 'signup_pending',
            skipperProfile: loadedSession!.skipperProfile ?? null,
            crewRequirements: loadedSession!.crewRequirements ?? null,
            journeyDetails: loadedSession!.journeyDetails ?? null,
            importedProfile: loadedSession!.importedProfile ?? null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            sessionId,
            messages: [],
            preferences: {},
            sessionEmail: null,
            hasSessionEmail: false,
            onboardingState: 'signup_pending',
            skipperProfile: null,
            crewRequirements: null,
            journeyDetails: null,
            importedProfile: null,
          }));
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
              logger.debug('Fallback: linked owner session to user', { userId: !!user.id }, true);

              // Update onboarding state to consent_pending after signup
              setState((prev) => ({
                ...prev,
                onboardingState: 'consent_pending',
              }));
              logger.debug('Fallback: updated onboarding state to consent_pending', {}, true);
            } catch (err) {
              logger.error('Fallback link failed', { error: err instanceof Error ? err.message : String(err) });
            }
          }
        }

        setIsInitialized(true);
      } catch (error) {
        logger.error('Error initializing session', { error: error instanceof Error ? error.message : String(error) });
        setIsInitialized(true);
      }
    }

    initSession();
  }, [searchParams]);

  // Check authentication and profile status (runs immediately on mount)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function checkAuthAndProfile() {
      logger.debug('Checking auth state on mount', {}, true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        logger.debug('User not authenticated', { hasError: !!authError }, true);
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          userId: null,
          userProfile: null,
          hasExistingProfile: false,
          hasBoat: false,
          hasJourney: false,
        }));
        return;
      }

      const knownProfile = extractKnownProfile(user);

      // ✅ CRITICAL: Set auth state EARLY - don't wait for profile/boats/journeys queries
      // This allows ConsentSetupContext to proceed immediately
      logger.debug('User authenticated, setting auth state early', { userId: user.id }, true);
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        userId: user.id,
        userProfile: knownProfile,
        sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
        hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
      }));

      // ✅ Query profile/boats/journeys with retry logic in background
      const queryDataWithRetry = async (retryCount = 0): Promise<void> => {
        try {
          logger.debug('Querying profile/boats/journeys', { attempt: retryCount + 1 }, true);

          // First verify session is available
          const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !currentSession) {
            if (retryCount < 3) {
              logger.warn('Session not ready yet, retrying in 500ms', {});
              setTimeout(() => queryDataWithRetry(retryCount + 1), 500);
              return;
            }
            logger.warn('Session not ready after retries, using partial data', {});
            return;
          }

          // Query profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (profileError) {
            const errorMsg = profileError.message?.toLowerCase() || '';
            if ((errorMsg.includes('session') || errorMsg.includes('auth') || profileError.code === 'PGRST301') && retryCount < 3) {
              logger.warn('Auth session error on profile query, retrying in 500ms', {});
              setTimeout(() => queryDataWithRetry(retryCount + 1), 500);
              return;
            }
            logger.warn('Profile query failed after retries, continuing with fallback', { error: profileError.message });
            return;
          }

          // Query boats
          const { data: boats, error: boatsError } = await supabase
            .from('boats')
            .select('id')
            .eq('owner_id', user.id)
            .limit(1);

          if (boatsError) {
            logger.warn('Boats query failed, continuing with fallback', { error: boatsError.message });
            // Update state with profile info at least
            setState((prev) => ({
              ...prev,
              hasExistingProfile: !!profile,
              hasBoat: false,
              hasJourney: false,
            }));
            return;
          }

          // Query journeys if boats exist
          let hasJourney = false;
          if (boats?.length) {
            const { data: journeys, error: journeysError } = await supabase
              .from('journeys')
              .select('id')
              .in('boat_id', boats.map((b) => b.id))
              .limit(1);

            if (journeysError) {
              logger.warn('Journeys query failed, continuing with fallback', { error: journeysError.message });
            } else {
              hasJourney = (journeys?.length ?? 0) > 0;
            }
          }

          logger.debug('Profile/boats/journeys queries successful', {
            hasProfile: !!profile,
            hasBoat: (boats?.length ?? 0) > 0,
            hasJourney,
          }, true);

          // Update state with all data
          setState((prev) => ({
            ...prev,
            hasExistingProfile: !!profile,
            hasBoat: (boats?.length ?? 0) > 0,
            hasJourney,
          }));
        } catch (error) {
          logger.error('Error querying profile/boats/journeys', { error: error instanceof Error ? error.message : String(error) });
          // Silently fail - auth state is already set, partial data is OK
        }
      };

      // Start retry attempt in background (don't await)
      queryDataWithRetry();
    }

    // Run immediately on mount
    checkAuthAndProfile();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('Auth state changed', { event, hasUser: !!session?.user?.id }, true);

      if (event === 'SIGNED_IN' && session?.user) {
        const knownProfile = extractKnownProfile(session.user);

        // CRITICAL: Link owner session to authenticated user after signup
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
            logger.debug('Linked owner session to user', { userId: !!session.user.id }, true);

            // Update onboarding state to consent_pending if this is post-signup onboarding
            if (isProfileCompletion) {
              setState((prev) => ({
                ...prev,
                onboardingState: 'consent_pending',
              }));
              logger.debug('Updated onboarding state to consent_pending after signup', {}, true);
            }
          } catch (error) {
            logger.error('Error linking session to user', { error: error instanceof Error ? error.message : String(error) });
          }
        }

        // ✅ Set auth state EARLY for SIGNED_IN event too
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          userId: session.user.id,
          userProfile: knownProfile,
          sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
          hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
        }));
        logger.debug('Auth state set for SIGNED_IN event', { userId: session.user.id }, true);

        // Query boats/journeys in background with retry
        const queryDataWithRetry = async (retryCount = 0): Promise<void> => {
          try {
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !currentSession) {
              if (retryCount < 3) {
                setTimeout(() => queryDataWithRetry(retryCount + 1), 500);
                return;
              }
              return;
            }

            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profileError) {
              const errorMsg = profileError.message?.toLowerCase() || '';
              if ((errorMsg.includes('session') || errorMsg.includes('auth') || profileError.code === 'PGRST301') && retryCount < 3) {
                setTimeout(() => queryDataWithRetry(retryCount + 1), 500);
                return;
              }
              return;
            }

            const { data: boats } = await supabase
              .from('boats')
              .select('id')
              .eq('owner_id', session.user.id)
              .limit(1);

            let hasJourney = false;
            if (boats?.length) {
              const { data: journeys } = await supabase
                .from('journeys')
                .select('id')
                .in('boat_id', boats.map((b) => b.id))
                .limit(1);
              hasJourney = (journeys?.length ?? 0) > 0;
            }

            setState((prev) => ({
              ...prev,
              hasExistingProfile: !!profile,
              hasBoat: (boats?.length ?? 0) > 0,
              hasJourney,
            }));
          } catch (error) {
            logger.error('Error in SIGNED_IN profile query', { error: error instanceof Error ? error.message : String(error) });
          }
        };

        queryDataWithRetry();
      } else if (event === 'SIGNED_OUT') {
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          userId: null,
          userProfile: null,
          hasExistingProfile: false,
          hasBoat: false,
          hasJourney: false,
        }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Detect profile completion mode and trigger system message after signup
  // Runs for: (1) URL has profile_completion=true, or (2) returning user with incomplete profile + linked session
  useEffect(() => {
    async function handleProfileCompletionMode() {
      const isProfileCompletionFromUrl = searchParams?.get('profile_completion') === 'true';

      if (profileCompletionProcessed.current || !isInitialized) {
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return;
      }

      // Load session to check if we should trigger for returning user
      const currentSessionId = stateRef.current?.sessionId;
      let session: OwnerSession | null = null;
      if (currentSessionId) {
        try {
          session = await sessionService.loadSession(currentSessionId);
        } catch (error) {
          logger.error('Error loading session for profile completion', { error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Decide: trigger from URL (post-consent) OR returning user (incomplete profile, session has messages, not yet triggered)
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

      if (!shouldTrigger) {
        return;
      }

      if (profileCompletionProcessed.current) {
        return;
      }
      profileCompletionProcessed.current = true;

      const knownProfile = extractKnownProfile(user);

      logger.debug('Profile completion triggered', {
        fromUrl: isProfileCompletionFromUrl,
        returningUser: isReturningUser,
        hasProfile,
      }, true);

        setState((prev) => ({
          ...prev,
          profileCompletionMode: true,
          isAuthenticated: true,
          userId: user.id,
          userProfile: knownProfile,
          sessionEmail: knownProfile.email?.toLowerCase().trim() || prev.sessionEmail,
          hasSessionEmail: !!(knownProfile.email || prev.sessionEmail),
          hasExistingProfile: hasProfile,
          isLoading: true,
        }));

      // Trigger profile completion via backend API (sends SYSTEM message server-side)
      try {
        logger.debug('Calling /api/ai/owner/trigger-profile-completion', {
          hasSessionId: !!session?.sessionId,
          historyLength: session?.conversation?.length ?? 0,
        }, true);

        const res = await fetch('/api/ai/owner/trigger-profile-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // ensure cookies (session) are sent for auth
          body: JSON.stringify({
            sessionId: session?.sessionId ?? currentSessionId ?? undefined,
            conversationHistory: session?.conversation ?? stateRef.current?.messages ?? [],
            gatheredPreferences: session?.gatheredPreferences ?? stateRef.current?.preferences ?? {},
            userProfile: knownProfile,
            skipperProfile: session?.skipperProfile ?? stateRef.current?.skipperProfile ?? null,
            crewRequirements: session?.crewRequirements ?? stateRef.current?.crewRequirements ?? null,
            journeyDetails: session?.journeyDetails ?? stateRef.current?.journeyDetails ?? null,
            importedProfile: session?.importedProfile ?? stateRef.current?.importedProfile ?? null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.userMessage ?? data.error ?? 'Failed to start profile completion');
        }

        const assistantMessage = data.message;
        if (!assistantMessage || typeof assistantMessage.content !== 'string') {
          throw new Error('Invalid profile completion response. Please try again.');
        }

        logger.debug('Profile completion trigger successful', {
          hasMessageId: !!assistantMessage.id,
          contentLength: assistantMessage.content.length,
        }, true);

        const triggerUserMessage: OwnerMessage = {
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
          preferences: data.extractedPreferences
            ? { ...prev.preferences, ...data.extractedPreferences }
            : prev.preferences,
          isLoading: false,
          // If profile was created during trigger, advance onboarding state
          ...(data.profileCreated ? { onboardingState: 'boat_pending', hasExistingProfile: true } : {}),
        }));
      } catch (error: any) {
        logger.error('Error triggering profile completion', { error: error instanceof Error ? error.message : String(error) });
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message || 'Failed to start profile completion. Please refresh and try again.',
        }));
        profileCompletionProcessed.current = false; // Allow retry on error
      }
    }

    if (isInitialized) {
      handleProfileCompletionMode();
    }
  }, [isInitialized, searchParams]);

  // Auto-save session when messages or preferences change
  useEffect(() => {
    const sessionId = state.sessionId;
    if (!sessionId || !isInitialized) return;

    const saveTimeout = setTimeout(async () => {
      try {
        const session: OwnerSession = {
          sessionId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          conversation: state.messages,
          gatheredPreferences: state.preferences,
          skipperProfile: state.skipperProfile ?? null,
          crewRequirements: state.crewRequirements ?? null,
          journeyDetails: state.journeyDetails ?? null,
          importedProfile: state.importedProfile ?? null,
        };
        await sessionService.saveSession(sessionId, session);
      } catch (error: any) {
        // Enhanced error logging to capture all details
        logger.error('Error auto-saving session', {
          message: error?.message || 'Unknown error',
          messagesCount: state.messages.length,
          errorString: error?.toString(),
        });
        // Don't throw - auto-save failures shouldn't break the UI
      }
    }, 1000); // Debounce: save 1 second after last change

    return () => clearTimeout(saveTimeout);
  }, [state.sessionId, state.messages, state.preferences, state.skipperProfile, state.crewRequirements, state.journeyDetails, state.importedProfile, isInitialized]);

  // Cleanup owner onboarding session once onboarding is fully completed.
  // This runs when the same completion state used by the welcome card is reached.
  useEffect(() => {
    const shouldCleanup =
      !!state.sessionId &&
      state.isAuthenticated &&
      state.hasExistingProfile &&
      state.hasBoat &&
      state.hasJourney;

    if (!shouldCleanup) {
      return;
    }

    const currentSessionId = state.sessionId;
    if (cleanedCompletedSessionIdRef.current === currentSessionId) {
      return;
    }
    cleanedCompletedSessionIdRef.current = currentSessionId;

    async function cleanupCompletedOnboardingSession() {
      try {
        await sessionService.deleteSession(currentSessionId!);
        await clearSessionCookie();
        setState((prev) => ({
          ...prev,
          sessionId: null,
        }));
        logger.debug('Deleted completed owner onboarding session', {}, true);
      } catch (error) {
        logger.error('Error deleting completed onboarding session', { error: error instanceof Error ? error.message : String(error) });
        cleanedCompletedSessionIdRef.current = null;
      }
    }

    cleanupCompletedOnboardingSession();
  }, [
    state.sessionId,
    state.isAuthenticated,
    state.hasExistingProfile,
    state.hasBoat,
    state.hasJourney,
  ]);

  const sendMessage = useCallback(async (message: string) => {
    // Extract email from message if user shares it (for session recovery)
    const extractedEmail = sessionService.extractEmailFromMessage(message);
    if (extractedEmail) {
      logger.debug('Extracted email from message', { hasEmail: !!extractedEmail }, true);
      // Update session with email (will be saved via auto-save useEffect)
      setState((prev) => {
        if (prev.sessionId) {
          const updatedPreferences = {
            ...prev.preferences,
            email: extractedEmail,
          } as OwnerPreferences & { email?: string };
          return {
            ...prev,
            preferences: updatedPreferences,
            sessionEmail: extractedEmail,
            // Keep UI action buttons in sync with persisted session intent
            hasSessionEmail: true,
          };
        }
        return prev;
      });
    }

    const userMessage: OwnerMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    const currentMessages = state.messages.length > 0 ? state.messages : (stateRef.current?.messages || []);
    const updatedMessages = [...currentMessages, userMessage];

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      messages: updatedMessages,
    }));

    try {
      const response = await fetch('/api/ai/owner/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: state.sessionId,
          message,
          conversationHistory: currentMessages,
          gatheredPreferences: state.preferences,
          profileCompletionMode: state.profileCompletionMode,
          userId: state.userId,
          userProfile: state.userProfile,
          skipperProfile: state.skipperProfile ?? null,
          crewRequirements: state.crewRequirements ?? null,
          journeyDetails: state.journeyDetails ?? null,
          importedProfile: state.importedProfile ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.userMessage || data.error || 'Failed to send message');
      }

      const assistantMessage = data.message;
      if (!assistantMessage || typeof assistantMessage.content !== 'string') {
        throw new Error('Invalid response from server');
      }

      // Extract owner name if present
      const nameMatch = assistantMessage.content.match(OWNER_NAME_TAG_REGEX);
      if (nameMatch && nameMatch[1]) {
        setState((prev) => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            fullName: nameMatch[1].trim(),
          },
        }));
      }

      // Collect all messages: intermediate messages (if any) + final message
      const allMessages = [
        ...(data.intermediateMessages || []),
        assistantMessage,
      ];

      if (data.intermediateMessages?.length) {
        logger.debug('Received intermediate messages', {
          intermediateCount: data.intermediateMessages.length,
          totalMessages: allMessages.length,
        }, true);
      }

      setState((prev) => ({
        ...prev,
        sessionId: data.sessionId || prev.sessionId,
        messages: [...prev.messages, ...allMessages],
        preferences: data.extractedPreferences
          ? { ...prev.preferences, ...data.extractedPreferences }
          : prev.preferences,
        hasExistingProfile: data.profileCreated === true ? true : prev.hasExistingProfile,
        hasBoat: data.boatCreated === true ? true : prev.hasBoat,
        hasJourney: data.journeyCreated === true ? true : prev.hasJourney,
        isLoading: false,
      }));

      // Trigger onboarding state transitions
      // Only update state if profile was actually created (verify it exists in DB)
      if (data.profileCreated === true && state.userId) {
        const supabase = getSupabaseBrowserClient();
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', state.userId)
          .single();
        
        if (profileData) {
          await updateOnboardingState('boat_pending');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('profileUpdated', {
              detail: {
                updatedFields: ['roles', 'profile_completion_percentage'],
                timestamp: Date.now(),
                immediate: true,
              }
            }));
          }
        } else {
          logger.warn('Profile creation reported but profile not found in database', {});
        }
      } else if (data.boatCreated === true) {
        await updateOnboardingState('journey_pending');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profileUpdated', {
            detail: { updatedFields: [], timestamp: Date.now(), immediate: true }
          }));
        }
      } else if (data.journeyCreated === true) {
        await updateOnboardingState('completed');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profileUpdated', {
            detail: { updatedFields: [], timestamp: Date.now(), immediate: true }
          }));
        }
      }
    } catch (err: any) {
      logger.error('Error sending message', { error: err instanceof Error ? err.message : String(err) });
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to send message. Please try again.',
      }));
    }
  }, [state.sessionId, state.messages, state.preferences, state.profileCompletionMode, state.userId, state.userProfile]);

  const approveAction = useCallback(async (messageId: string, action: PendingAction) => {
    if (!state.userId) {
      setState((prev) => ({
        ...prev,
        error: 'You must be logged in to approve actions. Please sign up first.',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch('/api/ai/owner/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: state.sessionId,
          message: '', // Empty message for approved action
          conversationHistory: state.messages,
          gatheredPreferences: state.preferences,
          profileCompletionMode: state.profileCompletionMode,
          userId: state.userId,
          userProfile: state.userProfile,
          approvedAction: action,
          skipperProfile: state.skipperProfile ?? null,
          crewRequirements: state.crewRequirements ?? null,
          journeyDetails: state.journeyDetails ?? null,
          importedProfile: state.importedProfile ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.userMessage || data.error || 'Failed to approve action');
      }

      const assistantMessage = data.message;

      // Update the message to remove pending action and completion flags from API
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === messageId
            ? { ...msg, metadata: { ...msg.metadata, pendingAction: undefined } }
            : msg
        ).concat(assistantMessage),
        hasExistingProfile: data.profileCreated === true ? true : prev.hasExistingProfile,
        hasBoat: data.boatCreated === true ? true : prev.hasBoat,
        hasJourney: data.journeyCreated === true ? true : prev.hasJourney,
        isLoading: false,
      }));

      // Trigger onboarding state transitions
      // Only update state if profile was actually created (verify it exists in DB)
      if (data.profileCreated === true && state.userId) {
        const supabase = getSupabaseBrowserClient();
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', state.userId)
          .single();
        
        if (profileData) {
          await updateOnboardingState('boat_pending');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('profileUpdated', {
              detail: {
                updatedFields: ['roles', 'profile_completion_percentage'],
                timestamp: Date.now(),
                immediate: true,
              }
            }));
          }
        } else {
          logger.warn('Profile creation reported but profile not found in database', {});
        }
      } else if (data.boatCreated === true) {
        await updateOnboardingState('journey_pending');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profileUpdated', {
            detail: { updatedFields: [], timestamp: Date.now(), immediate: true }
          }));
        }
      } else if (data.journeyCreated === true) {
        await updateOnboardingState('completed');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profileUpdated', {
            detail: { updatedFields: [], timestamp: Date.now(), immediate: true }
          }));
        }
      }
    } catch (err: any) {
      logger.error('Error approving action', { error: err instanceof Error ? err.message : String(err) });
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to approve action. Please try again.',
      }));
    }
  }, [state.sessionId, state.messages, state.preferences, state.profileCompletionMode, state.userId, state.userProfile]);

  const cancelAction = useCallback((messageId: string) => {
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, metadata: { ...msg.metadata, pendingAction: undefined } }
          : msg
      ),
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearSession = useCallback(async () => {
    if (state.sessionId) {
      try {
        await sessionService.deleteSession(state.sessionId);
        await clearSessionCookie();
      } catch (error) {
        logger.error('Error clearing session', { error: error instanceof Error ? error.message : String(error) });
      }
    }
      setState({
      sessionId: null,
      messages: [],
      preferences: {},
      isLoading: false,
      error: null,
      profileCompletionMode: false,
      onboardingState: 'signup_pending',
      isAuthenticated: false,
      userId: null,
      userProfile: null,
      sessionEmail: null,
      hasSessionEmail: false,
      hasExistingProfile: false,
      hasBoat: false,
      hasJourney: false,
      skipperProfile: null,
      crewRequirements: null,
      journeyDetails: null,
      importedProfile: null,
    });
    // Reinitialize session
    initSessionRunRef.current = false;
    setIsInitialized(false);
  }, [state.sessionId]);

  const updateOnboardingState = useCallback(async (newState: string) => {
    if (!state.sessionId || !state.userId) {
      logger.warn('Cannot update onboarding state: no session or user', {});
      return;
    }

    try {
      await sessionService.updateOnboardingState(state.sessionId, newState);
      logger.debug('Updated onboarding state', { newState }, true);
    } catch (error) {
      logger.error('Error updating onboarding state', { error: error instanceof Error ? error.message : String(error) });
    }
  }, [state.sessionId, state.userId]);

  // Process initial crew demand and/or journey details from URL (from front page owner ComboSearchBox)
  useEffect(() => {
    if (!isInitialized || initialCrewDemandProcessed.current || state.isLoading) {
      return;
    }
    const skipperProfileParam = searchParams?.get('skipperProfile');
    const crewRequirementsParam = searchParams?.get('crewRequirements');
    const importedProfileParam = searchParams?.get('importedProfile');
    const isProfileCompletion = searchParams?.get('profile_completion') === 'true';
    const startLocationParam = searchParams?.get('startLocation');
    const endLocationParam = searchParams?.get('endLocation');
    const waypointsParam = searchParams?.get('waypoints');
    const startDateParam = searchParams?.get('startDate');
    const endDateParam = searchParams?.get('endDate');
    const waypointDensityParam = searchParams?.get('waypointDensity');

    const hasJourneyParams = !!(startLocationParam || endLocationParam || startDateParam || endDateParam || waypointsParam || waypointDensityParam);
    const hasProfileData = !!(skipperProfileParam?.trim() || crewRequirementsParam?.trim() || importedProfileParam?.trim());
    if (isProfileCompletion || (!hasProfileData && !hasJourneyParams)) {
      return;
    }
    
    // Parse journey details from URL params
    let journeyDetailsText = '';
    if (hasJourneyParams) {
      const journeyParts: string[] = [];
      
      try {
        const formatLocationWithCoords = (loc: { name?: string; lat?: number; lng?: number }) => {
          const name = loc?.name || '';
          const lat = typeof loc?.lat === 'number' && !Number.isNaN(loc.lat) ? loc.lat : null;
          const lng = typeof loc?.lng === 'number' && !Number.isNaN(loc.lng) ? loc.lng : null;
          if (lat != null && lng != null && (lat !== 0 || lng !== 0)) {
            return `${name} (lat ${lat}, lng ${lng})`;
          }
          return name;
        };

        if (startLocationParam) {
          const startLoc = JSON.parse(startLocationParam);
          journeyParts.push(`Start location: ${formatLocationWithCoords(startLoc)}`);
        }
        if (endLocationParam) {
          const endLoc = JSON.parse(endLocationParam);
          journeyParts.push(`End location: ${formatLocationWithCoords(endLoc)}`);
        }
        if (startDateParam) {
          journeyParts.push(`Start date: ${startDateParam}`);
        }
        if (endDateParam) {
          journeyParts.push(`End date: ${endDateParam}`);
        }
        if (waypointsParam) {
          const waypoints = JSON.parse(waypointsParam);
          if (Array.isArray(waypoints) && waypoints.length > 0) {
            const waypointStrings = waypoints
              .filter((wp: any) => wp?.name)
              .map((wp: any) => formatLocationWithCoords(wp));
            if (waypointStrings.length > 0) {
              journeyParts.push(`Waypoints: ${waypointStrings.join(', ')}`);
            }
          }
        }
        if (waypointDensityParam && ['minimal', 'moderate', 'detailed'].includes(waypointDensityParam)) {
          const densityLabels = {
            minimal: 'Minimal (high-level planning, crew exchange points only)',
            moderate: 'Moderate (balanced planning, recommended)',
            detailed: 'Detailed (comprehensive routing, full navigation planning)'
          };
          journeyParts.push(`Waypoint density preference: ${densityLabels[waypointDensityParam as keyof typeof densityLabels]}`);
        }
        
        if (journeyParts.length > 0) {
          journeyDetailsText = `\n\nJourney details:\n${journeyParts.join('\n')}`;
        }
      } catch (error) {
        logger.error('Error parsing journey details from URL', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    initialCrewDemandProcessed.current = true;

    // Parse imported profile if present
    let parsedImportedProfile: { url: string; source: string; content: string } | null = null;
    if (importedProfileParam?.trim()) {
      try {
        parsedImportedProfile = JSON.parse(importedProfileParam);
      } catch (error) {
        logger.error('Error parsing imported profile from URL', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Store all sections in state so they are persisted to DB via auto-save
    const storedJourneyDetails = journeyDetailsText.trim() || null;
    setState((prev) => ({
      ...prev,
      skipperProfile: skipperProfileParam?.trim() || null,
      crewRequirements: crewRequirementsParam?.trim() || null,
      journeyDetails: storedJourneyDetails,
      importedProfile: parsedImportedProfile,
    }));

    const parts: string[] = [];
    if (parsedImportedProfile) {
      const importedContent = `Source: ${parsedImportedProfile.source}\nURL: ${parsedImportedProfile.url}\n\n${parsedImportedProfile.content}`;
      parts.push(`[IMPORTED_PROFILE]:\n${importedContent}`);
    }
    if (skipperProfileParam?.trim()) {
      parts.push(`[SKIPPER PROFILE]:\n${skipperProfileParam.trim()}`);
    }
    if (crewRequirementsParam?.trim()) {
      parts.push(`[CREW REQUIREMENTS]:\n${crewRequirementsParam.trim()}`);
    }
    if (storedJourneyDetails) {
      parts.push(`[JOURNEY DETAILS]:\n${storedJourneyDetails}`);
    }
    const message = parts.join('\n\n');
    if (message) {
      logger.debug('Processing initial owner combo data from URL', {
        hasImportedProfile: !!parsedImportedProfile,
        hasSkipperProfile: !!skipperProfileParam?.trim(),
        hasCrewRequirements: !!crewRequirementsParam?.trim(),
        hasJourneyDetails: !!storedJourneyDetails,
      }, true);
      sendMessage(message);
    }
  }, [isInitialized, searchParams, sendMessage, state.isLoading]);

  return (
    <OwnerChatContext.Provider
      value={{
        ...state,
        sendMessage,
        clearError,
        clearSession,
        approveAction,
        cancelAction,
        updateOnboardingState,
      }}
    >
      {children}
    </OwnerChatContext.Provider>
  );
}

export function useOwnerChat() {
  const context = useContext(OwnerChatContext);
  if (!context) {
    throw new Error('useOwnerChat must be used within OwnerChatProvider');
  }
  return context;
}
