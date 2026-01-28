'use client';

import { UserConsents } from '@/app/types/consents';

type EmailPreferences = {
  registration_updates: boolean;
  journey_updates: boolean;
  profile_reminders: boolean;
};

type NotificationsConsentsSectionProps = {
  consents: UserConsents | null;
  emailPrefs: EmailPreferences | null;
  isUpdating: boolean;
  onConsentToggle: (consentType: 'ai_processing' | 'profile_sharing' | 'marketing') => Promise<void>;
  onEmailPrefToggle: (prefType: 'registration_updates' | 'journey_updates' | 'profile_reminders') => Promise<void>;
};

export function NotificationsConsentsSection({
  consents,
  emailPrefs,
  isUpdating,
  onConsentToggle,
  onEmailPrefToggle,
}: NotificationsConsentsSectionProps) {
  return (
    <div className="space-y-8">
      {/* Consent Preferences */}
      <div>
        <h3 className="text-base font-medium text-foreground mb-4">Consent Preferences</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Control how your data is used. You can change these settings at any time.
        </p>

        <div className="space-y-6">
          {/* AI Processing */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">AI-Powered Matching</p>
              <p className="text-sm text-muted-foreground">
                Allow us to use AI to match your profile with sailing opportunities.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onConsentToggle('ai_processing')}
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
              <p className="font-medium text-foreground">Profile Sharing</p>
              <p className="text-sm text-muted-foreground">
                Allow boat owners to view your profile when you apply for crew positions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onConsentToggle('profile_sharing')}
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
              <p className="font-medium text-foreground">Marketing Communications</p>
              <p className="text-sm text-muted-foreground">
                Receive emails about new features, tips, and sailing opportunities.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onConsentToggle('marketing')}
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
      </div>

      {/* Email Notifications */}
      <div>
        <h3 className="text-base font-medium text-foreground mb-4">Email Notifications</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Choose which email notifications you want to receive.
        </p>

        <div className="space-y-6">
          {/* Registration Updates */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">Registration Updates</p>
              <p className="text-sm text-muted-foreground">
                Get notified when your crew applications are approved or denied.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEmailPrefToggle('registration_updates')}
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
              <p className="font-medium text-foreground">Journey Updates</p>
              <p className="text-sm text-muted-foreground">
                Get notified about changes to journeys you&apos;re registered for.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEmailPrefToggle('journey_updates')}
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
              <p className="font-medium text-foreground">Profile Reminders</p>
              <p className="text-sm text-muted-foreground">
                Receive reminders to complete or update your profile.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEmailPrefToggle('profile_reminders')}
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
      </div>
    </div>
  );
}
