'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { logger } from '@shared/logging';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Button } from '@shared/ui/Button/Button';

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
          <Button
            key={loc}
            onClick={() => handleChange(loc)}
            disabled={isPending}
            variant={loc === locale ? 'primary' : 'ghost'}
            size="sm"
            className="!px-2 !py-1 !text-sm"
            title={localeNames[loc]}
          >
            {localeFlags[loc]}
          </Button>
        ))}
      </div>
    );
  }

  if (variant === 'menu-item') {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 flex-wrap">
          {locales.map((loc) => (
            <Button
              key={loc}
              onClick={() => handleChange(loc)}
              disabled={isPending}
              variant={loc === locale ? 'outline' : 'ghost'}
              size="sm"
              className={loc === locale ? '!font-medium' : ''}
              rightIcon={
                loc === locale ? (
                  <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : undefined
              }
            >
              <span>{localeFlags[loc]}</span>
              <span>{localeNames[loc]}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        variant="outline"
        size="sm"
        className="!flex !items-center !gap-2"
        rightIcon={
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        }
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span>{localeFlags[locale]}</span>
        <span className="hidden sm:inline">{localeNames[locale]}</span>
      </Button>

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
              <Button
                key={loc}
                onClick={() => handleChange(loc)}
                variant={loc === locale ? 'outline' : 'ghost'}
                className={`!w-full !justify-start !text-sm !rounded-none ${loc === locale ? '!font-medium' : ''}`}
                rightIcon={
                  loc === locale ? (
                    <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : undefined
                }
              >
                <span>{localeFlags[loc]}</span>
                <span>{localeNames[loc]}</span>
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
