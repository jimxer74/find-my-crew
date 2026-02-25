'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode, RefObject } from 'react';
import { AIConversation, AIMessage, AIPendingAction } from '@/app/lib/ai/assistant/types';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { logger } from '@shared/logging';

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
  profileSuggestions: string[] | null; // Profile-based suggested prompts
  suggestionsLoading: boolean; // Loading state for suggestions generation
  suggestionsGeneratedAt: number | null; // Timestamp for cache expiry
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
  loadPendingActions: () => Promise<void>;
  showInputModal: (action: AIPendingAction) => void;
  hideInputModal: () => void;
  submitInput: (actionId: string, value: string | string[]) => Promise<void>;
  redirectToProfile: (actionId: string, section: string, field: string) => void;
  generateProfileSuggestions: () => Promise<void>;
  pendingActionsCount: number;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

// Helper function to parse profile action and determine section/field
export function parseProfileAction(action: AIPendingAction) {
  logger.debug('Parsing action', { actionType: action.action_type }, true);
  logger.debug('Action object', { actionType: action.action_type }, true);

  // Use metadata from action if available
  if (action.profile_section && action.profile_field) {
    logger.debug('Using metadata from action', { section: action.profile_section, field: action.profile_field }, true);
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

  logger.debug('Looking up action type', { actionType: action.action_type }, true);
  const mapping = ACTION_TO_PROFILE_MAPPING[action.action_type];
  if (mapping) {
    logger.debug('Found mapping', {}, true);
    return mapping;
  }

  logger.debug('No mapping found, using fallback', {}, true);
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
    isLoading: false,
    error: null,
    errorDetails: null,
    lastFailedMessage: null,
    lastActionResult: null,
    activeInputModal: null,
    awaitingInputActions: [],
    profileSuggestions: null,
    suggestionsLoading: false,
    suggestionsGeneratedAt: null,
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
    setState(prev => ({
      ...prev,
      currentConversationId: id,
      messages: [],
      // Clear suggestions when switching conversations
      profileSuggestions: null,
      suggestionsGeneratedAt: null,
    }));
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/assistant/conversations');
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({ ...prev, conversations: data.conversations }));
      }
    } catch (error) {
      logger.error('Failed to load conversations', { error: error instanceof Error ? error.message : String(error) });
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
          // Clear suggestions when loading existing conversation
          profileSuggestions: null,
          suggestionsGeneratedAt: null,
        }));
      }
    } catch (error) {
      logger.error('Failed to load conversation', { error: error instanceof Error ? error.message : String(error) });
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const createNewConversation = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentConversationId: null,
      messages: [],
      // Clear suggestions when creating new conversation (will regenerate on next open)
      profileSuggestions: null,
      suggestionsGeneratedAt: null,
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
      logger.error('Failed to delete conversation', { error: error instanceof Error ? error.message : String(error) });
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
          // Clear suggestions once conversation starts
          profileSuggestions: null,
          suggestionsGeneratedAt: null,
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
    logger.debug('loadPendingActions called', {}, true);
    try {
      const response = await fetch('/api/ai/assistant/actions');
      logger.debug('API response status', { status: response.status }, true);

      if (response.ok) {
        const data = await response.json();
        logger.debug('Received data', {}, true);

        // Transform database fields to match frontend interface
        const transformedActions = data.actions.map((action: any) => ({
          ...action,
          action_payload: action.action_payload,
          input_prompt: action.input_prompt,
          input_type: action.input_type,
          input_options: action.input_options,
          profile_section: action.profile_section,
          profile_field: action.profile_field,
          ai_highlight_text: action.ai_highlight_text,
        }));

        logger.debug('Transformed actions', { count: transformedActions.length }, true);
        logger.debug('Transformed actions count', { count: transformedActions.length }, true);
        logger.debug('First transformed action', {}, true);
        logger.debug('Actions array type', { isArray: Array.isArray(transformedActions) }, true);
        setState(prev => {
          logger.debug('Setting state with actions', { count: transformedActions.length }, true);
          return { ...prev, pendingActions: transformedActions };
        });
      } else {
        logger.error('Failed to load pending actions', { status: response.status, statusText: response.statusText });
      }
    } catch (error) {
      logger.error('Exception in loadPendingActions', { error: error instanceof Error ? error.message : String(error) });
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
        logger.debug('Input submitted successfully', {}, true);

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

        logger.error('Submit input failed', { error: errorMessage });
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
      logger.error('Failed to submit input', { error: error instanceof Error ? error.message : String(error) });
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

  const redirectToProfile = useCallback(async (actionId: string, section: string, field: string) => {
    logger.debug('redirectToProfile called with parameters', { actionId, section, field }, true);
    logger.debug('redirectToProfile called for action', { actionId, section, field }, true);

    // Find the action to extract targetSkills
    const action = state.pendingActions.find(a => a.id === actionId);
    const targetSkills = action?.action_payload?.targetSkills;
    logger.debug('redirectToProfile - Found action', {}, true);
    logger.debug('redirectToProfile - Extracted targetSkills', { found: !!targetSkills }, true);
    
    // Navigate to profile with query params
    if (typeof window !== 'undefined') {
      // Build URL with all parameters including targetSkills
      let url = `/profile?section=${section}&field=${field}&aiActionId=${actionId}`;

      // Add targetSkills parameter if available
      if (targetSkills && Array.isArray(targetSkills) && targetSkills.length > 0) {
        const encodedTargetSkills = encodeURIComponent(JSON.stringify(targetSkills));
        url += `&targetSkills=${encodedTargetSkills}`;
        logger.debug('redirectToProfile - Added targetSkills to URL', {}, true);
      }

      logger.debug('redirectToProfile - Navigating to profile', {}, true);
      window.location.href = url;
    }

    // Optional: Show toast notification (if toast is available)
    logger.debug('Redirecting to profile to update field', { field }, true);
  }, [state.pendingActions]);

  const approveAction = useCallback(async (actionId: string, value?: string) => {
    /*
    const action = state.pendingActions.find(a => a.id === actionId);
    if (!action) {
      logger.error('Action not found', { actionId });
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
      logger.debug('Profile action detected', { actionType: action.action_type }, true);
      logger.debug('Action object for approval', {}, true);
      logger.debug('actionId parameter', { actionId }, true);
      const { section, field } = parseProfileAction(action);
      logger.debug('Parsed section/field', { section, field }, true);
      redirectToProfile(actionId, section, field);
      return;
    }

    // Special handling for suggest_profile_update_user_description action
    if (action.action_type === 'suggest_profile_update_user_description') {
      if (!value || !value.trim()) {
        logger.error('User description value is required for suggest_profile_update_user_description action', {});
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
          logger.debug('User description updated successfully', {}, true);

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

          logger.error('Update user description failed', { error: errorMessage });
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
        logger.error('Failed to update user description', { error: error instanceof Error ? error.message : String(error) });
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
        logger.debug('Action approved successfully', {}, true);

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

        logger.error('Approve action failed', { error: errorMessage });
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
      logger.error('Failed to approve action', { error: error instanceof Error ? error.message : String(error) });
      setState(prev => ({
        ...prev,
        lastActionResult: {
          success: false,
          message: 'Network error: Failed to approve action',
          actionId,
        },
      }));

      
    }
    */
  }, [state.pendingActions, showInputModal, loadPendingActions]);
    
  const rejectAction = useCallback(async (actionId: string) => {
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        logger.debug('Action rejected marked as read', {}, true);

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

        logger.error('Reject action failed', { error: errorMessage });
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
      logger.error('Failed to reject action', { error: error instanceof Error ? error.message : String(error) });
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

  // Suggestions functionality removed - only pending actions are used

  // Profile update action completion logic

  // Load pending actions when user is authenticated
  useEffect(() => {
    const loadActions = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await loadPendingActions();
      }
    };

    // Initial load
    loadActions();

    // Listen for auth state changes
    const supabase = getSupabaseBrowserClient();
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('Auth state change', { event, hasSession: !!session }, true);
      if (event === 'SIGNED_IN' && session) {
        logger.debug('User signed in, loading pending actions', {}, true);
        loadPendingActions();

        // Copy pending leg registration for assistant flow (e.g. if user lands on crew page).
        // Do NOT remove pending_leg_registration here – the prospect flow (welcome/crew) needs it
        // after consent to pass to trigger-profile-completion and profile save. ProspectChatContext
        // clears it after use (e.g. after registration is sent with approveAction).
        if (typeof window !== 'undefined') {
          const pendingLegStr = localStorage.getItem('pending_leg_registration');
          if (pendingLegStr) {
            try {
              const { legId, legName, timestamp } = JSON.parse(pendingLegStr);
              const isRecent = timestamp && (Date.now() - timestamp) < 30 * 60 * 1000;
              if (isRecent && legId) {
                logger.debug('Found pending leg registration', { legId, legName }, true);
                localStorage.setItem('pending_leg_registration_ready', JSON.stringify({ legId, legName }));
              }
            } catch (e) {
              logger.error('Failed to parse pending leg registration', { error: e instanceof Error ? e.message : String(e) });
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        logger.debug('User signed out, clearing pending actions', {}, true);
        setState(prev => ({ ...prev, pendingActions: [], awaitingInputActions: [] }));
      }
    });

    // Listen for real-time changes to pending actions
    const pendingActionsChannel = supabase
      .channel('ai_pending_actions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_pending_actions',
        },
        (payload) => {
          logger.debug('Real-time pending actions change detected', {}, true);
          // Reload pending actions to get the latest state
          loadPendingActions();
        }
      )
      .subscribe();

    // Cleanup listeners
    return () => {
      authListener?.unsubscribe();
      pendingActionsChannel?.unsubscribe();
    };
  }, [loadPendingActions]);

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
          .eq('status', 'pending')
          .lt('created_at', sevenDaysAgo.toISOString());

        if (error) {
          logger.error('Error cleaning up expired actions', { error: error instanceof Error ? error.message : String(error) });
        } else {
          // Reload pending actions to reflect cleanup
          await loadPendingActions();
        }
      } catch (error) {
        logger.error('Error in cleanupExpiredActions', { error: error instanceof Error ? error.message : String(error) });
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

    // Initial run and auth state listener
    let cleanupInterval: NodeJS.Timeout | null = null;

    const supabase = getSupabaseBrowserClient();
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug('Cleanup auth listener', { event, hasSession: !!session }, true);
      if (event === 'SIGNED_IN' && session) {
        logger.debug('User signed in, starting cleanup interval', {}, true);
        cleanupExpiredActions();
        cleanupInterval = setInterval(cleanupExpiredActions, 60 * 60 * 1000);
      } else if (event === 'SIGNED_OUT') {
        logger.debug('User signed out, clearing cleanup interval', {}, true);
        if (cleanupInterval) {
          clearInterval(cleanupInterval);
          cleanupInterval = null;
        }
      }
    });

    // Initial run
    runCleanup();

    // Cleanup
    return () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
      authListener?.unsubscribe();
    };
  }, [loadPendingActions]);

  // Generate profile-based suggestions (background, non-blocking)
  const generateProfileSuggestions = useCallback(async () => {
    // Check cache: don't regenerate if suggestions exist and are fresh (< 5 minutes)
    const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
    if (
      state.profileSuggestions &&
      state.suggestionsGeneratedAt &&
      Date.now() - state.suggestionsGeneratedAt < CACHE_DURATION_MS
    ) {
      logger.debug('Using cached profile suggestions', {}, true);
      return;
    }

    // Only generate if conversation is empty (new conversation)
    if (state.messages.length > 0) {
      logger.debug('Skipping suggestion generation - conversation has messages', {}, true);
      return;
    }

    setState((prev) => ({ ...prev, suggestionsLoading: true }));

    try {
      logger.debug('Generating profile suggestions', {}, true);
      const response = await fetch('/api/ai/assistant/generate-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to generate suggestions');
      }

      const data = await response.json();
      logger.debug('Profile suggestions generated', {
        count: data.suggestions?.length,
      }, true);

      setState((prev) => ({
        ...prev,
        profileSuggestions: data.suggestions || null,
        suggestionsGeneratedAt: data.generatedAt || Date.now(),
        suggestionsLoading: false,
      }));
    } catch (error: any) {
      logger.error('Failed to generate profile suggestions', { error: error instanceof Error ? error.message : String(error) });
      setState((prev) => ({
        ...prev,
        suggestionsLoading: false,
        // Don't set error - this is background operation, failures are silent
      }));
    }
  }, [state.profileSuggestions, state.suggestionsGeneratedAt, state.messages.length]);

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
    loadPendingActions,
    showInputModal,
    hideInputModal,
    submitInput,
    redirectToProfile,
    generateProfileSuggestions,
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
