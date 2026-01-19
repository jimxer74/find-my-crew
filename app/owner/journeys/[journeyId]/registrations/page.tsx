'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import { calculateMatchPercentage, getMatchingAndMissingSkills } from '@/app/lib/skillMatching';
import Image from 'next/image';

type Registration = {
  id: string;
  leg_id: string;
  user_id: string;
  status: 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  legs: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
  };
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    sailing_experience: number | null;
    skills: string[];
    phone: string | null;
  };
};

type Journey = {
  id: string;
  name: string;
};

export default function JourneyRegistrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const journeyId = params?.journeyId as string;
  
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLegId, setFilterLegId] = useState<string>('all');
  const [legs, setLegs] = useState<Array<{ id: string; name: string }>>([]);
  const [updatingRegistrationId, setUpdatingRegistrationId] = useState<string | null>(null);
  const [updateNotes, setUpdateNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && journeyId) {
      loadJourney();
      loadLegs();
      loadRegistrations();
    }
  }, [user, authLoading, router, journeyId]);

  const loadJourney = async () => {
    if (!user || !journeyId) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('journeys')
      .select('id, name')
      .eq('id', journeyId)
      .single();

    if (error) {
      console.error('Error loading journey:', error);
    } else {
      setJourney(data);
    }
  };

  const loadLegs = async () => {
    if (!user || !journeyId) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('legs')
      .select('id, name')
      .eq('journey_id', journeyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading legs:', error);
    } else {
      setLegs(data || []);
    }
  };

  const loadRegistrations = async () => {
    if (!user || !journeyId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      if (filterLegId !== 'all') {
        params.append('leg_id', filterLegId);
      }

      const url = `/api/registrations/by-journey/${journeyId}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

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

  useEffect(() => {
    if (user && journeyId) {
      loadRegistrations();
    }
  }, [filterStatus, filterLegId]);

  const handleUpdateStatus = async (registrationId: string, status: 'Approved' | 'Not approved' | 'Cancelled') => {
    setUpdatingRegistrationId(registrationId);

    try {
      const notes = updateNotes[registrationId] || null;

      const response = await fetch(`/api/registrations/${registrationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update registration');
      }

      // Reload registrations
      await loadRegistrations();
      // Clear notes for this registration
      setUpdateNotes(prev => {
        const next = { ...prev };
        delete next[registrationId];
        return next;
      });
    } catch (error: any) {
      console.error('Error updating registration:', error);
      alert(error.message || 'Failed to update registration');
    } finally {
      setUpdatingRegistrationId(null);
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Registrations for {journey?.name || 'Journey'}
          </h1>
          <p className="text-muted-foreground">Review and manage crew registrations</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-status" className="text-sm text-muted-foreground">
              Status:
            </label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All</option>
              <option value="Pending approval">Pending approval</option>
              <option value="Approved">Approved</option>
              <option value="Not approved">Not approved</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-leg" className="text-sm text-muted-foreground">
              Leg:
            </label>
            <select
              id="filter-leg"
              value={filterLegId}
              onChange={(e) => setFilterLegId(e.target.value)}
              className="px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Legs</option>
              {legs.map((leg) => (
                <option key={leg.id} value={leg.id}>
                  {leg.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            {registrations.length} {registrations.length === 1 ? 'registration' : 'registrations'}
          </div>
        </div>

        {/* Registrations List */}
        {registrations.length === 0 ? (
          <div className="bg-card rounded-lg shadow p-8 text-center">
            <p className="text-muted-foreground">No registrations found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {registrations.map((registration) => {
              // Calculate match percentage (would need leg skills/requirements)
              // For now, just show basic info
              const profile = registration.profiles;
              const leg = registration.legs;

              return (
                <div key={registration.id} className="bg-card rounded-lg shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {profile.full_name || profile.username || 'Unknown User'}
                        </h3>
                        {getStatusBadge(registration.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Leg: <span className="font-medium text-foreground">{leg.name}</span>
                      </p>
                      {leg.start_date && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(leg.start_date)}
                          {leg.end_date && ` - ${formatDate(leg.end_date)}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-border">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Experience Level</p>
                      {profile.sailing_experience ? (
                        <div className="flex items-center gap-2">
                          <div className="relative w-8 h-8">
                            <Image
                              src={getExperienceLevelConfig(profile.sailing_experience as ExperienceLevel).icon}
                              alt={getExperienceLevelConfig(profile.sailing_experience as ExperienceLevel).displayName}
                              fill
                              className="object-contain"
                            />
                          </div>
                          <span className="text-sm text-foreground">
                            {getExperienceLevelConfig(profile.sailing_experience as ExperienceLevel).displayName}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not specified</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Skills</p>
                      {profile.skills && profile.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {profile.skills.slice(0, 5).map((skillJson: string, idx: number) => {
                            let skillName = skillJson;
                            try {
                              const parsed = JSON.parse(skillJson);
                              skillName = parsed.skill_name || skillJson;
                            } catch {
                              // Not JSON, use as-is
                            }
                            return (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-accent text-accent-foreground rounded-full text-xs"
                              >
                                {skillName}
                              </span>
                            );
                          })}
                          {profile.skills.length > 5 && (
                            <span className="text-xs text-muted-foreground">+{profile.skills.length - 5} more</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No skills listed</p>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {registration.notes && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-1">Crew Member Notes:</p>
                      <p className="text-sm text-foreground bg-accent/50 p-2 rounded">{registration.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {registration.status === 'Pending approval' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Add Notes (Optional)
                        </label>
                        <textarea
                          value={updateNotes[registration.id] || ''}
                          onChange={(e) => setUpdateNotes(prev => ({ ...prev, [registration.id]: e.target.value }))}
                          placeholder="Add notes about this registration..."
                          className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStatus(registration.id, 'Approved')}
                          disabled={updatingRegistrationId === registration.id}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {updatingRegistrationId === registration.id ? 'Updating...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(registration.id, 'Not approved')}
                          disabled={updatingRegistrationId === registration.id}
                          className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {updatingRegistrationId === registration.id ? 'Updating...' : 'Deny'}
                        </button>
                      </div>
                    </div>
                  )}

                  {registration.status !== 'Pending approval' && (
                    <div className="text-xs text-muted-foreground">
                      Updated: {formatDate(registration.updated_at)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
