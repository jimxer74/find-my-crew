'use client';

import { forwardRef } from 'react';
import { COMPONENT_SIZES, ACCESSIBILITY } from '@/app/lib/designTokens';
import { ButtonProps } from './Button.types';

const variantClasses = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
  ghost: 'bg-transparent text-foreground hover:bg-accent active:bg-accent/80',
  outline: 'border border-input bg-background text-foreground hover:bg-accent active:bg-accent/50',
};

/**
 * Button component - A versatile button with multiple variants and sizes
 *
 * @example
 * // Primary button
 * <Button>Click me</Button>
 *
 * @example
 * // With icon
 * <Button leftIcon={<ChevronLeft />}>Back</Button>
 *
 * @example
 * // Loading state
 * <Button isLoading>Saving...</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      disabled = false,
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = COMPONENT_SIZES.button[size];
    const variantClass = variantClasses[variant];
    const widthClass = fullWidth ? 'w-full' : '';
    const disabledClass = disabled || isLoading ? 'opacity-50 cursor-not-allowed' : '';

    const baseClasses =
      'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-200 whitespace-nowrap';

    const finalClassName = `
      ${baseClasses}
      ${sizeClasses}
      ${variantClass}
      ${ACCESSIBILITY.focusRing}
      ${widthClass}
      ${disabledClass}
      ${className}
    `.trim();

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={finalClassName}
        {...props}
      >
        {isLoading && (
          <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
        )}
        {!isLoading && leftIcon && <span className="flex items-center">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
