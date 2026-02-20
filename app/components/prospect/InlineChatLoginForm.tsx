'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { openOAuthPopup } from '@/app/lib/auth/oauthPopup';

type InlineChatLoginFormProps = {
  onSuccess?: () => void;
  onCancel?: () => void;
  onSwitchToSignup?: () => void;
};

/**
 * Inline login form styled to match the chat interface.
 * Appears as part of the conversation flow rather than a modal.
 */
export function InlineChatLoginForm({
  onSuccess,
  onCancel,
  onSwitchToSignup,
}: InlineChatLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Refresh the page to update auth state
      router.refresh();
      onSuccess?.();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?from=prospect&popup=true`,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data?.url) {
      const result = await openOAuthPopup(data.url, 'facebook');

      if (result.success) {
        // Now that the popup is finished successfully, refresh the session
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          setError(userError?.message || 'Failed to retrieve active session.');
          setLoading(false);
          return;
        }

        router.refresh();
        onSuccess?.();
      } else {
        setError(result.error || 'Authentication failed or was cancelled');
      }
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?from=prospect&popup=true`,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data?.url) {
      const result = await openOAuthPopup(data.url, 'google');

      if (result.success) {
        // Now that the popup is finished successfully, refresh the session
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          setError(userError?.message || 'Failed to retrieve active session.');
          setLoading(false);
          return;
        }

        router.refresh();
        onSuccess?.();
      } else {
        setError(result.error || 'Authentication failed or was cancelled');
      }
    }

    setLoading(false);
  };

  return (
    <div className="bg-muted rounded-lg p-4 max-w-sm">
      <div className="mb-3">
        <p className="text-sm font-medium text-foreground">Welcome back!</p>
        <p className="text-xs text-muted-foreground mt-1">
          Log in to access your saved preferences and registrations.
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-3">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2 rounded">
            {error}
          </div>
        )}

        {/* Social login - compact */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleFacebookLogin}
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2 px-3 min-h-[40px] border border-border rounded-md text-sm font-medium text-foreground bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Continue with Facebook
          </button>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2 px-3 min-h-[40px] border border-border rounded-md text-sm font-medium text-foreground bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-muted text-muted-foreground">or email</span>
          </div>
        </div>

        {/* Email login fields */}
        <div className="space-y-2">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full px-3 py-2 min-h-[40px] text-sm border border-border bg-card rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-3 py-2 min-h-[40px] text-sm border border-border bg-card rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 min-h-[40px] bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>

        <div className="flex items-center justify-between text-xs">
          {onSwitchToSignup && (
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-primary hover:underline"
            >
              Create an account
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              Maybe later
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
