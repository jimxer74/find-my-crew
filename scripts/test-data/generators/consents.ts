import { getSupabaseAdmin } from '../utils/supabase-admin.js';
import { getRandom } from '../utils/seeded-random.js';
import type { GeneratedProfile } from './profiles.js';

export interface GeneratedUserConsent {
  user_id: string;
  privacy_policy_accepted_at: string;
  terms_accepted_at: string;
  ai_processing_consent: boolean;
  ai_processing_consent_at: string | null;
  profile_sharing_consent: boolean;
  profile_sharing_consent_at: string | null;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  cookie_preferences: {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
  };
  cookie_preferences_at: string | null;
  consent_setup_completed_at: string;
}

export interface ConsentGeneratorOptions {
  profiles: GeneratedProfile[];
  onProgress?: (message: string) => void;
}

/**
 * Generate user consents for profiles
 */
export async function generateConsents(
  options: ConsentGeneratorOptions
): Promise<GeneratedUserConsent[]> {
  const {
    profiles,
    onProgress = console.log,
  } = options;

  const random = getRandom();
  const admin = getSupabaseAdmin();
  const consents: GeneratedUserConsent[] = [];

  onProgress(`Generating consents for ${profiles.length} profiles...`);

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];

    // Generate consent timestamps (in the past, when user signed up)
    const signupDate = random.date(
      new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)   // Yesterday
    );

    const privacyAcceptedAt = signupDate.toISOString();
    const termsAcceptedAt = signupDate.toISOString();
    const consentSetupCompletedAt = signupDate.toISOString();

    // AI processing consent (most users consent)
    const aiConsent = random.bool(0.85);
    const aiConsentAt = aiConsent ? signupDate.toISOString() : null;

    // Profile sharing consent (most users consent for better matching)
    const profileSharingConsent = random.bool(0.9);
    const profileSharingConsentAt = profileSharingConsent ? signupDate.toISOString() : null;

    // Marketing consent (fewer users consent)
    const marketingConsent = random.bool(0.4);
    const marketingConsentAt = marketingConsent ? signupDate.toISOString() : null;

    // Cookie preferences
    const analyticsConsent = random.bool(0.7);
    const marketingCookies = marketingConsent && random.bool(0.5);
    const cookiePreferences = {
      essential: true, // Always true
      analytics: analyticsConsent,
      marketing: marketingCookies,
    };
    const cookiePreferencesAt = signupDate.toISOString();

    const consent: GeneratedUserConsent = {
      user_id: profile.id,
      privacy_policy_accepted_at: privacyAcceptedAt,
      terms_accepted_at: termsAcceptedAt,
      ai_processing_consent: aiConsent,
      ai_processing_consent_at: aiConsentAt,
      profile_sharing_consent: profileSharingConsent,
      profile_sharing_consent_at: profileSharingConsentAt,
      marketing_consent: marketingConsent,
      marketing_consent_at: marketingConsentAt,
      cookie_preferences: cookiePreferences,
      cookie_preferences_at: cookiePreferencesAt,
      consent_setup_completed_at: consentSetupCompletedAt,
    };

    // Insert user consent into database
    const { error } = await admin.from('user_consents').insert({
      user_id: consent.user_id,
      privacy_policy_accepted_at: consent.privacy_policy_accepted_at,
      terms_accepted_at: consent.terms_accepted_at,
      ai_processing_consent: consent.ai_processing_consent,
      ai_processing_consent_at: consent.ai_processing_consent_at,
      profile_sharing_consent: consent.profile_sharing_consent,
      profile_sharing_consent_at: consent.profile_sharing_consent_at,
      marketing_consent: consent.marketing_consent,
      marketing_consent_at: consent.marketing_consent_at,
      cookie_preferences: consent.cookie_preferences,
      cookie_preferences_at: consent.cookie_preferences_at,
      consent_setup_completed_at: consent.consent_setup_completed_at,
    });

    if (error) {
      throw new Error(`Failed to insert user consent: ${error.message}`);
    }

    consents.push(consent);

    if ((i + 1) % 10 === 0 || i === profiles.length - 1) {
      onProgress(`  Created ${i + 1}/${profiles.length} user consents`);
    }
  }

  // Also create email preferences
  onProgress(`Creating email preferences...`);
  for (const profile of profiles) {
    const { error } = await admin.from('email_preferences').insert({
      user_id: profile.id,
      registration_updates: random.bool(0.9),
      journey_updates: random.bool(0.85),
      profile_reminders: random.bool(0.7),
    });

    if (error && !error.message.includes('duplicate')) {
      // Ignore duplicate key errors
      throw new Error(`Failed to insert email preferences: ${error.message}`);
    }
  }

  return consents;
}
