'use client';

import { logger } from '@shared/logging';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { Modal } from '@shared/ui/Modal/Modal';
import { Button } from '@shared/ui/Button/Button';

type SignupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  /** When provided, stores prospect preferences in user metadata and uses prospect redirect flow. fullName prefills the name field if the user shared it in chat. */
  prospectPreferences?: Record<string, unknown>;
  /** Custom redirect path after signup. If not provided, defaults to /welcome/crew for prospect flow or / for other flows. */
  redirectPath?: string;
};

export function SignupModal({ isOpen, onClose, onSwitchToLogin, prospectPreferences, redirectPath }: SignupModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill full name from prospect chat when user shared it before signup
  // Check multiple possible property names to ensure we catch it
  const prefilledName =
    (prospectPreferences?.fullName as string)?.trim() ||
    (prospectPreferences?.full_name as string)?.trim() ||
    '';
  
  // Log whenever prospectPreferences change
  useEffect(() => {
    logger.debug('[SignupModal] prospectPreferences changed:', { prospectPreferences });
    logger.debug('[SignupModal] Extracted prefilledName:', { prefilledName });
  }, [prospectPreferences, prefilledName]);
  
  useEffect(() => {
    // Always set the name when modal opens if we have a prefilled name
    // Also update if prefilledName changes while modal is open
    logger.debug('[SignupModal] Modal state - isOpen:', { isOpen, prefilledName, prospectPreferences });
    if (isOpen && prefilledName) {
      logger.debug('[SignupModal] Prefilling full name:', { prefilledName, fullName });
      setFullName(prefilledName);
    } else if (isOpen && !prefilledName) {
      // Log when modal opens but no name is available
      logger.debug('[SignupModal] Modal opened but no prefilled name available. prospectPreferences:', { prospectPreferences });
    } else if (!isOpen) {
      // Clear the form when modal closes
      setFullName('');
      setEmail('');
      setPassword('');
      setError(null);
    }
  }, [isOpen, prefilledName, prospectPreferences]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    try {
      // Build user metadata
      const userMetadata: Record<string, unknown> = {
        full_name: fullName,
      };

      // Include prospect preferences if coming from prospect chat flow
      if (prospectPreferences) {
        userMetadata.prospect_preferences = prospectPreferences;
      }

      const redirectTo = prospectPreferences
        ? `${window.location.origin}/auth/callback?from=prospect`
        : redirectPath?.includes('/welcome/owner')
          ? `${window.location.origin}/auth/callback?from=owner`
          : undefined;



      logger.debug('[SignupModal-EXTRA] Redirecting to:', { redirectTo });

      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userMetadata,
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        onClose();

        // Determine redirect path
        if (redirectPath) {
          // Use custom redirect path if provided (e.g., for owner chat)
          logger.debug('[SignupModal-EXTRA] Redirecting to custom path:', { redirectPath });
          router.push(redirectPath);
        } else if (prospectPreferences) {
          // For prospect flow, stay on the chat page with profile_completion mode
          // The consent modal will open on this page, and after consent the chat continues
          logger.debug('[SignupModal-EXTRA] Redirecting to /welcome/crew');
          router.push('/welcome/crew?profile_completion=true');
        } else {
          // Non-prospect signup - redirect to home page
          logger.debug('[SignupModal-EXTRA] DEFAULT /');
          router.push('/');
        }
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignup = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    // Store preferences in localStorage before OAuth redirect (will be lost otherwise)
    if (prospectPreferences) {
      localStorage.setItem('prospect_signup_preferences', JSON.stringify(prospectPreferences));
    }

    // Determine OAuth callback redirect
    let callbackPath = '/auth/callback';
    if (redirectPath) {
      // If custom redirect path provided, determine callback parameter
      if (redirectPath.includes('/welcome/owner')) {
        callbackPath = '/auth/callback?from=owner';
      } else if (redirectPath.includes('/welcome/crew')) {
        callbackPath = '/auth/callback?from=prospect';
      }
    } else if (prospectPreferences) {
      callbackPath = '/auth/callback?from=prospect';
    }

    const redirectTo = `${window.location.origin}${callbackPath}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    // Store preferences in localStorage before OAuth redirect (will be lost otherwise)
    if (prospectPreferences) {
      localStorage.setItem('prospect_signup_preferences', JSON.stringify(prospectPreferences));
    }

    // Determine OAuth callback redirect
    let callbackPath = '/auth/callback';
    if (redirectPath) {
      // If custom redirect path provided, determine callback parameter
      if (redirectPath.includes('/welcome/owner')) {
        callbackPath = '/auth/callback?from=owner';
      } else if (redirectPath.includes('/welcome/crew')) {
        callbackPath = '/auth/callback?from=prospect';
      }
    } else if (prospectPreferences) {
      callbackPath = '/auth/callback?from=prospect';
    }

    const redirectTo = `${window.location.origin}${callbackPath}`;

    logger.debug('[SignupModal-EXTRA] GOOGLE Redirecting to:', { redirectTo });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create your account"
      size="md"
      showCloseButton={true}
      closeOnBackdropClick={true}
      closeOnEscape={true}
    >
      <div className="space-y-6">
        <p className="text-center text-sm text-muted-foreground">
          Or{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-medium text-primary hover:opacity-80 transition-opacity"
          >
            log in to your existing account
          </button>
        </p>

        <form className="space-y-6" onSubmit={handleSignUp}>
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Social signup buttons - Order: Facebook, Google */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleFacebookSignup}
              disabled={loading}
              variant="outline"
              fullWidth={true}
              leftIcon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              }
            >
              Continue with Facebook
            </Button>

            <Button
              type="button"
              onClick={handleGoogleSignup}
              disabled={loading}
              variant="outline"
              fullWidth={true}
              leftIcon={
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              }
            >
              Continue with Google
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-background text-muted-foreground">Or sign up with email</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            fullWidth={true}
            isLoading={loading}
          >
            {loading ? 'Creating account...' : 'Sign up with email'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By signing up, you agree to set up your privacy preferences after login.
          </p>
        </form>
      </div>
    </Modal>
  );
}
