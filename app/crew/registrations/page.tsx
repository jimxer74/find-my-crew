'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { Header } from '@/app/components/Header';
import { LegDetailsPanel } from '@/app/components/crew/LegDetailsPanel';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { calculateMatchPercentage } from '@/app/lib/skillMatching';
import { SkillsMatchingDisplay } from '@/app/components/crew/SkillsMatchingDisplay';

type RegistrationLeg = {
  registration_id: string;
  registration_status: string;
  registration_notes: string | null;
  registration_created_at: string;
  registration_updated_at: string;
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
  boat_image_url: string | null;
  boat_average_speed_knots: number | null;
  skipper_name: string | null;
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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<RegistrationLeg[]>([]);
  const [selectedLeg, setSelectedLeg] = useState<RegistrationLeg | null>(null);
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [userExperienceLevel, setUserExperienceLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      // Load user profile first, then registrations
      loadUserProfile().then(() => {
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
        
        console.log('[MyRegistrations] Loaded user skills (canonical):', skills);
        console.log('[MyRegistrations] User experience level:', profile.sailing_experience);
        
        setUserSkills(skills);
        setUserExperienceLevel(profile.sailing_experience);
      } else {
        console.warn('[MyRegistrations] No profile found for user');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadRegistrations = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await fetch('/api/registrations/crew/details');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load registrations');
      }

      const data = await response.json();
      setRegistrations(data.registrations || []);
    } catch (error: any) {
      console.error('Error loading registrations:', error);
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

  const handleLegClick = (leg: RegistrationLeg) => {
    setSelectedLeg(leg);
  };

  const handleClosePanel = () => {
    setSelectedLeg(null);
  };

  const handleRegistrationChange = () => {
    // Reload registrations when registration status changes
    loadRegistrations();
  };

  // Convert RegistrationLeg to Leg format for LegDetailsPanel
  const convertToLegFormat = (reg: RegistrationLeg) => {
    return {
      leg_id: reg.leg_id,
      leg_name: reg.leg_name,
      leg_description: reg.leg_description,
      journey_id: reg.journey_id,
      journey_name: reg.journey_name,
      start_date: reg.start_date,
      end_date: reg.end_date,
      crew_needed: reg.crew_needed,
      risk_level: reg.risk_level,
      skills: reg.skills,
      boat_id: reg.boat_id,
      boat_name: reg.boat_name,
      boat_type: reg.boat_type,
      boat_image_url: reg.boat_image_url,
      boat_average_speed_knots: reg.boat_average_speed_knots,
      skipper_name: reg.skipper_name,
      min_experience_level: reg.min_experience_level,
      skill_match_percentage: reg.skill_match_percentage,
      experience_level_matches: reg.experience_level_matches,
      start_waypoint: reg.start_waypoint,
      end_waypoint: reg.end_waypoint,
    };
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Debug: Log current state
  console.log('[MyRegistrations] Render state:', {
    userSkillsCount: userSkills.length,
    userSkills,
    registrationsCount: registrations.length,
    userExperienceLevel,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Registrations</h1>
          <p className="text-muted-foreground">View and manage your leg registrations</p>
        </div>

        {registrations.length === 0 ? (
          <div className="bg-card rounded-lg shadow p-8 text-center">
            <p className="text-muted-foreground">You haven't registered for any legs yet.</p>
            <a
              href="/crew/dashboard"
              className="mt-4 inline-block text-primary hover:underline"
            >
              Browse available legs →
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
                    userExperienceLevel,
                    registration.min_experience_level
                  )
                : (registration.skill_match_percentage ?? undefined);
              
              // Debug logging for first registration
              if (registration.registration_id === registrations[0]?.registration_id) {
                console.log('[MyRegistrations] Calculating match for:', {
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
                  className="bg-card rounded-lg shadow p-5 cursor-pointer hover:shadow-lg transition-shadow flex flex-col h-full"
                  onClick={() => handleLegClick(registration)}
                >
                  {/* Header */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-base font-semibold text-foreground line-clamp-2 flex-1">
                        {registration.leg_name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(registration.registration_status)}
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

                  {/* Skills Preview */}
                  {legSkills.length > 0 && (
                    <div className="mt-auto pt-3 border-t border-border">
                      <SkillsMatchingDisplay
                        legSkills={legSkills}
                        userSkills={userSkills}
                        skillMatchPercentage={displayMatchPercentage}
                        showHeader={true}
                        headerText="Skills"
                        compact={true}
                      />
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      Registered: {new Date(registration.registration_created_at).toLocaleDateString()}
                    </div>
                    <div className="mt-2 text-xs text-primary text-center">
                      Click to view details
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Leg Details Panel */}
      {selectedLeg && (
        <LegDetailsPanel
          leg={convertToLegFormat(selectedLeg)}
          isOpen={true}
          onClose={handleClosePanel}
          userSkills={userSkills}
          userExperienceLevel={userExperienceLevel}
          onRegistrationChange={handleRegistrationChange}
        />
      )}
    </div>
  );
}
