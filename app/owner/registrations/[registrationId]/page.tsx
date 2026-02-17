'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { SkillsMatchingDisplay } from '@/app/components/crew/SkillsMatchingDisplay';
import { toDisplaySkillName } from '@/app/lib/skillUtils';
import { CrewSummaryCard } from '@/app/components/owner/CrewSummaryCard';
import { PassportVerificationSection } from '@/app/components/owner/PassportVerificationSection';
import riskLevelsConfig from '@/app/config/risk-levels-config.json';
import { CollapsibleSection } from '@/app/components/ui/CollapsibleSection';

type RiskLevel = 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing';

// Helper function to get risk level config
const getRiskLevelConfig = (riskLevel: RiskLevel | null) => {
  if (!riskLevel) return null;

  switch (riskLevel) {
    case 'Coastal sailing':
      return {
        icon: '/coastal_sailing2.png',
        displayName: riskLevelsConfig.coastal_sailing.title,
        shortDescription: riskLevelsConfig.coastal_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
      };
    case 'Offshore sailing':
      return {
        icon: '/offshore_sailing2.png',
        displayName: riskLevelsConfig.offshore_sailing.title,
        shortDescription: riskLevelsConfig.offshore_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
      };
    case 'Extreme sailing':
      return {
        icon: '/extreme_sailing2.png',
        displayName: riskLevelsConfig.extreme_sailing.title,
        shortDescription: riskLevelsConfig.extreme_sailing.infoText.split('\n\n')[0].substring(0, 150) + '...',
      };
    default:
      return null;
  }
};

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
  crew: {
    id: string;
    full_name: string | null;
    username: string | null;
    email: string | null;
    sailing_experience: number | null;
    skills: Array<{ name: string; description: string }>;
    risk_level: string[] | null;
    phone: string | null;
    profile_image_url: string | null;
    sailing_preferences: string | null;
    user_description: string | null;
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
  skill_match_percentage: number | null;
  experience_level_matches: boolean | null;
  effective_risk_level: RiskLevel | null;
  effective_min_experience_level: number | null;
  passportData?: {
    passport_document_id: string | null;
    ai_score: number | null;
    ai_reasoning: string | null;
    photo_verification_passed: boolean | null;
    photo_confidence_score: number | null;
    photo_file_data: string | null;
  } | null;
  passportDoc?: {
    id: string;
    file_name: string;
    metadata: {
      holder_name?: string;
      document_number?: string;
      issuing_country?: string;
      expiry_date?: string;
    };
  } | null;
};

export default function RegistrationDetailsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const registrationId = params?.registrationId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RegistrationDetails | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [denyReason, setDenyReason] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && registrationId) {
      loadRegistrationDetails();
    }
  }, [user, authLoading, router, registrationId]);

  const loadRegistrationDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/registrations/${registrationId}/details`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load registration');
      }

      const result = await response.json();
      console.log('[Registration Page] Data loaded:', {
        hasPassportData: !!result.passportData,
        hasPassportDoc: !!result.passportDoc,
        passportData: result.passportData,
        passportDoc: result.passportDoc,
      });
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

  const handleApprove = async () => {
    setIsUpdating(true);
    setUpdateError(null);

    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Approved' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to approve registration');
      }

      // Reload data to reflect new status
      await loadRegistrationDetails();
    } catch (err: any) {
      setUpdateError(err.message || 'An error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeny = async () => {
    setIsUpdating(true);
    setUpdateError(null);

    try {
      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Not approved',
          notes: denyReason.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to deny registration');
      }

      setShowDenyDialog(false);
      setDenyReason('');

      // Reload data to reflect new status
      await loadRegistrationDetails();
    } catch (err: any) {
      setUpdateError(err.message || 'An error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to get answer display text
  const getAnswerDisplay = (answer: RegistrationDetails['answers'][0]): string => {
    const questionType = answer.journey_requirements.question_type;

    if (questionType === 'text' || questionType === 'yes_no') {
      return answer.answer_text || 'Not answered';
    } else if (questionType === 'multiple_choice' && answer.answer_json) {
      if (Array.isArray(answer.answer_json)) {
        return answer.answer_json.join(', ');
      } else {
        return String(answer.answer_json);
      }
    }
    return answer.answer_text || 'Not answered';
  };

  const distance = data ? calculateDistance() : null;
  const duration = calculateDuration(distance);

  // Check if there are answers to display (either from requirements or answers array)
  const hasQandA = data && (data.requirements.length > 0 || data.answers.length > 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">{error}</p>
            <Link
              href="/owner/registrations"
              className="mt-4 inline-block text-primary hover:underline"
            >
              Back to registrations
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">


      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          href="/owner/registrations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to registrations
        </Link>

        {/* Crew Summary Card - Replaces old header */}
        {data.crew && (() => {
          // Determine if crew's risk level matches the job requirement
          const riskLevelMatches = data.effective_risk_level
            ? (data.crew?.risk_level?.includes(data.effective_risk_level) ?? false)
            : null;

          return (
            <CrewSummaryCard
              crew={data.crew}
              registration={data.registration}
              skillMatchPercentage={data.skill_match_percentage}
              experienceLevelMatches={data.experience_level_matches}
              effectiveMinExperienceLevel={data.effective_min_experience_level}
              legSkills={data.combined_skills}
              effectiveRiskLevel={data.effective_risk_level}
              riskLevelMatches={riskLevelMatches}
              onApprove={handleApprove}
              onDeny={() => setShowDenyDialog(true)}
              isUpdating={isUpdating}
            />
          );
        })()}

        {/* AI Assessment - Collapsible */}
        {data.registration.ai_match_score !== null && (
          <CollapsibleSection
            title="AI Assessment"
            defaultOpen={true}
            badge={
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                data.registration.ai_match_score >= 80 ? 'bg-green-100 text-green-700' :
                data.registration.ai_match_score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>
                {data.registration.ai_match_score}%
              </span>
            }
          >
            <div className="space-y-6">
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

              {/* Passport Verification */}
              {data.passportData && (
                <>
                  <div className="border-t border-border pt-6">
                    <h4 className="text-sm font-semibold text-foreground mb-4">📋 Passport & Photo Verification</h4>
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-xs text-blue-700">
                      <strong>Passport Data Available:</strong>
                      <ul className="mt-2 space-y-1">
                        <li>• Document ID: {data.passportData.passport_document_id || 'None'}</li>
                        <li>• AI Score: {data.passportData.ai_score ?? 'Not assessed'}</li>
                        <li>• Photo Verified: {data.passportData.photo_verification_passed ?? 'Not checked'}</li>
                        <li>• Photo Data: {data.passportData.photo_file_data ? '✓ Present' : '✗ Missing'}</li>
                      </ul>
                    </div>
                    <PassportVerificationSection
                      passportData={data.passportData}
                      passportDoc={data.passportDoc}
                    />
                  </div>
                </>
              )}
              {!data.passportData && (
                <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground">
                  No passport verification required for this journey
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Journey and Leg info - Collapsible */}
        <CollapsibleSection title="Journey & Leg" defaultOpen={true}>
          <div className="space-y-4">
            {/* Journey */}
            <div>
              <Link
                href={`/owner/journeys/${data.journey.id}/registrations`}
                className="text-lg font-semibold text-primary hover:underline"
              >
                {data.journey.name}
              </Link>
              {(data.journey.start_date || data.journey.end_date) && (
                <p className="text-sm text-muted-foreground">
                  {formatDate(data.journey.start_date)} - {formatDate(data.journey.end_date)}
                </p>
              )}
            </div>

            {/* Leg */}
            <div className="pt-3 border-t border-border">
              <p className="font-medium text-foreground">{data.leg.name}</p>

              {/* Waypoints */}
              {(data.leg.start_waypoint || data.leg.end_waypoint) && (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-3">
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
                <div className="flex gap-6 mt-3 text-sm">
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

        {/* Requirements Q&A - Collapsible */}
        {hasQandA && (
          <CollapsibleSection
            title="Registration Questions & Answers"
            defaultOpen={true}
            badge={
              <span className="text-xs text-muted-foreground">
                {data.answers.length} answer{data.answers.length !== 1 ? 's' : ''}
              </span>
            }
          >
            <div className="space-y-4">
              {/* If we have answers, display them directly (answers contain embedded journey_requirements) */}
              {data.answers.length > 0 ? (
                data.answers
                  .sort((a, b) => a.journey_requirements.order - b.journey_requirements.order)
                  .map((answer, index) => (
                    <div key={answer.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-foreground mb-1">
                        Q{index + 1}: {answer.journey_requirements.question_text}
                        {answer.journey_requirements.is_required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      <p className="text-sm text-foreground">
                        {getAnswerDisplay(answer)}
                      </p>
                    </div>
                  ))
              ) : (
                /* Fallback: if we have requirements but no answers, show questions as unanswered */
                data.requirements.map((req, index) => (
                  <div key={req.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Q{index + 1}: {req.question_text}
                      {req.is_required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    <p className="text-sm text-muted-foreground italic">
                      Not answered
                    </p>
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Additional Notes from Crew - Collapsible */}
        {data.registration.notes && (
          <CollapsibleSection title="Additional Notes from Crew" defaultOpen={true}>
            <p className="text-sm text-foreground whitespace-pre-wrap">{data.registration.notes}</p>
          </CollapsibleSection>
        )}

      </main>

      {/* Deny Dialog */}
      {showDenyDialog && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowDenyDialog(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-lg shadow-xl border border-border max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Deny Registration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to deny this registration? You can optionally provide a reason.
              </p>

              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Reason for denial (optional)"
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
              />

              {updateError && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {updateError}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowDenyDialog(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeny}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isUpdating ? 'Denying...' : 'Deny Registration'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
