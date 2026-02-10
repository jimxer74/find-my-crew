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
} from '@/app/lib/ai/prospect/types';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

const STORAGE_KEY = 'prospect_session';
const SESSION_EXPIRY_DAYS = 7;

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
  /** True after user has successfully saved profile via update_user_profile (approve "Save Profile"). Enables showing Join buttons. */
  hasCompletedProfileCreation: boolean;
}

interface ProspectChatContextType extends ProspectChatState {
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
  clearSession: () => void;
  addViewedLeg: (legId: string) => void;
  approveAction: (messageId: string, action: PendingAction) => Promise<void>;
  cancelAction: (messageId: string) => void;
  isReturningUser: boolean;
}

const ProspectChatContext = createContext<ProspectChatContextType | null>(null);

/**
 * Load session from localStorage
 */
function loadSession(): ProspectSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session: ProspectSession = JSON.parse(stored);

    // Check if session has expired
    const lastActive = new Date(session.lastActiveAt);
    const now = new Date();
    const daysSinceActive =
      (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceActive > SESSION_EXPIRY_DAYS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return session;
  } catch (e) {
    console.error('Failed to load prospect session:', e);
    return null;
  }
}

/**
 * Save session to localStorage
 */
function saveSession(session: ProspectSession): void {
  if (typeof window === 'undefined') return;

  try {
    session.lastActiveAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save prospect session:', e);
  }
}

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
    hasCompletedProfileCreation: false,
  });

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [isReturningUser, setIsReturningUser] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load session on mount - combine cookie (session ID) with localStorage (data)
  useEffect(() => {
    async function initSession() {
      // Check if we're in profile completion mode (post-signup flow)
      const isProfileCompletionMode = searchParams?.get('profile_completion') === 'true';

      // Load localStorage data first - this contains the conversation history
      const localSession = loadSession();
      if (localSession) {
        const userMessages = localSession.conversation.filter(m => m.role === 'user');
        const assistantMessages = localSession.conversation.filter(m => m.role === 'assistant');
        console.log('[ProspectChatContext] Loaded session from localStorage - total messages:', localSession.conversation.length,
          'user messages:', userMessages.length,
          'assistant messages:', assistantMessages.length);
      }

      // First, get session ID from HttpOnly cookie
      const cookieSession = await fetchSessionFromCookie();

      if (cookieSession) {
        // Check if localStorage data matches the cookie session
        if (localSession && localSession.sessionId === cookieSession.sessionId) {
          // Restore full session from localStorage
          setState((prev) => ({
            ...prev,
            sessionId: cookieSession.sessionId,
            messages: localSession.conversation,
            preferences: localSession.gatheredPreferences,
            viewedLegs: localSession.viewedLegs,
          }));
          setIsReturningUser(localSession.conversation.length > 0);
        } else if (isProfileCompletionMode && localSession) {
          // In profile completion mode, PRESERVE localStorage data even if cookie doesn't match
          // This ensures conversation history survives the signup process
          console.log('[ProspectChatContext] Profile completion mode - preserving localStorage session');
          setState((prev) => ({
            ...prev,
            sessionId: localSession.sessionId,
            messages: localSession.conversation,
            preferences: localSession.gatheredPreferences,
            viewedLegs: localSession.viewedLegs,
          }));
          setIsReturningUser(localSession.conversation.length > 0);
        } else {
          // Cookie exists but localStorage is stale or missing (and not in profile completion)
          // Clear localStorage and start fresh with the cookie session ID
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
          }
          setState((prev) => ({
            ...prev,
            sessionId: cookieSession.sessionId,
          }));
          setIsReturningUser(false);
        }
      } else {
        // No cookie session - fallback to localStorage only (legacy support)
        if (localSession) {
          setState((prev) => ({
            ...prev,
            sessionId: localSession.sessionId,
            messages: localSession.conversation,
            preferences: localSession.gatheredPreferences,
            viewedLegs: localSession.viewedLegs,
          }));
          setIsReturningUser(localSession.conversation.length > 0);
        }
      }

      setIsInitialized(true);
    }

    initSession();
  }, [searchParams]);

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
            isAuthenticated: true,
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

      setState((prev) => ({
        ...prev,
        profileCompletionMode: true,
        isAuthenticated: true,
        userId: user.id,
        userProfile: knownProfile,
        consentGrantedForProfileCompletion: true,
        isLoading: true,
        error: null,
      }));

      // Trigger profile completion via backend API (sends SYSTEM message server-side and returns AI response)
      const session = loadSession();

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
    // Create user message first
    const userMessage: ProspectMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    console.log('[ProspectChatContext] Created user message:', userMessage);

    // Update state with loading and user message in one update
    // Use functional update to ensure we have the latest state
    let conversationHistoryForAPI: ProspectMessage[] = [];
    
    // Use a synchronous state update to ensure the user message is immediately in state
    setState((prev) => {
      const updatedMessages = [...prev.messages, userMessage];
      conversationHistoryForAPI = updatedMessages; // Store for API call
      console.log('[ProspectChatContext] Updated messages array, length:', updatedMessages.length, 
        'includes user message:', updatedMessages.some(m => m.id === userMessage.id),
        'user message content:', userMessage.content);
      
      // Update the ref immediately so it's available for the API call
      if (stateRef.current) {
        stateRef.current = {
          ...stateRef.current,
          messages: updatedMessages,
        };
      }
      
      return {
        ...prev,
        isLoading: true,
        error: null,
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
          message,
          conversationHistory: conversationHistoryForAPI, // Use the updated messages array
          gatheredPreferences: currentState.preferences,
          // Include profile completion context for authenticated users
          profileCompletionMode: currentState.profileCompletionMode,
          userId: currentState.userId,
          userProfile: currentState.userProfile,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.userMessage || 'Failed to send message');
      }

      const data = await response.json();

      // Parse [PROSPECT_NAME: ...] from assistant message to prefill signup form
      const assistantContent = data.message?.content ?? '';
      const nameMatch = assistantContent.match(PROSPECT_NAME_TAG_REGEX);
      const extractedName = nameMatch?.[1]?.trim();
      const preferencesUpdate: Partial<ProspectPreferences> = data.extractedPreferences
        ? { ...data.extractedPreferences }
        : {};
      if (extractedName) {
        preferencesUpdate.fullName = extractedName;
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
        // Always ensure the user message is present - add it if missing
        let messagesWithUser = prev.messages;
        const hasUserMessage = prev.messages.some(m => m.id === userMessage.id);
        
        if (!hasUserMessage) {
          console.warn('[ProspectChatContext] User message missing from state, adding it:', userMessage.id);
          messagesWithUser = [...prev.messages, userMessage];
        }
        
        // Check if the assistant message already exists to avoid duplicates
        const assistantMessageExists = messagesWithUser.some(m => m.id === messageToStore.id);
        const finalMessages = assistantMessageExists 
          ? messagesWithUser 
          : [...messagesWithUser, messageToStore];
        
        console.log('[ProspectChatContext] Final messages array length:', finalMessages.length, 
          'user messages:', finalMessages.filter(m => m.role === 'user').length,
          'assistant messages:', finalMessages.filter(m => m.role === 'assistant').length,
          'has user message:', finalMessages.some(m => m.id === userMessage.id),
          'user message IDs:', finalMessages.filter(m => m.role === 'user').map(m => m.id));
        
        // Update the ref to keep it in sync
        if (stateRef.current) {
          stateRef.current = {
            ...stateRef.current,
            messages: finalMessages,
          };
        }
        
        return {
          ...prev,
          sessionId: data.sessionId,
          messages: finalMessages,
          preferences:
            Object.keys(preferencesUpdate).length > 0
              ? { ...prev.preferences, ...preferencesUpdate }
              : prev.preferences,
          isLoading: false,
        };
      });
    } catch (error: any) {
      console.error('Prospect chat error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Something went wrong. Please try again.',
        // Remove the optimistic user message on error
        messages: prev.messages.filter((m) => m.id !== userMessage.id),
      }));
    }
  }, []); // Empty dependency array - use refs for state values

  // Save session when state changes
  useEffect(() => {
    if (state.sessionId) {
      const userMessages = state.messages.filter(m => m.role === 'user');
      const assistantMessages = state.messages.filter(m => m.role === 'assistant');
      console.log('[ProspectChatContext] Saving session - total messages:', state.messages.length,
        'user messages:', userMessages.length,
        'assistant messages:', assistantMessages.length);
      
      const session: ProspectSession = {
        sessionId: state.sessionId,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        conversation: state.messages,
        gatheredPreferences: state.preferences,
        viewedLegs: state.viewedLegs,
      };
      saveSession(session);
    }
  }, [state.sessionId, state.messages, state.preferences, state.viewedLegs]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearSession = useCallback(async () => {
    // Clear both localStorage and server cookie
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    await clearSessionCookie();

    // Fetch a new session ID from server
    const newSession = await fetchSessionFromCookie();

    setState({
      sessionId: newSession?.sessionId || null,
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
      hasCompletedProfileCreation: false,
    });
    setIsReturningUser(false);
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
        ...(action.toolName === 'update_user_profile' ? { hasCompletedProfileCreation: true } : {}),
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

    const initialQuery = searchParams?.get('q');
    if (initialQuery && initialQuery.trim()) {
      initialQueryProcessed.current = true;
      console.log('[ProspectChatContext] Processing initial query:', initialQuery.trim());
      // Send the initial message
      sendMessage(initialQuery.trim());
    }
  }, [isInitialized, searchParams, sendMessage, state.isLoading]);

  const value: ProspectChatContextType = {
    ...state,
    sendMessage,
    clearError,
    clearSession,
    addViewedLeg,
    approveAction,
    cancelAction,
    isReturningUser,
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
