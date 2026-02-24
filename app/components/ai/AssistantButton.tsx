'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAssistant } from '@/app/contexts/AssistantContext';
import { Button } from '@/app/components/ui/Button/Button';

export function AssistantButton({ userRoles }: { userRoles: string[] | null }) {
  const t = useTranslations('navigation');
  const router = useRouter();
  const {
    isOpen,
    toggleAssistant,
    buttonRef,
  } = useAssistant();

  const handleClick = () => {
    // Toggle sidebar on both mobile and desktop
    toggleAssistant();
  };

  // Show X icon when sidebar is open
  const showCloseIcon = isOpen;

  return ( userRoles?.includes('crew') ? (
    <Button
      ref={buttonRef}
      onClick={handleClick}
      variant="ghost"
      className="relative !p-2 !min-h-[44px] !min-w-[44px]"
      aria-label={t('assistant')}
      title={t('assistant')}
    >
      {/* AI/Sparkles Icon - shows X when open on desktop */}
      <svg
        className="w-5 h-5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        {showCloseIcon ? (
          <path d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        )}

      </svg>

      {/* No longer showing suggestions badge - only pending actions are shown in notifications */}
    </Button>
  ) :
  <></>
  );
}
