'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useEmailVerificationStatus } from '@/app/hooks/useEmailVerificationStatus';
import { Button } from '@/app/components/ui/Button/Button';

interface EmailVerificationBannerProps {
  userEmail?: string;
}

export function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
  const { isVerified, isLoading, resendVerification, canResend, getCooldownRemaining } = useEmailVerificationStatus();
  const [resendMessage, setResendMessage] = useState<string>('');
  const [showResendSuccess, setShowResendSuccess] = useState(false);

  // Don't show banner while loading or if user is verified
  // isVerified is null initially, false if not verified, true if verified
  if (isLoading || isVerified === null || isVerified === true) {
    return null;
  }

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
    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="font-medium">Email Verification Required</span>
          </div>
          <p className="text-sm text-yellow-700 mb-3">
            Your email address hasn&apos;t been verified yet. Please check your inbox for a verification email from SailSmart.
            {userEmail && (
              <span className="block mt-1 font-medium">Sent to: {userEmail}</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleResend}
              disabled={!canResend()}
              variant="primary"
              size="sm"
              className="!bg-yellow-600 hover:!bg-yellow-700"
            >
              {canResend() ? 'Resend Verification Email' : `Resend in ${getCooldownRemaining()}s`}
            </Button>
            <Link href="/help/verify-email">
              <Button
                variant="secondary"
                size="sm"
                className="!bg-yellow-100 !text-yellow-800 hover:!bg-yellow-200"
              >
                Need Help?
              </Button>
            </Link>
          </div>
          {resendMessage && (
            <p className={`mt-2 text-sm ${showResendSuccess ? 'text-green-600' : 'text-red-600'}`}>
              {resendMessage}
            </p>
          )}
        </div>
        <Button
          onClick={() => setShowResendSuccess(false)}
          variant="ghost"
          size="sm"
          className="!text-yellow-600 hover:!text-yellow-800 flex-shrink-0 !p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>
    </div>
  );
}