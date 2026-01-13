'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { getSupabaseBrowserClient } from '@/app/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { BoatFormModal } from '@/app/components/manage/BoatFormModal';

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
          <h1 className="text-3xl font-bold text-foreground mb-2">My Boats</h1>
          <p className="text-muted-foreground">Manage your boats and their details</p>
        </div>

        <div className="mb-6">
          <button
            onClick={() => {
              setEditingBoatId(null);
              setIsModalOpen(true);
            }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg transition-opacity font-medium inline-block hover:opacity-90"
          >
            + Add New Boat
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boats.length === 0 ? (
            <div className="bg-card rounded-lg shadow p-8 text-center">
              <p className="text-muted-foreground mb-4">You haven't added any boats yet.</p>
              <button
                onClick={() => {
                  setEditingBoatId(null);
                  setIsModalOpen(true);
                }}
                className="font-medium text-primary hover:opacity-80"
              >
                Add your first boat →
              </button>
            </div>
          ) : (
            boats.map((boat) => (
              <div key={boat.id} className="bg-card rounded-lg shadow-md p-6">
                <div className="flex gap-4">
                  {/* Boat Image */}
                  {boat.images && boat.images.length > 0 && (
                    <div className="flex-shrink-0">
                      <Image
                        src={boat.images[0]}
                        alt={boat.name}
                        width={128}
                        height={128}
                        className="w-32 h-32 object-cover rounded-lg border border-border"
                        unoptimized
                      />
                    </div>
                  )}
                  
                  {/* Boat Details */}
                  <div className="flex-1 h-32 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-card-foreground mb-2">{boat.name}</h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Type: {boat.type}</p>
                        {boat.make && <p>Make: {boat.make}</p>}
                        {boat.model && <p>Model: {boat.model}</p>}
                        {boat.capacity && <p>Capacity: {boat.capacity} people</p>}
                        {boat.average_speed_knots && <p>Avg Speed: {boat.average_speed_knots} knots</p>}
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
                    className="font-medium text-sm text-primary hover:opacity-80"
                  >
                    Edit
                  </button>
                  <span className="text-border">|</span>
                  <Link
                    href={`/owner/boats/${boat.id}/journeys`}
                    className="font-medium text-sm text-primary hover:opacity-80"
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
