'use client';

import { logger } from '@/app/lib/logger';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { calculateMatchPercentage } from '@/app/lib/skillMatching';
import { SkillsMatchingDisplay } from '@/app/components/crew/SkillsMatchingDisplay';
import { Footer } from '@/app/components/Footer';

type RegistrationLeg = {
  registration_id: string;
  registration_status: string;
  registration_notes: string | null;
  registration_created_at: string;
  registration_updated_at: string;
  ai_match_score?: number | null;
  ai_match_reasoning?: string | null;
  auto_approved?: boolean;
  leg_id: string;
  leg_name: string;
  leg_description: string | null;
  journey_id: string;
  journey_name: string;
  start_date: string | null;
  end_date: string | null;
  crew_needed: number | null;
  risk_level: 'Coastal sailing' | 'Offshore sailing' | 'Extreme sailing' | null;
  skills: string[];
  boat_id: string;
  boat_name: string;
  boat_type: string | null;
  boat_make_model: string | null;
  boat_image_url: string | null;
  boat_average_speed_knots: number | null;
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

export default function MyRegistrationsPage() {
  const t = useTranslations('registrations');
  const tCommon = useTranslations('common');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<RegistrationLeg[]>([]);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [userExperienceLevel, setUserExperienceLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      // Load user profile first, then registrations
      loadUserProfile()
        .then(() => {
          loadRegistrations();
        })
        .catch((error) => {
          logger.error('Error loading user profile:', { error: error instanceof Error ? error.message : String(error) });
          // Still load registrations even if profile load fails
          loadRegistrations();
        });
    }
  }, [user, authLoading, router]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('skills, sailing_experience')
        .eq('id', user.id)
        .single();

      if (profile) {
        // Parse and normalize skills from JSON strings to canonical format
        const { normalizeSkillNames } = await import('@/app/lib/skillUtils');
        const skills = normalizeSkillNames(profile.skills || []);
        
        logger.debug('[MyRegistrations] Loaded user skills (canonical):', { skills });
        logger.debug('[MyRegistrations] User experience level:', { level: profile.sailing_experience });
        
        setUserSkills(skills);
        setUserExperienceLevel(profile.sailing_experience);
      } else {
        logger.warn('[MyRegistrations] No profile found for user');
      }
    } catch (error) {
      logger.error('Error loading user profile:', error instanceof Error ? { error: error.message } : { error: String(error) });
    }
  };

  const loadRegistrations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch('/api/registrations/crew/details');

      if (!response.ok) {
        let message = 'Failed to load registrations';
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          message = response.status === 500 ? 'Server error. Please try again.' : message;
        }
        throw new Error(message);
      }

      const data = await response.json();
      setRegistrations(data.registrations || []);
    } catch (error: any) {
      logger.error('Error loading registrations:', error instanceof Error ? { error: error.message } : { error: String(error) });
    } finally {
      setLoading(false);
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

  const handleRegistrationChange = () => {
    // Reload registrations when registration status changes
    loadRegistrations();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">{tCommon('loading')}</div>
      </div>
    );
  }

  // Debug: Log current state
  logger.debug('[MyRegistrations] Render state:', {
    userSkillsCount: userSkills.length,
    userSkills,
    registrationsCount: registrations.length,
    userExperienceLevel,
  });

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        {registrations.length === 0 ? (
          <div className="bg-card rounded-lg shadow p-8 text-center">
            <p className="text-muted-foreground">{t('noLegsRegistered')}</p>
            <a
              href="/crew/dashboard"
              className="mt-4 inline-block text-primary hover:underline"
            >
              {t('browseLegs')}
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registrations.map((registration) => {
              // Skills from API are already in canonical format, just filter empty values
              const legSkills = Array.isArray(registration.skills) 
                ? registration.skills.filter((s: any) => s && String(s).trim().length > 0)
                : [];
              
              // Recalculate match percentage on frontend for consistency
              // Always recalculate if we have userSkills, even if API provided one
              const calculatedMatchPercentage = userSkills.length > 0 && legSkills.length > 0
                ? calculateMatchPercentage(
                    userSkills,
                    legSkills,
                    null,
                    registration.risk_level,
                    null,
                    userExperienceLevel,
                    registration.min_experience_level
                  )
                : (registration.skill_match_percentage ?? undefined);
              
              // Debug logging for first registration
              if (registration.registration_id === registrations[0]?.registration_id) {
                logger.debug('[MyRegistrations] Calculating match for:', {
                  legName: registration.leg_name,
                  userSkills,
                  legSkills,
                  userExperienceLevel,
                  legMinExperience: registration.min_experience_level,
                  calculatedMatchPercentage,
                  apiMatchPercentage: registration.skill_match_percentage,
                });
              }
              
              const displayMatchPercentage = calculatedMatchPercentage;
              
              return (
                <div
                  key={registration.registration_id}
                  className="bg-card rounded-lg shadow p-5 hover:shadow-lg transition-shadow flex flex-col h-full"
                >
                  {/* Header */}
                  <div className="mb-3">
                    {/* Registered Date at Top */}
                    <p className="text-xs text-muted-foreground mb-2">
                      {t('registered')}: {new Date(registration.registration_created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-base font-semibold text-foreground line-clamp-2 flex-1">
                        {registration.leg_name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getStatusBadge(registration.registration_status)}
                      {registration.auto_approved && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 border border-green-300 rounded-full text-xs font-medium">
                          {t('autoApproved')}
                        </span>
                      )}
                      {registration.ai_match_score !== null && registration.ai_match_score !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          registration.ai_match_score >= 80
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : registration.ai_match_score >= 50
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                          {t('aiScore')}: {registration.ai_match_score}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                      {registration.journey_name}
                    </p>
                    {registration.start_waypoint && registration.end_waypoint && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {registration.start_waypoint.name || 'Start'} → {registration.end_waypoint.name || 'End'}
                      </p>
                    )}
                    {registration.start_date && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(registration.start_date).toLocaleDateString()}
                        {registration.end_date && ` - ${new Date(registration.end_date).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>

                  {/* Boat and Skipper Info */}
                  <div className="mb-3 pt-3 border-t border-border">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">{t('boatAndSkipper')}</h4>
                    <div className="flex gap-3 items-start">
                      {registration.boat_image_url && (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={registration.boat_image_url}
                            alt={registration.boat_name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-semibold text-foreground mb-1">{registration.boat_name}</h5>
                        {registration.boat_type && (
                          <p className="text-xs text-muted-foreground mb-1">{registration.boat_type}</p>
                        )}
                        {registration.boat_make_model && (
                          <p className="text-xs text-muted-foreground">
                            {registration.boat_make_model}
                          </p>
                        )}
                      </div>
                      {/* Owner Avatar */}
                      {(registration.owner_name || registration.owner_image_url) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {registration.owner_image_url ? (
                            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-border">
                              <Image
                                src={registration.owner_image_url}
                                alt={registration.owner_name || 'Owner'}
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
                          {registration.owner_name && (
                            <div className="flex flex-col">
                              <p className="text-xs font-medium text-foreground">{t('skipper')}:</p>
                              <p className="text-xs text-muted-foreground max-w-[100px] truncate" title={registration.owner_name}>
                                {registration.owner_name}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Assessment Info */}
                  {registration.ai_match_reasoning && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          {t('aiAssessment')}
                        </summary>
                        <div className="mt-2 p-2 bg-accent/50 rounded text-muted-foreground">
                          {registration.ai_match_reasoning}
                        </div>
                      </details>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
        <Footer />
      </main>
    </div>
  );
}
