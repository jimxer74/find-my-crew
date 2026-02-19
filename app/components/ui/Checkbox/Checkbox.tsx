'use client';

import { forwardRef } from 'react';
import { ACCESSIBILITY } from '@/app/lib/designTokens';
import { CheckboxProps } from './Checkbox.types';

/**
 * Checkbox component - Single selectable checkbox with label
 *
 * @example
 * // Basic checkbox
 * <Checkbox label="Accept terms" />
 *
 * // With error state
 * <Checkbox
 *   label="I agree"
 *   error="This field is required"
 *   hasError={true}
 *   required={true}
 * />
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      className = '',
      checkboxClassName = '',
      helperText,
      error,
      hasError = false,
      required = false,
      disabled = false,
      id,
      icon,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${checkboxId}-error`;
    const helperId = `${checkboxId}-helper`;

    const focusClasses = ACCESSIBILITY.focusRing;

    const baseCheckboxClasses = 'w-5 h-5 rounded border cursor-pointer transition-colors';
    const borderClasses = hasError || error ? 'border-red-500' : 'border-border';
    const stateClasses = disabled
      ? 'cursor-not-allowed opacity-50'
      : 'hover:border-gray-400 checked:bg-primary checked:border-primary';

    const finalCheckboxClassName = `
      ${baseCheckboxClasses}
      ${borderClasses}
      ${stateClasses}
      ${focusClasses}
      ${checkboxClassName}
    `.trim();

    const wrapperClasses = `flex flex-col gap-2 ${className}`;

    return (
      <div className={wrapperClasses}>
        <label htmlFor={checkboxId} className="flex items-center gap-2 cursor-pointer">
          <div className="relative flex items-center justify-center">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              disabled={disabled}
              className={finalCheckboxClassName}
              aria-invalid={hasError || !!error}
              aria-describedby={error ? errorId : helperText ? helperId : undefined}
              aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
              aria-required={required}
              {...props}
            />
            {icon && (
              <span className="absolute pointer-events-none text-white text-sm">
                {icon}
              </span>
            )}
          </div>

          {label && (
            <span className="text-sm font-medium text-foreground flex items-center gap-1">
              {label}
              {required && <span className="text-red-500">*</span>}
            </span>
          )}
        </label>

        {(error || helperText) && (
          <p
            id={error ? errorId : helperId}
            className={`text-xs font-medium ml-7 ${
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

Checkbox.displayName = 'Checkbox';
