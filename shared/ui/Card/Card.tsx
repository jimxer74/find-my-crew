'use client';

import { forwardRef } from 'react';
import { SPACING } from '@shared/ui/designTokens';
import { CardProps, CardHeaderProps, CardBodyProps, CardFooterProps } from './Card.types';

const paddingMap = {
  sm: SPACING.sm,
  md: SPACING.md,
  lg: SPACING.lg,
};

/**
 * Card component - Container for grouping related content
 *
 * @example
 * // Basic card
 * import { Card, CardHeader, CardBody } from '@/app/components/ui';
 *
 * <Card>
 *   <CardHeader>Title</CardHeader>
 *   <CardBody>Content here</CardBody>
 * </Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { bordered = true, shadow = true, padding = 'md', className = '', children, ...props },
    ref
  ) => {
    const paddingClass = paddingMap[padding];
    const borderClass = bordered ? 'border border-border' : '';
    const shadowClass = shadow ? 'shadow-sm' : '';

    const baseClasses = 'rounded-lg bg-card text-card-foreground';

    const finalClassName = `
      ${baseClasses}
      ${borderClass}
      ${shadowClass}
      ${paddingClass}
      ${className}
    `.trim();

    return (
      <div ref={ref} className={finalClassName} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Card header - For card titles and actions
 */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`pb-${SPACING.md} border-b border-border ${className}`} {...props}>
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

/**
 * Card body - Main content area
 */
export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`py-${SPACING.md} ${className}`} {...props}>
      {children}
    </div>
  )
);

CardBody.displayName = 'CardBody';

/**
 * Card footer - For actions and metadata
 */
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`pt-${SPACING.md} border-t border-border ${className}`} {...props}>
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';
