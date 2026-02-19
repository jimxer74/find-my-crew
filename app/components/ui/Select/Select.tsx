'use client';

import { forwardRef } from 'react';
import { COMPONENT_SIZES, ACCESSIBILITY, SPACING } from '@/app/lib/designTokens';
import { SelectProps } from './Select.types';

/**
 * Select component - Dropdown select field with options
 *
 * @example
 * // Basic select
 * <Select
 *   label="Choose an option"
 *   options={[
 *     { value: 'opt1', label: 'Option 1' },
 *     { value: 'opt2', label: 'Option 2' },
 *   ]}
 * />
 *
 * // With optgroups
 * <Select
 *   label="Choose a category"
 *   optgroups={[
 *     {
 *       label: 'Group 1',
 *       options: [{ value: 'opt1', label: 'Option 1' }],
 *     },
 *   ]}
 * />
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options = [],
      optgroups,
      placeholder,
      error,
      hasError = false,
      helperText,
      className = '',
      selectClassName = '',
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
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const selectSizeClasses = COMPONENT_SIZES.input.default;
    const focusClasses = ACCESSIBILITY.focusRing;

    const baseSelectClasses = 'w-full rounded border bg-background text-foreground transition-colors appearance-none';
    const borderClasses = hasError || error ? 'border-red-500' : 'border-border';
    const stateClasses = disabled
      ? 'cursor-not-allowed opacity-50'
      : 'hover:border-gray-400';

    const paddingAdjustment = leftIcon ? 'pl-10' : 'pl-3';

    const finalSelectClassName = `
      ${baseSelectClasses}
      ${borderClasses}
      ${stateClasses}
      ${selectSizeClasses}
      ${focusClasses}
      ${paddingAdjustment}
      pr-10
      ${selectClassName}
    `.trim();

    const wrapperClasses = `flex flex-col gap-1 ${className}`;

    return (
      <div className={wrapperClasses}>
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}

          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={finalSelectClassName}
            aria-invalid={hasError || !!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
            aria-required={required}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}

            {optgroups ? (
              optgroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))
            ) : (
              options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))
            )}
          </select>

          {/* Dropdown arrow icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400 pointer-events-none">
            {rightIcon || (
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
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            )}
          </div>
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

Select.displayName = 'Select';
