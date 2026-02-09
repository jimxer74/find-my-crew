'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useProspectChat } from '@/app/contexts/ProspectChatContext';
import { ProspectMessage } from '@/app/lib/ai/prospect/types';
import { ChatLegCarousel } from '@/app/components/ai/ChatLegCarousel';
import { InlineChatSignupForm } from './InlineChatSignupForm';
import { InlineChatLoginForm } from './InlineChatLoginForm';

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
  const router = useRouter();
  const t = useTranslations('common');

  const {
    messages,
    preferences,
    isLoading,
    error,
    isReturningUser,
    sendMessage,
    clearError,
    clearSession,
    addViewedLeg,
  } = useProspectChat();

  const [inputValue, setInputValue] = useState('');
  const [showAuthForm, setShowAuthForm] = useState<'signup' | 'login' | null>(null);
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

  // Handle join button click on leg cards - triggers signup flow
  const handleJoinClick = (legId: string, legName: string) => {
    // Show the signup form
    setShowAuthForm('signup');
    // Optionally scroll to the form
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat header with Start Fresh option and Sign up prompt */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card gap-2">
          <span className="text-sm text-muted-foreground truncate">
            Exploring sailing opportunities
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sign up button - show after some engagement */}
            {messages.length >= 2 && !showAuthForm && (
              <button
                onClick={() => setShowAuthForm('signup')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-md transition-opacity"
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
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Sign up
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
            <h3 className="text-lg font-medium text-foreground mb-2">
              {isReturningUser ? 'Welcome back!' : 'Find Your Perfect Sailing Adventure'}
            </h3>
            <p className="text-sm max-w-sm mx-auto mb-4">
              {isReturningUser
                ? "Ready to continue exploring? Let's pick up where we left off."
                : "Tell me about your sailing dreams and I'll help you find the perfect opportunity. No sign-up needed to start exploring!"}
            </p>
            <QuickSuggestions
              onSelect={handleSuggestionSelect}
              isReturning={isReturningUser}
            />
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
                  ? renderMessageWithLegLinks(message.content, handleLegClick)
                  : message.content}
              </div>
              {/* Show leg carousel if leg references are available */}
              {message.role === 'assistant' &&
               message.metadata?.legReferences &&
               message.metadata.legReferences.length > 0 && (
                <div className="mt-3 -mx-2">
                  <ChatLegCarousel
                    legs={message.metadata.legReferences}
                    onLegClick={(legId) => handleLegClick(legId, '')}
                    onJoinClick={handleJoinClick}
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

        {/* Inline auth forms */}
        {showAuthForm === 'signup' && (
          <div className="flex justify-start">
            <InlineChatSignupForm
              preferences={preferences}
              onSuccess={() => {
                // Form shows success state internally
                // Could redirect or refresh here if needed
              }}
              onCancel={() => setShowAuthForm(null)}
              onSwitchToLogin={() => setShowAuthForm('login')}
            />
          </div>
        )}

        {showAuthForm === 'login' && (
          <div className="flex justify-start">
            <InlineChatLoginForm
              onSuccess={() => {
                setShowAuthForm(null);
                router.refresh();
              }}
              onCancel={() => setShowAuthForm(null)}
              onSwitchToSignup={() => setShowAuthForm('signup')}
            />
          </div>
        )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
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
    </div>
  );
}
