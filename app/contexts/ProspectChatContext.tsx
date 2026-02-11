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

const SESSION_EXPIRY_DAYS = 7; // Keep for reference, expiry handled server-side

/**
 * Fetch session ID from server (stored in HttpOnly cookie)
 */
async function fetchSessionFromCookie(): Promise<{ sessionId: string; isNewSession: boolean } | null> {
  try {
    const response = await fetch('/api/prospect/session');
    if (!response.ok) return null;
    return response.json();
  } catch (e) {
    console.error('Failed to fetch session from cookie:', e);
    return null;
  }
}

/**
 * Clear the session cookie on server
 */
async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/prospect/session', { method: 'DELETE' });
  } catch (e) {
    console.error('Failed to clear session cookie:', e);
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
  /** True only after user has completed signup AND granted AI consent (consentSetupCompleted with aiProcessingConsent) */
  consentGrantedForProfileCompletion: boolean;
  /** True if user has a profile (regardless of completion status) */
  hasExistingProfile: boolean;
  /** Count of user messages sent after signup (for fallback strategy) */
  userMessageCountAfterSignup: number;
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
    consentGrantedForProfileCompletion: false,
    hasExistingProfile: false,
    userMessageCountAfterSignup: 0,
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
          console.log('[ProspectChatContext] No session cookie found - starting fresh');
          setIsInitialized(true);
          return;
        }

        const sessionId = cookieSession.sessionId;
        console.log('[ProspectChatContext] Session ID from cookie:', sessionId, 'isNewSession:', cookieSession.isNewSession);

        // Load session data from API
        let loadedSession: ProspectSession | null = null;
        if (!cookieSession.isNewSession) {
          // Existing session - try to load from database
          try {
            loadedSession = await sessionService.loadSession(sessionId);
            if (loadedSession) {
              const userMessages = loadedSession.conversation.filter(m => m.role === 'user');
              const assistantMessages = loadedSession.conversation.filter(m => m.role === 'assistant');
              console.log('[ProspectChatContext] Loaded session from API - total messages:', loadedSession.conversation.length,
                'user messages:', userMessages.length,
                'assistant messages:', assistantMessages.length);
              
              // CRITICAL: Clear skills from preferences if they exist - skills should ONLY come from conversation, not stored preferences
              // This prevents stale skills from previous sessions being reused
              if (loadedSession.gatheredPreferences?.skills) {
                console.log('[ProspectChatContext] 🧹 Removing stale skills from loaded preferences:', loadedSession.gatheredPreferences.skills);
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
                    console.log('[ProspectChatContext] Found PROSPECT_NAME in stored message:', extractedName);
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
              console.log('[ProspectChatContext] No session found in database for session ID:', sessionId);
            }
          } catch (error) {
            console.error('[ProspectChatContext] Error loading session from API:', error);
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
              console.log('[ProspectChatContext] ⚠️ Skipping message overwrite - messages already exist in state:', prev.messages.length);
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
              console.log('[ProspectChatContext] 📊 Recalculated user message count from session:', loadedMessageCount);
            }
            
            return {
              ...prev,
              sessionId,
              messages: shouldSetMessages ? sessionToUse.conversation : prev.messages,
              preferences: preferencesToUse,
              viewedLegs: sessionToUse.viewedLegs,
              userMessageCountAfterSignup: loadedMessageCount,
            };
          });
          setIsReturningUser(sessionToUse.conversation.length > 0);
        } else {
          // No session found - start fresh
          console.log('[ProspectChatContext] Starting fresh session');
          setState((prev) => ({
            ...prev,
            sessionId,
            messages: [],
            preferences: {},
            viewedLegs: [],
          }));
          setIsReturningUser(false);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('[ProspectChatContext] Error initializing session:', error);
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
          }));
          console.log('Profile completion mode activated for user:', user.id, 'known profile:', knownProfile);
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
      console.log('[ProspectChatContext] 🔍 Checking auth state on mount...');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        // AuthSessionMissingError is expected for unauthenticated users (prospect flow)
        // Don't log it as an error - it's a normal state
        const isSessionMissingError = authError.message?.includes('Auth session missing') || 
                                      authError.name === 'AuthSessionMissingError';
        
        if (isSessionMissingError) {
          console.log('[ProspectChatContext] ℹ️ User is not authenticated (expected for prospect flow)');
        } else {
          console.error('[ProspectChatContext] ❌ Auth check error:', authError);
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
        console.log('[ProspectChatContext] 🔍 User found, checking profile...', { userId: user.id });
        
        // Use retry mechanism to wait for session to be fully established
        const queryProfileWithRetry = async (retryCount = 0): Promise<void> => {
          try {
            console.log('[ProspectChatContext] 🔍 Initial check - Querying profiles table for user:', user.id, '(attempt', retryCount + 1, ')');
            console.log('[ProspectChatContext] 🔍 Initial check - Supabase client exists:', !!supabase);
            
            // First verify session is available
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !currentSession) {
              if (retryCount < 3) {
                console.warn('[ProspectChatContext] ⚠️ Initial check - Session not ready yet, retrying in 500ms...');
                setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
                // Set auth state but don't query profile yet
                setState((prev) => ({
                  ...prev,
                  isAuthenticated: true,
                  userId: user.id,
                  userProfile: knownProfile,
                  hasExistingProfile: false,
                }));
                return;
              }
              console.warn('[ProspectChatContext] ⚠️ Initial check - Session not ready after retries, setting auth state only');
              setState((prev) => ({
                ...prev,
                isAuthenticated: true,
                userId: user.id,
                userProfile: knownProfile,
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
            
            console.log('[ProspectChatContext] 🔍 Initial check - Query promise created, awaiting...');
            
            const { data: profile, error: profileError } = await profileQuery;
            
            const queryDuration = Date.now() - queryStart;
            console.log('[ProspectChatContext] 🔍 Initial check - Profile query completed in', queryDuration, 'ms');
            console.log('[ProspectChatContext] 🔍 Initial check - Profile query result:', {
              hasProfile: !!profile,
              profile,
              error: profileError,
              queryDuration,
            });

            if (profileError) {
              // Check if it's a session/auth error
              const errorMsg = profileError.message?.toLowerCase() || '';
              if ((errorMsg.includes('session') || errorMsg.includes('auth') || profileError.code === 'PGRST301') && retryCount < 3) {
                console.warn('[ProspectChatContext] ⚠️ Initial check - Auth session error, retrying in 500ms...');
                setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
                return;
              }
              
              console.error('[ProspectChatContext] ❌ Initial auth check - Profile query error:', {
                userId: user.id,
                error: profileError,
                errorCode: profileError.code,
                errorMessage: profileError.message,
                errorDetails: profileError,
              });
            }

            const hasProfile = !!profile;
            console.log('[ProspectChatContext] 🔍 Initial check - Setting hasExistingProfile to:', hasProfile);

            setState((prev) => ({
              ...prev,
              isAuthenticated: true, // User exists = authenticated
              userId: user.id,
              userProfile: knownProfile,
              hasExistingProfile: hasProfile, // Simple check: profile exists or not
            }));
            console.log('[ProspectChatContext] ✅ Initial auth check - User authenticated:', {
              userId: user.id,
              profileExists: hasProfile,
              profileData: profile,
              profileError: profileError ? { code: profileError.code, message: profileError.message } : null,
              hasExistingProfile: hasProfile,
              isAuthenticated: true,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isSessionError = errorMessage.toLowerCase().includes('session') || errorMessage.toLowerCase().includes('auth');
            
            if (isSessionError && retryCount < 3) {
              console.warn('[ProspectChatContext] ⚠️ Initial check - Session error caught, retrying in 500ms...');
              setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
              // Set auth state but don't set profile - will retry
              setState((prev) => ({
                ...prev,
                isAuthenticated: true,
                userId: user.id,
                userProfile: knownProfile,
                hasExistingProfile: false,
              }));
            } else {
              console.error('[ProspectChatContext] ❌ Initial auth check - Exception during profile check:', error);
              console.error('[ProspectChatContext] ❌ Initial auth check - Exception details:', {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                error,
              });
              setState((prev) => ({
                ...prev,
                isAuthenticated: true,
                userId: user.id,
                userProfile: knownProfile,
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
        console.log('[ProspectChatContext] Initial auth check - no user');
      }
    }

    // Run immediately on mount
    checkAuthAndProfile();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[ProspectChatContext] Auth state changed:', event, 'user:', session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[ProspectChatContext] 🔍 SIGNED_IN - Checking profile for user:', session.user.id);
        // User just signed in - set authenticated, then check profile
        const knownProfile = extractKnownProfile(session.user);
        
        // CRITICAL: Link prospect session to authenticated user after signup
        const currentSessionId = stateRef.current?.sessionId;
        if (currentSessionId) {
          try {
            await sessionService.linkSessionToUser(
              currentSessionId,
              session.user.id,
              session.user.email || undefined
            );
            console.log('[ProspectChatContext] ✅ Linked prospect session to user:', session.user.id);
          } catch (error) {
            console.error('[ProspectChatContext] Error linking session to user:', error);
            // Don't fail signup if linking fails - non-critical
          }
        }
        
        // First set authentication state
        setState((prev) => ({
          ...prev,
          isAuthenticated: true, // User exists = authenticated
          userId: session.user.id,
          userProfile: knownProfile,
        }));
        
        // Check if they have a profile (simple check - just existence)
        // Use a retry mechanism to wait for session to be fully established
        const queryProfileWithRetry = async (retryCount = 0): Promise<void> => {
          try {
            console.log('[ProspectChatContext] 🔍 SIGNED_IN - Verifying session before querying profile (attempt', retryCount + 1, ')...');
            
            // Verify session first
            const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !currentSession) {
              if (retryCount < 3) {
                console.warn('[ProspectChatContext] ⚠️ SIGNED_IN - Session not ready, retrying in 500ms...');
                setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
                return;
              }
              console.error('[ProspectChatContext] ❌ SIGNED_IN - Session not available after retries:', sessionError);
              return;
            }
            
            console.log('[ProspectChatContext] 🔍 SIGNED_IN - Session verified, querying profiles table for user:', session.user.id);
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();
            
            console.log('[ProspectChatContext] ✅ SIGNED_IN - Profile query COMPLETED!');
            console.log('[ProspectChatContext] 🔍 SIGNED_IN - Profile query result:', {
              hasProfile: !!profile,
              profile,
              error: profileError,
              errorCode: profileError?.code,
              errorMessage: profileError?.message,
            });
            
            if (profileError) {
              // Check if it's a session/auth error
              const errorMsg = profileError.message?.toLowerCase() || '';
              if ((errorMsg.includes('session') || errorMsg.includes('auth') || profileError.code === 'PGRST301') && retryCount < 3) {
                console.warn('[ProspectChatContext] ⚠️ SIGNED_IN - Auth session error, retrying in 500ms...');
                setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
                return;
              }
              
              console.error('[ProspectChatContext] ❌ SIGNED_IN - Profile query error:', {
                userId: session.user.id,
                error: profileError,
                errorCode: profileError.code,
                errorMessage: profileError.message,
              });
            }
            
            const hasProfile = !!profile;
            console.log('[ProspectChatContext] 🔍 SIGNED_IN - Setting hasExistingProfile to:', hasProfile);
            
            setState((prev) => {
              console.log('[ProspectChatContext] 🔍 SIGNED_IN - setState callback, prev.hasExistingProfile:', prev.hasExistingProfile);
              return {
                ...prev,
                hasExistingProfile: hasProfile,
              };
            });
            
            console.log('[ProspectChatContext] ✅ SIGNED_IN - State updated, hasExistingProfile:', hasProfile);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isSessionError = errorMessage.toLowerCase().includes('session') || errorMessage.toLowerCase().includes('auth');
            
            if (isSessionError && retryCount < 3) {
              console.warn('[ProspectChatContext] ⚠️ SIGNED_IN - Session error caught, retrying in 500ms...');
              setTimeout(() => queryProfileWithRetry(retryCount + 1), 500);
            } else {
              console.error('[ProspectChatContext] ❌ SIGNED_IN - Exception during profile check:', error);
              console.error('[ProspectChatContext] ❌ SIGNED_IN - Error details:', {
                message: errorMessage,
                error,
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
        console.log('[ProspectChatContext] User signed out');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check on mount if consent was just completed (handles case where event fired before component mounted)
  // This is a fallback for race conditions where consent completes before ProspectChatContext mounts
  useEffect(() => {
    async function checkPendingConsentCompletion() {
      const signupPending = typeof window !== 'undefined'
        ? localStorage.getItem('ai_assistant_signup_pending')
        : null;

      if (!signupPending) return;

      // Check if consent was recently completed (within last 5 seconds) by checking user_consents
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: consentData } = await supabase
        .from('user_consents')
        .select('consent_setup_completed_at, ai_processing_consent')
        .eq('user_id', user.id)
        .maybeSingle();

      if (consentData?.consent_setup_completed_at) {
        const completedAt = new Date(consentData.consent_setup_completed_at);
        const now = new Date();
        const secondsSinceCompletion = (now.getTime() - completedAt.getTime()) / 1000;

        // If consent was completed within last 10 seconds, trigger profile completion
        if (secondsSinceCompletion < 10) {
          console.log('[ProspectChat] Detected recent consent completion on mount - triggering profile completion');
          // Manually trigger the handler logic
          const event = new CustomEvent('consentSetupCompleted', {
            detail: { aiProcessingConsent: consentData.ai_processing_consent ?? false },
          });
          window.dispatchEvent(event);
        }
      }
    }

    if (isInitialized) {
      checkPendingConsentCompletion();
    }
  }, [isInitialized]);

  // Listen for consent completion event (OAuth flow: user is already on /welcome/chat)
  // When consent modal closes, check if AI consent was granted.
  // If yes → activate profile completion mode. If no → redirect to manual profile setup.
  // IMPORTANT: Always register the listener (not conditional) to avoid race conditions.
  // Check the flag INSIDE the handler to catch events that fire before/after mount.
  useEffect(() => {
    const handleConsentCompleted = async (event: Event) => {
      // Check if this is a signup from prospect chat flow (check INSIDE handler to avoid race conditions)
      const signupPending = typeof window !== 'undefined'
        ? localStorage.getItem('ai_assistant_signup_pending')
        : null;

      // Only process if there's a pending signup from the prospect chat flow
      if (!signupPending) {
        console.log('[ProspectChat] Consent completed event received but no ai_assistant_signup_pending flag - ignoring');
        return;
      }

      console.log('[ProspectChat] Consent completed event received - processing profile completion trigger');

      const customEvent = event as CustomEvent<{ aiProcessingConsent: boolean }>;
      const aiConsent = customEvent.detail?.aiProcessingConsent ?? false;

      // Clear the signup flag immediately to prevent duplicate processing
      localStorage.removeItem('ai_assistant_signup_pending');

      if (!aiConsent) {
        // AI consent NOT granted → redirect to manual profile setup
        console.log('[ProspectChat] Consent completed without AI consent → redirecting to profile setup');
        router.push('/profile-setup');
        return;
      }

      // AI consent granted → activate profile completion mode and mark consent as given
      // (trigger message will only fire when this flag is true)
      console.log('[ProspectChat] Consent completed with AI consent → entering profile completion mode');

      // Prevent duplicate processing
      if (profileCompletionProcessed.current) {
        console.log('[ProspectChat] Profile completion already processed - skipping duplicate trigger');
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('[ProspectChat] Failed to get authenticated user:', authError);
        setState((prev) => ({
          ...prev,
          error: 'Authentication error. Please refresh and try again.',
        }));
        return;
      }

      const knownProfile = extractKnownProfile(user);
      profileCompletionProcessed.current = true;

      // Recalculate user message count from existing messages when entering profile completion mode
      const currentMessages = stateRef.current?.messages || [];
      const userMessageCount = currentMessages.filter(m => m.role === 'user').length;

      setState((prev) => ({
        ...prev,
        profileCompletionMode: true,
        isAuthenticated: true, // User exists = authenticated
        userId: user.id,
        userProfile: knownProfile,
        consentGrantedForProfileCompletion: true,
        isLoading: true,
        error: null,
        userMessageCountAfterSignup: userMessageCount, // Initialize counter from existing messages
      }));
      
      console.log('[ProspectChatContext] 📊 Initialized user message count on profile completion mode:', userMessageCount);

      // Trigger profile completion via backend API (sends SYSTEM message server-side and returns AI response)
      // Load session from API instead of localStorage
      const currentSessionId = stateRef.current?.sessionId;
      let session: ProspectSession | null = null;
      if (currentSessionId) {
        try {
          session = await sessionService.loadSession(currentSessionId);
        } catch (error) {
          console.error('[ProspectChat] Error loading session for profile completion:', error);
        }
      }

      try {
        console.log('[ProspectChat] Calling /api/ai/prospect/trigger-profile-completion', {
          sessionId: session?.sessionId,
          historyLength: session?.conversation?.length ?? 0,
        });

        const res = await fetch('/api/ai/prospect/trigger-profile-completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // ensure cookies (session) are sent for auth
          body: JSON.stringify({
            sessionId: session?.sessionId ?? undefined,
            conversationHistory: session?.conversation ?? [],
            gatheredPreferences: session?.gatheredPreferences ?? {},
            userProfile: knownProfile,
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

        console.log('[ProspectChat] Profile completion trigger successful', {
          messageId: assistantMessage.id,
          contentLength: assistantMessage.content.length,
        });

        const triggerUserMessage: ProspectMessage = {
          id: `user_trigger_${Date.now()}`,
          role: 'user',
          content: data.triggerMessage ?? '[Profile completion]',
          timestamp: new Date().toISOString(),
        };

        setState((prev) => ({
          ...prev,
          sessionId: data.sessionId ?? prev.sessionId,
          messages: [...prev.messages, triggerUserMessage, assistantMessage],
          preferences: data.extractedPreferences
            ? { ...prev.preferences, ...data.extractedPreferences }
            : prev.preferences,
          isLoading: false,
        }));
      } catch (err: any) {
        console.error('[ProspectChat] Trigger profile completion failed:', err);
        profileCompletionProcessed.current = false;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message ?? 'Failed to start profile completion. You can continue the conversation below.',
        }));
      }
    };

    // Always register the listener (not conditional) to catch events that fire at any time
    console.log('[ProspectChat] Registering consentSetupCompleted event listener');
    window.addEventListener('consentSetupCompleted', handleConsentCompleted);
    return () => {
      console.log('[ProspectChat] Removing consentSetupCompleted event listener');
      window.removeEventListener('consentSetupCompleted', handleConsentCompleted);
    };
  }, [router]);

  const sendMessage = useCallback(async (message: string) => {
    console.log('[ProspectChatContext] sendMessage called with:', message);
    
    // Extract email from message if user shares it (for session recovery)
    const extractedEmail = sessionService.extractEmailFromMessage(message);
    if (extractedEmail) {
      console.log('[ProspectChatContext] 📧 Extracted email from message:', extractedEmail);
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

    console.log('[ProspectChatContext] Created user message:', userMessage);

    // Increment user message counter after signup (for fallback strategy)
    // Only count if user is authenticated and in profile completion mode
    let newMessageCount = state.userMessageCountAfterSignup;
    if (state.isAuthenticated && state.consentGrantedForProfileCompletion && !state.hasExistingProfile) {
      newMessageCount = state.userMessageCountAfterSignup + 1;
      setState((prev) => ({
        ...prev,
        userMessageCountAfterSignup: prev.userMessageCountAfterSignup + 1,
      }));
      console.log('[ProspectChatContext] 📊 User message count after signup:', newMessageCount);
    }

    // CRITICAL: Get current messages from state directly (not ref) to ensure we have all previous messages
    // The ref might be stale or null, but state is always current
    // Use stateRef as fallback only if state is somehow unavailable
    const currentMessages = state.messages.length > 0 ? state.messages : (stateRef.current?.messages || []);
    const updatedMessages = [...currentMessages, userMessage];
    
    console.log('[ProspectChatContext] 📝 Preparing to send message - state messages:', state.messages.length,
      'ref messages:', stateRef.current?.messages?.length || 0,
      'current messages (used):', currentMessages.length,
      'updated messages:', updatedMessages.length,
      'user message ID:', userMessage.id,
      'all message IDs before:', currentMessages.map(m => ({ id: m.id, role: m.role })),
      'all message IDs after:', updatedMessages.map(m => ({ id: m.id, role: m.role })));
    
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
      
      console.log('[ProspectChatContext] 📤 Sending to API - conversationHistory length:', finalConversationHistory.length,
        'user messages:', finalConversationHistory.filter(m => m.role === 'user').length,
        'assistant messages:', finalConversationHistory.filter(m => m.role === 'assistant').length,
        'message IDs:', finalConversationHistory.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 50) })));
      
      if (finalConversationHistory.length === 0) {
        console.error('[ProspectChatContext] ⚠️ WARNING: conversationHistory is empty! This should not happen.');
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
          console.log('[ProspectChatContext] 🔄 Auto-triggering fallback due to profile update error in message');
          // Small delay to ensure message is displayed first
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('triggerProfileExtractionFallback'));
          }, 1000);
        }
      }

      // Check if profile was successfully created - if so, clear all prospect data
      if (data.profileCreated === true) {
        console.log('[ProspectChatContext] 🎉 Profile created successfully! Clearing all prospect data...');
        
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
        
        console.log('[ProspectChatContext] 📋 Collected leg references before clearing:', allPreviousLegRefs.length);
        
        // Clear all prospect data: messages, preferences, viewed legs, session
        // Delete session from database
        if (currentState.sessionId) {
          try {
            await sessionService.deleteSession(currentState.sessionId);
            console.log('[ProspectChatContext] ✅ Deleted session from database');
          } catch (error) {
            console.error('[ProspectChatContext] Error deleting session:', error);
          }
        }
        await clearSessionCookie();
        console.log('[ProspectChatContext] ✅ Cleared server session cookie');

        // Fetch a new session ID from server
        const newSession = await fetchSessionFromCookie();
        console.log('[ProspectChatContext] ✅ Fetched new session ID:', newSession?.sessionId);

        // Clear all prospect state but preserve authentication
        // Only show the congratulations message (no previous chat history)
        // CRITICAL: Clear preferences completely including skills to prevent stale data
        const clearedPreferences: ProspectPreferences = {};
        console.log('[ProspectChatContext] 🧹 Cleared preferences (including skills):', clearedPreferences);
        
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
          consentGrantedForProfileCompletion: currentState.consentGrantedForProfileCompletion,
          hasExistingProfile: true, // Profile now exists
          userMessageCountAfterSignup: currentState.userMessageCountAfterSignup, // Preserve counter
        };
        
        // Update ref immediately to prevent stale saves
        if (stateRef.current) {
          stateRef.current = { ...clearedState, userMessageCountAfterSignup: stateRef.current.userMessageCountAfterSignup };
        }
        
        setState({ ...clearedState, userMessageCountAfterSignup: stateRef.current?.userMessageCountAfterSignup || 0 });
        setIsReturningUser(false);
        console.log('[ProspectChatContext] ✅ All prospect data cleared (messages, preferences, skills, viewedLegs), profile creation complete. Showing congratulations message with', allPreviousLegRefs.length, 'leg references.');
        return;
      }

      // Parse [PROSPECT_NAME: ...] from assistant message to prefill signup form
      // Also check all previous messages to ensure we don't lose a name that was extracted earlier
      const assistantContent = data.message?.content ?? '';
      // Reuse currentState from above (line 567) - get fresh ref state for checking previous messages
      const latestState = stateRef.current!;
      let extractedName: string | undefined;
      
      // First check the latest assistant message for PROSPECT_NAME tag
      console.log('[ProspectChatContext] Checking for PROSPECT_NAME in assistant content:', assistantContent.substring(0, 200));
      const nameMatch = assistantContent.match(PROSPECT_NAME_TAG_REGEX);
      if (nameMatch?.[1]?.trim()) {
        extractedName = nameMatch[1].trim();
        console.log('[ProspectChatContext] ✅ Extracted PROSPECT_NAME from latest assistant message:', extractedName);
      } else {
        console.log('[ProspectChatContext] No PROSPECT_NAME tag found in latest message, checking previous messages...');
        // If not in latest message, check all previous assistant messages
        for (const msg of latestState.messages) {
          if (msg.role === 'assistant') {
            const prevNameMatch = msg.content.match(PROSPECT_NAME_TAG_REGEX);
            if (prevNameMatch?.[1]?.trim()) {
              extractedName = prevNameMatch[1].trim();
              console.log('[ProspectChatContext] ✅ Found PROSPECT_NAME in previous assistant message:', extractedName, 'from message:', msg.content.substring(0, 100));
              break;
            }
          }
        }
        
        // Also check user messages for name patterns (fallback if AI didn't tag it)
        // Look for patterns like "Name: ...", "My name is ...", "I'm ...", etc.
        if (!extractedName) {
          console.log('[ProspectChatContext] Checking user messages for name patterns...');
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
                console.log('[ProspectChatContext] ✅ Extracted name from user message pattern:', extractedName, 'from:', msg.content.substring(0, 100));
                break;
              }
            }
            if (extractedName) break;
          }
        }
        
        if (!extractedName) {
          console.log('[ProspectChatContext] ❌ No name found in any messages');
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
          console.warn('[ProspectChatContext] ⚠️ User message missing from state, adding it:', userMessage.id);
          messagesWithUser = [...messagesWithUser, userMessage];
        }
        
        // Check if the assistant message already exists to avoid duplicates
        const assistantMessageExists = messagesWithUser.some(m => m.id === messageToStore.id);
        const finalMessages = assistantMessageExists 
          ? messagesWithUser 
          : [...messagesWithUser, messageToStore];
        
        console.log('[ProspectChatContext] ✅ Final messages array length:', finalMessages.length, 
          'user messages:', finalMessages.filter(m => m.role === 'user').length,
          'assistant messages:', finalMessages.filter(m => m.role === 'assistant').length,
          'has user message:', finalMessages.some(m => m.id === userMessage.id),
          'user message IDs:', finalMessages.filter(m => m.role === 'user').map(m => m.id),
          'all message IDs:', finalMessages.map(m => ({ id: m.id, role: m.role })));
        
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
          console.log('[ProspectChatContext] Updated preferences with fullName:', preferencesUpdate.fullName);
          console.log('[ProspectChatContext] Full preferences object:', updatedPreferences);
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
      console.error('Prospect chat error:', error);
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
        console.log('[ProspectChatContext] 🔄 Auto-triggering fallback profile extraction due to error:', errorType, errorMessage);
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
      console.log('[ProspectChatContext] ⏭️ Skipping save - no sessionId');
      return;
    }

    const userMessages = state.messages.filter(m => m.role === 'user');
    const assistantMessages = state.messages.filter(m => m.role === 'assistant');
    console.log('[ProspectChatContext] Auto-saving session - total messages:', state.messages.length,
      'user messages:', userMessages.length,
      'assistant messages:', assistantMessages.length,
      'sessionId:', state.sessionId);
    
    // CRITICAL: Don't save if we just cleared everything (empty messages and empty preferences)
    // This prevents overwriting the cleared state after profile creation
    if (state.messages.length === 0 && Object.keys(state.preferences).length === 0) {
      console.log('[ProspectChatContext] ⏭️ Skipping save - state is cleared (likely after profile creation)');
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
          console.warn('[ProspectChatContext] ⚠️ Failed to get session ID from cookie, skipping save');
          return;
        }
        
        const cookieData = await cookieResponse.json();
        const currentSessionId = cookieData.sessionId;
        
        if (!currentSessionId) {
          console.warn('[ProspectChatContext] ⚠️ No session ID from cookie, skipping save');
          return;
        }
        
        // Sync state.sessionId if it changed (cookie might have been refreshed)
        if (currentSessionId !== state.sessionId) {
          console.log('[ProspectChatContext] 🔄 Session ID changed, updating state:', {
            old: state.sessionId,
            new: currentSessionId,
          });
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
        
        console.log('[ProspectChatContext] 💾 Saving session with sessionId:', currentSessionId,
          'messages:', session.conversation.length,
          'preferences keys:', Object.keys(session.gatheredPreferences).length);
        
        await sessionService.saveSession(currentSessionId, session);
        console.log('[ProspectChatContext] ✅ Session saved to API');
      } catch (error: any) {
        console.error('[ProspectChatContext] Error auto-saving session:', error);
        // Don't throw - auto-save failures shouldn't break the UI
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [state.sessionId, state.messages, state.preferences, state.viewedLegs]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearSession = useCallback(async () => {
    console.log('[ProspectChatContext] 🧹 Clearing prospect chat session...');
    
    // Clear session from database and server cookie
    const currentSessionId = stateRef.current?.sessionId;
    if (currentSessionId) {
      try {
        await sessionService.deleteSession(currentSessionId);
        console.log('[ProspectChatContext] ✅ Deleted session from database');
      } catch (error) {
        console.error('[ProspectChatContext] Error deleting session:', error);
      }
    }
    await clearSessionCookie();
    console.log('[ProspectChatContext] ✅ Cleared server session cookie');

    // Fetch a new session ID from server
    const newSession = await fetchSessionFromCookie();
    console.log('[ProspectChatContext] ✅ Fetched new session ID:', newSession?.sessionId);

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
      consentGrantedForProfileCompletion: prev.consentGrantedForProfileCompletion,
      hasExistingProfile: prev.hasExistingProfile,
    }));
    setIsReturningUser(false);
    console.log('[ProspectChatContext] ✅ Session cleared - chat data removed, auth state preserved');
  }, []);

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
      console.error('Approve action error:', error);
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

    // Process combo search parameters
    if (whereFromParam || whereToParam || availabilityTextParam || profileParam) {
      initialQueryProcessed.current = true;
      console.log('[ProspectChatContext] Processing combo search parameters');

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
          console.error('[ProspectChatContext] Error parsing whereFrom:', e);
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
          console.error('[ProspectChatContext] Error parsing whereTo:', e);
          parts.push(`Looking to sail to: ${whereToParam}`);
        }
      }

      if (availabilityTextParam || availabilityStartParam) {
        let availText = availabilityTextParam || '';
        if (availabilityStartParam && availabilityEndParam) {
          try {
            const start = new Date(availabilityStartParam);
            const end = new Date(availabilityEndParam);
            const dateStr = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
            availText = availText ? `${availText} (${dateStr})` : dateStr;
          } catch (e) {
            console.error('[ProspectChatContext] Error parsing dates:', e);
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
      console.log('[ProspectChatContext] Processing legacy initial query:', legacyQueryParam.trim());
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
