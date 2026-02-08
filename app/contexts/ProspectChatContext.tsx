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

const STORAGE_KEY = 'prospect_session';
const SESSION_EXPIRY_DAYS = 7;

interface ProspectChatState {
  sessionId: string | null;
  messages: ProspectMessage[];
  preferences: ProspectPreferences;
  viewedLegs: string[];
  isLoading: boolean;
  error: string | null;
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

  const [state, setState] = useState<ProspectChatState>({
    sessionId: null,
    messages: [],
    preferences: {},
    viewedLegs: [],
    isLoading: false,
    error: null,
  });

  const [isReturningUser, setIsReturningUser] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load session on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setState((prev) => ({
        ...prev,
        sessionId: session.sessionId,
        messages: session.conversation,
        preferences: session.gatheredPreferences,
        viewedLegs: session.viewedLegs,
      }));
      setIsReturningUser(session.conversation.length > 0);
    }
    setIsInitialized(true);
  }, []);

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
  }, [state.sessionId, state.messages, state.preferences]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState({
      sessionId: null,
      messages: [],
      preferences: {},
      viewedLegs: [],
      isLoading: false,
      error: null,
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
