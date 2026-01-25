'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { SignupConsents } from '@/app/types/consents';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Consent states
  const [consents, setConsents] = useState<SignupConsents>({
    privacyPolicy: false,
    termsOfService: false,
    aiProcessing: false,
    profileSharing: false,
    marketing: false,
  });

  const handleConsentChange = (key: keyof SignupConsents) => {
    setConsents(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate required consents
    if (!consents.privacyPolicy) {
      setError('You must accept the Privacy Policy to create an account.');
      setLoading(false);
      return;
    }
    if (!consents.termsOfService) {
      setError('You must accept the Terms of Service to create an account.');
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const now = new Date().toISOString();

        // Save consents to database
        const { error: consentError } = await supabase
          .from('user_consents')
          .insert({
            user_id: authData.user.id,
            privacy_policy_accepted_at: now,
            terms_accepted_at: now,
            ai_processing_consent: consents.aiProcessing,
            ai_processing_consent_at: consents.aiProcessing ? now : null,
            profile_sharing_consent: consents.profileSharing,
            profile_sharing_consent_at: consents.profileSharing ? now : null,
            marketing_consent: consents.marketing,
            marketing_consent_at: consents.marketing ? now : null,
          });

        if (consentError) {
          console.error('Error saving consents:', consentError);
          // Don't block signup if consent save fails - it will be handled later
        }

        // Log initial consents to audit trail
        const auditLogs = [
          {
            user_id: authData.user.id,
            consent_type: 'privacy_policy',
            action: 'granted',
            new_value: { accepted_at: now },
          },
          {
            user_id: authData.user.id,
            consent_type: 'terms',
            action: 'granted',
            new_value: { accepted_at: now },
          },
        ];

        if (consents.aiProcessing) {
          auditLogs.push({
            user_id: authData.user.id,
            consent_type: 'ai_processing',
            action: 'granted',
            new_value: { consent: true, at: now },
          });
        }

        if (consents.profileSharing) {
          auditLogs.push({
            user_id: authData.user.id,
            consent_type: 'profile_sharing',
            action: 'granted',
            new_value: { consent: true, at: now },
          });
        }

        if (consents.marketing) {
          auditLogs.push({
            user_id: authData.user.id,
            consent_type: 'marketing',
            action: 'granted',
            new_value: { consent: true, at: now },
          });
        }

        await supabase.from('consent_audit_log').insert(auditLogs);

        // Redirect to home page
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-card p-4 sm:p-8 rounded-xl shadow-lg">
        <div>
          <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-card-foreground">
            Create your account
          </h2>
          <p className="mt-2 text-center text-xs sm:text-sm text-muted-foreground">
            Or{' '}
            <Link
              href="/auth/login"
              className="font-medium text-primary hover:opacity-80 min-h-[44px] inline-flex items-center"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSignUp}>
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

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
                className="mt-1 block w-full px-3 py-3 min-h-[44px] text-base sm:text-sm border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
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
                className="mt-1 block w-full px-3 py-3 min-h-[44px] text-base sm:text-sm border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
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
                className="mt-1 block w-full px-3 py-3 min-h-[44px] text-base sm:text-sm border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          {/* Consent Section */}
          <div className="space-y-4 pt-4 border-t border-border">
            <p className="text-sm font-medium text-foreground">Consent & Preferences</p>

            {/* Required consents */}
            <div className="space-y-3">
              {/* Privacy Policy - Required */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.privacyPolicy}
                  onChange={() => handleConsentChange('privacyPolicy')}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
                <span className="text-sm text-foreground">
                  I have read and accept the{' '}
                  <Link href="/privacy-policy" target="_blank" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  <span className="text-destructive ml-1">*</span>
                </span>
              </label>

              {/* Terms of Service - Required */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.termsOfService}
                  onChange={() => handleConsentChange('termsOfService')}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
                <span className="text-sm text-foreground">
                  I have read and accept the{' '}
                  <Link href="/terms-of-service" target="_blank" className="text-primary hover:underline">
                    Terms of Service
                  </Link>
                  <span className="text-destructive ml-1">*</span>
                </span>
              </label>
            </div>

            {/* Optional consents */}
            <div className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">Optional preferences (can be changed later):</p>

              {/* AI Processing Consent */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.aiProcessing}
                  onChange={() => handleConsentChange('aiProcessing')}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
                <div>
                  <span className="text-sm text-foreground">
                    Enable AI-powered matching
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Allow us to use AI to match your profile with sailing opportunities
                  </p>
                </div>
              </label>

              {/* Profile Sharing Consent */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.profileSharing}
                  onChange={() => handleConsentChange('profileSharing')}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
                <div>
                  <span className="text-sm text-foreground">
                    Share my profile with boat owners
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Allow boat owners to view your profile when you apply for positions
                  </p>
                </div>
              </label>

              {/* Marketing Consent */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.marketing}
                  onChange={() => handleConsentChange('marketing')}
                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
                <div>
                  <span className="text-sm text-foreground">
                    Receive marketing emails
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get updates about new features, tips, and sailing opportunities
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 min-h-[44px] bg-primary text-primary-foreground rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            <span className="text-destructive">*</span> Required fields
          </p>
        </form>
      </div>
    </div>
  );
}
