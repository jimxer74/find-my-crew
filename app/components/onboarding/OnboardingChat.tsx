'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@shared/ui/Button/Button';
import { logger } from '@shared/logging';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedData {
  name?: string | null;
  experienceLevel?: number | null;
  boatMakeModel?: string | null;
  boatHomePort?: string | null;
  boatYearBuilt?: number | null;
  boatLoa?: number | null;
  journeyFrom?: string | null;
  journeyTo?: string | null;
  journeyStartDate?: string | null;
  journeyEndDate?: string | null;
}

interface OnboardingChatProps {
  onComplete: (extractedData: ExtractedData, messages: Message[]) => void;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Welcome to Find My Crew! I'm here to help you get set up quickly. To start, what's your name and what kind of boat do you sail?",
};

export function OnboardingChat({ onComplete }: OnboardingChatProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [isComplete, setIsComplete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/onboarding/v2/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages, // history before user message
          userMessage: text,
        }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      const data = await res.json();
      const assistantMsg: Message = { role: 'assistant', content: data.message };
      const finalMessages = [...updatedMessages, assistantMsg];

      setMessages(finalMessages);
      setExtractedData((prev) => ({ ...prev, ...data.extractedData }));

      if (data.isComplete) {
        setIsComplete(true);
      }
    } catch (err) {
      logger.error('[OnboardingChat] Error', {
        error: err instanceof Error ? err.message : String(err),
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleContinue = () => {
    onComplete(extractedData, messages);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 max-h-80 pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Ready to proceed banner */}
      {isComplete && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Great! I have everything I need. Ready to create your account?
          </p>
          <Button className="mt-2 w-full sm:w-auto" onClick={handleContinue}>
            Create account &amp; continue →
          </Button>
        </div>
      )}

      {/* Input */}
      {!isComplete && (
        <div className="flex items-end gap-2 border-t border-border pt-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[38px] max-h-24"
            style={{ overflowY: 'auto' }}
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="flex-shrink-0"
          >
            Send
          </Button>
        </div>
      )}
    </div>
  );
}
