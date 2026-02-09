'use client';

import Link from 'next/link';

type ProfileField = {
  name: string;
  label: string;
  filled: boolean;
  required: boolean;
};

type InlineChatProfileProgressProps = {
  fields: ProfileField[];
  completionPercentage: number;
  onContinueToProfile?: () => void;
};

/**
 * Inline profile completion progress indicator for chat.
 * Shows which fields are complete and provides a link to the full profile page.
 */
export function InlineChatProfileProgress({
  fields,
  completionPercentage,
  onContinueToProfile,
}: InlineChatProfileProgressProps) {
  const filledCount = fields.filter((f) => f.filled).length;
  const totalRequired = fields.filter((f) => f.required).length;
  const filledRequired = fields.filter((f) => f.required && f.filled).length;

  return (
    <div className="bg-muted rounded-lg p-4 max-w-sm">
      {/* Header with percentage */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground">Profile Progress</span>
        </div>
        <span className="text-lg font-bold text-primary">{completionPercentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {/* Field checklist */}
      <div className="space-y-1.5 mb-3">
        {fields.map((field) => (
          <div key={field.name} className="flex items-center gap-2 text-sm">
            {field.filled ? (
              <svg
                className="w-4 h-4 text-green-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-muted-foreground flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01"
                />
              </svg>
            )}
            <span className={field.filled ? 'text-foreground' : 'text-muted-foreground'}>
              {field.label}
              {field.required && !field.filled && (
                <span className="text-destructive ml-1">*</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Status message */}
      <div className="text-xs text-muted-foreground mb-3">
        {filledRequired === totalRequired ? (
          <span className="text-green-600 dark:text-green-400">
            All required fields complete!
          </span>
        ) : (
          <span>
            {filledRequired} of {totalRequired} required fields complete
          </span>
        )}
      </div>

      {/* Link to full profile */}
      <Link
        href="/profile"
        className="flex items-center justify-center gap-2 w-full py-2 px-4 text-sm font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/10 transition-colors"
        onClick={onContinueToProfile}
      >
        <span>Continue to full profile</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Link>
    </div>
  );
}
