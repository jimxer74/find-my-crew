'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAssistant } from '@/app/contexts/AssistantContext';

export function AssistantButton() {
  const router = useRouter();
  const {
    toggleAssistant,
    loadSuggestions,
    loadPendingActions,
    suggestionsCount,
    pendingActionsCount,
  } = useAssistant();

  // Load counts on mount
  useEffect(() => {
    loadSuggestions();
    loadPendingActions();
  }, [loadSuggestions, loadPendingActions]);

  const totalBadgeCount = suggestionsCount + pendingActionsCount;

  const handleClick = () => {
    // On mobile, navigate to assistant page; on desktop, toggle sidebar
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      router.push('/assistant');
    } else {
      toggleAssistant();
    }
  };

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-md bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
      aria-label={`AI Assistant${totalBadgeCount > 0 ? ` (${totalBadgeCount} items)` : ''}`}
      title="AI Assistant"
    >
      {/* AI/Sparkles Icon */}
      <svg
        className="w-5 h-5 text-foreground"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>

      {/* Badge for suggestions/actions count */}
      {totalBadgeCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-primary rounded-full">
          {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
        </span>
      )}
    </button>
  );
}
