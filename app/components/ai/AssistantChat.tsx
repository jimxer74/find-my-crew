'use client';

import { logger } from '@/app/lib/logger';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAssistant } from '@/app/contexts/AssistantContext';
import { useUserRoles } from '@/app/contexts/UserRoleContext';
import { ActionFeedback } from './ActionFeedback';
import { TextInputModal } from './TextInputModal';
import { MultiSelectInputModal } from './MultiSelectInputModal';
import { ChatLegCarousel } from './ChatLegCarousel';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { LegRegistrationDialog } from '@/app/components/crew/LegRegistrationDialog';
import { Button } from '@/app/components/ui/Button/Button';
import {
  extractSuggestedPrompts,
  removeSuggestionsFromContent,
} from '@/app/lib/ai/shared';

/**
 * Component to display suggested prompts below assistant messages
 */
function SuggestedPrompts({
  prompts,
  onSelect,
  disabled = false,
}: {
  prompts: string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (prompts.length === 0) return null;

  const handleClick = (prompt: string) => {
    if (!disabled) {
      onSelect(prompt);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <p className="text-xs text-muted-foreground mb-2 font-medium">Try asking:</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, i) => (
          <Button
            key={i}
            type="button"
            onClick={() => handleClick(prompt)}
            variant="outline"
            disabled={disabled}
            className="!bg-primary/10 !border-primary/20 !text-primary !text-sm"
            title={`Click to send: ${prompt}`}
            leftIcon={
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            }
          >
            <span className="text-left">{prompt}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Parse message content and render inline references as clickable elements.
 * Format: [[leg:UUID:Name]] -> clickable link to /crew/dashboard?legId=UUID
 * Format: [[register:UUID:Name]] -> badge link to open registration form
 * Format: [[close_chat:PATH:Label]] -> button to close chat and redirect
 */
function renderMessageWithLegLinks(
  content: string,
  onLegClick: (legId: string) => void,
  onRegisterClick: (legId: string) => void,
  onCloseAndRedirect?: (path: string) => void,
  hideLegBadgesOnMobile?: boolean
): React.ReactNode {
  // Combined regex to match leg, register, and close_chat patterns
  const refRegex = /\[\[(leg|register|close_chat):([^:\]]+):([^\]]+)\]\]/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = refRegex.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const type = match[1].toLowerCase(); // 'leg' or 'register'
    const legId = match[2];
    const legName = match[3];

    if (type === 'close_chat') {
      // Close chat and redirect button
      const path = legId; // In this case, legId contains the path
      const label = legName; // And legName contains the button label
      parts.push(
        <Button
          key={`close-${keyIndex++}`}
          onClick={() => onCloseAndRedirect?.(path)}
          variant="primary"
          className="mt-3 w-full !text-white !shadow-sm"
          title={label}
          leftIcon={
            <svg
              className="w-4 h-4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          }
        >
          {label}
        </Button>
      );
    } else if (type === 'register') {
      // Registration questions badge
      parts.push(
        <Button
          key={`register-${keyIndex++}`}
          onClick={() => onRegisterClick(legId)}
          variant="outline"
          className="inline-flex items-center gap-1 !px-2 !py-0.5 !text-emerald-700 dark:!text-emerald-300 !bg-emerald-100 dark:!bg-emerald-900/40 !border-emerald-200 dark:!border-emerald-800 !text-sm"
          title={`Register for ${legName}`}
          leftIcon={
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        >
          Register: {legName}
        </Button>
      );
    } else {
      // Regular leg link - hide on mobile if hideLegBadgesOnMobile is true
      parts.push(
        <Button
          key={`leg-${keyIndex++}`}
          onClick={() => onLegClick(legId)}
          variant="outline"
          className={`inline-flex items-center gap-1 !px-2 !py-0.5 !text-blue-200 dark:!text-blue-300 !bg-blue-800 dark:!bg-blue-500/40 !border-blue-600 dark:!border-blue-700 !text-sm cursor-pointer ${hideLegBadgesOnMobile ? 'hidden md:inline-flex' : ''}`}
          title={`View ${legName}`}
          leftIcon={
            <svg
              className="w-3 h-3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        >
          {legName}
        </Button>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  // If no matches found, return original content
  if (parts.length === 0) {
    return content;
  }

  return parts;
}
/**
 * 
 * @returns Context aware suggestions for the assistant
 */
function getContextAwareSuggestions(userRoles: string[] | null, sendMessage: (message: string) => void, t: any): React.ReactNode[] {
  logger.debug("AssistantChat roles:", { userRoles });

  if(!userRoles) {
    return [];
  }

  if(userRoles.includes('crew')) {
      return ([<Button key="findMatchingJourneys"
        onClick={() => sendMessage("Show me sailing opportunities that match my profile")}
        variant="outline"
        className="!bg-primary/10 !border-primary/20 !text-primary !text-sm !px-3 !py-1.5 rounded-full"
      >
        {t('findMatchingJourneys')}
      </Button>, <Button key="findByDepartureLocation"
        onClick={() => sendMessage("I would like to find sailing trips departing from:")}
        variant="outline"
        className="!bg-primary/10 !border-primary/20 !text-primary !text-sm !px-3 !py-1.5 rounded-full"
      >
        {t('findByDepartureLocation')}
      </Button>])
    } else if(userRoles.includes('owner')) {
      return ([<Button key="createJourney"
        onClick={() => sendMessage("Create a new journey")}
        variant="outline"
        className="!bg-primary/10 !border-primary/20 !text-primary !text-sm !px-3 !py-1.5 rounded-full"
      >
        {t('createJourney')}
      </Button>, <Button key="addBoat"
        onClick={() => sendMessage("Add a new boat")}
        variant="outline"
        className="!bg-primary/10 !border-primary/20 !text-primary !text-sm !px-3 !py-1.5 rounded-full"
      >
        {t('addBoat')}
      </Button>])
  }
  return [];
}

export function AssistantChat() {
  const t = useTranslations('assistant');
  const router = useRouter();
  const { userRoles } = useUserRoles();

  const {
    isOpen,
    messages,
    pendingActions,
    isLoading,
    error,
    errorDetails,
    lastActionResult,
    activeInputModal,
    clearError,
    clearActionResult,
    sendMessage,
    retryLastMessage,
    approveAction,
    rejectAction,
    hideInputModal,
    submitInput,
    openAssistant,
    closeAssistant,
    redirectToProfile,
    profileSuggestions,
    suggestionsLoading,
    generateProfileSuggestions,
  } = useAssistant();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);

  // Mobile detection
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Bottom sheet state for mobile
  const [bottomSheetHeight, setBottomSheetHeight] = useState(200); // Default height in px
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Auto-dismiss action result after 5 seconds
  useEffect(() => {
    if (lastActionResult) {
      const timer = setTimeout(() => {
        clearActionResult();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastActionResult, clearActionResult]);

  // Check for pending leg registration from prospect signup flow
  // This effect runs on mount to detect pending registration after redirect
  useEffect(() => {
    const checkPendingRegistration = () => {
      if (typeof window === 'undefined') return;

      const pendingLegStr = localStorage.getItem('pending_leg_registration_ready');
      if (pendingLegStr) {
        try {
          const { legId, legName } = JSON.parse(pendingLegStr);
          logger.info('[AssistantChat] Found pending leg registration:', { legId, legName });

          // If assistant is not open, open it first
          if (!isOpen) {
            logger.info('[AssistantChat] Opening assistant for pending registration');
            openAssistant();
            // The effect will re-run when isOpen changes to true
            return;
          }

          // Assistant is open, clear the flag and send the message
          localStorage.removeItem('pending_leg_registration_ready');
          logger.info('[AssistantChat] Sending registration message');
          const registrationMessage = legName
            ? `I want to register for the sailing leg "${legName}". The leg ID is ${legId}.`
            : `I want to register for a sailing leg. The leg ID is ${legId}.`;
          sendMessage(registrationMessage);
        } catch (e) {
          logger.error('[AssistantChat] Failed to process pending leg registration:', e instanceof Error ? { error: e.message } : { error: String(e) });
          localStorage.removeItem('pending_leg_registration_ready');
        }
      }
    };

    // Small delay to ensure component is fully mounted and auth redirect completed
    const timer = setTimeout(checkPendingRegistration, 500);
    return () => clearTimeout(timer);
  }, [isOpen, sendMessage, openAssistant]);

  // Drag handlers for mobile bottom sheet
  const handleDragStart = (clientY: number) => {
    if (!isMobile) return;
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = bottomSheetHeight;
  };

  const handleDragMove = (clientY: number) => {
    if (!isMobile || !isDragging) return;
    const deltaY = clientY - dragStartY.current;
    const newHeight = Math.max(120, Math.min(400, dragStartHeight.current - deltaY));
    setBottomSheetHeight(newHeight);
  };

  const handleDragEnd = () => {
    if (!isMobile) return;
    setIsDragging(false);
  };

  // Add global mouse/touch event listeners for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientY);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchEnd = () => handleDragEnd();

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, isMobile]);

  // Handle clicking on a leg reference - navigate to dashboard with the legId
  // Navigate in same window so the assistant pane stays accessible
  const handleLegClick = (legId: string) => {
    router.push(`/crew/dashboard?legId=${legId}&from=assistant`);
  };

  // Handle clicking on a register reference - open registration dialog
  const handleRegisterClick = (legId: string, _legName?: string) => {
    setSelectedLegId(legId);
    setRegistrationDialogOpen(true);
  };

  // Handle close chat and redirect - close assistant panel and navigate to specified path
  const handleCloseAndRedirect = (path: string) => {
    closeAssistant();
    router.push(path);
  };

  // Trigger profile suggestion generation when assistant opens and conversation is empty
  useEffect(() => {
    if (isOpen && messages.length === 0 && !suggestionsLoading) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        generateProfileSuggestions();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages.length, suggestionsLoading, generateProfileSuggestions]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = inputValue.trim();
    if (!message || isLoading) return;

    setInputValue('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Get pending actions for current conversation - only count those that require immediate input
  const relevantPendingActions = pendingActions.filter(
    a => a.status === 'pending' && a.awaiting_user_input === true
  );


  return (
    <div className="flex flex-col h-full">
      {/* Only render assistant content when open */}
      {isOpen && (
        <>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t('greeting')}
            </h3>
            <p className="text-sm max-w-xs mx-auto">
              {userRoles?.includes('owner') ? t('greetingMessageOwner') : t('greetingMessageCrew')}
            </p>
            {/* Show profile-based suggestions if available, otherwise fallback to context-aware */}
            {profileSuggestions && profileSuggestions.length > 0 ? (
              <div className="mt-4">
                <SuggestedPrompts
                  prompts={profileSuggestions}
                  onSelect={sendMessage}
                  disabled={isLoading}
                />
              </div>
            ) : suggestionsLoading ? (
              <div className="mt-4 flex justify-center">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {getContextAwareSuggestions(userRoles, sendMessage, t)}
              </div>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.role === 'assistant'
                  ? renderMessageWithLegLinks(
                      removeSuggestionsFromContent(message.content),
                      handleLegClick,
                      handleRegisterClick,
                      handleCloseAndRedirect,
                      // Hide leg badges on mobile when legReferences exist (carousel will show instead)
                      isMobile && message.metadata?.legReferences && message.metadata.legReferences.length > 0
                    )
                  : message.content}
              </div>
              {/* Show suggested prompts from AI response */}
              {message.role === 'assistant' && (() => {
                const { prompts } = extractSuggestedPrompts(message.content);
                return prompts.length > 0 ? (
                  <SuggestedPrompts
                    prompts={prompts}
                    onSelect={(prompt) => sendMessage(prompt)}
                    disabled={isLoading}
                  />
                ) : null;
              })()}
              {message.role === 'assistant' && message.metadata?.toolCalls && (
                <div className="mt-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
                  {t('used')} {message.metadata.toolCalls.map(tc => tc.name).join(', ')}
                </div>
              )}
              {/* Show leg references as carousel - Mobile only */}
              {message.role === 'assistant' &&
               message.metadata?.legReferences &&
               message.metadata.legReferences.length > 0 &&
               isMobile && (
                <div className="mt-3 -mx-2 md:hidden">
                  <ChatLegCarousel
                    legs={message.metadata.legReferences}
                    onLegClick={handleLegClick}
                    onJoinClick={handleRegisterClick}
                    compact={true}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-muted-foreground">{t('thinking')}</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            <div className="flex items-start gap-3">
              {/* Error icon */}
              <div className="flex-shrink-0 mt-0.5">
                {errorDetails?.type === 'network_error' ? (
                  <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                  </svg>
                ) : errorDetails?.type === 'rate_limit' ? (
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : errorDetails?.type === 'timeout' ? (
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>

              {/* Error content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-destructive font-medium">
                  {errorDetails?.type === 'rate_limit' ? 'Service Busy' :
                   errorDetails?.type === 'timeout' ? 'Request Timeout' :
                   errorDetails?.type === 'network_error' ? 'Connection Error' :
                   errorDetails?.type === 'service_unavailable' ? 'Service Unavailable' :
                   'Something Went Wrong'}
                </p>
                <p className="text-sm text-destructive/80 mt-1">
                  {error}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3">
                  {errorDetails?.canRetry && (
                    <Button
                      onClick={() => retryLastMessage()}
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      className="!bg-primary/10 !border-primary/20 !text-primary"
                      leftIcon={
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      }
                    >
                      Try Again
                    </Button>
                  )}
                  <Button
                    onClick={() => clearError()}
                    variant="ghost"
                    size="sm"
                    className="!text-muted-foreground !hover:text-foreground"
                  >
                    Dismiss
                  </Button>
                </div>

                {/* Retry timer hint for rate limits */}
                {errorDetails?.type === 'rate_limit' && errorDetails?.retryAfter && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Please wait {errorDetails.retryAfter} seconds before trying again.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area - Hide when pending actions exist */}
      {relevantPendingActions.length === 0 && (
        <div className="border-t border-border p-4 bg-card">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('placeholder')}
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none px-3 py-2 text-sm border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 min-h-[44px] max-h-[150px]"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={!inputValue.trim() || isLoading}
              className="!p-2 !min-h-[44px]"
              leftIcon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
            >
              {' '}
            </Button>
          </form>
        </div>
      )}

      {/* Action feedback */}
      <ActionFeedback
        result={lastActionResult}
        onDismiss={clearActionResult}
      />

      {/* Input Modals */}
      {activeInputModal && (
        <>
          {activeInputModal.type === 'text' && (
            <TextInputModal
              action={activeInputModal.action}
              onSubmit={(value) => submitInput(activeInputModal.actionId, value)}
              onCancel={hideInputModal}
            />
          )}
          {activeInputModal.type === 'text_array' && (
            <MultiSelectInputModal
              action={activeInputModal.action}
              onSubmit={(value) => submitInput(activeInputModal.actionId, value)}
              onCancel={hideInputModal}
            />
          )}
          {activeInputModal.type === 'select' && (
            <MultiSelectInputModal
              action={activeInputModal.action}
              onSubmit={(value) => submitInput(activeInputModal.actionId, value)}
              onCancel={hideInputModal}
            />
          )}
        </>
      )}
        </>
      )}

      {/* Registration Dialog */}
      <LegRegistrationDialog
        isOpen={registrationDialogOpen}
        onClose={() => {
          setRegistrationDialogOpen(false);
          setSelectedLegId(null);
        }}
        legId={selectedLegId}
        onSuccess={() => {
          // Registration successful
          logger.info('Registration successful!');
        }}
      />
    </div>
  );
}
