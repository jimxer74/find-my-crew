'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { getCostModelConfig, CostModel } from '@/app/types/cost-models';
import { SkillsMatchingDisplay } from '@/app/components/crew/SkillsMatchingDisplay';
import { RegistrationRequirementsForm } from '@/app/components/crew/RegistrationRequirementsForm';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import { LimitedAccessIndicator } from '@/app/components/profile/LimitedAccessIndicator';
import { checkProfile } from '@/app/lib/profile/checkProfile';
import { useTheme } from '@/app/contexts/ThemeContext';
import { MatchBadge } from '../ui/MatchBadge';
import { CostModelBadge } from '../ui/CostModelBadge';
import { CostModelIcon } from '../ui/CostModelIcon';
import { matchRiskLevel } from '@/app/lib/skillMatching';
import { ImageCarousel } from '../ui/ImageCarousel';

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


// Helper function to get risk level config
const getRiskLevelConfig = (riskLevel: RiskLevel | null) => {
  if (!riskLevel) {
    return null;
  }

  const theme = useTheme();

  switch (riskLevel) {
    case 'Coastal sailing':
      return {
        icon: theme.resolvedTheme === 'dark' ? "/coastal_sailing_dark.png" : "/coastal_sailing.png",
        displayName: riskLevelsConfig.coastal_sailing.title,
        shortDescription: riskLevelsConfig.coastal_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
        fullInfoText: riskLevelsConfig.coastal_sailing.infoText,
      };
    case 'Offshore sailing':
      return {
        icon: theme.resolvedTheme === 'dark' ? "/offshore_sailing_dark.png" : "/offshore_sailing.png",
        displayName: riskLevelsConfig.offshore_sailing.title,
        shortDescription: riskLevelsConfig.offshore_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
        fullInfoText: riskLevelsConfig.offshore_sailing.infoText,
      };
    case 'Extreme sailing':
      return {
        icon: theme.resolvedTheme === 'dark' ? "/extreme_sailing_dark.png" : "/extreme_sailing.png",
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
  boat_make: string | null;
  boat_model: string | null;
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [isRiskLevelDialogOpen, setIsRiskLevelDialogOpen] = useState(false);
  const [isExperienceLevelDialogOpen, setIsExperienceLevelDialogOpen] = useState(false);
  const [journeyRiskLevel, setJourneyRiskLevel] = useState<RiskLevel | null>(null);
  const [journeyImages, setJourneyImages] = useState<string[]>([]);
  const [journeyDescription, setJourneyDescription] = useState<string | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
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

  const { user } = useAuth();
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
      console.log(`[LegDetailsPanel] Fetching journey description for journey ${leg.journey_id}`);
      try {
        const response = await fetch(`/api/journeys/${leg.journey_id}/details`, {
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        console.log(`[LegDetailsPanel] Journey fetch response status: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`[LegDetailsPanel] Journey fetch response data:`, data);
          const description = data.journey_description || null;
          setJourneyDescription(description);
          console.log(`[LegDetailsPanel] Fetched journey description for journey ${leg.journey_id}:`, description);
        } else {
          console.warn(`[LegDetailsPanel] Failed to fetch journey description: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.warn(`[LegDetailsPanel] Error response text:`, errorText);
          try {
            const errorData = JSON.parse(errorText);
            console.warn(`[LegDetailsPanel] Error response JSON:`, errorData);
          } catch (e) {
            console.warn(`[LegDetailsPanel] Error response not JSON:`, errorText);
          }
          setJourneyDescription(null);
        }
      } catch (error) {
        console.error(`[LegDetailsPanel] Error fetching journey description:`, error);
        setJourneyDescription(null);
      } finally {
        setIsLoadingDescription(false);
      }
    };

    fetchJourneyDescription();
  }, [isOpen, leg.journey_id]);

  // Process risk level from leg and journey data (now provided by API)
  useEffect(() => {
    console.log('[LegDetailsPanel] Processing risk level:', {
      legRiskLevel: leg.leg_risk_level,
      journeyRiskLevel: leg.journey_risk_level,
      journeyId: leg.journey_id,
      isOpen
    });
    
    // Normalize leg's risk level first
    const normalizedLegRiskLevel = normalizeRiskLevel(leg.leg_risk_level);
    console.log('[LegDetailsPanel] Normalized leg risk level:', normalizedLegRiskLevel);
    
    // Process journey's risk level array (take first one if multiple)
    let normalizedJourneyRiskLevel: RiskLevel | null = null;
    if (leg.journey_risk_level && leg.journey_risk_level.length > 0) {
      // Journey has risk level array - normalize the first one
      normalizedJourneyRiskLevel = normalizeRiskLevel(leg.journey_risk_level[0]);
      console.log('[LegDetailsPanel] Normalized journey risk level (from array):', normalizedJourneyRiskLevel);
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
    console.log('[LegDetailsPanel] Risk level state:', {
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

  // Safety effect: If requirements exist but requirements form is not shown, show it
  useEffect(() => {
    if (hasRequirements && !showRequirementsForm && showRegistrationModal) {
      console.warn(`[LegDetailsPanel] ⚠️ Requirements exist but regular modal is shown - auto-switching to requirements form`);
      setShowRegistrationModal(false);
      setShowRequirementsForm(true);
    }
  }, [hasRequirements, showRequirementsForm, showRegistrationModal]);

  // Prevent regular modal from showing if requirements exist
  useEffect(() => {
    if (hasRequirements && showRegistrationModal && !showRequirementsForm) {
      console.warn(`[LegDetailsPanel] ⚠️ Blocking regular modal - requirements exist, switching to requirements form`);
      setShowRegistrationModal(false);
      setShowRequirementsForm(true);
    }
  }, [hasRequirements, showRegistrationModal, showRequirementsForm]);

  // Check profile status
  useEffect(() => {
    if (!user) {
      setProfileStatus({ exists: false, hasRoles: false, completionPercentage: 0 });
      return;
    }

    const loadProfileStatus = async () => {
      const status = await checkProfile(user.id);
      setProfileStatus({
        exists: status.exists,
        hasRoles: status.hasRoles,
        completionPercentage: status.completionPercentage,
      });
    };

    loadProfileStatus();
  }, [user]);

  // Load registration status when leg changes
  useEffect(() => {
    if (!user || !leg.leg_id) {
      setRegistrationStatus(null);
      return;
    }

    const loadRegistrationStatus = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('registrations')
        .select('status')
        .eq('leg_id', leg.leg_id)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading registration status:', error);
        return;
      }

      setRegistrationStatus(data?.status || null);
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

  // Auto-open registration form when initialOpenRegistration is true
  const initialRegistrationTriggeredRef = useRef(false);
  useEffect(() => {
    // Only trigger once per panel open
    if (initialOpenRegistration && isOpen && user && !initialRegistrationTriggeredRef.current && !registrationStatus) {
      initialRegistrationTriggeredRef.current = true;
      // Delay slightly to allow consent checks to complete
      const timer = setTimeout(() => {
        handleRegister();
      }, 300);
      return () => clearTimeout(timer);
    }
    // Reset the ref when panel closes
    if (!isOpen) {
      initialRegistrationTriggeredRef.current = false;
    }
  }, [initialOpenRegistration, isOpen, user, registrationStatus]);

  // Check if journey has requirements when register button is clicked
  const checkRequirements = async () => {
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
        console.error('Error fetching requirements:', reqError);
        // Continue with empty requirements if fetch fails
        reqs = [];
      }
      
      // Check auto-approval settings (optional - don't block if it fails)
      let autoApprovalEnabled = false;
      try {
        console.log(`[LegDetailsPanel] Checking auto-approval for journey: ${leg.journey_id}`);
        const autoApprovalResponse = await fetch(`/api/journeys/${leg.journey_id}/auto-approval`, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        if (autoApprovalResponse.ok) {
          const autoApprovalData = await autoApprovalResponse.json();
          autoApprovalEnabled = autoApprovalData.auto_approval_enabled === true;
          console.log(`[LegDetailsPanel] Auto-approval check result:`, {
            journeyId: leg.journey_id,
            autoApprovalEnabled,
            threshold: autoApprovalData.auto_approval_threshold,
          });
        } else {
          console.warn(`[LegDetailsPanel] Auto-approval check failed with status: ${autoApprovalResponse.status}`);
        }
      } catch (autoApprovalError: any) {
        // Log but don't block - auto-approval check is optional
        console.warn(`[LegDetailsPanel] Could not check auto-approval status (non-critical):`, {
          error: autoApprovalError.message,
          errorName: autoApprovalError.name,
          journeyId: leg.journey_id,
        });
        autoApprovalEnabled = false;
      }
      
      const hasReqs = reqs.length > 0;
      
      console.log(`[LegDetailsPanel] Requirements check result:`, {
        journeyId: leg.journey_id,
        hasReqs,
        requirementsCount: reqs.length,
        autoApprovalEnabled,
        willShowRequirementsForm: hasReqs,
      });
      
      // Update state synchronously
      setHasRequirements(hasReqs);
      setAutoApprovalEnabled(autoApprovalEnabled);
      
      // If requirements exist (regardless of auto-approval), user MUST complete requirements form
      if (hasReqs) {
        console.log(`[LegDetailsPanel] ✅ Showing requirements form (requirements exist)`, {
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
      } else {
        // No requirements - show regular registration modal
        console.log(`[LegDetailsPanel] ✅ Showing regular registration modal (no requirements)`);
        setShowRequirementsForm(false);
        setHasRequirements(false);
        setAutoApprovalEnabled(false); // Reset when no requirements
        // Only show regular modal if no requirements exist
        setTimeout(() => {
          setShowRegistrationModal(true);
        }, 0);
      }
    } catch (error) {
      console.error('Error checking requirements:', error);
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
            console.warn(`[LegDetailsPanel] ⚠️ Fallback check found requirements (${fallbackReqs.length}), showing requirements form`);
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
        console.warn(`[LegDetailsPanel] Fallback requirements check also failed:`, fallbackError);
      }
      
      // Only show regular modal if we're sure there are no requirements
      console.warn(`[LegDetailsPanel] ⚠️ Error checking requirements, defaulting to no requirements:`, error);
      setHasRequirements(false);
      setShowRequirementsForm(false);
      requestAnimationFrame(() => {
        setShowRegistrationModal(true);
      });
    } finally {
      setIsCheckingRequirements(false);
    }
  };

  // Handle register button click
  const handleRegister = async () => {
    // Check profile sharing consent first
    if (hasProfileSharingConsent === false) {
      setRegistrationError('Profile sharing consent is required to register for legs. Please update your privacy settings.');
      return;
    }

    setRegistrationError(null);
    setRegistrationNotes('');
    setRequirementsAnswers([]);
    // Check requirements first
    await checkRequirements();
  };

  // Handle requirements form completion - now includes notes and submits directly
  const handleRequirementsComplete = async (answers: any[], notes: string) => {
    console.log(`[LegDetailsPanel] Requirements form completed:`, {
      answersCount: answers.length,
      answers: answers,
      notesLength: notes.length,
    });

    if (!answers || answers.length === 0) {
      console.error(`[LegDetailsPanel] ❌ Requirements form completed but no answers provided!`);
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

    // IMMEDIATE check: If state says requirements exist but no answers, block immediately
    // But skip this check if answers were provided directly (from requirements form)
    if (providedAnswers === undefined && hasRequirements && requirementsAnswers.length === 0) {
      console.error(`[LegDetailsPanel] ❌ Cannot submit: Requirements exist but no answers provided (immediate state check)`);
      setRegistrationError('Please complete all required questions before submitting');
      setShowRegistrationModal(false);
      setShowRequirementsForm(true);
      return;
    }

    // Check if requirements exist but no answers provided (using direct or state values)
    if (hasRequirements && answersToUse.length === 0) {
      console.error(`[LegDetailsPanel] ❌ Cannot submit: Requirements exist but no answers provided`);
      setRegistrationError('Please complete all required questions before submitting');
      setShowRegistrationModal(false);
      setShowRequirementsForm(true);
      return;
    }

    // Safety check: Verify requirements exist if we don't have answers
    // This prevents race conditions where state hasn't updated yet
    // Skip this check if answers were provided directly
    if (providedAnswers === undefined && answersToUse.length === 0) {
      console.log(`[LegDetailsPanel] No answers provided, checking if requirements exist...`);
      try {
        const requirementsResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
          signal: AbortSignal.timeout(5000),
        });
        if (requirementsResponse.ok) {
          const data = await requirementsResponse.json();
          const reqs = data.requirements || [];
          if (reqs.length > 0) {
            console.error(`[LegDetailsPanel] ❌ Cannot submit: Requirements exist (${reqs.length}) but no answers provided`);
            setRegistrationError('Please complete all required questions before submitting');
            // Switch to requirements form
            setShowRegistrationModal(false);
            setShowRequirementsForm(true);
            setHasRequirements(true);
            return;
          }
        }
      } catch (error) {
        console.warn(`[LegDetailsPanel] Could not verify requirements, proceeding with submission:`, error);
        // Continue with submission if check fails (don't block user)
      }
    }

    setIsRegistering(true);
    setRegistrationError(null);

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
    // Use provided answers if available, otherwise use state
    if (answersToUse.length > 0) {
      requestBody.answers = answersToUse;
    }

    console.log(`[LegDetailsPanel] Submitting registration:`, {
      leg_id: leg.leg_id,
      journey_id: leg.journey_id,
      hasNotes: !!requestBody.notes,
      notesLength: requestBody.notes?.length || 0,
      answersLength: requestBody.answers?.length || 0,
      answers: requestBody.answers,
      answersToUseLength: answersToUse.length,
      match_percentage: leg.skill_match_percentage,
      providedAnswers: providedAnswers !== undefined,
      requirementsAnswersLength: requirementsAnswers.length,
      hasRequirements,
      sendingAnswers: !!requestBody.answers,
    });

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
        console.error(`[LegDetailsPanel] Registration failed:`, {
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
      setShowRegistrationModal(false);
      setShowRequirementsForm(false);
      setAutoApprovalEnabled(false); // Reset when closing
      setRegistrationNotes('');
      setRequirementsAnswers([]);
      
      // Notify parent component
      onRegistrationChange?.();

      // Show success message
      if (data.registration.status === 'Approved' && data.registration.auto_approved) {
        alert('Congratulations! You\'ve been automatically approved for this leg!');
      } else {
        console.log('Registration successful:', data.message);
      }
    } catch (error: any) {
      setRegistrationError(error.message || 'An error occurred while registering');
      console.error('Registration error:', error);
    } finally {
      setIsRegistering(false);
    }
  };

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
        .eq('user_id', user.id)
        .single();

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
      console.error('Cancel registration error:', error);
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

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Reset minimized state when panel closes
      setIsMinimized(false);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Helper function to check if risk level matches
  const riskLevelMatches = (leg:Leg, userRiskLevel:RiskLevel): boolean => {
    console.log('leg.leg_risk_level', leg.leg_risk_level);
    console.log('leg.journey_risk_level', leg.journey_risk_level);
    console.log('userRiskLevel', userRiskLevel);
    if(leg.leg_risk_level === null) {
      return leg.journey_risk_level?.includes(userRiskLevel) ?? false;
    }
    return leg.leg_risk_level?.includes(userRiskLevel) ?? false;
  }

  const theme = useTheme();
  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <div className="flex flex-col min-h-screen">


      {/* Panel - Left Side on desktop, Full Screen on mobile - Overlays the map */}
      <div
        className={`fixed top-16 md:top-16 left-0 right-0 md:right-auto bottom-0 md:bottom-0 bg-card border-r border-border shadow-2xl z-50 transition-all duration-300 ease-out ${
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

        {/* Minimize/Maximize button - Desktop only - Inside Pane */}
        {isOpen && !isMinimized && (
          <button
            onClick={() => setIsMinimized(true)}
            className="hidden md:flex 
absolute top-50 -right-7 -z-1 
bg-card 
border border-border 
rounded-none md:rounded-r-md    ← this is the key change
p-2 
min-w-[8px] min-h-[44px] 
items-center justify-center 
shadow-md 
hover:bg-accent 
transition-all"
            title="Minimize panel"
            aria-label="Minimize panel"
          >
            <svg
              className="w-4 h-5 text-foreground"
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
            className="hidden md:flex absolute top-50 left-0 z-10 bg-card border border-border rounded-none md:rounded-r-md p-2 min-w-[8px] min-h-[44px] items-center justify-center shadow-sm hover:bg-accent transition-all"
            title="Maximize panel"
            aria-label="Maximize panel"
          >
            <svg
              className="w-4 h-5 text-foreground"
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

        {/* Content */}
        {!isMinimized && (
          <>
            {/* Requirements Form - In pane */}
            {showRequirementsForm ? (
              <div className="h-full">
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
            ) : showRegistrationModal && !hasRequirements ? (
              /* Registration Form - In pane - Only show if NO requirements exist */
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
                        // Double-check requirements before allowing submission
                        // This prevents race conditions
                        if (hasRequirements) {
                          console.error(`[LegDetailsPanel] ❌ Cannot submit from regular modal: Requirements exist (state check)`);
                          setRegistrationError('Please complete the required questions first');
                          setShowRegistrationModal(false);
                          setShowRequirementsForm(true);
                          return;
                        }

                        // Additional safety: Verify no requirements exist before submitting
                        try {
                          const verifyResponse = await fetch(`/api/journeys/${leg.journey_id}/requirements`, {
                            signal: AbortSignal.timeout(3000),
                          });
                          if (verifyResponse.ok) {
                            const verifyData = await verifyResponse.json();
                            const verifyReqs = verifyData.requirements || [];
                            if (verifyReqs.length > 0) {
                              console.error(`[LegDetailsPanel] ❌ Cannot submit: Requirements exist (${verifyReqs.length}) - verification check`);
                              setRegistrationError('Please complete the required questions first');
                              setShowRegistrationModal(false);
                              setShowRequirementsForm(true);
                              setHasRequirements(true);
                              return;
                            }
                          }
                        } catch (verifyError) {
                          console.warn(`[LegDetailsPanel] Could not verify requirements before submit:`, verifyError);
                          // Continue if verification fails - don't block user
                        }

                        // Only call handleSubmitRegistration if we're sure there are no requirements
                        handleSubmitRegistration();
                      }}
                      disabled={isRegistering || hasRequirements}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRegistering ? 'Registering...' : hasRequirements ? 'Complete Questions First' : 'Submit Registration'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            /* Leg Details Content with Sticky Footer */
            <div className="flex flex-col h-full">
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto">
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

                      {/* Match Percentage Badge Only */}
                      <div className="absolute top-3 left-3">
                        {/* Match Percentage Badge */}
                        {leg.skill_match_percentage !== undefined && leg.skill_match_percentage !== null && (
                          <MatchBadge
                            percentage={leg.skill_match_percentage}
                            showLabel={true}
                            size="sm"
                            className="shadow-lg"
                          />
                        )}
                      </div>
                    </div>

                  </div>
                ) : (
                  // Fallback when no images available
                  <div className="relative w-full h-48 overflow-hidden rounded-lg bg-muted">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm text-muted-foreground">No images available</span>
                    </div>

                    {/* Match Percentage Badge for fallback image */}
                    <div className="absolute top-3 left-3">
                      {/* Match Percentage Badge */}
                      {leg.skill_match_percentage !== undefined && leg.skill_match_percentage !== null && (
                        <MatchBadge
                          percentage={leg.skill_match_percentage}
                          showLabel={true}
                          size="sm"
                          className="shadow-lg"
                        />
                      )}
                    </div>
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
                {profileStatus?.exists ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{leg.leg_description}</p>
                ) : (
                  <>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {leg.leg_description.length > 150 
                        ? leg.leg_description.substring(0, 150) + '...' 
                        : leg.leg_description}
                    </p>
                    <LimitedAccessIndicator 
                      message="Complete your profile to see full leg description"
                      showCompleteProfileCTA={true}
                    />
                  </>
                )}
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
                    {leg.start_date && profileStatus?.exists && profileStatus.completionPercentage === 100 && (
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
                    {leg.end_date && profileStatus?.exists && profileStatus.completionPercentage === 100 && (
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
              const riskConfig = effectiveRiskLevel ? getRiskLevelConfig(effectiveRiskLevel) : null;
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

            {/* Boat Info - Only show if profile*/}
            {profileStatus?.exists && (
              <div className="pt-2 border-t border-border text-left">
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
                      <Image
                        src={leg?.boat_image_url || ''}
                        alt={leg?.boat_name || 'Boat'}
                        fill
                        className="object-cover w-16 h-16 rounded-lg"
                      />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-foreground font-medium font-semibold">
                        {leg?.boat_name || 'Boat'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {leg?.boat_type || 'Boat type'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {leg?.boat_make || 'Boat make'}
                        {leg?.boat_model || 'Boat model'}
                      </p>
                    </div>
                   </div>
                  </div>
                </div>
            )}

            {/* Journey Costs Section */}
            {leg.cost_model && leg.cost_model !== 'Not defined' && (
              <div className="pt-2 border-t border-border text-left">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3">Journey costs</h3>
                <div className="flex items-start gap-3">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <Image
                       src={getCostModelConfig(leg.cost_model).icon}
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
                {/* End of Leg Details Content */}
              </div>
              {/* End of Scrollable Content Area */}

              {/* Sticky Footer - Registration Section */}
              <div className="flex-shrink-0 border-t border-border bg-card p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              {!user ? (
                <div className="space-y-3">
                  <LimitedAccessIndicator 
                    message="Sign up and complete your profile to register for this leg"
                    showCompleteProfileCTA={true}
                  />
                  <button
                    disabled
                    className="w-full bg-muted text-muted-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium cursor-not-allowed opacity-50"
                  >
                    Register for leg
                  </button>
                </div>
              ) : !profileStatus?.exists ? (
                <div className="space-y-3">
                  <LimitedAccessIndicator 
                    message="Sign up and complete your profile to register for this leg"
                    showCompleteProfileCTA={true}
                  />
                  <button
                    disabled
                    className="w-full bg-muted text-muted-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium cursor-not-allowed opacity-50"
                  >
                    Register for leg
                  </button>
                </div>
              ) : !profileStatus.hasRoles || !profileStatus.exists ? (
                <div className="space-y-3">
                  <LimitedAccessIndicator 
                    message="Add a crew role to your profile to register for legs"
                    showCompleteProfileCTA={true}
                  />
                  <button
                    disabled
                    className="w-full bg-muted text-muted-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium cursor-not-allowed opacity-50"
                  >
                    Register for leg
                  </button>
                </div>
              ) : registrationStatus ? (
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
                <button
                  onClick={handleRegister}
                  disabled={isRegistering || checkingProfileConsent}
                  className="w-full bg-primary text-primary-foreground px-4 py-3 min-h-[44px] rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRegistering ? 'Registering...' : checkingProfileConsent ? 'Checking...' : 'Register for leg'}
                </button>
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
      {isRiskLevelDialogOpen && effectiveRiskLevel && getRiskLevelConfig(effectiveRiskLevel) && (
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
                    {getRiskLevelConfig(effectiveRiskLevel)!.displayName}
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
                  {getRiskLevelConfig(effectiveRiskLevel)!.fullInfoText.split('\n\n').map((paragraph, index) => (
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
    </>
  );
}
