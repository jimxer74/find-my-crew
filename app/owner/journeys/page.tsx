'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { JourneyFormModal } from '@/app/components/manage/JourneyFormModal';
import { AIGenerateJourneyModal } from '@/app/components/manage/AIGenerateJourneyModal';
import { Pagination } from '@/app/components/ui/Pagination';
import { formatDate } from '@/app/lib/dateFormat';
import { FeatureGate } from '@/app/components/auth/FeatureGate';
import { checkProfile } from '@/app/lib/profile/checkProfile';
import { Footer } from '@/app/components/Footer';

export default function JourneysPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [journeys, setJourneys] = useState<any[]>([]);
  const [boats, setBoats] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'start_date' | 'created_at'>('start_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterBoatId, setFilterBoatId] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const itemsPerPage = 9; // 3 columns × 3 rows
  const [hasOwnerRole, setHasOwnerRole] = useState<boolean | null>(null);
  const [deletingJourneyId, setDeletingJourneyId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      checkOwnerRole();
      loadJourneys();
    }
  }, [user, authLoading, router]);

  const checkOwnerRole = async () => {
    if (!user) {
      setHasOwnerRole(false);
      return;
    }
    const status = await checkProfile(user.id);
    setHasOwnerRole(status.exists && status.roles.includes('owner'));
  };

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

  // Handle delete journey
  const handleDeleteJourney = async (journeyId: string) => {
    setDeletingJourneyId(journeyId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteJourney = async () => {
    if (!deletingJourneyId) return;

    setIsDeleting(true);
    const supabase = getSupabaseBrowserClient();

    try {
      // First, delete all legs associated with this journey (and their waypoints via cascade)
      const { error: legsError } = await supabase
        .from('legs')
        .delete()
        .eq('journey_id', deletingJourneyId);

      if (legsError) {
        console.error('Error deleting legs:', legsError);
        throw new Error('Failed to delete journey legs: ' + legsError.message);
      }

      // Then delete the journey itself
      const { error: journeyError } = await supabase
        .from('journeys')
        .delete()
        .eq('id', deletingJourneyId);

      if (journeyError) {
        console.error('Error deleting journey:', journeyError);
        throw new Error('Failed to delete journey: ' + journeyError.message);
      }

      // Reload journeys list
      await loadJourneys();
      setShowDeleteConfirm(false);
      setDeletingJourneyId(null);
    } catch (error: any) {
      console.error('Error deleting journey:', error);
      alert(error.message || 'Failed to delete journey');
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || loading || hasOwnerRole === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <FeatureGate feature="create_journey">
      <div className="min-h-screen bg-background">

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">My Journeys & Legs</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage your journeys and their legs</p>
        </div>

        <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={() => {
                setEditingJourneyId(null);
                setIsModalOpen(true);
              }}
              className="bg-primary text-primary-foreground px-4 sm:px-6 py-2 sm:py-3 min-h-[44px] rounded-lg transition-opacity font-medium inline-flex items-center justify-center gap-2 hover:opacity-90"
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
              className="bg-secondary text-secondary-foreground px-4 sm:px-6 py-2 sm:py-3 min-h-[44px] rounded-lg transition-opacity font-medium inline-flex items-center justify-center gap-2 hover:opacity-90 border border-border"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Propose Journey
            </button>
          </div>
          {(journeys.length > 0 || boats.length > 0) && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                {boats.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label htmlFor="filter-boat" className="text-xs sm:text-sm text-muted-foreground">
                      Boat:
                    </label>
                    <select
                      id="filter-boat"
                      value={filterBoatId}
                      onChange={(e) => handleFilterChange('boat', e.target.value)}
                      className="px-3 py-2 min-h-[44px] border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label htmlFor="filter-state" className="text-xs sm:text-sm text-muted-foreground">
                    State:
                  </label>
                  <select
                    id="filter-state"
                    value={filterState}
                    onChange={(e) => handleFilterChange('state', e.target.value)}
                    className="px-3 py-2 min-h-[44px] border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                  >
                    <option value="all">All States</option>
                    <option value="In planning">In planning</option>
                    <option value="Published">Published</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>
              {/* Sort */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:ml-auto">
                <label htmlFor="sort-select" className="text-xs sm:text-sm text-muted-foreground">
                  Sort by:
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="sort-select"
                    value={sortField}
                    onChange={(e) => handleSortChange(e.target.value as 'start_date' | 'created_at')}
                    className="px-3 py-2 min-h-[44px] border border-border bg-input-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm"
                  >
                    <option value="start_date">Journey start date</option>
                    <option value="created_at">Creation date</option>
                  </select>
                  <button
                    onClick={() => {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      setCurrentPage(1);
                    }}
                    className="px-2 py-2 min-w-[44px] min-h-[44px] border border-border bg-input-background rounded-md hover:bg-accent transition-colors flex items-center justify-center"
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
                .map((journey) => {
                  // Determine state tag colors
                  const getStateTagStyle = (state: string) => {
                    switch (state) {
                      case 'In planning':
                        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800';
                      case 'Published':
                        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
                      case 'Archived':
                        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800';
                      default:
                        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800';
                    }
                  };

                  return (
                    <div key={journey.id} className="bg-card rounded-lg shadow p-6 flex flex-col">
                      {/* Tags at the top */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {/* Journey State Tag */}
                        {journey.state && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-md ${getStateTagStyle(journey.state)}`}>
                            {journey.state}
                          </span>
                        )}
                        {/* AI Generated Tag */}
                        {journey.is_ai_generated && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-md">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            AI generated
                          </span>
                        )}
                      </div>
                      {/* Journey Name */}
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-card-foreground mb-2">{journey.name}</h3>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {journey.boat_name && <p>Boat: {journey.boat_name}</p>}
                          {journey.start_date && <p>Start: {formatDate(journey.start_date)}</p>}
                          {journey.end_date && <p>End: {formatDate(journey.end_date)}</p>}
                        </div>
                      </div>
                      {journey.description && (
                        <p className="text-muted-foreground mb-4 text-sm sm:text-base">{journey.description}</p>
                      )}
                      {/* Navigation Icons */}
                      <div className="flex items-center justify-center gap-2 mt-auto pt-4 border-t border-border">
                        {/* Edit Journey */}
                        <Link
                          href={`/owner/journeys/${journey.id}/edit`}
                          className="p-1.5 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                          title="Edit journey"
                          aria-label="Edit journey"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </Link>
                        {/* Legs View */}
                        <Link
                          href={`/owner/journeys/${journey.id}/legs`}
                          className="p-1.5 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                          title="View legs"
                          aria-label="View legs"
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
                              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                            />
                          </svg>
                        </Link>
                        {/* Registrations View */}
                        <Link
                          href={`/owner/journeys/${journey.id}/registrations`}
                          className="p-1.5 text-foreground hover:text-primary transition-colors rounded hover:bg-accent"
                          title="View registrations"
                          aria-label="View registrations"
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
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                        </Link>
                        {/* Delete Journey */}
                        <button
                          onClick={() => handleDeleteJourney(journey.id)}
                          className="p-1.5 text-destructive hover:text-destructive/80 transition-colors rounded hover:bg-destructive/10"
                          title="Delete journey"
                          aria-label="Delete journey"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
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
      <Footer />

      {/* Journey Form Modal */}
      {user && (
        <>
          <JourneyFormModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
            }}
            onSuccess={() => {
              loadJourneys();
              setCurrentPage(1); // Reset to first page after creating
            }}
            journeyId={null}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">
                Delete Journey?
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete this journey? This will permanently delete the journey and all its legs. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingJourneyId(null);
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteJourney}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
