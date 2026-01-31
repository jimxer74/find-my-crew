'use client';

import { useState, useRef, useEffect } from 'react';
import { useAssistant } from '@/app/contexts/AssistantContext';
import { ActionConfirmation } from './ActionConfirmation';

export function AssistantChat() {
  const {
    messages,
    pendingActions,
    isLoading,
    error,
    sendMessage,
    approveAction,
    rejectAction,
  } = useAssistant();

  const [inputValue, setInputValue] = useState('');
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

  // Get pending actions for current conversation
  const relevantPendingActions = pendingActions.filter(
    a => a.status === 'pending'
  );

  return (
    <div className="flex flex-col h-full">
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
              Hi! I&apos;m your sailing assistant
            </h3>
            <p className="text-sm max-w-xs mx-auto">
              I can help you find sailing opportunities, manage your profile, and more. What would you like to do?
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => sendMessage("Show me sailing opportunities that match my profile")}
                className="px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
              >
                Find matching journeys
              </button>
              <button
                onClick={() => sendMessage("Help me improve my profile")}
                className="px-3 py-1.5 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors"
              >
                Improve my profile
              </button>
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
                {message.content}
              </div>
              {message.role === 'assistant' && message.metadata?.toolCalls && (
                <div className="mt-2 text-xs text-muted-foreground border-t border-border/50 pt-2">
                  Used: {message.metadata.toolCalls.map(tc => tc.name).join(', ')}
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
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending actions */}
      {relevantPendingActions.length > 0 && (
        <div className="border-t border-border p-4 space-y-2 max-h-48 overflow-y-auto bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Pending Actions
          </p>
          {relevantPendingActions.map((action) => (
            <ActionConfirmation
              key={action.id}
              action={action}
              onApprove={() => approveAction(action.id)}
              onReject={() => rejectAction(action.id)}
            />
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-4 bg-card">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
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
  );
}
