'use client';

import { forwardRef } from 'react';
import { SPACING } from '@/app/lib/designTokens';
import { AlertProps } from './Alert.types';

const variantClasses: Record<string, { bg: string; border: string; icon: string }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800 left-blue-500',
    icon: 'text-blue-500',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800 left-green-500',
    icon: 'text-green-500',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800 left-yellow-500',
    icon: 'text-yellow-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800 left-red-500',
    icon: 'text-red-500',
  },
};

const textColorClasses: Record<string, string> = {
  info: 'text-blue-800 dark:text-blue-300',
  success: 'text-green-800 dark:text-green-300',
  warning: 'text-yellow-800 dark:text-yellow-300',
  error: 'text-red-800 dark:text-red-300',
};

const titleColorClasses: Record<string, string> = {
  info: 'text-blue-900 dark:text-blue-200',
  success: 'text-green-900 dark:text-green-200',
  warning: 'text-yellow-900 dark:text-yellow-200',
  error: 'text-red-900 dark:text-red-200',
};

/**
 * Alert component - Prominent notice/notification box
 *
 * @example
 * // Basic alert
 * <Alert variant="info">This is an informational message</Alert>
 *
 * // With title
 * <Alert variant="success" title="Success!">
 *   Your changes have been saved successfully.
 * </Alert>
 *
 * // Dismissable
 * <Alert
 *   variant="warning"
 *   dismissable
 *   onDismiss={handleDismiss}
 * >
 *   Warning message
 * </Alert>
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      children,
      variant = 'info',
      title,
      className = '',
      dismissable = false,
      onDismiss,
      icon,
      bordered = true,
      ...props
    },
    ref
  ) => {
    const variantClass = variantClasses[variant];
    const textColor = textColorClasses[variant];
    const titleColor = titleColorClasses[variant];

    const baseClasses = 'rounded-lg border transition-all';
    const paddingClass = SPACING.md;

    const borderClass = bordered
      ? `border-l-4 border-b border-r ${variantClass.border}`
      : `border ${variantClass.border}`;

    const finalClassName = `
      ${baseClasses}
      ${borderClass}
      ${variantClass.bg}
      ${paddingClass}
      ${className}
    `.trim();

    return (
      <div ref={ref} className={finalClassName} role="alert" {...props}>
        <div className="flex gap-3">
          {icon && (
            <div className={`flex-shrink-0 ${variantClass.icon} mt-0.5`}>
              {icon}
            </div>
          )}

          <div className="flex-grow">
            {title && (
              <h3 className={`font-semibold ${titleColor} mb-1`}>
                {title}
              </h3>
            )}
            <div className={`text-sm ${textColor}`}>
              {children}
            </div>
          </div>

          {dismissable && (
            <button
              onClick={onDismiss}
              className={`flex-shrink-0 ${variantClass.icon} hover:opacity-70 transition-opacity`}
              aria-label="Dismiss alert"
            >
              <svg
                className="w-5 h-5"
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
        </div>
      </div>
    );
  }
);

Alert.displayName = 'Alert';
