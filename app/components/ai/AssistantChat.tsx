'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAssistant } from '@/app/contexts/AssistantContext';
import { ActionConfirmation } from './ActionConfirmation';
import { useUserRoles } from '@/app/contexts/UserRoleContext';
import { ActionFeedback } from './ActionFeedback';
import { TextInputModal } from './TextInputModal';
import { MultiSelectInputModal } from './MultiSelectInputModal';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';




/**
 * Parse message content and render inline leg references as clickable links.
 * Format: [[leg:UUID:Name]] -> clickable link to /crew/dashboard?legId=UUID
 * Format: [[register:UUID:Name]] -> badge link to open registration form
 */
function renderMessageWithLegLinks(
  content: string,
  onLegClick: (legId: string) => void,
  onRegisterClick: (legId: string) => void
): React.ReactNode {
  // Combined regex to match both [[leg:UUID:Name]] and [[register:UUID:Name]] patterns
  const refRegex = /\[\[(leg|register):([a-f0-9-]+):([^\]]+)\]\]/gi;

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

    if (type === 'register') {
      // Registration questions badge
      parts.push(
        <button
          key={`register-${keyIndex++}`}
          onClick={() => onRegisterClick(legId)}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded-full transition-colors font-medium text-sm"
          title={`Register for ${legName}`}
        >
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
          Register: {legName}
        </button>
      );
    } else {
      // Regular leg link
      parts.push(
        <button
          key={`leg-${keyIndex++}`}
          onClick={() => onLegClick(legId)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-primary bg-primary/10 hover:bg-primary/20 rounded transition-colors font-medium"
          title={`View ${legName}`}
        >
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
          {legName}
        </button>
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
  console.log("AssistantChat roles:", userRoles);

  if(!userRoles) {
    return [];
  }

  if(userRoles.includes('crew')) {
      return ([<button key="findMatchingJourneys"
        onClick={() => sendMessage("Show me sailing opportunities that match my profile")}
        className="px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
      >
        {t('findMatchingJourneys')}
      </button>, <button key="findByDepartureLocation"
        onClick={() => sendMessage("I would like to find sailing trips departing from:")}
        className="px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
      >
        {t('findByDepartureLocation')}
      </button>])
    } else if(userRoles.includes('owner')) {
      return ([<button key="createJourney"
        onClick={() => sendMessage("Create a new journey")}
        className="px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
      >
        {t('createJourney')}
      </button>, <button key="addBoat"
        onClick={() => sendMessage("Add a new boat")}
        className="px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
      >
        {t('addBoat')}
      </button>])
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
    closeAssistant, // ✅ Added closeAssistant
    redirectToProfile,
  } = useAssistant();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  const handleLegClick = (legId: string) => {
    // Use router.push with full page refresh to ensure the new legId is processed
    window.location.href = `/crew/dashboard?legId=${legId}`;
  };

  // Handle clicking on a register reference - navigate to dashboard and open registration form
  const handleRegisterClick = (legId: string) => {
    window.location.href = `/crew/dashboard?legId=${legId}&register=true`;
  };

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

  // Get pending actions for current conversation
  const relevantPendingActions = pendingActions.filter(
    a => a.status === 'pending'
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
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {getContextAwareSuggestions(userRoles, sendMessage, t)}
            </div>
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
                  ? renderMessageWithLegLinks(message.content, handleLegClick, handleRegisterClick)
                  : message.content}
              </div>
              {message.role === 'assistant' && message.metadata?.toolCalls && (
                <div className="mt-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
                  {t('used')} {message.metadata.toolCalls.map(tc => tc.name).join(', ')}
                </div>
              )}
              {/* Fallback: Show leg references at bottom if AI didn't use inline format */}
              {message.role === 'assistant' &&
               message.metadata?.legReferences &&
               message.metadata.legReferences.length > 0 &&
               !message.content.includes('[[leg:') && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                  {message.metadata.legReferences.map((leg) => (
                    <button
                      key={leg.id}
                      onClick={() => handleLegClick(leg.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
                    >
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
                      {leg.name}
                    </button>
                  ))}
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
                    <button
                      onClick={() => retryLastMessage()}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Try Again
                    </button>
                  )}
                  <button
                    onClick={() => clearError()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  >
                    Dismiss
                  </button>
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

      {/* Pending actions (Desktop) */}
      {!isMobile && relevantPendingActions.length > 0 && (
        <div className="border-t border-border p-4 space-y-2 max-h-48 overflow-y-auto bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('pendingActions')}
          </p>
          {relevantPendingActions.map((action) => (
            <ActionConfirmation
              key={action.id}
              action={action}
              onApprove={() => approveAction(action.id)}
              onReject={() => rejectAction(action.id)}
              onRedirectToProfile={(action) => {
                // For profile update actions, use the proper redirect method
                redirectToProfile(action);
              }}
            />
          ))}
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {isMobile && isOpen && relevantPendingActions.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50"
          style={{ height: `${bottomSheetHeight}px` }}
        >
          {/* Drag Handle */}
          <div
            className="flex justify-center py-2 cursor-ns-resize hover:bg-muted/50 transition-colors"
            onMouseDown={(e) => handleDragStart(e.clientY)}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          >
            <div className="w-12 h-1 bg-border rounded-full" />
          </div>

          {/* Content */}
          <div className="p-4 space-y-2 max-h-[calc(100%-60px)] overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('pendingActions')}
            </p>
            {relevantPendingActions.map((action) => (
              <ActionConfirmation
                key={action.id}
                action={action}
                onApprove={() => approveAction(action.id)}
                onReject={() => rejectAction(action.id)}
                onRedirectToProfile={(action) => {
                  // For profile update actions, use the proper redirect method
                  redirectToProfile(action);
                }}
              />
            ))}
          </div>
        </div>
      )}

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
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
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
            </button>
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
    </div>
  );
}
