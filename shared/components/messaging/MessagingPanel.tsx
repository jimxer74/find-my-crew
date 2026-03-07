'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAssistant } from '@/app/contexts/AssistantContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { Button } from '@shared/ui/Button/Button';
import { AssistantChat } from '@shared/components/ai/AssistantChat';
import { HumanChatView } from './HumanChatView';

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 800;
const DEFAULT_PANEL_WIDTH = 448;
const STORAGE_KEY = 'assistant-panel-width';

function loadSavedWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= MIN_PANEL_WIDTH && parsed <= MAX_PANEL_WIDTH) {
      return parsed;
    }
  }
  return DEFAULT_PANEL_WIDTH;
}

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
  updated_at: string;
  other_participant: OtherParticipant;
  last_message: { content: string; sender_id: string; created_at: string } | null;
  unread_count: number;
}

type View = 'list' | 'ai' | { type: 'human'; conversationId: string };

export function MessagingPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [view, setView] = useState<View>('list');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);

  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();

  const {
    isOpen,
    isMobile,
    closeAssistant,
    buttonRef,
    setHumanUnreadCount,
  } = useAssistant();

  // Load saved width on mount
  useEffect(() => {
    setPanelWidth(loadSavedWidth());
  }, []);

  // Reset to list view and fetch conversations when panel opens
  useEffect(() => {
    if (isOpen) {
      setView('list');
      fetchConversations();
    }
  }, [isOpen]);

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch('/api/messages');
      if (res.ok) {
        const data = await res.json();
        const convs: ConversationItem[] = data.conversations ?? [];
        setConversations(convs);
        const total = convs.reduce((sum, c) => sum + (c.unread_count || 0), 0);
        setHumanUnreadCount(total);
      }
    } catch {
      // silently fail - list will just be empty
    } finally {
      setLoadingConvs(false);
    }
  }, [setHumanUnreadCount]);

  // Keep badge count updated via realtime (even when panel is closed)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-badge-panel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversation_messages' },
        () => fetchConversations()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch to populate badge on mount
  useEffect(() => {
    if (user) fetchConversations();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize handler
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      const clamped = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newWidth));
      setPanelWidth(clamped);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (panelRef.current) {
        const finalWidth = panelRef.current.offsetWidth;
        localStorage.setItem(STORAGE_KEY, String(finalWidth));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const isInConversation = view !== 'list';
  const panelTitle = view === 'list' ? 'Messages' : view === 'ai' ? 'AI Assistant' : 'Conversation';

  const handleBack = () => setView('list');

  return createPortal(
    <div
      ref={panelRef}
      className="fixed top-16 bottom-0 right-0 w-full bg-card border-l border-border shadow-xl z-[120] flex flex-col overflow-hidden rounded-t-lg md:rounded-t-none"
      style={isMobile ? undefined : { width: `${panelWidth}px` }}
    >
      {/* Resize handle - desktop only */}
      {!isMobile && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 bottom-0 left-0 w-1.5 cursor-col-resize z-10 group hover:bg-primary/30 active:bg-primary/40 transition-colors"
          title="Drag to resize"
        >
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-8 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
        </div>
      )}

      {/* Panel header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {/* Back button when in conversation */}
          {isInConversation && (
            <Button
              onClick={handleBack}
              variant="ghost"
              size="sm"
              className="!p-2 -ml-2 flex-shrink-0"
              aria-label="Back to messages"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          )}
          {/* Close button - mobile only when in list */}
          {!isInConversation && (
            <Button
              onClick={closeAssistant}
              variant="ghost"
              size="sm"
              className="md:hidden !p-2 -ml-2 flex-shrink-0"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}
          {/* Message icon - list view, desktop */}
          {!isInConversation && (
            <svg
              className="w-5 h-5 text-primary hidden md:block"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
          <h2 className="font-semibold text-foreground">{panelTitle}</h2>
        </div>

        {/* Close button - desktop, always visible */}
        <Button
          onClick={closeAssistant}
          variant="ghost"
          size="sm"
          className="hidden md:flex !p-2 flex-shrink-0"
          aria-label="Close"
        >
          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* Content */}
      {view === 'list' && (
        <div className="flex-1 overflow-y-auto">
          {/* AI Assistant card */}
          <button
            onClick={() => setView('ai')}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-border hover:bg-accent/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-primary"
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
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">AI Assistant</p>
              <p className="text-xs text-muted-foreground truncate">Always available · Ask me anything</p>
            </div>
            <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Human conversations */}
          {loadingConvs ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Messaging opens once a registration is approved.</p>
            </div>
          ) : (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversations</p>
              {conversations.map((conv) => {
                const other = conv.other_participant;
                const displayName = other.full_name || other.username || 'Unknown';
                const hasUnread = conv.unread_count > 0;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setView({ type: 'human', conversationId: conv.id })}
                    className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 transition-colors text-left hover:bg-accent/50 ${
                      hasUnread ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Avatar */}
                    {other.profile_image_url ? (
                      <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-border">
                        <img src={other.profile_image_url} alt={displayName} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${hasUnread ? 'text-foreground' : 'text-foreground/80'}`}>
                          {displayName}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
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
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{conv.last_message.content}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">No messages yet</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === 'ai' && (
        <div className="flex-1 overflow-hidden">
          <AssistantChat />
        </div>
      )}

      {typeof view === 'object' && view.type === 'human' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <HumanChatView conversationId={view.conversationId} onBack={handleBack} />
        </div>
      )}
    </div>,
    document.body
  );
}
