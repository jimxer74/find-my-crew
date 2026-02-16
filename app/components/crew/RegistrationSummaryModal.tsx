'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

type RegistrationDetails = {
  registration: {
    id: string;
    status: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
    ai_match_score: number | null;
    ai_match_reasoning: string | null;
    auto_approved: boolean;
  };
  owner: {
    id: string;
    full_name: string | null;
    username: string | null;
    profile_image_url: string | null;
  } | null;
  leg: {
    id: string;
    name: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    crew_needed: number | null;
    risk_level: RiskLevel | null;
    skills: string[];
    min_experience_level: number | null;
    start_waypoint: { lng: number; lat: number; name: string | null } | null;
    end_waypoint: { lng: number; lat: number; name: string | null } | null;
  };
  journey: {
    id: string;
    name: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    risk_level: string[] | null;
    skills: string[];
    min_experience_level: number | null;
  };
  boat: {
    id: string;
    name: string;
    type: string | null;
    make: string | null;
    model: string | null;
    image_url: string | null;
    average_speed_knots: number | null;
  };
  requirements: Array<{
    id: string;
    question_text: string;
    question_type: string;
    options: string[] | null;
    is_required: boolean;
    order: number;
    weight: number;
  }>;
  answers: Array<{
    id: string;
    requirement_id: string;
    answer_text: string | null;
    answer_json: any;
    journey_requirements: {
      id: string;
      question_text: string;
      question_type: string;
      options: string[] | null;
      is_required: boolean;
      order: number;
    };
  }>;
  combined_skills: string[];
  effective_risk_level: RiskLevel | null;
  effective_min_experience_level: number | null;
};

type RegistrationSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  registrationId: string | null;
};

// Collapsible Section Component
const CollapsibleSection = ({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-card rounded-lg shadow mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-accent/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
          {badge}
        </div>
        <svg
          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

// Helper function to get risk level config
const getRiskLevelConfig = (riskLevel: RiskLevel | null) => {
  if (!riskLevel) return null;

  switch (riskLevel) {
    case 'Coastal sailing':
      return {
        icon: '/coastal_sailing2.png',
        displayName: riskLevelsConfig.coastal_sailing.title,
      };
    case 'Offshore sailing':
      return {
        icon: '/offshore_sailing2.png',
        displayName: riskLevelsConfig.offshore_sailing.title,
      };
    case 'Extreme sailing':
      return {
        icon: '/extreme_sailing2.png',
        displayName: riskLevelsConfig.extreme_sailing.title,
      };
    default:
      return null;
  }
};

export function RegistrationSummaryModal({
  isOpen,
  onClose,
  registrationId,
}: RegistrationSummaryModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RegistrationDetails | null>(null);

  useEffect(() => {
    if (isOpen && registrationId) {
      loadRegistrationDetails();
    } else {
      // Reset state when modal closes
      setData(null);
      setError(null);
    }
  }, [isOpen, registrationId]);

  const loadRegistrationDetails = async () => {
    if (!registrationId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/registrations/crew/${registrationId}/details`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load registration');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance between start and end waypoints (nautical miles)
  const calculateDistance = (): number | null => {
    if (!data?.leg.start_waypoint || !data?.leg.end_waypoint) return null;

    const R = 3440; // Earth's radius in nautical miles
    const lat1 = (data.leg.start_waypoint.lat * Math.PI) / 180;
    const lat2 = (data.leg.end_waypoint.lat * Math.PI) / 180;
    const deltaLat = ((data.leg.end_waypoint.lat - data.leg.start_waypoint.lat) * Math.PI) / 180;
    const deltaLng = ((data.leg.end_waypoint.lng - data.leg.start_waypoint.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Calculate duration in hours based on distance and speed
  const calculateDuration = (distance: number | null): string => {
    const boatSpeed = data?.boat.average_speed_knots;

    if (!distance || !boatSpeed || boatSpeed <= 0) {
      return 'N/A';
    }

    // Account for 70-80% efficiency due to conditions
    const effectiveSpeed = boatSpeed * 0.75;
    const hours = distance / effectiveSpeed;

    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours === 0) {
      return `${days}d`;
    }
    return `${days}d ${remainingHours}h`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, string> = {
      'Pending approval': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Approved': 'bg-green-100 text-green-800 border-green-300',
      'Not approved': 'bg-red-100 text-red-800 border-red-300',
      'Cancelled': 'bg-gray-100 text-gray-800 border-gray-300',
    };

    return (
      <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig[status] || statusConfig['Pending approval']}`}>
        {status}
      </span>
    );
  };

  const distance = data ? calculateDistance() : null;
  const duration = calculateDuration(distance);
  const isApproved = data?.registration.status === 'Approved';
  const isDenied = data?.registration.status === 'Not approved';

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-card rounded-lg shadow-xl border border-border max-w-4xl w-full max-h-[90vh] overflow-y-auto my-auto">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-foreground">Registration Summary</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-md transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            )}

            {data && !loading && (
              <>
                {/* Status Header */}
                <div className="bg-card rounded-lg shadow p-6 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground mb-2">Registration Status</h3>
                      <div className="flex items-center gap-3 flex-wrap">
                        {getStatusBadge(data.registration.status)}
                        {data.registration.auto_approved && (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Auto-approved by AI
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Registered: {formatDate(data.registration.created_at)}</p>
                      {data.registration.updated_at !== data.registration.created_at && (
                        <p>Updated: {formatDate(data.registration.updated_at)}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Owner Message / Denial Reason */}
                {isApproved && data.registration.notes && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-semibold text-green-800 mb-2">Message from Skipper</h4>
                    <p className="text-sm text-green-900 whitespace-pre-wrap">{data.registration.notes}</p>
                  </div>
                )}

                {isDenied && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">Reason for Denial</h4>
                    {data.registration.notes ? (
                      <p className="text-sm text-red-900 whitespace-pre-wrap">{data.registration.notes}</p>
                    ) : data.registration.ai_match_reasoning ? (
                      <div>
                        <p className="text-xs text-red-700 mb-2 font-medium">AI Assessment:</p>
                        <p className="text-sm text-red-900 whitespace-pre-wrap">{data.registration.ai_match_reasoning}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-red-900">No specific reason provided.</p>
                    )}
                  </div>
                )}

                {/* Journey & Leg Information */}
                <CollapsibleSection title="Journey & Leg" defaultOpen={true}>
                  <div className="space-y-4">
                    {/* Journey */}
                    <div>
                      <h4 className="text-base font-semibold text-foreground mb-1">{data.journey.name}</h4>
                      {(data.journey.start_date || data.journey.end_date) && (
                        <p className="text-sm text-muted-foreground">
                          {formatDate(data.journey.start_date)} - {formatDate(data.journey.end_date)}
                        </p>
                      )}
                    </div>

                    {/* Leg */}
                    <div className="pt-3 border-t border-border">
                      <p className="font-medium text-foreground mb-2">{data.leg.name}</p>

                      {/* Waypoints */}
                      {(data.leg.start_waypoint || data.leg.end_waypoint) && (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-3">
                          <div>
                            {data.leg.start_waypoint?.name && (
                              <p className="text-sm font-medium text-foreground">{data.leg.start_waypoint.name}</p>
                            )}
                            {data.leg.start_date && (
                              <p className="text-xs text-muted-foreground">{formatDate(data.leg.start_date)}</p>
                            )}
                          </div>
                          <div className="text-foreground">
                            <span className="text-lg">→</span>
                          </div>
                          <div>
                            {data.leg.end_waypoint?.name && (
                              <p className="text-sm font-medium text-foreground">{data.leg.end_waypoint.name}</p>
                            )}
                            {data.leg.end_date && (
                              <p className="text-xs text-muted-foreground">{formatDate(data.leg.end_date)}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Distance and Duration */}
                      {distance !== null && (
                        <div className="flex gap-6 text-sm">
                          <div>
                            <span className="text-muted-foreground">Distance: </span>
                            <span className="font-medium text-foreground">{Math.round(distance)} nm</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Duration: </span>
                            <span className="font-medium text-foreground">{duration}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Boat & Skipper Information - blur when not authenticated */}
                <CollapsibleSection title="Boat & Skipper" defaultOpen={true}>
                  <div className="relative">
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
                    <div className="space-y-4">
                    {/* Boat */}
                    <div className="flex gap-4">
                      {data.boat.image_url && (
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={data.boat.image_url}
                            alt={data.boat.name}
                            fill
                            className="object-cover"
                            sizes="96px"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-foreground mb-1">{data.boat.name}</h4>
                        {data.boat.type && (
                          <p className="text-sm text-muted-foreground mb-1">{data.boat.type}</p>
                        )}
                        {(data.boat.make || data.boat.model) && (
                          <p className="text-sm text-muted-foreground">
                            {data.boat.make && data.boat.model ? `${data.boat.make} ${data.boat.model}` : data.boat.make || data.boat.model || ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Skipper */}
                    {data.owner && (
                      <div className="pt-3 border-t border-border flex items-center gap-3">
                        {data.owner.profile_image_url ? (
                          <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                            <Image
                              src={data.owner.profile_image_url}
                              alt={data.owner.full_name || data.owner.username || 'Skipper'}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Skipper</p>
                          <p className="text-sm font-medium text-foreground">
                            {data.owner.full_name || data.owner.username || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                </CollapsibleSection>

                {/* Requirements (if applicable) */}
                {data.effective_risk_level && getRiskLevelConfig(data.effective_risk_level) && (
                  <CollapsibleSection title="Requirements" defaultOpen={false}>
                    <div className="space-y-4">
                      {/* Risk Level */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Risk Level</p>
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <Image
                              src={getRiskLevelConfig(data.effective_risk_level)!.icon}
                              alt={getRiskLevelConfig(data.effective_risk_level)!.displayName}
                              fill
                              className="object-contain"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {getRiskLevelConfig(data.effective_risk_level)!.displayName}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Experience Level */}
                      {data.effective_min_experience_level && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Minimum Experience Level</p>
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 flex-shrink-0">
                              <Image
                                src={getExperienceLevelConfig(data.effective_min_experience_level as ExperienceLevel).icon}
                                alt={getExperienceLevelConfig(data.effective_min_experience_level as ExperienceLevel).displayName}
                                fill
                                className="object-contain"
                              />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {getExperienceLevelConfig(data.effective_min_experience_level as ExperienceLevel).displayName}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}

                {/* AI Assessment (if available) */}
                {data.registration.ai_match_score !== null && (
                  <CollapsibleSection
                    title="AI Assessment"
                    defaultOpen={false}
                    badge={
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        data.registration.ai_match_score >= 80 ? 'bg-green-100 text-green-700' :
                        data.registration.ai_match_score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {data.registration.ai_match_score}%
                      </span>
                    }
                  >
                    <div className="space-y-4">
                      {/* Score bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">Match Score</span>
                          <span className={`text-lg font-bold ${
                            data.registration.ai_match_score >= 80 ? 'text-green-600' :
                            data.registration.ai_match_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {data.registration.ai_match_score}%
                          </span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              data.registration.ai_match_score >= 80 ? 'bg-green-500' :
                              data.registration.ai_match_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${data.registration.ai_match_score}%` }}
                          />
                        </div>
                      </div>

                      {/* Reasoning */}
                      {data.registration.ai_match_reasoning && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">AI Reasoning</p>
                          <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
                            {data.registration.ai_match_reasoning}
                          </p>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
