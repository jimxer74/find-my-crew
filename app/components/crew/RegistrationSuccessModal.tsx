'use client';

import { createPortal } from 'react-dom';

type RegistrationSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  autoApproved: boolean;
  legName: string;
  journeyName: string;
};

export function RegistrationSuccessModal({
  isOpen,
  onClose,
  autoApproved,
  legName,
  journeyName,
}: RegistrationSuccessModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-xl border border-border max-w-md w-full">
        {/* Success Icon */}
        <div className="flex justify-center pt-8">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600 dark:text-green-400"
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
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {autoApproved ? 'Registration Approved! 🎉' : 'Registration Submitted'}
          </h2>

          {autoApproved ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Congratulations! You've been automatically approved to join:
              </p>
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 mb-6 text-left border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-foreground mb-1">{legName}</p>
                <p className="text-xs text-muted-foreground">{journeyName}</p>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                You can now view the leg details and prepare for the journey. Check your dashboard for more information.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Your registration for the following has been submitted:
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mb-6 text-left border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-foreground mb-1">{legName}</p>
                <p className="text-xs text-muted-foreground">{journeyName}</p>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                The boat owner is reviewing your registration. You'll receive a notification once they've made a decision.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <button
            onClick={onClose}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {autoApproved ? 'View Dashboard' : 'Got it'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
