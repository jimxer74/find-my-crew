'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';

export type LegRegistrationData = {
  leg_id: string;
  journey_id: string;
  leg_name: string;
  journey_name: string;
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
      const { data, error } = await supabase
        .from('registrations')
        .select('status')
        .eq('leg_id', leg.leg_id)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading registration status:', error);
        setRegistrationStatus(null);
        setRegistrationStatusChecked(true);
        return;
      }

      setRegistrationStatus(data?.status || null);
      setRegistrationStatusChecked(true);
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
        const { data, error } = await supabase
          .from('user_consents')
          .select('profile_sharing_consent')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking profile sharing consent:', error);
          setHasProfileSharingConsent(null);
        } else {
          setHasProfileSharingConsent(data?.profile_sharing_consent === true);
        }
      } catch (err) {
        console.error('Error checking profile sharing consent:', err);
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
        console.error('Error fetching requirements:', reqError);
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
        console.warn('Could not check auto-approval status:', autoApprovalError);
      }

      const hasReqs = reqs.length > 0;
      setHasRequirements(hasReqs);
      setAutoApprovalEnabled(autoApprovalEnabled);

      return { hasRequirements: hasReqs, autoApprovalEnabled };
    } catch (error) {
      console.error('Error checking requirements:', error);
      setHasRequirements(false);
      setAutoApprovalEnabled(false);
      return { hasRequirements: false, autoApprovalEnabled: false };
    } finally {
      setIsCheckingRequirements(false);
    }
  }, [leg?.journey_id]);

  // Submit registration
  const submitRegistration = useCallback(async (
    answers: any[] = [],
    notes: string = ''
  ): Promise<RegistrationResult> => {
    if (!user || !leg) {
      return { success: false, error: 'You must be logged in to register' };
    }

    if (hasProfileSharingConsent === false) {
      return { success: false, error: 'Profile sharing consent is required to register for legs. Please update your privacy settings.' };
    }

    setIsRegistering(true);
    setRegistrationError(null);

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

    try {
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
