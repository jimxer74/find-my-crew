'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@shared/logging';
import { useOwnerChat } from '@/app/contexts/OwnerChatContext';
import { OwnerMessage, PendingAction } from '@shared/ai/owner/types';
import { SignupModal } from '@/app/components/SignupModal';
import { LoginModal } from '@/app/components/LoginModal';
import CrewCarousel from '@/app/components/crew/CrewCarousel';
import { Button } from '@shared/ui/Button/Button';
import {
  extractSuggestedPrompts,
  removeSuggestionsFromContent,
} from '@shared/ai/shared';

/**
 * Component to display suggested prompts below assistant messages
 */
function SuggestedPrompts({
  prompts,
  importantIndex,
  onSelect,
  disabled = false,
}: {
  prompts: string[];
  importantIndex: number | null;
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
      <p className="text-xs text-muted-foreground mb-2 font-medium">Suggestions:</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, i) => {
          const isImportant = importantIndex !== null && i === importantIndex;
          return (
            <Button
              key={i}
              type="button"
              onClick={() => handleClick(prompt)}
              disabled={disabled}
              variant={isImportant ? 'primary' : 'outline'}
              size="sm"
              className={`!text-xs !px-2.5 !py-1 !rounded-full !inline-flex !gap-1 ${
                isImportant ? '!shadow-md !ring-2 !ring-primary/30' : '!border-primary/20 !bg-primary/10 hover:!bg-primary/20 !text-primary'
              }`}
              title={`Click to send: ${prompt}`}
            >
              <span className="text-left">{prompt}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Component to display pending action approval UI
 */
function PendingActionCard({
  action,
  onApprove,
  onCancel,
  disabled = false,
}: {
  action: PendingAction;
  onApprove: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-2">
          {action.label || `Approve ${action.toolName}?`}
        </p>
        <div className="flex gap-2">
          <Button
            onClick={onApprove}
            disabled={disabled}
            variant="primary"
            size="sm"
            className="!text-xs"
          >
            Approve
          </Button>
          <Button
            onClick={onCancel}
            disabled={disabled}
            variant="ghost"
            size="sm"
            className="!text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Component to display crew search results as a carousel
 */
function CrewSearchResults({
  toolResult,
  onCrewClick,
}: {
  toolResult: any;
  onCrewClick?: (crewId: string) => void;
}) {
  if (!toolResult || !toolResult.matches || toolResult.matches.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <CrewCarousel
        crewMembers={toolResult.matches}
        loading={false}
        onCrewClick={onCrewClick}
        title={toolResult.isAuthenticated ? "Matching Crew Members" : "Preview: Matching Crew Members"}
        subtitle={toolResult.note}
      />
    </div>
  );
}

/**
 * Component to display intermediate AI message as a collapsible, closed by default.
 * Hidden entirely when content is empty.
 */
function IntermediateMessageCard({
  message,
}: {
  message: OwnerMessage;
}) {
  const [open, setOpen] = useState(false);
  const content = message.content?.trim();
  if (!content) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        variant="ghost"
        className="!w-full !justify-between !text-left !p-0 !h-auto !px-3 !py-2 rounded-none"
      >
        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
          AI Reasoning
        </span>
        <span className="text-blue-500 dark:text-blue-400 text-xs leading-none">
          {open ? '▲' : '▼'}
        </span>
      </Button>
      {open && (
        <div className="px-3 pb-3 text-xs whitespace-pre-wrap break-words text-blue-900 dark:text-blue-100 border-t border-blue-200 dark:border-blue-800 pt-2">
          {content}
        </div>
      )}
    </div>
  );
}

export default function OwnerChat() {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearError,
    approveAction,
    cancelAction,
    isAuthenticated,
    userId,
    preferences,
    sessionEmail,
    hasSessionEmail,
    hasExistingProfile,
    hasBoat,
    hasJourney,
  } = useOwnerChat();

  const isFullyOnboarded = isAuthenticated && hasExistingProfile && hasBoat && hasJourney;

  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSuggestionSelect = (message: string) => {
    sendMessage(message);
  };

  const handleApproveAction = async (messageId: string, action: PendingAction) => {
    await approveAction(messageId, action);
  };

  const handleCancelAction = (messageId: string) => {
    cancelAction(messageId);
  };

  // Show login prompt if error indicates authentication is needed
  useEffect(() => {
    if (error && error.includes('Authentication required') && !isAuthenticated) {
      // Don't auto-open modals, just show the error
      // User can click signup/login buttons if needed
    }
  }, [error, isAuthenticated]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl lg:max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground py-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-primary"
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
                Welcome to Owner Onboarding
              </h3>
              <p className="text-sm max-w-sm mx-auto mb-4">
                I&apos;ll help you create your profile, add your boat, and plan your first journey. Let&apos;s get started!
              </p>
              {!isAuthenticated && (
                <div className="flex justify-center mt-4">
                  <Button
                    onClick={() => router.push('/')}
                    variant="primary"
                    size="sm"
                    className="!text-sm"
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
                        <path d="M3 12a9 9 0 1 1 18 0a9 9 0 0 1-18 0" />
                        <path d="M9 6.75L15 12l-6 5.25" />
                      </svg>
                    }
                  >
                    Go to Home Page
                  </Button>
                </div>
              )}
            </div>
          )}

          {messages
            .filter((message) => message.role !== 'system' && !message.metadata?.isSystem)
            .map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Intermediate message - render as subtle info box */}
                {message.metadata?.isIntermediate ? (
                  <div className="max-w-[85%]">
                    <IntermediateMessageCard message={message} />
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.role === 'assistant'
                        ? removeSuggestionsFromContent(message.content)
                        : message.content}
                    </div>
                    {/* Show suggested prompts from AI response - only for authenticated users */}
                    {message.role === 'assistant' && isAuthenticated && (() => {
                      const { prompts, importantIndex } = extractSuggestedPrompts(message.content);
                      return prompts.length > 0 ? (
                        <SuggestedPrompts
                          prompts={prompts}
                          importantIndex={importantIndex}
                          onSelect={handleSuggestionSelect}
                          disabled={isLoading}
                        />
                      ) : null;
                    })()}
                    {/* Show pending action approval UI */}
                    {message.role === 'assistant' && message.metadata?.pendingAction && (
                      <PendingActionCard
                        action={message.metadata.pendingAction}
                        onApprove={() => handleApproveAction(message.id, message.metadata!.pendingAction!)}
                        onCancel={() => handleCancelAction(message.id)}
                        disabled={isLoading}
                      />
                    )}
                    {/* Show crew search results if present */}
                    {message.role === 'assistant' && message.metadata?.toolResults && (() => {
                      // Find search_matching_crew tool result
                      const crewSearchResult = (message.metadata.toolResults as any[])?.find(
                        (tr: any) => tr.name === 'search_matching_crew'
                      );
                      return crewSearchResult?.result ? (
                        <CrewSearchResults
                          toolResult={crewSearchResult.result}
                          onCrewClick={(crewId) => {
                            // Could navigate to crew profile or show details
                            logger.debug('Crew clicked:', { crewId });
                          }}
                        />
                      ) : null;
                    })()}
                    {/* Show inline action button after assistant messages if user is not authenticated */}
                    {message.role === 'assistant' && !isAuthenticated && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        {hasSessionEmail ? (
                          <div className="flex flex-col items-start gap-2">
                            {sessionEmail && (
                              <p className="text-xs text-muted-foreground">
                                Continue with <span className="font-medium text-foreground">{sessionEmail}</span>
                              </p>
                            )}
                            <Button
                              onClick={() => setIsLoginModalOpen(true)}
                              variant="primary"
                              size="sm"
                              className="!text-sm"
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
                                  <path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                              }
                            >
                              Log In to Continue
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => setIsSignupModalOpen(true)}
                            variant="primary"
                            size="sm"
                            className="!text-sm"
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
                                <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                              </svg>
                            }
                          >
                            Sign up to continue
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Congrats / Welcome onboard - render as the last item in the chain */}
          {isFullyOnboarded && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-primary"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Welcome onboard!
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                You&apos;re all set. Please review your generated Journey, correct and update any details and publish it when you are ready. Please also review your Profile and Boat details and ensure they are correct before publishing.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  type="button"
                  onClick={() => router.push('/owner/boats')}
                  variant="primary"
                  size="sm"
                  className="!text-sm"
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
                      <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                  }
                >
                  View Boat Details
                </Button>
                <Button
                  type="button"
                  onClick={() => router.push('/owner/journeys')}
                  variant="outline"
                  size="sm"
                  className="!text-sm"
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
                      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  }
                >
                  View Journey Details
                </Button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
          <div className="max-w-2xl lg:max-w-4xl mx-auto flex items-center justify-between">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              onClick={clearError}
              variant="ghost"
              size="sm"
              className="!text-sm !text-destructive hover:!text-destructive/80 !underline"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Input area - hidden once onboarding is fully completed or user is not authenticated */}
      {!isFullyOnboarded && isAuthenticated && (
        <div className="border-t border-border bg-card p-4">
          <div className="max-w-2xl lg:max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={isLoading}
                rows={1}
                className="flex-1 min-h-[44px] max-h-[150px] px-4 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      <SignupModal
        key={`signup-${preferences?.fullName || 'no-name'}`}
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        onSwitchToLogin={() => {
          setIsSignupModalOpen(false);
          setIsLoginModalOpen(true);
        }}
        prospectPreferences={preferences as Record<string, unknown>}
        redirectPath="/welcome/owner?profile_completion=true"
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSwitchToSignup={() => {
          setIsLoginModalOpen(false);
          setIsSignupModalOpen(true);
        }}
      />
    </div>
  );
}
