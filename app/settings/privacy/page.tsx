'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { logger } from '@/app/lib/logger';
import { useAuth } from '@/app/contexts/AuthContext';
import { Footer } from '@/app/components/Footer';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { UserConsents } from '@/app/types/consents';

type UserData = {
  profile: any;
  consents: UserConsents | null;
  emailPreferences: any;
  boats: any[];
  registrations: any[];
  notifications: any[];
};

export default function PrivacySettingsPage() {
  const t = useTranslations('settings.privacy');
  const tCommon = useTranslations('common');
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [consents, setConsents] = useState<UserConsents | null>(null);
  const [emailPrefs, setEmailPrefs] = useState<{
    registration_updates: boolean;
    journey_updates: boolean;
    profile_reminders: boolean;
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Fetch user data
  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();


    logger.debug('[Policy] reading user data:', { userId: user?.id });

    try {
      // Fetch all user data in parallel
      const [profileRes, consentsRes, emailPrefsRes, boatsRes, registrationsRes, notificationsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle(),
        supabase.from('user_consents').select('*').eq('user_id', user!.id).maybeSingle(),
        supabase.from('email_preferences').select('*').eq('user_id', user!.id).maybeSingle(),
        supabase.from('boats').select('id, name, created_at').eq('owner_id', user!.id),
        // Note: RLS policy already restricts registrations to current user, no need to filter by user_id
        supabase.from('registrations').select('id, status, created_at, legs(name, journeys(name))'),
        supabase.from('notifications').select('id, type, created_at').eq('user_id', user!.id).limit(10),
      ]);


      logger.debug('[Policy] profileRes:', { hasError: !!profileRes.error });
      logger.debug('[Policy] consentsRes:', { hasError: !!consentsRes.error });
      logger.debug('[Policy] emailPrefsRes:', { hasError: !!emailPrefsRes.error });
      logger.debug('[Policy] boatsRes:', { count: boatsRes.data?.length || 0 });
      logger.debug('[Policy] registrationsRes:', { count: registrationsRes.data?.length || 0 });
      logger.debug('[Policy] notificationsRes:', { count: notificationsRes.data?.length || 0 });

      setUserData({
        profile: profileRes.data,
        consents: consentsRes.data,
        emailPreferences: emailPrefsRes.data,
        boats: boatsRes.data || [],
        registrations: registrationsRes.data || [],
        notifications: notificationsRes.data || [],
      });
      setConsents(consentsRes.data);
      setEmailPrefs(emailPrefsRes.data || {
        registration_updates: false,
        journey_updates: false,
        profile_reminders: false,
      });
    } catch (err) {
      logger.error('Error loading user data:', err instanceof Error ? { error: err.message } : { error: String(err) });
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConsentToggle = async (consentType: 'ai_processing' | 'profile_sharing' | 'marketing') => {
    setIsUpdating(true);
    setError(null);

    // If consents is null, default to false (API will create the record via upsert)
    const currentValue = consents?.[`${consentType}_consent` as keyof UserConsents] as boolean ?? false;
    const newValue = !currentValue;

    try {
      const response = await fetch('/api/user/consents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent_type: consentType,
          value: newValue,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update consent');
      }

      const data = await response.json();
      setConsents(data.consents);
      setSuccessMessage(`${consentType.replace('_', ' ')} consent ${newValue ? 'enabled' : 'disabled'}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to update consent. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmailPrefToggle = async (prefType: 'registration_updates' | 'journey_updates' | 'profile_reminders') => {
    if (!emailPrefs) return;

    setIsUpdating(true);
    setError(null);

    const newValue = !emailPrefs[prefType];

    try {
      const response = await fetch('/api/user/email-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [prefType]: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update email preference');
      }

      const data = await response.json();
      setEmailPrefs(data.preferences);
      setSuccessMessage(`Email preference updated.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to update email preference. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch('/api/user/data-export');

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Get the blob and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SailSmart-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccessMessage('Your data has been downloaded.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      setError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }

    setIsDeleting(true);
    setError(null);

    let accountDeletionSucceeded = false;
    let deletionErrorMessage: string | null = null;

    try {
      logger.info('[PrivacySettings] Starting account deletion', {});
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });

      let responseData: any;
      try {
        responseData = await response.json();
      } catch (parseErr) {
        const parseError = parseErr instanceof Error ? parseErr.message : String(parseErr);
        logger.error('[PrivacySettings] Failed to parse deletion response', { error: parseError });
        deletionErrorMessage = 'Server response error: ' + parseError;
        throw new Error(deletionErrorMessage || 'Failed to parse response');
      }

      if (!response.ok) {
        deletionErrorMessage = responseData?.error || 'Account deletion failed on server';
        logger.error('[PrivacySettings] Account deletion API returned error', {
          status: response.status,
          error: deletionErrorMessage
        });
        throw new Error(deletionErrorMessage || 'Account deletion failed');
      }

      // Account deletion succeeded on server
      accountDeletionSucceeded = true;
      logger.info('[PrivacySettings] Account deletion successful, proceeding with logout', {});

    } catch (err: any) {
      // Account deletion failed - don't logout
      const errorMsg = err instanceof Error ? err.message : String(err);
      const userFacingError = `❌ Account deletion failed: ${errorMsg}. Your account has NOT been deleted.`;
      setError(userFacingError);
      logger.error('[PrivacySettings] Account deletion failed', { error: errorMsg });
      setIsDeleting(false);
      return; // Don't proceed to logout if deletion failed
    }

    // Account deletion succeeded - now attempt logout
    // Even if logout fails, we want to ensure user is redirected away from this page
    try {
      logger.info('[PrivacySettings] Account deleted, attempting logout', {});
      await signOut();
      // signOut() does window.location.href redirect, this line won't execute
    } catch (logoutErr: any) {
      // This catch might not execute because signOut() should handle errors and redirect anyway
      logger.error('[PrivacySettings] Logout failed after successful deletion', {
        error: logoutErr instanceof Error ? logoutErr.message : String(logoutErr),
        accountDeleted: true
      });
      // Fallback: Force logout via window.location
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <h1 className="text-2xl font-bold text-foreground mb-2">{t('title')}</h1>
        <p className="text-muted-foreground mb-8">
          {t('subtitle')}
        </p>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {successMessage}
          </div>
        )}

        {/* Consent Management */}
        <section className="bg-card rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('consentPreferences')}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t('consentControlDesc')}
          </p>

          <div className="space-y-6">
            {/* AI Processing */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">{t('aiProcessing')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('aiProcessingDesc')}
                </p>
              </div>
              <button
                onClick={() => handleConsentToggle('ai_processing')}
                disabled={isUpdating}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  consents?.ai_processing_consent ? 'bg-green-500' : 'bg-muted'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    consents?.ai_processing_consent ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Profile Sharing */}
            <div className="flex items-start justify-between gap-4 pt-4 border-t border-border">
              <div>
                <p className="font-medium text-foreground">{t('profileSharing')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('profileSharingDesc')}
                </p>
              </div>
              <button
                onClick={() => handleConsentToggle('profile_sharing')}
                disabled={isUpdating}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  consents?.profile_sharing_consent ? 'bg-green-500' : 'bg-muted'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    consents?.profile_sharing_consent ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Marketing */}
            <div className="flex items-start justify-between gap-4 pt-4 border-t border-border">
              <div>
                <p className="font-medium text-foreground">{t('marketing')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('marketingDesc')}
                </p>
              </div>
              <button
                onClick={() => handleConsentToggle('marketing')}
                disabled={isUpdating}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  consents?.marketing_consent ? 'bg-green-500' : 'bg-muted'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    consents?.marketing_consent ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Email Preferences */}
        <section className="bg-card rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('emailNotifications')}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t('emailNotificationsDesc')}
          </p>

          <div className="space-y-6">
            {/* Registration Updates */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">{t('registrationUpdates')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('registrationUpdatesDesc')}
                </p>
              </div>
              <button
                onClick={() => handleEmailPrefToggle('registration_updates')}
                disabled={isUpdating}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  emailPrefs?.registration_updates ? 'bg-green-500' : 'bg-muted'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    emailPrefs?.registration_updates ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Journey Updates */}
            <div className="flex items-start justify-between gap-4 pt-4 border-t border-border">
              <div>
                <p className="font-medium text-foreground">{t('journeyUpdates')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('journeyUpdatesDesc')}
                </p>
              </div>
              <button
                onClick={() => handleEmailPrefToggle('journey_updates')}
                disabled={isUpdating}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  emailPrefs?.journey_updates ? 'bg-green-500' : 'bg-muted'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    emailPrefs?.journey_updates ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            {/* Profile Reminders */}
            <div className="flex items-start justify-between gap-4 pt-4 border-t border-border">
              <div>
                <p className="font-medium text-foreground">{t('profileReminders')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('profileRemindersDesc')}
                </p>
              </div>
              <button
                onClick={() => handleEmailPrefToggle('profile_reminders')}
                disabled={isUpdating}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  emailPrefs?.profile_reminders ? 'bg-green-500' : 'bg-muted'
                } ${isUpdating ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    emailPrefs?.profile_reminders ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* View My Data */}
        <section className="bg-card rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('yourData')}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t('yourDataDesc')}
          </p>

          {userData && (
            <div className="space-y-4">
              {/* Profile */}
              <div className="p-4 bg-accent/50 rounded-lg">
                <h3 className="font-medium text-foreground mb-2">{t('profileInfo')}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">{t('name')}:</div>
                  <div className="text-foreground">{userData.profile?.full_name || t('notSet')}</div>
                  <div className="text-muted-foreground">Email:</div>
                  <div className="text-foreground">{userData.profile?.email || user?.email}</div>
                  <div className="text-muted-foreground">Phone:</div>
                  <div className="text-foreground">{userData.profile?.phone || t('notSet')}</div>
                  <div className="text-muted-foreground">Username:</div>
                  <div className="text-foreground">{userData.profile?.username || t('notSet')}</div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-accent/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-foreground">{userData.boats.length}</p>
                  <p className="text-sm text-muted-foreground">Boats</p>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-foreground">{userData.registrations.length}</p>
                  <p className="text-sm text-muted-foreground">Registrations</p>
                </div>
                <div className="p-4 bg-accent/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-foreground">{userData.notifications.length}+</p>
                  <p className="text-sm text-muted-foreground">Notifications</p>
                </div>
              </div>

              {/* Consents */}
              {consents && (
                <div className="p-4 bg-accent/50 rounded-lg">
                  <h3 className="font-medium text-foreground mb-2">Consent History</h3>
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                      Privacy Policy accepted: {consents.privacy_policy_accepted_at
                        ? new Date(consents.privacy_policy_accepted_at).toLocaleDateString()
                        : 'Not accepted'}
                    </p>
                    <p className="text-muted-foreground">
                      Terms accepted: {consents.terms_accepted_at
                        ? new Date(consents.terms_accepted_at).toLocaleDateString()
                        : 'Not accepted'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Export Data */}
        <section className="bg-card rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('exportData')}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t('exportDataDesc')}
          </p>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isExporting ? t('preparingDownload') : t('downloadMyData')}
          </button>
        </section>

        {/* Delete Account */}
        <section className="bg-card rounded-lg shadow p-6 border-2 border-red-200">
          <h2 className="text-lg font-semibold text-red-600 mb-4">{t('deleteAccount')}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t('deleteAccountDesc')}
          </p>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="px-6 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
          >
            {t('deleteMyAccount')}
          </button>
        </section>

      </main>

      <Footer />

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowDeleteDialog(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-lg shadow-xl border border-border max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-red-600 mb-4">{t('deleteConfirmTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('deleteConfirmDesc')}
              </p>
              <ul className="text-sm text-muted-foreground mb-4 list-disc pl-5 space-y-1">
                <li>{t('deleteConfirmItems.profile')}</li>
                <li>{t('deleteConfirmItems.boats')}</li>
                <li>{t('deleteConfirmItems.registrations')}</li>
                <li>{t('deleteConfirmItems.notifications')}</li>
              </ul>
              <p className="text-sm font-medium text-foreground mb-4">
                {t('deleteConfirmType')}
              </p>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-4"
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeleteConfirmation('');
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmation !== 'DELETE MY ACCOUNT'}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? t('deleting') : t('permanentlyDelete')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
