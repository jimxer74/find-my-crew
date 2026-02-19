'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Modal, Button } from '@/app/components/ui';
import { useEmailVerificationStatus } from '@/app/hooks/useEmailVerificationStatus';

interface EmailConfirmationModalProps {
  email: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EmailConfirmationModal({ email, isOpen, onClose }: EmailConfirmationModalProps) {
  const { resendVerification, canResend, getCooldownRemaining } = useEmailVerificationStatus();
  const [resendMessage, setResendMessage] = useState<string>('');
  const [showResendSuccess, setShowResendSuccess] = useState(false);
  const [autoCloseTimer, setAutoCloseTimer] = useState(10);

  // Auto-close timer
  useEffect(() => {
    if (!isOpen) {
      setAutoCloseTimer(10);
      return;
    }

    const timer = setInterval(() => {
      setAutoCloseTimer((prev) => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onClose]);

  const handleResend = async () => {
    const result = await resendVerification();
    setResendMessage(result.message);

    if (result.success) {
      setShowResendSuccess(true);
      // Clear success message after 3 seconds
      setTimeout(() => {
        setShowResendSuccess(false);
        setResendMessage('');
      }, 3000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Check Your Email"
      size="sm"
      footer={
        <div className="space-y-3 w-full">
          <Button
            variant="primary"
            onClick={onClose}
            className="w-full"
          >
            Continue to SailSmart
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            This modal will auto-close in {autoCloseTimer} seconds
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header Icon & Subtitle */}
        <div className="text-center -mt-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 7.89a2 2 0 002.82 0L21 8M4 12h16" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            We've sent a verification email to get you started
          </p>
        </div>

        {/* Email address */}
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-medium text-foreground">Email sent to:</p>
          <p className="mt-1 text-lg font-semibold text-primary">{email}</p>
        </div>

        {/* Instructions */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">Open your email</p>
              <p className="text-sm text-muted-foreground">Look for an email from SailSmart</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">Click the verification link</p>
              <p className="text-sm text-muted-foreground">This will verify your email address</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">You can start using SailSmart</p>
              <p className="text-sm text-muted-foreground">You don't need to wait for verification to continue</p>
            </div>
          </div>
        </div>

        {/* Resend email */}
        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground mb-3">Didn't receive the email?</p>
          <Button
            variant="primary"
            onClick={handleResend}
            disabled={!canResend()}
            className="w-full"
          >
            {canResend() ? (
              'Resend Verification Email'
            ) : (
              `Resend in ${getCooldownRemaining()}s`
            )}
          </Button>
          {resendMessage && (
            <p className={`mt-2 text-sm text-center ${showResendSuccess ? 'text-green-600' : 'text-destructive'}`}>
              {resendMessage}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}