'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useAssistant } from '@/app/contexts/AssistantContext';
import { Button } from '@/app/components/ui/Button/Button';
import { AssistantChat } from './AssistantChat';

const MIN_PANEL_WIDTH = 320;  // px
const MAX_PANEL_WIDTH = 800;  // px
const DEFAULT_PANEL_WIDTH = 448; // ~28rem
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

export function AssistantSidebar() {
  const t = useTranslations('assistant');
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
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
    buttonRef,
  } = useAssistant();

  // Load saved width on mount
  useEffect(() => {
    setPanelWidth(loadSavedWidth());
  }, []);

  // Load conversations when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

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
      // Save to localStorage
      if (panelRef.current) {
        const finalWidth = panelRef.current.offsetWidth;
        localStorage.setItem(STORAGE_KEY, String(finalWidth));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Don't render when closed
  if (!isOpen) {
    return null;
  }

  // Use portal to render outside Header DOM
  if (typeof document === 'undefined') return null;

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
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {/* Close button - mobile only */}
          <Button
            onClick={closeAssistant}
            variant="ghost"
            size="sm"
            className="md:hidden !p-2 -ml-2"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
          <svg
            className="w-5 h-5 text-primary hidden md:block"
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
        <Button
          onClick={createNewConversation}
          variant="ghost"
          size="sm"
          className="!p-2"
          title={t('newConversation')}
        >
          <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </Button>
      </div>

      {/* Conversation list (collapsible) */}
      {conversations.length > 0 && (
        <div className="flex-shrink-0 border-b border-border">
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
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="!p-1 opacity-0 group-hover:opacity-100 hover:!bg-destructive/10 transition-all"
                    title={t('deleteConversation')}
                  >
                    <svg className="w-4 h-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
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
    </div>,
    document.body
  );
}
