/**
 * Internationalization Configuration
 *
 * Defines supported locales and default settings for next-intl.
 */

export const locales = ['en', 'fi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fi: 'Suomi',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  fi: '🇫🇮',
};
