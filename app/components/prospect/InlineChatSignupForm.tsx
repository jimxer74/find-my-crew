'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { ProspectPreferences } from '@/app/lib/ai/prospect/types';
import { openOAuthPopup } from '@/app/lib/auth/oauthPopup';
import { logger } from '@/app/lib/logger';

type InlineChatSignupFormProps = {
  preferences?: ProspectPreferences;
  onSuccess?: (userId: string) => void;
  onCancel?: () => void;
  onSwitchToLogin?: () => void;
};

/**
 * Inline signup form styled to match the chat interface.
 * Appears as part of the conversation flow rather than a modal.
 */
export function InlineChatSignupForm({
  preferences,
  onSuccess,
  onCancel,
  onSwitchToLogin,
}: InlineChatSignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [oauthSuccessUserMsg, setOauthSuccessUserMsg] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    try {
      // Prepare user metadata with gathered preferences
      const userMetadata: Record<string, unknown> = {
        full_name: fullName,
      };

      // Store preferences in user metadata for later profile population
      if (preferences) {
        userMetadata.prospect_preferences = preferences;
      }

      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userMetadata,
          emailRedirectTo: `${window.location.origin}/auth/callback?from=prospect`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        setSuccess(true);
        onSuccess?.(authData.user.id);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const syncPreferencesToProfile = async (userId: string) => {
    if (!preferences) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const updates: Record<string, unknown> = {};

      // Map prospect preferences to profile fields
      if (preferences.experienceLevel) {
        updates.sailing_experience = preferences.experienceLevel;
      }
      if (preferences.skills?.length) {
        updates.skills = preferences.skills;
      }
      if (preferences.riskLevels?.length) {
        const riskLevelMap: Record<string, string> = {
          'coastal': 'Coastal sailing',
          'offshore': 'Offshore sailing',
          'extreme': 'Extreme sailing',
          'Coastal sailing': 'Coastal sailing',
          'Offshore sailing': 'Offshore sailing',
          'Extreme sailing': 'Extreme sailing',
        };
        const mappedRiskLevels = preferences.riskLevels
          .map((r: string) => riskLevelMap[r] || r)
          .filter((r: string) => ['Coastal sailing', 'Offshore sailing', 'Extreme sailing'].includes(r));
        if (mappedRiskLevels.length > 0) {
          updates.risk_level = mappedRiskLevels;
        }
      }
      if (preferences.sailingGoals) {
        updates.sailing_preferences = preferences.sailingGoals;
      }

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId);

        if (error) {
           logger.error('Failed to sync prospect preferences to profile:', { error });
        } else {
           logger.info('Successfully synced prospect preferences via inline OAuth fallback sync.');
        }
      }
      localStorage.removeItem('prospect_signup_preferences');
    } catch (err) {
      logger.error('Error in syncPreferencesToProfile', { err });
    }
  }

  const handleFacebookSignup = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    // Store preferences in localStorage as a backup
    if (preferences) {
      localStorage.setItem('prospect_signup_preferences', JSON.stringify(preferences));
    }

    // Request the OAuth URL without automatically redirecting
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
      // Execute our popup intercept
      const result = await openOAuthPopup(data.url, 'facebook');

      if (result.success) {
        // Now that the popup is finished successfully, refresh the session
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          setError(userError?.message || 'Failed to retrieve active session.');
          setLoading(false);
          return;
        }

        // Push the stored preferences directly to the newly created profile as the server route didn't execute standard NEXT redirect sync logic
        await syncPreferencesToProfile(userData.user.id);

        const name = userData.user.user_metadata?.full_name || 'there';
        setOauthSuccessUserMsg(`Welcome ${name}! Your account via Facebook has been successfully created.`);
        setSuccess(true);
        onSuccess?.(userData.user.id);
      } else {
        setError(result.error || 'Authentication failed or was cancelled');
      }
    }

    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    // Store preferences in localStorage as a backup
    if (preferences) {
      localStorage.setItem('prospect_signup_preferences', JSON.stringify(preferences));
    }

    // Request the OAuth URL without automatically redirecting
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
      // Execute our popup intercept
      const result = await openOAuthPopup(data.url, 'google');

      if (result.success) {
        // Now that the popup is finished successfully, refresh the session
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          setError(userError?.message || 'Failed to retrieve active session.');
          setLoading(false);
          return;
        }

        // Push the stored preferences directly to the newly created profile as the server route didn't execute standard NEXT redirect sync logic
        await syncPreferencesToProfile(userData.user.id);

        const name = userData.user.user_metadata?.full_name || 'there';
        setOauthSuccessUserMsg(`Welcome ${name}! Your account via Google has been successfully created.`);
        setSuccess(true);
        onSuccess?.(userData.user.id);
      } else {
        setError(result.error || 'Authentication failed or was cancelled');
      }
    }

    setLoading(false);
  };

  // Success state - show confirmation message
  if (success) {
    return (
      <div className="bg-muted rounded-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400"
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
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Success!</p>
            {oauthSuccessUserMsg ? (
               <p className="text-sm text-muted-foreground mt-1">
                 {oauthSuccessUserMsg}
               </p>
            ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  We&apos;ve sent a confirmation link to <span className="font-medium">{email}</span>.
                  Click it to activate your account.
                </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Your sailing preferences have been saved and will be added to your profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted rounded-lg p-4 max-w-sm">
      <div className="mb-3">
        <p className="text-sm font-medium text-foreground">Create your account</p>
        <p className="text-xs text-muted-foreground mt-1">
          Sign up to save your preferences and register for sailing opportunities.
        </p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-3">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2 rounded">
            {error}
          </div>
        )}

        {/* Social signup */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleFacebookSignup}
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
            onClick={handleGoogleSignup}
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

        {/* Email signup fields */}
        <div className="space-y-2">
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="w-full px-3 py-2 min-h-[40px] text-sm border border-border bg-card rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            minLength={6}
            className="w-full px-3 py-2 min-h-[40px] text-sm border border-border bg-card rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 min-h-[40px] bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>

        <div className="flex items-center justify-between text-xs">
          {onSwitchToLogin && (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-primary hover:underline"
            >
              Already have an account?
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

        <p className="text-[10px] text-muted-foreground text-center">
          By signing up, you agree to our terms of service and privacy policy.
        </p>
      </form>
    </div>
  );
}
