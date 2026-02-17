'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/contexts/AuthContext';
import { Footer } from '@/app/components/Footer';
import { RegistrationsTable } from '@/app/components/registrations/RegistrationsTable';
import { RegistrationCard } from '@/app/components/registrations/RegistrationCard';
import { StatusBadge } from '@/app/components/registrations/StatusBadge';

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
  const t = useTranslations('registrations.allRegistrations');
  const tStatus = useTranslations('registrations.status');
  const tCommon = useTranslations('common');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('Pending approval');
  const [filterJourneyId, setFilterJourneyId] = useState<string>('all');
  const [filterLegId, setFilterLegId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [legs, setLegs] = useState<Leg[]>([]);
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
      // Always append status (default is 'Pending approval')
      params.append('status', filterStatus);
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


  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle sort order if clicking same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to desc
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleStatusFilter = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">{tCommon('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>

        {/* Mobile Filter Badges - Shown only on mobile */}
        <div className="md:hidden mb-4 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => handleStatusFilter('Pending approval')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap font-medium transition-colors ${
              filterStatus === 'Pending approval'
                ? 'bg-yellow-500 text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            P
          </button>
          <button
            onClick={() => handleStatusFilter('Approved')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap font-medium transition-colors ${
              filterStatus === 'Approved'
                ? 'bg-green-500 text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            A
          </button>
          <button
            onClick={() => handleStatusFilter('Not approved')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap font-medium transition-colors ${
              filterStatus === 'Not approved'
                ? 'bg-red-500 text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            N
          </button>
          <button
            onClick={() => handleStatusFilter('Cancelled')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap font-medium transition-colors ${
              filterStatus === 'Cancelled'
                ? 'bg-gray-500 text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            C
          </button>
        </div>

        {/* Desktop Filters and Sorting - Hidden on mobile */}
        <div className="hidden md:block mb-6 bg-card rounded-lg shadow p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label htmlFor="filter-status" className="block text-sm font-medium text-foreground mb-2">
                {t('status')}
              </label>
              <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Pending approval">{tStatus('pending')}</option>
                <option value="Approved">{tStatus('approved')}</option>
                <option value="Not approved">{tStatus('rejected')}</option>
                <option value="Cancelled">{tStatus('cancelled')}</option>
              </select>
            </div>

            {/* Journey Filter */}
            <div>
              <label htmlFor="filter-journey" className="block text-sm font-medium text-foreground mb-2">
                {t('journey')}
              </label>
              <select
                id="filter-journey"
                value={filterJourneyId}
                onChange={(e) => {
                  setFilterJourneyId(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">{t('allJourneys')}</option>
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
                {t('leg')}
              </label>
              <select
                id="filter-leg"
                value={filterLegId}
                onChange={(e) => {
                  setFilterLegId(e.target.value);
                  setCurrentPage(1);
                }}
                disabled={filterJourneyId === 'all' || legs.length === 0}
                className="w-full px-3 py-2 border border-border bg-input-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">{t('allLegs')}</option>
                {legs.map((leg) => (
                  <option key={leg.id} value={leg.id}>
                    {leg.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            {t('showing', { count: registrations.length, total: totalCount })}
          </div>
        </div>

        {/* Desktop Table View */}
        {registrations.length === 0 ? (
          <div className="bg-card rounded-lg shadow p-8 text-center">
            <p className="text-muted-foreground">{t('noMatchingRegistrations')}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block mb-6">
              <RegistrationsTable
                registrations={registrations}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4 mb-6">
              {registrations.map((registration) => (
                <RegistrationCard key={registration.id} registration={registration} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('previous')}
                </button>
                <span className="text-sm text-muted-foreground">
                  {t('pageOf', { current: currentPage, total: totalPages })}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('next')}
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
