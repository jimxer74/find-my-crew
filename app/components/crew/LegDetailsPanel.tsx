'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { getCostModelConfig, CostModel } from '@/app/types/cost-models';
import { SkillsMatchingDisplay } from '@/app/components/crew/SkillsMatchingDisplay';
import { RegistrationRequirementsForm } from '@/app/components/crew/RegistrationRequirementsForm';
import { RegistrationSuccessModal } from '@/app/components/crew/RegistrationSuccessModal';
import { PassportVerificationStep } from '@/app/components/crew/PassportVerificationStep';
import { useAuth } from '@/app/contexts/AuthContext';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import { LimitedAccessIndicator } from '@/app/components/profile/LimitedAccessIndicator';
import { useTheme } from '@/app/contexts/ThemeContext';
import { MatchBadge } from '../ui/MatchBadge';
import { CostModelBadge } from '../ui/CostModelBadge';
import { CostModelIcon } from '../ui/CostModelIcon';
import { matchRiskLevel } from '@/app/lib/skillMatching';
import { useProfileRedirect } from '@/app/lib/profile/redirectHelper';
import { ImageCarousel } from '../ui/ImageCarousel';
import { useProfile } from '@/app/lib/profile/useProfile';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { logger } from '@/app/lib/logger';
import { LoadingButton } from '@/app/components/ui/LoadingButton';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

// Helper function to normalize risk level (handles different formats from database)
// Handles both single strings and arrays (journeys can have multiple risk levels)
const normalizeRiskLevel = (riskLevel: string | string[] | null | undefined): RiskLevel | null => {
  if (!riskLevel) return null;
  
  // Handle array case (journey risk levels can be arrays)
  if (Array.isArray(riskLevel)) {
    // Use the first risk level in the array
    if (riskLevel.length === 0) return null;
    riskLevel = riskLevel[0];
  }
  
  if (typeof riskLevel !== 'string') return null;
  
  const normalized = riskLevel.trim();
  // Handle different possible formats
  if (normalized === 'Coastal sailing' || normalized.toLowerCase() === 'coastal sailing' || normalized === 'coastal_sailing') {
    return 'Coastal sailing';
  }
  if (normalized === 'Offshore sailing' || normalized.toLowerCase() === 'offshore sailing' || normalized === 'offshore_sailing') {
    return 'Offshore sailing';
  }
  if (normalized === 'Extreme sailing' || normalized.toLowerCase() === 'extreme sailing' || normalized === 'extreme_sailing') {
    return 'Extreme sailing';
  }
  return null;
};


// Helper function to get risk level config (theme is passed as parameter, not via hook)
const getRiskLevelConfig = (riskLevel: RiskLevel | null, isDark: boolean) => {
  if (!riskLevel) {
    return null;
  }

  switch (riskLevel) {
    case 'Coastal sailing':
      return {
        icon: isDark ? "/coastal_sailing_dark.png" : "/coastal_sailing.png",
        displayName: riskLevelsConfig.coastal_sailing.title,
        shortDescription: riskLevelsConfig.coastal_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
        fullInfoText: riskLevelsConfig.coastal_sailing.infoText,
      };
    case 'Offshore sailing':
      return {
        icon: isDark ? "/offshore_sailing_dark.png" : "/offshore_sailing.png",
        displayName: riskLevelsConfig.offshore_sailing.title,
        shortDescription: riskLevelsConfig.offshore_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
        fullInfoText: riskLevelsConfig.offshore_sailing.infoText,
      };
    case 'Extreme sailing':
      return {
        icon: isDark ? "/extreme_sailing_dark.png" : "/extreme_sailing.png",
        displayName: riskLevelsConfig.extreme_sailing.title,
        shortDescription: riskLevelsConfig.extreme_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
        fullInfoText: riskLevelsConfig.extreme_sailing.infoText,
      };
    default:
      return null;
  }
};

type Leg = {
  leg_id: string;
  leg_name: string;
  leg_description: string | null;
  journey_id: string;
  journey_name: string;
  start_date: string | null;
  end_date: string | null;
  crew_needed: number | null;
  leg_risk_level: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null;
  journey_risk_level: ('Coastal sailing' | 'Offshore sailing' | 'Extreme sailing')[] | null;
  cost_model: CostModel | null;
  journey_images: string[];
  skills: string[];
  boat_id: string;
  boat_name: string;
  boat_type: string | null;
  boat_image_url: string | null;
  boat_average_speed_knots: number | null;
  boat_make_model: string | null;
  owner_name: string | null;
  owner_image_url: string | null;
  min_experience_level: number | null;
  skill_match_percentage?: number;
  experience_level_matches?: boolean;
  start_waypoint: {
    lng: number;
    lat: number;
    name: string | null;
  } | null;
  end_waypoint: {
    lng: number;
    lat: number;
    name: string | null;
  } | null;
};

type LegDetailsPanelProps = {
  leg: Leg;
  isOpen: boolean;
  onClose: () => void;
  userSkills?: string[]; // User's skills for matching display
  userExperienceLevel?: number | null; // User's experience level for matching display
  userRiskLevel?: string[] | null; // User's risk level for matching display
  onRegistrationChange?: () => void; // Callback when registration status changes
  initialOpenRegistration?: boolean; // Auto-open registration form when panel loads
};

export function LegDetailsPanel({ leg, isOpen, onClose, userSkills = [], userExperienceLevel = null, userRiskLevel = null, onRegistrationChange, initialOpenRegistration = false }: LegDetailsPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { handleRedirect } = useProfileRedirect();
  const theme = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isRiskLevelDialogOpen, setIsRiskLevelDialogOpen] = useState(false);
  const [isExperienceLevelDialogOpen, setIsExperienceLevelDialogOpen] = useState(false);
  const [journeyRiskLevel, setJourneyRiskLevel] = useState<RiskLevel | null>(null);
  const [journeyImages, setJourneyImages] = useState<string[]>([]);
  const [journeyDescription, setJourneyDescription] = useState<string | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const handleProfileSetupClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      await handleRedirect(user.id, router, true); // true for profile setup
    }
  };

  // Calculate distance between start and end waypoints (nautical miles)
  const calculateDistance = (): number | null => {
    if (!leg.start_waypoint || !leg.end_waypoint) return null;

    const R = 3440; // Earth's radius in nautical miles
    const lat1 = (leg.start_waypoint.lat * Math.PI) / 180;
    const lat2 = (leg.end_waypoint.lat * Math.PI) / 180;
    const deltaLat = ((leg.end_waypoint.lat - leg.start_waypoint.lat) * Math.PI) / 180;
    const deltaLng = ((leg.end_waypoint.lng - leg.start_waypoint.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const distance = calculateDistance();

  // Calculate duration in hours based on distance and speed (matching owner page calculation)
  const calculateDuration = (): { hours: number | null; formatted: string } => {
    // Ensure boat speed is a valid number
    const boatSpeed = typeof leg.boat_average_speed_knots === 'string' 
      ? parseFloat(leg.boat_average_speed_knots) 
      : leg.boat_average_speed_knots;
    
    if (!distance || !boatSpeed || boatSpeed <= 0 || isNaN(boatSpeed)) {
      return { hours: null, formatted: 'N/A' };
    }
    
    // Account for 70-80% efficiency due to conditions (same as owner page)
    const effectiveSpeed = boatSpeed * 0.75;
    const hours = distance / effectiveSpeed;
    
    // Format duration as human-readable string (same as owner page)
    if (hours < 24) {
      return { hours, formatted: `${Math.round(hours)}h` };
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours === 0) {
      return { hours, formatted: `${days}d` };
    }
    return { hours, formatted: `${days}d ${remainingHours}h` };
  };

  const duration = calculateDuration();

  // Get risk level color
  const getRiskLevelColor = (riskLevel: string | null): string => {
    switch (riskLevel) {
      case 'Coastal sailing':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Offshore sailing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Extreme sailing':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ exists: boolean; hasRoles: boolean; completionPercentage: number } | null>(null);

  
  

  // Initialize journey images from leg data when leg changes
  useEffect(() => {
    if (leg.journey_images && leg.journey_images.length > 0) {
      setJourneyImages(leg.journey_images);
    } else {
      setJourneyImages([]);
    }
  }, [leg.journey_images]);

  // Fetch journey description when panel opens
  useEffect(() => {
    if (!isOpen || !leg.journey_id) {
      setJourneyDescription(null);
      return;
    }

    const fetchJourneyDescription = async () => {
      setIsLoadingDescription(true);
      logger.debug('Fetching journey description', { journeyId: leg.journey_id }, true);
      try {
        const response = await fetch(`/api/journeys/${leg.journey_id}/details`, {
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        logger.debug('Journey fetch response status', { status: response.status }, true);

        if (response.ok) {
          const data = await response.json();
          logger.debug('Journey fetch response data', { hasData: !!data }, true);
          const description = data.journey_description || null;
          setJourneyDescription(description);
          logger.debug('Fetched journey description', { journeyId: leg.journey_id, hasDescription: !!description }, true);
        } else {
          logger.warn('Failed to fetch journey description', { status: response.status, statusText: response.statusText });
          const errorText = await response.text();
          logger.warn('Error response text', { errorText });
          try {
            const errorData = JSON.parse(errorText);
            logger.warn('Error response JSON', { hasErrorData: !!errorData });
          } catch (e) {
            logger.warn('Error response not JSON', { errorText });
          }
          setJourneyDescription(null);
        }
      } catch (error) {
        logger.error('Error fetching journey description', { error: error instanceof Error ? error.message : String(error) });
        setJourneyDescription(null);
      } finally {
        setIsLoadingDescription(false);
      }
    };

    fetchJourneyDescription();
  }, [isOpen, leg.journey_id]);

  // Process risk level from leg and journey data (now provided by API)
  useEffect(() => {
    logger.debug('Processing risk level', {
      legRiskLevel: leg.leg_risk_level,
      journeyRiskLevel: leg.journey_risk_level,
      journeyId: leg.journey_id,
      isOpen
    });
    
    // Normalize leg's risk level first
    const normalizedLegRiskLevel = normalizeRiskLevel(leg.leg_risk_level);
    logger.debug('Normalized leg risk level', { normalizedLegRiskLevel }, true);
    
    // Process journey's risk level array (take first one if multiple)
    let normalizedJourneyRiskLevel: RiskLevel | null = null;
    if (leg.journey_risk_level && leg.journey_risk_level.length > 0) {
      // Journey has risk level array - normalize the first one
      normalizedJourneyRiskLevel = normalizeRiskLevel(leg.journey_risk_level[0]);
      logger.debug('Normalized journey risk level (from array)', { normalizedJourneyRiskLevel }, true);
    }
    
    // Set journey risk level state for display
    setJourneyRiskLevel(normalizedJourneyRiskLevel as RiskLevel | null);
  }, [leg.leg_risk_level, leg.journey_risk_level, leg.journey_id, leg.leg_id, isOpen]);

  // Computed risk level: use leg's risk level if available (normalized), otherwise use journey's first risk level
  const normalizedLegRiskLevel = normalizeRiskLevel(leg.leg_risk_level);
  const effectiveRiskLevel = normalizedLegRiskLevel || (leg.journey_risk_level && leg.journey_risk_level.length > 0 
    ? normalizeRiskLevel(leg.journey_risk_level[0]) 
    : null);
  
  // Debug logging
  useEffect(() => {
    logger.debug('Risk level state', {
      legRiskLevel: leg.leg_risk_level,
      journeyRiskLevelArray: leg.journey_risk_level,
      normalizedLegRiskLevel,
      journeyRiskLevel,
      effectiveRiskLevel
    });
  }, [leg.leg_risk_level, leg.journey_risk_level, normalizedLegRiskLevel, journeyRiskLevel, effectiveRiskLevel]);
  const [showRequirementsForm, setShowRequirementsForm] = useState(false);
  const [registrationNotes, setRegistrationNotes] = useState('');
  const [requirementsAnswers, setRequirementsAnswers] = useState<any[]>([]);
  const [hasRequirements, setHasRequirements] = useState(false);
  const [isCheckingRequirements, setIsCheckingRequirements] = useState(false);
  const [autoApprovalEnabled, setAutoApprovalEnabled] = useState(false);
  const [hasProfileSharingConsent, setHasProfileSharingConsent] = useState<boolean | null>(null);
  const [checkingProfileConsent, setCheckingProfileConsent] = useState(false);
  const [registrationStatusChecked, setRegistrationStatusChecked] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{ auto_approved: boolean } | null>(null);
  const [showPassportStep, setShowPassportStep] = useState(false);
  const [hasPassportRequirement, setHasPassportRequirement] = useState(false);
  const [hasQuestionRequirements, setHasQuestionRequirements] = useState(false);
  const [passportRequirement, setPassportRequirement] = useState<any | null>(null);
  const [passportVerificationComplete, setPassportVerificationComplete] = useState(false);
  const [passportData, setPassportData] = useState<{ passport_document_id: string; photo_file?: Blob } | null>(null);

  // Safety effect: Only trigger in very specific edge cases where the main logic might have failed
  // This effect should be extremely conservative and not interfere with normal operation
  useEffect(() => {
    // Only trigger if we're not in the process of checking requirements AND
    // if we somehow have requirements but neither form is active (edge case)
    if (hasRequirements && !showRequirementsForm && !showRegistrationModal && !isCheckingRequirements) {
      // Very conservative check - only switch if we're in a broken state
      const checkRequirementsType = async () => {
        try {
          const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
            signal: AbortSignal.timeout(3000),
          });
          if (requirementsResponse.ok) {
            const data = await requirementsResponse.json();
            const reqs = data.requirements || [];
            const hasQuestionReqs = reqs.some((r: any) => r.requirement_type === 'question');

            logger.debug('Safety edge-case check', { hasRequirements, hasQuestionReqs, showRequirementsForm, showRegistrationModal, isCheckingRequirements }, true);

            if (hasQuestionReqs) {
              logger.warn('Edge case: Requirements exist but no form shown - showing requirements form', {});
              setShowRequirementsForm(true);
            } else {
              logger.debug('Edge case resolved: Server-side requirements exist, showing regular modal', {}, true);
              setShowRegistrationModal(true);
            }
          }
        } catch (error) {
          logger.warn('Could not verify requirement type for edge-case check', { error: error instanceof Error ? error.message : String(error) });
        }
      };

      checkRequirementsType();
    }
  }, [hasRequirements, showRequirementsForm, showRegistrationModal, isCheckingRequirements, leg.journey_id]);

  // Prevent regular modal from showing if question requirements exist
  // Only blocks if we have question requirements that need the form
  // This effect should be extremely conservative and only handle edge cases
  useEffect(() => {
    // Only trigger if we're not in the process of checking requirements AND
    // if we're in a state where we have requirements but neither form is active
    if (hasRequirements && showRegistrationModal && !showRequirementsForm && !isCheckingRequirements) {
      const checkRequirementsType = async () => {
        try {
          const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
            signal: AbortSignal.timeout(3000),
          });
          if (requirementsResponse.ok) {
            const data = await requirementsResponse.json();
            const reqs = data.requirements || [];
            const hasQuestionReqs = reqs.some((r: any) => r.requirement_type === 'question');

            logger.debug('Edge-case blocking check', { hasRequirements, hasQuestionReqs, showRequirementsForm, showRegistrationModal, isCheckingRequirements }, true);

            // Only block if we have question requirements AND the user hasn't explicitly chosen the regular form
            if (hasQuestionReqs && reqs.length > 0) {
              logger.warn('Edge case: Question requirements exist but regular modal shown - switching to requirements form', {});
              setShowRegistrationModal(false);
              setShowRequirementsForm(true);
            } else {
              logger.debug('Edge-case check passed: Server-side requirements only, keeping regular modal', {}, true);
              // For server-side requirements, keep the regular modal active
              setShowRequirementsForm(false);
              setShowRegistrationModal(true);
            }
          }
        } catch (error) {
          logger.warn('Could not verify requirement type for edge-case blocking check', { error: error instanceof Error ? error.message : String(error) });
        }
      };

      checkRequirementsType();
    }
  }, [hasRequirements, showRegistrationModal, showRequirementsForm, isCheckingRequirements, leg.journey_id]);

  // Use shared useProfile hook for profile status
  const { profile } = useProfile();

  useEffect(() => {
    if (!user || !profile) {
      setProfileStatus({ exists: false, hasRoles: false, completionPercentage: 0 });
      return;
    }

    const roles = profile.roles || [];
    setProfileStatus({
      exists: true,
      hasRoles: roles.length > 0,
      completionPercentage: profile.profile_completion_percentage || 0,
    });
  }, [user, profile]);

  // Load registration status when leg changes
  useEffect(() => {
    if (!user || !leg.leg_id) {
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
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error loading registration status', { error: error instanceof Error ? error.message : String(error) });
        setRegistrationStatus(null);
        setRegistrationStatusChecked(true);
        return;
      }

      setRegistrationStatus(data?.status || null);
      setRegistrationStatusChecked(true);
    };

    loadRegistrationStatus();
  }, [user, leg.leg_id]);

  // Check profile sharing consent
  useEffect(() => {
    if (!user) {
      setHasProfileSharingConsent(null);
      return;
    }

    const checkProfileSharingConsent = async () => {
      setCheckingProfileConsent(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('user_consents')
          .select('profile_sharing_consent')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          logger.error('Error checking profile sharing consent', { error: error instanceof Error ? error.message : String(error) });
          setHasProfileSharingConsent(null);
        } else {
          setHasProfileSharingConsent(data?.profile_sharing_consent === true);
        }
      } catch (err) {
        logger.error('Error checking profile sharing consent', { error: err instanceof Error ? err.message : String(err) });
        setHasProfileSharingConsent(null);
      } finally {
        setCheckingProfileConsent(false);
      }
    };

    checkProfileSharingConsent();
  }, [user]);

  // Check if journey has requirements when register button is clicked
  const checkRequirements = useCallback(async () => {
    try {
      // Check requirements first (required)
      let reqs: any[] = [];
      try {
        const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        if (requirementsResponse.ok) {
          const data = await requirementsResponse.json();
          reqs = data.requirements || [];
        }
      } catch (reqError: any) {
        logger.error('Error fetching requirements', { error: reqError instanceof Error ? reqError.message : String(reqError) });
        // Continue with empty requirements if fetch fails
        reqs = [];
      }
      
      // Check auto-approval settings (optional - don't block if it fails)
      let autoApprovalEnabled = false;
      try {
        logger.debug('Checking auto-approval for journey', { journeyId: leg.journey_id }, true);
        const autoApprovalResponse = await fetch(`/api/journeys/${leg.journey_id}/auto-approval`, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        if (autoApprovalResponse.ok) {
          const autoApprovalData = await autoApprovalResponse.json();
          autoApprovalEnabled = autoApprovalData.auto_approval_enabled === true;
          logger.debug('Auto-approval check result', {
            journeyId: leg.journey_id,
            autoApprovalEnabled,
            threshold: autoApprovalData.auto_approval_threshold,
          });
        } else {
          logger.warn('Auto-approval check failed', { status: autoApprovalResponse.status });
        }
      } catch (autoApprovalError: any) {
        // Log but don't block - auto-approval check is optional
        logger.warn('Could not check auto-approval status (non-critical)', {
          error: autoApprovalError.message,
          errorName: autoApprovalError.name,
          journeyId: leg.journey_id,
        });
        autoApprovalEnabled = false;
      }
      
      const hasReqs = reqs.length > 0;
      const hasQuestionReqs = reqs.some((r: any) => r.requirement_type === 'question');
      const hasPassportReqs = reqs.some((r: any) => r.requirement_type === 'passport');
      const passportReq = reqs.find((r: any) => r.requirement_type === 'passport');

      logger.debug('Requirements check result', {
        journeyId: leg.journey_id,
        hasReqs,
        hasQuestionReqs,
        hasPassportReqs,
        requirementsCount: reqs.length,
        requirementTypes: reqs.map((r: any) => r.requirement_type),
        autoApprovalEnabled,
        willShowRequirementsForm: hasQuestionReqs,
        actualRequirements: reqs,
      });

      // Update state synchronously
      setHasRequirements(hasReqs);
      setAutoApprovalEnabled(autoApprovalEnabled);
      setHasPassportRequirement(hasPassportReqs);
      setHasQuestionRequirements(hasQuestionReqs);
      if (passportReq) {
        setPassportRequirement({
          id: passportReq.id,
          require_photo_validation: passportReq.require_photo_validation || false,
          pass_confidence_score: passportReq.pass_confidence_score || 7,
        });
      } else {
        setPassportRequirement(null);
      }

      // Show passport verification first if passport requirements exist and haven't been completed
      // Then show requirements form if there are question-type requirements
      // Otherwise show regular registration modal for server-side requirements
      if (hasPassportReqs && !passportVerificationComplete) {
        logger.debug('Showing passport verification step', {
          autoApprovalEnabled,
          requirementsCount: reqs.length,
        });
        setShowPassportStep(true);
        setShowRegistrationModal(false);
        setShowRequirementsForm(false);
      } else if (hasQuestionReqs) {
        logger.debug('Showing requirements form (question requirements exist)', {
          autoApprovalEnabled,
          requirementsCount: reqs.length,
        });
        // Set state synchronously - ensure requirements form is shown
        setShowRegistrationModal(false);
        setShowRequirementsForm(false); // Reset first
        setHasRequirements(true);
        // Use setTimeout(0) to ensure state updates are batched and applied
        setTimeout(() => {
          setShowRequirementsForm(true);
        }, 0);
      } else if (hasReqs) {
        // Server-side requirements only (risk_level, experience_level, skill)
        // Show regular registration modal - the server will handle these requirements
        logger.debug('Showing regular registration modal (server-side requirements only)', {
          autoApprovalEnabled,
          requirementsCount: reqs.length,
        });
        setShowRequirementsForm(false);
        setHasRequirements(true);
        // Only show regular modal if requirements exist (even if server-side)
        setTimeout(() => {
          setShowRegistrationModal(true);
        }, 0);
      } else {
        // No requirements at all
        logger.debug('Showing regular registration modal (no requirements)', {}, true);
        setShowRequirementsForm(false);
        setHasRequirements(false);
        setAutoApprovalEnabled(false); // Reset when no requirements
        // Only show regular modal if no requirements exist
        setTimeout(() => {
          setShowRegistrationModal(true);
        }, 0);
      }
    } catch (error) {
      logger.error('Error checking requirements', { error: error instanceof Error ? error.message : String(error) });
      // On error, try to verify requirements one more time before defaulting
      // This prevents showing regular modal when requirements actually exist
      try {
        const fallbackResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
          signal: AbortSignal.timeout(3000),
        });
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const fallbackReqs = fallbackData.requirements || [];
          if (fallbackReqs.length > 0) {
            logger.warn('Fallback check found requirements, showing requirements form', { count: fallbackReqs.length });
            setShowRegistrationModal(false);
            setHasRequirements(true);
            requestAnimationFrame(() => {
              setShowRequirementsForm(true);
            });
            setIsCheckingRequirements(false);
            return;
          }
        }
      } catch (fallbackError) {
        logger.warn('Fallback requirements check also failed', { error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) });
      }
      
      // Only show regular modal if we're sure there are no requirements
      logger.warn('Error checking requirements, defaulting to no requirements', { error: error instanceof Error ? error.message : String(error) });
      setHasRequirements(false);
      setShowRequirementsForm(false);
      requestAnimationFrame(() => {
        setShowRegistrationModal(true);
      });
    } finally {
      setIsCheckingRequirements(false);
    }
  }, [leg]);

  // Handle register button click
  const handleRegister = useCallback(async () => {
    // Check profile sharing consent first
    if (hasProfileSharingConsent === false) {
      setRegistrationError('Profile sharing consent is required to register for legs. Please update your privacy settings.');
      return;
    }

    setRegistrationError(null);
    setRegistrationNotes('');
    setRequirementsAnswers([]);
    setPassportData(null);
    setPassportVerificationComplete(false);
    setShowPassportStep(false);
    // Check requirements first
    await checkRequirements();
  }, [hasProfileSharingConsent, checkRequirements]);

  // Handle passport verification completion
  const handlePassportComplete = useCallback((data: { passport_document_id: string; photo_file?: Blob }) => {
    logger.debug('Passport verification complete', { passport_document_id: data.passport_document_id, hasPhoto: !!data.photo_file }, true);
    setPassportData(data);
    setPassportVerificationComplete(true);
    setShowPassportStep(false);
    // Now show the requirements form or registration modal
    setTimeout(() => {
      if (hasQuestionRequirements) {
        setShowRequirementsForm(true);
      } else {
        setShowRegistrationModal(true);
      }
    }, 0);
  }, [hasQuestionRequirements]);

  // Handle passport verification cancellation
  const handlePassportCancel = useCallback(() => {
    logger.debug('Passport verification cancelled', {}, true);
    setShowPassportStep(false);
    setPassportVerificationComplete(false);
    setPassportData(null);
    setRegistrationNotes('');
    setRequirementsAnswers([]);
  }, []);

  // Auto-open registration form when initialOpenRegistration is true
  const initialRegistrationTriggeredRef = useRef(false);
  useEffect(() => {
    logger.debug('Auto-open registration check', {
      initialOpenRegistration,
      isOpen,
      hasUser: !!user,
      hasLeg: !!leg,
      legId: leg?.leg_id,
      registrationStatus,
      registrationStatusChecked,
      alreadyTriggered: initialRegistrationTriggeredRef.current,
    });
    
    // Only trigger once per panel open
    // Wait for registration status to be checked, then only auto-open if no existing registration
    if (
      initialOpenRegistration && 
      isOpen && 
      user && 
      leg && 
      leg.leg_id && 
      !initialRegistrationTriggeredRef.current && 
      registrationStatusChecked &&
      registrationStatus === null
    ) {
      logger.debug('Triggering auto-open registration', {}, true);
      initialRegistrationTriggeredRef.current = true;
      // Delay slightly to allow consent checks to complete and leg data to be ready
      const timer = setTimeout(() => {
        logger.debug('Executing handleRegister() for auto-open', {}, true);
        handleRegister();
      }, 500);
      return () => clearTimeout(timer);
    }
    // Reset the ref when panel closes
    if (!isOpen) {
      initialRegistrationTriggeredRef.current = false;
    }
  }, [initialOpenRegistration, isOpen, user, registrationStatus, registrationStatusChecked, leg, handleRegister]);

  // Handle requirements form completion - now includes notes and submits directly
  const handleRequirementsComplete = async (answers: any[], notes: string) => {
    logger.debug('Requirements form completed', {
      answersCount: answers.length,
      answers: answers,
      notesLength: notes.length,
    });

    if (!answers || answers.length === 0) {
      logger.error('Requirements form completed but no answers provided', {});
      setRegistrationError('Please answer all required questions');
      return;
    }

    // Update state for UI consistency
    setRequirementsAnswers(answers);
    setRegistrationNotes(notes);
    // Submit registration directly from requirements form, passing answers directly
    // to avoid React state update race condition
    await handleSubmitRegistration(answers, notes);
  };

  // Submit registration
  // Optional parameters allow passing answers/notes directly to avoid state race conditions
  const handleSubmitRegistration = async (providedAnswers?: any[], providedNotes?: string) => {
    if (!user) {
      setRegistrationError('You must be logged in to register');
      return;
    }

    // Check profile sharing consent before submitting
    if (hasProfileSharingConsent === false) {
      setRegistrationError('Profile sharing consent is required to register for legs. Please update your privacy settings.');
      return;
    }

    // Use provided answers/notes if available, otherwise fall back to state
    const answersToUse = providedAnswers !== undefined ? providedAnswers : requirementsAnswers;
    const notesToUse = providedNotes !== undefined ? providedNotes : registrationNotes;

    // IMMEDIATE check: If state says question requirements exist but no answers, block immediately
    // But skip this check if answers were provided directly (from requirements form)
    if (providedAnswers === undefined && hasRequirements && requirementsAnswers.length === 0) {
      // Check if we have question requirements specifically
      try {
        const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
          signal: AbortSignal.timeout(3000),
        });
        if (requirementsResponse.ok) {
          const data = await requirementsResponse.json();
          const reqs = data.requirements || [];
          const hasQuestionReqs = reqs.some((r: any) => r.requirement_type === 'question');

          if (hasQuestionReqs) {
            logger.error('Cannot submit: Question requirements exist but no answers provided (immediate state check)', {});
            setRegistrationError('Please complete all required questions before submitting');
            setShowRegistrationModal(false);
            setShowRequirementsForm(true);
            return;
          }
          // If we get here, we only have server-side requirements, which is fine to submit
        }
      } catch (error) {
        logger.warn('Could not verify requirements in immediate check', { error: error instanceof Error ? error.message : String(error) });
        // Continue with submission if check fails - don't block user
      }
    }

    // Check if question requirements exist but no answers provided (using direct or state values)
    if (hasRequirements && answersToUse.length === 0) {
      // Check if we have question requirements specifically
      try {
        const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
          signal: AbortSignal.timeout(3000),
        });
        if (requirementsResponse.ok) {
          const data = await requirementsResponse.json();
          const reqs = data.requirements || [];
          const hasQuestionReqs = reqs.some((r: any) => r.requirement_type === 'question');

          if (hasQuestionReqs) {
            logger.error('Cannot submit: Question requirements exist but no answers provided', {});
            setRegistrationError('Please complete all required questions before submitting');
            setShowRegistrationModal(false);
            setShowRequirementsForm(true);
            return;
          }
          // If we get here, we only have server-side requirements, which is fine to submit
        }
      } catch (error) {
        logger.warn('Could not verify requirements in check', { error: error instanceof Error ? error.message : String(error) });
        // Continue with submission if check fails - don't block user
      }
    }

    // Safety check: Verify question requirements exist if we don't have answers
    // This prevents race conditions where state hasn't updated yet
    // Skip this check if answers were provided directly
    if (providedAnswers === undefined && answersToUse.length === 0) {
      logger.debug('No answers provided, checking if question requirements exist', {}, true);
      try {
        const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
          signal: AbortSignal.timeout(5000),
        });
        if (requirementsResponse.ok) {
          const data = await requirementsResponse.json();
          const reqs = data.requirements || [];
          const hasQuestionReqs = reqs.some((r: any) => r.requirement_type === 'question');

          if (hasQuestionReqs) {
            logger.error('Cannot submit: Question requirements exist but no answers provided', { count: reqs.length });
            setRegistrationError('Please complete all required questions before submitting');
            // Switch to requirements form
            setShowRegistrationModal(false);
            setShowRequirementsForm(true);
            setHasRequirements(true);
            return;
          }
          // If we get here, we only have server-side requirements, which is fine to submit
          logger.debug('Safety check passed: Only server-side requirements, proceeding with submission', { count: reqs.length }, true);
        }
      } catch (error) {
        logger.warn('Could not verify requirements, proceeding with submission', { error: error instanceof Error ? error.message : String(error) });
        // Continue with submission if check fails (don't block user)
      }
    }

    setIsRegistering(true);
    setRegistrationError(null);

    logger.debug('Submitting registration', {
      leg_id: leg.leg_id,
      journey_id: leg.journey_id,
      hasNotes: !!notesToUse,
      notesLength: notesToUse?.length || 0,
      answersLength: answersToUse?.length || 0,
      answers: answersToUse,
      answersToUseLength: answersToUse.length,
      hasPassportData: !!passportData,
      passportDocumentId: passportData?.passport_document_id,
      hasPhoto: !!passportData?.photo_file,
      match_percentage: leg.skill_match_percentage,
      providedAnswers: providedAnswers !== undefined,
      requirementsAnswersLength: requirementsAnswers.length,
      hasRequirements,
      sendingAnswers: !!answersToUse && answersToUse.length > 0,
    });

    try {
      let response;

      // Use FormData if we have passport data (to support multipart)
      if (passportData) {
        const formData = new FormData();
        formData.append('leg_id', leg.leg_id);
        if (notesToUse?.trim()) {
          formData.append('notes', notesToUse.trim());
        }
        if (answersToUse.length > 0) {
          formData.append('answers', JSON.stringify(answersToUse));
        }
        formData.append('passport_document_id', passportData.passport_document_id);
        if (passportData.photo_file) {
          formData.append('photo_file', passportData.photo_file, 'passport-photo.jpg');
        }

        response = await fetch('/api/registrations', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Use JSON if no passport data
        const requestBody: {
          leg_id: string;
          notes: string | null;
          match_percentage?: number | null;
          answers?: any[];
        } = {
          leg_id: leg.leg_id,
          notes: notesToUse?.trim() || null,
        };

        // Only include answers if we have them (don't send empty array)
        if (answersToUse.length > 0) {
          requestBody.answers = answersToUse;
        }

        response = await fetch('/api/registrations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        logger.error('Registration failed', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          details: data.details,
          fullResponse: data,
        });
        const errorMessage = data.error || 'Failed to register';
        const detailsMessage = data.details ? ` (${JSON.stringify(data.details)})` : '';
        throw new Error(errorMessage + detailsMessage);
      }

      // Update local state
      setRegistrationStatus(data.registration.status);
      setRegistrationResult({ auto_approved: data.registration.auto_approved });
      setShowSuccessModal(true);

      // Notify parent component
      onRegistrationChange?.();

      // Close forms but keep panel open to show success modal
      setShowRegistrationModal(false);
      setShowRequirementsForm(false);
      setShowPassportStep(false);
      setAutoApprovalEnabled(false); // Reset when closing
      setRegistrationNotes('');
      setRequirementsAnswers([]);
      setPassportData(null);
      setPassportVerificationComplete(false);
    } catch (error: any) {
      setRegistrationError(error.message || 'An error occurred while registering');
      logger.error('Registration error', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle success modal close - reload registration status to show updated state
  const handleSuccessModalClose = useCallback(async () => {
    setShowSuccessModal(false);
    setRegistrationResult(null);

    // Reload registration status to show the new registration
    if (user && leg?.leg_id) {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from('registrations')
          .select('status')
          .eq('leg_id', leg.leg_id)
          .maybeSingle();

        if (!error) {
          setRegistrationStatus(data?.status || null);
        }
      } catch (err) {
        logger.warn('Failed to reload registration status', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Reset registration form state
    setShowRegistrationModal(false);
    setShowRequirementsForm(false);
    setShowPassportStep(false);
  }, [user, leg?.leg_id]);

  // Cancel registration (set to Cancelled)
  const handleCancelRegistration = async () => {
    if (!user || !registrationStatus) return;

    if (!confirm('Are you sure you want to cancel your registration?')) {
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: registration } = await supabase
        .from('registrations')
        .select('id')
        .eq('leg_id', leg.leg_id)
        .maybeSingle();

      if (!registration) {
        throw new Error('Registration not found');
      }

      const { error: updateError } = await supabase
        .from('registrations')
        .update({
          status: 'Cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id);

      if (updateError) {
        throw updateError;
      }

      setRegistrationStatus('Cancelled');
      onRegistrationChange?.();
    } catch (error: any) {
      setRegistrationError(error.message || 'Failed to cancel registration');
      logger.error('Cancel registration error', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRegistering(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Pending approval': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Approved': 'bg-green-100 text-green-800 border-green-300',
      'Not approved': 'bg-red-100 text-red-800 border-red-300',
      'Cancelled': 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${statusConfig[status as keyof typeof statusConfig] || statusConfig['Pending approval']}`}>
        {status}
      </span>
    );
  };


  // Prevent body scroll when panel is open and hide Header on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Add class to hide Header on mobile when panel is open
      document.body.classList.add('leg-details-panel-open');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('leg-details-panel-open');
      // Reset minimized state when panel closes
      setIsMinimized(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('leg-details-panel-open');
    };
  }, [isOpen]);

  // Helper function to check if risk level matches
  const riskLevelMatches = (leg:Leg, userRiskLevel:RiskLevel): boolean => {
    logger.debug('leg.leg_risk_level', { value: leg.leg_risk_level }, true);
    logger.debug('leg.journey_risk_level', { value: leg.journey_risk_level }, true);
    logger.debug('userRiskLevel', { value: userRiskLevel }, true);
    if(leg.leg_risk_level === null) {
      return leg.journey_risk_level?.includes(userRiskLevel) ?? false;
    }
    return leg.leg_risk_level?.includes(userRiskLevel) ?? false;
  }

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[190] md:hidden"
          onClick={onClose}
        />
      )}
      
      <div className="flex flex-col min-h-screen">


      {/* Panel - Left Side on desktop, Full Screen on mobile - Overlays the map */}
      <div
        ref={panelRef}
        className={`fixed top-0 left-0 right-0 md:right-auto bottom-0 bg-card border-r border-border shadow-2xl z-[200] transition-all duration-300 ease-out rounded-t-lg md:rounded-t-none ${
          isOpen 
            ? isMinimized 
              ? 'w-0 md:w-0' 
              : 'w-full md:w-[400px] translate-x-0'
            : '-translate-x-full md:-translate-x-full w-0'
        }`}
      >
        {/* Close button for mobile - Top right */}
        {isOpen && !isMinimized && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 bg-card border border-border rounded-md p-2 min-w-[44px] min-h-[44px] flex items-center justify-center shadow-sm hover:bg-accent transition-all md:hidden cursor-pointer"
            title="Close panel"
            aria-label="Close panel"
          >
            <svg
              className="w-6 h-6 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Minimize button - Desktop only - Right edge of pane */}
        {isOpen && !isMinimized && (
          <button
            onClick={() => setIsMinimized(true)}
            className="hidden md:flex w-8 h-12 absolute top-1/2 -right-7.5 -z-10 -translate-y-1/2 bg-card border border-border rounded-r-md items-center justify-center shadow-md hover:bg-accent transition-all cursor-pointer"
            title="Minimize panel"
            aria-label="Minimize panel"
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 18l-6-6 6-6"
              />
            </svg>
          </button>
        )}

        {/* Maximize button when minimized - Desktop only */}
        {isOpen && isMinimized && (
          <button
            onClick={() => setIsMinimized(false)}
            className="hidden md:flex w-8 h-12 absolute top-1/2 -translate-y-1/2 left-0 z-10 bg-card border border-border rounded-r-md items-center justify-center shadow-md hover:bg-accent transition-all cursor-pointer"
            title="Maximize panel"
            aria-label="Maximize panel"
          >
            <svg
              className="w-5 h-5 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Close button - Desktop only - Top right inside panel */}
        {isOpen && !isMinimized && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="hidden md:flex absolute top-4 right-4 z-10 bg-card border border-border rounded-md p-2 min-w-[44px] min-h-[44px] items-center justify-center shadow-sm hover:bg-accent transition-all cursor-pointer"
            title="Close panel"
            aria-label="Close panel"
          >
            <svg
              className="w-6 h-6 text-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Content */}
        {!isMinimized && (
          <>
            {/* Passport Verification Step - In pane */}
            {showPassportStep && passportRequirement ? (
              <div className="h-full relative" style={{ zIndex: 1 }}>
                <PassportVerificationStep
                  journeyId={leg.journey_id}
                  legName={leg.leg_name}
                  requirement={passportRequirement}
                  onComplete={handlePassportComplete}
                  onCancel={handlePassportCancel}
                  isLoading={isRegistering}
                  error={registrationError || undefined}
                />
              </div>
            ) : showRequirementsForm ? (
              <div className="h-full relative" style={{ zIndex: 1 }}>
                <RegistrationRequirementsForm
                  journeyId={leg.journey_id}
                  legName={leg.leg_name}
                  onComplete={handleRequirementsComplete}
                  onCancel={() => {
                    setShowRequirementsForm(false);
                    setRegistrationNotes('');
                    setRequirementsAnswers([]);
                    setRegistrationError(null);
                  }}
                  isRegistering={isRegistering}
                  registrationError={registrationError}
                  autoApprovalEnabled={autoApprovalEnabled}
                />
              </div>
            ) : showRegistrationModal && isRegistering ? (
              /* Loading state - Show while registration is being submitted */
              <div className="flex flex-col h-full items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-muted-foreground">Submitting registration...</p>
              </div>
            ) : showRegistrationModal && !isRegistering && (!hasRequirements || (hasRequirements && showRequirementsForm === false)) ? (
              /* Registration Form - In pane - Show if NO requirements OR if requirements exist but requirements form is not shown (server-side requirements) */
              <div className="flex flex-col h-full">
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Register for Leg</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Register your interest to join this leg: <span className="font-medium text-foreground">{leg.leg_name}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={registrationNotes}
                      onChange={(e) => setRegistrationNotes(e.target.value)}
                      placeholder="Tell the owner why you're interested in this leg..."
                      className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      rows={4}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {registrationNotes.length}/500 characters
                    </p>
                  </div>

                  {registrationError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {registrationError}
                    </div>
                  )}
                </div>

                {/* Sticky footer */}
                <div className="flex-shrink-0 border-t border-border bg-card p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRegistrationModal(false);
                        setRegistrationNotes('');
                        setRequirementsAnswers([]);
                        setRegistrationError(null);
                      }}
                      disabled={isRegistering}
                      className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        // Check if we have question requirements before allowing submission
                        // This prevents race conditions where requirements form should be shown
                        try {
                          const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
                            signal: AbortSignal.timeout(3000),
                          });
                          if (requirementsResponse.ok) {
                            const data = await requirementsResponse.json();
                            const reqs = data.requirements || [];
                            const hasQuestionReqs = reqs.some((r: any) => r.requirement_type === 'question');

                            if (hasQuestionReqs) {
                              logger.error('Cannot submit: Question requirements exist, showing requirements form', { count: reqs.length });
                              setRegistrationError('Please complete the required questions first');
                              setShowRegistrationModal(false);
                              setShowRequirementsForm(true);
                              setHasRequirements(true);
                              return;
                            }
                            // If we get here, we only have server-side requirements (or no requirements), which is fine to submit
                            logger.debug('Submitting: No question requirements', { total: reqs.length }, true);
                          }
                        } catch (error) {
                          logger.warn('Could not verify requirements before submit', { error: error instanceof Error ? error.message : String(error) });
                          // Continue with submission if check fails - don't block user
                        }

                        // Submit registration (server will handle server-side requirements)
                        handleSubmitRegistration();
                      }}
                      disabled={isRegistering}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRegistering ? 'Registering...' : 'Submit Registration'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            <div className="flex flex-col h-full relative" style={{ zIndex: 1 }}>
              <div className="flex-1 overflow-y-auto min-h-0">
                {/* Boat Image */}
                {leg.boat_image_url || (journeyImages && journeyImages.length > 0) ? (
                  <div className="space-y-4">
                    {/* Combined Image Carousel */}
                    <div className="relative w-full h-60 overflow-hidden rounded-b-lg">
                      <ImageCarousel
                        images={[
                          ...(leg.boat_image_url ? [leg.boat_image_url] : []),
                          ...journeyImages
                        ]}
                        alt={`${leg.boat_name} and journey images`}
                        className="object-cover object-bottom"
                        showThumbnails={true}
                        autoPlay={false}
                      />

                      {/* Match Percentage Badge Only - only show when user is logged in */}
                      {user && leg.skill_match_percentage !== undefined && leg.skill_match_percentage !== null && (
                        <div className="absolute top-3 left-3">
                          <MatchBadge
                            percentage={leg.skill_match_percentage}
                            showLabel={true}
                            size="sm"
                            className="shadow-lg"
                          />
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  // Fallback when no images available
                  <div className="relative w-full h-48 overflow-hidden rounded-lg bg-muted">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">No images available</span>
                    </div>

                    {/* Match Percentage Badge for fallback image - only show when user is logged in */}
                    {user && leg.skill_match_percentage !== undefined && leg.skill_match_percentage !== null && (
                      <div className="absolute top-3 left-3">
                        <MatchBadge
                          percentage={leg.skill_match_percentage}
                          showLabel={true}
                          size="sm"
                          className="shadow-lg"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="relative p-4 sm:p-4 space-y-2 sm:space-y-2 text-center">              
       

            {/* Header */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-1">{leg.leg_name}</h2>
              <p className="text-muted-foreground">{leg.journey_name}</p>
            </div>

            {/* Description */}
            {leg.leg_description && (
              <div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{leg.leg_description}</p>
              </div>
            )}

            {/* Start and End Points with Arrow */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-4 text-left">
              {/* Start Point */}
              <div className="flex flex-col justify-center">
                {leg.start_waypoint ? (
                  <div className="text-xs text-foreground leading-tight">
                    <div className="font-semibold">
                      {(() => {
                        const name = leg.start_waypoint.name || 'Unknown location';
                        if (!name || name === 'Unknown location') {
                          return name;
                        }
                        const parts = name.split(',').map(part => part.trim());
                        if (parts.length >= 2) {
                          const city = parts[0];
                          const country = parts.slice(1).join(', ');
                          return (
                            <>
                              {city}
                              {country && <span className="font-normal">, {country}</span>}
                            </>
                          );
                        }
                        return name;
                      })()}
                    </div>
                    {leg.start_date && (
                      <div className="text-xs font-medium text-foreground">
                        {formatDate(leg.start_date)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No start point</div>
                )}
              </div>

              {/* Arrow */}
              <div className="text-foreground flex items-center justify-center flex-shrink-0">
                <span className="text-lg">→</span>
              </div>

              {/* End Point */}
              <div className="flex flex-col justify-center">
                {leg.end_waypoint ? (
                  <div className="text-xs text-foreground leading-tight">
                    <div className="font-semibold">
                      {(() => {
                        const name = leg.end_waypoint.name || 'Unknown location';
                        if (!name || name === 'Unknown location') {
                          return name;
                        }
                        const parts = name.split(',').map(part => part.trim());
                        if (parts.length >= 2) {
                          const city = parts[0];
                          const country = parts.slice(1).join(', ');
                          return (
                            <>
                              {city}
                              {country && <span className="font-normal">, {country}</span>}
                            </>
                          );
                        }
                        return name;
                      })()}
                    </div>
                    {leg.end_date && (
                      <div className="text-xs font-medium text-foreground">
                        {formatDate(leg.end_date)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No end point</div>
                )}
              </div>
            </div>

            {/* Duration and Distance */}
            {distance !== null && (
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 pt-3 text-left">
                {leg.boat_average_speed_knots && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Estimated Distance / Duration</div>
                    {/*}
                    <div className="text-sm font-medium text-foreground">
                      {duration.formatted}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({Math.round(distance)}nm @ {typeof leg.boat_average_speed_knots === 'string' ? parseFloat(leg.boat_average_speed_knots) : leg.boat_average_speed_knots}kt)
                      </span>
                    </div>
                    */}
                  </div>
                )}
                {/* Empty spacer to align with arrow column */}
                {leg.boat_average_speed_knots && <div></div>}
                <div>
                  <div className="text-xs font-medium text-foreground mb-1">
                    {Math.round(distance)} nm / {duration.formatted} <span className="text-xs text-muted-foreground ml-1"> ({Math.round(distance)}nm @ {typeof leg.boat_average_speed_knots === 'string' ? parseFloat(leg.boat_average_speed_knots) : leg.boat_average_speed_knots}kt)</span>
                  </div>
                </div>
              </div>
            )}



            <div className="flex items-center justify-between mb-1 border-t pt-4">
                    <h3 className="text-xs font-semibold text-muted-foreground">Risk and Experience Level</h3>
            </div>
            <div className="space-y-1 grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-3">

            {/* Risk Level and Experience level*/}
            {(() => {
              const riskConfig = effectiveRiskLevel ? getRiskLevelConfig(effectiveRiskLevel, theme.resolvedTheme === 'dark') : null;
              return riskConfig ? (
                <div>

                  <div onClick={() => setIsRiskLevelDialogOpen(true)} className={`cursor-pointer flex items-center gap-3 p-2 rounded-lg border-2 text-left ${
                    matchRiskLevel(userRiskLevel || [], leg.leg_risk_level as string | null, leg.journey_risk_level as string[] | null) === false 
                    ? user ? 'border-orange-300' : 'border-grey-300' 
                    : user ? 'border-green-500' : 'border-grey-300'
                   }`}>
      
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <Image
                        src={riskConfig.icon}
                        alt={riskConfig.displayName}
                        fill
                        className="object-contain"
                      />
                    </div>

                    <div className="flex-1 flex items-center justify-between gap-2">
                      <p className="text-foreground font-medium font-semibold">
                        {riskConfig.displayName}
                      </p>
                    </div>
                  </div>
                    {/* Warning message — now on its own row below */}
                    {user && matchRiskLevel(userRiskLevel || [], leg.leg_risk_level as string | null, leg.journey_risk_level as string[] | null) === false && (
                      <p className="text-xs text-orange-500 mt-1 text-left">
                        ⚠ Your risk level ({userRiskLevel?.join(', ')}) preferences do not match for this leg
                      </p>
                    )}
                    {matchRiskLevel(userRiskLevel || [], leg.leg_risk_level as string | null, leg.journey_risk_level as string[] | null) === true && (
                      <p className="text-xs text-green-700 mt-1 text-left">
                        ✓ Your risk level ({userRiskLevel?.join(', ')}) matches the requirement
                      </p>
                    )}

                </div>
              ) : null;
            })()}

            {/* Minimum Required Experience Level */}
            {leg.min_experience_level && (
              <div>
                <div onClick={() => setIsExperienceLevelDialogOpen(true)} className={`cursor-pointer flex items-center gap-3 p-2 rounded-lg border-2 text-left ${
                  leg.experience_level_matches === false 
                    ? user ? 'border-orange-300' : 'border-grey-300' 
                    : user ? 'border-green-500' : 'border-grey-300'
                }`}>
                  {/* Icon */}
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image
                      src={
                        getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).icon +
                        (theme.resolvedTheme === 'dark' ? "_dark.png" : ".png")
                      }
                      alt={getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* Name + info button + warning (warning now outside the flex row) */}
                  <div className="flex-1">
                    {/* Row with name and info button */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-foreground font-medium font-semibold">
                        {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                      </p>

                    </div>

                  </div>
                </div>
                    {/* Warning message — now on its own row below */}
                    {user && leg.experience_level_matches === false && userExperienceLevel !== null && (
                      <p className="text-xs text-orange-500 mt-1 text-left">
                        ⚠ Your level ({getExperienceLevelConfig(userExperienceLevel as ExperienceLevel).displayName}) is below the requirement for this leg
                      </p>
                    )}
                    {user && leg.experience_level_matches === true && userExperienceLevel !== null && (
                      <p className="text-xs text-green-700 mt-1 text-left">
                        ✓ Your level ({getExperienceLevelConfig(userExperienceLevel as ExperienceLevel).displayName}) matches the requirement
                      </p>
                    )}
              </div>
            )}
            </div>

            {/* Skills */}
            <SkillsMatchingDisplay
              headerText="Skills"            
              className="pt-4 border-t"
              legSkills={leg.skills || []}
              userSkills={userSkills}
              skillMatchPercentage={leg.skill_match_percentage}
            />

            {/* Boat Info - blur when not authenticated */}
            <div className="relative pt-2 border-t border-border text-left">
                {!user && (
                  <div
                    className="absolute inset-0 z-10 rounded-md backdrop-blur-sm bg-background/70 flex items-center justify-center min-h-[120px]"
                    aria-hidden="true"
                  >
                    <p className="text-sm text-muted-foreground px-4 text-center">
                      Sign in to view skipper & boat details
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">Skipper / Owner</h3>
                </div>
                <div className="grid grid-cols-2 gap-6 items-start pb-2">
                  {/* Owner Avatar and Name */}
                  <div className="flex items-start gap-3">
                    {(leg.owner_name || leg.owner_image_url) && (
                      <>
                        {leg.owner_image_url ? (
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-border flex-shrink-0">
                            <Image
                              src={leg.owner_image_url}
                              alt={leg.owner_name || 'Owner'}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-muted border-2 border-border flex items-center justify-center flex-shrink-0">
                            <svg
                              className="w-8 h-8 text-muted-foreground"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                        )}
                        {leg.owner_name && (
                          <div className="flex flex-col justify-center">
                            <p className="text-xs font-medium text-foreground">Skipper:</p>
                            <p className="text-xs text-muted-foreground max-w-[150px] truncate" title={leg.owner_name}>
                              {leg.owner_name}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-border text-left">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">Boat</h3>
                  <div className="flex gap-3 items-start">
                    <div className="flex items-center gap-3 flex-shrink-0 relative w-16 h-16 rounded-full">
                      {leg?.boat_image_url ? (
                        <Image
                          src={leg.boat_image_url}
                          alt={leg?.boat_name || 'Boat'}
                          fill
                          className="object-cover w-16 h-16 rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-muted-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <p className="text-foreground font-medium font-semibold">
                        {leg?.boat_name || 'Boat'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {leg?.boat_type || 'Boat type'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {leg?.boat_make_model || 'Boat make/model'}
                      </p>
                    </div>
                   </div>
                  </div>
                </div>

            {/* Journey Costs Section */}
            {leg.cost_model && leg.cost_model !== 'Not defined' && (
              <div className="pt-2 border-t border-border text-left">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3">Journey costs</h3>
                <div className="flex items-start gap-3">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <Image
                       src={theme.resolvedTheme === 'dark' ? getCostModelConfig(leg.cost_model).icon + "-dark.png" : getCostModelConfig(leg.cost_model).icon + ".png"}
                       alt={getCostModelConfig(leg.cost_model).displayName}
                       fill
                       className="object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium font-semibold">
                      {getCostModelConfig(leg.cost_model).displayName}
                    </p>
                    {/*<p className="text-xs text-muted-foreground mb-2">
                      {getCostModelConfig(leg.cost_model).description}
                    </p>*/}
                    <p className="text-xs text-muted-foreground italic">
                      {getCostModelConfig(leg.cost_model).details}
                    </p>
                  </div>
                </div>
              </div>
            )}

                {/* Journey Description Section */}
                {(journeyDescription || isLoadingDescription) && (
                  <div className="pt-4 border-t border-border text-left pb-4">
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">Journey details</h3>
                    <div className="relative">
                    <p className="text-muted-foreground mb-2">{leg.journey_name}</p>

                      {isLoadingDescription ? (
                        <div className="w-full h-12 flex items-center justify-center bg-muted rounded">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground"></div>
                        </div>
                      ) : (
                        <>
                          {!showFullDescription ? (

                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {journeyDescription && journeyDescription.length > 100
                                ? journeyDescription.substring(0, 100) + '...'
                                : journeyDescription}
                              {journeyDescription && journeyDescription.length > 100 && (
                                <button
                                  onClick={() => setShowFullDescription(true)}
                                  className="ml-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                  Show more
                                </button>
                              )}
                            </p>
                          ) : (
                            <div className="text-sm text-foreground whitespace-pre-wrap">
                              {journeyDescription}
                              <button
                                onClick={() => setShowFullDescription(false)}
                                className="ml-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                              >
                                Show less
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                </div>
              </div>
              <div className="flex-shrink-0 border-t border-border bg-card p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                {!user ? (
                <Link
                  href="/auth/login"
                  className="w-full bg-primary text-primary-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
                >
                  Sign in to register for leg
                </Link>
              ) : !profileStatus?.exists || !profileStatus.hasRoles ? (
                <Link
                  href="#"
                  onClick={handleProfileSetupClick}
                  className="w-full bg-primary text-primary-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
                >
                  Complete profile to register
                </Link>
              ) : registrationStatus && (registrationStatus === 'Pending approval' || registrationStatus === 'Approved') ? (
                // Hide register button if pending or approved - show status only
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Registration Status:</span>
                    {getStatusBadge(registrationStatus)}
                  </div>
                  {registrationStatus === 'Pending approval' && (
                    <button
                      onClick={handleCancelRegistration}
                      disabled={isRegistering}
                      className="w-full bg-secondary text-secondary-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel Registration
                    </button>
                  )}
                </div>
              ) : registrationStatus ? (
                // Show status and allow re-registration for other statuses (cancelled, not approved)
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Registration Status:</span>
                    {getStatusBadge(registrationStatus)}
                  </div>
                  <button
                    onClick={handleRegister}
                    disabled={isRegistering || checkingProfileConsent}
                    className="w-full bg-primary text-primary-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRegistering ? 'Registering...' : checkingProfileConsent ? 'Checking...' : 'Register Again'}
                  </button>
                </div>
              ) : hasProfileSharingConsent === false ? (
                <div className="space-y-3">
                  {/* Profile Sharing Consent Notification */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-900 mb-1">
                          Profile Sharing Consent Required
                        </h4>
                        <p className="text-sm text-amber-800 mb-2">
                          To register for legs, you need to enable profile sharing consent. This allows boat owners to view your profile when reviewing your registration.
                        </p>
                        <Link
                          href="/settings/privacy"
                          className="text-sm font-medium text-amber-900 hover:text-amber-700 underline inline-flex items-center gap-1"
                        >
                          Go to Privacy Settings
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                  <button
                    disabled
                    className="w-full bg-muted text-muted-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium cursor-not-allowed opacity-50"
                  >
                    Register for leg
                  </button>
                </div>
              ) : (
                <LoadingButton
                  onClick={handleRegister}
                  isLoading={isRegistering}
                  disabled={checkingProfileConsent}
                  fullWidth
                  loadingText="Registering..."
                >
                  {checkingProfileConsent ? 'Checking...' : 'Register for leg'}
                </LoadingButton>
              )}
              {registrationError && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {registrationError}
                </div>
              )}
              </div>
            </div>
            )}
          </>
        )}
      </div>
      </div>
      {/* Risk Level Info Dialog */}
      {isRiskLevelDialogOpen && effectiveRiskLevel && getRiskLevelConfig(effectiveRiskLevel, theme.resolvedTheme === 'dark') && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsRiskLevelDialogOpen(false)}
          />
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-card rounded-lg shadow-xl border border-border max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">
                    {getRiskLevelConfig(effectiveRiskLevel, theme.resolvedTheme === 'dark')!.displayName}
                  </h2>
                </div>
                <button
                  onClick={() => setIsRiskLevelDialogOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              {/* Content */}
              <div className="p-3 sm:p-4 overflow-y-auto flex-1">
                <div className="prose prose-sm max-w-none text-foreground">
                  {getRiskLevelConfig(effectiveRiskLevel, theme.resolvedTheme === 'dark')!.fullInfoText.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="mb-4 text-xs sm:text-sm leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Experience Level Info Dialog */}
      {isExperienceLevelDialogOpen && leg.min_experience_level && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsExperienceLevelDialogOpen(false)}
          />
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 mt-8">
            <div className="bg-card rounded-lg shadow-xl border border-border max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">
                    {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                  </h2>
                </div>
                <button
                  onClick={() => setIsExperienceLevelDialogOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              {/* Content */}
              <div className="p-3 sm:p-4 overflow-y-auto flex-1">
                <div className="prose prose-sm max-w-none text-foreground">
                  {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).infoText.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="mb-4 text-xs sm:text-sm leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                  {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).typicalEquivalents && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="font-semibold mb-2">Typical Equivalents:</p>
                      <p className="text-sm text-muted-foreground">
                        {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).typicalEquivalents}
                      </p>
                    </div>
                  )}
                  {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).note && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm italic text-muted-foreground">
                        {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).note}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {leg && (
        <RegistrationSuccessModal
          isOpen={showSuccessModal}
          onClose={handleSuccessModalClose}
          autoApproved={registrationResult?.auto_approved || false}
          legName={leg.leg_name}
          journeyName={leg.journey_name}
        />
      )}
    </>
  );
}
