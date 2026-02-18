'use client';

import React from 'react';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Loading state - shows spinner and changes text */
  isLoading?: boolean;
  /** Text to display while loading (default: "Loading...") */
  loadingText?: string;
  /** Button content - can be string or React node */
  children: React.ReactNode;
  /** Button variant for different styles */
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width button */
  fullWidth?: boolean;
  /** Spinner color (defaults to currentColor) */
  spinnerColor?: string;
}

const variantClasses = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50',
  secondary: 'bg-secondary text-secondary-foreground hover:opacity-90 disabled:opacity-50',
  destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-50',
  outline: 'border border-border bg-background hover:bg-accent disabled:opacity-50 text-foreground',
  ghost: 'hover:bg-accent disabled:opacity-50 text-foreground',
};

const sizeClasses = {
  sm: 'py-2 px-3 text-sm',
  md: 'py-3 px-4 text-base',
  lg: 'py-4 px-6 text-lg',
};

const spinnerSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function LoadingButton({
  isLoading = false,
  loadingText = 'Loading...',
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  spinnerColor = 'currentColor',
  className = '',
  disabled = false,
  ...props
}: LoadingButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-opacity disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring';

  const widthClass = fullWidth ? 'w-full' : '';
  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  const spinnerSize = spinnerSizes[size];

  const combinedClassName = `${baseClasses} ${sizeClass} ${variantClass} ${widthClass} ${className}`.trim();

  return (
    <button
      disabled={disabled || isLoading}
      className={combinedClassName}
      {...props}
    >
      {isLoading && (
        <svg
          className={`animate-spin ${spinnerSize}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          style={{ color: spinnerColor }}
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      <span>{isLoading ? loadingText : children}</span>
    </button>
  );
}
