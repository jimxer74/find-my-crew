'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/app/lib/logger';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

export type LegRegistrationData = {
  leg_id: string;
  journey_id: string;
  leg_name: string;
  journey_name: string;
};

export type PassportRequirement = {
  id: string;
  require_photo_validation: boolean;
  pass_confidence_score: number;
};

export type RegistrationResult = {
  success: boolean;
  status?: string;
  auto_approved?: boolean;
  error?: string;
};

export function useLegRegistration(leg: LegRegistrationData | null) {
  const { user } = useAuth();
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [registrationStatusChecked, setRegistrationStatusChecked] = useState(false);
  const [hasRequirements, setHasRequirements] = useState(false);
  const [hasQuestionRequirements, setHasQuestionRequirements] = useState(false);
  const [hasPassportRequirement, setHasPassportRequirement] = useState(false);
  const [passportRequirement, setPassportRequirement] = useState<PassportRequirement | null>(null);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(false);
  const [isCheckingRequirements, setIsCheckingRequirements] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [hasProfileSharingConsent, setHasProfileSharingConsent] = useState<boolean | null>(null);
  const [checkingProfileConsent, setCheckingProfileConsent] = useState(false);

  // Load registration status when leg changes
  useEffect(() => {
    if (!user || !leg?.leg_id) {
      setRegistrationStatus(null);
      setRegistrationStatusChecked(false);
      return;
    }

    setRegistrationStatusChecked(false);
    const loadRegistrationStatus = async () => {
      const supabase = getSupabaseBrowserClient();
      // Note: RLS policy already restricts to current user, no need to filter by user_id
      // Use maybeSingle() instead of single() because there might be no registration yet
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('status')
          .eq('leg_id', leg.leg_id)
          .maybeSingle();

        // PGRST116 = no rows found (expected when no registration yet)
        // Ignore RLS/permission errors gracefully
        if (error) {
          if (error.code === 'PGRST116') {
            // No rows found - this is expected
            setRegistrationStatus(null);
          } else {
            logger.warn('[useLegRegistration] Warning loading registration status:', { code: error.code, message: error.message });
            setRegistrationStatus(null);
          }
        } else {
          setRegistrationStatus(data?.status || null);
        }
      } catch (err) {
        logger.warn('[useLegRegistration] Exception loading registration status:', err instanceof Error ? { error: err.message } : { error: String(err) });
        setRegistrationStatus(null);
      } finally {
        setRegistrationStatusChecked(true);
      }
    };

    loadRegistrationStatus();
  }, [user, leg?.leg_id]);

  // Check profile sharing consent
  useEffect(() => {
    if (!user) {
      setHasProfileSharingConsent(null);
      return;
    }

    setCheckingProfileConsent(true);
    const checkProfileSharingConsent = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        // Use maybeSingle() - user_consents record might not exist yet
        const { data, error } = await supabase
          .from('user_consents')
          .select('profile_sharing_consent')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          logger.warn('[useLegRegistration] Error checking profile sharing consent:', { code: error.code, message: error.message });
          setHasProfileSharingConsent(null);
        } else {
          setHasProfileSharingConsent(data?.profile_sharing_consent === true);
        }
      } catch (err) {
        logger.warn('[useLegRegistration] Exception checking profile sharing consent:', err instanceof Error ? { error: err.message } : { error: String(err) });
        setHasProfileSharingConsent(null);
      } finally {
        setCheckingProfileConsent(false);
      }
    };

    checkProfileSharingConsent();
  }, [user]);

  // Check if journey has requirements
  const checkRequirements = useCallback(async () => {
    if (!leg?.journey_id) return { hasRequirements: false, autoApprovalEnabled: false };

    setIsCheckingRequirements(true);
    try {
      // Check requirements first (required)
      let reqs: any[] = [];
      try {
        const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
          signal: AbortSignal.timeout(10000),
        });
        if (requirementsResponse.ok) {
          const data = await requirementsResponse.json();
          reqs = data.requirements || [];
        }
      } catch (reqError: any) {
        logger.error('[useLegRegistration] Error fetching requirements:', reqError instanceof Error ? { error: reqError.message } : { error: String(reqError) });
        reqs = [];
      }

      // Check auto-approval settings (optional)
      let autoApprovalEnabled = false;
      try {
        const autoApprovalResponse = await fetch(`/api/journeys/${leg.journey_id}/auto-approval`, {
          signal: AbortSignal.timeout(5000),
        });
        if (autoApprovalResponse.ok) {
          const autoApprovalData = await autoApprovalResponse.json();
          autoApprovalEnabled = autoApprovalData.auto_approval_enabled === true;
        }
      } catch (autoApprovalError: any) {
        logger.warn('[useLegRegistration] Could not check auto-approval status:', autoApprovalError instanceof Error ? { error: autoApprovalError.message } : { error: String(autoApprovalError) });
      }

      const hasReqs = reqs.length > 0;
      const hasQuestionReqs = reqs.some((r: any) => r.requirement_type === 'question');
      const passportReq = reqs.find((r: any) => r.requirement_type === 'passport');
      const hasPassportReq = !!passportReq;

      logger.debug('[useLegRegistration] Requirements loaded:', {
        totalReqs: reqs.length,
        requirementTypes: reqs.map((r: any) => r.requirement_type),
        hasPassportReq,
        passportReq: passportReq ? { id: passportReq.id, require_photo_validation: passportReq.require_photo_validation, pass_confidence_score: passportReq.pass_confidence_score } : null,
      });

      setHasRequirements(hasReqs);
      setHasQuestionRequirements(hasQuestionReqs);
      setHasPassportRequirement(hasPassportReq);
      if (passportReq) {
        setPassportRequirement({
          id: passportReq.id,
          require_photo_validation: passportReq.require_photo_validation || false,
          pass_confidence_score: passportReq.pass_confidence_score || 7,
        });
      }
      setAutoApprovalEnabled(autoApprovalEnabled);

      return {
        hasRequirements: hasReqs,
        hasQuestionRequirements: hasQuestionReqs,
        hasPassportRequirement: hasPassportReq,
        passportRequirement: passportReq ? {
          id: passportReq.id,
          require_photo_validation: passportReq.require_photo_validation || false,
          pass_confidence_score: passportReq.pass_confidence_score || 7,
        } : null,
        autoApprovalEnabled,
      };
    } catch (error) {
      logger.error('[useLegRegistration] Error checking requirements:', error instanceof Error ? { error: error.message } : { error: String(error) });
      setHasRequirements(false);
      setHasQuestionRequirements(false);
      setHasPassportRequirement(false);
      setPassportRequirement(null);
      setAutoApprovalEnabled(false);
      return {
        hasRequirements: false,
        hasQuestionRequirements: false,
        hasPassportRequirement: false,
        passportRequirement: null,
        autoApprovalEnabled: false,
      };
    } finally {
      setIsCheckingRequirements(false);
    }
  }, [leg?.journey_id]);

  // Submit registration
  const submitRegistration = useCallback(async (
    answers: any[] = [],
    notes: string = '',
    passportData?: { passport_document_id: string; photo_file?: Blob }
  ): Promise<RegistrationResult> => {
    if (!user || !leg) {
      return { success: false, error: 'You must be logged in to register' };
    }

    if (hasProfileSharingConsent === false) {
      return { success: false, error: 'Profile sharing consent is required to register for legs. Please update your privacy settings.' };
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      // Use FormData if we have passport data (to support multipart)
      if (passportData) {
        const formData = new FormData();
        formData.append('leg_id', leg.leg_id);
        if (notes.trim()) {
          formData.append('notes', notes.trim());
        }
        if (answers.length > 0) {
          formData.append('answers', JSON.stringify(answers));
        }
        formData.append('passport_document_id', passportData.passport_document_id);
        if (passportData.photo_file) {
          formData.append('photo_file', passportData.photo_file, 'passport-photo.jpg');
        }

        const response = await fetch('/api/registrations', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || 'Failed to register';
          throw new Error(errorMessage);
        }

        setRegistrationStatus(data.registration.status);

        return {
          success: true,
          status: data.registration.status,
          auto_approved: data.registration.auto_approved,
        };
      } else {
        // Use JSON if no passport data
        const requestBody: {
          leg_id: string;
          notes: string | null;
          answers?: any[];
        } = {
          leg_id: leg.leg_id,
          notes: notes.trim() || null,
        };

        if (answers.length > 0) {
          requestBody.answers = answers;
        }

        const response = await fetch('/api/registrations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || 'Failed to register';
          throw new Error(errorMessage);
        }

        setRegistrationStatus(data.registration.status);

        return {
          success: true,
          status: data.registration.status,
          auto_approved: data.registration.auto_approved,
        };
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An error occurred while registering';
      setRegistrationError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsRegistering(false);
    }
  }, [user, leg, hasProfileSharingConsent]);

  return {
    registrationStatus,
    registrationStatusChecked,
    hasRequirements,
    hasQuestionRequirements,
    hasPassportRequirement,
    passportRequirement,
    autoApprovalEnabled,
    isCheckingRequirements,
    isRegistering,
    registrationError,
    hasProfileSharingConsent,
    checkingProfileConsent,
    checkRequirements,
    submitRegistration,
    setRegistrationError,
  };
}
