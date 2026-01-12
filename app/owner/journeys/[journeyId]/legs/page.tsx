'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { MapboxMap } from '@/app/components/MapboxMap';
import { JourneyFormModal } from '@/app/components/JourneyFormModal';

type Journey = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

export default function LegsManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const journeyId = params?.journeyId as string;
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaneOpen, setIsPaneOpen] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user && journeyId) {
      loadJourney();
    }
  }, [user, authLoading, router, journeyId]);

  const loadJourney = async () => {
    if (!user || !journeyId) return;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('journeys')
      .select('id, name, start_date, end_date')
      .eq('id', journeyId)
      .single();

    if (error) {
      console.error('Error loading journey:', error);
    } else {
      setJourney(data);
    }
    setLoading(false);
  };

  const handleMapLoad = (map: any) => {
    // TODO: Add legs markers and routes to the map
    console.log('Map loaded:', map);
  };

  const handleEditSuccess = () => {
    loadJourney();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 flex overflow-hidden relative">
        {/* Toggle Button */}
        <button
          onClick={() => setIsPaneOpen(!isPaneOpen)}
          className={`absolute top-4 z-10 bg-card border border-border rounded-md p-2 shadow-sm hover:bg-accent transition-all ${
            isPaneOpen ? 'left-[320px]' : 'left-4'
          }`}
          title={isPaneOpen ? 'Close panel' : 'Open panel'}
          aria-label={isPaneOpen ? 'Close panel' : 'Open panel'}
        >
          <svg
            className="w-5 h-5 text-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            {isPaneOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            )}
          </svg>
        </button>

        {/* Left Sidebar - Journey Info */}
        <div
          className={`${
            isPaneOpen ? 'w-80' : 'w-0'
          } border-r border-border bg-card flex flex-col transition-all duration-300 overflow-hidden`}
        >
          {isPaneOpen && (
            <>
              <div className="p-6 border-b border-border">
                {journey && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-lg font-semibold text-card-foreground">
                          {journey.name}
                        </h2>
                        <button
                          onClick={() => setIsEditModalOpen(true)}
                          title="Edit journey details"
                          className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          aria-label="Edit journey details"
                        >
                          <svg
                            className="w-4 h-4"
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
                        </button>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {journey.start_date && (
                          <p>
                            <span className="font-medium">Start:</span>{' '}
                            {new Date(journey.start_date).toLocaleDateString()}
                          </p>
                        )}
                        {journey.end_date && (
                          <p>
                            <span className="font-medium">End:</span>{' '}
                            {new Date(journey.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 p-6">
                {/* TODO: Add legs list here */}
                <p className="text-sm text-muted-foreground">
                  Legs will be listed here
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right Side - Map Container */}
        <div className="flex-1 relative">
          <MapboxMap
            initialCenter={[0, 20]} // Default center (can be updated based on journey/legs data)
            initialZoom={2}
            onMapLoad={handleMapLoad}
            className="absolute inset-0"
          />
        </div>
      </main>

      {/* Journey Edit Modal */}
      {user && journey && (
        <JourneyFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
          journeyId={journey.id}
          userId={user.id}
        />
      )}
    </div>
  );
}
