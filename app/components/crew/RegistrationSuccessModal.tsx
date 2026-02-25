'use client';

import { Modal, Button } from '@shared/ui';

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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={autoApproved ? 'Registration Approved! 🎉' : 'Registration Submitted'}
      size="sm"
      footer={
        <Button
          variant="primary"
          onClick={onClose}
          className="w-full"
        >
          {autoApproved ? 'View Dashboard' : 'Got it'}
        </Button>
      }
    >
      <div className="text-center space-y-4">
        {/* Success Icon */}
        <div className="flex justify-center">
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

        {autoApproved ? (
          <>
            <p className="text-sm text-muted-foreground">
              Congratulations! You've been automatically approved to join:
            </p>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 text-left border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-foreground mb-1">{legName}</p>
              <p className="text-xs text-muted-foreground">{journeyName}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              You can now view the leg details and prepare for the journey. Check your dashboard for more information.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Your registration for the following has been submitted:
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-left border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-foreground mb-1">{legName}</p>
              <p className="text-xs text-muted-foreground">{journeyName}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              The boat owner is reviewing your registration. You'll receive a notification once they've made a decision.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
