'use client';

import { logger } from '@shared/logging';
import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  attachments: any[];
  read_by: string[];
  created_at: string;
}

interface OtherParticipant {
  id: string;
  full_name: string | null;
  username: string | null;
  profile_image_url: string | null;
}

interface ConversationDetail {
  id: string;
  status: 'open' | 'closed';
  registration_id: string;
  other_participant: OtherParticipant;
}

export default function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  // Fetch conversation and messages
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/messages/${conversationId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 404) setError('Conversation not found.');
          else if (res.status === 403) setError('Access denied.');
          else setError(data.error || 'Failed to load conversation.');
          return;
        }
        const data = await res.json();
        setConversation(data.conversation);
        setMessages(data.messages ?? []);
        setHasMore(data.has_more ?? false);
      } catch (err) {
        logger.error('[ConversationPage] Fetch error:', err instanceof Error ? { error: err.message } : { error: String(err) });
        setError('Failed to load conversation.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, conversationId]);

  // Subscribe to Realtime for new messages
  useEffect(() => {
    if (!user || !conversation) return;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates (optimistic updates)
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversation, conversationId, supabase]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Optimistic update
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: Message = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user!.id,
      content,
      attachments: [],
      read_by: [user!.id],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch(`/api/messages/${conversationId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        // Rollback optimistic update
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setNewMessage(content);
        const data = await res.json().catch(() => ({}));
        logger.error('[ConversationPage] Send failed:', { error: data.error });
      } else {
        const data = await res.json();
        // Replace optimistic message with real one
        setMessages((prev) => prev.map((m) => (m.id === optimisticId ? data.message : m)));
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setNewMessage(content);
      logger.error('[ConversationPage] Send error:', err instanceof Error ? { error: err.message } : { error: String(err) });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = async () => {
    if (!confirm('Are you sure you want to close this conversation? This cannot be undone.')) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      if (res.ok) {
        setConversation((prev) => prev ? { ...prev, status: 'closed' } : prev);
      }
    } catch (err) {
      logger.error('[ConversationPage] Close error:', err instanceof Error ? { error: err.message } : { error: String(err) });
    } finally {
      setClosing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Could not load conversation</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link href="/messages" className="text-primary hover:underline text-sm">← Back to Messages</Link>
        </div>
      </div>
    );
  }

  if (!conversation) return null;

  const other = conversation.other_participant;
  const displayName = other.full_name || other.username || 'Unknown';
  const isClosed = conversation.status === 'closed';

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Link href="/messages" className="p-1 hover:bg-accent rounded-md transition-colors">
          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {other.profile_image_url ? (
          <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
            <Image src={other.profile_image_url} alt={displayName} fill className="object-cover" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
          {isClosed && (
            <p className="text-xs text-muted-foreground">Conversation closed</p>
          )}
        </div>
        {!isClosed && (
          <button
            onClick={handleClose}
            disabled={closing}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10 flex-shrink-0"
          >
            {closing ? 'Closing…' : 'Close chat'}
          </button>
        )}
      </div>

      {/* Closed banner */}
      {isClosed && (
        <div className="flex-shrink-0 px-4 py-2 bg-muted text-xs text-muted-foreground text-center">
          This conversation has been closed. No new messages can be sent.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  isOwn
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border text-foreground rounded-bl-sm'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-xs mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[42px] max-h-32 scrollbar-hide"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
