'use client';

import { forwardRef } from 'react';
import { ACCESSIBILITY } from '@/app/lib/designTokens';
import { RadioProps, RadioGroupProps } from './Radio.types';

/**
 * Radio component - Single selectable radio button with label
 *
 * @example
 * // Basic radio
 * <Radio name="option" value="option1" label="Option 1" />
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  (
    {
      label,
      className = '',
      radioClassName = '',
      helperText,
      error,
      hasError = false,
      required = false,
      disabled = false,
      id,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${radioId}-error`;
    const helperId = `${radioId}-helper`;

    const focusClasses = ACCESSIBILITY.focusRing;

    const baseRadioClasses = 'w-5 h-5 rounded-full border cursor-pointer transition-colors';
    const borderClasses = hasError || error ? 'border-red-500' : 'border-border';
    const stateClasses = disabled
      ? 'cursor-not-allowed opacity-50'
      : 'hover:border-gray-400 checked:bg-primary checked:border-primary';

    const finalRadioClassName = `
      ${baseRadioClasses}
      ${borderClasses}
      ${stateClasses}
      ${focusClasses}
      ${radioClassName}
    `.trim();

    const wrapperClasses = `flex flex-col gap-2 ${className}`;

    return (
      <div className={wrapperClasses}>
        <label htmlFor={radioId} className="flex items-center gap-2 cursor-pointer">
          <input
            ref={ref}
            type="radio"
            id={radioId}
            disabled={disabled}
            className={finalRadioClassName}
            aria-invalid={hasError || !!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
            aria-required={required}
            {...props}
          />

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

Radio.displayName = 'Radio';

/**
 * RadioGroup component - Group of radio buttons
 *
 * @example
 * // Radio group
 * <RadioGroup
 *   name="experience"
 *   options={[
 *     { value: 'beginner', label: 'Beginner' },
 *     { value: 'intermediate', label: 'Intermediate' },
 *     { value: 'expert', label: 'Expert' },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 * />
 */
export const RadioGroup = forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  (
    {
      label,
      options,
      value,
      onChange,
      error,
      hasError = false,
      required = false,
      orientation = 'vertical',
      className = '',
      name = '',
      id,
    },
    ref
  ) => {
    const groupId = id || `radio-group-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${groupId}-error`;

    const containerClasses = orientation === 'horizontal' ? 'flex gap-4' : 'flex flex-col gap-3';

    return (
      <fieldset ref={ref} id={groupId} className={`flex flex-col gap-3 ${className}`}>
        {label && (
          <legend className="text-sm font-medium text-foreground flex items-center gap-1">
            {label}
            {required && <span className="text-red-500">*</span>}
          </legend>
        )}

        <div className={containerClasses} role="group" aria-labelledby={label ? groupId : undefined}>
          {options.map((option) => (
            <div key={option.value} className="flex items-start">
              <Radio
                name={name}
                value={option.value}
                label={option.label}
                helperText={option.helperText}
                checked={value === option.value}
                onChange={(e) => onChange?.(e.currentTarget.value)}
                disabled={option.disabled}
                required={required}
                hasError={hasError && value === option.value}
              />
            </div>
          ))}
        </div>

        {error && (
          <p id={errorId} className="text-xs font-medium text-red-500">
            {error}
          </p>
        )}
      </fieldset>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';
