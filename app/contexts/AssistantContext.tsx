'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode, RefObject } from 'react';
import { AIConversation, AIMessage, AIPendingAction, AISuggestion } from '@/app/lib/ai/assistant/types';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

// Type declaration for custom event
declare global {
  interface WindowEventMap {
    'profileUpdated': CustomEvent<{ updatedFields: string[]; timestamp: number }>;
  }
}

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
  lastActionResult: {
    success: boolean;
    message: string;
    actionId: string;
  } | null;
  activeInputModal: {
    actionId: string;
    type: 'text' | 'text_array' | 'select';
    action: AIPendingAction;
  } | null;
  awaitingInputActions: string[]; // Action IDs that are awaiting user input
}

interface AssistantContextType extends AssistantState {
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  setCurrentConversation: (id: string | null) => void;
  sendMessage: (message: string) => Promise<void>;
  retryLastMessage: () => Promise<void>;
  clearError: () => void;
  clearActionResult: () => void;
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  createNewConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  approveAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string) => Promise<void>;
  dismissSuggestion: (suggestionId: string) => Promise<void>;
  loadSuggestions: () => Promise<void>;
  loadPendingActions: () => Promise<void>;
  showInputModal: (action: AIPendingAction) => void;
  hideInputModal: () => void;
  submitInput: (actionId: string, value: string | string[]) => Promise<void>;
  redirectToProfile: (action: AIPendingAction) => void;
  suggestionsCount: number;
  pendingActionsCount: number;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

// Helper function to parse profile action and determine section/field
export function parseProfileAction(action: AIPendingAction) {
  // Use metadata from action if available
  if (action.profile_section && action.profile_field) {
    return {
      section: action.profile_section,
      field: action.profile_field
    };
  }

  // Action to profile mapping
  const ACTION_TO_PROFILE_MAPPING: Record<string, { section: string; field: string }> = {
    'suggest_profile_update_user_description': { section: 'personal', field: 'user_description' },
    'update_profile_user_description': { section: 'personal', field: 'user_description' },
    'update_profile_certifications': { section: 'experience', field: 'certifications' },
    'update_profile_risk_level': { section: 'preferences', field: 'risk_level' },
    'update_profile_sailing_preferences': { section: 'preferences', field: 'sailing_preferences' },
    'update_profile_skills': { section: 'experience', field: 'skills' },
    'refine_skills': { section: 'experience', field: 'skills' },
  };

  const mapping = ACTION_TO_PROFILE_MAPPING[action.action_type];
  if (mapping) {
    return mapping;
  }

  // Default fallback if action type not in mapping
  return { section: 'personal', field: 'user_description' };
}

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
    lastActionResult: null,
    activeInputModal: null,
    awaitingInputActions: [],
  });

  const openAssistant = useCallback(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    setState(prev => ({ ...prev, isOpen: true, isMobile }));
  }, []);

  const closeAssistant = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, lastActionResult: null }));
  }, []);

  const toggleAssistant = useCallback(() => {
    setState(prev => {
      if (prev.isOpen) {
        return { ...prev, isOpen: false, lastActionResult: null };
      }
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      return { ...prev, isOpen: true, isMobile, lastActionResult: null };
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

  const clearActionResult = useCallback(() => {
    setState(prev => ({ ...prev, lastActionResult: null }));
  }, []);

  const showInputModal = useCallback((action: AIPendingAction) => {
    setState(prev => ({
      ...prev,
      activeInputModal: {
        actionId: action.id,
        type: action.input_type || 'text',
        action,
      },
    }));
  }, []);

  const hideInputModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      activeInputModal: null,
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

  const submitInput = useCallback(async (actionId: string, value: string | string[]) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const response = await fetch(`/api/ai/assistant/actions/${actionId}/submit-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Input submitted successfully:', data);

        setState(prev => ({
          ...prev,
          activeInputModal: null,
          isLoading: false,
          lastActionResult: {
            success: true,
            message: data.message || 'Input submitted successfully',
            actionId,
          },
        }));

        // Reload pending actions to reflect the updated action
        loadPendingActions();
      } else {
        let errorMessage = 'Failed to submit input';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // If we can't parse the error response, use default message
        }

        console.error('Submit input failed:', errorMessage);
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastActionResult: {
            success: false,
            message: errorMessage,
            actionId,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to submit input:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        lastActionResult: {
          success: false,
          message: 'Network error: Failed to submit input',
          actionId,
        },
      }));
    }
  }, [loadPendingActions]);

  const redirectToProfile = useCallback(async (action: AIPendingAction) => {
    console.log('redirectToProfile called for action:', action.id, 'type:', action.action_type);

    try {
      // Mark action as redirected in the database
      const response = await fetch(`/api/ai/assistant/actions/${action.id}/redirect`, {
        method: 'POST',
      });

      if (response.ok) {
        console.log('Successfully marked action as redirected:', action.id);

        // Update local state immediately
        setState(prev => ({
          ...prev,
          pendingActions: prev.pendingActions.map(a =>
            a.id === action.id ? { ...a, status: 'redirected' as const } : a
          )
        }));
      } else {
        console.warn('Failed to mark action as redirected:', response.status, response.statusText);
        // Still proceed with redirect even if API call fails
      }
    } catch (error) {
      console.error('Error marking action as redirected:', error);
      // Still proceed with redirect even if API call fails
    }

    // Parse action payload to determine target section and field
    const { section, field } = parseProfileAction(action);

    // Close assistant sidebar
    setState(prev => ({ ...prev, isOpen: false, lastActionResult: null }));

    // Navigate to profile with query params
    if (typeof window !== 'undefined') {
      console.log(`Navigating to profile: section=${section}, field=${field}, aiActionId=${action.id}`);
      window.location.href = `/profile?section=${section}&field=${field}&aiActionId=${action.id}`;
    }

    // Optional: Show toast notification (if toast is available)
    console.log(`Redirecting to profile to update ${field}`);
  }, []);

  const approveAction = useCallback(async (actionId: string, value?: string) => {
    const action = state.pendingActions.find(a => a.id === actionId);
    if (!action) {
      console.error('Action not found:', actionId);
      return;
    }

    // Check if this is a profile update action that should redirect
    const PROFILE_UPDATE_ACTIONS = [
      'suggest_profile_update_user_description',
      'update_profile_user_description',
      'update_profile_certifications',
      'update_profile_risk_level',
      'update_profile_sailing_preferences',
      'update_profile_skills',
      'refine_skills'
    ];

    if (PROFILE_UPDATE_ACTIONS.includes(action.action_type)) {
      // For profile update actions, redirect to profile page instead of direct approval
      redirectToProfile(action);
      return;
    }

    // Special handling for suggest_profile_update_user_description action
    if (action.action_type === 'suggest_profile_update_user_description') {
      if (!value || !value.trim()) {
        console.error('User description value is required for suggest_profile_update_user_description action');
        return;
      }

      // For suggest_profile_update_user_description, directly submit the input
      try {
        const response = await fetch(`/api/ai/assistant/actions/${actionId}/submit-input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('User description updated successfully:', data);

          setState(prev => ({
            ...prev,
            pendingActions: prev.pendingActions.filter(a => a.id !== actionId),
            lastActionResult: {
              success: true,
              message: data.message || 'User description updated successfully',
              actionId,
            },
          }));

          // Reload pending actions to reflect the updated action
          loadPendingActions();
        } else {
          let errorMessage = 'Failed to update user description';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            // If we can't parse the error response, use default message
          }

          console.error('Update user description failed:', errorMessage);
          setState(prev => ({
            ...prev,
            lastActionResult: {
              success: false,
              message: errorMessage,
              actionId,
            },
          }));
        }
      } catch (error) {
        console.error('Failed to update user description:', error);
        setState(prev => ({
          ...prev,
          lastActionResult: {
            success: false,
            message: 'Network error: Failed to update user description',
            actionId,
          },
        }));
      }
      return;
    }

    // Check if action requires input collection (for other action types)
    if (action.input_type && ['text', 'text_array', 'select'].includes(action.input_type)) {
      // Show input modal for this action
      showInputModal(action);
      return;
    }

    // For actions that don't require input, proceed with approval
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Action approved successfully:', data);

        setState(prev => ({
          ...prev,
          pendingActions: prev.pendingActions.filter(a => a.id !== actionId),
          lastActionResult: {
            success: true,
            message: data.message || 'Action approved successfully',
            actionId,
          },
        }));
      } else {
        // Handle error response
        let errorMessage = 'Failed to approve action';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // If we can't parse the error response, use default message
        }

        console.error('Approve action failed:', errorMessage);
        setState(prev => ({
          ...prev,
          lastActionResult: {
            success: false,
            message: errorMessage,
            actionId,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to approve action:', error);
      setState(prev => ({
        ...prev,
        lastActionResult: {
          success: false,
          message: 'Network error: Failed to approve action',
          actionId,
        },
      }));
    }
  }, [state.pendingActions, showInputModal, loadPendingActions]);

  const rejectAction = useCallback(async (actionId: string) => {
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/reject`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Action rejected successfully:', data);

        setState(prev => ({
          ...prev,
          pendingActions: prev.pendingActions.filter(a => a.id !== actionId),
          lastActionResult: {
            success: true,
            message: data.message || 'Action rejected successfully',
            actionId,
          },
        }));
      } else {
        // Handle error response
        let errorMessage = 'Failed to reject action';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // If we can't parse the error response, use default message
        }

        console.error('Reject action failed:', errorMessage);
        setState(prev => ({
          ...prev,
          lastActionResult: {
            success: false,
            message: errorMessage,
            actionId,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to reject action:', error);
      setState(prev => ({
        ...prev,
        lastActionResult: {
          success: false,
          message: 'Network error: Failed to reject action',
          actionId,
        },
      }));
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

  // Profile update action completion logic
  const markActionCompleted = useCallback(async (actionId: string) => {
    console.log('markActionCompleted called for action:', actionId);
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/complete`, {
        method: 'POST',
      });

      console.log('API response status:', response.status);
      if (response.ok) {
        console.log('API call successful, updating local state');
        // Update local state
        setState(prev => {
          const newState = {
            ...prev,
            pendingActions: prev.pendingActions.map(action =>
              action.id === actionId
                ? { ...action, status: 'approved' as const, resolved_at: new Date().toISOString() }
                : action
            )
          };
          console.log('New state created, pending actions:', newState.pendingActions);
          return newState;
        });

        // Reload pending actions to ensure UI updates
        await loadPendingActions();
      } else {
        console.error('API call failed:', response.status);
        const errorText = await response.text();
        console.error('API error response:', errorText);
      }
    } catch (error) {
      console.error('Error marking action as completed:', error);
    }
  }, [loadPendingActions]);

  const checkProfileUpdatedAction = useCallback(async (action: AIPendingAction, updatedFields?: string[]) => {
    console.log('checkProfileUpdatedAction called for action:', action.id, 'field:', action.profile_field, 'updatedFields:', updatedFields);
    if (!action.profile_field) {
      console.log('Action has no profile_field, skipping');
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log('No user found');
        return;
      }

      // If we have updated fields from the event, check if our field was updated
      if (updatedFields && updatedFields.includes(action.profile_field)) {
        console.log('Field was explicitly updated, marking as completed:', action.profile_field);
        // Field was explicitly updated, mark as completed
        await markActionCompleted(action.id);
        return;
      }

      console.log('Using fallback validation for field:', action.profile_field);
      // Fallback: check if field has meaningful content
      const { data: profile } = await supabase
        .from('profiles')
        .select(action.profile_field)
        .eq('id', user.id)
        .single();

      if (!profile) {
        console.log('No profile found');
        return;
      }

      const fieldValue = profile[action.profile_field as keyof typeof profile];
      console.log('Field value:', fieldValue);
      const hasMeaningfulContent = fieldValue &&
        (typeof fieldValue === 'string' ? fieldValue.trim().length > 0 : true) &&
        (Array.isArray(fieldValue) ? fieldValue.length > 0 : true);

      console.log('Has meaningful content:', hasMeaningfulContent);
      if (hasMeaningfulContent) {
        console.log('Marking action as completed via fallback');
        // Mark action as completed
        await markActionCompleted(action.id);
      } else {
        console.log('Field does not have meaningful content, not marking as completed');
      }
    } catch (error) {
      console.error('Error checking profile update:', error);
    }
  }, [markActionCompleted]);

  // Profile update listener
  useEffect(() => {
    const handleProfileUpdated = async (event: CustomEvent<{ updatedFields: string[]; timestamp: number }>) => {
      console.log('Received profileUpdated event:', event.detail);
      try {
        // Reload pending actions to get current state
        await loadPendingActions();
        console.log('Reloaded pending actions:', state.pendingActions);

        // Check all actions, not just redirected ones (for debugging)
        const allProfileActions = state.pendingActions.filter(
          a => a.profile_field
        );
        console.log('Found all profile actions:', allProfileActions);

        // Get redirected actions that might be completed
        const redirectedActions = state.pendingActions.filter(
          a => a.status === 'redirected' && a.profile_field
        );
        console.log('Found redirected actions:', redirectedActions);

        if (redirectedActions.length > 0) {
          // Check which actions can be marked as completed
          for (const action of redirectedActions) {
            console.log('Checking action:', action.id, 'for field:', action.profile_field);
            await checkProfileUpdatedAction(action, event.detail?.updatedFields);
          }
        } else {
          console.log('No redirected actions found. Checking if actions are in pending state...');
          const pendingProfileActions = state.pendingActions.filter(
            a => a.status === 'pending' && a.profile_field
          );
          console.log('Pending profile actions:', pendingProfileActions);
        }
      } catch (error) {
        console.error('Error handling profile update:', error);
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdated);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdated);
    };
  }, [loadPendingActions, state.pendingActions, checkProfileUpdatedAction]);

  // Periodic cleanup of expired actions
  useEffect(() => {
    const cleanupExpiredActions = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { error } = await supabase
          .from('ai_pending_actions')
          .update({
            status: 'expired',
            resolved_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('status', 'redirected')
          .lt('created_at', sevenDaysAgo.toISOString());

        if (error) {
          console.error('Error cleaning up expired actions:', error);
        } else {
          // Reload pending actions to reflect cleanup
          await loadPendingActions();
        }
      } catch (error) {
        console.error('Error in cleanupExpiredActions:', error);
      }
    };

    // Run cleanup when user logs in and every hour
    const runCleanup = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await cleanupExpiredActions();
        const interval = setInterval(cleanupExpiredActions, 60 * 60 * 1000); // 1 hour

        return () => clearInterval(interval);
      }
    };

    runCleanup();
  }, [loadPendingActions]);

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
    clearActionResult,
    loadConversations,
    loadConversation,
    createNewConversation,
    deleteConversation,
    approveAction,
    rejectAction,
    dismissSuggestion,
    loadSuggestions,
    loadPendingActions,
    showInputModal,
    hideInputModal,
    submitInput,
    redirectToProfile,
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
