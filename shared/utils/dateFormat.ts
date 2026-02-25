/**
 * Global date formatting utility
 * Formats dates consistently across the application with locale support
 *
 * Default format: "Jan 14, 2026" (en) or "14.1.2026" (fi)
 *
 * To change the date format globally, modify the options in this function
 */

import { defaultLocale, type Locale } from '@/i18n/config';

// Map our locale codes to BCP 47 locale codes for Intl
const localeMap: Record<Locale, string> = {
  en: 'en-US',
  fi: 'fi-FI',
};

/**
 * Get the current locale from cookie or localStorage
 * Returns the BCP 47 locale code for use with Intl
 */
function getCurrentLocale(): string {
  if (typeof window === 'undefined') {
    return localeMap[defaultLocale];
  }

  // Try cookie first
  const cookieLocale = document.cookie
    .split('; ')
    .find(row => row.startsWith('locale='))
    ?.split('=')[1] as Locale | undefined;

  if (cookieLocale && localeMap[cookieLocale]) {
    return localeMap[cookieLocale];
  }

  // Try localStorage
  const storedLocale = localStorage.getItem('preferred-locale') as Locale | null;
  if (storedLocale && localeMap[storedLocale]) {
    return localeMap[storedLocale];
  }

  return localeMap[defaultLocale];
}

export function formatDate(date: string | Date | null | undefined, locale?: string): string {
  if (!date) return 'Not set';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    const effectiveLocale = locale || getCurrentLocale();

    return dateObj.toLocaleDateString(effectiveLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format date without year (for compact display)
 * Format: "Jan 14" (en) or "14.1." (fi)
 */
export function formatDateShort(date: string | Date | null | undefined, locale?: string): string {
  if (!date) return 'Not set';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    const effectiveLocale = locale || getCurrentLocale();

    return dateObj.toLocaleDateString(effectiveLocale, {
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format date and time
 * Format: "Jan 14, 2026, 3:30 PM" (en) or "14.1.2026 klo 15.30" (fi)
 */
export function formatDateTime(date: string | Date | null | undefined, locale?: string): string {
  if (!date) return 'Not set';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    const effectiveLocale = locale || getCurrentLocale();

    return dateObj.toLocaleString(effectiveLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid date';
  }
}

/**
 * Format time only
 * Format: "3:30 PM" (en) or "15.30" (fi)
 */
export function formatTime(date: string | Date | null | undefined, locale?: string): string {
  if (!date) return 'Not set';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Invalid time';
    }

    const effectiveLocale = locale || getCurrentLocale();

    return dateObj.toLocaleTimeString(effectiveLocale, {
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid time';
  }
}
