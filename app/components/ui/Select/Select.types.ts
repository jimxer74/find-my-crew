import { SelectHTMLAttributes, ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: string | ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Select label displayed above the select field
   */
  label?: string | ReactNode;

  /**
   * Array of options for the select
   */
  options: SelectOption[];

  /**
   * Placeholder text when no option is selected
   */
  placeholder?: string;

  /**
   * Error message displayed below the select
   */
  error?: string;

  /**
   * Whether the select has an error (affects styling)
   */
  hasError?: boolean;

  /**
   * Helper text displayed below the select
   */
  helperText?: string;

  /**
   * Custom class names for the wrapper
   */
  className?: string;

  /**
   * Custom class names for the select element itself
   */
  selectClassName?: string;

  /**
   * Optional icon or element displayed on the left side
   */
  leftIcon?: ReactNode;

  /**
   * Optional icon or element displayed on the right side (arrow icon by default)
   */
  rightIcon?: ReactNode;

  /**
   * Whether the select is required
   */
  required?: boolean;

  /**
   * Group options by optgroup
   */
  optgroups?: Array<{
    label: string;
    options: SelectOption[];
  }>;
}
