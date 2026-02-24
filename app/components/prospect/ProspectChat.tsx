'use client';

import { logger } from '@/app/lib/logger';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useProspectChat } from '@/app/contexts/ProspectChatContext';
import { ProspectMessage, PendingAction, ProspectLegReference } from '@/app/lib/ai/prospect/types';
import { ChatLegCarousel } from '@/app/components/ai/ChatLegCarousel';
import { SignupModal } from '@/app/components/SignupModal';
import { LoginModal } from '@/app/components/LoginModal';
import { LegRegistrationDialog } from '@/app/components/crew/LegRegistrationDialog';
import { ProfileExtractionModal } from './ProfileExtractionModal';
import {
  extractSuggestedPrompts,
  removeSuggestionsFromContent,
  suggestsSignupOrProfileCreation,
} from '@/app/lib/ai/shared';

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
            <button
              key={i}
              type="button"
              onClick={() => handleClick(prompt)}
              disabled={disabled}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-all border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isImportant
                  ? 'text-white bg-primary hover:bg-primary/90 border-primary shadow-md ring-2 ring-primary/30'
                  : 'text-primary bg-primary/10 hover:bg-primary/20 border-primary/20 disabled:hover:bg-primary/10'
              }`}
              title={`Click to send: ${prompt}`}
            >
              <span className="text-left">{prompt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Parse message content and render inline leg references as clickable links.
 * Format: [[leg:UUID:Name]] -> clickable link
 */
function renderMessageWithLegLinks(
  content: string,
  onLegClick: (legId: string, legName: string) => void
): React.ReactNode {
  const refRegex = /\[\[leg:([a-f0-9-]+):([^\]]+)\]\]/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = refRegex.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const legId = match[1];
    const legName = match[2];

    parts.push(
      <button
        key={`leg-${keyIndex++}`}
        onClick={() => onLegClick(legId, legName)}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-full transition-colors font-medium text-sm"
        title={`View ${legName}`}
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
          <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {legName}
      </button>
    );

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

export function ProspectChat() {
  const t = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    messages,
    preferences,
    isLoading,
    error,
    isReturningUser,
    isAuthenticated,
    hasSessionEmail,
    sessionEmail,
    hasExistingProfile,
    userMessageCountAfterSignup,
    sendMessage,
    clearError,
    clearSession,
    addViewedLeg,
    approveAction,
    cancelAction,
    updateOnboardingState,
  } = useProspectChat();

  // Note: profile_completion query parameter is deprecated - we determine state from hasExistingProfile and isAuthenticated

  const [inputValue, setInputValue] = useState('');
  const [showAuthForm, setShowAuthForm] = useState<'signup' | 'login' | null>(null);
  const [isNavigatingToCrew, setIsNavigatingToCrew] = useState(false);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [showProfileExtractionModal, setShowProfileExtractionModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isCrewOnboarded = isAuthenticated && hasExistingProfile;

  // Collect all unique leg references from assistant messages for the completion card.
  const completionLegReferences = useMemo(() => {
    const seen = new Set<string>();
    const collected: ProspectLegReference[] = [];

    messages
      .filter((m) => m.role === 'assistant')
      .forEach((m) => {
        m.metadata?.legReferences?.forEach((leg) => {
          if (leg?.id && !seen.has(leg.id)) {
            seen.add(leg.id);
            collected.push(leg);
          }
        });
      });

    return collected;
  }, [messages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    logger.debug('[ProspectChat] Messages changed', {
      total: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      messageIds: messages.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 50) }))
    });
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for fallback trigger events (from errors)
  useEffect(() => {
    const handleFallbackTrigger = () => {
      if (isAuthenticated && !hasExistingProfile) {
        logger.debug('[ProspectChat] 🔄 Fallback triggered - opening profile extraction modal');
        setShowProfileExtractionModal(true);
      }
    };

    window.addEventListener('triggerProfileExtractionFallback', handleFallbackTrigger);
    return () => {
      window.removeEventListener('triggerProfileExtractionFallback', handleFallbackTrigger);
    };
  }, [isAuthenticated, hasExistingProfile]);

  // Debug: Log authentication and profile state
  useEffect(() => {
    const shouldShowHeaderButton = messages.length > 0 && hasExistingProfile && isAuthenticated;
    const shouldShowWelcomeButton = messages.length === 0 && hasExistingProfile && isAuthenticated;
    const shouldShowBottomButton = hasExistingProfile && isAuthenticated;
    
    logger.debug('[ProspectChat] 🔍 DEBUG - Button Visibility Check:', {
      isAuthenticated,
      hasExistingProfile,
      messagesLength: messages.length,
      userMessageCountAfterSignup,
      'Header button (when messages > 0)': shouldShowHeaderButton,
      'Welcome button (when messages === 0)': shouldShowWelcomeButton,
      'Bottom button': shouldShowBottomButton,
      'All conditions met': hasExistingProfile && isAuthenticated,
      'Fallback badge should show': isAuthenticated && !hasExistingProfile && userMessageCountAfterSignup >= 1,
    });
  }, [isAuthenticated, hasExistingProfile, messages.length, userMessageCountAfterSignup]);

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

  const handleLegClick = (legId: string, legName: string) => {
    addViewedLeg(legId);
    const url = `/crew/dashboard?legId=${legId}`;
    // Check screen width directly to ensure accurate detection at click time
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileScreen) {
      // Mobile: navigate in same window with from=prospect param for back button
      window.location.href = `${url}&from=prospect`;
    } else {
      // Desktop: open in new tab using programmatic anchor click
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  };

  const handleSuggestionSelect = (message: string) => {
    sendMessage(message);
  };

  // Open registration dialog (only shown when signed up + profile created)
  const handleJoinClick = (legId: string, _legName: string) => {
    setSelectedLegId(legId);
    setRegistrationDialogOpen(true);
  };

  // Clear prospect chat/session and go to crew homepage (after profile created)
  const handleViewJourneys = async () => {
    setIsNavigatingToCrew(true);
    try {
      await clearSession();
      router.push('/crew');
    } catch (e) {
      logger.error('Failed to clear session:', e instanceof Error ? { error: e.message } : { error: String(e) });
      setIsNavigatingToCrew(false);
    }
  };


  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl lg:max-w-4xl mx-auto space-y-4">
        {messages.length === 0 && !isLoading && !isCrewOnboarded && (
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
              {isReturningUser ? 'Welcome back, crew!' : 'Find Your Perfect Sailing Adventure'}
            </h3>
            <p className="text-sm max-w-sm mx-auto mb-4">
              {isReturningUser
                ? "Ready to continue exploring? Let's pick up where we left off."
                : "Tell me about your sailing goals and I'll help you find matching opportunities."}
            </p>
            {/* For unauthenticated users, show sign-up/login instructions and buttons */}
            {!isAuthenticated && (
              <div className="space-y-4">
                <p className="text-xs max-w-sm mx-auto text-muted-foreground">
                  Please sign up or log in to start chatting with the AI assistant and explore sailing opportunities.
                </p>
              <div className="mt-4 flex justify-center gap-2">
                {hasSessionEmail ? (
                  <button
                    onClick={() => setShowAuthForm('login')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity shadow-sm"
                  >
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
                    Log In
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAuthForm('signup')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity shadow-sm"
                  >
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
                    Sign Up
                  </button>
                )}
                {hasSessionEmail && (
                  <button
                    onClick={() => setShowAuthForm('signup')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted rounded-lg transition-colors"
                  >
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
                    Create New Account
                  </button>
                )}
              </div>
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
                      handleLegClick
                    )
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
              {/* Show leg carousel if leg references are available */}
              {/* Exclude congratulations message - completion card now owns this display */}
              {message.role === 'assistant' &&
               message.metadata?.legReferences &&
               message.metadata.legReferences.length > 0 &&
               !(message.content.includes('Congratulations! Welcome to SailSmart!') || 
                 message.metadata?.toolCalls?.some(tc => tc.name === 'update_user_profile')) && (
                <div className="mt-3 -mx-2">
                  <ChatLegCarousel
                    legs={message.metadata.legReferences}
                    onLegClick={(legId) => handleLegClick(legId, '')}
                    onJoinClick={isAuthenticated && hasExistingProfile ? handleJoinClick : undefined}
                    compact={true}
                  />
                </div>
              )}
              {/* Show inline action button after assistant messages if user is not authenticated and doesn't have a profile */}
              {/* Don't show if user is authenticated or has existing profile */}
              {message.role === 'assistant' && !isAuthenticated &&
                (
                <div className="mt-3 pt-3 border-t border-border/50">
                  {hasSessionEmail ? (
                    <div className="flex flex-col items-start gap-2">
                      {sessionEmail && (
                        <p className="text-xs text-muted-foreground">
                          Continue with <span className="font-medium text-foreground">{sessionEmail}</span>
                        </p>
                      )}
                      <button
                        onClick={() => setShowAuthForm('login')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity shadow-sm"
                      >
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
                        Log in to continue
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAuthForm('signup')}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity shadow-sm"
                    >
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
                      Sign up to join
                    </button>
                  )}
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
                  <span
                    className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">Finding sailing opportunities...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-destructive">{error}</p>
                <button
                  onClick={clearError}
                  className="text-sm text-muted-foreground hover:text-foreground mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Crew completion card - render as the final item in the chain */}
        {isCrewOnboarded && (
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
              Welcome aboard, crew!
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your profile is ready. Explore matching sailing opportunities and join a leg.
            </p>

            {completionLegReferences.length > 0 && (
              <div className="mt-4 pt-4 border-t border-primary/20">
                <p className="text-sm font-medium text-foreground mb-3">
                  Recommended opportunities for you
                </p>
                <ChatLegCarousel
                  legs={completionLegReferences}
                  onLegClick={(legId) => handleLegClick(legId, '')}
                  onJoinClick={handleJoinClick}
                  compact={true}
                />
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-primary/20">
              <button
                onClick={handleViewJourneys}
                disabled={isNavigatingToCrew}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50 shadow-sm"
              >
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
                View All Journeys
              </button>
            </div>
          </div>
        )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area - show only for authenticated users without existing profile */}
      {!hasExistingProfile && isAuthenticated && (
        <div className="border-t border-border p-4 bg-card">
          <div className="max-w-2xl lg:max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me about your sailing dreams..."
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
        </div>
      )}

      {/* Auth modals */}
      <SignupModal
        key={`signup-${preferences?.fullName || 'no-name'}`}
        isOpen={showAuthForm === 'signup'}
        onClose={() => setShowAuthForm(null)}
        onSwitchToLogin={() => setShowAuthForm('login')}
        prospectPreferences={preferences as Record<string, unknown>}
      />
      <LoginModal
        isOpen={showAuthForm === 'login'}
        onClose={() => setShowAuthForm(null)}
        onSwitchToSignup={() => setShowAuthForm('signup')}
        fromProspect
      />

      {/* Registration dialog */}
      <LegRegistrationDialog
        isOpen={registrationDialogOpen}
        onClose={() => {
          setRegistrationDialogOpen(false);
          setSelectedLegId(null);
        }}
        legId={selectedLegId}
        onSuccess={() => {
          // Refresh or show success message
          logger.debug('Registration successful!');
        }}
      />

      {/* Profile extraction modal */}
      <ProfileExtractionModal
        isOpen={showProfileExtractionModal}
        onClose={() => setShowProfileExtractionModal(false)}
        messages={messages}
        onSuccess={async () => {
          // Profile saved successfully - update onboarding state and clean up prospect session
          logger.debug('[ProspectChat] Profile saved via fallback - updating onboarding state');
          try {
            await updateOnboardingState('completed');
          } catch (err) {
            logger.warn('[ProspectChat] Failed to update onboarding state:', { error: err instanceof Error ? err.message : String(err) });
            // Continue even if state update fails
          }
          await clearSession();
          setShowProfileExtractionModal(false);
          router.push('/profile');
        }}
      />
    </div>
  );
}
