'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useProspectChat } from '@/app/contexts/ProspectChatContext';
import { ProspectMessage, PendingAction, ProspectLegReference } from '@/app/lib/ai/prospect/types';
import { ChatLegCarousel } from '@/app/components/ai/ChatLegCarousel';
import { SignupModal } from '@/app/components/SignupModal';
import { LoginModal } from '@/app/components/LoginModal';
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
          <button
            key={i}
            type="button"
            onClick={() => handleClick(prompt)}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-full transition-all border border-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary/10"
            title={`Click to send: ${prompt}`}
          >
            <span className="text-left">{prompt}</span>
          </button>
        ))}
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

/**
 * Quick suggestion buttons for starting the conversation
 */
function QuickSuggestions({
  onSelect,
  isReturning,
}: {
  onSelect: (message: string) => void;
  isReturning: boolean;
}) {
  const suggestions = isReturning
    ? [
        { label: 'Show me more options', message: 'Can you show me more sailing opportunities?' },
        { label: 'Different dates', message: "I'd like to explore different dates" },
        { label: 'Different location', message: "Let's look at a different sailing area" },
      ]
    : [
        { label: 'Mediterranean sailing', message: "I'm interested in sailing the Mediterranean" },
        { label: 'Caribbean adventure', message: 'I want to explore the Caribbean' },
        { label: 'Learn to sail', message: "I'm a beginner looking to learn" },
        { label: 'Ocean crossing', message: "I'd love to do an ocean crossing" },
      ];

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s.message)}
          className="px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
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
    hasExistingProfile,
    sendMessage,
    clearError,
    clearSession,
    addViewedLeg,
    approveAction,
    cancelAction,
  } = useProspectChat();

  // Note: profile_completion query parameter is deprecated - we determine state from hasExistingProfile and isAuthenticated

  const [inputValue, setInputValue] = useState('');
  const [showAuthForm, setShowAuthForm] = useState<'signup' | 'login' | null>(null);
  const [isNavigatingToCrew, setIsNavigatingToCrew] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    console.log('[ProspectChat] Messages changed - total:', messages.length, 
      'user messages:', messages.filter(m => m.role === 'user').length,
      'assistant messages:', messages.filter(m => m.role === 'assistant').length,
      'all message IDs:', messages.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 50) })));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debug: Log authentication and profile state
  useEffect(() => {
    const shouldShowHeaderButton = messages.length > 0 && hasExistingProfile && isAuthenticated;
    const shouldShowWelcomeButton = messages.length === 0 && hasExistingProfile && isAuthenticated;
    const shouldShowBottomButton = hasExistingProfile && isAuthenticated;
    
    console.log('[ProspectChat] 🔍 DEBUG - Button Visibility Check:', {
      isAuthenticated,
      hasExistingProfile,
      messagesLength: messages.length,
      'Header button (when messages > 0)': shouldShowHeaderButton,
      'Welcome button (when messages === 0)': shouldShowWelcomeButton,
      'Bottom button': shouldShowBottomButton,
      'All conditions met': hasExistingProfile && isAuthenticated,
    });
  }, [isAuthenticated, hasExistingProfile, messages.length]);

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
      // Mobile: navigate in same window with from=assistant param for back button
      window.location.href = `${url}&from=assistant`;
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

  const handleStartFresh = () => {
    if (window.confirm('Start a new conversation? Your current chat history will be cleared.')) {
      clearSession();
    }
  };

  // Open Crew dashboard with this leg selected and registration form open (only shown when signed up + profile created)
  const handleJoinClick = (legId: string, _legName: string) => {
    const url = `/crew/dashboard?legId=${encodeURIComponent(legId)}&register=true`;
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobileScreen) {
      window.location.href = `${url}&from=assistant`;
    } else {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  };

  // Clear prospect chat/session and go to crew homepage (after profile created)
  const handleViewJourneys = async () => {
    setIsNavigatingToCrew(true);
    try {
      await clearSession();
      router.push('/crew');
    } catch (e) {
      console.error('Failed to clear session:', e);
      setIsNavigatingToCrew(false);
    }
  };


  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat header with Start Fresh option and Sign up prompt */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card gap-2">
          <span className="text-sm text-muted-foreground truncate">
            Onboarding assistant
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View Journeys - show when user is authenticated and has a profile */}
            {(hasExistingProfile && isAuthenticated) && (
              <button
                onClick={handleViewJourneys}
                disabled={isNavigatingToCrew}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-md transition-opacity disabled:opacity-50"
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
                  <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                View All Journeys
              </button>
            )}
            <button
              onClick={handleStartFresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
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
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Start Fresh
            </button>
          </div>
        </div>
      )}

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
            {hasExistingProfile && isAuthenticated ? (
              <>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Welcome back! You're all set
                </h3>
                <p className="text-sm max-w-sm mx-auto mb-4">
                  You already have an account and profile. You can start searching for matching sailing trips right away!
                </p>
                <div className="flex justify-center mb-4">
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
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {isReturningUser ? 'Welcome back!' : 'Find Your Perfect Sailing Adventure'}
                </h3>
                <p className="text-sm max-w-sm mx-auto mb-4">
                  {isReturningUser
                    ? "Ready to continue exploring? Let's pick up where we left off."
                    : "Tell me about your sailing dreams and I'll help you find the perfect opportunity. No sign-up needed to start exploring!"}
                </p>
              </>
            )}
            {/* Only show quick suggestions for users without existing profile */}
            {!hasExistingProfile && (
              <QuickSuggestions
                onSelect={handleSuggestionSelect}
                isReturning={isReturningUser}
              />
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
                      handleLegClick
                    )
                  : message.content}
              </div>
              {/* Show suggested prompts from AI response */}
              {message.role === 'assistant' && (
                <SuggestedPrompts
                  prompts={extractSuggestedPrompts(message.content)}
                  onSelect={handleSuggestionSelect}
                  disabled={isLoading}
                />
              )}
              {/* Show "View Journeys" button and leg carousel after congratulations message (profile creation success) */}
              {message.role === 'assistant' && 
               (message.content.includes('Congratulations! Welcome to SailSmart!') || 
                message.metadata?.toolCalls?.some(tc => tc.name === 'update_user_profile')) && 
               isAuthenticated && (
                <>
                  {/* Show previously found legs if any - they're now stored in the congratulations message metadata */}
                  {message.metadata?.legReferences && message.metadata.legReferences.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-sm font-medium text-foreground mb-3">
                        Here are the sailing opportunities we found earlier:
                      </p>
                      <ChatLegCarousel
                        legs={message.metadata.legReferences}
                        onLegClick={(legId) => handleLegClick(legId, '')}
                        onJoinClick={isAuthenticated && hasExistingProfile ? handleJoinClick : undefined}
                        compact={true}
                      />
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <button
                      onClick={handleViewJourneys}
                      disabled={isNavigatingToCrew}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50 shadow-sm w-full justify-center"
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
                </>
              )}
              {/* Show leg carousel if leg references are available */}
              {/* Exclude congratulations message - it has its own carousel display above */}
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
              {/* Show inline sign-up button after assistant messages if user is not authenticated and doesn't have a profile */}
              {/* Don't show if user is authenticated or has existing profile */}
              {message.role === 'assistant' && !isAuthenticated &&
                (
                <div className="mt-3 pt-3 border-t border-border/50">
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
                    Sign up now
                  </button>
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

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area - show for users without existing profile */}
      {!hasExistingProfile && (
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
    </div>
  );
}
