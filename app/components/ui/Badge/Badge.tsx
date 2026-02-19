'use client';

import { forwardRef } from 'react';
import { COMPONENT_SIZES } from '@/app/lib/designTokens';
import { BadgeProps } from './Badge.types';

const variantClasses: Record<string, { light: string; dark: string }> = {
  primary: {
    light: 'bg-blue-100 text-blue-800',
    dark: 'dark:bg-blue-900/30 dark:text-blue-400',
  },
  secondary: {
    light: 'bg-gray-100 text-gray-800',
    dark: 'dark:bg-gray-900/30 dark:text-gray-400',
  },
  success: {
    light: 'bg-green-100 text-green-800',
    dark: 'dark:bg-green-900/30 dark:text-green-400',
  },
  warning: {
    light: 'bg-yellow-100 text-yellow-800',
    dark: 'dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  error: {
    light: 'bg-red-100 text-red-800',
    dark: 'dark:bg-red-900/30 dark:text-red-400',
  },
  info: {
    light: 'bg-cyan-100 text-cyan-800',
    dark: 'dark:bg-cyan-900/30 dark:text-cyan-400',
  },
};

const outlinedVariantClasses: Record<string, string> = {
  primary: 'border border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-300',
  secondary: 'border border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:border-gray-600 dark:text-gray-300',
  success: 'border border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-600 dark:text-green-300',
  warning: 'border border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-300',
  error: 'border border-red-300 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-600 dark:text-red-300',
  info: 'border border-cyan-300 bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:border-cyan-600 dark:text-cyan-300',
};

const sizeClasses: Record<string, string> = {
  sm: COMPONENT_SIZES.badge.sm,
  md: COMPONENT_SIZES.badge.md,
  lg: COMPONENT_SIZES.badge.lg,
};

/**
 * Badge component - Inline label/status indicator
 *
 * @example
 * // Basic badge
 * <Badge variant="primary">New</Badge>
 *
 * // With icon
 * <Badge variant="success" icon={<CheckIcon />}>Active</Badge>
 *
 * // Dismissable
 * <Badge dismissable onDismiss={handleDismiss}>Close me</Badge>
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      dot = false,
      className = '',
      icon,
      dismissable = false,
      onDismiss,
      outlined = false,
      title,
      ...props
    },
    ref
  ) => {
    const variantClass = outlined
      ? outlinedVariantClasses[variant]
      : `${variantClasses[variant].light} ${variantClasses[variant].dark}`;

    const sizeClass = dot ? 'w-2.5 h-2.5 rounded-full' : sizeClasses[size];

    const baseClasses = 'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors';

    const finalClassName = `
      ${baseClasses}
      ${variantClass}
      ${sizeClass}
      ${className}
    `.trim();

    return (
      <span ref={ref} className={finalClassName} title={title} {...props}>
        {dot ? (
          <span className="block" />
        ) : (
          <>
            {icon && <span className="inline-flex">{icon}</span>}
            <span>{children}</span>
            {dismissable && (
              <button
                onClick={onDismiss}
                className="inline-flex ml-1 hover:opacity-70 transition-opacity"
                aria-label="Dismiss"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
