'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { Header } from '@/app/components/Header';
import { formatDate } from '@/app/lib/dateFormat';
import { getExperienceLevelConfig, ExperienceLevel } from '@/app/types/experience-levels';
import Link from 'next/link';
import Image from 'next/image';

type Registration = {
  id: string;
  leg_id: string;
  user_id: string;
  status: 'Pending approval' | 'Approved' | 'Not approved' | 'Cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  ai_match_score?: number | null;
  ai_match_reasoning?: string | null;
  auto_approved?: boolean;
  legs: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    journey_id: string;
    journeys: {
      id: string;
      name: string;
      boat_id: string;
      boats: {
        id: string;
        name: string;
        owner_id: string;
      };
    };
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

type Leg = {
  id: string;
  name: string;
  journey_id: string;
};

export default function AllRegistrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterJourneyId, setFilterJourneyId] = useState<string>('all');
  const [filterLegId, setFilterLegId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [updatingRegistrationId, setUpdatingRegistrationId] = useState<string | null>(null);
  const [updateNotes, setUpdateNotes] = useState<{ [key: string]: string }>({});
  const prevFiltersRef = useRef<string | null>(null);
  const isLoadingRef = useRef<boolean>(false);
  const hasLoadedOnceRef = useRef<boolean>(false);

  const itemsPerPage = 20;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      loadJourneys();
    }
  }, [user, authLoading, router]);

  // Load registrations when filters, sort, or page changes
  // Reset to page 1 when filters/sort change (but not when just page changes)
  useEffect(() => {
    if (!user) return;
    
    // Prevent duplicate simultaneous calls
    if (isLoadingRef.current) {
      console.log('[Registrations] Skipping duplicate call - already loading');
      return;
    }
    
    const currentFilterKey = `${filterStatus}-${filterJourneyId}-${filterLegId}-${sortBy}-${sortOrder}`;
    const prevKey = prevFiltersRef.current;
    
    // Skip if this exact combination was already loaded (prevents duplicate calls from StrictMode/re-renders)
    if (prevKey === currentFilterKey && hasLoadedOnceRef.current) {
      console.log('[Registrations] Filter key unchanged, skipping load');
      return;
    }
    
    // If filters changed (not just page), reset to page 1 first
    const filtersChanged = prevKey !== null && 
      prevKey.split('-').slice(0, 5).join('-') !== currentFilterKey.split('-').slice(0, 5).join('-');
    
    if (filtersChanged && currentPage !== 1) {
      console.log('[Registrations] Filters changed, resetting to page 1');
      setCurrentPage(1);
      // Don't update prevFiltersRef yet - let the page change trigger this effect again
      return;
    }
    
    // Update the filter key reference before loading
    prevFiltersRef.current = currentFilterKey;
    hasLoadedOnceRef.current = true;
    
    // Load registrations
    console.log('[Registrations] Loading registrations with filter key:', currentFilterKey);
    loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterStatus, filterJourneyId, filterLegId, sortBy, sortOrder, currentPage]);

  useEffect(() => {
    if (filterJourneyId !== 'all') {
      loadLegsForJourney(filterJourneyId);
    } else {
      setLegs([]);
      // Only update filterLegId if it's not already 'all' to prevent unnecessary re-renders
      if (filterLegId !== 'all') {
        setFilterLegId('all');
      }
    }
  }, [filterJourneyId]);

  const loadJourneys = async () => {
    if (!user) return;

    try {
      const supabase = await import('@/app/lib/supabaseClient').then(m => m.getSupabaseBrowserClient());
      
      // Get owner's boats
      const { data: boats } = await supabase
        .from('boats')
        .select('id')
        .eq('owner_id', user.id);

      if (!boats || boats.length === 0) {
        setJourneys([]);
        return;
      }

      const boatIds = boats.map(boat => boat.id);

      // Get journeys for owner's boats
      const { data: journeysData, error } = await supabase
        .from('journeys')
        .select('id, name')
        .in('boat_id', boatIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading journeys:', error);
      } else {
        setJourneys(journeysData || []);
      }
    } catch (error) {
      console.error('Error loading journeys:', error);
    }
  };

  const loadLegsForJourney = async (journeyId: string) => {
    if (!user) return;

    try {
      const supabase = await import('@/app/lib/supabaseClient').then(m => m.getSupabaseBrowserClient());
      const { data, error } = await supabase
        .from('legs')
        .select('id, name, journey_id')
        .eq('journey_id', journeyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading legs:', error);
      } else {
        setLegs(data || []);
      }
    } catch (error) {
      console.error('Error loading legs:', error);
    }
  };

  const loadRegistrations = async () => {
    if (!user) return;
    
    // Prevent duplicate simultaneous calls
    if (isLoadingRef.current) {
      console.log('[Registrations] loadRegistrations called but already loading, skipping');
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      if (filterJourneyId !== 'all') {
        params.append('journey_id', filterJourneyId);
      }
      if (filterLegId !== 'all') {
        params.append('leg_id', filterLegId);
      }
      params.append('sort_by', sortBy);
      params.append('sort_order', sortOrder);
      params.append('limit', itemsPerPage.toString());
      params.append('offset', ((currentPage - 1) * itemsPerPage).toString());

      const url = `/api/registrations/owner/all?${params.toString()}`;
      console.log('[Registrations] Fetching:', url);
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load registrations');
      }

      const data = await response.json();
      setRegistrations(data.registrations || []);
      setTotalCount(data.total || 0);
      console.log('[Registrations] Loaded', data.registrations?.length || 0, 'registrations');
    } catch (error: any) {
      console.error('Error loading registrations:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };


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

  const totalPages = Math.ceil(totalCount / itemsPerPage);

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
          <h1 className="text-3xl font-bold text-foreground mb-2">All Registrations</h1>
          <p className="text-muted-foreground">Manage crew registrations across all your journeys</p>
        </div>

        {/* Filters and Sorting */}
        <div className="mb-6 bg-card rounded-lg shadow p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label htmlFor="filter-status" className="block text-sm font-medium text-foreground mb-2">
                Status
              </label>
              <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Statuses</option>
                <option value="Pending approval">Pending approval</option>
                <option value="Approved">Approved</option>
                <option value="Not approved">Not approved</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Journey Filter */}
            <div>
              <label htmlFor="filter-journey" className="block text-sm font-medium text-foreground mb-2">
                Journey
              </label>
              <select
                id="filter-journey"
                value={filterJourneyId}
                onChange={(e) => setFilterJourneyId(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Journeys</option>
                {journeys.map((journey) => (
                  <option key={journey.id} value={journey.id}>
                    {journey.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Leg Filter */}
            <div>
              <label htmlFor="filter-leg" className="block text-sm font-medium text-foreground mb-2">
                Leg
              </label>
              <select
                id="filter-leg"
                value={filterLegId}
                onChange={(e) => setFilterLegId(e.target.value)}
                disabled={filterJourneyId === 'all' || legs.length === 0}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">All Legs</option>
                {legs.map((leg) => (
                  <option key={leg.id} value={leg.id}>
                    {leg.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label htmlFor="sort-by" className="block text-sm font-medium text-foreground mb-2">
                Sort By
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="created_at">Registration Date</option>
                <option value="updated_at">Last Updated</option>
                <option value="status">Status</option>
                <option value="journey_name">Journey Name</option>
                <option value="leg_name">Leg Name</option>
              </select>
            </div>
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-foreground">Sort Order:</label>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-1 border border-border bg-input-background rounded-md text-sm hover:bg-accent transition-colors flex items-center gap-1"
            >
              {sortOrder === 'asc' ? '↑' : '↓'} {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Showing {registrations.length} of {totalCount} {totalCount === 1 ? 'registration' : 'registrations'}
          </div>
        </div>

        {/* Registrations Grid */}
        {registrations.length === 0 ? (
          <div className="bg-card rounded-lg shadow p-8 text-center">
            <p className="text-muted-foreground">No registrations found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {registrations.map((registration) => {
                const profile = registration.profiles;
                const leg = registration.legs;
                const journey = leg.journeys;

                return (
                  <div key={registration.id} className="bg-card rounded-lg shadow p-5 flex flex-col h-full">
                    {/* Header */}
                    <div className="mb-3">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-base font-semibold text-foreground line-clamp-2 flex-1">
                          {profile.full_name || profile.username || 'Unknown User'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getStatusBadge(registration.status)}
                        {registration.auto_approved && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 border border-green-300 rounded-full text-xs font-medium">
                            Auto-approved by AI
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
                            AI Score: {registration.ai_match_score}%
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Journey: <Link href={`/owner/journeys/${journey.id}/legs`} className="font-medium text-primary hover:underline line-clamp-1">{journey.name}</Link>
                        </p>
                        <p className="text-sm text-muted-foreground">
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
                    <div className="mb-4 pb-4 border-b border-border">
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Experience Level</p>
                        {profile.sailing_experience ? (
                          <div className="flex items-center gap-2">
                            <div className="relative w-6 h-6">
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
                        <p className="text-sm text-foreground bg-accent/50 p-2 rounded line-clamp-3">{registration.notes}</p>
                      </div>
                    )}

                    {/* AI Assessment Info */}
                    {registration.ai_match_reasoning && (
                      <div className="mb-4">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium mb-2">
                            AI Assessment Details
                          </summary>
                          <div className="mt-2 p-2 bg-accent/50 rounded text-muted-foreground text-xs">
                            {registration.ai_match_reasoning}
                          </div>
                        </details>
                      </div>
                    )}

                    {/* Actions - Push to bottom */}
                    <div className="mt-auto pt-3 border-t border-border">
                      {registration.status === 'Pending approval' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              Add Notes (Optional)
                            </label>
                            <textarea
                              value={updateNotes[registration.id] || ''}
                              onChange={(e) => setUpdateNotes(prev => ({ ...prev, [registration.id]: e.target.value }))}
                              placeholder="Add notes..."
                              className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              rows={2}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateStatus(registration.id, 'Approved')}
                              disabled={updatingRegistrationId === registration.id}
                              className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              {updatingRegistrationId === registration.id ? 'Updating...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(registration.id, 'Not approved')}
                              disabled={updatingRegistrationId === registration.id}
                              className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              {updatingRegistrationId === registration.id ? 'Updating...' : 'Deny'}
                            </button>
                          </div>
                        </div>
                      )}

                      {registration.status !== 'Pending approval' && (
                        <div className="text-xs text-muted-foreground">
                          <div>Registered: {formatDate(registration.created_at)}</div>
                          {registration.updated_at !== registration.created_at && (
                            <div>Updated: {formatDate(registration.updated_at)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
