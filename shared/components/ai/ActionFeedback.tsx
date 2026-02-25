'use client';

import { Button } from '@shared/ui/Button/Button';

interface ActionFeedbackProps {
  result: {
    success: boolean;
    message: string;
    actionId: string;
  } | null;
  onDismiss: () => void;
}

export function ActionFeedback({ result, onDismiss }: ActionFeedbackProps) {
  if (!result) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 w-96 ${
      result.success
        ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
    } border rounded-lg shadow-lg p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {result.success ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">
              {result.success ? 'Success' : 'Error'}
            </span>
          </div>
          <p className="text-sm">{result.message}</p>
        </div>
        <Button
          onClick={onDismiss}
          variant="ghost"
          size="sm"
          className="ml-2 !p-0 !text-gray-400 hover:!text-gray-600 dark:hover:!text-gray-200 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>
    </div>
  );
}