/**
 * GDPR Consent Types
 *
 * Types for user consent management and audit logging.
 */

export type ConsentType =
  | 'privacy_policy'
  | 'terms'
  | 'ai_processing'
  | 'profile_sharing'
  | 'marketing'
  | 'cookies';

export type ConsentAction = 'granted' | 'revoked' | 'updated';

export interface CookiePreferences {
  essential: true;  // Always true, cannot be disabled
  analytics: boolean;
  marketing: boolean;
}

export interface UserConsents {
  user_id: string;

  // Legal consents (required during signup)
  privacy_policy_accepted_at: string | null;
  terms_accepted_at: string | null;

  // Optional consents
  ai_processing_consent: boolean;
  ai_processing_consent_at: string | null;

  profile_sharing_consent: boolean;
  profile_sharing_consent_at: string | null;

  marketing_consent: boolean;
  marketing_consent_at: string | null;

  // Cookie preferences
  cookie_preferences: CookiePreferences;
  cookie_preferences_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface ConsentAuditLog {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  action: ConsentAction;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Signup consent form data
export interface SignupConsents {
  privacyPolicy: boolean;  // Required
  termsOfService: boolean;  // Required
  aiProcessing: boolean;  // Optional
  profileSharing: boolean;  // Optional
  marketing: boolean;  // Optional
}

// API request/response types
export interface UpdateConsentRequest {
  consent_type: ConsentType;
  value: boolean | CookiePreferences;
}

export interface ConsentStatusResponse {
  consents: UserConsents | null;
  hasAcceptedRequired: boolean;  // True if privacy policy and terms are accepted
}
