'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode, RefObject } from 'react';
import { AIConversation, AIMessage, AIPendingAction, AISuggestion } from '@/app/lib/ai/assistant/types';

interface AIError {
  message: string;
  type: 'rate_limit' | 'timeout' | 'network_error' | 'config_error' | 'service_unavailable' | 'quota_exceeded' | 'consent_required' | 'unknown_error';
  retryAfter?: number; // seconds to wait before retry
  canRetry: boolean;
}

interface AssistantState {
  isOpen: boolean;
  isMobile: boolean;
  conversations: AIConversation[];
  currentConversationId: string | null;
  messages: AIMessage[];
  pendingActions: AIPendingAction[];
  suggestions: AISuggestion[];
  isLoading: boolean;
  error: string | null;
  errorDetails: AIError | null;
  lastFailedMessage: string | null; // Store last message for retry
}

interface AssistantContextType extends AssistantState {
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  buttonRef: RefObject<HTMLButtonElement>;
  setCurrentConversation: (id: string | null) => void;
  sendMessage: (message: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  clearError: () => void;
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createNewConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  approveAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string) => Promise<void>;
  dismissSuggestion: (suggestionId: string) => Promise<void>;
  loadSuggestions: () => Promise<void>;
  loadPendingActions: () => Promise<void>;
  suggestionsCount: number;
  pendingActionsCount: number;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<AssistantState>({
    isOpen: false,
    isMobile: false,
    conversations: [],
    currentConversationId: null,
    messages: [],
    pendingActions: [],
    suggestions: [],
    isLoading: false,
    error: null,
    errorDetails: null,
    lastFailedMessage: null,
  });

  const openAssistant = useCallback(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    setState(prev => ({ ...prev, isOpen: true, isMobile }));
  }, []);

  const closeAssistant = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const toggleAssistant = useCallback(() => {
    setState(prev => {
      if (prev.isOpen) {
        return { ...prev, isOpen: false };
      }
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      return { ...prev, isOpen: true, isMobile };
    });
  }, []);

  const setCurrentConversation = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, currentConversationId: id, messages: [] }));
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/assistant/conversations');
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({ ...prev, conversations: data.conversations }));
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const response = await fetch(`/api/ai/assistant/conversations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({
          ...prev,
          currentConversationId: id,
          messages: data.messages,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const createNewConversation = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentConversationId: null,
      messages: [],
    }));
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/ai/assistant/conversations/${id}`, { method: 'DELETE' });
      setState(prev => ({
        ...prev,
        conversations: prev.conversations.filter(c => c.id !== id),
        currentConversationId: prev.currentConversationId === id ? null : prev.currentConversationId,
        messages: prev.currentConversationId === id ? [] : prev.messages,
      }));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, []);

  const sendMessage = useCallback(async (message: string) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        errorDetails: null,
        lastFailedMessage: null
      }));

      // Add optimistic user message
      const tempUserMessage: AIMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: state.currentConversationId || '',
        role: 'user',
        content: message,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, tempUserMessage],
      }));

      const response = await fetch('/api/ai/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: state.currentConversationId,
          message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Determine if error is retryable
        const retryableTypes = ['rate_limit', 'timeout', 'network_error', 'service_unavailable'];
        const errorType = errorData.errorType || 'unknown_error';
        const canRetry = retryableTypes.includes(errorType);

        const errorDetails: AIError = {
          message: errorData.userMessage || errorData.error || 'Failed to send message',
          type: errorType,
          retryAfter: errorData.retryAfter,
          canRetry
        };

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorDetails.message,
          errorDetails,
          lastFailedMessage: canRetry ? message : null,
          // Remove the temp message on error
          messages: prev.messages.filter(m => !m.id.startsWith('temp-')),
        }));
        return;
      }

      const data = await response.json();

      setState(prev => {
        // Remove temp message and add real messages
        const messagesWithoutTemp = prev.messages.filter(m => !m.id.startsWith('temp-'));

        // Find the user message from the response or keep the temp one with proper ID
        const userMessage: AIMessage = {
          ...tempUserMessage,
          id: `user-${Date.now()}`,
          conversation_id: data.conversationId,
        };

        return {
          ...prev,
          currentConversationId: data.conversationId,
          messages: [...messagesWithoutTemp, userMessage, data.message],
          pendingActions: data.pendingActions || prev.pendingActions,
          isLoading: false,
          error: null,
          errorDetails: null,
          lastFailedMessage: null,
        };
      });

      // Reload conversations to update the list
      loadConversations();
    } catch (error: any) {
      // Handle network-level errors (fetch failed, etc.)
      const errorDetails: AIError = {
        message: 'Unable to connect to the AI service. Please check your internet connection.',
        type: 'network_error',
        canRetry: true
      };

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorDetails.message,
        errorDetails,
        lastFailedMessage: message,
        // Remove the temp message on error
        messages: prev.messages.filter(m => !m.id.startsWith('temp-')),
      }));
    }
  }, [state.currentConversationId, loadConversations]);

  const retryLastMessage = useCallback(async () => {
    if (state.lastFailedMessage) {
      await sendMessage(state.lastFailedMessage);
    }
  }, [state.lastFailedMessage, sendMessage]);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      errorDetails: null,
      lastFailedMessage: null,
    }));
  }, []);

  const loadPendingActions = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/assistant/actions');
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({ ...prev, pendingActions: data.actions }));
      }
    } catch (error) {
      console.error('Failed to load pending actions:', error);
    }
  }, []);

  const approveAction = useCallback(async (actionId: string) => {
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          pendingActions: prev.pendingActions.filter(a => a.id !== actionId),
        }));
      }
    } catch (error) {
      console.error('Failed to approve action:', error);
    }
  }, []);

  const rejectAction = useCallback(async (actionId: string) => {
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/reject`, {
        method: 'POST',
      });

      if (response.ok) {
        setState(prev => ({
          ...prev,
          pendingActions: prev.pendingActions.filter(a => a.id !== actionId),
        }));
      }
    } catch (error) {
      console.error('Failed to reject action:', error);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/assistant/suggestions');
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({ ...prev, suggestions: data.suggestions }));
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  }, []);

  const dismissSuggestion = useCallback(async (suggestionId: string) => {
    try {
      await fetch(`/api/ai/assistant/suggestions/${suggestionId}/dismiss`, {
        method: 'POST',
      });
      setState(prev => ({
        ...prev,
        suggestions: prev.suggestions.filter(s => s.id !== suggestionId),
      }));
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
    }
  }, []);

  const value: AssistantContextType = {
    ...state,
    openAssistant,
    closeAssistant,
    toggleAssistant,
    buttonRef,
    setCurrentConversation,
    sendMessage,
    retryLastMessage,
    clearError,
    loadConversations,
    loadConversation,
    createNewConversation,
    deleteConversation,
    approveAction,
    rejectAction,
    dismissSuggestion,
    loadSuggestions,
    loadPendingActions,
    suggestionsCount: state.suggestions.filter(s => !s.dismissed).length,
    pendingActionsCount: state.pendingActions.filter(a => a.status === 'pending').length,
  };

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
