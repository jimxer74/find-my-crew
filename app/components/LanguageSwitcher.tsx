'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { logger } from '@/app/lib/logger';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons' | 'menu-item';
  className?: string;
  onClose?: () => void;
}

export function LanguageSwitcher({ variant = 'dropdown', className = '', onClose }: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = async (newLocale: Locale) => {
    if (newLocale === locale) return;

    // Set the locale cookie
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Also store in localStorage for persistence
    localStorage.setItem('preferred-locale', newLocale);

    // If user is logged in, save to their profile
    if (user) {
      try {
        const supabase = getSupabaseBrowserClient();
        await supabase
          .from('profiles')
          .update({ language: newLocale })
          .eq('id', user.id);
      } catch (error) {
        logger.error('Failed to save language preference to profile:', error instanceof Error ? { error: error.message } : { error: String(error) });
      }
    }

    // Refresh the page to apply new locale
    startTransition(() => {
      router.refresh();
    });

    setIsOpen(false);
    onClose?.();
  };

  if (variant === 'buttons') {
    return (
      <div className={`flex gap-1 ${className}`}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleChange(loc)}
            disabled={isPending}
            className={`px-2 py-1 text-sm rounded transition-colors ${
              loc === locale
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground'
            } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
            title={localeNames[loc]}
          >
            {localeFlags[loc]}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'menu-item') {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 flex-wrap">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleChange(loc)}
              disabled={isPending}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                loc === locale
                  ? 'bg-accent font-medium'
                  : 'hover:bg-accent text-muted-foreground'
              } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
            >
              <span>{localeFlags[loc]}</span>
              <span>{localeNames[loc]}</span>
              {loc === locale && (
                <svg className="w-4 h-4 ml-auto text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={`flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors ${
          isPending ? 'opacity-50 cursor-wait' : ''
        }`}
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span>{localeFlags[locale]}</span>
        <span className="hidden sm:inline">{localeNames[locale]}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-card border border-border rounded-md shadow-lg overflow-hidden">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleChange(loc)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                  loc === locale ? 'bg-accent font-medium' : ''
                }`}
              >
                <span>{localeFlags[loc]}</span>
                <span>{localeNames[loc]}</span>
                {loc === locale && (
                  <svg className="w-4 h-4 ml-auto text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
