'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { formatDate } from '@/app/lib/dateFormat';
import Link from 'next/link';
import Image from 'next/image';
import { Footer } from '@/app/components/Footer';

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
    skills: string[] | null;
    min_experience_level: number | null;
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
    profile_image_url: string | null;
  };
  answers?: Array<{
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
                const journey = leg?.journeys;

                // Skip rendering if essential data is missing
                if (!profile || !leg || !journey) {
                  return null;
                }

                return (
                  <div key={registration.id} className="bg-card rounded-lg shadow p-4 flex flex-col h-full relative">

                    {/* Name and Avatar */}
                    <div className="flex items-center gap-3 mb-3 pr-16">
                      {/* Crew Avatar - Left Side */}
                      <div className="relative w-12 h-12 flex-shrink-0">
                        {profile.profile_image_url ? (
                          <Image
                            src={profile.profile_image_url}
                            alt={profile.full_name || profile.username || 'Crew member'}
                            fill
                            className="object-cover rounded-full"
                            sizes="48px"
                          />
                        ) : (
                          <div className="w-full h-full bg-accent rounded-full flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-muted-foreground"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">                              
                        <h3 className="text-base font-semibold text-foreground line-clamp-1 flex-1">
                          {profile.full_name || profile.username || 'Unknown User'}
                        </h3>

                        {/* Registration Date */}
                        <div className="text-xs text-muted-foreground flex">
                          <div>Registered: {formatDate(registration.created_at)}</div>
                          {registration.updated_at !== registration.created_at && (
                            <div>Updated: {formatDate(registration.updated_at)}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Journey, Leg, and Dates */}
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Journey</p>
                        <Link 
                          href={`/owner/journeys/${journey.id}/legs`} 
                          className="text-sm font-medium text-primary hover:underline line-clamp-1 block"
                        >
                          {journey.name}
                        </Link>
                      </div>
                      
                      {/* Leg Name */}
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Leg</p>
                        <p className="text-sm font-semibold text-foreground line-clamp-1">
                          {leg.name}
                        </p>
                      </div>

                      {/* Dates with Arrow */}
                      {leg.start_date && (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          {/* Start Date */}
                          <div className="flex flex-col justify-center">
                            <div className="text-xs font-medium text-foreground">
                              {formatDate(leg.start_date)}
                            </div>
                          </div>

                          {/* Arrow */}
                          <div className="text-foreground flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">→</span>
                          </div>

                          {/* End Date */}
                          <div className="flex flex-col justify-center">
                            {leg.end_date ? (
                              <div className="text-xs font-medium text-foreground">
                                {formatDate(leg.end_date)}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">No end date</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Registration Date */}

                    <div className="mt-auto pt-3 border-t border-border">
                      {/* Status Badge - Top Right - Clickable */}
                      <Link
                        href={`/owner/registrations/${registration.id}`}
                        className="flex justify-center hover:opacity-80 transition-opacity"
                        title="View registration details">
                        {getStatusBadge(registration.status)}
                      </Link>
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
      <Footer />
    </div>
  );
}
