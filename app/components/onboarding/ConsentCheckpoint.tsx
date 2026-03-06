'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@shared/ui/Button/Button';
import { getSupabaseBrowserClient } from '@shared/database/client';
import { logger } from '@shared/logging';

interface ConsentCheckpointProps {
  userId: string;
  onComplete: () => void;
}

export function ConsentCheckpoint({ userId, onComplete }: ConsentCheckpointProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Required
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [termsOfService, setTermsOfService] = useState(false);

  // Optional — AI pre-checked since user is in an AI-assisted onboarding flow
  const [aiProcessing, setAiProcessing] = useState(true);
  const [profileSharing, setProfileSharing] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const canSave = privacyPolicy && termsOfService;

  const handleSave = async () => {
    if (!canSave) {
      setError('Please accept the Privacy Policy and Terms of Service to continue.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const now = new Date().toISOString();

    try {
      const consentData = {
        privacy_policy_accepted_at: now,
        terms_accepted_at: now,
        ai_processing_consent: aiProcessing,
        ai_processing_consent_at: now,
        profile_sharing_consent: profileSharing,
        profile_sharing_consent_at: now,
        marketing_consent: marketing,
        marketing_consent_at: now,
      };

      const { error: updateError, count } = await supabase
        .from('user_consents')
        .update({ ...consentData, updated_at: now, consent_setup_completed_at: now })
        .eq('user_id', userId);

      if (updateError || count === 0 || count === null) {
        const { error: insertError } = await supabase
          .from('user_consents')
          .insert({ user_id: userId, ...consentData, updated_at: now, consent_setup_completed_at: now });

        if (insertError) throw insertError;
      }

      await supabase.from('consent_audit_log').insert([
        { user_id: userId, consent_type: 'privacy_policy', action: 'granted', new_value: { accepted_at: now } },
        { user_id: userId, consent_type: 'terms', action: 'granted', new_value: { accepted_at: now } },
        { user_id: userId, consent_type: 'ai_processing', action: aiProcessing ? 'granted' : 'revoked', new_value: { consent: aiProcessing, at: now } },
        { user_id: userId, consent_type: 'profile_sharing', action: profileSharing ? 'granted' : 'revoked', new_value: { consent: profileSharing, at: now } },
        { user_id: userId, consent_type: 'marketing', action: marketing ? 'granted' : 'revoked', new_value: { consent: marketing, at: now } },
        { user_id: userId, consent_type: 'consent_setup', action: 'completed', new_value: { completed_at: now } },
      ]);

      // Notify backend — ignore redirect since the parent flow controls navigation
      await fetch('/api/onboarding/after-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aiProcessingConsent: aiProcessing }),
      }).catch((err) => logger.warn('[ConsentCheckpoint] after-consent ping failed', { error: err }));

      onComplete();
    } catch (err: any) {
      logger.error('[ConsentCheckpoint] Failed to save consents', { error: err });
      setError(err.message || 'Failed to save preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">Set up your preferences</h3>
        <p className="text-sm text-gray-500 mt-0.5">
          Review and accept our terms before we get started.
        </p>
      </div>

      {/* Body */}
      <div className="px-5 py-5 space-y-5">
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Required */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Required
          </p>

          <label
            className={`flex items-start gap-3 cursor-pointer p-3.5 rounded-lg border transition-colors ${
              privacyPolicy ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={privacyPolicy}
              onChange={() => setPrivacyPolicy((v) => !v)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring flex-shrink-0"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">
                I accept the{' '}
                <Link
                  href="/privacy-policy?standalone=true"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </Link>
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                How we collect, use, and protect your personal information.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 cursor-pointer p-3.5 rounded-lg border transition-colors ${
              termsOfService ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={termsOfService}
              onChange={() => setTermsOfService((v) => !v)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring flex-shrink-0"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">
                I accept the{' '}
                <Link
                  href="/terms-of-service?standalone=true"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  Terms of Service
                </Link>
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Rules and guidelines for using SailSmart.
              </p>
            </div>
          </label>
        </div>

        {/* Optional */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Optional
          </p>

          <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={aiProcessing}
              onChange={() => setAiProcessing((v) => !v)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring flex-shrink-0"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">
                Enable AI-powered matching
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Allow AI to analyse your profile and match you with sailing opportunities.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={profileSharing}
              onChange={() => setProfileSharing((v) => !v)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring flex-shrink-0"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">
                Share my profile
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Allow others to view your profile for sailing opportunities.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={marketing}
              onChange={() => setMarketing((v) => !v)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-ring flex-shrink-0"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">
                Receive marketing emails
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Updates about new features, sailing tips, and opportunities.
              </p>
            </div>
          </label>
        </div>

        <p className="text-xs text-gray-500">
          You can update optional preferences any time in{' '}
          <span className="font-medium text-gray-900">Settings › Privacy</span>.
        </p>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/80 flex flex-col gap-2">
        <Button
          onClick={handleSave}
          disabled={loading || !canSave}
          isLoading={loading}
          className="w-full"
        >
          Save & Continue
        </Button>
        {!canSave && (
          <p className="text-xs text-center text-gray-500">
            Accept the Privacy Policy and Terms of Service to continue.
          </p>
        )}
      </div>
    </div>
  );
}
