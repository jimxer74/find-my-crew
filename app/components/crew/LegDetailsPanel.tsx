'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { SkillsMatchingDisplay } from '@/app/components/crew/SkillsMatchingDisplay';
import { RegistrationRequirementsForm } from '@/app/components/crew/RegistrationRequirementsForm';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';

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
  
  switch (riskLevel) {
    case 'Coastal sailing':
      return {
        icon: '/coastal_sailing2.png',
        displayName: riskLevelsConfig.coastal_sailing.title,
        shortDescription: riskLevelsConfig.coastal_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
        fullInfoText: riskLevelsConfig.coastal_sailing.infoText,
      };
    case 'Offshore sailing':
      return {
        icon: '/offshore_sailing2.png',
        displayName: riskLevelsConfig.offshore_sailing.title,
        shortDescription: riskLevelsConfig.offshore_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
        fullInfoText: riskLevelsConfig.offshore_sailing.infoText,
      };
    case 'Extreme sailing':
      return {
        icon: '/extreme_sailing2.png',
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
  onRegistrationChange?: () => void; // Callback when registration status changes
};

export function LegDetailsPanel({ leg, isOpen, onClose, userSkills = [], userExperienceLevel = null, onRegistrationChange }: LegDetailsPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isRiskLevelDialogOpen, setIsRiskLevelDialogOpen] = useState(false);
  const [isExperienceLevelDialogOpen, setIsExperienceLevelDialogOpen] = useState(false);
  const [journeyRiskLevel, setJourneyRiskLevel] = useState<RiskLevel | null>(null);
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
    let normalizedJourneyRiskLevel: string | null = null;
    if (leg.journey_risk_level && leg.journey_risk_level.length > 0) {
      // Journey has risk level array - normalize the first one
      normalizedJourneyRiskLevel = normalizeRiskLevel(leg.journey_risk_level[0]);
      console.log('[LegDetailsPanel] Normalized journey risk level (from array):', normalizedJourneyRiskLevel);
    }
    
    // Set journey risk level state for display
    setJourneyRiskLevel(normalizedJourneyRiskLevel);
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

  // Check if journey has requirements when register button is clicked
  const checkRequirements = async () => {
    try {
      const response = await fetch(`/api/journeys/${leg.journey_id}/requirements`);
      if (response.ok) {
        const data = await response.json();
        const reqs = data.requirements || [];
        setHasRequirements(reqs.length > 0);
        if (reqs.length > 0) {
          // Has requirements - show requirements form directly (no modal)
          setShowRequirementsForm(true);
          setShowRegistrationModal(false);
        } else {
          // No requirements - show regular registration modal
          setShowRequirementsForm(false);
          setShowRegistrationModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking requirements:', error);
      setHasRequirements(false);
      setShowRequirementsForm(false);
      // On error, show regular registration modal
      setShowRegistrationModal(true);
    }
  };

  // Handle register button click
  const handleRegister = async () => {
    setRegistrationError(null);
    setRegistrationNotes('');
    setRequirementsAnswers([]);
    // Check requirements first
    await checkRequirements();
  };

  // Handle requirements form completion - now includes notes and submits directly
  const handleRequirementsComplete = async (answers: any[], notes: string) => {
    setRequirementsAnswers(answers);
    setRegistrationNotes(notes);
    // Submit registration directly from requirements form
    await handleSubmitRegistration();
  };

  // Submit registration
  const handleSubmitRegistration = async () => {
    if (!user) {
      setRegistrationError('You must be logged in to register');
      return;
    }

    setIsRegistering(true);
    setRegistrationError(null);

    try {
      const response = await fetch('/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leg_id: leg.leg_id,
          notes: registrationNotes.trim() || null,
          answers: requirementsAnswers.length > 0 ? requirementsAnswers : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      // Update local state
      setRegistrationStatus(data.registration.status);
      setShowRegistrationModal(false);
      setShowRequirementsForm(false);
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

  return (
    <>
      {/* Panel - Left Side - Overlays the map */}
      <div
        className={`fixed top-16 left-0 bottom-0 bg-card border-r border-border shadow-2xl z-50 transition-all duration-300 ease-out ${
          isOpen 
            ? isMinimized 
              ? 'w-0' 
              : 'w-full md:w-[400px] translate-x-0'
            : '-translate-x-full w-0'
        }`}
      >
        {/* Minimize/Maximize button - Inside Pane */}
        {isOpen && !isMinimized && (
          <button
            onClick={() => setIsMinimized(true)}
            className="absolute top-4 right-4 z-10 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all"
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
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Maximize button when minimized */}
        {isOpen && isMinimized && (
          <button
            onClick={() => setIsMinimized(false)}
            className="absolute top-4 left-4 z-10 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all"
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
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Content */}
        {!isMinimized && (
          <div className="overflow-y-auto h-full">
            {/* Requirements Form - In pane */}
            {showRequirementsForm ? (
              <div className="p-6">
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
                />
              </div>
            ) : showRegistrationModal ? (
              /* Registration Form - In pane */
              <div className="p-6 space-y-4">
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

                <div className="flex gap-3 justify-end pt-4 border-t border-border">
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
                    onClick={handleSubmitRegistration}
                    disabled={isRegistering}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isRegistering ? 'Registering...' : 'Submit Registration'}
                  </button>
                </div>
              </div>
            ) : (
              /* Leg Details Content */
              <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">{leg.leg_name}</h2>
              <p className="text-muted-foreground">{leg.journey_name}</p>
            </div>

            {/* Description */}
            {leg.leg_description && (
              <div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{leg.leg_description}</p>
              </div>
            )}

            {/* Start and End Points with Arrow */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-4">
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
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 pt-3">
                {leg.boat_average_speed_knots && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Duration</div>
                    <div className="text-sm font-medium text-foreground">
                      {duration.formatted}
                      <span className="text-xs text-muted-foreground ml-1">
                        ({Math.round(distance)}nm @ {typeof leg.boat_average_speed_knots === 'string' ? parseFloat(leg.boat_average_speed_knots) : leg.boat_average_speed_knots}kt)
                      </span>
                    </div>
                  </div>
                )}
                {/* Empty spacer to align with arrow column */}
                {leg.boat_average_speed_knots && <div></div>}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Distance</div>
                  <div className="text-sm font-medium text-foreground">
                    {Math.round(distance)} nm
                  </div>
                </div>
              </div>
            )}

            {/* Risk Level */}
            {(() => {
              const riskConfig = effectiveRiskLevel ? getRiskLevelConfig(effectiveRiskLevel) : null;
              return riskConfig ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground">Risk Level</h3>
                    <button
                      onClick={() => setIsRiskLevelDialogOpen(true)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label="Show risk level information"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-transparent border-transparent">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <Image
                        src={riskConfig.icon}
                        alt={riskConfig.displayName}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-foreground font-medium">
                        {riskConfig.displayName}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {riskConfig.shortDescription}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Minimum Required Experience Level */}
            {leg.min_experience_level && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Minimum Experience Level</h3>
                  <button
                    onClick={() => setIsExperienceLevelDialogOpen(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label="Show experience level information"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                  leg.experience_level_matches === false 
                    ? 'bg-red-50 border-red-300' 
                    : 'bg-transparent border-transparent'
                }`}>
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <Image
                      src={getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).icon}
                      alt={getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">
                      {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).description}
                    </p>
                    {leg.experience_level_matches === false && userExperienceLevel !== null && (
                      <p className="text-sm text-red-700 font-medium mt-1">
                        ⚠ Your level ({getExperienceLevelConfig(userExperienceLevel as ExperienceLevel).displayName}) is below the requirement
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Skills */}
            <SkillsMatchingDisplay
              legSkills={leg.skills || []}
              userSkills={userSkills}
              skillMatchPercentage={leg.skill_match_percentage}
            />

            {/* Boat Info */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">Boat and Skipper</h3>
              <div className="flex gap-3 items-start">
                {leg.boat_image_url && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={leg.boat_image_url}
                      alt={leg.boat_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground mb-1">{leg.boat_name}</h4>
                  {leg.boat_type && (
                    <p className="text-xs text-muted-foreground mb-1">{leg.boat_type}</p>
                  )}
                  {(leg.boat_make || leg.boat_model) && (
                    <p className="text-xs text-muted-foreground">
                      {leg.boat_make && leg.boat_model 
                        ? `${leg.boat_make} ${leg.boat_model}`
                        : leg.boat_make || leg.boat_model || ''}
                    </p>
                  )}
                </div>
                {/* Owner Avatar */}
                {(leg.owner_name || leg.owner_image_url) && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {leg.owner_image_url ? (
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-border">
                        <Image
                          src={leg.owner_image_url}
                          alt={leg.owner_name || 'Owner'}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted border-2 border-border flex items-center justify-center">
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
                      <div className="flex flex-col">
                        <p className="text-xs font-medium text-foreground">Skipper:</p>
                        <p className="text-xs text-muted-foreground max-w-[100px] truncate" title={leg.owner_name}>
                          {leg.owner_name}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Registration Section */}
            <div className="pt-4 border-t border-border">
              {registrationStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Registration Status:</span>
                    {getStatusBadge(registrationStatus)}
                  </div>
                  {registrationStatus === 'Pending approval' && (
                    <button
                      onClick={handleCancelRegistration}
                      disabled={isRegistering}
                      className="w-full bg-secondary text-secondary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Cancel Registration
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isRegistering ? 'Registering...' : 'Register for leg'}
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
          </div>
        )}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-lg shadow-xl border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image
                      src={getRiskLevelConfig(effectiveRiskLevel)!.icon}
                      alt={getRiskLevelConfig(effectiveRiskLevel)!.displayName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {getRiskLevelConfig(effectiveRiskLevel)!.displayName}
                  </h2>
                </div>
                <button
                  onClick={() => setIsRiskLevelDialogOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
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
              <div className="p-4 overflow-y-auto flex-1">
                <div className="prose prose-sm max-w-none text-foreground">
                  {getRiskLevelConfig(effectiveRiskLevel)!.fullInfoText.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="mb-4 text-sm leading-relaxed">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-lg shadow-xl border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image
                      src={getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).icon}
                      alt={getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).displayName}
                  </h2>
                </div>
                <button
                  onClick={() => setIsExperienceLevelDialogOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
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
              <div className="p-4 overflow-y-auto flex-1">
                <div className="prose prose-sm max-w-none text-foreground">
                  {getExperienceLevelConfig(leg.min_experience_level as ExperienceLevel).infoText.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="mb-4 text-sm leading-relaxed">
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
