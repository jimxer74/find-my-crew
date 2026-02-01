'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAssistant } from '@/app/contexts/AssistantContext';
import { AssistantChat } from './AssistantChat';

export function AssistantSidebar() {
  const t = useTranslations('assistant');
  const {
    isOpen,
    isMobile,
    closeAssistant,
    conversations,
    currentConversationId,
    loadConversations,
    loadConversation,
    createNewConversation,
    deleteConversation,
  } = useAssistant();

  // Load conversations when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Don't render on mobile (use full page instead) or when closed
  if (isMobile || !isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[120]"
        onClick={closeAssistant}
      />

      {/* Sidebar */}
      <div className="fixed top-16 right-0 bottom-0 w-[400px] max-w-[90vw] bg-card border-l border-border z-[130] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
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
            <h2 className="font-semibold text-foreground">{t('title')}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={createNewConversation}
              className="p-2 hover:bg-accent rounded-md transition-colors"
              title={t('newConversation')}
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={closeAssistant}
              className="p-2 hover:bg-accent rounded-md transition-colors"
              title={t('close')}
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Conversation list (collapsible) */}
        {conversations.length > 0 && (
          <div className="border-b border-border">
            <details className="group">
              <summary className="flex items-center justify-between px-4 py-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50">
                <span>{t('previousConversations', { count: conversations.length })}</span>
                <svg
                  className="w-4 h-4 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="max-h-48 overflow-y-auto pb-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-2 px-4 py-2 hover:bg-accent cursor-pointer group ${
                      currentConversationId === conv.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <span className="flex-1 text-sm truncate">
                      {conv.title || t('newConversation')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all"
                      title={t('deleteConversation')}
                    >
                      <svg className="w-4 h-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-hidden">
          <AssistantChat />
        </div>
      </div>
    </>
  );
}
