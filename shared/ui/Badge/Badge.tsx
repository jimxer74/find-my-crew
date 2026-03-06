'use client';

import { forwardRef } from 'react';
import { COMPONENT_SIZES } from '@shared/ui/designTokens';
import { BadgeProps } from './Badge.types';

const variantClasses: Record<string, { light: string; dark: string }> = {
  primary: {
    light: 'bg-blue-100 text-blue-800',
    dark: 'dark:bg-blue-500/20 dark:text-blue-200 dark:border dark:border-blue-400/30',
  },
  secondary: {
    light: 'bg-gray-100 text-gray-700',
    dark: 'dark:bg-white/10 dark:text-gray-200 dark:border dark:border-white/20',
  },
  success: {
    light: 'bg-green-100 text-green-800',
    dark: 'dark:bg-green-500/20 dark:text-green-200 dark:border dark:border-green-400/30',
  },
  warning: {
    light: 'bg-yellow-100 text-yellow-800',
    dark: 'dark:bg-amber-500/20 dark:text-amber-200 dark:border dark:border-amber-400/30',
  },
  error: {
    light: 'bg-red-100 text-red-800',
    dark: 'dark:bg-red-500/20 dark:text-red-200 dark:border dark:border-red-400/30',
  },
  info: {
    light: 'bg-cyan-100 text-cyan-800',
    dark: 'dark:bg-cyan-500/20 dark:text-cyan-200 dark:border dark:border-cyan-400/30',
  },
};

const outlinedVariantClasses: Record<string, string> = {
  primary: 'border border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:border-blue-400/50 dark:text-blue-200',
  secondary: 'border border-gray-300 bg-gray-50 text-gray-700 dark:bg-white/10 dark:border-white/20 dark:text-gray-200',
  success: 'border border-green-300 bg-green-50 text-green-700 dark:bg-green-500/15 dark:border-green-400/50 dark:text-green-200',
  warning: 'border border-yellow-300 bg-yellow-100 text-yellow-700 dark:bg-amber-500/15 dark:border-amber-400/50 dark:text-amber-200',
  error: 'border border-red-300 bg-red-50 text-red-800 dark:bg-red-500/15 dark:border-red-400/50 dark:text-red-200',
  info: 'border border-cyan-300 bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:border-cyan-400/50 dark:text-cyan-200',
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

    const baseClasses = 'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors backdrop-blur-sm';

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
