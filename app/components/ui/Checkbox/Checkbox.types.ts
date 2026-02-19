import { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Label displayed next to the checkbox
   */
  label?: string | ReactNode;

  /**
   * Custom class names for the wrapper
   */
  className?: string;

  /**
   * Custom class names for the checkbox input
   */
  checkboxClassName?: string;

  /**
   * Helper text displayed below the checkbox
   */
  helperText?: string;

  /**
   * Error message displayed below the checkbox
   */
  error?: string;

  /**
   * Whether the checkbox has an error
   */
  hasError?: boolean;

  /**
   * Whether the checkbox is required
   */
  required?: boolean;

  /**
   * Icon to show inside the checkbox when checked
   */
  icon?: ReactNode;
}
