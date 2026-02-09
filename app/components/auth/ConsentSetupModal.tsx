'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

type ConsentSetupModalProps = {
  userId: string;
  onComplete: () => void;
};

export function ConsentSetupModal({ userId, onComplete }: ConsentSetupModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Required consent states
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [termsOfService, setTermsOfService] = useState(false);

  // Optional consent states
  const [aiProcessing, setAiProcessing] = useState(false);
  const [profileSharing, setProfileSharing] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const canSave = privacyPolicy && termsOfService;

  const handleSave = async () => {
    if (!canSave) {
      setError('You must accept the Privacy Policy and Terms of Service to continue.');
      return;
    }

    setLoading(true);
    setError(null);


    console.log('handleSave starting...');
    const supabase = getSupabaseBrowserClient();
    const now = new Date().toISOString();

    try {
      // Consent data to save
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


      console.log('consentData: ', consentData);
      // Try to update existing consent record
      const { error: updateError, count } = await supabase
        .from('user_consents')
        .update({ ...consentData, updated_at: now, consent_setup_completed_at: now })
        .eq('user_id', userId);

      console.log('updateError: ', updateError);
      console.log('Error: ', error);
      console.log('count: ', count);
        // If no rows were updated (record doesn't exist), insert new record

      if (updateError || count === 0 || count === null) {
        const { error: insertError } = await supabase
          .from('user_consents')
          .insert({
            user_id: userId,
            ...consentData, updated_at: now, consent_setup_completed_at: now,
          });

        console.log('insertError:', insertError);
        if (insertError) throw insertError;
      }

      // Log consent changes to audit trail
      const auditLogs = [
        {
          user_id: userId,
          consent_type: 'privacy_policy',
          action: 'granted',
          new_value: { accepted_at: now },
        },
        {
          user_id: userId,
          consent_type: 'terms',
          action: 'granted',
          new_value: { accepted_at: now },
        },
        {
          user_id: userId,
          consent_type: 'ai_processing',
          action: aiProcessing ? 'granted' : 'revoked',
          new_value: { consent: aiProcessing, at: now },
        },
        {
          user_id: userId,
          consent_type: 'profile_sharing',
          action: profileSharing ? 'granted' : 'revoked',
          new_value: { consent: profileSharing, at: now },
        },
        {
          user_id: userId,
          consent_type: 'marketing',
          action: marketing ? 'granted' : 'revoked',
          new_value: { consent: marketing, at: now },
        },
        {
          user_id: userId,
          consent_type: 'consent_setup',
          action: 'completed',
          new_value: { completed_at: now },
        },
      ];

      await supabase.from('consent_audit_log').insert(auditLogs);

      // Dispatch event so other components (e.g. ProspectChat, homepage) can react
      // to consent completion and know whether AI consent was granted
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('consentSetupCompleted', {
          detail: { aiProcessingConsent: aiProcessing },
        }));
      }

      onComplete();
    } catch (err: any) {
      console.error('Error saving consents:', err);
      setError(err.message || 'Failed to save preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-card-foreground">
              Set Up Your Preferences
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please review and set your privacy preferences to continue using SailSmart.
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* Required Consents */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              Required <span className="text-destructive">*</span>
            </p>

            {/* Privacy Policy */}
            <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-lg border transition-colors ${
              privacyPolicy ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
            }`}>
              <input
                type="checkbox"
                checked={privacyPolicy}
                onChange={() => setPrivacyPolicy(!privacyPolicy)}
                className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-ring"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">
                  I have read and accept the{' '}
                  <Link href="/privacy-policy?standalone=true" target="_blank" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Learn how we collect, use, and protect your personal information.
                </p>
              </div>
            </label>

            {/* Terms of Service */}
            <label className={`flex items-start gap-3 cursor-pointer p-4 rounded-lg border transition-colors ${
              termsOfService ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
            }`}>
              <input
                type="checkbox"
                checked={termsOfService}
                onChange={() => setTermsOfService(!termsOfService)}
                className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-ring"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">
                  I have read and accept the{' '}
                  <Link href="/terms-of-service?standalone=true" target="_blank" className="text-primary hover:underline">
                    Terms of Service
                  </Link>
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Understand the rules and guidelines for using SailSmart.
                </p>
              </div>
            </label>
          </div>

          {/* Optional Consents */}
          <div className="space-y-3 mt-6">
            <p className="text-sm font-medium text-foreground">
              Optional Preferences
            </p>

            {/* AI Processing Consent */}
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
              <input
                type="checkbox"
                checked={aiProcessing}
                onChange={() => setAiProcessing(!aiProcessing)}
                className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-ring"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">
                  Enable AI-powered matching
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Allow us to use AI to analyze your profile and match you with suitable sailing opportunities.
                </p>
              </div>
            </label>

            {/* Profile Sharing Consent */}
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
              <input
                type="checkbox"
                checked={profileSharing}
                onChange={() => setProfileSharing(!profileSharing)}
                className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-ring"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">
                  Share my profile with boat owners
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Allow boat owners to view your profile when you apply for crew positions.
                </p>
              </div>
            </label>

            {/* Marketing Consent */}
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
              <input
                type="checkbox"
                checked={marketing}
                onChange={() => setMarketing(!marketing)}
                className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-ring"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground">
                  Receive marketing emails
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Get updates about new features, sailing tips, and opportunities. You can unsubscribe at any time.
                </p>
              </div>
            </label>


            
          </div>

          {/* Info Text */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              You can change the optional preferences at any time in your{' '}
              <span className="font-medium text-foreground">Settings &gt; Privacy</span> page.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={loading || !canSave}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Preferences & Continue'
              )}
            </button>
            {!canSave && (
              <p className="mt-2 text-xs text-center text-muted-foreground">
                Please accept the Privacy Policy and Terms of Service to continue.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
