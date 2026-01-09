'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { NavigationMenu } from '@/app/components/NavigationMenu';
import { LogoWithText } from '@/app/components/LogoWithText';
import { BoatFormModal } from '@/app/components/BoatFormModal';

export default function BoatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [boats, setBoats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBoatId, setEditingBoatId] = useState<string | null>(null);

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Boats</h1>
          <p className="text-gray-600">Manage your boats and their details</p>
        </div>

        <div className="mb-6">
          <button
            onClick={() => {
              setEditingBoatId(null);
              setIsModalOpen(true);
            }}
            className="text-white px-4 py-2 rounded-lg transition-colors font-medium inline-block"
            style={{ backgroundColor: '#2C4969' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F3449'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2C4969'}
          >
            + Add New Boat
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boats.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">You haven't added any boats yet.</p>
              <button
                onClick={() => {
                  setEditingBoatId(null);
                  setIsModalOpen(true);
                }}
                className="font-medium"
                style={{ color: '#2C4969' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#1F3449'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#2C4969'}
              >
                Add your first boat →
              </button>
            </div>
          ) : (
            boats.map((boat) => (
              <div key={boat.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex gap-4">
                  {/* Boat Image */}
                  {boat.images && boat.images.length > 0 && (
                    <div className="flex-shrink-0">
                      <Image
                        src={boat.images[0]}
                        alt={boat.name}
                        width={128}
                        height={128}
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                        unoptimized
                      />
                    </div>
                  )}
                  
                  {/* Boat Details */}
                  <div className="flex-1 h-32 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">{boat.name}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Type: {boat.type}</p>
                        {boat.make && <p>Make: {boat.make}</p>}
                        {boat.model && <p>Model: {boat.model}</p>}
                        {boat.capacity && <p>Capacity: {boat.capacity} people</p>}
                        {boat.home_port && <p>Home Port: {boat.home_port}</p>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingBoatId(boat.id);
                      setIsModalOpen(true);
                    }}
                    className="font-medium text-sm"
                    style={{ color: '#2C4969' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1F3449'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#2C4969'}
                  >
                    Edit
                  </button>
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

      {/* Boat Form Modal */}
      {user && (
        <BoatFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBoatId(null);
          }}
          onSuccess={() => {
            loadBoats();
          }}
          boatId={editingBoatId}
          userId={user.id}
        />
      )}
    </div>
  );
}
