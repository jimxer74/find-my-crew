'use client';

import { forwardRef } from 'react';
import { COMPONENT_SIZES, ACCESSIBILITY, SPACING } from '@/app/lib/designTokens';
import { InputProps } from './Input.types';

/**
 * Input component - Text input field with validation states
 *
 * @example
 * // Basic input
 * <Input placeholder="Enter text" />
 *
 * // With label and error
 * <Input
 *   label="Email"
 *   type="email"
 *   error="Invalid email format"
 *   hasError={true}
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hasError = false,
      helperText,
      className = '',
      inputClassName = '',
      leftIcon,
      rightIcon,
      required = false,
      disabled = false,
      id,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const inputSizeClasses = COMPONENT_SIZES.input.default;
    const focusClasses = ACCESSIBILITY.focusRing;

    const baseInputClasses = 'w-full rounded border bg-background text-foreground transition-colors';
    const borderClasses = hasError || error ? 'border-red-500' : 'border-border';
    const stateClasses = disabled
      ? 'cursor-not-allowed opacity-50'
      : 'hover:border-gray-400';

    const iconWrapperClasses = 'absolute top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 pointer-events-none';
    const paddingAdjustment = leftIcon && rightIcon ? 'pl-10 pr-10' : leftIcon ? 'pl-10' : rightIcon ? 'pr-10' : '';

    const finalInputClassName = `
      ${baseInputClasses}
      ${borderClasses}
      ${stateClasses}
      ${inputSizeClasses}
      ${focusClasses}
      ${paddingAdjustment}
      ${inputClassName}
    `.trim();

    const wrapperClasses = `flex flex-col gap-1 ${className}`;

    return (
      <div className={wrapperClasses}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className={`${iconWrapperClasses} left-3`}>
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={finalInputClassName}
            aria-invalid={hasError || !!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
            aria-required={required}
            {...props}
          />

          {rightIcon && (
            <div className={`${iconWrapperClasses} right-3`}>
              {rightIcon}
            </div>
          )}
        </div>

        {(error || helperText) && (
          <p
            id={error ? errorId : helperId}
            className={`text-xs font-medium ${
              error ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
