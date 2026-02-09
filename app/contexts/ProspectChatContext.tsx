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
import { useSearchParams } from 'next/navigation';
import {
  ProspectMessage,
  ProspectSession,
  ProspectPreferences,
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
}

interface ProspectChatContextType extends ProspectChatState {
  sendMessage: (message: string) => Promise<void>;
  clearError: () => void;
  clearSession: () => void;
  addViewedLeg: (legId: string) => void;
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

export function ProspectChatProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const initialQueryProcessed = useRef(false);
  const profileCompletionProcessed = useRef(false);

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
  });

  const [isReturningUser, setIsReturningUser] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load session on mount - combine cookie (session ID) with localStorage (data)
  useEffect(() => {
    async function initSession() {
      // First, get session ID from HttpOnly cookie
      const cookieSession = await fetchSessionFromCookie();

      if (cookieSession) {
        // Load localStorage data
        const localSession = loadSession();

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
        } else {
          // Cookie exists but localStorage is stale or missing
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
        const localSession = loadSession();
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
  }, []);

  // Detect profile completion mode and check authentication
  useEffect(() => {
    async function checkProfileCompletionMode() {
      const isProfileCompletion = searchParams?.get('profile_completion') === 'true';

      if (isProfileCompletion) {
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setState((prev) => ({
            ...prev,
            profileCompletionMode: true,
            isAuthenticated: true,
            userId: user.id,
          }));
          console.log('Profile completion mode activated for user:', user.id);
        }
      }
    }

    if (isInitialized) {
      checkProfileCompletionMode();
    }
  }, [isInitialized, searchParams]);

  // Auto-send profile completion message when entering profile completion mode
  useEffect(() => {
    if (
      isInitialized &&
      state.profileCompletionMode &&
      state.isAuthenticated &&
      !profileCompletionProcessed.current &&
      !state.isLoading
    ) {
      profileCompletionProcessed.current = true;

      // Create a welcome back message from the assistant
      const welcomeMessage: ProspectMessage = {
        id: `assistant_welcome_${Date.now()}`,
        role: 'assistant',
        content: `Welcome back! 🎉 Great news - your account is now active! I remember our conversation about your sailing interests. Let me help you complete your profile so boat owners can see what a great match you are.

Based on our chat, here's what I've gathered about your preferences:
${state.preferences.sailingGoals ? `• **Sailing goals:** ${state.preferences.sailingGoals}` : ''}
${state.preferences.experienceLevel ? `• **Experience level:** ${state.preferences.experienceLevel}/4` : ''}
${state.preferences.preferredLocations?.length ? `• **Preferred locations:** ${state.preferences.preferredLocations.join(', ')}` : ''}
${state.preferences.skills?.length ? `• **Skills:** ${state.preferences.skills.join(', ')}` : ''}
${state.preferences.riskLevels?.length ? `• **Comfort level:** ${state.preferences.riskLevels.join(', ')}` : ''}

Would you like me to help you complete your profile with this information? I can also help you add:
• Your full name (for boat owners to know who you are)
• A short bio about your sailing background
• Any certifications you have

Just let me know what you'd like to do!`,
        timestamp: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, welcomeMessage],
      }));
    }
  }, [isInitialized, state.profileCompletionMode, state.isAuthenticated, state.isLoading, state.preferences]);

  // Save session when state changes
  useEffect(() => {
    if (state.sessionId) {
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

  const sendMessage = useCallback(async (message: string) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    // Create user message
    const userMessage: ProspectMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));

    try {
      const response = await fetch('/api/ai/prospect/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          message,
          conversationHistory: state.messages,
          gatheredPreferences: state.preferences,
          // Include profile completion context for authenticated users
          profileCompletionMode: state.profileCompletionMode,
          userId: state.userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.userMessage || 'Failed to send message');
      }

      const data = await response.json();

      setState((prev) => ({
        ...prev,
        sessionId: data.sessionId,
        messages: [...prev.messages, data.message],
        preferences: data.extractedPreferences
          ? { ...prev.preferences, ...data.extractedPreferences }
          : prev.preferences,
        isLoading: false,
      }));
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
  }, [state.sessionId, state.messages, state.preferences, state.profileCompletionMode, state.userId]);

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

  // Process initial query from URL parameter (from welcome page search)
  useEffect(() => {
    if (!isInitialized || initialQueryProcessed.current || state.isLoading) {
      return;
    }

    const initialQuery = searchParams?.get('q');
    if (initialQuery && initialQuery.trim()) {
      initialQueryProcessed.current = true;
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
