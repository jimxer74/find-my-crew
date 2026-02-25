'use client';

import { forwardRef, useEffect } from 'react';
import { Z_INDEX, SPACING } from '@shared/ui/designTokens';
import { ModalProps } from './Modal.types';

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
};

/**
 * Modal component - Overlay dialog for focused user interaction
 *
 * @example
 * // Basic modal
 * <Modal isOpen={isOpen} onClose={handleClose} title="Confirm Action">
 *   <p>Are you sure?</p>
 *   <div className="flex gap-2 justify-end mt-4">
 *     <Button onClick={handleClose}>Cancel</Button>
 *     <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
 *   </div>
 * </Modal>
 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      children,
      footer,
      size = 'md',
      showCloseButton = true,
      closeOnBackdropClick = true,
      closeOnEscape = true,
      className = '',
      contentClassName = '',
      headerClassName = '',
      bodyClassName = '',
      footerClassName = '',
      centered = true,
      scrollable = false,
      ...props
    },
    ref
  ) => {
    // Handle escape key
    useEffect(() => {
      if (!isOpen || !closeOnEscape) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, closeOnEscape, onClose]);

    // Handle body scroll lock
    
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }

      return () => {
        document.body.style.overflow = 'unset';
      };
    }, [isOpen]);


    if (!isOpen) return null;

    const backdropClasses = `fixed inset-0 bg-black/50 transition-opacity`;
    const containerClasses = centered
      ? 'flex items-center justify-center'
      : 'flex items-start justify-center pt-20';

    const sizeClass = sizeClasses[size];

    const modalClasses = `
      relative bg-background text-foreground rounded-lg shadow-xl
      w-full mx-4 ${sizeClass}
      ${className}
    `.trim();

    return (
      <>
        {/* Backdrop */}
        <div
          className={backdropClasses}
          onClick={() => closeOnBackdropClick && onClose()}
          style={{ zIndex: Z_INDEX.modalBackdrop }}
          aria-hidden="true"
        />

        {/* Modal Container */}
        <div
          className={`fixed inset-0 ${containerClasses}`}
          style={{ zIndex: Z_INDEX.modal }}
        >
          <div
            ref={ref}
            className={modalClasses}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            {...props}
          >
            {/* Header */}
            {title && (
              <div className={`border-b border-border ${SPACING.md} flex items-center justify-between ${headerClassName}`}>
                <h2 id="modal-title" className="text-lg font-semibold">
                  {title}
                </h2>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-6 h-6 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    aria-label="Close modal"
                  >
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div
              className={`
                ${SPACING.md}
                ${bodyClassName}
                max-h-[80vh]          // ← softer limit or remove completely
                overflow-y-auto
              `}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className={`border-t border-border ${SPACING.md} flex items-center justify-end gap-2 ${footerClassName}`}>
                {footer}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
);

Modal.displayName = 'Modal';
