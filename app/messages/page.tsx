'use client';

import { logger } from '@shared/logging';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';

interface OtherParticipant {
  id: string;
  full_name: string | null;
  username: string | null;
  profile_image_url: string | null;
}

interface ConversationItem {
  id: string;
  registration_id: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  other_participant: OtherParticipant;
  last_message: { content: string; sender_id: string; created_at: string } | null;
  unread_count: number;
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/messages');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load conversations');
        }
        const data = await res.json();
        setConversations(data.conversations ?? []);
      } catch (err) {
        logger.error('[MessagesPage] Fetch error:', err instanceof Error ? { error: err.message } : { error: String(err) });
        setError('Failed to load messages. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const openConversations = conversations.filter((c) => c.status === 'open');
  const closedConversations = conversations.filter((c) => c.status === 'closed');

  const ConversationCard = ({ conv }: { conv: ConversationItem }) => {
    const other = conv.other_participant;
    const displayName = other.full_name || other.username || 'Unknown';
    const hasUnread = conv.unread_count > 0;

    return (
      <Link
        href={`/messages/${conv.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-4 p-4 rounded-lg border transition-colors hover:bg-accent/50 ${
          hasUnread ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'
        }`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          {other.profile_image_url ? (
            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-border">
              <Image src={other.profile_image_url} alt={displayName} fill className="object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border border-border">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-medium truncate ${hasUnread ? 'text-foreground' : 'text-foreground/80'}`}>
              {displayName}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {conv.status === 'closed' && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Closed</span>
              )}
              {hasUnread && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                  {conv.unread_count > 9 ? '9+' : conv.unread_count}
                </span>
              )}
            </div>
          </div>
          {conv.last_message ? (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {conv.last_message.sender_id === user?.id ? 'You: ' : ''}
              {conv.last_message.content}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5 italic">No messages yet</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(conv.updated_at).toLocaleDateString()}
          </p>
        </div>

        {/* Arrow */}
        <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Messages</h1>

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {conversations.length === 0 && !error && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <svg className="mx-auto w-12 h-12 text-muted-foreground mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-muted-foreground text-sm">No conversations yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Messaging is available once a registration is approved.</p>
          </div>
        )}

        {openConversations.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active</h2>
            <div className="space-y-2">
              {openConversations.map((conv) => (
                <ConversationCard key={conv.id} conv={conv} />
              ))}
            </div>
          </div>
        )}

        {closedConversations.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Closed</h2>
            <div className="space-y-2">
              {closedConversations.map((conv) => (
                <ConversationCard key={conv.id} conv={conv} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
