'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { NavigationMenu } from '@/app/components/NavigationMenu';
import { LogoWithText } from '@/app/components/LogoWithText';

export default function JourneysPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [journeys, setJourneys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    
    // First get all boats owned by user
    const { data: boatsData } = await supabase
      .from('boats')
      .select('id')
      .eq('owner_id', user?.id);

    if (boatsData && boatsData.length > 0) {
      const boatIds = boatsData.map(b => b.id);
      
      // Then get all journeys for those boats
      const { data, error } = await supabase
        .from('journeys')
        .select('*, boats(name)')
        .in('boat_id', boatIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading journeys:', error);
      } else {
        setJourneys(data || []);
      }
    }
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <LogoWithText forceRole="owner" />
            <div className="flex items-center">
              <NavigationMenu />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Journeys & Legs</h1>
          <p className="text-gray-600">Manage your journeys and their legs</p>
        </div>

        <div className="mb-6">
          <Link
            href="/owner/journeys/new"
            className="text-white px-4 py-2 rounded-lg transition-colors font-medium inline-block"
            style={{ backgroundColor: '#2C4969' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F3449'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2C4969'}
          >
            + Create New Journey
          </Link>
        </div>

        <div className="grid gap-6">
          {journeys.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">You haven't created any journeys yet.</p>
              <Link
                href="/owner/journeys/new"
                className="font-medium"
                style={{ color: '#2C4969' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#1F3449'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#2C4969'}
              >
                Create your first journey →
              </Link>
            </div>
          ) : (
            journeys.map((journey) => (
              <div key={journey.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{journey.name}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      {journey.boat_name && <p>Boat: {journey.boat_name}</p>}
                      {journey.start_date && <p>Start: {new Date(journey.start_date).toLocaleDateString()}</p>}
                      {journey.end_date && <p>End: {new Date(journey.end_date).toLocaleDateString()}</p>}
                      <p className={journey.is_public ? 'text-green-600' : 'text-gray-500'}>
                        {journey.is_public ? 'Public' : 'Private'}
                      </p>
                    </div>
                  </div>
                </div>
                {journey.description && (
                  <p className="text-gray-600 mb-4">{journey.description}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/owner/journeys/${journey.id}`}
                    className="font-medium text-sm"
                    style={{ color: '#2C4969' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1F3449'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#2C4969'}
                  >
                    View Details & Legs
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link
                    href={`/owner/journeys/${journey.id}/edit`}
                    className="font-medium text-sm"
                    style={{ color: '#2C4969' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1F3449'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#2C4969'}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
