import { HTMLAttributes, ReactNode } from 'react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Alert content
   */
  children: ReactNode;

  /**
   * Alert variant/severity level
   * @default 'info'
   */
  variant?: AlertVariant;

  /**
   * Optional title shown above the message
   */
  title?: string | ReactNode;

  /**
   * Custom class names
   */
  className?: string;

  /**
   * Whether alert is dismissable (shows close button)
   */
  dismissable?: boolean;

  /**
   * Callback when alert is dismissed
   */
  onDismiss?: () => void;

  /**
   * Optional icon displayed before the content
   */
  icon?: ReactNode;

  /**
   * Whether alert has a border on the left (accent bar)
   */
  bordered?: boolean;
}
