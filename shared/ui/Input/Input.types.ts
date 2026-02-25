import { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Input label displayed above the input field
   */
  label?: string | ReactNode;

  /**
   * Error message displayed below the input
   */
  error?: string;

  /**
   * Whether the input has an error (affects styling)
   */
  hasError?: boolean;

  /**
   * Helper text displayed below the input
   */
  helperText?: string;

  /**
   * Custom class names for the wrapper
   */
  className?: string;

  /**
   * Custom class names for the input element itself
   */
  inputClassName?: string;

  /**
   * Optional icon or element displayed on the left side of the input
   */
  leftIcon?: ReactNode;

  /**
   * Optional icon or element displayed on the right side of the input
   */
  rightIcon?: ReactNode;

  /**
   * Whether the input is required
   */
  required?: boolean;
}
