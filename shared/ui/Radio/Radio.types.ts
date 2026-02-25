import { InputHTMLAttributes, ReactNode } from 'react';

export interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Label displayed next to the radio button
   */
  label?: string | ReactNode;

  /**
   * Custom class names for the wrapper
   */
  className?: string;

  /**
   * Custom class names for the radio input
   */
  radioClassName?: string;

  /**
   * Helper text displayed below the radio button
   */
  helperText?: string;

  /**
   * Error message displayed below the radio button
   */
  error?: string;

  /**
   * Whether the radio button has an error
   */
  hasError?: boolean;

  /**
   * Whether the radio button is required
   */
  required?: boolean;
}

export interface RadioGroupProps {
  /**
   * Label for the radio group
   */
  label?: string;

  /**
   * Options for the radio group
   */
  options: Array<{
    value: string;
    label: string | ReactNode;
    helperText?: string;
    disabled?: boolean;
  }>;

  /**
   * Currently selected value
   */
  value?: string;

  /**
   * Callback when selection changes
   */
  onChange?: (value: string) => void;

  /**
   * Error message for the group
   */
  error?: string;

  /**
   * Whether the group has an error
   */
  hasError?: boolean;

  /**
   * Whether the group is required
   */
  required?: boolean;

  /**
   * Orientation of radio buttons
   * @default 'vertical'
   */
  orientation?: 'horizontal' | 'vertical';

  /**
   * Custom class names for the wrapper
   */
  className?: string;

  /**
   * Name attribute for all radio buttons in the group
   */
  name?: string;

  /**
   * ID for the radio group
   */
  id?: string;
}
