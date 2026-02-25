'use client';

import { useState, useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@shared/database/client';

interface ResendVerificationResult {
  success: boolean;
  message: string;
  nextAllowedResend?: Date;
  error?: string;
}

export function useEmailVerificationStatus() {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResendTime, setLastResendTime] = useState<number>(0);
  const isMountedRef = useRef(true);
  const verificationCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Check verification status from user data
  const checkVerificationStatus = async () => {
    if (!isMountedRef.current) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        if (isMountedRef.current) {
          setError(error.message);
          setIsLoading(false);
        }
        return;
      }

      if (user) {
        const isEmailVerified = !!user.email_confirmed_at;
        if (isMountedRef.current) {
          setIsVerified(isEmailVerified);
          setIsLoading(false);
          setError(null);
        }
      } else {
        if (isMountedRef.current) {
          setIsVerified(false);
          setIsLoading(false);
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (isMountedRef.current) {
        setError(error.message || 'Failed to check verification status');
        setIsLoading(false);
      }
    }
  };

  // Resend verification email with rate limiting
  const resendVerification = async (): Promise<ResendVerificationResult> => {
    const now = Date.now();
    const cooldownPeriod = 60000; // 60 seconds

    if (now - lastResendTime < cooldownPeriod) {
      const remainingTime = Math.ceil((cooldownPeriod - (now - lastResendTime)) / 1000);
      return {
        success: false,
        message: `Please wait ${remainingTime} seconds before trying again.`,
        nextAllowedResend: new Date(now + cooldownPeriod)
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.resend({
        type: 'signup',
        email: ''
      });

      if (error) {
        throw error;
      }

      setLastResendTime(now);

      return {
        success: true,
        message: 'Verification email sent! Please check your inbox.',
        nextAllowedResend: new Date(now + cooldownPeriod)
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return {
        success: false,
        message: 'Failed to send verification email. Please try again later.',
        error: error.message
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Setup polling to check verification status
  useEffect(() => {
    isMountedRef.current = true;

    const setupPolling = async () => {
      // Initial check
      await checkVerificationStatus();

      // Poll every 30 seconds
      verificationCheckInterval.current = setInterval(() => {
        if (isMountedRef.current) {
          checkVerificationStatus();
        }
      }, 30000);
    };

    setupPolling();

    return () => {
      isMountedRef.current = false;
      if (verificationCheckInterval.current) {
        clearInterval(verificationCheckInterval.current);
        verificationCheckInterval.current = null;
      }
    };
  }, []);

  // Helper to check if resend is allowed
  const canResend = (): boolean => {
    const now = Date.now();
    const cooldownPeriod = 60000; // 60 seconds
    return now - lastResendTime >= cooldownPeriod;
  };

  // Get remaining cooldown time in seconds
  const getCooldownRemaining = (): number => {
    const now = Date.now();
    const cooldownPeriod = 60000; // 60 seconds
    const remaining = Math.ceil((cooldownPeriod - (now - lastResendTime)) / 1000);
    return Math.max(0, remaining);
  };

  return {
    isVerified,
    isLoading,
    error,
    resendVerification,
    canResend,
    getCooldownRemaining,
    checkVerificationStatus
  };
}