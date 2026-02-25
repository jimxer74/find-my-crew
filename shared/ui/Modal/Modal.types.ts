import { HTMLAttributes, ReactNode } from 'react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should close (e.g., clicking backdrop or close button)
   */
  onClose: () => void;

  /**
   * Modal title
   */
  title?: string | ReactNode;

  /**
   * Modal content
   */
  children: ReactNode;

  /**
   * Modal footer content (typically buttons)
   */
  footer?: ReactNode;

  /**
   * Modal size
   * @default 'md'
   */
  size?: ModalSize;

  /**
   * Whether to show close button
   * @default true
   */
  showCloseButton?: boolean;

  /**
   * Whether clicking the backdrop closes the modal
   * @default true
   */
  closeOnBackdropClick?: boolean;

  /**
   * Whether clicking escape key closes the modal
   * @default true
   */
  closeOnEscape?: boolean;

  /**
   * Custom class names for the modal container
   */
  className?: string;

  /**
   * Custom class names for the modal content
   */
  contentClassName?: string;

  /**
   * Custom class names for the modal header
   */
  headerClassName?: string;

  /**
   * Custom class names for the modal body
   */
  bodyClassName?: string;

  /**
   * Custom class names for the modal footer
   */
  footerClassName?: string;

  /**
   * Whether the modal is centered vertically
   * @default true
   */
  centered?: boolean;

  /**
   * Whether the modal allows scrolling inside the body
   * @default false
   */
  scrollable?: boolean;
}
