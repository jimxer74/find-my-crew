/**
 * i18n Utilities
 *
 * Re-exports from next-intl and provides helper functions for translations.
 */

// Re-export commonly used hooks and functions
export { useTranslations, useLocale, useFormatter } from 'next-intl';
export { getTranslations, getLocale, getFormatter } from 'next-intl/server';

// Re-export config
export { locales, defaultLocale, localeNames, localeFlags, type Locale } from '@/i18n/config';

/**
 * Get the user's preferred locale from various sources
 * Priority: cookie > localStorage > browser > default
 */
export function getPreferredLocale(): string {
  if (typeof window === 'undefined') {
    return 'en';
  }

  // Check cookie first
  const cookieMatch = document.cookie.match(/locale=([^;]+)/);
  if (cookieMatch) {
    return cookieMatch[1];
  }

  // Check localStorage
  const stored = localStorage.getItem('preferred-locale');
  if (stored) {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language.substring(0, 2);
  if (['en', 'fi'].includes(browserLang)) {
    return browserLang;
  }

  return 'en';
}

/**
 * Set the user's preferred locale
 */
export function setPreferredLocale(locale: string): void {
  if (typeof window === 'undefined') return;

  // Set cookie (expires in 1 year)
  document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;

  // Also store in localStorage
  localStorage.setItem('preferred-locale', locale);
}
