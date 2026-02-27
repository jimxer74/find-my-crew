'use client';

import { Button } from '@shared/ui/Button/Button';

interface CheckpointField {
  label: string;
  value: string | number | null | undefined;
}

interface CheckpointCardProps {
  title: string;
  subtitle?: string;
  fields: CheckpointField[];
  onConfirm: () => void;
  onEdit?: () => void;
  onSkip?: () => void;
  isLoading?: boolean;
  confirmLabel?: string;
  skipLabel?: string;
  variant?: 'required' | 'optional';
  children?: React.ReactNode;
}

export function CheckpointCard({
  title,
  subtitle,
  fields,
  onConfirm,
  onEdit,
  onSkip,
  isLoading,
  confirmLabel = 'Looks good, save it',
  skipLabel = 'Skip for now',
  variant = 'required',
  children,
}: CheckpointCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {/* Fields */}
      <div className="px-5 py-4 space-y-2.5">
        {fields.map((field) => (
          <div key={field.label} className="flex items-start gap-3">
            <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0 pt-0.5">
              {field.label}
            </span>
            <span className="text-sm text-foreground break-words min-w-0">
              {field.value ?? <span className="text-muted-foreground italic">Not provided</span>}
            </span>
          </div>
        ))}
        {children}
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} disabled={isLoading}>
              Edit
            </Button>
          )}
          {variant === 'optional' && onSkip && (
            <Button variant="ghost" size="sm" onClick={onSkip} disabled={isLoading}>
              {skipLabel}
            </Button>
          )}
        </div>
        <Button onClick={onConfirm} disabled={isLoading} isLoading={isLoading} size="sm">
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
