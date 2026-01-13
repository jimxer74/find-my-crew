'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { JourneyFormModal } from '@/app/components/manage/JourneyFormModal';
import { AIGenerateJourneyModal } from '@/app/components/manage/AIGenerateJourneyModal';
import { Pagination } from '@/app/components/ui/Pagination';

export default function JourneysPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [journeys, setJourneys] = useState<any[]>([]);
  const [boats, setBoats] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'start_date' | 'created_at'>('start_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterBoatId, setFilterBoatId] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const itemsPerPage = 9; // 3 columns × 3 rows

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      loadJourneys();
    }
  }, [user, authLoading, router]);

  const loadJourneys = async () => {
    const supabase = getSupabaseBrowserClient();
    
    // First get all boats owned by user with names
    const { data: boatsData, error: boatsError } = await supabase
      .from('boats')
      .select('id, name')
      .eq('owner_id', user?.id)
      .order('name', { ascending: true });

    if (boatsError) {
      console.error('Error loading boats:', boatsError);
    } else {
      setBoats(boatsData || []);
    }

    if (boatsData && boatsData.length > 0) {
      const boatIds = boatsData.map(b => b.id);
      
      // Then get all journeys for those boats with boat name
      const { data, error } = await supabase
        .from('journeys')
        .select('*, boats(name)')
        .in('boat_id', boatIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading journeys:', error);
      } else {
        // Transform data to flatten boat name
        const transformedData = (data || []).map((journey: any) => ({
          ...journey,
          boat_name: journey.boats?.name || 'Unknown Boat'
        }));
        setJourneys(transformedData);
      }
    } else {
      setJourneys([]);
    }
    setLoading(false);
  };

  // Filter journeys based on selected filters
  const filteredJourneys = journeys.filter((journey) => {
    // Filter by boat
    if (filterBoatId !== 'all' && journey.boat_id !== filterBoatId) {
      return false;
    }
    
    // Filter by state
    if (filterState !== 'all' && journey.state !== filterState) {
      return false;
    }
    
    return true;
  });

  // Sort journeys based on selected sort option
  const sortedJourneys = [...filteredJourneys].sort((a, b) => {
    if (sortField === 'start_date') {
      const aStartDate = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bStartDate = b.start_date ? new Date(b.start_date).getTime() : 0;
      
      // Handle missing dates - put them at the end
      if (aStartDate === 0 && bStartDate === 0) return 0;
      if (aStartDate === 0) return 1; // No date goes to end
      if (bStartDate === 0) return -1; // No date goes to end
      
      // Sort by start date
      const comparison = aStartDate - bStartDate;
      return sortDirection === 'asc' ? comparison : -comparison;
    } else {
      // Sort by creation date
      const aCreatedAt = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreatedAt = b.created_at ? new Date(b.created_at).getTime() : 0;
      
      const comparison = aCreatedAt - bCreatedAt;
      return sortDirection === 'asc' ? comparison : -comparison;
    }
  });

  // Handle sort change - toggle direction if same field, otherwise set new field with default direction
  const handleSortChange = (newField: 'start_date' | 'created_at') => {
    if (newField === sortField) {
      // Toggle direction if same field is selected
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with default direction
      setSortField(newField);
      // Default: start_date = asc (closest first), created_at = desc (newest first)
      setSortDirection(newField === 'start_date' ? 'asc' : 'desc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Handle filter changes
  const handleFilterChange = (type: 'boat' | 'state', value: string) => {
    if (type === 'boat') {
      setFilterBoatId(value);
    } else {
      setFilterState(value);
    }
    setCurrentPage(1); // Reset to first page when filter changes
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">My Journeys & Legs</h1>
          <p className="text-muted-foreground">Manage your journeys and their legs</p>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setEditingJourneyId(null);
                setIsModalOpen(true);
              }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg transition-opacity font-medium inline-flex items-center gap-2 hover:opacity-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create Journey
            </button>
            <button
              onClick={() => {
                setIsAIModalOpen(true);
              }}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg transition-opacity font-medium inline-flex items-center gap-2 hover:opacity-90 border border-border"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Propose Journey
            </button>
          </div>
          {(journeys.length > 0 || boats.length > 0) && (
            <div className="flex flex-wrap items-center gap-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                {boats.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="filter-boat" className="text-sm text-muted-foreground">
                      Boat:
                    </label>
                    <select
                      id="filter-boat"
                      value={filterBoatId}
                      onChange={(e) => handleFilterChange('boat', e.target.value)}
                      className="px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                    >
                      <option value="all">All Boats</option>
                      {boats.map((boat) => (
                        <option key={boat.id} value={boat.id}>
                          {boat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label htmlFor="filter-state" className="text-sm text-muted-foreground">
                    State:
                  </label>
                  <select
                    id="filter-state"
                    value={filterState}
                    onChange={(e) => handleFilterChange('state', e.target.value)}
                    className="px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                  >
                    <option value="all">All States</option>
                    <option value="In planning">In planning</option>
                    <option value="Published">Published</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>
              {/* Sort */}
              <div className="flex items-center gap-2 ml-auto">
                <label htmlFor="sort-select" className="text-sm text-muted-foreground">
                  Sort by:
                </label>
                <select
                  id="sort-select"
                  value={sortField}
                  onChange={(e) => handleSortChange(e.target.value as 'start_date' | 'created_at')}
                  className="px-3 py-2 border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                >
                  <option value="start_date">Journey start date</option>
                  <option value="created_at">Creation date</option>
                </select>
                <button
                  onClick={() => {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    setCurrentPage(1);
                  }}
                  className="px-2 py-2 border border-border bg-input-background rounded-md hover:bg-accent transition-colors"
                  title={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'} - Click to toggle`}
                  aria-label={`Toggle sort direction: currently ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {journeys.length === 0 ? (
          <div className="bg-card rounded-lg shadow p-8 text-center">
            <p className="text-muted-foreground mb-4">You haven't created any journeys yet.</p>
            <button
              onClick={() => {
                setEditingJourneyId(null);
                setIsModalOpen(true);
              }}
              className="font-medium text-primary hover:opacity-80"
            >
              Create your first journey →
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedJourneys
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((journey) => (
                  <div key={journey.id} className="bg-card rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-card-foreground mb-2">{journey.name}</h3>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {journey.boat_name && <p>Boat: {journey.boat_name}</p>}
                          {journey.start_date && <p>Start: {new Date(journey.start_date).toLocaleDateString()}</p>}
                          {journey.end_date && <p>End: {new Date(journey.end_date).toLocaleDateString()}</p>}
                          <p className={journey.is_public ? 'text-green-600' : 'text-muted-foreground'}>
                            {journey.is_public ? 'Public' : 'Private'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {journey.description && (
                      <p className="text-muted-foreground mb-4">{journey.description}</p>
                    )}
                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/owner/journeys/${journey.id}/legs`}
                        className="font-medium text-sm text-primary hover:opacity-80"
                      >
                        View legs
                      </Link>
                      <span className="text-border">|</span>
                      <button
                        onClick={() => {
                          setEditingJourneyId(journey.id);
                          setIsModalOpen(true);
                        }}
                        className="font-medium text-sm text-primary hover:opacity-80"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(sortedJourneys.length / itemsPerPage)}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={sortedJourneys.length}
            />
          </>
        )}
      </main>

      {/* Journey Form Modal */}
      {user && (
        <>
          <JourneyFormModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingJourneyId(null);
            }}
            onSuccess={() => {
              loadJourneys();
              setCurrentPage(1); // Reset to first page after creating/editing
            }}
            journeyId={editingJourneyId}
            userId={user.id}
          />
          <AIGenerateJourneyModal
            isOpen={isAIModalOpen}
            onClose={() => {
              setIsAIModalOpen(false);
            }}
            onSuccess={() => {
              loadJourneys();
              setCurrentPage(1); // Reset to first page after creating
            }}
            userId={user.id}
          />
        </>
      )}
    </div>
  );
}
