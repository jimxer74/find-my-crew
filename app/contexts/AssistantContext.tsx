'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode, RefObject } from 'react';
import { AIConversation, AIMessage, AIPendingAction } from '@/app/lib/ai/assistant/types';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import type { AuthChangeEvent } from '@supabase/supabase-js';

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
  pendingActionsCount: number;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

// Helper function to parse profile action and determine section/field
export function parseProfileAction(action: AIPendingAction) {
  console.log('[parseProfileAction] 📊 Parsing action:', action.action_type);
  console.log('[parseProfileAction] 📊 Action object:', action);

  // Use metadata from action if available
  if (action.profile_section && action.profile_field) {
    console.log('[parseProfileAction] 📊 Using metadata from action:', { section: action.profile_section, field: action.profile_field });
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

  console.log('[parseProfileAction] 📊 Looking up action type:', action.action_type);
  const mapping = ACTION_TO_PROFILE_MAPPING[action.action_type];
  if (mapping) {
    console.log('[parseProfileAction] 📊 Found mapping:', mapping);
    return mapping;
  }

  console.log('[parseProfileAction] 📊 No mapping found, using fallback');
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
    console.log('[AssistantContext] 🔍 loadPendingActions called');
    try {
      const response = await fetch('/api/ai/assistant/actions');
      console.log('[AssistantContext] 📡 API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[AssistantContext] 📦 Received data:', data);

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

        console.log('[AssistantContext] ✅ Transformed actions:', transformedActions);
        console.log('[AssistantContext] 📊 Transformed actions count:', transformedActions.length);
        console.log('[AssistantContext] 📊 First transformed action:', transformedActions[0]);
        console.log('[AssistantContext] 📊 Actions array type:', Array.isArray(transformedActions));
        setState(prev => {
          console.log('[AssistantContext] 🔄 Setting state with actions:', transformedActions);
          return { ...prev, pendingActions: transformedActions };
        });
      } else {
        console.error('[AssistantContext] ❌ Failed to load pending actions:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[AssistantContext] 🚨 Exception in loadPendingActions:', error);
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

  const redirectToProfile = useCallback(async (actionId: string, section: string, field: string) => {
    console.log('[redirectToProfile] 📊 Called with parameters:', { actionId, section, field });
    console.log('redirectToProfile called for action:', actionId, 'section:', section, 'field:', field);

    // Find the action to extract targetSkills
    const action = state.pendingActions.find(a => a.id === actionId);
    const targetSkills = action?.action_payload?.targetSkills;
    console.log('[redirectToProfile] 📊 Found action:', action);
    console.log('[redirectToProfile] 📊 Extracted targetSkills:', targetSkills);
    
    // Navigate to profile with query params
    if (typeof window !== 'undefined') {
      // Build URL with all parameters including targetSkills
      let url = `/profile?section=${section}&field=${field}&aiActionId=${actionId}`;

      // Add targetSkills parameter if available
      if (targetSkills && Array.isArray(targetSkills) && targetSkills.length > 0) {
        const encodedTargetSkills = encodeURIComponent(JSON.stringify(targetSkills));
        url += `&targetSkills=${encodedTargetSkills}`;
        console.log('[redirectToProfile] 📊 Added targetSkills to URL:', encodedTargetSkills);
      }

      console.log(`[redirectToProfile] 📊 Navigating to profile: ${url}`);
      window.location.href = url;
    }

    // Optional: Show toast notification (if toast is available)
    console.log(`Redirecting to profile to update ${field}`);
  }, [state.pendingActions]);

  const approveAction = useCallback(async (actionId: string, value?: string) => {
    /*
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
      console.log('[approveAction] 📊 Profile action detected:', action.action_type);
      console.log('[approveAction] 📊 Action object:', action);
      console.log('[approveAction] 📊 actionId parameter:', actionId);
      const { section, field } = parseProfileAction(action);
      console.log('[approveAction] 📊 Parsed section/field:', { section, field });
      redirectToProfile(actionId, section, field);
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
    */
  }, [state.pendingActions, showInputModal, loadPendingActions]);
    
  const rejectAction = useCallback(async (actionId: string) => {
    try {
      const response = await fetch(`/api/ai/assistant/actions/${actionId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Action rejected marked as read:', data);

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
      console.log('[AssistantContext] 📊 Auth state change:', event, 'session:', !!session);
      if (event === 'SIGNED_IN' && session) {
        console.log('[AssistantContext] 📊 User signed in, loading pending actions');
        loadPendingActions();

        // Check for pending leg registration from prospect signup flow
        if (typeof window !== 'undefined') {
          const pendingLegStr = localStorage.getItem('pending_leg_registration');
          if (pendingLegStr) {
            try {
              const { legId, legName, timestamp } = JSON.parse(pendingLegStr);
              // Only process if the pending registration is less than 30 minutes old
              const isRecent = timestamp && (Date.now() - timestamp) < 30 * 60 * 1000;

              if (isRecent && legId) {
                console.log('[AssistantContext] 📊 Found pending leg registration:', { legId, legName });
                // Clear the pending registration from storage
                localStorage.removeItem('pending_leg_registration');
                // Store the leg info to trigger registration after redirect completes
                // The AssistantChat component will detect this after the page loads
                localStorage.setItem('pending_leg_registration_ready', JSON.stringify({ legId, legName }));
                // Don't open assistant here - let the redirect complete first
                // The crew page will handle opening the assistant
              } else {
                // Expired or invalid, clean up
                localStorage.removeItem('pending_leg_registration');
              }
            } catch (e) {
              console.error('[AssistantContext] Failed to parse pending leg registration:', e);
              localStorage.removeItem('pending_leg_registration');
            }
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[AssistantContext] 📊 User signed out, clearing pending actions');
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
          console.log('[AssistantContext] 📊 Real-time pending actions change detected:', payload);
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

    // Initial run and auth state listener
    let cleanupInterval: NodeJS.Timeout | null = null;

    const supabase = getSupabaseBrowserClient();
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AssistantContext] 📊 Cleanup auth listener:', event, 'session:', !!session);
      if (event === 'SIGNED_IN' && session) {
        console.log('[AssistantContext] 📊 User signed in, starting cleanup interval');
        cleanupExpiredActions();
        cleanupInterval = setInterval(cleanupExpiredActions, 60 * 60 * 1000);
      } else if (event === 'SIGNED_OUT') {
        console.log('[AssistantContext] 📊 User signed out, clearing cleanup interval');
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
