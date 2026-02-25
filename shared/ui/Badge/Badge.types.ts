import { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Badge content
   */
  children: ReactNode;

  /**
   * Visual style variant
   * @default 'primary'
   */
  variant?: BadgeVariant;

  /**
   * Badge size
   * @default 'md'
   */
  size?: BadgeSize;

  /**
   * Whether to show as a dot badge (small circle)
   */
  dot?: boolean;

  /**
   * Custom class names
   */
  className?: string;

  /**
   * Optional icon displayed before the content
   */
  icon?: ReactNode;

  /**
   * Whether badge is dismissable (shows close button)
   */
  dismissable?: boolean;

  /**
   * Callback when badge is dismissed
   */
  onDismiss?: () => void;

  /**
   * Whether badge is outlined (inverse style)
   */
  outlined?: boolean;

  /**
   * Optional tooltip text
   */
  title?: string;
}
