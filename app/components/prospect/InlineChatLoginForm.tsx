'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?from=prospect`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
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
