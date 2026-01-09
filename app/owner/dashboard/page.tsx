'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { NavigationMenu } from '@/app/components/NavigationMenu';
import { LogoWithText } from '@/app/components/LogoWithText';

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [boats, setBoats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    if (user) {
      loadBoats();
    }
  }, [user, authLoading, router]);

  const loadBoats = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('boats')
      .select('*')
      .eq('owner_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading boats:', error);
    } else {
      setBoats(data || []);
    }
    setLoading(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Owner Dashboard</h1>
          <p className="text-gray-600">Manage your boats and journeys</p>
        </div>

        <div className="mb-6">
          <Link
            href="/owner/boats/new"
            className="text-white px-4 py-2 rounded-lg transition-colors font-medium"
            style={{ backgroundColor: '#2C4969' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F3449'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2C4969'}
          >
            + Add New Boat
          </Link>
        </div>

        <div className="grid gap-6">
          {boats.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">You haven't added any boats yet.</p>
              <Link
                href="/owner/boats/new"
                className="font-medium"
                style={{ color: '#2C4969' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#1F3449'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#2C4969'}
              >
                Add your first boat →
              </Link>
            </div>
          ) : (
            boats.map((boat) => (
              <div key={boat.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{boat.name}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Type: {boat.type}</p>
                  {boat.make && <p>Make: {boat.make}</p>}
                  {boat.model && <p>Model: {boat.model}</p>}
                  {boat.capacity && <p>Capacity: {boat.capacity} people</p>}
                  {boat.home_port && <p>Home Port: {boat.home_port}</p>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/owner/boats/${boat.id}/edit`}
                    className="font-medium text-sm"
                    style={{ color: '#2C4969' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1F3449'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#2C4969'}
                  >
                    Edit
                  </Link>
                  <span className="text-gray-300">|</span>
                  <Link
                    href={`/owner/boats/${boat.id}/journeys`}
                    className="font-medium text-sm"
                    style={{ color: '#2C4969' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1F3449'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#2C4969'}
                  >
                    View Journeys
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
